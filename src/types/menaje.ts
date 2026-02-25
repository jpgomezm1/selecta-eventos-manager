export type MenajeCatalogo = {
    id: string;
    created_at?: string;
    nombre: string;
    categoria: string;
    unidad: string;
    stock_total: number;
    precio_alquiler: number;
    activo: boolean;
  };
  
  export type MenajeDisponible = {
    id: string;
    nombre: string;
    categoria: string;
    unidad: string;
    stock_total: number;
    reservado: number;
    disponible: number;
  };
  
  export type MenajeReserva = {
    id: string;
    evento_id: string | null;
    fecha_inicio: string;
    fecha_fin: string;
    estado: "borrador" | "confirmado" | "devuelto" | "cancelado";
    notas?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  
  export type MenajeReservaItem = {
    id: string;
    reserva_id: string;
    menaje_id: string;
    cantidad: number;
  };
  
  export type MenajeReservaFull = MenajeReserva & {
    items: Array<MenajeReservaItem & { menaje?: MenajeCatalogo }>;
  };
  
  export type MenajeMovimiento = {
    id: string;
    evento_id: string | null;
    reserva_id: string | null;
    tipo: "salida" | "ingreso";
    fecha: string; // YYYY-MM-DD
    estado: "borrador" | "confirmado" | "cancelado";
    notas?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  
  export type MenajeMovimientoItem = {
    id: string;
    movimiento_id: string;
    menaje_id: string;
    cantidad: number;
    merma: number;
    nota?: string | null;
    menaje?: MenajeCatalogo;
  };
  
  export type MenajeReservaCal = {
    reserva_id: string;
    evento_id: string;
    nombre_evento: string;
    fecha_inicio: string;
    fecha_fin: string;
    estado: string;
    items: Array<{ menaje_id: string; cantidad: number }>;
  };

  export type OrdenMenajeItem = {
    menaje_id: string;
    nombre: string;
    unidad: string;
    cantidad_requerida: number;
    disponible: number;
    cantidad_reservar: number;
    precio_alquiler: number;
  };

  export type SalidaConEvento = {
    movimiento_id: string;
    evento_id: string;
    nombre_evento: string;
    fecha: string;
    reserva_id: string | null;
    items: Array<{ menaje_id: string; cantidad: number; nombre: string; unidad: string }>;
  };
  