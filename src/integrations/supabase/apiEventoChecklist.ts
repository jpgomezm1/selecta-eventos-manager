import { supabase } from "@/integrations/supabase/client";
import type { ChecklistData } from "@/lib/eventoChecklist";

export async function fetchChecklistData(eventoId: string): Promise<ChecklistData> {
  const [
    { count: personalAsignadoCount },
    { data: reqPersonal },
    { data: ordenCompra },
    { data: menajeReserva },
    { data: transporteOrden },
    { data: evento },
    { data: movUso },
    { data: movSalida },
  ] = await Promise.all([
    supabase
      .from("evento_personal")
      .select("*", { count: "exact", head: true })
      .eq("evento_id", eventoId),
    supabase
      .from("evento_requerimiento_personal")
      .select("cantidad")
      .eq("evento_id", eventoId),
    supabase
      .from("evento_orden_compra")
      .select("estado")
      .eq("evento_id", eventoId)
      .neq("estado", "cancelada")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("menaje_reservas")
      .select("estado")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transporte_ordenes")
      .select("estado")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("eventos")
      .select("fecha_evento, estado_liquidacion")
      .eq("id", eventoId)
      .single(),
    supabase
      .from("inventario_movimientos")
      .select("id")
      .eq("evento_id", eventoId)
      .eq("tipo", "uso")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("menaje_movimientos")
      .select("id")
      .eq("evento_id", eventoId)
      .eq("tipo", "salida")
      .limit(1)
      .maybeSingle(),
  ]);

  const personalRequeridoCount = (reqPersonal ?? []).reduce(
    (acc: number, r: any) => acc + (r.cantidad ?? 0),
    0
  );

  return {
    personalAsignadoCount: personalAsignadoCount ?? 0,
    personalRequeridoCount,
    ordenCompra: ordenCompra as { estado: string } | null,
    menajeReserva: menajeReserva as { estado: string } | null,
    transporteOrden: transporteOrden as { estado: string } | null,
    fechaEvento: (evento as any)?.fecha_evento ?? "",
    estadoLiquidacion: (evento as any)?.estado_liquidacion ?? "pendiente",
    ingredientesDespachados: !!movUso,
    menajeDespachado: !!movSalida,
  };
}

/** Batch fetch checklist data for multiple events (for list view) */
export async function fetchChecklistDataBatch(
  eventoIds: string[]
): Promise<Record<string, ChecklistData>> {
  if (eventoIds.length === 0) return {};

  const [
    { data: personalCounts },
    { data: reqPersonal },
    { data: ordenes },
    { data: reservas },
    { data: transportes },
    { data: eventos },
    { data: movsUso },
    { data: movsSalida },
  ] = await Promise.all([
    supabase
      .from("evento_personal")
      .select("evento_id")
      .in("evento_id", eventoIds),
    supabase
      .from("evento_requerimiento_personal")
      .select("evento_id, cantidad")
      .in("evento_id", eventoIds),
    supabase
      .from("evento_orden_compra")
      .select("evento_id, estado")
      .in("evento_id", eventoIds)
      .neq("estado", "cancelada"),
    supabase
      .from("menaje_reservas")
      .select("evento_id, estado")
      .in("evento_id", eventoIds),
    supabase
      .from("transporte_ordenes")
      .select("evento_id, estado")
      .in("evento_id", eventoIds),
    supabase
      .from("eventos")
      .select("id, fecha_evento, estado_liquidacion")
      .in("id", eventoIds),
    supabase
      .from("inventario_movimientos")
      .select("evento_id")
      .in("evento_id", eventoIds)
      .eq("tipo", "uso"),
    supabase
      .from("menaje_movimientos")
      .select("evento_id")
      .in("evento_id", eventoIds)
      .eq("tipo", "salida"),
  ]);

  const result: Record<string, ChecklistData> = {};

  for (const eid of eventoIds) {
    const pCount = (personalCounts ?? []).filter((r: any) => r.evento_id === eid).length;
    const reqP = (reqPersonal ?? [])
      .filter((r: any) => r.evento_id === eid)
      .reduce((acc: number, r: any) => acc + (r.cantidad ?? 0), 0);
    const orden = (ordenes ?? []).find((r: any) => r.evento_id === eid) ?? null;
    const reserva = (reservas ?? []).find((r: any) => r.evento_id === eid) ?? null;
    const transporte = (transportes ?? []).find((r: any) => r.evento_id === eid) ?? null;
    const ev = (eventos ?? []).find((r: any) => r.id === eid);

    result[eid] = {
      personalAsignadoCount: pCount,
      personalRequeridoCount: reqP,
      ordenCompra: orden ? { estado: orden.estado } : null,
      menajeReserva: reserva ? { estado: reserva.estado } : null,
      transporteOrden: transporte ? { estado: transporte.estado } : null,
      fechaEvento: ev?.fecha_evento ?? "",
      estadoLiquidacion: ev?.estado_liquidacion ?? "pendiente",
      ingredientesDespachados: (movsUso ?? []).some((m: any) => m.evento_id === eid),
      menajeDespachado: (movsSalida ?? []).some((m: any) => m.evento_id === eid),
    };
  }

  return result;
}
