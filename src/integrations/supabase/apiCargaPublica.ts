import { supabase } from "@/integrations/supabase/client";

/**
 * Carga de datos desde la página pública `/carga/:token`.
 *
 * Todo pasa por funciones SECURITY DEFINER (migraciones
 * `20260823000000_carga_publica.sql` y `20260823000300_carga_publica_insumos.sql`)
 * que validan el token por dentro. Este módulo NO hace `.from("...")` a
 * propósito: la página se abre sin sesión y las tablas de catálogo exigen rol,
 * así que un select directo devolvería vacío y un insert fallaría. Si hace
 * falta un dato nuevo en la página, se agrega al jsonb que arma
 * `fn_carga_publica_datos`, no un query nuevo acá.
 *
 * Los errores que lanzan las funciones (link vencido, insumo repetido, precio
 * en cero) llegan como `error.message` en español y son mostrables tal cual.
 */

export interface CargaProveedor {
  id: string;
  proveedor: string;
  /** Cómo se compra: 25 kg, 20 lt, 500 und. */
  presentacion_cantidad: number;
  presentacion_unidad: string;
  precio_presentacion: number;
  /** Ya dividido a la unidad base del insumo. Es lo que cuesta cocinarlo. */
  costo_por_unidad_base: number;
  /** El principal define el costo vigente del insumo. Solo uno por insumo. */
  es_principal: boolean;
}

export interface CargaIngrediente {
  id: string;
  nombre: string;
  unidad: string;
  /** Espejo del costo del proveedor principal; 0 si no tiene ninguno. */
  costo_por_unidad: number;
  proveedores: CargaProveedor[];
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

/** Los números vienen de `numeric` vía jsonb; blindamos contra null y string. */
function num(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function mapProveedor(x: unknown): CargaProveedor {
  const p = x as Record<string, unknown>;
  return {
    id: String(p.id),
    proveedor: String(p.proveedor ?? ""),
    presentacion_cantidad: num(p.presentacion_cantidad),
    presentacion_unidad: String(p.presentacion_unidad ?? ""),
    precio_presentacion: num(p.precio_presentacion),
    costo_por_unidad_base: num(p.costo_por_unidad_base),
    es_principal: Boolean(p.es_principal),
  };
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
        proveedores: ((i.proveedores ?? []) as unknown[]).map(mapProveedor),
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

/* =========================
 *         INSUMOS
 * ========================= */

/** Crea el insumo sin proveedor: el costo se carga después, con uno o varios. */
export async function crearInsumo(
  token: string,
  nombre: string,
  unidad: string
): Promise<{ id: string; nombre: string; unidad: string }> {
  const { data, error } = await supabase.rpc("fn_carga_publica_insumo_crear", {
    p_token: token,
    p_nombre: nombre,
    p_unidad: unidad,
  });
  if (error) throw error;
  const r = (data ?? {}) as { id?: string; nombre?: string; unidad?: string };
  return {
    id: String(r.id),
    nombre: String(r.nombre ?? nombre),
    unidad: String(r.unidad ?? unidad),
  };
}

export interface ProveedorGuardable {
  /** Vacío para dar de alta uno nuevo. */
  id?: string;
  ingrediente_id: string;
  proveedor: string;
  presentacion_cantidad: number;
  presentacion_unidad: string;
  precio_presentacion: number;
  costo_por_unidad_base: number;
  /** Si es el primero del insumo, el SQL lo marca principal aunque llegue false. */
  es_principal?: boolean;
}

export async function guardarProveedor(
  token: string,
  fila: ProveedorGuardable
): Promise<{ id: string; accion: "creado" | "actualizado"; es_principal: boolean }> {
  const { data, error } = await supabase.rpc("fn_carga_publica_proveedor_guardar", {
    p_token: token,
    p_payload: fila as unknown as never,
  });
  if (error) throw error;
  const r = (data ?? {}) as { id?: string; accion?: string; es_principal?: boolean };
  return {
    id: String(r.id),
    accion: r.accion === "creado" ? "creado" : "actualizado",
    es_principal: Boolean(r.es_principal),
  };
}

/**
 * Fija el costo por unidad base a mano, sin proveedor.
 *
 * Solo vale para insumos SIN proveedores: con proveedor el costo es derivado
 * del principal, y un valor puesto a mano lo pisaría el próximo guardado. El
 * SQL lo rechaza en ese caso. `costo = 0` lo borra.
 */
export async function guardarCostoDirecto(
  token: string,
  ingredienteId: string,
  costo: number
): Promise<number> {
  const { data, error } = await supabase.rpc("fn_carga_publica_costo_directo", {
    p_token: token,
    p_ingrediente_id: ingredienteId,
    p_costo: costo,
  });
  if (error) throw error;
  return num(data);
}

/** Cambia cuál proveedor define el costo vigente del insumo. */
export async function hacerProveedorPrincipal(
  token: string,
  ingredienteId: string,
  proveedorId: string
): Promise<void> {
  const { error } = await supabase.rpc("fn_carga_publica_proveedor_principal", {
    p_token: token,
    p_ingrediente_id: ingredienteId,
    p_proveedor_id: proveedorId,
  });
  if (error) throw error;
}

/**
 * Si el borrado deja al insumo sin principal, el SQL asciende a otro; si no
 * queda ninguno, el insumo vuelve a costo 0.
 */
export async function borrarProveedor(token: string, id: string): Promise<void> {
  const { error } = await supabase.rpc("fn_carga_publica_proveedor_borrar", {
    p_token: token,
    p_id: id,
  });
  if (error) throw error;
}

/* =========================
 *      RECETAS Y MENAJE
 * ========================= */

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
