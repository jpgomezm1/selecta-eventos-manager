import { supabase } from "@/integrations/supabase/client";
import type { Database } from "./types";
import type { InventarioMovimiento, InventarioMovItem, IngredienteCatalogo } from "@/types/cotizador";

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
  const { data, error } = await supabase
    .from("inventario_movimientos")
    .select(
      "*, items:inventario_mov_items(*, ingrediente:ingrediente_id(id,nombre,unidad,costo_por_unidad))"
    )
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (InventarioMovimiento & { items: InventarioMovItem[] })[];
}

export async function inventarioMovimientoCreate(
  payload: Omit<InventarioMovimiento, "id" | "created_at">,
  items: Array<{ ingrediente_id: string; cantidad: number; costo_unitario?: number }>,
  confirmar = false
) {
  const { data, error } = await supabase.rpc("fn_inventario_movimiento_create_atomic", {
    p_payload: {
      movimiento: payload,
      items: items.map((i) => ({
        ingrediente_id: i.ingrediente_id,
        cantidad: i.cantidad,
        costo_unitario: i.costo_unitario ?? 0,
      })),
    },
    p_confirmar: confirmar,
  });
  if (error) throw error;
  return data as unknown as InventarioMovimiento;
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
