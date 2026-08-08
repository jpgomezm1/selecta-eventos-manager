import type { Cotizacion } from "@/types/cotizador";

/**
 * Analítica por comercial sobre las cotizaciones.
 *
 * Todo sale de campos que la app ya venía guardando (`comercial_encargado`,
 * `estado`, `fecha_envio`, `fecha_cierre`, `motivo_rechazo`) — no hay tracking
 * nuevo. Eso acota lo que se puede medir con honestidad: sabemos cuánto tarda
 * una cotización en salir y en cerrarse, no cuántas veces el comercial llamó
 * al cliente.
 */

/** Días sin enviar a partir de los cuales una cotización cuenta como desatendida. */
export const DIAS_ALERTA_SIN_ENVIAR = 7;

export interface MetricasComercial {
  comercial: string;
  total: number;
  pendientes: number;
  enviadas: number;
  ganadas: number;
  perdidas: number;
  valorCotizado: number;
  valorGanado: number;
  /** ganadas / (ganadas + perdidas) · null si no hay ninguna cerrada todavía. */
  winRate: number | null;
  /** Días promedio entre crear la cotización y enviarla. null si ninguna se envió. */
  diasPromedioEnvio: number | null;
  /** Días promedio entre enviar y cerrar (ganada o perdida). */
  diasPromedioCierre: number | null;
  /** Pendientes creadas hace más de DIAS_ALERTA_SIN_ENVIAR y aún sin enviar. */
  sinEnviarHace: number;
  /** Motivo de rechazo más frecuente, con su conteo. */
  motivoTop: { motivo: string; veces: number } | null;
}

const MS_DIA = 1000 * 60 * 60 * 24;

function diasEntre(desde?: string | null, hasta?: string | null): number | null {
  if (!desde || !hasta) return null;
  const a = new Date(desde).getTime();
  const b = new Date(hasta).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const dias = (b - a) / MS_DIA;
  // Fechas invertidas = data sucia (ej. fecha_envio anterior a created_at por
  // una carga manual). Preferimos descartar el dato a ensuciar el promedio.
  return dias < 0 ? null : dias;
}

function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

const SIN_ASIGNAR = "Sin asignar";

export function calcularMetricasComerciales(
  cotizaciones: Cotizacion[],
  ahora: Date = new Date()
): MetricasComercial[] {
  const porComercial = new Map<string, Cotizacion[]>();

  for (const c of cotizaciones) {
    const clave = c.comercial_encargado?.trim() || SIN_ASIGNAR;
    const lista = porComercial.get(clave);
    if (lista) lista.push(c);
    else porComercial.set(clave, [c]);
  }

  const metricas: MetricasComercial[] = [];

  for (const [comercial, items] of porComercial) {
    const pendientes = items.filter((c) => c.estado === "Pendiente por Aprobación");
    const enviadas = items.filter((c) => c.estado === "Enviada");
    const ganadas = items.filter((c) => c.estado === "Cotización Aprobada");
    const perdidas = items.filter((c) => c.estado === "Rechazada");

    const cerradas = ganadas.length + perdidas.length;

    const tiemposEnvio = items
      .map((c) => diasEntre(c.created_at, c.fecha_envio))
      .filter((d): d is number => d !== null);

    const tiemposCierre = items
      .map((c) => diasEntre(c.fecha_envio, c.fecha_cierre))
      .filter((d): d is number => d !== null);

    const sinEnviarHace = pendientes.filter((c) => {
      const dias = diasEntre(c.created_at, ahora.toISOString());
      return dias !== null && dias > DIAS_ALERTA_SIN_ENVIAR;
    }).length;

    const conteoMotivos = new Map<string, number>();
    for (const c of perdidas) {
      const motivo = c.motivo_rechazo?.trim();
      if (!motivo) continue;
      conteoMotivos.set(motivo, (conteoMotivos.get(motivo) ?? 0) + 1);
    }
    const motivoTop = [...conteoMotivos.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([motivo, veces]) => ({ motivo, veces }))[0] ?? null;

    metricas.push({
      comercial,
      total: items.length,
      pendientes: pendientes.length,
      enviadas: enviadas.length,
      ganadas: ganadas.length,
      perdidas: perdidas.length,
      valorCotizado: items.reduce((s, c) => s + (c.total_cotizado || 0), 0),
      valorGanado: ganadas.reduce((s, c) => s + (c.total_cotizado || 0), 0),
      winRate: cerradas > 0 ? (ganadas.length / cerradas) * 100 : null,
      diasPromedioEnvio: promedio(tiemposEnvio),
      diasPromedioCierre: promedio(tiemposCierre),
      sinEnviarHace,
      motivoTop,
    });
  }

  // Ordenamos por valor ganado: es la columna por la que un gerente comercial
  // mira primero una tabla como esta.
  return metricas.sort((a, b) => b.valorGanado - a.valorGanado);
}

/** Motivos de rechazo agregados de todo el equipo, de mayor a menor. */
export function calcularMotivosRechazo(
  cotizaciones: Cotizacion[]
): Array<{ motivo: string; veces: number; valorPerdido: number }> {
  const mapa = new Map<string, { veces: number; valorPerdido: number }>();

  for (const c of cotizaciones) {
    if (c.estado !== "Rechazada") continue;
    const motivo = c.motivo_rechazo?.trim() || "Sin motivo registrado";
    const actual = mapa.get(motivo) ?? { veces: 0, valorPerdido: 0 };
    actual.veces += 1;
    actual.valorPerdido += c.total_cotizado || 0;
    mapa.set(motivo, actual);
  }

  return [...mapa.entries()]
    .map(([motivo, v]) => ({ motivo, ...v }))
    .sort((a, b) => b.veces - a.veces);
}
