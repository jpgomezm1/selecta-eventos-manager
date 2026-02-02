import type { ModalidadCobro } from "@/types/database";

/**
 * Mapeo de roles desde Excel al formato de la BD
 */
const MAPEO_ROLES: Record<string, string> = {
  'COCINA': 'Chef',
  'CONDUCTOR': 'Otro',
  'COORDINACION EN HORARIO NO LABORAL': 'Coordinador',
  'DECORACION': 'Decorador',
  'DECORADOR': 'Decorador',
  'DESMONTAJE': 'Otro',
  'MESERO': 'Mesero',
  'MONTAJE Y DESMONTAJE': 'Otro',
  'TRANSPORTES': 'Otro',
  'WEEDING PLANNER': 'Coordinador',
  // Agregar sinónimos y variaciones
  'CHEF': 'Chef',
  'COORDINADOR': 'Coordinador',
  'BARTENDER': 'Bartender',
  'TECNICO DE SONIDO': 'Técnico de Sonido',
  'FOTOGRAFO': 'Fotógrafo',
  'FOTÓGRAFO': 'Fotógrafo',
};

/**
 * Mapeo de modalidades desde Excel al formato de la BD
 */
const MAPEO_MODALIDADES: Record<string, ModalidadCobro> = {
  'HORA': 'por_hora',
  'POR HORA': 'por_hora',
  'JORNADA 10 HORAS': 'jornada_10h',
  'JORNADA 9 HORAS': 'jornada_9h',
  'JORNADA HASTA 10 HORAS': 'jornada_hasta_10h',
  'JORNADA NOCTURNA': 'jornada_nocturna',
  'POR EVENTO': 'por_evento',
  'EVENTO': 'por_evento',
};

/**
 * Normaliza un string: uppercase, trim, sin tildes, sin espacios múltiples
 */
export function normalizarTexto(texto: string): string {
  if (!texto) return '';
  return texto
    .toString()
    .trim() // Quita espacios al inicio y final
    .toUpperCase()
    .replace(/\s+/g, ' ') // Reemplaza múltiples espacios por uno solo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Quita tildes
}

/**
 * Mapea un rol del Excel al formato de la BD
 */
export function mapearRol(rolExcel: string): string | null {
  const rolNormalizado = normalizarTexto(rolExcel);
  const rolMapeado = MAPEO_ROLES[rolNormalizado];

  if (!rolMapeado) {
    console.warn(`Rol no reconocido: "${rolExcel}"`);
    return null;
  }

  return rolMapeado;
}

/**
 * Mapea una modalidad del Excel al formato de la BD
 */
export function mapearModalidad(modalidadExcel: string): ModalidadCobro | null {
  const modalidadNormalizada = normalizarTexto(modalidadExcel);
  const modalidadMapeada = MAPEO_MODALIDADES[modalidadNormalizada];

  if (!modalidadMapeada) {
    console.warn(`Modalidad no reconocida: "${modalidadExcel}"`);
    return null;
  }

  return modalidadMapeada;
}

/**
 * Limpia y convierte un valor monetario de Excel a número
 * Ejemplos: "$ 23.000", "$23.000", "23000" → 23000
 */
export function limpiarValorMonetario(valor: string | number): number {
  if (typeof valor === 'number') return valor;

  // Quitar símbolos de moneda, espacios, y puntos de miles
  const limpio = valor
    .toString()
    .replace(/\$/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '') // Quitar puntos de miles
    .replace(/,/g, '.') // Cambiar comas decimales por puntos
    .trim();

  const numero = parseFloat(limpio);

  if (isNaN(numero)) {
    console.warn(`Valor monetario inválido: "${valor}"`);
    return 0;
  }

  return numero;
}

/**
 * Valida un número de cédula
 */
export function validarCedula(cedula: string | number): boolean {
  const cedulaStr = cedula.toString().trim();

  // Debe tener entre 6 y 12 dígitos
  if (cedulaStr.length < 6 || cedulaStr.length > 12) return false;

  // Debe contener solo números
  if (!/^\d+$/.test(cedulaStr)) return false;

  return true;
}

/**
 * Valida un nombre completo
 */
export function validarNombre(nombre: string): boolean {
  const nombreTrim = nombre.toString().trim();

  // Debe tener al menos 3 caracteres
  if (nombreTrim.length < 3) return false;

  // Debe contener al menos un espacio (nombre y apellido)
  if (!nombreTrim.includes(' ')) return false;

  return true;
}

/**
 * Interface para resultado de validación
 */
export interface ResultadoValidacion {
  valido: boolean;
  errores: string[];
}

/**
 * Valida una fila completa del Excel
 */
export function validarFilaPersonal(fila: {
  nombre: string;
  cedula: string | number;
  rol: string;
  modalidad: string;
  tarifa: string | number;
}): ResultadoValidacion {
  const errores: string[] = [];

  // Validar nombre
  if (!validarNombre(fila.nombre)) {
    errores.push('Nombre inválido (debe tener nombre y apellido)');
  }

  // Validar cédula
  if (!validarCedula(fila.cedula)) {
    errores.push('Cédula inválida (debe tener entre 6 y 12 dígitos)');
  }

  // Validar rol
  const rolMapeado = mapearRol(fila.rol);
  if (!rolMapeado) {
    errores.push(`Rol no reconocido: "${fila.rol}"`);
  }

  // Validar modalidad
  const modalidadMapeada = mapearModalidad(fila.modalidad);
  if (!modalidadMapeada) {
    errores.push(`Modalidad no reconocida: "${fila.modalidad}"`);
  }

  // Validar tarifa
  const tarifaLimpia = limpiarValorMonetario(fila.tarifa);
  if (tarifaLimpia <= 0) {
    errores.push('Tarifa inválida (debe ser mayor a 0)');
  }

  return {
    valido: errores.length === 0,
    errores
  };
}

/**
 * Interface para datos procesados de personal
 */
export interface PersonalExcelProcesado {
  nombre_completo: string;
  numero_cedula: string;
  rol: string;
  modalidad_cobro: ModalidadCobro;
  tarifa: number;
  fila_excel: number; // Para referencia
  errores?: string[]; // Si hay errores de validación
}

/**
 * Procesa una fila del Excel y retorna el objeto listo para insertar
 */
export function procesarFilaExcel(
  fila: any,
  numeroFila: number
): PersonalExcelProcesado | null {
  try {
    // Extraer datos (ajustar índices según tu Excel)
    const nombre = fila.NOMBRE || fila.nombre || fila.Nombre || '';
    const cedula = fila.CEDULA || fila.cedula || fila.Cedula || '';
    const rol = fila.ROL || fila.rol || fila.Rol || '';
    // Aceptar tanto singular como plural, y con/sin espacios
    const modalidad = fila['PRESTA SERVICIO POR'] || fila['PRESTA SERVICIOS POR'] || fila.modalidad || '';
    const tarifa = fila.VALOR || fila.Valor || fila.valor || 0;

    // Validar
    const validacion = validarFilaPersonal({
      nombre,
      cedula,
      rol,
      modalidad,
      tarifa
    });

    // Si no es válido, retornar con errores
    if (!validacion.valido) {
      return {
        nombre_completo: nombre,
        numero_cedula: cedula.toString(),
        rol: rol,
        modalidad_cobro: 'por_hora', // Valor por defecto
        tarifa: 0,
        fila_excel: numeroFila,
        errores: validacion.errores
      };
    }

    // Mapear datos
    const rolMapeado = mapearRol(rol);
    const modalidadMapeada = mapearModalidad(modalidad);
    const tarifaLimpia = limpiarValorMonetario(tarifa);

    return {
      nombre_completo: nombre.trim(),
      numero_cedula: cedula.toString().trim(),
      rol: rolMapeado!,
      modalidad_cobro: modalidadMapeada!,
      tarifa: tarifaLimpia,
      fila_excel: numeroFila
    };
  } catch (error) {
    console.error(`Error procesando fila ${numeroFila}:`, error);
    return null;
  }
}