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
  EventoRequerimiento,
} from "@/types/cotizador";

/** =====================
 *      CATÁLOGOS
 *  ===================== */
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

/** =====================
 *   LISTADO / DETALLE
 *  ===================== */
export async function listCotizaciones(): Promise<Cotizacion[]> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    ...d,
    total_cotizado: Number(d.total_cotizado),
  }));
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
      const [{ data: p }, { data: t }, { data: pe }] = await Promise.all([
        supabase
          .from("cotizacion_platos")
          .select(`
            *,
            platos_catalogo (
              nombre
            )
          `)
          .eq("cotizacion_version_id", v.id),
        supabase
          .from("cotizacion_transporte_items")
          .select(`
            *,
            transporte_tarifas (
              lugar
            )
          `)
          .eq("cotizacion_version_id", v.id),
        supabase
          .from("cotizacion_personal_items")
          .select(`
            *,
            personal_costos_catalogo (
              rol
            )
          `)
          .eq("cotizacion_version_id", v.id),
      ]);

      const items: CotizacionItemsState = {
        platos: (p ?? []).map((x: any) => ({
          plato_id: x.plato_id,
          nombre: x.platos_catalogo?.nombre || "Plato sin nombre",
          precio_unitario: Number(x.precio_unitario),
          cantidad: x.cantidad,
        })),
        transportes: (t ?? []).map((x: any) => ({
          transporte_id: x.transporte_id,
          lugar: x.transporte_tarifas?.lugar || "Lugar sin especificar",
          tarifa_unitaria: Number(x.tarifa_unitaria),
          cantidad: x.cantidad,
        })),
        personal: (pe ?? []).map((x: any) => ({
          personal_costo_id: x.personal_costo_id,
          rol: x.personal_costos_catalogo?.rol || "Rol sin especificar",
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
    cotizacion: {
      ...(cot as any),
      total_cotizado: Number((cot as any).total_cotizado),
    } as Cotizacion,
    versiones,
  };
}

/** =====================
 *   CREAR CON VERSIONES
 *  ===================== */
export async function createCotizacionWithVersions(payload: CotizacionWithVersionsDraft) {
  // 1) Insert cabecera
  const { data: cab, error: errCab } = await supabase
    .from("cotizaciones")
    .insert({
      nombre_cotizacion: payload.cotizacion.nombre_cotizacion,
      cliente_nombre: payload.cotizacion.cliente_nombre,
      numero_invitados: payload.cotizacion.numero_invitados,
      fecha_evento_estimada: payload.cotizacion.fecha_evento_estimada
        ? payload.cotizacion.fecha_evento_estimada.toISOString().slice(0, 10)
        : null,
      ubicacion_evento: payload.cotizacion.ubicacion_evento,
      comercial_encargado: payload.cotizacion.comercial_encargado,
      total_cotizado: payload.cotizacion.total_cotizado,
      estado: payload.cotizacion.estado,
    })
    .select("id")
    .single();

  if (errCab) throw errCab;
  const cotizacion_id = cab!.id as string;

  try {
    // 2) Insert versiones + items
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

/** =====================
 *  EVENTO DESDE VERSIÓN
 *  ===================== */
export async function ensureEventFromVersion(opts: {
  cotizacion_id: string;
  cotizacion_version_id: string;
  nombre_evento: string;
  fecha_evento: string | null; // YYYY-MM-DD
  ubicacion?: string | null;
  descripcion?: string | null;
}): Promise<{ evento_id: string }> {
  // ¿ya existe?
  const { data: existing, error: e0 } = await supabase
    .from("eventos")
    .select("id")
    .eq("cotizacion_version_id", opts.cotizacion_version_id)
    .maybeSingle();
  if (e0) throw e0;
  if (existing?.id) return { evento_id: existing.id };

  // crear evento
  const { data: ev, error: e1 } = await supabase
    .from("eventos")
    .insert({
      nombre_evento: opts.nombre_evento,
      ubicacion: opts.ubicacion ?? "",
      fecha_evento: opts.fecha_evento ?? new Date().toISOString().slice(0, 10),
      descripcion: opts.descripcion ?? null,
      cotizacion_version_id: opts.cotizacion_version_id,
    })
    .select("id")
    .single();
  if (e1) throw e1;
  const evento_id = ev!.id as string;

  // cargar items de la versión
  const [{ data: p }, { data: t }, { data: pe }] = await Promise.all([
    supabase.from("cotizacion_platos").select("*").eq("cotizacion_version_id", opts.cotizacion_version_id),
    supabase.from("cotizacion_transporte_items").select("*").eq("cotizacion_version_id", opts.cotizacion_version_id),
    supabase.from("cotizacion_personal_items").select("*").eq("cotizacion_version_id", opts.cotizacion_version_id),
  ]);

  // ===== Enriquecer con catálogos (para snapshot legible) =====
  const platoIds = (p ?? []).map((x: any) => x.plato_id);
  const transIds = (t ?? []).map((x: any) => x.transporte_id);
  const persIds  = (pe ?? []).map((x: any) => x.personal_costo_id);

  const [{ data: platosCat }, { data: transCat }, { data: persCat }] = await Promise.all([
    platoIds.length
      ? supabase.from("platos_catalogo").select("id,nombre").in("id", platoIds)
      : Promise.resolve({ data: [] as any[] } as any),
    transIds.length
      ? supabase.from("transporte_tarifas").select("id,lugar").in("id", transIds)
      : Promise.resolve({ data: [] as any[] } as any),
    persIds.length
      ? supabase.from("personal_costos_catalogo").select("id,rol").in("id", persIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const nameByPlato = new Map((platosCat ?? []).map((r: any) => [r.id, r.nombre]));
  const lugarByTrans = new Map((transCat ?? []).map((r: any) => [r.id, r.lugar]));
  const rolByPers = new Map((persCat ?? []).map((r: any) => [r.id, r.rol]));

  // snapshot en tablas evento_requerimiento_*
  if ((p ?? []).length) {
    const rows = (p ?? []).map((x: any) => ({
      evento_id,
      plato_id: x.plato_id,
      nombre: nameByPlato.get(x.plato_id) ?? "",
      precio_unitario: Number(x.precio_unitario),
      cantidad: x.cantidad,
      subtotal: Number(x.subtotal),
    }));
    const { error } = await supabase.from("evento_requerimiento_platos").insert(rows);
    if (error) throw error;
  }
  if ((t ?? []).length) {
    const rows = (t ?? []).map((x: any) => ({
      evento_id,
      transporte_id: x.transporte_id,
      lugar: lugarByTrans.get(x.transporte_id) ?? "",
      tarifa_unitaria: Number(x.tarifa_unitaria),
      cantidad: x.cantidad,
      subtotal: Number(x.subtotal),
    }));
    const { error } = await supabase.from("evento_requerimiento_transporte").insert(rows);
    if (error) throw error;
  }
  if ((pe ?? []).length) {
    const rows = (pe ?? []).map((x: any) => ({
      evento_id,
      personal_costo_id: x.personal_costo_id,
      rol: rolByPers.get(x.personal_costo_id) ?? "",
      tarifa_estimada_por_persona: Number(x.tarifa_estimada_por_persona),
      cantidad: x.cantidad,
      subtotal: Number(x.subtotal),
    }));
    const { error } = await supabase.from("evento_requerimiento_personal").insert(rows);
    if (error) throw error;
  }

  return { evento_id };
}

/** Leer snapshot del requerimiento de un evento (con enriquecimiento si faltan campos) */
export async function getEventoRequerimiento(evento_id: string): Promise<EventoRequerimiento> {
  const [p, t, pe] = await Promise.all([
    supabase.from("evento_requerimiento_platos").select("*").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_transporte").select("*").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_personal").select("*").eq("evento_id", evento_id),
  ]);

  if (p.error) throw p.error;
  if (t.error) throw t.error;
  if (pe.error) throw pe.error;

  // Si detectamos snapshot antiguo con nombres vacíos, enriquecemos en caliente y devolvemos ya enriquecido
  const needsEnrich =
    (p.data ?? []).some((x: any) => !x.nombre) ||
    (t.data ?? []).some((x: any) => !x.lugar) ||
    (pe.data ?? []).some((x: any) => !x.rol);

  if (needsEnrich) {
    await enrichEventoRequerimiento(evento_id);
    // Reconsultar ya enriquecido
    const [p2, t2, pe2] = await Promise.all([
      supabase.from("evento_requerimiento_platos").select("*").eq("evento_id", evento_id),
      supabase.from("evento_requerimiento_transporte").select("*").eq("evento_id", evento_id),
      supabase.from("evento_requerimiento_personal").select("*").eq("evento_id", evento_id),
    ]);
    if (p2.error) throw p2.error;
    if (t2.error) throw t2.error;
    if (pe2.error) throw pe2.error;

    return {
      platos: (p2.data ?? []).map((x: any) => ({
        plato_id: x.plato_id,
        nombre: x.nombre ?? "",
        precio_unitario: Number(x.precio_unitario),
        cantidad: x.cantidad,
        subtotal: Number(x.subtotal),
      })),
      transportes: (t2.data ?? []).map((x: any) => ({
        transporte_id: x.transporte_id,
        lugar: x.lugar ?? "",
        tarifa_unitaria: Number(x.tarifa_unitaria),
        cantidad: x.cantidad,
        subtotal: Number(x.subtotal),
      })),
      personal: (pe2.data ?? []).map((x: any) => ({
        personal_costo_id: x.personal_costo_id,
        rol: x.rol ?? "",
        tarifa_estimada_por_persona: Number(x.tarifa_estimada_por_persona),
        cantidad: x.cantidad,
        subtotal: Number(x.subtotal),
      })),
    };
  }

  // Caso normal (ya está enriquecido)
  return {
    platos: (p.data ?? []).map((x: any) => ({
      plato_id: x.plato_id,
      nombre: x.nombre ?? "",
      precio_unitario: Number(x.precio_unitario),
      cantidad: x.cantidad,
      subtotal: Number(x.subtotal),
    })),
    transportes: (t.data ?? []).map((x: any) => ({
      transporte_id: x.transporte_id,
      lugar: x.lugar ?? "",
      tarifa_unitaria: Number(x.tarifa_unitaria),
      cantidad: x.cantidad,
      subtotal: Number(x.subtotal),
    })),
    personal: (pe.data ?? []).map((x: any) => ({
      personal_costo_id: x.personal_costo_id,
      rol: x.rol ?? "",
      tarifa_estimada_por_persona: Number(x.tarifa_estimada_por_persona),
      cantidad: x.cantidad,
      subtotal: Number(x.subtotal),
    })),
  };
}

/** Enriquecer snapshots antiguos de evento_requerimiento_* con nombres desde catálogos */
async function enrichEventoRequerimiento(evento_id: string) {
  // Leer filas
  const [p, t, pe] = await Promise.all([
    supabase.from("evento_requerimiento_platos").select("id,plato_id,nombre").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_transporte").select("id,transporte_id,lugar").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_personal").select("id,personal_costo_id,rol").eq("evento_id", evento_id),
  ]);
  if (p.error) throw p.error;
  if (t.error) throw t.error;
  if (pe.error) throw pe.error;

  const missingPlatos = (p.data ?? []).filter((x: any) => !x.nombre);
  const missingTrans  = (t.data ?? []).filter((x: any) => !x.lugar);
  const missingPers   = (pe.data ?? []).filter((x: any) => !x.rol);

  if (missingPlatos.length) {
    const ids = missingPlatos.map((x: any) => x.plato_id);
    const { data } = await supabase.from("platos_catalogo").select("id,nombre").in("id", ids);
    const m = new Map((data ?? []).map((r: any) => [r.id, r.nombre]));
    for (const row of missingPlatos) {
      await supabase
        .from("evento_requerimiento_platos")
        .update({ nombre: m.get(row.plato_id) ?? "" })
        .eq("id", row.id);
    }
  }
  if (missingTrans.length) {
    const ids = missingTrans.map((x: any) => x.transporte_id);
    const { data } = await supabase.from("transporte_tarifas").select("id,lugar").in("id", ids);
    const m = new Map((data ?? []).map((r: any) => [r.id, r.lugar]));
    for (const row of missingTrans) {
      await supabase
        .from("evento_requerimiento_transporte")
        .update({ lugar: m.get(row.transporte_id) ?? "" })
        .eq("id", row.id);
    }
  }
  if (missingPers.length) {
    const ids = missingPers.map((x: any) => x.personal_costo_id);
    const { data } = await supabase.from("personal_costos_catalogo").select("id,rol").in("id", ids);
    const m = new Map((data ?? []).map((r: any) => [r.id, r.rol]));
    for (const row of missingPers) {
      await supabase
        .from("evento_requerimiento_personal")
        .update({ rol: m.get(row.personal_costo_id) ?? "" })
        .eq("id", row.id);
    }
  }
}

/** =====================
 *  MARCAR DEFINITIVA
 *  ===================== */
export async function setVersionDefinitiva(cotizacion_id: string, version_id: string) {
  // 1) desmarcar todas
  const { error: e1 } = await supabase
    .from("cotizacion_versiones")
    .update({ is_definitiva: false })
    .eq("cotizacion_id", cotizacion_id);
  if (e1) throw e1;

  // 2) marcar seleccionada
  const { data: v, error: e2 } = await supabase
    .from("cotizacion_versiones")
    .update({ is_definitiva: true, estado: "Aceptada" })
    .eq("id", version_id)
    .select("id,total")
    .single();
  if (e2) throw e2;

  // 3) sincronizar cabecera
  const totalDef = Number(v!.total);
  const { error: e3 } = await supabase
    .from("cotizaciones")
    .update({ total_cotizado: totalDef, estado: "Aceptada" })
    .eq("id", cotizacion_id);
  if (e3) throw e3;

  // 4) crear evento (si no existe) + snapshot enriquecido
  const { data: cab, error: e4 } = await supabase
    .from("cotizaciones")
    .select("nombre_cotizacion, fecha_evento_estimada")
    .eq("id", cotizacion_id)
    .single();
  if (e4) throw e4;

  await ensureEventFromVersion({
    cotizacion_id,
    cotizacion_version_id: version_id,
    nombre_evento: (cab as any).nombre_cotizacion,
    fecha_evento: (cab as any).fecha_evento_estimada,
    ubicacion: "",
  });

  return { ok: true };
}

/** =====================
 *        HELPERS
 *  ===================== */
async function insertItemsForVersion(
  cotizacion_id: string,
  cotizacion_version_id: string,
  items: CotizacionItemsState
) {
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
