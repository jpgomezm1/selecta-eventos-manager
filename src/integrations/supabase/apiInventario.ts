import { supabase } from "@/integrations/supabase/client";
import type { Database } from "./types";
import type { InventarioMovimiento, InventarioMovItem, IngredienteCatalogo } from "@/types/cotizador";

type MovRow = Database["public"]["Tables"]["inventario_movimientos"]["Row"];
type MovInsert = Database["public"]["Tables"]["inventario_movimientos"]["Insert"];
type MovUpdate = Database["public"]["Tables"]["inventario_movimientos"]["Update"];

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

export async function inventarioMovimientoConfirmar(id: string) {
  const { data, error } = await supabase.rpc("fn_inventario_movimiento_confirmar", {
    p_movimiento_id: id,
  });
  if (error) throw error;
  return data as unknown as InventarioMovimiento;
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

export async function inventarioMovimientoDeleteConReversa(id: string) {
  const { error } = await supabase.rpc("fn_inventario_movimiento_delete_con_reversa", {
    p_movimiento_id: id,
  });
  if (error) throw error;
  return { ok: true };
}
