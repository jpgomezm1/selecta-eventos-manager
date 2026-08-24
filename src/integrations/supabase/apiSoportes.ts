import { supabase } from "@/integrations/supabase/client";

/**
 * Bandeja de soportes de pago que llegan por correo (AgentMail).
 *
 * Un soporte NO es un abono: es un correo que llegó. Al conciliarlo,
 * `fn_conciliar_soporte_pago` crea la fila en `factura_abonos` y marca el
 * soporte, todo en una transacción — si se hiciera en dos pasos desde acá, un
 * fallo a mitad dejaría el abono creado y el soporte pendiente, y alguien lo
 * conciliaría otra vez.
 */

export type EstadoSoporte = "pendiente" | "conciliado" | "descartado";

export interface SoportePago {
  id: string;
  remitente: string | null;
  asunto: string | null;
  cuerpo: string | null;
  recibido_at: string;
  archivo_url: string | null;
  archivo_nombre: string | null;
  monto_detectado: number | null;
  fecha_detectada: string | null;
  referencia_detectada: string | null;
  banco_detectado: string | null;
  estado: EstadoSoporte;
  factura_id: string | null;
  abono_id: string | null;
  notas: string | null;
  /**
   * Etiquetas del mensaje en AgentMail. `spam`, `blocked` y `unauthenticated`
   * no lo descartan —perder un pago real es peor— pero sí lo marcan.
   */
  etiquetas: string[];
}

/** Etiquetas que ponen el soporte bajo sospecha. */
const SOSPECHOSAS = ["spam", "blocked", "unauthenticated"];

/**
 * Un correo que no pasó la verificación del remitente puede ser un gateway
 * corporativo mal configurado —el caso común— o alguien intentando colar un
 * comprobante falso en la bandeja de cobranza. La diferencia no la puede hacer
 * el sistema: la hace quien concilia, y para eso necesita verlo.
 */
export function motivoSospecha(s: SoportePago): string | null {
  const marcas = (s.etiquetas ?? []).filter((e) => SOSPECHOSAS.includes(e));
  if (marcas.length === 0) return null;
  if (marcas.includes("unauthenticated")) {
    return "El correo no trae la firma del dominio del remitente. Suele pasar con servidores corporativos, pero también es como se falsifica un remitente: confirma con quien lo envió antes de conciliar.";
  }
  if (marcas.includes("blocked")) {
    return "El remitente está en la lista de bloqueados del buzón.";
  }
  return "AgentMail marcó este correo como spam.";
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function listSoportes(estado?: EstadoSoporte): Promise<SoportePago[]> {
  let q = supabase.from("soportes_pago").select("*").order("recibido_at", { ascending: false });
  if (estado) q = q.eq("estado", estado);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((s) => ({
    ...(s as unknown as SoportePago),
    monto_detectado: num(s.monto_detectado),
    etiquetas: Array.isArray(s.etiquetas) ? (s.etiquetas as string[]) : [],
  }));
}

/** Guarda lo que leyó la IA. Son sugerencias: no cambian ningún saldo. */
export async function guardarLecturaIA(
  id: string,
  datos: {
    monto_detectado: number | null;
    fecha_detectada: string | null;
    referencia_detectada: string | null;
    banco_detectado: string | null;
    notas: string | null;
  }
): Promise<void> {
  const { error } = await supabase.from("soportes_pago").update(datos).eq("id", id);
  if (error) throw error;
}

export async function conciliarSoporte(params: {
  soporteId: string;
  facturaId: string;
  monto: number;
  fecha?: string | null;
  metodo?: string | null;
  referencia?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("fn_conciliar_soporte_pago", {
    p_soporte_id: params.soporteId,
    p_factura_id: params.facturaId,
    p_monto: params.monto,
    p_fecha: params.fecha ?? null,
    p_metodo: params.metodo ?? null,
    p_referencia: params.referencia ?? null,
  });
  if (error) throw error;
  return String(data);
}

export async function descartarSoporte(id: string, notas?: string): Promise<void> {
  const { error } = await supabase
    .from("soportes_pago")
    .update({ estado: "descartado", notas: notas ?? null })
    .eq("id", id);
  if (error) throw error;
}

/**
 * URL firmada de 1 hora para ver el comprobante. El bucket es privado: no se
 * puede exponer una URL permanente de un documento bancario.
 */
export async function urlComprobante(ruta: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("soportes-pago")
    .createSignedUrl(ruta, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Descarga el comprobante para poder pasárselo al lector de IA. */
export async function descargarComprobante(ruta: string, nombre: string): Promise<File | null> {
  const { data, error } = await supabase.storage.from("soportes-pago").download(ruta);
  if (error || !data) return null;
  return new File([data], nombre, { type: data.type || "application/octet-stream" });
}
