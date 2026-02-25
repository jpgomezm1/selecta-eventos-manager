export type TransporteOrden = {
    id: string;
    evento_id: string;
    estado: "borrador" | "programado" | "finalizado" | "cancelado";
    pickup_nombre: string | null;
    pickup_direccion: string | null;
    descripcion_carga: string | null;
    destino_direccion: string | null;
    hora_recepcion_inicio: string | null;  // "HH:MM:SS"
    hora_recepcion_fin: string | null;     // "HH:MM:SS"
    hora_recogida_inicio: string | null;   // "HH:MM:SS"
    hora_recogida_fin: string | null;      // "HH:MM:SS"
    contacto_nombre: string | null;
    contacto_telefono: string | null;
    vehiculo: string | null;
    notas: string | null;
    created_at?: string;
    updated_at?: string;
  };

