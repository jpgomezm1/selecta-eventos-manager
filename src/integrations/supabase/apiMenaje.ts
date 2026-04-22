import { supabase } from "@/integrations/supabase/client";
import type {
  MenajeCatalogo,
  MenajeDisponible,
  MenajeReserva,
  MenajeReservaFull,
  MenajeMovimiento,
  MenajeMovimientoItem,
  MenajeReservaCal,
  OrdenMenajeItem,
  SalidaConEvento,
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
  return (data ?? []).map((d) => ({ ...d, stock_total: Number(d.stock_total), precio_alquiler: Number(d.precio_alquiler ?? 0) }));
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
  return (data ?? []).map((d) => ({
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
  (MenajeMovimiento & { items: MenajeMovimientoItem[]; nombre_evento?: string })[]
> {
  const { data: movs, error: e1 } = await supabase
    .from("menaje_movimientos")
    .select("*, eventos:evento_id(nombre_evento)")
    .order("fecha", { ascending: false });
  if (e1) throw e1;

  const result: (MenajeMovimiento & { items: MenajeMovimientoItem[]; nombre_evento?: string })[] = [];
  for (const m of movs ?? []) {
    const { data: it, error: e2 } = await supabase
      .from("menaje_mov_items")
      .select("*, menaje:menaje_id(id,nombre,categoria,unidad,stock_total)")
      .eq("movimiento_id", (m as any).id);
    if (e2) throw e2;
    result.push({
      ...(m as MenajeMovimiento),
      nombre_evento: (m as any).eventos?.nombre_evento ?? undefined,
      items: (it ?? []) as any,
    });
  }
  return result;
}

export async function movimientoCreate(
  payload: Omit<MenajeMovimiento, "id" | "created_at" | "updated_at">,
  items: Array<{ menaje_id: string; cantidad: number; merma?: number; nota?: string }>
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
      nota: i.nota ?? null,
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
  items: Array<{ menaje_id: string; cantidad: number; merma?: number; nota?: string }>
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
      nota: i.nota ?? null,
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
 *  SALIDAS CONFIRMADAS (para selector de ingreso)
 * ========================= */
export async function getSalidasConfirmadas(): Promise<SalidaConEvento[]> {
  // Fetch confirmed salidas with an associated event
  const { data: salidas, error: e1 } = await supabase
    .from("menaje_movimientos")
    .select("id, evento_id, reserva_id, fecha, eventos:evento_id(nombre_evento, fecha_evento)")
    .eq("tipo", "salida")
    .eq("estado", "confirmado")
    .not("evento_id", "is", null)
    .order("fecha", { ascending: false });
  if (e1) throw e1;

  // Fetch confirmed ingresos to exclude salidas that already have a return
  const { data: ingresos, error: e2 } = await supabase
    .from("menaje_movimientos")
    .select("evento_id, reserva_id")
    .eq("tipo", "ingreso")
    .eq("estado", "confirmado")
    .not("evento_id", "is", null);
  if (e2) throw e2;

  const ingresadoSet = new Set(
    (ingresos ?? []).map((i) => `${i.evento_id}|${i.reserva_id ?? ""}`)
  );

  const pendientes = (salidas ?? []).filter((s) =>
    !ingresadoSet.has(`${s.evento_id}|${s.reserva_id ?? ""}`)
  );

  // Fetch items for each pending salida
  const result: SalidaConEvento[] = [];
  for (const s of pendientes) {
    const { data: items, error: e3 } = await supabase
      .from("menaje_mov_items")
      .select("menaje_id, cantidad, menaje:menaje_id(nombre, unidad)")
      .eq("movimiento_id", (s as any).id);
    if (e3) throw e3;

    result.push({
      movimiento_id: (s as any).id,
      evento_id: (s as any).evento_id,
      nombre_evento: (s as any).eventos?.nombre_evento ?? "",
      fecha: (s as any).fecha,
      reserva_id: (s as any).reserva_id ?? null,
      items: (items ?? []).map((it) => ({
        menaje_id: it.menaje_id,
        cantidad: Number(it.cantidad) || 0,
        nombre: it.menaje?.nombre ?? "",
        unidad: it.menaje?.unidad ?? "und",
      })),
    });
  }
  return result;
}

/* =========================
 *  DESPACHO DESDE RESERVA
 * ========================= */

/** Create "salida" movement from a confirmed reservation with per-item quantities and notes.
 *  Atomic: delegates to the `despachar_menaje_desde_reserva` RPC so the movement
 *  and its items are inserted in a single transaction. */
export async function despacharMenajeDesdeReserva(
  reservaId: string,
  eventoId: string,
  items: Array<{
    menaje_id: string;
    cantidad_reservada: number;
    cantidad_despachada: number;
    nota?: string;
  }>
): Promise<void> {
  const { error } = await supabase.rpc("despachar_menaje_desde_reserva", {
    p_reserva_id: reservaId,
    p_evento_id: eventoId,
    p_items: items,
  });
  if (error) throw error;
}

/** Get dispatched items for a reservation (from the salida movement) */
export async function getSalidaItemsForReserva(
  reservaId: string
): Promise<Array<{
  menaje_id: string;
  nombre: string;
  unidad: string;
  cantidad_despachada: number;
}>> {
  const { data: mov } = await supabase
    .from("menaje_movimientos")
    .select("id")
    .eq("reserva_id", reservaId)
    .eq("tipo", "salida")
    .limit(1)
    .maybeSingle();

  if (!mov) return [];

  const { data: items, error } = await supabase
    .from("menaje_mov_items")
    .select("menaje_id, cantidad, menaje:menaje_id(nombre,unidad)")
    .eq("movimiento_id", mov.id);
  if (error) throw error;

  return (items ?? []).map((i) => ({
    menaje_id: i.menaje_id,
    nombre: i.menaje?.nombre ?? "",
    unidad: i.menaje?.unidad ?? "und",
    cantidad_despachada: Number(i.cantidad) || 0,
  }));
}

/** Register menaje return with breakage/loss per item.
 *  Atomic: delegates to the `registrar_devolucion_menaje` RPC so movement,
 *  items, stock decrement and reservation state change all commit together. */
export async function registrarDevolucionMenaje(
  reservaId: string,
  eventoId: string,
  items: Array<{
    menaje_id: string;
    cantidad_despachada: number;
    cantidad_devuelta: number;
    merma: number;
    nota?: string;
  }>
): Promise<void> {
  const { error } = await supabase.rpc("registrar_devolucion_menaje", {
    p_reserva_id: reservaId,
    p_evento_id: eventoId,
    p_items: items,
  });
  if (error) throw error;
}

/* =========================
 *   ORDEN DE MENAJE
 * ========================= */

/** Get existing menaje order (reservation) for an event, enriched with requirement + availability data */
export async function getOrdenMenaje(
  eventoId: string,
  fechaEvento: string
): Promise<{ reserva: MenajeReserva; items: OrdenMenajeItem[] } | null> {
  const { data: reserva } = await supabase
    .from("menaje_reservas")
    .select("*")
    .eq("evento_id", eventoId)
    .neq("estado", "cancelado")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reserva) return null;

  // Read reservation items with catalog info
  const rf = await readReserva(reserva.id);

  // Read requirements for enrichment
  const { data: reqs } = await supabase
    .from("evento_requerimiento_menaje")
    .select("menaje_id, nombre, cantidad, precio_alquiler")
    .eq("evento_id", eventoId);

  const reqMap = new Map(
    (reqs ?? []).map((r) => [r.menaje_id, r])
  );

  // Get availability
  const fecha = reserva.fecha_inicio || fechaEvento;
  const disponibles = await menajeDisponiblePorRango(fecha, fecha);
  const dispMap = new Map(disponibles.map((d) => [d.id, d]));

  const items: OrdenMenajeItem[] = rf.items.map((it) => {
    const req = reqMap.get(it.menaje_id);
    const disp = dispMap.get(it.menaje_id);
    return {
      menaje_id: it.menaje_id,
      nombre: it.menaje?.nombre ?? req?.nombre ?? "",
      unidad: it.menaje?.unidad ?? disp?.unidad ?? "und",
      cantidad_requerida: Number(req?.cantidad) || Number(it.cantidad) || 0,
      disponible: Number(disp?.disponible ?? 0) + Number(it.cantidad), // add back own reservation
      cantidad_reservar: Number(it.cantidad) || 0,
      precio_alquiler: Number(req?.precio_alquiler) || Number(it.menaje?.precio_alquiler) || 0,
    };
  });

  return { reserva: reserva as MenajeReserva, items };
}

/** Auto-generate menaje order (reservation) from event requirements */
export async function generateOrdenMenaje(
  eventoId: string,
  fechaEvento: string
): Promise<{ reserva: MenajeReserva; items: OrdenMenajeItem[] }> {
  // Check if already exists
  const existing = await getOrdenMenaje(eventoId, fechaEvento);
  if (existing) return existing;

  // Read menaje requirements
  const { data: reqMenaje, error: reqErr } = await supabase
    .from("evento_requerimiento_menaje")
    .select("menaje_id, nombre, cantidad, precio_alquiler")
    .eq("evento_id", eventoId);
  if (reqErr) throw reqErr;

  if (!reqMenaje || reqMenaje.length === 0) {
    // Create empty reservation
    const { data: reserva, error: rErr } = await supabase
      .from("menaje_reservas")
      .insert({ evento_id: eventoId, fecha_inicio: fechaEvento, fecha_fin: fechaEvento, estado: "borrador" })
      .select("*")
      .single();
    if (rErr) throw rErr;
    return { reserva: reserva as MenajeReserva, items: [] };
  }

  // Check availability
  const disponibles = await menajeDisponiblePorRango(fechaEvento, fechaEvento);
  const dispMap = new Map(disponibles.map((d) => [d.id, d]));

  // Build items
  const itemRows: OrdenMenajeItem[] = reqMenaje.map((req) => {
    const disp = dispMap.get(req.menaje_id);
    const cantRequerida = Number(req.cantidad) || 0;
    const cantDisponible = Number(disp?.disponible) || 0;
    return {
      menaje_id: req.menaje_id,
      nombre: req.nombre ?? disp?.nombre ?? "",
      unidad: disp?.unidad ?? "und",
      cantidad_requerida: cantRequerida,
      disponible: cantDisponible,
      cantidad_reservar: Math.min(cantRequerida, cantDisponible),
      precio_alquiler: Number(req.precio_alquiler) || 0,
    };
  });

  // Create reservation
  const { data: reserva, error: rErr } = await supabase
    .from("menaje_reservas")
    .insert({ evento_id: eventoId, fecha_inicio: fechaEvento, fecha_fin: fechaEvento, estado: "borrador" })
    .select("*")
    .single();
  if (rErr) throw rErr;

  // Insert items
  const rows = itemRows
    .filter((i) => i.cantidad_reservar > 0)
    .map((i) => ({
      reserva_id: reserva.id,
      menaje_id: i.menaje_id,
      cantidad: i.cantidad_reservar,
    }));
  if (rows.length > 0) {
    const { error: iErr } = await supabase.from("menaje_reserva_items").insert(rows);
    if (iErr) throw iErr;
  }

  // Re-fetch enriched to get consistent data
  return { reserva: reserva as MenajeReserva, items: itemRows };
}

/** Delete draft reservation and regenerate */
export async function regenerateOrdenMenaje(
  eventoId: string,
  fechaEvento: string
): Promise<{ reserva: MenajeReserva; items: OrdenMenajeItem[] }> {
  // Delete existing borrador items + reservation
  const { data: existing } = await supabase
    .from("menaje_reservas")
    .select("id")
    .eq("evento_id", eventoId)
    .eq("estado", "borrador")
    .maybeSingle();

  if (existing) {
    await supabase.from("menaje_reserva_items").delete().eq("reserva_id", existing.id);
    await supabase.from("menaje_reservas").delete().eq("id", existing.id);
  }

  return generateOrdenMenaje(eventoId, fechaEvento);
}
