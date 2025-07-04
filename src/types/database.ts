export interface Personal {
  id: string;
  nombre_completo: string;
  numero_cedula: string;
  rol: 'Coordinador' | 'Mesero' | 'Chef' | 'Bartender' | 'Decorador' | 'Técnico de Sonido' | 'Fotógrafo' | 'Otro';
  tarifa_hora: number;
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
  created_at: string;
}

export interface PersonalAsignado extends Personal {
  hora_inicio?: string;
  hora_fin?: string;
  horas_trabajadas?: number;
  pago_calculado?: number;
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
  tarifa_hora: number;
}

export interface EventoFormData {
  nombre_evento: string;
  ubicacion: string;
  fecha_evento: string;
  descripcion?: string;
  personal_ids: string[];
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