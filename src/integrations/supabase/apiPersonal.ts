import { supabase } from "@/integrations/supabase/client";
import type { Personal, PersonalAsignado, EventoConPersonal } from "@/types/database";

/**
 * Listado de eventos con su personal asignado y datos de la cotización origen.
 * Reemplaza el query con joins que vivía inline en `pages/Eventos.tsx`.
 */
export async function listEventosConPersonal(): Promise<EventoConPersonal[]> {
  const { data, error } = await supabase
    .from("eventos")
    .select(`
      *,
      evento_personal (
        id,
        hora_inicio,
        hora_fin,
        horas_trabajadas,
        pago_calculado,
        estado_pago,
        fecha_pago,
        metodo_pago,
        notas_pago,
        personal (*)
      ),
      cotizacion_versiones (
        cotizaciones (
          ubicacion_evento,
          comercial_encargado,
          total_cotizado
        )
      )
    `)
    .order("fecha_evento", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((evento) => {
    const personalAsignado: PersonalAsignado[] = (evento.evento_personal?.map((ep) => ({
      ...ep.personal,
      hora_inicio: ep.hora_inicio,
      hora_fin: ep.hora_fin,
      horas_trabajadas: ep.horas_trabajadas,
      pago_calculado: ep.pago_calculado,
      estado_pago: ep.estado_pago ?? "pendiente",
      fecha_pago: ep.fecha_pago,
      metodo_pago: ep.metodo_pago,
      notas_pago: ep.notas_pago,
      evento_personal_id: ep.id,
    })) || []) as PersonalAsignado[];

    const cotizacionInfo = evento.cotizacion_versiones?.cotizaciones;
    const ubicacionEvento = cotizacionInfo?.ubicacion_evento || evento.ubicacion;
    const comercialEncargado = cotizacionInfo?.comercial_encargado;
    // Total cotizado al cliente — el "tamaño" del evento. Lo operativo
    // (costo a Selecta del personal asignado) vive en el detalle, no acá.
    const totalCotizado = Number(cotizacionInfo?.total_cotizado ?? 0);

    return {
      ...evento,
      ubicacion: ubicacionEvento,
      comercial_encargado: comercialEncargado,
      estado_liquidacion: (evento.estado_liquidacion as "pendiente" | "liquidado") || "pendiente",
      personal: personalAsignado,
      costo_total: totalCotizado,
    } as EventoConPersonal;
  });
}

/**
 * Catálogo completo de personal (empleados) — ordenado por nombre.
 */
export async function listPersonal(): Promise<Personal[]> {
  const { data, error } = await supabase
    .from("personal")
    .select("*")
    .order("nombre_completo");
  if (error) throw error;
  return (data ?? []) as Personal[];
}

/**
 * Personal asignado a un evento — incluye los datos del empleado (join con
 * `personal`) y los campos de `evento_personal` necesarios para la grilla.
 */
export async function listEventoPersonal(eventoId: string): Promise<PersonalAsignado[]> {
  const { data, error } = await supabase
    .from("evento_personal")
    .select(`
      id,
      hora_inicio,
      hora_fin,
      horas_trabajadas,
      pago_calculado,
      estado_pago,
      fecha_pago,
      metodo_pago,
      notas_pago,
      personal (*)
    `)
    .eq("evento_id", eventoId);
  if (error) throw error;

  return (data ?? []).map((ep) => ({
    ...ep.personal,
    hora_inicio: ep.hora_inicio,
    hora_fin: ep.hora_fin,
    horas_trabajadas: ep.horas_trabajadas,
    pago_calculado: ep.pago_calculado,
    estado_pago: ep.estado_pago,
    fecha_pago: ep.fecha_pago,
    metodo_pago: ep.metodo_pago,
    notas_pago: ep.notas_pago,
    evento_personal_id: ep.id,
  })) as PersonalAsignado[];
}

export interface EventoPersonalInsert {
  evento_id: string;
  personal_id: string;
  estado_pago?: "pendiente" | "pagado";
  pago_calculado?: number | null;
}

export async function addEventoPersonal(input: EventoPersonalInsert): Promise<void> {
  const { error } = await supabase.from("evento_personal").insert(input);
  if (error) throw error;
}

export interface EventoPersonalUpdate {
  hora_inicio?: string | null;
  hora_fin?: string | null;
  horas_trabajadas?: number | null;
  pago_calculado?: number | null;
  estado_pago?: "pendiente" | "pagado";
  fecha_pago?: string | null;
  metodo_pago?: string | null;
  notas_pago?: string | null;
}

export async function updateEventoPersonal(
  eventoPersonalId: string,
  patch: EventoPersonalUpdate
): Promise<void> {
  const { error } = await supabase
    .from("evento_personal")
    .update(patch)
    .eq("id", eventoPersonalId);
  if (error) throw error;
}

export async function removeEventoPersonal(eventoPersonalId: string): Promise<void> {
  const { error } = await supabase
    .from("evento_personal")
    .delete()
    .eq("id", eventoPersonalId);
  if (error) throw error;
}
