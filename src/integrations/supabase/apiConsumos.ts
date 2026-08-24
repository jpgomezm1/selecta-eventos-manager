import { supabase } from "@/integrations/supabase/client";

/**
 * Consumos adicionales de un evento.
 *
 * Lo que se le COBRA de más al cliente durante el evento. No confundir con
 * `evento_costos` (apiRentabilidad), que es lo que Selecta le PAGA a
 * proveedores: mezclarlos rompe el margen en las dos direcciones.
 */

export interface CargoAdicional {
  id: string;
  evento_id: string;
  plato_id: string | null;
  concepto: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  /** Cuándo se consumió — editable, porque casi nunca se registra en el momento. */
  ocurrido_at: string;
  registrado_at: string;
  notas: string | null;
}

export interface CargoInput {
  evento_id: string;
  plato_id?: string | null;
  concepto: string;
  cantidad: number;
  precio_unitario: number;
  ocurrido_at?: string;
  notas?: string | null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function listCargosAdicionales(eventoId: string): Promise<CargoAdicional[]> {
  const { data, error } = await supabase
    .from("evento_cargos_adicionales")
    .select("*")
    .eq("evento_id", eventoId)
    .order("ocurrido_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((c) => ({
    ...(c as unknown as CargoAdicional),
    cantidad: num(c.cantidad),
    precio_unitario: num(c.precio_unitario),
    subtotal: num(c.subtotal),
  }));
}

export async function crearCargoAdicional(input: CargoInput): Promise<void> {
  // `subtotal` es columna generada en la base: no se manda desde acá para que
  // no pueda desviarse de cantidad × precio.
  const { error } = await supabase.from("evento_cargos_adicionales").insert(input);
  if (error) throw error;
}

export async function borrarCargoAdicional(id: string): Promise<void> {
  const { error } = await supabase.from("evento_cargos_adicionales").delete().eq("id", id);
  if (error) throw error;
}
