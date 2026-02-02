export interface IngredienteCatalogo {
    id: string;
    nombre: string;
    unidad: string;
    costo_por_unidad: number;
    proveedor: string | null;
    stock_actual?: number;
    created_at?: string | null;
  }

  export interface InventarioMovimiento {
    id: string;
    created_at: string;
    tipo: 'compra' | 'uso' | 'ajuste' | 'devolucion';
    fecha: string;
    estado: 'borrador' | 'confirmado' | 'cancelado';
    evento_id: string | null;
    proveedor: string | null;
    notas: string | null;
  }

  export interface InventarioMovItem {
    id: string;
    movimiento_id: string;
    ingrediente_id: string;
    cantidad: number;
    costo_unitario: number;
    ingrediente?: IngredienteCatalogo;
  }

  export interface PlatoIngrediente {
    id: string;
    plato_id: string;
    ingrediente_id: string;
    cantidad: number;
    ingrediente?: IngredienteCatalogo; // joined
  }

  export interface PlatoCatalogo {
    id: string;
    nombre: string;
    precio: number;
    categoria: string | null;
    tipo_menu: "Menu General" | "Armalo a tu Gusto";
    created_at?: string | null;
    porciones_receta?: number | null;
    tiempo_preparacion?: string | null;
    temperatura_coccion?: string | null;
    rendimiento?: string | null;
    notas?: string | null;
    margen_ganancia?: number | null;
    ingredientes?: PlatoIngrediente[];
  }
  
  export interface IngredienteProveedor {
    id: string;
    ingrediente_id: string;
    proveedor: string;
    presentacion_cantidad: number;
    presentacion_unidad: string;
    precio_presentacion: number;
    costo_por_unidad_base: number;
    es_principal: boolean;
    created_at?: string | null;
  }

  export interface TransporteTarifa {
    id: string;
    lugar: string;
    tarifa: number;
    tipo_evento: "Eventos Grandes" | "Eventos Pequeños" | "Selecta To Go" | "Eventos Noche";
    created_at?: string | null;
  }
  
  export type ModalidadCobroCotizador =
    | "por_hora"
    | "jornada_9h"
    | "jornada_10h"
    | "jornada_hasta_10h"
    | "jornada_nocturna"
    | "por_evento";

  export interface PersonalCosto {
    id: string;
    rol:
      | "Coordinador"
      | "Mesero"
      | "Chef"
      | "Bartender"
      | "Decorador"
      | "Técnico de Sonido"
      | "Fotógrafo"
      | "Otro";
    tarifa: number;
    modalidad_cobro: ModalidadCobroCotizador;
    created_at?: string | null;
  }
  
  export type EstadoCotizacion = "Pendiente por Aprobación" | "Enviada" | "Cotización Aprobada" | "Rechazada";
  
  export interface Cotizacion {
    id: string;
    nombre_cotizacion: string;
    cliente_nombre: string | null;
    numero_invitados: number;
    fecha_evento_estimada: string | null; // ISO
    ubicacion_evento?: string | null;
    comercial_encargado: string;
    total_cotizado: number;
    estado: EstadoCotizacion;
    created_at?: string | null;
    updated_at?: string | null;
  }
  
  /** Nueva: versión/opción */
  export interface CotizacionVersion {
    id: string;
    cotizacion_id: string;
    nombre_opcion: string; // "Opción A"
    version_index: number; // 1,2,3...
    total: number;
    estado: EstadoCotizacion;
    is_definitiva: boolean;
    created_at?: string | null;
    updated_at?: string | null;
  }
  
  /** Items en estado local (UI) - por versión */
  export interface CotizacionPlatoLocal {
    plato_id: string;
    nombre: string;
    precio_unitario: number;
    cantidad: number;
  }
  
  export interface CotizacionTransporteLocal {
    transporte_id: string;
    lugar: string;
    tarifa_unitaria: number;
    cantidad: number;
  }
  
  export interface PersonalAsignacion {
    personal_id: string;
    nombre_completo: string;
  }

  export interface CotizacionPersonalLocal {
    personal_costo_id: string;
    rol: string;
    tarifa_estimada_por_persona: number;
    cantidad: number;
    asignados?: PersonalAsignacion[];
  }
  
  export interface CotizacionMenajeLocal {
    menaje_id: string;
    nombre: string;
    precio_alquiler: number;
    cantidad: number;
  }

  export interface CotizacionItemsState {
    platos: CotizacionPlatoLocal[];
    transportes: CotizacionTransporteLocal[];
    personal: CotizacionPersonalLocal[];
    menaje: CotizacionMenajeLocal[];
  }
  
  export interface CotizacionInsert {
    nombre_cotizacion: string;
    cliente_nombre: string | null;
    numero_invitados: number;
    fecha_evento_estimada: Date | null;
    ubicacion_evento?: string | null;
    comercial_encargado: string;
    total_cotizado: number;
    estado: EstadoCotizacion;
  }
  
  /** Nueva: crear cotización con N versiones */
  export interface CotizacionVersionInsert {
    nombre_opcion: string;
    version_index: number;
    total: number;
    estado: EstadoCotizacion;
    is_definitiva?: boolean;
    items: CotizacionItemsState;
  }
  
  export interface CotizacionWithVersionsDraft {
    cotizacion: CotizacionInsert;
    versiones: CotizacionVersionInsert[]; // al menos 1
  }
  
  /** Para UI del editor con opciones */
  export interface CotizacionEditorState {
    meta: {
      nombre_cotizacion: string;
      cliente_nombre: string | null;
      numero_invitados: number;
      fecha_evento_estimada: string | null;
      ubicacion_evento?: string | null;
      comercial_encargado: string;
    };
    versiones: Array<{
      id?: string; // vacío si aún no existe en DB
      nombre_opcion: string;
      version_index: number;
      items: CotizacionItemsState;
      totales: { platos: number; personal: number; transportes: number; total: number };
      is_definitiva?: boolean;
    }>;
  }

  export interface Evento {
    id: string;
    nombre_evento: string;
    ubicacion: string;
    fecha_evento: string; // ISO
    descripcion: string | null;
    estado_liquidacion: "pendiente" | "liquidado";
    cotizacion_version_id: string | null;
    comercial_encargado?: string | null; // Heredado de la cotización
    created_at?: string | null;
    updated_at?: string | null;
  }
  
  export interface EventoRequerimiento {
    platos: Array<{ plato_id: string; nombre: string; precio_unitario: number; cantidad: number; subtotal: number }>;
    transportes: Array<{ transporte_id: string; lugar: string; tarifa_unitaria: number; cantidad: number; subtotal: number }>;
    personal: Array<{ personal_costo_id: string; rol: string; tarifa_estimada_por_persona: number; cantidad: number; subtotal: number }>;
    menaje: Array<{ menaje_id: string; nombre: string; precio_alquiler: number; cantidad: number; subtotal: number }>;
  }

  /** Orden de compra */
  export interface OrdenCompra {
    id: string;
    evento_id: string;
    estado: 'borrador' | 'aprobada' | 'comprada' | 'cancelada';
    total_estimado: number;
    notas: string | null;
    created_at?: string;
    updated_at?: string;
  }

  export interface OrdenCompraItem {
    id: string;
    orden_id: string;
    ingrediente_id: string | null;
    nombre: string;
    unidad: string;
    cantidad_necesaria: number;
    cantidad_inventario: number;
    cantidad_comprar: number;
    costo_unitario: number;
    subtotal: number;
  }
  
  