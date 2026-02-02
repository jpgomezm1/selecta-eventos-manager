import { supabase } from "@/integrations/supabase/client";
import type { OrdenCompra, OrdenCompraItem } from "@/types/cotizador";

/** Auto-generate purchase order from event requirements */
export async function generateOrdenCompra(
  eventoId: string
): Promise<{ orden: OrdenCompra; items: OrdenCompraItem[] }> {
  // 1. Get evento + cotizacion info for invitados count
  const { data: evento, error: evErr } = await supabase
    .from("eventos")
    .select("id, cotizacion_version_id")
    .eq("id", eventoId)
    .single();
  if (evErr) throw evErr;

  let numeroInvitados = 1;
  if (evento.cotizacion_version_id) {
    const { data: ver } = await supabase
      .from("cotizacion_versiones")
      .select("cotizacion_id")
      .eq("id", evento.cotizacion_version_id)
      .single();
    if (ver) {
      const { data: cot } = await supabase
        .from("cotizaciones")
        .select("numero_invitados")
        .eq("id", ver.cotizacion_id)
        .single();
      if (cot) numeroInvitados = cot.numero_invitados || 1;
    }
  }

  // 2. Get platos del requerimiento
  const { data: reqPlatos } = await supabase
    .from("evento_requerimiento_platos")
    .select("plato_id, cantidad")
    .eq("evento_id", eventoId);

  if (!reqPlatos || reqPlatos.length === 0) {
    // Create empty order
    const { data: orden, error: oErr } = await supabase
      .from("evento_orden_compra")
      .insert({ evento_id: eventoId, estado: "borrador", total_estimado: 0 })
      .select("*")
      .single();
    if (oErr) throw oErr;
    return { orden: mapOrden(orden), items: [] };
  }

  // 3. Get plato ingredients with catalog info
  const platoIds = reqPlatos.map((r: any) => r.plato_id);

  const [{ data: platoIngredientes }, { data: platosCatalogo }] = await Promise.all([
    supabase
      .from("plato_ingredientes")
      .select("plato_id, ingrediente_id, cantidad, ingredientes_catalogo(id, nombre, unidad, costo_por_unidad, stock_actual)")
      .in("plato_id", platoIds),
    supabase
      .from("platos_catalogo")
      .select("id, porciones_receta")
      .in("id", platoIds),
  ]);

  const porcionesMap = new Map(
    (platosCatalogo ?? []).map((p: any) => [p.id, p.porciones_receta || 1])
  );
  const platoCantMap = new Map(
    reqPlatos.map((r: any) => [r.plato_id, r.cantidad])
  );

  // 4. Aggregate ingredients
  const ingredienteAgg = new Map<
    string,
    { nombre: string; unidad: string; costo: number; stock: number; totalNecesario: number }
  >();

  for (const pi of platoIngredientes ?? []) {
    const ing = (pi as any).ingredientes_catalogo;
    if (!ing) continue;

    const porcionesReceta = porcionesMap.get(pi.plato_id) || 1;
    const platoCant = platoCantMap.get(pi.plato_id) || 1;
    const cantidadPorInvitado = Number(pi.cantidad) / porcionesReceta;
    const totalNecesario = cantidadPorInvitado * platoCant * numeroInvitados;

    const existing = ingredienteAgg.get(ing.id);
    if (existing) {
      existing.totalNecesario += totalNecesario;
    } else {
      ingredienteAgg.set(ing.id, {
        nombre: ing.nombre,
        unidad: ing.unidad,
        costo: Number(ing.costo_por_unidad),
        stock: Number(ing.stock_actual ?? 0),
        totalNecesario,
      });
    }
  }

  // 5. Build items
  const itemRows: Array<{
    ingrediente_id: string;
    nombre: string;
    unidad: string;
    cantidad_necesaria: number;
    cantidad_inventario: number;
    cantidad_comprar: number;
    costo_unitario: number;
    subtotal: number;
  }> = [];

  let totalEstimado = 0;
  for (const [ingId, agg] of ingredienteAgg) {
    const cantidadComprar = Math.max(0, agg.totalNecesario - agg.stock);
    const subtotal = cantidadComprar * agg.costo;
    totalEstimado += subtotal;
    itemRows.push({
      ingrediente_id: ingId,
      nombre: agg.nombre,
      unidad: agg.unidad,
      cantidad_necesaria: Math.round(agg.totalNecesario * 100) / 100,
      cantidad_inventario: agg.stock,
      cantidad_comprar: Math.round(cantidadComprar * 100) / 100,
      costo_unitario: agg.costo,
      subtotal: Math.round(subtotal),
    });
  }

  // 6. Insert order + items
  const { data: orden, error: oErr } = await supabase
    .from("evento_orden_compra")
    .insert({
      evento_id: eventoId,
      estado: "borrador",
      total_estimado: Math.round(totalEstimado),
    })
    .select("*")
    .single();
  if (oErr) throw oErr;

  let items: OrdenCompraItem[] = [];
  if (itemRows.length > 0) {
    const rows = itemRows.map((r) => ({ ...r, orden_id: orden.id }));
    const { data: insertedItems, error: iErr } = await supabase
      .from("evento_orden_compra_items")
      .insert(rows)
      .select("*");
    if (iErr) throw iErr;
    items = (insertedItems ?? []).map(mapItem);
  }

  return { orden: mapOrden(orden), items };
}

/** Get existing purchase order for event */
export async function getOrdenCompra(
  eventoId: string
): Promise<{ orden: OrdenCompra; items: OrdenCompraItem[] } | null> {
  const { data: orden } = await supabase
    .from("evento_orden_compra")
    .select("*")
    .eq("evento_id", eventoId)
    .neq("estado", "cancelada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!orden) return null;

  const { data: items } = await supabase
    .from("evento_orden_compra_items")
    .select("*")
    .eq("orden_id", orden.id)
    .order("nombre");

  return {
    orden: mapOrden(orden),
    items: (items ?? []).map(mapItem),
  };
}

/** Update order status */
export async function updateOrdenCompraEstado(
  ordenId: string,
  estado: OrdenCompra["estado"]
): Promise<OrdenCompra> {
  const { data, error } = await supabase
    .from("evento_orden_compra")
    .update({ estado, updated_at: new Date().toISOString() })
    .eq("id", ordenId)
    .select("*")
    .single();
  if (error) throw error;

  // Auto-register inventory purchase when marked as "comprada"
  if (estado === "comprada") {
    await registrarCompraEnInventario(ordenId, data.evento_id);
  }

  return mapOrden(data);
}

/** Create inventory "compra" movement from a purchased order */
export async function registrarCompraEnInventario(
  ordenId: string,
  eventoId: string
): Promise<void> {
  // Fetch order items
  const { data: items, error: iErr } = await supabase
    .from("evento_orden_compra_items")
    .select("ingrediente_id, cantidad_comprar, costo_unitario")
    .eq("orden_id", ordenId);
  if (iErr) throw iErr;

  const compraItems = (items ?? []).filter((i: any) => Number(i.cantidad_comprar) > 0);
  if (compraItems.length === 0) return;

  // Create movement
  const { data: mov, error: mErr } = await supabase
    .from("inventario_movimientos")
    .insert({
      tipo: "compra",
      estado: "confirmado",
      evento_id: eventoId,
      fecha: new Date().toISOString().slice(0, 10),
      notas: "Compra desde orden de evento",
    })
    .select("id")
    .single();
  if (mErr) throw mErr;

  // Create movement items
  const movItems = compraItems.map((i: any) => ({
    movimiento_id: mov.id,
    ingrediente_id: i.ingrediente_id,
    cantidad: Number(i.cantidad_comprar),
    costo_unitario: Number(i.costo_unitario),
  }));
  const { error: miErr } = await supabase.from("inventario_mov_items").insert(movItems);
  if (miErr) throw miErr;

  // Update stock for each ingredient
  for (const i of compraItems) {
    const { data: ing } = await supabase
      .from("ingredientes_catalogo")
      .select("stock_actual")
      .eq("id", i.ingrediente_id)
      .single();
    if (ing) {
      await supabase
        .from("ingredientes_catalogo")
        .update({ stock_actual: Number(ing.stock_actual ?? 0) + Number(i.cantidad_comprar) })
        .eq("id", i.ingrediente_id);
    }
  }
}

/** Create inventory "uso" movement — dispatch ingredients for an event */
export async function despacharIngredientesEvento(eventoId: string): Promise<void> {
  // Check if already dispatched
  const { data: existing } = await supabase
    .from("inventario_movimientos")
    .select("id")
    .eq("evento_id", eventoId)
    .eq("tipo", "uso")
    .limit(1)
    .maybeSingle();
  if (existing) throw new Error("Los ingredientes ya fueron despachados para este evento.");

  // Get purchased order items
  const { data: orden } = await supabase
    .from("evento_orden_compra")
    .select("id")
    .eq("evento_id", eventoId)
    .eq("estado", "comprada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!orden) throw new Error("No hay orden de compra en estado 'comprada'.");

  const { data: items, error: iErr } = await supabase
    .from("evento_orden_compra_items")
    .select("ingrediente_id, cantidad_necesaria")
    .eq("orden_id", orden.id);
  if (iErr) throw iErr;

  const useItems = (items ?? []).filter((i: any) => Number(i.cantidad_necesaria) > 0);
  if (useItems.length === 0) return;

  // Create "uso" movement
  const { data: mov, error: mErr } = await supabase
    .from("inventario_movimientos")
    .insert({
      tipo: "uso",
      estado: "confirmado",
      evento_id: eventoId,
      fecha: new Date().toISOString().slice(0, 10),
      notas: "Despacho de ingredientes para evento",
    })
    .select("id")
    .single();
  if (mErr) throw mErr;

  const movItems = useItems.map((i: any) => ({
    movimiento_id: mov.id,
    ingrediente_id: i.ingrediente_id,
    cantidad: Number(i.cantidad_necesaria),
    costo_unitario: 0,
  }));
  const { error: miErr } = await supabase.from("inventario_mov_items").insert(movItems);
  if (miErr) throw miErr;

  // Decrement stock
  for (const i of useItems) {
    const { data: ing } = await supabase
      .from("ingredientes_catalogo")
      .select("stock_actual")
      .eq("id", i.ingrediente_id)
      .single();
    if (ing) {
      await supabase
        .from("ingredientes_catalogo")
        .update({ stock_actual: Math.max(0, Number(ing.stock_actual ?? 0) - Number(i.cantidad_necesaria)) })
        .eq("id", i.ingrediente_id);
    }
  }
}

/** Update a single item */
export async function updateOrdenCompraItem(
  itemId: string,
  patch: Partial<Pick<OrdenCompraItem, "cantidad_comprar" | "costo_unitario">>
): Promise<OrdenCompraItem> {
  const updates: any = { ...patch };
  if (patch.cantidad_comprar != null && patch.costo_unitario != null) {
    updates.subtotal = patch.cantidad_comprar * patch.costo_unitario;
  }
  const { data, error } = await supabase
    .from("evento_orden_compra_items")
    .update(updates)
    .eq("id", itemId)
    .select("*")
    .single();
  if (error) throw error;
  return mapItem(data);
}

/** Delete draft order and regenerate */
export async function regenerateOrdenCompra(
  eventoId: string
): Promise<{ orden: OrdenCompra; items: OrdenCompraItem[] }> {
  // Delete existing draft
  await supabase
    .from("evento_orden_compra")
    .delete()
    .eq("evento_id", eventoId)
    .eq("estado", "borrador");

  return generateOrdenCompra(eventoId);
}

/** Recalculate order total from items */
export async function recalcOrdenTotal(ordenId: string): Promise<void> {
  const { data: items } = await supabase
    .from("evento_orden_compra_items")
    .select("subtotal")
    .eq("orden_id", ordenId);
  const total = (items ?? []).reduce((a: number, r: any) => a + Number(r.subtotal), 0);
  await supabase
    .from("evento_orden_compra")
    .update({ total_estimado: Math.round(total), updated_at: new Date().toISOString() })
    .eq("id", ordenId);
}

function mapOrden(r: any): OrdenCompra {
  return {
    id: r.id,
    evento_id: r.evento_id,
    estado: r.estado,
    total_estimado: Number(r.total_estimado),
    notas: r.notas,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function mapItem(r: any): OrdenCompraItem {
  return {
    id: r.id,
    orden_id: r.orden_id,
    ingrediente_id: r.ingrediente_id,
    nombre: r.nombre,
    unidad: r.unidad,
    cantidad_necesaria: Number(r.cantidad_necesaria),
    cantidad_inventario: Number(r.cantidad_inventario),
    cantidad_comprar: Number(r.cantidad_comprar),
    costo_unitario: Number(r.costo_unitario),
    subtotal: Number(r.subtotal),
  };
}
