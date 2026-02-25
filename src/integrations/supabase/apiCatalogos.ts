import { supabase } from "@/integrations/supabase/client";
import type { TransporteTarifa, PersonalCosto, LugarCatalogo } from "@/types/cotizador";

/* =========================
 *   TRANSPORTE TARIFAS
 * ========================= */
export async function transporteTarifasList(): Promise<TransporteTarifa[]> {
  const { data, error } = await supabase
    .from("transporte_tarifas")
    .select("*")
    .order("tipo_evento")
    .order("lugar");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ ...d, tarifa: Number(d.tarifa) }));
}

export async function transporteTarifasCreate(
  payload: Omit<TransporteTarifa, "id" | "created_at">
) {
  const { data, error } = await supabase
    .from("transporte_tarifas")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, tarifa: Number(data.tarifa) } as TransporteTarifa;
}

export async function transporteTarifasUpdate(id: string, patch: Partial<TransporteTarifa>) {
  const { data, error } = await supabase
    .from("transporte_tarifas")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, tarifa: Number(data.tarifa) } as TransporteTarifa;
}

export async function transporteTarifasDelete(id: string) {
  const { error } = await supabase.from("transporte_tarifas").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

/* =========================
 *   PERSONAL COSTOS
 * ========================= */
export async function personalCostosList(): Promise<PersonalCosto[]> {
  const { data, error } = await supabase
    .from("personal_costos_catalogo")
    .select("*")
    .order("rol")
    .order("modalidad_cobro");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ ...d, tarifa: Number(d.tarifa) || 0 }));
}

export async function personalCostosCreate(
  payload: Omit<PersonalCosto, "id" | "created_at">
) {
  const { data, error } = await supabase
    .from("personal_costos_catalogo")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, tarifa: Number(data.tarifa) } as PersonalCosto;
}

export async function personalCostosUpdate(id: string, patch: Partial<PersonalCosto>) {
  const { data, error } = await supabase
    .from("personal_costos_catalogo")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, tarifa: Number(data.tarifa) } as PersonalCosto;
}

export async function personalCostosDelete(id: string) {
  const { error } = await supabase.from("personal_costos_catalogo").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}

/* =========================
 *   LUGARES CATÁLOGO
 * ========================= */
export async function lugaresCatalogoList(): Promise<LugarCatalogo[]> {
  const { data, error } = await supabase
    .from("lugares_catalogo")
    .select("*")
    .order("ciudad")
    .order("nombre");
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    ...d,
    capacidad_estimada: d.capacidad_estimada ? Number(d.capacidad_estimada) : null,
    precio_referencia: Number(d.precio_referencia ?? 0),
  }));
}

export async function lugaresCatalogoCreate(
  payload: Omit<LugarCatalogo, "id" | "created_at">
) {
  const { data, error } = await supabase
    .from("lugares_catalogo")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return {
    ...data,
    capacidad_estimada: data.capacidad_estimada ? Number(data.capacidad_estimada) : null,
    precio_referencia: Number(data.precio_referencia ?? 0),
  } as LugarCatalogo;
}

export async function lugaresCatalogoUpdate(id: string, patch: Partial<LugarCatalogo>) {
  const { data, error } = await supabase
    .from("lugares_catalogo")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return {
    ...data,
    capacidad_estimada: data.capacidad_estimada ? Number(data.capacidad_estimada) : null,
    precio_referencia: Number(data.precio_referencia ?? 0),
  } as LugarCatalogo;
}

export async function lugaresCatalogoDelete(id: string) {
  const { error } = await supabase.from("lugares_catalogo").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
}
