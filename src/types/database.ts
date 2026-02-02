export type ModalidadCobro =
  | 'por_hora'              // Cobro por hora trabajada
  | 'jornada_9h'            // Jornada fija de 9 horas
  | 'jornada_10h'           // Jornada fija de 10 horas
  | 'jornada_hasta_10h'     // Jornada hasta 10 horas (si excede, cobra extra)
  | 'jornada_nocturna'      // Jornada nocturna
  | 'por_evento';           // Cobro fijo por evento completo

export interface Personal {
  id: string;
  nombre_completo: string;
  numero_cedula: string;
  rol: 'Coordinador' | 'Mesero' | 'Chef' | 'Bartender' | 'Decorador' | 'Técnico de Sonido' | 'Fotógrafo' | 'Otro';
  tarifa: number; // Cambiado de tarifa_hora a tarifa (puede ser por hora, jornada o evento)
  modalidad_cobro: ModalidadCobro;
  tarifa_hora_extra?: number; // Para jornada_hasta_10h cuando se excede el límite
  created_at: string;
  updated_at: string;
}

export interface Evento {
  id: string;
  nombre_evento: string;
  ubicacion: string;
  fecha_evento: string;
  descripcion?: string;
  estado_liquidacion?: 'pendiente' | 'liquidado';
  fecha_liquidacion?: string;
  created_at: string;
  updated_at: string;
}

export interface EventoPersonal {
  id: string;
  evento_id: string;
  personal_id: string;
  hora_inicio?: string;
  hora_fin?: string;
  horas_trabajadas?: number;
  pago_calculado?: number;
  estado_pago: 'pendiente' | 'pagado';
  fecha_pago?: string;
  metodo_pago?: 'efectivo' | 'transferencia' | 'nomina' | 'otro';
  notas_pago?: string;
  created_at: string;
}

export interface PersonalAsignado extends Personal {
  hora_inicio?: string;
  hora_fin?: string;
  horas_trabajadas?: number;
  pago_calculado?: number;
  estado_pago?: 'pendiente' | 'pagado';
  fecha_pago?: string;
  metodo_pago?: 'efectivo' | 'transferencia' | 'nomina' | 'otro';
  notas_pago?: string;
  evento_personal_id?: string;
}

export interface EventoConPersonal extends Evento {
  personal: PersonalAsignado[];
  costo_total?: number;
}

export interface PersonalFormData {
  nombre_completo: string;
  numero_cedula: string;
  rol: Personal['rol'];
  tarifa: number;
  modalidad_cobro: ModalidadCobro;
  tarifa_hora_extra?: number;
}

export interface EventoFormData {
  nombre_evento: string;
  ubicacion: string;
  fecha_evento: string;
  descripcion?: string;
}

export interface RegistroPago {
  id: string;
  empleado_id: string;
  fecha_pago: string;
  tipo_liquidacion: 'evento' | 'multiple';
  monto_total: number;
  metodo_pago: string;
  notas?: string;
  usuario_liquidador?: string;
  numero_comprobante: string;
  created_at: string;
}

export interface RegistroPagoEvento {
  id: string;
  registro_pago_id: string;
  evento_id: string;
  horas_trabajadas: number;
  monto_evento: number;
  created_at: string;
}

export interface RegistroPagoConEventos extends RegistroPago {
  eventos: (RegistroPagoEvento & {
    evento: Evento;
  })[];
}

export const ROLES_PERSONAL = [
  'Coordinador',
  'Mesero',
  'Chef',
  'Bartender',
  'Decorador',
  'Técnico de Sonido',
  'Fotógrafo',
  'Otro'
] as const;

export const MODALIDADES_COBRO: { value: ModalidadCobro; label: string; descripcion: string }[] = [
  { value: 'por_hora', label: 'Por Hora', descripcion: 'Cobro por cada hora trabajada' },
  { value: 'jornada_9h', label: 'Jornada 9 Horas', descripcion: 'Tarifa fija por jornada de 9 horas' },
  { value: 'jornada_10h', label: 'Jornada 10 Horas', descripcion: 'Tarifa fija por jornada de 10 horas' },
  { value: 'jornada_hasta_10h', label: 'Jornada hasta 10 Horas', descripcion: 'Tarifa fija hasta 10h, luego cobra horas extras' },
  { value: 'jornada_nocturna', label: 'Jornada Nocturna', descripcion: 'Tarifa fija para eventos nocturnos' },
  { value: 'por_evento', label: 'Por Evento', descripcion: 'Tarifa fija por evento completo' }
];