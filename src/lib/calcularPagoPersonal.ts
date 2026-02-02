import type { ModalidadCobro } from "@/types/database";

/**
 * Calcula el pago de personal según su modalidad de cobro
 *
 * @param modalidad_cobro - Tipo de modalidad de cobro
 * @param tarifa - Tarifa base (por hora, por jornada, o por evento)
 * @param horas_trabajadas - Horas realmente trabajadas (opcional según modalidad)
 * @param tarifa_hora_extra - Tarifa por hora extra (solo para jornada_hasta_10h)
 * @returns Monto total a pagar
 */
export function calcularPagoPersonal(
  modalidad_cobro: ModalidadCobro,
  tarifa: number,
  horas_trabajadas?: number,
  tarifa_hora_extra?: number
): number {
  switch (modalidad_cobro) {
    case 'por_hora':
      // Cobro por hora: tarifa * horas trabajadas
      return tarifa * (horas_trabajadas || 0);

    case 'jornada_9h':
      // Jornada fija de 9 horas: siempre cobra la tarifa completa
      return tarifa;

    case 'jornada_10h':
      // Jornada fija de 10 horas: siempre cobra la tarifa completa
      return tarifa;

    case 'jornada_hasta_10h':
      // Jornada hasta 10 horas con horas extras
      if (!horas_trabajadas) return tarifa;

      if (horas_trabajadas <= 10) {
        // Si trabajó 10h o menos, cobra la tarifa fija
        return tarifa;
      } else {
        // Si trabajó más de 10h, cobra tarifa + horas extras
        const horasExtras = horas_trabajadas - 10;
        const pagoExtra = horasExtras * (tarifa_hora_extra || 0);
        return tarifa + pagoExtra;
      }

    case 'jornada_nocturna':
      // Jornada nocturna: tarifa fija independiente de horas
      return tarifa;

    case 'por_evento':
      // Por evento: tarifa fija sin importar horas
      return tarifa;

    default:
      return 0;
  }
}

/**
 * Obtiene un label descriptivo de la modalidad de cobro
 */
export function getModalidadCobroLabel(modalidad: ModalidadCobro): string {
  const labels: Record<ModalidadCobro, string> = {
    por_hora: 'Por Hora',
    jornada_9h: 'Jornada 9h',
    jornada_10h: 'Jornada 10h',
    jornada_hasta_10h: 'Jornada hasta 10h',
    jornada_nocturna: 'Jornada Nocturna',
    por_evento: 'Por Evento'
  };
  return labels[modalidad] || modalidad;
}

/**
 * Obtiene una descripción de la modalidad de cobro
 */
export function getModalidadCobroDescripcion(modalidad: ModalidadCobro): string {
  const descripciones: Record<ModalidadCobro, string> = {
    por_hora: 'Cobra por cada hora trabajada',
    jornada_9h: 'Tarifa fija por jornada de 9 horas',
    jornada_10h: 'Tarifa fija por jornada de 10 horas',
    jornada_hasta_10h: 'Tarifa fija hasta 10h, luego cobra horas extras',
    jornada_nocturna: 'Tarifa fija para eventos nocturnos',
    por_evento: 'Tarifa fija por evento completo'
  };
  return descripciones[modalidad] || '';
}

/**
 * Determina si la modalidad requiere registro de horas
 */
export function requiereRegistroHoras(modalidad: ModalidadCobro): boolean {
  return modalidad === 'por_hora' || modalidad === 'jornada_hasta_10h';
}

/**
 * Obtiene el texto de ayuda para la tarifa según modalidad
 */
export function getTarifaHelpText(modalidad: ModalidadCobro): string {
  const helpTexts: Record<ModalidadCobro, string> = {
    por_hora: 'Ingrese el valor por hora trabajada',
    jornada_9h: 'Ingrese el valor total de la jornada de 9 horas',
    jornada_10h: 'Ingrese el valor total de la jornada de 10 horas',
    jornada_hasta_10h: 'Ingrese el valor de la jornada hasta 10 horas',
    jornada_nocturna: 'Ingrese el valor de la jornada nocturna',
    por_evento: 'Ingrese el valor fijo por evento'
  };
  return helpTexts[modalidad] || '';
}