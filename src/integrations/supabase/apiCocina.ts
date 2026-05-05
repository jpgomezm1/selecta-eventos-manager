import { supabase } from "@/integrations/supabase/client";

export interface PlatoProduccion {
  /** ID en evento_requerimiento_platos (único por (evento, plato)) */
  req_id: string;
  plato_id: string;
  nombre: string;
  cantidad: number;
  tiempo_preparacion: string | null;
  temperatura_coccion: string | null;
  porciones_receta: number | null;
  notas: string | null;
}

export interface EventoProduccion {
  id: string;
  nombre_evento: string;
  ubicacion: string;
  fecha_evento: string; // "YYYY-MM-DD"
  descripcion: string | null;
  platos: PlatoProduccion[];
}

export interface IngredienteEscalado {
  ingrediente_id: string;
  nombre: string;
  unidad: string;
  cantidad_total: number;
}

export interface RecetaEscalada {
  plato_id: string;
  nombre: string;
  cantidad_pedida: number;
  porciones_receta: number | null;
  tiempo_preparacion: string | null;
  temperatura_coccion: string | null;
  rendimiento: string | null;
  notas: string | null;
  ingredientes: IngredienteEscalado[];
}

/**
 * Devuelve los eventos en el rango [fechaInicio, fechaFin] (ambas inclusive)
 * con el snapshot de platos a preparar para cada uno. Sin filtro de estado:
 * un evento existe en `eventos` solo después de aceptar la versión definitiva,
 * así que todo lo que cae en el rango es producción confirmada.
 *
 * Para vista de "día" pasar misma fecha en ambos parámetros.
 */
export async function getProduccionPorRango(
  fechaInicio: string,
  fechaFin: string
): Promise<EventoProduccion[]> {
  const { data: eventos, error: eErr } = await supabase
    .from("eventos")
    .select("id, nombre_evento, ubicacion, fecha_evento, descripcion")
    .gte("fecha_evento", fechaInicio)
    .lte("fecha_evento", fechaFin)
    .order("fecha_evento", { ascending: true });

  if (eErr) throw eErr;
  if (!eventos || eventos.length === 0) return [];

  const eventoIds = eventos.map((e) => e.id);

  const { data: reqPlatos, error: pErr } = await supabase
    .from("evento_requerimiento_platos")
    .select(
      "id, evento_id, plato_id, cantidad, nombre, platos_catalogo(nombre, tiempo_preparacion, temperatura_coccion, porciones_receta, notas)"
    )
    .in("evento_id", eventoIds);

  if (pErr) throw pErr;

  type ReqRow = {
    id: string;
    evento_id: string;
    plato_id: string;
    cantidad: number;
    nombre: string | null;
    platos_catalogo?: {
      nombre: string;
      tiempo_preparacion: string | null;
      temperatura_coccion: string | null;
      porciones_receta: number | null;
      notas: string | null;
    } | null;
  };

  const platosByEvento = new Map<string, PlatoProduccion[]>();
  for (const row of (reqPlatos ?? []) as ReqRow[]) {
    const arr = platosByEvento.get(row.evento_id) ?? [];
    arr.push({
      req_id: row.id,
      plato_id: row.plato_id,
      nombre: row.nombre ?? row.platos_catalogo?.nombre ?? "Plato sin nombre",
      cantidad: Number(row.cantidad),
      tiempo_preparacion: row.platos_catalogo?.tiempo_preparacion ?? null,
      temperatura_coccion: row.platos_catalogo?.temperatura_coccion ?? null,
      porciones_receta: row.platos_catalogo?.porciones_receta ?? null,
      notas: row.platos_catalogo?.notas ?? null,
    });
    platosByEvento.set(row.evento_id, arr);
  }

  return eventos.map((e) => ({
    id: e.id,
    nombre_evento: e.nombre_evento,
    ubicacion: e.ubicacion,
    fecha_evento: e.fecha_evento,
    descripcion: e.descripcion,
    platos: (platosByEvento.get(e.id) ?? []).sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es")
    ),
  }));
}

/**
 * Devuelve la receta de un plato escalada a la cantidad pedida (cantidad de porciones a producir).
 * Misma lógica de escalado que generateOrdenCompra (apiOrdenCompra.ts:39-75):
 *   cantidadPorPorcion = ingrediente.cantidad / porciones_receta
 *   total = cantidadPorPorcion * cantidad_pedida
 * Si porciones_receta es null/0, asume 1.
 */
export async function getRecetaEscalada(
  platoId: string,
  cantidadPedida: number
): Promise<RecetaEscalada> {
  const [{ data: plato, error: plErr }, { data: ingredientes, error: ingErr }] = await Promise.all([
    supabase
      .from("platos_catalogo")
      .select("id, nombre, porciones_receta, tiempo_preparacion, temperatura_coccion, rendimiento, notas")
      .eq("id", platoId)
      .single(),
    supabase
      .from("plato_ingredientes")
      .select("ingrediente_id, cantidad, ingredientes_catalogo(id, nombre, unidad)")
      .eq("plato_id", platoId),
  ]);

  if (plErr) throw plErr;
  if (ingErr) throw ingErr;
  if (!plato) throw new Error("Plato no encontrado");

  const porciones = plato.porciones_receta && plato.porciones_receta > 0 ? plato.porciones_receta : 1;
  const factor = cantidadPedida / porciones;

  type IngRow = {
    ingrediente_id: string;
    cantidad: number;
    ingredientes_catalogo?: { id: string; nombre: string; unidad: string } | null;
  };

  const escalados: IngredienteEscalado[] = ((ingredientes ?? []) as IngRow[])
    .map((row) => {
      const ing = row.ingredientes_catalogo;
      if (!ing) return null;
      return {
        ingrediente_id: ing.id,
        nombre: ing.nombre,
        unidad: ing.unidad,
        cantidad_total: Math.round(Number(row.cantidad) * factor * 100) / 100,
      };
    })
    .filter((x): x is IngredienteEscalado => x !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return {
    plato_id: plato.id,
    nombre: plato.nombre,
    cantidad_pedida: cantidadPedida,
    porciones_receta: plato.porciones_receta,
    tiempo_preparacion: plato.tiempo_preparacion,
    temperatura_coccion: plato.temperatura_coccion,
    rendimiento: plato.rendimiento,
    notas: plato.notas,
    ingredientes: escalados,
  };
}
