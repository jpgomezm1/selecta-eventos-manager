import { supabase } from "@/integrations/supabase/client";
import type { EventoCosto, EstadoPagoCosto } from "@/lib/rentabilidadEvento";

/**
 * Datos crudos para calcular la rentabilidad de un evento. El cálculo vive en
 * `@/lib/rentabilidadEvento` — acá solo traemos.
 */
export interface DatosRentabilidad {
  platos: Array<{ plato_id: string; cantidad: number; subtotal: number }>;
  personal: Array<{ subtotal: number }>;
  menaje: Array<{ subtotal: number }>;
  transporte: Array<{ subtotal: number }>;
  pagosPersonal: Array<{ pago_calculado: number | null }>;
  costosManuales: EventoCosto[];
  imprevistoPct: number;
  /** `cotizaciones.total_cotizado`: lo que de verdad se le cobró al cliente. */
  totalCotizado: number;
  /** Precio del lugar, que no se copia a las tablas de requerimiento. */
  precioLugar: number;
}

export async function getDatosRentabilidad(eventoId: string): Promise<DatosRentabilidad> {
  const [platos, personal, menaje, transporte, pagos, costos, evento] = await Promise.all([
    supabase
      .from("evento_requerimiento_platos")
      .select("plato_id,cantidad,subtotal")
      .eq("evento_id", eventoId),
    supabase.from("evento_requerimiento_personal").select("subtotal").eq("evento_id", eventoId),
    supabase.from("evento_requerimiento_menaje").select("subtotal").eq("evento_id", eventoId),
    supabase.from("evento_requerimiento_transporte").select("subtotal").eq("evento_id", eventoId),
    supabase.from("evento_personal").select("pago_calculado").eq("evento_id", eventoId),
    supabase
      .from("evento_costos")
      .select("*")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: true }),
    // El total cotizado y el lugar viven en la cotización congelada, no en el
    // evento. Mismo join que usa getEventoRequerimiento en apiCotizador.
    supabase
      .from("eventos")
      .select(
        `imprevisto_pct,
         cotizacion_versiones (
           cotizaciones (
             total_cotizado,
             cotizacion_lugares ( precio_referencia, es_seleccionado, orden )
           )
         )`
      )
      .eq("id", eventoId)
      .single(),
  ]);

  const primerError =
    platos.error ??
    personal.error ??
    menaje.error ??
    transporte.error ??
    pagos.error ??
    costos.error ??
    evento.error;
  if (primerError) throw primerError;

  type LugarRow = { precio_referencia?: number | null; es_seleccionado?: boolean; orden?: number };
  type EventoRow = {
    imprevisto_pct?: number | null;
    cotizacion_versiones?: {
      cotizaciones?: { total_cotizado?: number | null; cotizacion_lugares?: LugarRow[] };
    };
  };
  const cot = (evento.data as EventoRow | null)?.cotizacion_versiones?.cotizaciones;
  const lugares = cot?.cotizacion_lugares ?? [];
  // Mismo criterio que el cotizador: el marcado, y si ninguno lo está, el primero.
  const lugarSel =
    lugares.find((l) => l.es_seleccionado) ??
    [...lugares].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0] ??
    null;

  return {
    totalCotizado: Number(cot?.total_cotizado ?? 0),
    precioLugar: Number(lugarSel?.precio_referencia ?? 0),
    platos: (platos.data ?? []).map((p) => ({
      plato_id: p.plato_id,
      cantidad: Number(p.cantidad),
      subtotal: Number(p.subtotal),
    })),
    personal: (personal.data ?? []).map((p) => ({ subtotal: Number(p.subtotal) })),
    menaje: (menaje.data ?? []).map((m) => ({ subtotal: Number(m.subtotal) })),
    transporte: (transporte.data ?? []).map((t) => ({ subtotal: Number(t.subtotal) })),
    pagosPersonal: (pagos.data ?? []).map((p) => ({
      pago_calculado: p.pago_calculado === null ? null : Number(p.pago_calculado),
    })),
    costosManuales: (costos.data ?? []).map((c) => ({
      id: c.id,
      evento_id: c.evento_id,
      categoria: c.categoria,
      descripcion: c.descripcion,
      proveedor: c.proveedor,
      monto: Number(c.monto),
      estado_pago: c.estado_pago as EstadoPagoCosto,
    })),
    imprevistoPct: Number(evento.data?.imprevisto_pct ?? 0),
  };
}

export async function createCostoEvento(input: {
  evento_id: string;
  categoria: string;
  descripcion: string | null;
  proveedor: string | null;
  monto: number;
  estado_pago: EstadoPagoCosto;
}): Promise<void> {
  const { error } = await supabase.from("evento_costos").insert(input);
  if (error) throw error;
}

export async function updateCostoEvento(
  id: string,
  updates: Partial<{
    categoria: string;
    descripcion: string | null;
    proveedor: string | null;
    monto: number;
    estado_pago: EstadoPagoCosto;
  }>
): Promise<void> {
  const { error } = await supabase
    .from("evento_costos")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCostoEvento(id: string): Promise<void> {
  const { error } = await supabase.from("evento_costos").delete().eq("id", id);
  if (error) throw error;
}

export async function setImprevistoPct(eventoId: string, pct: number): Promise<void> {
  const { error } = await supabase
    .from("eventos")
    .update({ imprevisto_pct: pct })
    .eq("id", eventoId);
  if (error) throw error;
}
