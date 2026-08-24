import { supabase } from "@/integrations/supabase/client";

/**
 * Lectura de comprobantes de pago con IA.
 *
 * Reusa la misma edge function que el escáner de facturas (`generate-recipe`,
 * que es un proxy a Anthropic con rate-limit por usuario) y el mismo patrón de
 * archivo → base64 → bloque document/image. Lo único distinto es el prompt y la
 * forma del resultado.
 *
 * Se ejecuta BAJO DEMANDA, desde la pantalla de conciliación, no al recibir el
 * correo: así el spam que llegue al buzón no quema tokens, y la llamada queda
 * bajo el rate-limit de un usuario real en vez de bajo el service role.
 *
 * Lo que devuelve son SUGERENCIAS. Un comprobante mal leído que se aplique solo
 * mueve el saldo de una factura sin que nadie lo note; por eso quien concilia
 * confirma o corrige cada campo antes de guardar.
 */

export interface DatosComprobante {
  banco: string | null;
  monto: number | null;
  /** ISO `YYYY-MM-DD`. */
  fecha: string | null;
  referencia: string | null;
  /** Quién paga, si el comprobante lo dice. */
  pagador: string | null;
  /** Qué tan legible estaba: sirve para saber cuánto desconfiar. */
  confianza: "alta" | "media" | "baja";
  notas: string | null;
}

function archivoABase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ base64: dataUrl.split(",")[1], mediaType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function bloqueArchivo(base64: string, mediaType: string) {
  // Los PDF van como "document"; las imágenes como "image".
  const source = { type: "base64" as const, media_type: mediaType, data: base64 };
  return mediaType === "application/pdf"
    ? { type: "document" as const, source }
    : { type: "image" as const, source };
}

const SYSTEM_PROMPT = `Eres un asistente que lee comprobantes de pago bancarios colombianos y extrae sus datos.

Devuelve SOLO un objeto JSON, sin explicaciones ni markdown, con esta forma exacta:

{
  "banco": string | null,
  "monto": number | null,
  "fecha": string | null,
  "referencia": string | null,
  "pagador": string | null,
  "confianza": "alta" | "media" | "baja",
  "notas": string | null
}

Reglas:
- "monto" va como número sin separadores ni símbolo: 2500000, no "$ 2.500.000".
- En Colombia el punto es separador de miles y la coma es decimal. "$1.250.000,50" es 1250000.5.
- "fecha" en formato YYYY-MM-DD. Si el comprobante trae DD/MM/AAAA, conviértela.
- "referencia" es el número de transacción, comprobante o aprobación. Si hay varios, usa el que el banco llama "número de aprobación" o "comprobante".
- "pagador" es quien envía el dinero, no quien lo recibe.
- "confianza" refleja qué tan legible estaba el documento: "baja" si tuviste que adivinar el monto o la fecha.
- Si un dato no aparece, ponlo en null. NO lo inventes: es preferible que una persona lo escriba a que el sistema registre un pago equivocado.
- En "notas" señala cualquier cosa rara: que parezca un comprobante de otra cuenta, que esté cortado, que el monto no se lea con certeza.`;

const TIMEOUT_MS = 90_000;

export async function leerComprobante(file: File): Promise<DatosComprobante> {
  const { base64, mediaType } = await archivoABase64(file);

  const llamada = supabase.functions.invoke("generate-recipe", {
    body: {
      // Mismo modelo que el escáner de facturas: extraer números de una imagen
      // con precisión es justo donde los modelos chicos fallan, y acá un dígito
      // mal leído es un pago mal registrado.
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            bloqueArchivo(base64, mediaType),
            { type: "text", text: "Extrae los datos de este comprobante de pago." },
          ],
        },
      ],
    },
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            "La lectura del comprobante tardó más de 90 segundos. Prueba con una imagen más liviana."
          )
        ),
      TIMEOUT_MS
    )
  );

  const { data, error } = await Promise.race([llamada, timeout]);
  if (error) throw new Error(`No se pudo leer el comprobante: ${error.message}`);
  // La edge function reenvía la respuesta de Anthropic tal cual: un 400 de
  // Anthropic llega como `data.error`, no como error de JS.
  if (data?.error) throw new Error(data.error?.message ?? "Error de la API de Anthropic");

  const texto = data?.content?.[0]?.text;
  if (!texto) throw new Error("La IA devolvió una respuesta vacía");

  try {
    const r = JSON.parse(texto) as DatosComprobante;
    return {
      ...r,
      monto: r.monto != null ? Number(r.monto) || null : null,
      confianza: (["alta", "media", "baja"] as const).includes(r.confianza) ? r.confianza : "baja",
    };
  } catch {
    throw new Error("La IA no devolvió JSON válido. Prueba con una imagen más clara.");
  }
}
