import { supabase } from "@/integrations/supabase/client";
import type { IngredienteCatalogo } from "@/types/cotizador";

export interface InvoiceExtractedItem {
  nombre_factura: string;
  cantidad: number;
  unidad: string;
  costo_unitario: number;
  costo_total: number;
  ingrediente_id: string | null;
  nombre_catalogo: string | null;
  confianza: "alta" | "media" | "baja" | "sin_match";
}

export interface InvoiceExtraction {
  proveedor: string;
  numero_factura: string | null;
  fecha: string | null;
  items: InvoiceExtractedItem[];
  total_factura: number | null;
  notas: string | null;
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildFileContentBlock(base64: string, mediaType: string) {
  // PDFs use "document" type; images use "image" type
  if (mediaType === "application/pdf") {
    return {
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: mediaType,
        data: base64,
      },
    };
  }
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: mediaType,
      data: base64,
    },
  };
}

export async function scanInvoice(
  file: File,
  ingredientes: IngredienteCatalogo[]
): Promise<InvoiceExtraction> {
  const { base64, mediaType } = await fileToBase64(file);

  const catalogoStr = ingredientes
    .map((i) => `- id: "${i.id}", nombre: "${i.nombre}", unidad: "${i.unidad}"`)
    .join("\n");

  const systemPrompt = `Eres un asistente experto en lectura de facturas de proveedores de alimentos e insumos para catering en Colombia.

Tu tarea es:
1. Extraer todos los items/productos de la factura
2. Hacer match de cada item con el catálogo de ingredientes disponible
3. Asignar un nivel de confianza al match

Catálogo de ingredientes disponibles:
${catalogoStr}

Responde SOLO con JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "proveedor": "nombre del proveedor en la factura",
  "numero_factura": "número de factura o null",
  "fecha": "YYYY-MM-DD o null",
  "items": [
    {
      "nombre_factura": "nombre original tal cual aparece en la factura",
      "cantidad": number,
      "unidad": "unidad tal cual aparece (kg, lb, und, etc.)",
      "costo_unitario": number (sin formato, solo número),
      "costo_total": number (sin formato, solo número),
      "ingrediente_id": "id del catálogo matcheado o null",
      "nombre_catalogo": "nombre del ingrediente del catálogo o null",
      "confianza": "alta" | "media" | "baja" | "sin_match"
    }
  ],
  "total_factura": number o null,
  "notas": "observaciones relevantes (items no alimentarios excluidos, IVA, fletes, etc.)"
}

Reglas de matching:
- "alta": El nombre del item coincide claramente con un ingrediente del catálogo (ej: "Pollo" → "Pollo")
- "media": El item es similar pero hay ambigüedad (ej: "Pechuga de pollo" podría ser "Pollo" o "Pechuga")
- "baja": El item podría corresponder pero no es seguro
- "sin_match": No hay ningún ingrediente similar en el catálogo. Dejar ingrediente_id y nombre_catalogo como null

Reglas generales:
- Los costos deben ser números puros sin puntos de miles ni símbolo $
- Excluye servicios no alimentarios (IVA, fletes, domicilios) de los items, menciónales en notas
- Si la imagen no es legible o no parece una factura, retorna items vacío y explica en notas
- Usa abreviaturas estándar en minúscula: kg, gr, lb, oz, lt, ml, und

Reglas CRÍTICAS de cantidades y unidades:
- Mira la unidad base del ingrediente matcheado en el catálogo. Tu objetivo es devolver la cantidad TOTAL en una unidad convertible a esa unidad base.
- Cuando un item se vende por presentación (bolsa, caja, paca, botella, etc.) y la presentación indica un peso o volumen, CALCULA la cantidad total. Ejemplos:
  * "10 bolsas de hielo x 3kg" → cantidad: 30, unidad: "kg" (10 × 3kg)
  * "3 pacas de agua x 12 unidades de 600ml" → cantidad: 21600, unidad: "ml" (3 × 12 × 600ml)
  * "6 botellas de Aperol x 750ml" → cantidad: 6, unidad: "und" (si el catálogo usa "und")
  * "24 unidades de agua con gas x 1.5L" → cantidad: 36, unidad: "lt" (24 × 1.5L)
- Si la presentación NO indica peso/volumen Y el catálogo usa "und", devuelve la cantidad de unidades tal cual.
- Si la presentación indica peso/volumen, SIEMPRE devuelve la cantidad total en esa unidad de peso/volumen, NO en "und".
- El costo_unitario debe ser el costo POR UNIDAD de la unidad que devuelves (costo_total / cantidad).
- NUNCA devuelvas unidad "und" si el ingrediente del catálogo usa gr, kg, ml o lt.`;

  const fileBlock = buildFileContentBlock(base64, mediaType);

  const { data, error } = await supabase.functions.invoke("generate-recipe", {
    body: {
      // Sonnet 4.6 — visión + extracción precisa de datos numéricos en PDFs/
      // imágenes de facturas (50k-100k tokens según resolución). Haiku no tiene
      // suficiente precisión para esto.
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            fileBlock,
            {
              type: "text",
              text: "Extrae los items de esta factura y haz match con el catálogo de ingredientes.",
            },
          ],
        },
      ],
    },
  });

  if (error) {
    throw new Error(`Error al analizar la factura: ${error.message}`);
  }

  // The edge function proxies Anthropic's response directly —
  // a 400 from Anthropic arrives as data with an "error" field, not as a JS error.
  if (data?.error) {
    throw new Error(data.error?.message || "Error de la API de Anthropic");
  }

  const text = data?.content?.[0]?.text;
  if (!text) {
    throw new Error("Respuesta vacía de la IA");
  }

  try {
    const result = JSON.parse(text) as InvoiceExtraction;
    // Sanitize numeric values
    result.items = result.items.map((item) => ({
      ...item,
      cantidad: Number(item.cantidad) || 0,
      costo_unitario: Number(item.costo_unitario) || 0,
      costo_total: Number(item.costo_total) || 0,
    }));
    result.total_factura = result.total_factura ? Number(result.total_factura) || 0 : null;
    return result;
  } catch {
    throw new Error("La IA no retornó JSON válido. Intenta con una imagen más clara.");
  }
}
