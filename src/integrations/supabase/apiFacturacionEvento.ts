import { supabase } from "@/integrations/supabase/client";

/**
 * Reporte para facturar un evento.
 *
 * Es lo que pidió el cliente: "el reporte que se necesita para emitir la
 * factura del evento". Junta lo cotizado con lo que se rompió o no volvió de
 * bodega, valorizado a costo de reposición.
 *
 * Todo lo arma `fn_reporte_facturacion_evento` en una sola pasada de SQL. No se
 * calcula nada acá a propósito: el total del reporte tiene que ser la suma de
 * sus renglones, y si el front suma por su cuenta terminan divergiendo el día
 * que alguien toque uno de los dos.
 */

export interface RenglonMenajePerdido {
  menaje_id: string;
  nombre: string;
  categoria: string | null;
  unidad: string | null;
  despachado: number;
  devuelto: number;
  /** Se rompió. */
  merma: number;
  /** No volvió y tampoco se reportó como roto. */
  faltante: number;
  costo_reposicion: number;
  valor_perdido: number;
  causas: string | null;
  notas: string | null;
}

export interface EstadoReporte {
  hubo_despacho: boolean;
  hubo_devolucion: boolean;
  /** Hay unidades perdidas de artículos sin costo de reposición: el total miente por defecto. */
  sin_costo_reposicion: boolean;
  ya_facturado: boolean;
}

export interface ReporteFacturacion {
  evento: {
    id: string;
    nombre: string;
    fecha: string;
    ubicacion: string;
    estado_liquidacion: string;
  } | null;
  cliente: { nombre: string | null; documento: string | null } | null;
  cotizado: number;
  menaje_perdido: number;
  total_a_facturar: number;
  menaje: RenglonMenajePerdido[];
  estado: EstadoReporte;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getReporteFacturacion(eventoId: string): Promise<ReporteFacturacion> {
  const { data, error } = await supabase.rpc("fn_reporte_facturacion_evento", {
    p_evento_id: eventoId,
  });
  if (error) throw error;

  const raw = (data ?? {}) as Record<string, unknown>;
  const est = (raw.estado ?? {}) as Record<string, unknown>;

  return {
    evento: (raw.evento ?? null) as ReporteFacturacion["evento"],
    cliente: (raw.cliente ?? null) as ReporteFacturacion["cliente"],
    cotizado: num(raw.cotizado),
    menaje_perdido: num(raw.menaje_perdido),
    total_a_facturar: num(raw.total_a_facturar),
    menaje: ((raw.menaje ?? []) as Record<string, unknown>[]).map((m) => ({
      menaje_id: String(m.menaje_id),
      nombre: String(m.nombre),
      categoria: (m.categoria as string) ?? null,
      unidad: (m.unidad as string) ?? null,
      despachado: num(m.despachado),
      devuelto: num(m.devuelto),
      merma: num(m.merma),
      faltante: num(m.faltante),
      costo_reposicion: num(m.costo_reposicion),
      valor_perdido: num(m.valor_perdido),
      causas: (m.causas as string) ?? null,
      notas: (m.notas as string) ?? null,
    })),
    estado: {
      hubo_despacho: Boolean(est.hubo_despacho),
      hubo_devolucion: Boolean(est.hubo_devolucion),
      sin_costo_reposicion: Boolean(est.sin_costo_reposicion),
      ya_facturado: Boolean(est.ya_facturado),
    },
  };
}
