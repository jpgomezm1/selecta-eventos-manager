import { supabase } from "@/integrations/supabase/client";
import type { Database } from "./types";
import type { InventarioMovimiento, InventarioMovItem, IngredienteCatalogo } from "@/types/cotizador";

type MovRow = Database["public"]["Tables"]["inventario_movimientos"]["Row"];
type MovInsert = Database["public"]["Tables"]["inventario_movimientos"]["Insert"];
type MovUpdate = Database["public"]["Tables"]["inventario_movimientos"]["Update"];
type IngRow = Database["public"]["Tables"]["ingredientes_catalogo"]["Row"];
type IngUpdate = Database["public"]["Tables"]["ingredientes_catalogo"]["Update"];

/* =========================
 *   STOCK DE INGREDIENTES
 * ========================= */
export async function ingredientesConStock(): Promise<IngredienteCatalogo[]> {
  const { data, error } = await supabase
    .from("ingredientes_catalogo")
    .select("*")
    .order("nombre");
  if (error) throw error;
  return (data ?? []) as IngredienteCatalogo[];
}

/* =========================
 *      MOVIMIENTOS CRUD
 * ========================= */
export async function inventarioMovimientosList(): Promise<
  (InventarioMovimiento & { items: InventarioMovItem[] })[]
> {
  const { data: movs, error: e1 } = await supabase
    .from("inventario_movimientos")
    .select("*")
    .order("fecha", { ascending: false });
  if (e1) throw e1;

  const result: (InventarioMovimiento & { items: InventarioMovItem[] })[] = [];
  for (const m of (movs ?? []) as MovRow[]) {
    const { data: it, error: e2 } = await supabase
      .from("inventario_mov_items")
      .select("*, ingrediente:ingrediente_id(id,nombre,unidad,costo_por_unidad)")
      .eq("movimiento_id", m.id);
    if (e2) throw e2;
    result.push({ ...(m as unknown as InventarioMovimiento), items: (it ?? []) as unknown as InventarioMovItem[] });
  }
  return result;
}

export async function inventarioMovimientoCreate(
  payload: Omit<InventarioMovimiento, "id" | "created_at">,
  items: Array<{ ingrediente_id: string; cantidad: number; costo_unitario?: number }>
) {
  const { data: mov, error } = await supabase
    .from("inventario_movimientos")
    .insert(payload as unknown as MovInsert)
    .select("*")
    .single();
  if (error) throw error;

  if (items.length) {
    const movRow = mov as MovRow;
    const rows = items.map((i) => ({
      movimiento_id: movRow.id,
      ingrediente_id: i.ingrediente_id,
      cantidad: i.cantidad,
      costo_unitario: i.costo_unitario ?? 0,
    }));
    const { error: e2 } = await supabase.from("inventario_mov_items").insert(rows);
    if (e2) throw e2;
  }
  return mov as InventarioMovimiento;
}

export async function inventarioMovimientoConfirmar(
  id: string,
  tipo: InventarioMovimiento["tipo"],
  items: InventarioMovItem[]
) {
  // Update stock for each item based on movement type.
  // NOTA: este loop NO es atómico. Si una fila falla a mitad de camino,
  // las anteriores quedan aplicadas (TODO.md describe el RPC necesario).
  for (const item of items) {
    const { data: ing, error: eRead } = await supabase
      .from("ingredientes_catalogo")
      .select("nombre, stock_actual")
      .eq("id", item.ingrediente_id)
      .single();
    if (eRead) throw eRead;

    const currentStock = Number((ing as IngRow).stock_actual) || 0;
    const cantidad = Number(item.cantidad);
    let newStock: number;

    switch (tipo) {
      case "compra":
        newStock = currentStock + cantidad;
        break;
      case "uso":
      case "devolucion":
        // Antes usaba Math.max(0, currentStock - cantidad), que silenciaba
        // consumos mayores al stock y dejaba el stock en 0 sin rastro.
        if (currentStock < cantidad) {
          const nombre = (ing as IngRow)?.nombre ?? item.ingrediente_id;
          throw new Error(
            `Stock insuficiente para "${nombre}": hay ${currentStock}, se intenta descontar ${cantidad}.`
          );
        }
        newStock = currentStock - cantidad;
        break;
      case "ajuste":
        newStock = cantidad;
        break;
      default:
        newStock = currentStock;
    }

    const { error: eUp } = await supabase
      .from("ingredientes_catalogo")
      .update({ stock_actual: newStock } as IngUpdate)
      .eq("id", item.ingrediente_id);
    if (eUp) throw eUp;
  }

  // Mark movement as confirmed
  const { data, error } = await supabase
    .from("inventario_movimientos")
    .update({ estado: "confirmado" } as MovUpdate)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as InventarioMovimiento;
}

export async function inventarioMovimientoUpdateFacturaUrl(id: string, facturaUrl: string) {
  const { error } = await supabase
    .from("inventario_movimientos")
    .update({ factura_url: facturaUrl } as MovUpdate)
    .eq("id", id);
  if (error) throw error;
}

export async function inventarioMovimientoDelete(id: string) {
  // Delete items first, then the movement
  await supabase.from("inventario_mov_items").delete().eq("movimiento_id", id);
  const { error } = await supabase.from("inventario_movimientos").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function inventarioMovimientoDeleteConReversa(
  id: string,
  tipo: InventarioMovimiento["tipo"],
  items: InventarioMovItem[]
) {
  // Reverse stock for each item (mirror of inventarioMovimientoConfirmar)
  for (const item of items) {
    const { data: ing, error: eRead } = await supabase
      .from("ingredientes_catalogo")
      .select("stock_actual")
      .eq("id", item.ingrediente_id)
      .single();
    if (eRead) throw eRead;

    const currentStock = Number((ing as IngRow).stock_actual) || 0;
    let newStock: number;

    switch (tipo) {
      case "compra":
        // Compra added stock → subtract to reverse
        newStock = Math.max(0, currentStock - Number(item.cantidad));
        break;
      case "uso":
      case "devolucion":
        // Uso/devolucion subtracted stock → add back to reverse
        newStock = currentStock + Number(item.cantidad);
        break;
      case "ajuste":
        // Cannot reverse absolute adjustment — leave stock as-is
        newStock = currentStock;
        break;
      default:
        newStock = currentStock;
    }

    const { error: eUp } = await supabase
      .from("ingredientes_catalogo")
      .update({ stock_actual: newStock } as IngUpdate)
      .eq("id", item.ingrediente_id);
    if (eUp) throw eUp;
  }

  // Delete items first, then the movement
  await supabase.from("inventario_mov_items").delete().eq("movimiento_id", id);
  const { error } = await supabase.from("inventario_movimientos").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}
