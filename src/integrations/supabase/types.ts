export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      cliente_contactos: {
        Row: {
          cargo: string | null
          cliente_id: string
          correo: string | null
          created_at: string | null
          es_principal: boolean | null
          id: string
          nombre: string
          telefono: string | null
        }
        Insert: {
          cargo?: string | null
          cliente_id: string
          correo?: string | null
          created_at?: string | null
          es_principal?: boolean | null
          id?: string
          nombre: string
          telefono?: string | null
        }
        Update: {
          cargo?: string | null
          cliente_id?: string
          correo?: string | null
          created_at?: string | null
          es_principal?: boolean | null
          id?: string
          nombre?: string
          telefono?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_contactos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          cedula: string | null
          correo: string | null
          created_at: string | null
          empresa: string | null
          id: string
          nit: string | null
          nombre: string
          notas: string | null
          telefono: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          cedula?: string | null
          correo?: string | null
          created_at?: string | null
          empresa?: string | null
          id?: string
          nit?: string | null
          nombre: string
          notas?: string | null
          telefono?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          cedula?: string | null
          correo?: string | null
          created_at?: string | null
          empresa?: string | null
          id?: string
          nit?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cotizacion_lugares: {
        Row: {
          capacidad_estimada: number | null
          ciudad: string | null
          cotizacion_id: string
          direccion: string | null
          es_seleccionado: boolean
          id: string
          nombre: string
          notas: string | null
          orden: number
          precio_referencia: number | null
        }
        Insert: {
          capacidad_estimada?: number | null
          ciudad?: string | null
          cotizacion_id: string
          direccion?: string | null
          es_seleccionado?: boolean
          id?: string
          nombre: string
          notas?: string | null
          orden?: number
          precio_referencia?: number | null
        }
        Update: {
          capacidad_estimada?: number | null
          ciudad?: string | null
          cotizacion_id?: string
          direccion?: string | null
          es_seleccionado?: boolean
          id?: string
          nombre?: string
          notas?: string | null
          orden?: number
          precio_referencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_lugares_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_menaje_items: {
        Row: {
          cantidad: number
          cotizacion_id: string
          cotizacion_version_id: string
          id: string
          menaje_id: string
          precio_alquiler: number
          subtotal: number
        }
        Insert: {
          cantidad?: number
          cotizacion_id: string
          cotizacion_version_id: string
          id?: string
          menaje_id: string
          precio_alquiler?: number
          subtotal?: number
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          cotizacion_version_id?: string
          id?: string
          menaje_id?: string
          precio_alquiler?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_menaje_items_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_menaje_items_cotizacion_version_id_fkey"
            columns: ["cotizacion_version_id"]
            isOneToOne: false
            referencedRelation: "cotizacion_versiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_menaje_items_menaje_id_fkey"
            columns: ["menaje_id"]
            isOneToOne: false
            referencedRelation: "menaje_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_personal_asignaciones: {
        Row: {
          cotizacion_version_id: string
          created_at: string
          id: string
          personal_costo_id: string
          personal_id: string
        }
        Insert: {
          cotizacion_version_id: string
          created_at?: string
          id?: string
          personal_costo_id: string
          personal_id: string
        }
        Update: {
          cotizacion_version_id?: string
          created_at?: string
          id?: string
          personal_costo_id?: string
          personal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_personal_asignaciones_personal_id_fkey"
            columns: ["personal_id"]
            isOneToOne: false
            referencedRelation: "personal"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_personal_items: {
        Row: {
          cantidad: number
          cotizacion_id: string
          cotizacion_version_id: string | null
          id: string
          personal_costo_id: string
          subtotal: number
          tarifa_estimada_por_persona: number
        }
        Insert: {
          cantidad: number
          cotizacion_id: string
          cotizacion_version_id?: string | null
          id?: string
          personal_costo_id: string
          subtotal: number
          tarifa_estimada_por_persona: number
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          cotizacion_version_id?: string | null
          id?: string
          personal_costo_id?: string
          subtotal?: number
          tarifa_estimada_por_persona?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_personal_items_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_personal_items_cotizacion_version_id_fkey"
            columns: ["cotizacion_version_id"]
            isOneToOne: false
            referencedRelation: "cotizacion_versiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_personal_items_personal_costo_id_fkey"
            columns: ["personal_costo_id"]
            isOneToOne: false
            referencedRelation: "personal_costos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_platos: {
        Row: {
          cantidad: number
          cotizacion_id: string
          cotizacion_version_id: string | null
          id: string
          plato_id: string
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          cotizacion_id: string
          cotizacion_version_id?: string | null
          id?: string
          plato_id: string
          precio_unitario: number
          subtotal: number
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          cotizacion_version_id?: string | null
          id?: string
          plato_id?: string
          precio_unitario?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_platos_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_platos_cotizacion_version_id_fkey"
            columns: ["cotizacion_version_id"]
            isOneToOne: false
            referencedRelation: "cotizacion_versiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_platos_plato_id_fkey"
            columns: ["plato_id"]
            isOneToOne: false
            referencedRelation: "platos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_share_tokens: {
        Row: {
          cotizacion_id: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          token: string
        }
        Insert: {
          cotizacion_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          token?: string
        }
        Update: {
          cotizacion_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_share_tokens_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_transporte_items: {
        Row: {
          cantidad: number
          cotizacion_id: string
          cotizacion_version_id: string | null
          id: string
          subtotal: number
          tarifa_unitaria: number
          transporte_id: string
        }
        Insert: {
          cantidad: number
          cotizacion_id: string
          cotizacion_version_id?: string | null
          id?: string
          subtotal: number
          tarifa_unitaria: number
          transporte_id: string
        }
        Update: {
          cantidad?: number
          cotizacion_id?: string
          cotizacion_version_id?: string | null
          id?: string
          subtotal?: number
          tarifa_unitaria?: number
          transporte_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_transporte_items_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_transporte_items_cotizacion_version_id_fkey"
            columns: ["cotizacion_version_id"]
            isOneToOne: false
            referencedRelation: "cotizacion_versiones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_transporte_items_transporte_id_fkey"
            columns: ["transporte_id"]
            isOneToOne: false
            referencedRelation: "transporte_tarifas"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_versiones: {
        Row: {
          cotizacion_id: string
          created_at: string
          estado: string
          id: string
          is_definitiva: boolean
          nombre_opcion: string
          total: number
          updated_at: string
          version_index: number
        }
        Insert: {
          cotizacion_id: string
          created_at?: string
          estado?: string
          id?: string
          is_definitiva?: boolean
          nombre_opcion: string
          total?: number
          updated_at?: string
          version_index: number
        }
        Update: {
          cotizacion_id?: string
          created_at?: string
          estado?: string
          id?: string
          is_definitiva?: boolean
          nombre_opcion?: string
          total?: number
          updated_at?: string
          version_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_versiones_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          cliente_id: string | null
          cliente_nombre: string | null
          comercial_encargado: string
          contacto_correo: string | null
          contacto_id: string | null
          contacto_telefono: string | null
          created_at: string | null
          estado: string
          fecha_cierre: string | null
          fecha_envio: string | null
          fecha_evento_estimada: string | null
          hora_fin: string | null
          hora_inicio: string | null
          hora_montaje_fin: string | null
          hora_montaje_inicio: string | null
          id: string
          motivo_rechazo: string | null
          nombre_cotizacion: string
          notas_rechazo: string | null
          numero_invitados: number
          total_cotizado: number
          ubicacion_evento: string | null
          updated_at: string | null
        }
        Insert: {
          cliente_id?: string | null
          cliente_nombre?: string | null
          comercial_encargado?: string
          contacto_correo?: string | null
          contacto_id?: string | null
          contacto_telefono?: string | null
          created_at?: string | null
          estado?: string
          fecha_cierre?: string | null
          fecha_envio?: string | null
          fecha_evento_estimada?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          hora_montaje_fin?: string | null
          hora_montaje_inicio?: string | null
          id?: string
          motivo_rechazo?: string | null
          nombre_cotizacion: string
          notas_rechazo?: string | null
          numero_invitados: number
          total_cotizado?: number
          ubicacion_evento?: string | null
          updated_at?: string | null
        }
        Update: {
          cliente_id?: string | null
          cliente_nombre?: string | null
          comercial_encargado?: string
          contacto_correo?: string | null
          contacto_id?: string | null
          contacto_telefono?: string | null
          created_at?: string | null
          estado?: string
          fecha_cierre?: string | null
          fecha_envio?: string | null
          fecha_evento_estimada?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          hora_montaje_fin?: string | null
          hora_montaje_inicio?: string | null
          id?: string
          motivo_rechazo?: string | null
          nombre_cotizacion?: string
          notas_rechazo?: string | null
          numero_invitados?: number
          total_cotizado?: number
          ubicacion_evento?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_contacto_id_fkey"
            columns: ["contacto_id"]
            isOneToOne: false
            referencedRelation: "cliente_contactos"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_calls: {
        Row: {
          called_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          called_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          called_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      evento_orden_compra: {
        Row: {
          created_at: string | null
          estado: string
          evento_id: string
          id: string
          notas: string | null
          total_estimado: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: string
          evento_id: string
          id?: string
          notas?: string | null
          total_estimado?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: string
          evento_id?: string
          id?: string
          notas?: string | null
          total_estimado?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_orden_compra_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_orden_compra_items: {
        Row: {
          cantidad_comprar: number
          cantidad_inventario: number
          cantidad_necesaria: number
          costo_unitario: number
          id: string
          ingrediente_id: string | null
          nombre: string
          orden_id: string
          subtotal: number
          unidad: string
        }
        Insert: {
          cantidad_comprar?: number
          cantidad_inventario?: number
          cantidad_necesaria?: number
          costo_unitario?: number
          id?: string
          ingrediente_id?: string | null
          nombre: string
          orden_id: string
          subtotal?: number
          unidad: string
        }
        Update: {
          cantidad_comprar?: number
          cantidad_inventario?: number
          cantidad_necesaria?: number
          costo_unitario?: number
          id?: string
          ingrediente_id?: string | null
          nombre?: string
          orden_id?: string
          subtotal?: number
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_orden_compra_items_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_orden_compra_items_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "evento_orden_compra"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_personal: {
        Row: {
          created_at: string | null
          estado_pago: string | null
          evento_id: string | null
          fecha_pago: string | null
          hora_fin: string | null
          hora_inicio: string | null
          horas_trabajadas: number | null
          id: string
          metodo_pago: string | null
          notas_pago: string | null
          pago_calculado: number | null
          personal_id: string | null
        }
        Insert: {
          created_at?: string | null
          estado_pago?: string | null
          evento_id?: string | null
          fecha_pago?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          horas_trabajadas?: number | null
          id?: string
          metodo_pago?: string | null
          notas_pago?: string | null
          pago_calculado?: number | null
          personal_id?: string | null
        }
        Update: {
          created_at?: string | null
          estado_pago?: string | null
          evento_id?: string | null
          fecha_pago?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          horas_trabajadas?: number | null
          id?: string
          metodo_pago?: string | null
          notas_pago?: string | null
          pago_calculado?: number | null
          personal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_personal_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_personal_personal_id_fkey"
            columns: ["personal_id"]
            isOneToOne: false
            referencedRelation: "personal"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_requerimiento_menaje: {
        Row: {
          cantidad: number
          evento_id: string
          id: string
          menaje_id: string | null
          nombre: string
          precio_alquiler: number
          subtotal: number
        }
        Insert: {
          cantidad?: number
          evento_id: string
          id?: string
          menaje_id?: string | null
          nombre?: string
          precio_alquiler?: number
          subtotal?: number
        }
        Update: {
          cantidad?: number
          evento_id?: string
          id?: string
          menaje_id?: string | null
          nombre?: string
          precio_alquiler?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "evento_requerimiento_menaje_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_requerimiento_menaje_menaje_id_fkey"
            columns: ["menaje_id"]
            isOneToOne: false
            referencedRelation: "menaje_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_requerimiento_personal: {
        Row: {
          cantidad: number
          created_at: string | null
          evento_id: string
          id: string
          personal_costo_id: string
          rol: string | null
          subtotal: number
          tarifa_estimada_por_persona: number
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          evento_id: string
          id?: string
          personal_costo_id: string
          rol?: string | null
          subtotal: number
          tarifa_estimada_por_persona: number
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          evento_id?: string
          id?: string
          personal_costo_id?: string
          rol?: string | null
          subtotal?: number
          tarifa_estimada_por_persona?: number
        }
        Relationships: [
          {
            foreignKeyName: "evento_requerimiento_personal_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_requerimiento_personal_personal_costo_id_fkey"
            columns: ["personal_costo_id"]
            isOneToOne: false
            referencedRelation: "personal_costos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_requerimiento_platos: {
        Row: {
          cantidad: number
          created_at: string | null
          evento_id: string
          id: string
          nombre: string | null
          plato_id: string
          precio_unitario: number
          subtotal: number
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          evento_id: string
          id?: string
          nombre?: string | null
          plato_id: string
          precio_unitario: number
          subtotal: number
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          evento_id?: string
          id?: string
          nombre?: string | null
          plato_id?: string
          precio_unitario?: number
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "evento_requerimiento_platos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_requerimiento_platos_plato_id_fkey"
            columns: ["plato_id"]
            isOneToOne: false
            referencedRelation: "platos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_requerimiento_transporte: {
        Row: {
          cantidad: number
          created_at: string | null
          evento_id: string
          id: string
          lugar: string | null
          subtotal: number
          tarifa_unitaria: number
          transporte_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          evento_id: string
          id?: string
          lugar?: string | null
          subtotal: number
          tarifa_unitaria: number
          transporte_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          evento_id?: string
          id?: string
          lugar?: string | null
          subtotal?: number
          tarifa_unitaria?: number
          transporte_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_requerimiento_transporte_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_requerimiento_transporte_transporte_id_fkey"
            columns: ["transporte_id"]
            isOneToOne: false
            referencedRelation: "transporte_tarifas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          cotizacion_version_id: string | null
          created_at: string | null
          descripcion: string | null
          estado_liquidacion: string | null
          fecha_evento: string
          fecha_liquidacion: string | null
          id: string
          nombre_evento: string
          ubicacion: string
          updated_at: string | null
        }
        Insert: {
          cotizacion_version_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          estado_liquidacion?: string | null
          fecha_evento: string
          fecha_liquidacion?: string | null
          id?: string
          nombre_evento: string
          ubicacion: string
          updated_at?: string | null
        }
        Update: {
          cotizacion_version_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          estado_liquidacion?: string | null
          fecha_evento?: string
          fecha_liquidacion?: string | null
          id?: string
          nombre_evento?: string
          ubicacion?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_cotizacion_version_id_fkey"
            columns: ["cotizacion_version_id"]
            isOneToOne: false
            referencedRelation: "cotizacion_versiones"
            referencedColumns: ["id"]
          },
        ]
      }
      ingrediente_proveedores: {
        Row: {
          costo_por_unidad_base: number
          created_at: string | null
          es_principal: boolean | null
          id: string
          ingrediente_id: string
          precio_presentacion: number
          presentacion_cantidad: number
          presentacion_unidad: string
          proveedor: string
        }
        Insert: {
          costo_por_unidad_base: number
          created_at?: string | null
          es_principal?: boolean | null
          id?: string
          ingrediente_id: string
          precio_presentacion: number
          presentacion_cantidad: number
          presentacion_unidad: string
          proveedor: string
        }
        Update: {
          costo_por_unidad_base?: number
          created_at?: string | null
          es_principal?: boolean | null
          id?: string
          ingrediente_id?: string
          precio_presentacion?: number
          presentacion_cantidad?: number
          presentacion_unidad?: string
          proveedor?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingrediente_proveedores_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredientes_catalogo: {
        Row: {
          costo_por_unidad: number
          created_at: string | null
          id: string
          nombre: string
          proveedor: string | null
          stock_actual: number
          unidad: string
        }
        Insert: {
          costo_por_unidad?: number
          created_at?: string | null
          id?: string
          nombre: string
          proveedor?: string | null
          stock_actual?: number
          unidad: string
        }
        Update: {
          costo_por_unidad?: number
          created_at?: string | null
          id?: string
          nombre?: string
          proveedor?: string | null
          stock_actual?: number
          unidad?: string
        }
        Relationships: []
      }
      inventario_mov_items: {
        Row: {
          cantidad: number
          costo_unitario: number | null
          id: string
          ingrediente_id: string
          movimiento_id: string
        }
        Insert: {
          cantidad: number
          costo_unitario?: number | null
          id?: string
          ingrediente_id: string
          movimiento_id: string
        }
        Update: {
          cantidad?: number
          costo_unitario?: number | null
          id?: string
          ingrediente_id?: string
          movimiento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_mov_items_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_mov_items_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "inventario_movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      inventario_movimientos: {
        Row: {
          created_at: string
          estado: string
          evento_id: string | null
          factura_url: string | null
          fecha: string
          id: string
          notas: string | null
          proveedor: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          estado?: string
          evento_id?: string | null
          factura_url?: string | null
          fecha?: string
          id?: string
          notas?: string | null
          proveedor?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          estado?: string
          evento_id?: string | null
          factura_url?: string | null
          fecha?: string
          id?: string
          notas?: string | null
          proveedor?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_movimientos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      lugares_catalogo: {
        Row: {
          activo: boolean | null
          capacidad_estimada: number | null
          ciudad: string | null
          created_at: string | null
          direccion: string | null
          id: string
          nombre: string
          notas: string | null
          precio_referencia: number | null
        }
        Insert: {
          activo?: boolean | null
          capacidad_estimada?: number | null
          ciudad?: string | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          nombre: string
          notas?: string | null
          precio_referencia?: number | null
        }
        Update: {
          activo?: boolean | null
          capacidad_estimada?: number | null
          ciudad?: string | null
          created_at?: string | null
          direccion?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          precio_referencia?: number | null
        }
        Relationships: []
      }
      menaje_catalogo: {
        Row: {
          activo: boolean
          categoria: string
          created_at: string | null
          id: string
          nombre: string
          precio_alquiler: number
          stock_total: number
          unidad: string
        }
        Insert: {
          activo?: boolean
          categoria: string
          created_at?: string | null
          id?: string
          nombre: string
          precio_alquiler?: number
          stock_total: number
          unidad: string
        }
        Update: {
          activo?: boolean
          categoria?: string
          created_at?: string | null
          id?: string
          nombre?: string
          precio_alquiler?: number
          stock_total?: number
          unidad?: string
        }
        Relationships: []
      }
      menaje_mov_items: {
        Row: {
          cantidad: number
          id: string
          menaje_id: string
          merma: number
          movimiento_id: string
          nota: string | null
        }
        Insert: {
          cantidad: number
          id?: string
          menaje_id: string
          merma?: number
          movimiento_id: string
          nota?: string | null
        }
        Update: {
          cantidad?: number
          id?: string
          menaje_id?: string
          merma?: number
          movimiento_id?: string
          nota?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menaje_mov_items_menaje_id_fkey"
            columns: ["menaje_id"]
            isOneToOne: false
            referencedRelation: "menaje_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menaje_mov_items_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "menaje_movimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      menaje_movimientos: {
        Row: {
          created_at: string | null
          estado: string
          evento_id: string | null
          fecha: string
          id: string
          notas: string | null
          reserva_id: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: string
          evento_id?: string | null
          fecha: string
          id?: string
          notas?: string | null
          reserva_id?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: string
          evento_id?: string | null
          fecha?: string
          id?: string
          notas?: string | null
          reserva_id?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menaje_movimientos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menaje_movimientos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "menaje_reservas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menaje_movimientos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "v_menaje_reservas_cal"
            referencedColumns: ["reserva_id"]
          },
        ]
      }
      menaje_reserva_items: {
        Row: {
          cantidad: number
          id: string
          menaje_id: string
          reserva_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          menaje_id: string
          reserva_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          menaje_id?: string
          reserva_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menaje_reserva_items_menaje_id_fkey"
            columns: ["menaje_id"]
            isOneToOne: false
            referencedRelation: "menaje_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menaje_reserva_items_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "menaje_reservas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menaje_reserva_items_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "v_menaje_reservas_cal"
            referencedColumns: ["reserva_id"]
          },
        ]
      }
      menaje_reservas: {
        Row: {
          created_at: string | null
          estado: string
          evento_id: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          notas: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estado?: string
          evento_id: string
          fecha_fin: string
          fecha_inicio: string
          id?: string
          notas?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estado?: string
          evento_id?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          notas?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menaje_reservas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      personal: {
        Row: {
          created_at: string | null
          id: string
          modalidad_cobro: string
          nombre_completo: string
          numero_cedula: string
          rol: string
          tarifa: number
          tarifa_hora_extra: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          modalidad_cobro?: string
          nombre_completo: string
          numero_cedula: string
          rol: string
          tarifa: number
          tarifa_hora_extra?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          modalidad_cobro?: string
          nombre_completo?: string
          numero_cedula?: string
          rol?: string
          tarifa?: number
          tarifa_hora_extra?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      personal_costos_catalogo: {
        Row: {
          created_at: string | null
          id: string
          modalidad_cobro: string
          rol: string
          tarifa: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          modalidad_cobro?: string
          rol: string
          tarifa: number
        }
        Update: {
          created_at?: string | null
          id?: string
          modalidad_cobro?: string
          rol?: string
          tarifa?: number
        }
        Relationships: []
      }
      plato_ingredientes: {
        Row: {
          cantidad: number
          created_at: string | null
          id: string
          ingrediente_id: string
          plato_id: string
        }
        Insert: {
          cantidad: number
          created_at?: string | null
          id?: string
          ingrediente_id: string
          plato_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          id?: string
          ingrediente_id?: string
          plato_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plato_ingredientes_ingrediente_id_fkey"
            columns: ["ingrediente_id"]
            isOneToOne: false
            referencedRelation: "ingredientes_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plato_ingredientes_plato_id_fkey"
            columns: ["plato_id"]
            isOneToOne: false
            referencedRelation: "platos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      platos_catalogo: {
        Row: {
          categoria: string | null
          created_at: string | null
          id: string
          margen_ganancia: number | null
          nombre: string
          notas: string | null
          porciones_receta: number | null
          precio: number
          rendimiento: string | null
          temperatura_coccion: string | null
          tiempo_preparacion: string | null
          tipo_menu: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          id?: string
          margen_ganancia?: number | null
          nombre: string
          notas?: string | null
          porciones_receta?: number | null
          precio: number
          rendimiento?: string | null
          temperatura_coccion?: string | null
          tiempo_preparacion?: string | null
          tipo_menu: string
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          id?: string
          margen_ganancia?: number | null
          nombre?: string
          notas?: string | null
          porciones_receta?: number | null
          precio?: number
          rendimiento?: string | null
          temperatura_coccion?: string | null
          tiempo_preparacion?: string | null
          tipo_menu?: string
        }
        Relationships: []
      }
      registro_pago_eventos: {
        Row: {
          created_at: string
          evento_id: string
          horas_trabajadas: number
          id: string
          monto_evento: number
          registro_pago_id: string
        }
        Insert: {
          created_at?: string
          evento_id: string
          horas_trabajadas: number
          id?: string
          monto_evento: number
          registro_pago_id: string
        }
        Update: {
          created_at?: string
          evento_id?: string
          horas_trabajadas?: number
          id?: string
          monto_evento?: number
          registro_pago_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registro_pago_eventos_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registro_pago_eventos_registro_pago_id_fkey"
            columns: ["registro_pago_id"]
            isOneToOne: false
            referencedRelation: "registro_pagos"
            referencedColumns: ["id"]
          },
        ]
      }
      registro_pagos: {
        Row: {
          created_at: string
          empleado_id: string
          fecha_pago: string
          id: string
          metodo_pago: string
          monto_total: number
          notas: string | null
          numero_comprobante: string
          tipo_liquidacion: string
          usuario_liquidador: string | null
        }
        Insert: {
          created_at?: string
          empleado_id: string
          fecha_pago: string
          id?: string
          metodo_pago: string
          monto_total: number
          notas?: string | null
          numero_comprobante: string
          tipo_liquidacion: string
          usuario_liquidador?: string | null
        }
        Update: {
          created_at?: string
          empleado_id?: string
          fecha_pago?: string
          id?: string
          metodo_pago?: string
          monto_total?: number
          notas?: string | null
          numero_comprobante?: string
          tipo_liquidacion?: string
          usuario_liquidador?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registro_pagos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "personal"
            referencedColumns: ["id"]
          },
        ]
      }
      transporte_ordenes: {
        Row: {
          contacto_nombre: string | null
          contacto_telefono: string | null
          created_at: string | null
          descripcion_carga: string | null
          destino_direccion: string | null
          estado: string
          evento_id: string
          hora_recepcion_fin: string | null
          hora_recepcion_inicio: string | null
          hora_recogida_fin: string | null
          hora_recogida_inicio: string | null
          id: string
          notas: string | null
          pickup_direccion: string | null
          pickup_nombre: string | null
          updated_at: string | null
          vehiculo: string | null
        }
        Insert: {
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string | null
          descripcion_carga?: string | null
          destino_direccion?: string | null
          estado?: string
          evento_id: string
          hora_recepcion_fin?: string | null
          hora_recepcion_inicio?: string | null
          hora_recogida_fin?: string | null
          hora_recogida_inicio?: string | null
          id?: string
          notas?: string | null
          pickup_direccion?: string | null
          pickup_nombre?: string | null
          updated_at?: string | null
          vehiculo?: string | null
        }
        Update: {
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string | null
          descripcion_carga?: string | null
          destino_direccion?: string | null
          estado?: string
          evento_id?: string
          hora_recepcion_fin?: string | null
          hora_recepcion_inicio?: string | null
          hora_recogida_fin?: string | null
          hora_recogida_inicio?: string | null
          id?: string
          notas?: string | null
          pickup_direccion?: string | null
          pickup_nombre?: string | null
          updated_at?: string | null
          vehiculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transporte_ordenes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      transporte_tarifas: {
        Row: {
          created_at: string | null
          id: string
          lugar: string
          tarifa: number
          tipo_evento: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lugar: string
          tarifa: number
          tipo_evento: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lugar?: string
          tarifa?: number
          tipo_evento?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_menaje_reservas_cal: {
        Row: {
          estado: string | null
          evento_id: string | null
          fecha_fin: string | null
          fecha_inicio: string | null
          items: Json | null
          nombre_evento: string | null
          reserva_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menaje_reservas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cotizacion_has_active_share: {
        Args: { cot_id: string }
        Returns: boolean
      }
      create_cotizacion_with_versions: {
        Args: { p_payload: Json }
        Returns: string
      }
      despachar_menaje_desde_reserva: {
        Args: { p_evento_id: string; p_items: Json; p_reserva_id: string }
        Returns: string
      }
      ensure_event_from_version: {
        Args: {
          p_cotizacion_id: string
          p_cotizacion_version_id: string
          p_descripcion?: string
          p_fecha_evento: string
          p_nombre_evento: string
          p_ubicacion: string
        }
        Returns: string
      }
      fn_inventario_movimiento_confirmar: {
        Args: { p_movimiento_id: string }
        Returns: {
          created_at: string
          estado: string
          evento_id: string | null
          factura_url: string | null
          fecha: string
          id: string
          notas: string | null
          proveedor: string | null
          tipo: string
        }
        SetofOptions: {
          from: "*"
          to: "inventario_movimientos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_inventario_movimiento_delete_con_reversa: {
        Args: { p_movimiento_id: string }
        Returns: undefined
      }
      fn_menaje_disponible: {
        Args: { _fin: string; _inicio: string }
        Returns: {
          categoria: string
          disponible: number
          id: string
          nombre: string
          reservado: number
          stock_total: number
          unidad: string
        }[]
      }
      generate_comprobante_number: { Args: never; Returns: string }
      registrar_compra_en_inventario: {
        Args: { p_evento_id: string; p_orden_id: string }
        Returns: string
      }
      registrar_devolucion_menaje: {
        Args: { p_evento_id: string; p_items: Json; p_reserva_id: string }
        Returns: string
      }
      set_version_definitiva: {
        Args: { p_cotizacion_id: string; p_version_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
