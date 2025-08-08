import { supabase } from "@/integrations/supabase/client";
import type {
  MenajeCatalogo,
  MenajeDisponible,
  MenajeReserva,
  MenajeReservaFull,
  MenajeMovimiento,
  MenajeMovimientoItem,
  MenajeReservaCal,
} from "@/types/menaje";

/* =========================
 *      CATÁLOGO CRUD
 * ========================= */
export async function menajeCatalogoList(): Promise<MenajeCatalogo[]> {
  const { data, error } = await supabase
    .from("menaje_catalogo")
    .select("*")
    .order("categoria")
    .order("nombre");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ ...d, stock_total: Number(d.stock_total) }));
}

export async function menajeCatalogoCreate(
  payload: Omit<MenajeCatalogo, "id" | "created_at">
) {
  const { data, error } = await supabase
    .from("menaje_catalogo")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as MenajeCatalogo;
}

export async function menajeCatalogoUpdate(id: string, patch: Partial<MenajeCatalogo>) {
  const { data, error } = await supabase
    .from("menaje_catalogo")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MenajeCatalogo;
}

export async function menajeCatalogoDelete(id: string) {
  const { error } = await supabase.from("menaje_catalogo").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

/* =========================
 *     DISPONIBILIDAD
 * ========================= */
export async function menajeDisponiblePorRango(
  inicio: string,
  fin: string
): Promise<MenajeDisponible[]> {
  const { data, error } = await supabase.rpc("fn_menaje_disponible", {
    _inicio: inicio,
    _fin: fin,
  });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    ...d,
    stock_total: Number(d.stock_total),
    reservado: Number(d.reservado),
    disponible: Number(d.disponible),
  }));
}

/* =========================
 *   RESERVAS (por evento)
 * ========================= */
export async function getOrCreateReservaForEvento(
  evento_id: string,
  fecha: string
): Promise<MenajeReserva> {
  // Busca una reserva existente para el evento (1 a 1)
  const { data: ex, error: e1 } = await supabase
    .from("menaje_reservas")
    .select("*")
    .eq("evento_id", evento_id)
    .maybeSingle();

  // PGRST116 = no rows, en algunos drivers no aparece; por eso simplemente si no hay ex, creamos
  if (e1 && (e1 as any).code !== "PGRST116") throw e1;

  if (ex) return ex as MenajeReserva;

  // Crear en estado borrador del mismo día
  const { data, error } = await supabase
    .from("menaje_reservas")
    .insert({
      evento_id,
      fecha_inicio: fecha,
      fecha_fin: fecha,
      estado: "borrador",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MenajeReserva;
}

export async function readReserva(reserva_id: string): Promise<MenajeReservaFull> {
  const { data: r, error: e1 } = await supabase
    .from("menaje_reservas")
    .select("*")
    .eq("id", reserva_id)
    .single();
  if (e1) throw e1;

  const { data: items, error: e2 } = await supabase
    .from("menaje_reserva_items")
    .select("*, menaje:menaje_id(id,nombre,categoria,unidad,stock_total)")
    .eq("reserva_id", reserva_id);
  if (e2) throw e2;

  // Guardamos baseline en memoria (para cálculos en MenajePanel si lo necesitas)
  const full: MenajeReservaFull = {
    ...(r as MenajeReserva),
    items: (items ?? []) as any,
  };
  (full as any)._baseline_items = full.items.map((i) => ({
    menaje_id: i.menaje_id,
    cantidad: i.cantidad,
  }));
  return full;
}

export async function saveReservaItems(
  reserva_id: string,
  items: Array<{ menaje_id: string; cantidad: number }>
) {
  const { error: e1 } = await supabase
    .from("menaje_reserva_items")
    .delete()
    .eq("reserva_id", reserva_id);
  if (e1) throw e1;

  if (items.length === 0) return { ok: true };

  const rows = items.map((i) => ({
    reserva_id,
    menaje_id: i.menaje_id,
    cantidad: i.cantidad,
  }));
  const { error: e2 } = await supabase.from("menaje_reserva_items").insert(rows);
  if (e2) throw e2;

  return { ok: true };
}

export async function setReservaEstado(
  reserva_id: string,
  estado: MenajeReserva["estado"]
) {
  const { error } = await supabase
    .from("menaje_reservas")
    .update({ estado })
    .eq("id", reserva_id);
  if (error) throw error;
  return { ok: true };
}

/* =========================
 *  CALENDARIO DE RESERVAS
 * ========================= */
export async function reservasCalendario(
  from: string,
  to: string
): Promise<MenajeReservaCal[]> {
  const { data, error } = await supabase
    .from("v_menaje_reservas_cal")
    .select("*")
    .gte("fecha_inicio", from)
    .lte("fecha_fin", to);
  if (error) throw error;
  return (data ?? []) as MenajeReservaCal[];
}

/* =========================
 *       MOVIMIENTOS
 * ========================= */
export async function movimientosList(): Promise<
  (MenajeMovimiento & { items: MenajeMovimientoItem[] })[]
> {
  const { data: movs, error: e1 } = await supabase
    .from("menaje_movimientos")
    .select("*")
    .order("fecha", { ascending: false });
  if (e1) throw e1;

  const result: (MenajeMovimiento & { items: MenajeMovimientoItem[] })[] = [];
  for (const m of movs ?? []) {
    const { data: it, error: e2 } = await supabase
      .from("menaje_mov_items")
      .select("*, menaje:menaje_id(id,nombre,categoria,unidad,stock_total)")
      .eq("movimiento_id", (m as any).id);
    if (e2) throw e2;
    result.push({ ...(m as MenajeMovimiento), items: (it ?? []) as any });
  }
  return result;
}

export async function movimientoCreate(
  payload: Omit<MenajeMovimiento, "id" | "created_at" | "updated_at">,
  items: Array<{ menaje_id: string; cantidad: number; merma?: number }>
) {
  const { data: mov, error } = await supabase
    .from("menaje_movimientos")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;

  if (items.length) {
    const rows = items.map((i) => ({
      movimiento_id: (mov as any).id,
      menaje_id: i.menaje_id,
      cantidad: i.cantidad,
      merma: i.merma ?? 0,
    }));
    const { error: e2 } = await supabase.from("menaje_mov_items").insert(rows);
    if (e2) throw e2;
  }
  return mov as MenajeMovimiento;
}

export async function movimientoUpdate(id: string, patch: Partial<MenajeMovimiento>) {
  const { data, error } = await supabase
    .from("menaje_movimientos")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MenajeMovimiento;
}

export async function movimientoUpsertItems(
  movimiento_id: string,
  items: Array<{ menaje_id: string; cantidad: number; merma?: number }>
) {
  const { error: e1 } = await supabase
    .from("menaje_mov_items")
    .delete()
    .eq("movimiento_id", movimiento_id);
  if (e1) throw e1;

  if (items.length) {
    const rows = items.map((i) => ({
      movimiento_id,
      menaje_id: i.menaje_id,
      cantidad: i.cantidad,
      merma: i.merma ?? 0,
    }));
    const { error: e2 } = await supabase.from("menaje_mov_items").insert(rows);
    if (e2) throw e2;
  }
  return { ok: true };
}

export async function movimientoConfirmar(id: string) {
  // Si el movimiento es "ingreso", el trigger SQL descuenta la merma del stock_total
  const { data, error } = await supabase
    .from("menaje_movimientos")
    .update({ estado: "confirmado" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MenajeMovimiento;
}

export async function movimientoDelete(id: string) {
  const { error } = await supabase.from("menaje_movimientos").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}
