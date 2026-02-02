import { supabase } from "@/integrations/supabase/client";
import type { InventarioMovimiento, InventarioMovItem, IngredienteCatalogo } from "@/types/cotizador";

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
  for (const m of movs ?? []) {
    const { data: it, error: e2 } = await supabase
      .from("inventario_mov_items")
      .select("*, ingrediente:ingrediente_id(id,nombre,unidad,costo_por_unidad)")
      .eq("movimiento_id", (m as any).id);
    if (e2) throw e2;
    result.push({ ...(m as InventarioMovimiento), items: (it ?? []) as any });
  }
  return result;
}

export async function inventarioMovimientoCreate(
  payload: Omit<InventarioMovimiento, "id" | "created_at">,
  items: Array<{ ingrediente_id: string; cantidad: number; costo_unitario?: number }>
) {
  const { data: mov, error } = await supabase
    .from("inventario_movimientos")
    .insert(payload as any)
    .select("*")
    .single();
  if (error) throw error;

  if (items.length) {
    const rows = items.map((i) => ({
      movimiento_id: (mov as any).id,
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
  // Update stock for each item based on movement type
  for (const item of items) {
    const { data: ing, error: eRead } = await supabase
      .from("ingredientes_catalogo")
      .select("stock_actual")
      .eq("id", item.ingrediente_id)
      .single();
    if (eRead) throw eRead;

    const currentStock = Number((ing as any).stock_actual) || 0;
    let newStock: number;

    switch (tipo) {
      case "compra":
        newStock = currentStock + Number(item.cantidad);
        break;
      case "uso":
      case "devolucion":
        newStock = Math.max(0, currentStock - Number(item.cantidad));
        break;
      case "ajuste":
        newStock = Number(item.cantidad);
        break;
      default:
        newStock = currentStock;
    }

    const { error: eUp } = await supabase
      .from("ingredientes_catalogo")
      .update({ stock_actual: newStock } as any)
      .eq("id", item.ingrediente_id);
    if (eUp) throw eUp;
  }

  // Mark movement as confirmed
  const { data, error } = await supabase
    .from("inventario_movimientos")
    .update({ estado: "confirmado" } as any)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as InventarioMovimiento;
}

export async function inventarioMovimientoDelete(id: string) {
  const { error } = await supabase.from("inventario_movimientos").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}
