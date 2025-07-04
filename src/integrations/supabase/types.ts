export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
      eventos: {
        Row: {
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
        Relationships: []
      }
      personal: {
        Row: {
          created_at: string | null
          id: string
          nombre_completo: string
          numero_cedula: string
          rol: string
          tarifa_hora: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre_completo: string
          numero_cedula: string
          rol: string
          tarifa_hora: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre_completo?: string
          numero_cedula?: string
          rol?: string
          tarifa_hora?: number
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
