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
  return (data ?? []).map((d: any) => ({ ...d, stock_total: Number(d.stock_total), precio_alquiler: Number(d.precio_alquiler ?? 0) }));
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

/* =========================
 *  DESPACHO DESDE RESERVA
 * ========================= */

/** Create "salida" movement from a confirmed reservation */
export async function despacharMenajeDesdeReserva(
  reservaId: string,
  eventoId: string
): Promise<void> {
  // Check if already dispatched
  const { data: existing } = await supabase
    .from("menaje_movimientos")
    .select("id")
    .eq("reserva_id", reservaId)
    .eq("tipo", "salida")
    .limit(1)
    .maybeSingle();
  if (existing) throw new Error("El menaje ya fue despachado para esta reserva.");

  // Get reservation items
  const { data: items, error: iErr } = await supabase
    .from("menaje_reserva_items")
    .select("menaje_id, cantidad")
    .eq("reserva_id", reservaId);
  if (iErr) throw iErr;
  if (!items || items.length === 0) throw new Error("La reserva no tiene items.");

  // Create salida movement
  const { data: mov, error: mErr } = await supabase
    .from("menaje_movimientos")
    .insert({
      tipo: "salida",
      estado: "confirmado",
      evento_id: eventoId,
      reserva_id: reservaId,
      fecha: new Date().toISOString().slice(0, 10),
      notas: "Despacho de menaje para evento",
    })
    .select("id")
    .single();
  if (mErr) throw mErr;

  const movItems = items.map((i: any) => ({
    movimiento_id: mov.id,
    menaje_id: i.menaje_id,
    cantidad: Number(i.cantidad),
    merma: 0,
  }));
  const { error: miErr } = await supabase.from("menaje_mov_items").insert(movItems);
  if (miErr) throw miErr;
}

/** Register menaje return with breakage/loss */
export async function registrarDevolucionMenaje(
  reservaId: string,
  eventoId: string,
  itemsMerma: Array<{ menaje_id: string; cantidad_devuelta: number; merma: number }>
): Promise<void> {
  // Create ingreso movement
  const { data: mov, error: mErr } = await supabase
    .from("menaje_movimientos")
    .insert({
      tipo: "ingreso",
      estado: "confirmado",
      evento_id: eventoId,
      reserva_id: reservaId,
      fecha: new Date().toISOString().slice(0, 10),
      notas: "Devolución de menaje de evento",
    })
    .select("id")
    .single();
  if (mErr) throw mErr;

  const movItems = itemsMerma.map((i) => ({
    movimiento_id: mov.id,
    menaje_id: i.menaje_id,
    cantidad: i.cantidad_devuelta,
    merma: i.merma,
  }));
  const { error: miErr } = await supabase.from("menaje_mov_items").insert(movItems);
  if (miErr) throw miErr;

  // Decrement stock_total by merma for each item with merma > 0
  for (const i of itemsMerma) {
    if (i.merma > 0) {
      const { data: cat } = await supabase
        .from("menaje_catalogo")
        .select("stock_total")
        .eq("id", i.menaje_id)
        .single();
      if (cat) {
        await supabase
          .from("menaje_catalogo")
          .update({ stock_total: Math.max(0, Number(cat.stock_total) - i.merma) })
          .eq("id", i.menaje_id);
      }
    }
  }

  // Update reservation to "devuelto"
  await setReservaEstado(reservaId, "devuelto");
}
