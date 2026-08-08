import { convertirAUnidadBase } from "@/integrations/supabase/apiCotizador";
import { normalizarTexto, limpiarValorMonetario } from "@/lib/mapeoExcelPersonal";
import type { IngredienteCatalogo } from "@/types/cotizador";

/**
 * Carga masiva de costos de insumos desde Excel.
 *
 * El archivo NO crea ingredientes: solo actualiza el costo de los que ya
 * existen en el recetario. Si el cliente quiere insumos nuevos los da de alta
 * en la pantalla de ingredientes — así evitamos que un typo en el Excel
 * ("Aceite Girasol" vs "Aceite de girasol") ensucie el catálogo con duplicados
 * que después rompen el costeo de los platos.
 *
 * Columnas esperadas (ver `COLUMNAS_PLANTILLA`):
 *   INGREDIENTE · PROVEEDOR · PRESENTACION · UNIDAD · PRECIO
 *
 * "PRESENTACION + UNIDAD + PRECIO" es cómo compra el cliente (bulto de 25 kg a
 * $80.000), no cómo consume la receta (gramos). La conversión a la unidad base
 * del ingrediente usa la misma función que el alta manual y el escáner de
 * facturas, para que las tres rutas no se desincronicen.
 */

export const COLUMNAS_PLANTILLA = [
  "INGREDIENTE",
  "PROVEEDOR",
  "PRESENTACION",
  "UNIDAD",
  "PRECIO",
] as const;

const PESO = new Set(["gr", "kg", "lb", "oz"]);
const VOLUMEN = new Set(["ml", "lt"]);
const UNIDADES_VALIDAS = new Set([...PESO, ...VOLUMEN, "und"]);

/** Alias frecuentes en los archivos del cliente → unidad canónica. */
const ALIAS_UNIDADES: Record<string, string> = {
  G: "gr",
  GR: "gr",
  GRS: "gr",
  GRAMO: "gr",
  GRAMOS: "gr",
  KG: "kg",
  KGS: "kg",
  KILO: "kg",
  KILOS: "kg",
  KILOGRAMO: "kg",
  KILOGRAMOS: "kg",
  LB: "lb",
  LBS: "lb",
  LIBRA: "lb",
  LIBRAS: "lb",
  OZ: "oz",
  ONZA: "oz",
  ONZAS: "oz",
  ML: "ml",
  MILILITRO: "ml",
  MILILITROS: "ml",
  L: "lt",
  LT: "lt",
  LTS: "lt",
  LITRO: "lt",
  LITROS: "lt",
  UND: "und",
  UN: "und",
  UNI: "und",
  UNID: "und",
  UNIDAD: "und",
  UNIDADES: "und",
};

export function normalizarUnidad(valor: string): string | null {
  const clave = normalizarTexto(valor).replace(/\./g, "");
  if (!clave) return null;
  const alias = ALIAS_UNIDADES[clave];
  if (alias) return alias;
  const directa = clave.toLowerCase();
  return UNIDADES_VALIDAS.has(directa) ? directa : null;
}

/**
 * Dos unidades son compatibles si ambas son peso, ambas volumen, o son la
 * misma. `und` solo es compatible consigo misma.
 */
export function sonUnidadesCompatibles(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return true;
  if (PESO.has(x) && PESO.has(y)) return true;
  if (VOLUMEN.has(x) && VOLUMEN.has(y)) return true;
  return false;
}

/**
 * Cantidades de presentación sí llevan decimales ("2,5 kg", "0,75 lt"), a
 * diferencia de los precios en COP. `limpiarValorMonetario` borra los puntos
 * asumiendo que son separador de miles, lo cual convertiría "2.5" en 25 — por
 * eso este parser aparte.
 *
 * Criterio: si hay coma, la coma es el decimal (formato colombiano). Si no hay
 * coma y hay un único punto con 1-2 decimales detrás, se interpreta como
 * decimal. Cualquier otro punto es separador de miles.
 */
export function parseCantidad(valor: string | number): number {
  if (typeof valor === "number") return valor;
  const texto = valor.toString().trim().replace(/\s/g, "");
  if (!texto) return 0;

  if (texto.includes(",")) {
    return limpiarValorMonetario(texto);
  }
  if (/^\d+\.\d{1,2}$/.test(texto)) {
    return parseFloat(texto);
  }
  return limpiarValorMonetario(texto);
}

export interface CostoExcelProcesado {
  fila_excel: number;
  /** Texto crudo del archivo, para poder mostrarle al usuario qué no matcheó. */
  nombre_excel: string;
  ingrediente_id: string | null;
  ingrediente_nombre: string | null;
  unidad_base: string | null;
  proveedor: string;
  presentacion_cantidad: number;
  presentacion_unidad: string;
  precio_presentacion: number;
  costo_por_unidad_base: number;
  /** Costo vigente en el catálogo antes de la carga (para mostrar el delta). */
  costo_anterior: number | null;
  errores: string[];
}

export type IndiceIngredientes = Map<string, IngredienteCatalogo>;

/**
 * Índice nombre normalizado → ingrediente. Si dos ingredientes normalizan al
 * mismo nombre (pasa: "Sal" y "SAL "), gana el primero y el segundo queda
 * inalcanzable por Excel — es preferible a actualizar el equivocado en
 * silencio, y el preview deja ver cuál quedó sin tocar.
 */
export function construirIndiceIngredientes(
  ingredientes: IngredienteCatalogo[]
): IndiceIngredientes {
  const indice: IndiceIngredientes = new Map();
  for (const ing of ingredientes) {
    const clave = normalizarTexto(ing.nombre);
    if (!indice.has(clave)) indice.set(clave, ing);
  }
  return indice;
}

function leerColumna(fila: Record<string, unknown>, nombres: string[]): string {
  for (const clave of Object.keys(fila)) {
    if (nombres.includes(normalizarTexto(clave))) {
      const valor = fila[clave];
      if (valor !== null && valor !== undefined && String(valor).trim() !== "") {
        return String(valor);
      }
    }
  }
  return "";
}

export function procesarFilaCosto(
  fila: Record<string, unknown>,
  numeroFila: number,
  indice: IndiceIngredientes
): CostoExcelProcesado {
  const nombreExcel = leerColumna(fila, ["INGREDIENTE", "INSUMO", "NOMBRE", "PRODUCTO"]);
  const proveedor = leerColumna(fila, ["PROVEEDOR", "PROVEEDORES"]);
  const presentacionRaw = leerColumna(fila, [
    "PRESENTACION",
    "CANTIDAD",
    "CANTIDAD PRESENTACION",
    "PRESENTACION CANTIDAD",
  ]);
  const unidadRaw = leerColumna(fila, [
    "UNIDAD",
    "UNIDAD PRESENTACION",
    "PRESENTACION UNIDAD",
    "UND",
  ]);
  const precioRaw = leerColumna(fila, [
    "PRECIO",
    "PRECIO PRESENTACION",
    "VALOR",
    "COSTO",
    "PRECIO UNITARIO",
  ]);

  const errores: string[] = [];

  const ingrediente = nombreExcel ? indice.get(normalizarTexto(nombreExcel)) ?? null : null;
  if (!nombreExcel) {
    errores.push("Falta el nombre del ingrediente");
  } else if (!ingrediente) {
    errores.push(`"${nombreExcel}" no existe en el recetario`);
  }

  if (!proveedor.trim()) {
    errores.push("Falta el proveedor");
  }

  const presentacionCantidad = parseCantidad(presentacionRaw);
  if (!presentacionRaw) {
    errores.push("Falta la presentación (cuánto trae la unidad de compra)");
  } else if (presentacionCantidad <= 0) {
    errores.push(`Presentación inválida: "${presentacionRaw}"`);
  }

  const unidad = normalizarUnidad(unidadRaw);
  if (!unidadRaw) {
    errores.push("Falta la unidad de la presentación");
  } else if (!unidad) {
    errores.push(`Unidad no reconocida: "${unidadRaw}"`);
  }

  const precio = limpiarValorMonetario(precioRaw);
  if (!precioRaw) {
    errores.push("Falta el precio");
  } else if (precio <= 0) {
    errores.push(`Precio inválido: "${precioRaw}"`);
  }

  // La compatibilidad solo se puede evaluar si tenemos ambos lados.
  if (ingrediente && unidad && !sonUnidadesCompatibles(unidad, ingrediente.unidad)) {
    errores.push(
      `No se puede convertir ${unidad} → ${ingrediente.unidad} (unidad base de "${ingrediente.nombre}")`
    );
  }

  let costoPorUnidadBase = 0;
  if (errores.length === 0 && ingrediente && unidad) {
    const cantidadEnUnidadBase = convertirAUnidadBase(
      presentacionCantidad,
      unidad,
      ingrediente.unidad
    );
    if (cantidadEnUnidadBase > 0) {
      costoPorUnidadBase = precio / cantidadEnUnidadBase;
    } else {
      errores.push("La conversión de unidades dio 0 — revisar presentación y unidad");
    }
  }

  return {
    fila_excel: numeroFila,
    nombre_excel: nombreExcel,
    ingrediente_id: ingrediente?.id ?? null,
    ingrediente_nombre: ingrediente?.nombre ?? null,
    unidad_base: ingrediente?.unidad ?? null,
    proveedor: proveedor.trim(),
    presentacion_cantidad: presentacionCantidad,
    presentacion_unidad: unidad ?? unidadRaw,
    precio_presentacion: precio,
    costo_por_unidad_base: costoPorUnidadBase,
    costo_anterior: ingrediente ? Number(ingrediente.costo_por_unidad) : null,
    errores,
  };
}

/**
 * Marca como error las filas repetidas (mismo ingrediente + proveedor). La
 * primera gana; si no, el orden de escritura decidiría en silencio cuál costo
 * queda y el usuario vería un número que no puso.
 */
export function marcarDuplicados(filas: CostoExcelProcesado[]): void {
  const vistas = new Map<string, number>();
  for (const f of filas) {
    if (f.errores.length > 0 || !f.ingrediente_id) continue;
    const clave = `${f.ingrediente_id}|${normalizarTexto(f.proveedor)}`;
    const previa = vistas.get(clave);
    if (previa === undefined) {
      vistas.set(clave, f.fila_excel);
    } else {
      f.errores.push(`Fila repetida (mismo ingrediente y proveedor que la fila ${previa})`);
    }
  }
}
