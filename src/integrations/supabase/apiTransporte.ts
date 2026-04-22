import { supabase } from "@/integrations/supabase/client";
import type { TransporteOrden } from "@/types/transporte";

/** Trae la orden de transporte del evento o la crea en borrador */
export async function getOrCreateTransporteOrden(evento_id: string): Promise<TransporteOrden> {
  const { data: ex, error: e1 } = await supabase
    .from("transporte_ordenes")
    .select("*")
    .eq("evento_id", evento_id)
    .maybeSingle();
  if (e1 && (e1 as { code?: string }).code !== "PGRST116") throw e1;
  if (ex) return ex as TransporteOrden;

  // leer datos del evento para prefill destino
  const { data: ev, error: e2 } = await supabase
    .from("eventos")
    .select("ubicacion")
    .eq("id", evento_id)
    .single();
  if (e2) throw e2;

  const { data, error } = await supabase
    .from("transporte_ordenes")
    .insert({
      evento_id,
      estado: "borrador",
      destino_direccion: (ev as { ubicacion?: string | null } | null)?.ubicacion ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as TransporteOrden;
}

/** Guardar (upsert) */
export async function saveTransporteOrden(orden: Partial<TransporteOrden> & { evento_id: string }) {
  if (orden.id) {
    const { data, error } = await supabase
      .from("transporte_ordenes")
      .update(orden)
      .eq("id", orden.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as TransporteOrden;
  } else {
    const { data, error } = await supabase
      .from("transporte_ordenes")
      .insert(orden)
      .select("*")
      .single();
    if (error) throw error;
    return data as TransporteOrden;
  }
}

/** Cambiar estado */
export async function setTransporteOrdenEstado(id: string, estado: TransporteOrden["estado"]) {
  const { data, error } = await supabase
    .from("transporte_ordenes")
    .update({ estado })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as TransporteOrden;
}

/** Listar TODAS las órdenes de transporte con datos del evento */
export async function listAllTransporteOrdenes(): Promise<
  (TransporteOrden & { nombre_evento: string; fecha_evento: string })[]
> {
  const { data, error } = await supabase
    .from("transporte_ordenes")
    .select("*, eventos:evento_id(nombre_evento, fecha_evento)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map((row) => {
    const { eventos, ...orden } = row;
    return {
      ...orden,
      nombre_evento: eventos?.nombre_evento ?? "Sin evento",
      fecha_evento: eventos?.fecha_evento ?? "",
    } as TransporteOrden & { nombre_evento: string; fecha_evento: string };
  });
}
