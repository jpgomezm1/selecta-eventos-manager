import { supabase } from "@/integrations/supabase/client";
import type {
  PlatoCatalogo,
  TransporteTarifa,
  PersonalCosto,
  CotizacionWithVersionsDraft,
  CotizacionVersionInsert,
  CotizacionVersion,
  Cotizacion,
  CotizacionItemsState,
} from "@/types/cotizador";

/** Catálogos */
export async function getPlatosCatalogo(): Promise<PlatoCatalogo[]> {
  const { data, error } = await supabase
    .from("platos_catalogo")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ ...d, precio: Number(d.precio) }));
}

export async function getTransporteTarifas(): Promise<TransporteTarifa[]> {
  const { data, error } = await supabase
    .from("transporte_tarifas")
    .select("*")
    .order("lugar", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ ...d, tarifa: Number(d.tarifa) }));
}

export async function getPersonalCostosCatalogo(): Promise<PersonalCosto[]> {
  const { data, error } = await supabase
    .from("personal_costos_catalogo")
    .select("*")
    .order("rol", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ ...d, tarifa: Number(d.tarifa) }));
}

/** Listado y detalle */
export async function listCotizaciones(): Promise<Cotizacion[]> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ ...d, total_cotizado: Number(d.total_cotizado) }));
}

export async function getCotizacionDetalle(cotizacion_id: string): Promise<{
  cotizacion: Cotizacion;
  versiones: Array<CotizacionVersion & { items: CotizacionItemsState }>;
}> {
  const { data: cot, error: e1 } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("id", cotizacion_id)
    .single();
  if (e1) throw e1;

  const { data: vers, error: e2 } = await supabase
    .from("cotizacion_versiones")
    .select("*")
    .eq("cotizacion_id", cotizacion_id)
    .order("version_index", { ascending: true });

  if (e2) throw e2;

  const versiones = await Promise.all(
    (vers ?? []).map(async (v: any) => {
      // Cargar items por versión
      const [{ data: p }, { data: t }, { data: pe }] = await Promise.all([
        supabase.from("cotizacion_platos").select("*").eq("cotizacion_version_id", v.id),
        supabase.from("cotizacion_transporte_items").select("*").eq("cotizacion_version_id", v.id),
        supabase.from("cotizacion_personal_items").select("*").eq("cotizacion_version_id", v.id),
      ]);

      const items: CotizacionItemsState = {
        platos: (p ?? []).map((x: any) => ({
          plato_id: x.plato_id,
          nombre: "", // opcional: joinear nombre si lo quieres mostrar
          precio_unitario: Number(x.precio_unitario),
          cantidad: x.cantidad,
        })),
        transportes: (t ?? []).map((x: any) => ({
          transporte_id: x.transporte_id,
          lugar: "",
          tarifa_unitaria: Number(x.tarifa_unitaria),
          cantidad: x.cantidad,
        })),
        personal: (pe ?? []).map((x: any) => ({
          personal_costo_id: x.personal_costo_id,
          rol: "",
          tarifa_estimada_por_persona: Number(x.tarifa_estimada_por_persona),
          cantidad: x.cantidad,
        })),
      };

      return {
        ...(v as CotizacionVersion),
        total: Number(v.total),
        items,
      };
    })
  );

  return {
    cotizacion: { ...(cot as any), total_cotizado: Number((cot as any).total_cotizado) } as Cotizacion,
    versiones,
  };
}

/** Crear cotización con N versiones y sus items */
export async function createCotizacionWithVersions(payload: CotizacionWithVersionsDraft) {
  // 1) Insert cotización
  const { data: cab, error: errCab } = await supabase
    .from("cotizaciones")
    .insert({
      nombre_cotizacion: payload.cotizacion.nombre_cotizacion,
      cliente_nombre: payload.cotizacion.cliente_nombre,
      numero_invitados: payload.cotizacion.numero_invitados,
      fecha_evento_estimada: payload.cotizacion.fecha_evento_estimada
        ? payload.cotizacion.fecha_evento_estimada.toISOString().slice(0, 10)
        : null,
      total_cotizado: payload.cotizacion.total_cotizado,
      estado: payload.cotizacion.estado,
    })
    .select("id")
    .single();

  if (errCab) throw errCab;
  const cotizacion_id = cab!.id as string;

  try {
    // 2) Insert versiones
    for (const v of payload.versiones) {
      const { data: ver, error: errVer } = await supabase
        .from("cotizacion_versiones")
        .insert({
          cotizacion_id,
          nombre_opcion: v.nombre_opcion,
          version_index: v.version_index,
          total: v.total,
          estado: v.estado,
          is_definitiva: v.is_definitiva ?? false,
        })
        .select("id")
        .single();

      if (errVer) throw errVer;
      const cotizacion_version_id = ver!.id as string;

      // 3) Insert items por versión
      await insertItemsForVersion(cotizacion_id, cotizacion_version_id, v.items);
    }

    return { id: cotizacion_id };
  } catch (err) {
    await supabase.from("cotizaciones").delete().eq("id", cotizacion_id);
    throw err;
  }
}

/** Agregar una versión a una cotización existente */
export async function addVersionToCotizacion(
  cotizacion_id: string,
  version: CotizacionVersionInsert
) {
  const { data: ver, error } = await supabase
    .from("cotizacion_versiones")
    .insert({
      cotizacion_id,
      nombre_opcion: version.nombre_opcion,
      version_index: version.version_index,
      total: version.total,
      estado: version.estado,
      is_definitiva: version.is_definitiva ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;

  await insertItemsForVersion(cotizacion_id, ver!.id as string, version.items);
  return { id: ver!.id as string };
}

/** Marcar una versión como definitiva (y desmarcar otras) */
export async function setVersionDefinitiva(cotizacion_id: string, version_id: string) {
  // 1) Desmarcar todas
  const { error: e1 } = await supabase
    .from("cotizacion_versiones")
    .update({ is_definitiva: false })
    .eq("cotizacion_id", cotizacion_id);
  if (e1) throw e1;

  // 2) Marcar seleccionada
  const { data: v, error: e2 } = await supabase
    .from("cotizacion_versiones")
    .update({ is_definitiva: true, estado: "Aceptada" })
    .eq("id", version_id)
    .select("*")
    .single();
  if (e2) throw e2;

  // 3) Sincronizar total y estado en cabecera (opcional)
  const totalDef = Number(v!.total);
  const { error: e3 } = await supabase
    .from("cotizaciones")
    .update({ total_cotizado: totalDef, estado: "Aceptada" })
    .eq("id", cotizacion_id);
  if (e3) throw e3;

  return { ok: true };
}

/** Helpers */
async function insertItemsForVersion(
  cotizacion_id: string,
  cotizacion_version_id: string,
  items: CotizacionItemsState
) {
  // platos
  if (items.platos.length > 0) {
    const rows = items.platos.map((p) => ({
      cotizacion_id,
      cotizacion_version_id,
      plato_id: p.plato_id,
      cantidad: p.cantidad,
      precio_unitario: p.precio_unitario,
      subtotal: p.precio_unitario * p.cantidad,
    }));
    const { error } = await supabase.from("cotizacion_platos").insert(rows);
    if (error) throw error;
  }

  // transporte
  if (items.transportes.length > 0) {
    const rows = items.transportes.map((t) => ({
      cotizacion_id,
      cotizacion_version_id,
      transporte_id: t.transporte_id,
      cantidad: t.cantidad,
      tarifa_unitaria: t.tarifa_unitaria,
      subtotal: t.tarifa_unitaria * t.cantidad,
    }));
    const { error } = await supabase.from("cotizacion_transporte_items").insert(rows);
    if (error) throw error;
  }

  // personal
  if (items.personal.length > 0) {
    const rows = items.personal.map((p) => ({
      cotizacion_id,
      cotizacion_version_id,
      personal_costo_id: p.personal_costo_id,
      cantidad: p.cantidad,
      tarifa_estimada_por_persona: p.tarifa_estimada_por_persona,
      subtotal: p.tarifa_estimada_por_persona * p.cantidad,
    }));
    const { error } = await supabase.from("cotizacion_personal_items").insert(rows);
    if (error) throw error;
  }
}
