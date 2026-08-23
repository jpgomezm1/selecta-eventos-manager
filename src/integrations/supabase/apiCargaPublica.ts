import { supabase } from "@/integrations/supabase/client";

/**
 * Carga de datos desde la página pública `/carga/:token`.
 *
 * Todo pasa por funciones SECURITY DEFINER (migración
 * `20260823000000_carga_publica.sql`) que validan el token por dentro. Este
 * módulo NO hace `.from("...")` a propósito: la página se abre sin sesión y las
 * tablas de catálogo exigen rol, así que un select directo devolvería vacío y
 * un insert fallaría. Si hace falta un dato nuevo en la página, se agrega al
 * jsonb que arma `fn_carga_publica_datos`, no un query nuevo acá.
 *
 * Los errores que lanzan las funciones (link vencido, tope de filas, plato
 * inexistente) llegan como `error.message` en español y son mostrables tal cual.
 */

export interface CargaIngrediente {
  id: string;
  nombre: string;
  unidad: string;
  costo_por_unidad: number;
  /** Del proveedor principal, si ya tiene uno. Es lo que se precarga en la fila. */
  proveedor: string | null;
  presentacion_cantidad: number | null;
  presentacion_unidad: string | null;
  precio_presentacion: number | null;
}

export interface CargaPlatoItem {
  ingrediente_id: string;
  cantidad: number;
}

export interface CargaPlato {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number;
  sin_insumos: boolean;
  items: CargaPlatoItem[];
}

export interface CargaMenaje {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stock_total: number;
  precio_alquiler: number;
}

export interface CargaDatos {
  ingredientes: CargaIngrediente[];
  platos: CargaPlato[];
  menaje: CargaMenaje[];
}

/** Fila lista para escribir, tal como la espera `fn_bulk_upsert_costos_proveedor`. */
export interface FilaCostoGuardable {
  ingrediente_id: string;
  proveedor: string;
  presentacion_cantidad: number;
  presentacion_unidad: string;
  precio_presentacion: number;
  costo_por_unidad_base: number;
}

/** Los números vienen de `numeric` vía jsonb; blindamos contra null y string. */
function num(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export async function getCargaDatos(token: string): Promise<CargaDatos> {
  const { data, error } = await supabase.rpc("fn_carga_publica_datos", {
    p_token: token,
  });
  if (error) throw error;

  const raw = (data ?? {}) as {
    ingredientes?: unknown[];
    platos?: unknown[];
    menaje?: unknown[];
  };

  return {
    ingredientes: (raw.ingredientes ?? []).map((x) => {
      const i = x as Record<string, unknown>;
      return {
        id: String(i.id),
        nombre: String(i.nombre),
        unidad: String(i.unidad),
        costo_por_unidad: num(i.costo_por_unidad),
        proveedor: (i.proveedor as string) ?? null,
        presentacion_cantidad: numOrNull(i.presentacion_cantidad),
        presentacion_unidad: (i.presentacion_unidad as string) ?? null,
        precio_presentacion: numOrNull(i.precio_presentacion),
      };
    }),
    platos: (raw.platos ?? []).map((x) => {
      const p = x as Record<string, unknown>;
      return {
        id: String(p.id),
        nombre: String(p.nombre),
        categoria: (p.categoria as string) ?? null,
        precio: num(p.precio),
        sin_insumos: Boolean(p.sin_insumos),
        items: ((p.items ?? []) as unknown[]).map((y) => {
          const it = y as Record<string, unknown>;
          return {
            ingrediente_id: String(it.ingrediente_id),
            cantidad: num(it.cantidad),
          };
        }),
      };
    }),
    menaje: (raw.menaje ?? []).map((x) => {
      const m = x as Record<string, unknown>;
      return {
        id: String(m.id),
        nombre: String(m.nombre),
        categoria: String(m.categoria ?? ""),
        unidad: String(m.unidad ?? ""),
        stock_total: num(m.stock_total),
        precio_alquiler: num(m.precio_alquiler),
      };
    }),
  };
}

export async function guardarCostos(
  token: string,
  filas: FilaCostoGuardable[]
): Promise<void> {
  if (filas.length === 0) return;
  const { error } = await supabase.rpc("fn_carga_publica_costos", {
    p_token: token,
    p_payload: filas as unknown as never,
  });
  if (error) throw error;
}

/**
 * Reemplaza la receta completa del plato. Un array vacío la borra — es la forma
 * de deshacer, y es lo que hace también el editor de la app.
 */
export async function guardarReceta(
  token: string,
  platoId: string,
  items: CargaPlatoItem[]
): Promise<void> {
  const { error } = await supabase.rpc("fn_carga_publica_receta", {
    p_token: token,
    p_plato_id: platoId,
    p_items: items as unknown as never,
  });
  if (error) throw error;
}

/** Devuelve cuántos platos quedaron marcados (los que ya tienen receta se saltan). */
export async function marcarSinInsumos(
  token: string,
  platoIds: string[],
  valor: boolean
): Promise<number> {
  if (platoIds.length === 0) return 0;
  const { data, error } = await supabase.rpc("fn_carga_publica_sin_insumos", {
    p_token: token,
    p_plato_ids: platoIds,
    p_valor: valor,
  });
  if (error) throw error;
  return num(data);
}

export async function guardarMenaje(
  token: string,
  fila: Omit<CargaMenaje, "id"> & { id?: string }
): Promise<{ id: string; accion: "creado" | "actualizado" }> {
  const { data, error } = await supabase.rpc("fn_carga_publica_menaje", {
    p_token: token,
    p_fila: fila as unknown as never,
  });
  if (error) throw error;
  const r = (data ?? {}) as { id?: string; accion?: string };
  return {
    id: String(r.id),
    accion: r.accion === "creado" ? "creado" : "actualizado",
  };
}

export async function bajaMenaje(token: string, id: string): Promise<void> {
  const { error } = await supabase.rpc("fn_carga_publica_menaje_baja", {
    p_token: token,
    p_id: id,
  });
  if (error) throw error;
}
