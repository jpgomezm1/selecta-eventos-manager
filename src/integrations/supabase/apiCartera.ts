import { supabase } from "@/integrations/supabase/client";
import type {
  Abono,
  EmpresaEmisora,
  FacturaCartera,
  FilaImportacion,
  ResumenCartera,
} from "@/types/cartera";

/**
 * Cartera.
 *
 * El saldo NO se guarda: sale de `valor_total - suma(abonos)` en la vista
 * `v_cartera_facturas`. Guardarlo garantiza que se desincronice el día que
 * alguien corrija un abono, y la cartera es justamente el sitio donde un número
 * viejo hace más daño.
 *
 * El resumen (totales, composición y matriz por cliente) lo arma
 * `fn_cartera_resumen` en una sola pasada de SQL en vez de tres queries: son
 * las tres vistas del mismo corte y tienen que cuadrar entre sí.
 */

/** `numeric` de Postgres llega como string por JSON. */
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function listEmpresasEmisoras(): Promise<EmpresaEmisora[]> {
  const { data, error } = await supabase
    .from("empresas_emisoras")
    .select("id, nombre, nit, activo")
    .eq("activo", true)
    .order("nombre");
  if (error) throw error;
  return (data ?? []) as EmpresaEmisora[];
}

export async function getResumenCartera(
  fechaCorte?: string,
  empresaId?: string | null
): Promise<ResumenCartera> {
  const { data, error } = await supabase.rpc("fn_cartera_resumen", {
    p_fecha_corte: fechaCorte ?? new Date().toISOString().slice(0, 10),
    p_empresa_id: empresaId ?? null,
  });
  if (error) throw error;

  const raw = (data ?? {}) as Record<string, unknown>;
  const t = (raw.totales ?? {}) as Record<string, unknown>;
  return {
    fecha_corte: String(raw.fecha_corte ?? ""),
    totales: {
      cartera_total: num(t.cartera_total),
      corriente: num(t.corriente),
      vencida: num(t.vencida),
      critica: num(t.critica),
      facturas: num(t.facturas),
      clientes: num(t.clientes),
      clientes_criticos: num(t.clientes_criticos),
      pct_corriente: num(t.pct_corriente),
      pct_vencida: num(t.pct_vencida),
      pct_critica: num(t.pct_critica),
    },
    composicion: ((raw.composicion ?? []) as Record<string, unknown>[]).map((c) => ({
      tramo: c.tramo as ResumenCartera["composicion"][number]["tramo"],
      valor: num(c.valor),
    })),
    por_cliente: ((raw.por_cliente ?? []) as Record<string, unknown>[]).map((c) => ({
      cliente_id: String(c.cliente_id),
      nombre: String(c.nombre),
      documento: (c.documento as string) ?? null,
      emisora: String(c.emisora ?? ""),
      total: num(c.total),
      corriente: num(c.corriente),
      t31_60: num(c.t31_60),
      t61_90: num(c.t61_90),
      t_mas_90: num(c.t_mas_90),
      vencido: num(c.vencido),
      critico: num(c.critico),
      pct_vencido: num(c.pct_vencido),
      estado_riesgo: c.estado_riesgo as ResumenCartera["por_cliente"][number]["estado_riesgo"],
    })),
  };
}

export async function listFacturas(empresaId?: string | null): Promise<FacturaCartera[]> {
  let q = supabase
    .from("v_cartera_facturas")
    .select("*")
    .order("fecha_emision", { ascending: false });
  if (empresaId) q = q.eq("empresa_emisora_id", empresaId);

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((f) => ({
    ...(f as unknown as FacturaCartera),
    valor_total: num(f.valor_total),
    abonado: num(f.abonado),
    saldo: num(f.saldo),
    edad_dias: num(f.edad_dias),
    dias_mora: num(f.dias_mora),
    dias_credito: num(f.dias_credito),
  }));
}

export interface FacturaInput {
  empresa_emisora_id: string;
  cliente_id: string;
  numero: string;
  fecha_emision: string;
  dias_credito: number;
  valor_total: number;
  evento_id?: string | null;
  notas?: string | null;
}

export async function crearFactura(input: FacturaInput): Promise<string> {
  const { data, error } = await supabase
    .from("facturas_venta")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function actualizarFactura(
  id: string,
  patch: Partial<FacturaInput> & { anulada?: boolean }
): Promise<void> {
  const { error } = await supabase
    .from("facturas_venta")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function listAbonos(facturaId: string): Promise<Abono[]> {
  const { data, error } = await supabase
    .from("factura_abonos")
    .select("*")
    .eq("factura_id", facturaId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((a) => ({
    ...(a as unknown as Abono),
    monto: num(a.monto),
  }));
}

export interface AbonoInput {
  factura_id: string;
  fecha: string;
  monto: number;
  metodo?: string | null;
  referencia?: string | null;
  notas?: string | null;
}

export async function registrarAbono(input: AbonoInput): Promise<void> {
  const { error } = await supabase.from("factura_abonos").insert(input);
  if (error) throw error;
}

export async function borrarAbono(id: string): Promise<void> {
  const { error } = await supabase.from("factura_abonos").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Carga inicial desde el Excel del cliente. Idempotente por (emisora, número):
 * volver a subir el mismo archivo no duplica, cuenta cuántas ya estaban.
 *
 * Ojo con el `saldo`: la planilla trae el SALDO PENDIENTE, no el valor original
 * de la factura. Entra como `valor_total` y por eso las importadas arrancan sin
 * abonos — los abonos viejos ya están descontados en ese número.
 */
export async function importarCartera(
  emisora: string,
  filas: Array<Pick<FilaImportacion, "cliente" | "documento" | "numero" | "fecha" | "saldo">>
): Promise<{ clientes_creados: number; facturas_creadas: number; facturas_repetidas: number }> {
  const { data, error } = await supabase.rpc("fn_cartera_importar", {
    p_payload: { emisora, filas } as unknown as never,
  });
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    clientes_creados: num(r.clientes_creados),
    facturas_creadas: num(r.facturas_creadas),
    facturas_repetidas: num(r.facturas_repetidas),
  };
}
