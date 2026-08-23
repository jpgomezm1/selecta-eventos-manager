/**
 * Cartera: facturas de venta, abonos y reporte de edades.
 *
 * Los tramos se miden sobre la EDAD de la factura y no sobre los días de mora —
 * es como los mide el cliente en su planilla. Ver el comentario de
 * `fn_cartera_tramo` en la migración `20260823001000_cartera.sql`.
 */

export type Tramo = "corriente" | "31-60" | "61-90" | "91-120" | "121-150" | ">150";

/** Orden de presentación. El de la base viene sin orden garantizado. */
export const TRAMOS: Tramo[] = ["corriente", "31-60", "61-90", "91-120", "121-150", ">150"];

export const TRAMO_LABEL: Record<Tramo, string> = {
  corriente: "Corriente",
  "31-60": "31–60 días",
  "61-90": "61–90 días",
  "91-120": "91–120 días",
  "121-150": "121–150 días",
  ">150": "Más de 150 días",
};

export type EstadoRiesgo = "SANO" | "VIGILANCIA" | "CRITICO";

export const RIESGO_LABEL: Record<EstadoRiesgo, string> = {
  SANO: "Sano",
  VIGILANCIA: "Vigilancia",
  CRITICO: "Crítico",
};

export interface EmpresaEmisora {
  id: string;
  nombre: string;
  nit: string | null;
  activo: boolean;
}

export interface FacturaCartera {
  id: string;
  empresa_emisora_id: string;
  emisora: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_documento: string | null;
  evento_id: string | null;
  numero: string;
  fecha_emision: string;
  dias_credito: number;
  fecha_vencimiento: string;
  valor_total: number;
  abonado: number;
  saldo: number;
  edad_dias: number;
  dias_mora: number;
  tramo: Tramo;
  anulada: boolean;
  notas: string | null;
}

export interface Abono {
  id: string;
  factura_id: string;
  fecha: string;
  monto: number;
  metodo: string | null;
  referencia: string | null;
  soporte_url: string | null;
  notas: string | null;
  created_at: string;
}

export interface TotalesCartera {
  cartera_total: number;
  corriente: number;
  vencida: number;
  critica: number;
  facturas: number;
  clientes: number;
  clientes_criticos: number;
  pct_corriente: number;
  pct_vencida: number;
  pct_critica: number;
}

export interface FilaPorCliente {
  cliente_id: string;
  nombre: string;
  documento: string | null;
  emisora: string;
  total: number;
  corriente: number;
  t31_60: number;
  t61_90: number;
  t_mas_90: number;
  vencido: number;
  critico: number;
  pct_vencido: number;
  estado_riesgo: EstadoRiesgo;
}

export interface ResumenCartera {
  fecha_corte: string;
  totales: TotalesCartera;
  composicion: Array<{ tramo: Tramo; valor: number }>;
  por_cliente: FilaPorCliente[];
}

/** Fila del Excel del cliente, ya validada y lista para importar. */
export interface FilaImportacion {
  cliente: string;
  documento: string;
  numero: string;
  fecha: string;
  saldo: number;
  errores: string[];
}
