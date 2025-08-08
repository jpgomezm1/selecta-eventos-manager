export interface PlatoCatalogo {
    id: string;
    nombre: string;
    precio: number;
    categoria: string | null;
    tipo_menu: "Menu General" | "Armalo a tu Gusto";
    created_at?: string | null;
  }
  
  export interface TransporteTarifa {
    id: string;
    lugar: string;
    tarifa: number;
    tipo_evento: "Eventos Grandes" | "Eventos Pequeños" | "Selecta To Go" | "Eventos Noche";
    created_at?: string | null;
  }
  
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
    created_at?: string | null;
  }
  
  export type EstadoCotizacion = "Borrador" | "Enviada" | "Aceptada" | "Rechazada";
  
  export interface Cotizacion {
    id: string;
    nombre_cotizacion: string;
    cliente_nombre: string | null;
    numero_invitados: number;
    fecha_evento_estimada: string | null; // ISO
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
  
  export interface CotizacionPersonalLocal {
    personal_costo_id: string;
    rol: string;
    tarifa_estimada_por_persona: number;
    cantidad: number;
  }
  
  export interface CotizacionItemsState {
    platos: CotizacionPlatoLocal[];
    transportes: CotizacionTransporteLocal[];
    personal: CotizacionPersonalLocal[];
  }
  
  export interface CotizacionInsert {
    nombre_cotizacion: string;
    cliente_nombre: string | null;
    numero_invitados: number;
    fecha_evento_estimada: Date | null;
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
  