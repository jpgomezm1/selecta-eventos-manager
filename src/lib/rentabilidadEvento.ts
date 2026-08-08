/**
 * Rentabilidad de un evento.
 *
 * Ingresos = lo que se le cobra al cliente, que ya vive en las tablas
 * evento_requerimiento_* (platos, personal, menaje, transporte).
 *
 * Costos = tres fuentes distintas, y la distinción importa porque no todas
 * tienen la misma confianza:
 *   1. Alimentos — derivado del recetario (costo de los ingredientes de cada
 *      plato). Solo vale lo que valga la data de costos de insumos.
 *   2. Personal — `evento_personal.pago_calculado`, lo que efectivamente se le
 *      paga al equipo. Es el más confiable porque se liquida contra él.
 *   3. Manuales — todo lo demás (decoración, flores, AV, fletes), capturado a
 *      mano en `evento_costos`.
 *
 * El margen se marca como "no confiable" cuando el costo de alimentos es 0
 * habiendo platos en el evento: es el caso real hoy (la mayoría de los
 * ingredientes tienen costo $0) y mostrar 90% de margen sin advertirlo sería
 * peor que no mostrar nada.
 */

export type EstadoPagoCosto = "pendiente" | "anticipo" | "pagado" | "credito";

export interface EventoCosto {
  id: string;
  evento_id: string;
  categoria: string;
  descripcion: string | null;
  proveedor: string | null;
  monto: number;
  estado_pago: EstadoPagoCosto;
}

export const CATEGORIAS_COSTO = [
  "Materias primas / Alimentos",
  "Bebidas",
  "Catering externo",
  "Alquiler de menaje",
  "Decoración y flores",
  "Audiovisuales e iluminación",
  "Personal externo",
  "Transporte y fletes",
  "Gastos administrativos",
  "Otros",
] as const;

export const ESTADOS_PAGO: Array<{ value: EstadoPagoCosto; label: string }> = [
  { value: "pendiente", label: "Pendiente" },
  { value: "anticipo", label: "Anticipo pagado" },
  { value: "pagado", label: "Pagado total" },
  { value: "credito", label: "Crédito 30 días" },
];

export interface IngresosEvento {
  platos: number;
  personal: number;
  menaje: number;
  transporte: number;
  total: number;
}

export interface CostosEvento {
  /** Derivado del recetario. */
  alimentos: number;
  /** Suma de pago_calculado del personal asignado. */
  personal: number;
  /** Suma de las líneas manuales de evento_costos. */
  manuales: number;
  /** Reserva sobre la suma de los tres anteriores. */
  imprevistos: number;
  total: number;
}

export interface Rentabilidad {
  ingresos: IngresosEvento;
  costos: CostosEvento;
  utilidad: number;
  /** null si no hay ingresos: un margen sobre 0 no significa nada. */
  margen: number | null;
  /** true si hay platos en el evento pero su costo derivado es 0. */
  costoAlimentosIncompleto: boolean;
  semaforo: "verde" | "amarillo" | "rojo" | "sin-datos";
}

/** Umbrales del briefing financiero que ya usa el cliente. */
export const UMBRAL_MARGEN_VERDE = 30;
export const UMBRAL_MARGEN_AMARILLO = 20;

export interface RequerimientoConSubtotal {
  subtotal: number;
}

export interface PlatoRequerido {
  plato_id: string;
  cantidad: number;
}

/**
 * Costo unitario por plato a partir de sus ingredientes.
 * Misma fórmula que usa el recetario para mostrar el costo derivado.
 */
export function construirCostoPorPlato(
  platoIngredientes: Array<{
    plato_id: string;
    cantidad: number;
    ingrediente?: { costo_por_unidad?: number } | null;
  }>
): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const pi of platoIngredientes) {
    const costo = pi.cantidad * (pi.ingrediente?.costo_por_unidad ?? 0);
    mapa.set(pi.plato_id, (mapa.get(pi.plato_id) ?? 0) + costo);
  }
  return mapa;
}

function sumarSubtotales(items: RequerimientoConSubtotal[]): number {
  return items.reduce((s, i) => s + (Number(i.subtotal) || 0), 0);
}

export function calcularRentabilidad(input: {
  platos: Array<PlatoRequerido & RequerimientoConSubtotal>;
  personal: RequerimientoConSubtotal[];
  menaje: RequerimientoConSubtotal[];
  transporte: RequerimientoConSubtotal[];
  costoPorPlato: Map<string, number>;
  pagosPersonal: Array<{ pago_calculado?: number | null }>;
  costosManuales: EventoCosto[];
  imprevistoPct: number;
}): Rentabilidad {
  const ingresos: IngresosEvento = {
    platos: sumarSubtotales(input.platos),
    personal: sumarSubtotales(input.personal),
    menaje: sumarSubtotales(input.menaje),
    transporte: sumarSubtotales(input.transporte),
    total: 0,
  };
  ingresos.total =
    ingresos.platos + ingresos.personal + ingresos.menaje + ingresos.transporte;

  const alimentos = input.platos.reduce((s, p) => {
    const unitario = input.costoPorPlato.get(p.plato_id) ?? 0;
    return s + unitario * (Number(p.cantidad) || 0);
  }, 0);

  const personal = input.pagosPersonal.reduce(
    (s, p) => s + (Number(p.pago_calculado) || 0),
    0
  );

  const manuales = input.costosManuales.reduce((s, c) => s + (Number(c.monto) || 0), 0);

  const subtotal = alimentos + personal + manuales;
  const pct = Math.min(Math.max(input.imprevistoPct || 0, 0), 100);
  const imprevistos = subtotal * (pct / 100);

  const costos: CostosEvento = {
    alimentos,
    personal,
    manuales,
    imprevistos,
    total: subtotal + imprevistos,
  };

  const utilidad = ingresos.total - costos.total;
  const margen = ingresos.total > 0 ? (utilidad / ingresos.total) * 100 : null;

  const costoAlimentosIncompleto = input.platos.length > 0 && alimentos === 0;

  let semaforo: Rentabilidad["semaforo"];
  if (margen === null || costos.total === 0) {
    semaforo = "sin-datos";
  } else if (margen >= UMBRAL_MARGEN_VERDE) {
    semaforo = "verde";
  } else if (margen >= UMBRAL_MARGEN_AMARILLO) {
    semaforo = "amarillo";
  } else {
    semaforo = "rojo";
  }

  return { ingresos, costos, utilidad, margen, costoAlimentosIncompleto, semaforo };
}
