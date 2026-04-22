import { supabase } from "@/integrations/supabase/client";
import type { OrdenCompra, OrdenCompraItem } from "@/types/cotizador";

/** Auto-generate purchase order from event requirements */
export async function generateOrdenCompra(
  eventoId: string
): Promise<{ orden: OrdenCompra; items: OrdenCompraItem[] }> {
  // 1. Get platos del requerimiento
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

  // 2. Get plato ingredients with catalog info
  const platoIds = reqPlatos.map((r) => r.plato_id);

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
    (platosCatalogo ?? []).map((p) => [p.id, p.porciones_receta || 1])
  );
  const platoCantMap = new Map(
    reqPlatos.map((r) => [r.plato_id, r.cantidad])
  );

  // 3. Aggregate ingredients
  const ingredienteAgg = new Map<
    string,
    { nombre: string; unidad: string; costo: number; stock: number; totalNecesario: number }
  >();

  for (const pi of platoIngredientes ?? []) {
    const ing = (pi as any).ingredientes_catalogo;
    if (!ing) continue;

    const porcionesReceta = porcionesMap.get(pi.plato_id) || 1;
    const platoCant = platoCantMap.get(pi.plato_id) || 1;
    // ingredient per portion × total portions to prepare
    const cantidadPorPorcion = Number(pi.cantidad) / porcionesReceta;
    const totalNecesario = cantidadPorPorcion * platoCant;

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

  // 4. Build items
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

  // 5. Insert order + items
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
    .select("*, ingredientes_catalogo(stock_actual)")
    .eq("orden_id", orden.id)
    .order("nombre");

  // Refresh cantidad_inventario with live stock from ingredientes_catalogo
  const mapped = (items ?? []).map((r) => {
    const liveStock = Number(r.ingredientes_catalogo?.stock_actual ?? 0);
    const item = mapItem(r);
    item.cantidad_inventario = liveStock;
    item.cantidad_comprar = Math.round(Math.max(0, item.cantidad_necesaria - liveStock) * 100) / 100;
    item.subtotal = Math.round(item.cantidad_comprar * item.costo_unitario);
    return item;
  });

  return {
    orden: mapOrden(orden),
    items: mapped,
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

/** Create inventory "compra" movement from a purchased order.
 *  Atomic: delegates to the `registrar_compra_en_inventario` RPC which reads
 *  the order items, creates the movement + items and sums the stock in a
 *  single transaction. Returns silently if the order has no items to buy. */
export async function registrarCompraEnInventario(
  ordenId: string,
  eventoId: string
): Promise<void> {
  const { error } = await supabase.rpc("registrar_compra_en_inventario", {
    p_orden_id: ordenId,
    p_evento_id: eventoId,
  });
  if (error) throw error;
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
  const total = (items ?? []).reduce((a: number, r) => a + Number(r.subtotal), 0);
  await supabase
    .from("evento_orden_compra")
    .update({ total_estimado: Math.round(total), updated_at: new Date().toISOString() })
    .eq("id", ordenId);
}

function mapOrden(r): OrdenCompra {
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

function mapItem(r): OrdenCompraItem {
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
