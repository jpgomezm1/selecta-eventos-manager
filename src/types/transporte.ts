export type TransporteOrden = {
    id: string;
    evento_id: string;
    estado: "borrador" | "programado" | "finalizado" | "cancelado";
    pickup_nombre: string | null;
    pickup_direccion: string | null;
    descripcion_carga: string | null;
    destino_direccion: string | null;
    hora_descarga: string | null;   // "HH:MM:SS"
    hora_recogida: string | null;   // "HH:MM:SS"
    contacto_nombre: string | null;
    contacto_telefono: string | null;
    vehiculo: string | null;
    notas: string | null;
    created_at?: string;
    updated_at?: string;
  };
  