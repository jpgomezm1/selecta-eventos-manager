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
  CotizacionPersonalLocal,
  EventoRequerimiento,
  IngredienteCatalogo,
  PlatoIngrediente,
  IngredienteProveedor,
  PersonalAsignacion,
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
      const [{ data: p }, { data: t }, { data: pe }, { data: me }] = await Promise.all([
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
        supabase
          .from("cotizacion_menaje_items")
          .select(`
            *,
            menaje_catalogo (
              nombre
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
        menaje: (me ?? []).map((x: any) => ({
          menaje_id: x.menaje_id,
          nombre: x.menaje_catalogo?.nombre || "Menaje sin nombre",
          precio_alquiler: Number(x.precio_alquiler),
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

/** Actualizar una versión existente */
export async function updateVersionCotizacion(
  cotizacion_id: string,
  version_id: string,
  items: CotizacionItemsState
) {
  // Calcular nuevo total
  const total =
    items.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0) +
    items.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0) +
    items.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0) +
    (items.menaje ?? []).reduce((a, m) => a + m.precio_alquiler * m.cantidad, 0);

  // Actualizar total de la versión
  const { error: updateError } = await supabase
    .from("cotizacion_versiones")
    .update({ total })
    .eq("id", version_id);
  if (updateError) throw updateError;

  // Eliminar items existentes
  await Promise.all([
    supabase.from("cotizacion_platos").delete().eq("cotizacion_version_id", version_id),
    supabase.from("cotizacion_personal_items").delete().eq("cotizacion_version_id", version_id),
    supabase.from("cotizacion_transporte_items").delete().eq("cotizacion_version_id", version_id),
    supabase.from("cotizacion_menaje_items").delete().eq("cotizacion_version_id", version_id),
  ]);

  // Insertar nuevos items
  await insertItemsForVersion(cotizacion_id, version_id, items);

  return { success: true };
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
  const [{ data: p }, { data: t }, { data: pe }, { data: me }] = await Promise.all([
    supabase.from("cotizacion_platos").select("*").eq("cotizacion_version_id", opts.cotizacion_version_id),
    supabase.from("cotizacion_transporte_items").select("*").eq("cotizacion_version_id", opts.cotizacion_version_id),
    supabase.from("cotizacion_personal_items").select("*").eq("cotizacion_version_id", opts.cotizacion_version_id),
    supabase.from("cotizacion_menaje_items").select("*").eq("cotizacion_version_id", opts.cotizacion_version_id),
  ]);

  // ===== Enriquecer con catálogos (para snapshot legible) =====
  const platoIds = (p ?? []).map((x: any) => x.plato_id);
  const transIds = (t ?? []).map((x: any) => x.transporte_id);
  const persIds  = (pe ?? []).map((x: any) => x.personal_costo_id);
  const menajeIds = (me ?? []).map((x: any) => x.menaje_id);

  const [{ data: platosCat }, { data: transCat }, { data: persCat }, { data: menajeCat }] = await Promise.all([
    platoIds.length
      ? supabase.from("platos_catalogo").select("id,nombre").in("id", platoIds)
      : Promise.resolve({ data: [] as any[] } as any),
    transIds.length
      ? supabase.from("transporte_tarifas").select("id,lugar").in("id", transIds)
      : Promise.resolve({ data: [] as any[] } as any),
    persIds.length
      ? supabase.from("personal_costos_catalogo").select("id,rol").in("id", persIds)
      : Promise.resolve({ data: [] as any[] } as any),
    menajeIds.length
      ? supabase.from("menaje_catalogo").select("id,nombre").in("id", menajeIds)
      : Promise.resolve({ data: [] as any[] } as any),
  ]);

  const nameByPlato = new Map((platosCat ?? []).map((r: any) => [r.id, r.nombre]));
  const lugarByTrans = new Map((transCat ?? []).map((r: any) => [r.id, r.lugar]));
  const rolByPers = new Map((persCat ?? []).map((r: any) => [r.id, r.rol]));
  const nameByMenaje = new Map((menajeCat ?? []).map((r: any) => [r.id, r.nombre]));

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

  // Snapshot menaje
  if ((me ?? []).length) {
    const rows = (me ?? []).map((x: any) => ({
      evento_id,
      menaje_id: x.menaje_id,
      nombre: nameByMenaje.get(x.menaje_id) ?? "",
      precio_alquiler: Number(x.precio_alquiler),
      cantidad: x.cantidad,
      subtotal: Number(x.precio_alquiler) * x.cantidad,
    }));
    const { error } = await supabase.from("evento_requerimiento_menaje").insert(rows);
    if (error) throw error;

    // Auto-crear reserva de menaje en borrador
    const fechaEvento = opts.fecha_evento ?? new Date().toISOString().slice(0, 10);
    const { data: reserva, error: resErr } = await supabase
      .from("menaje_reservas")
      .insert({
        evento_id,
        fecha_inicio: fechaEvento,
        fecha_fin: fechaEvento,
        estado: "borrador",
      })
      .select("id")
      .single();
    if (resErr) throw resErr;

    const reservaItems = (me ?? []).map((x: any) => ({
      reserva_id: reserva!.id,
      menaje_id: x.menaje_id,
      cantidad: x.cantidad,
    }));
    const { error: riErr } = await supabase.from("menaje_reserva_items").insert(reservaItems);
    if (riErr) throw riErr;
  }

  return { evento_id };
}

/** Leer snapshot del requerimiento de un evento (con enriquecimiento si faltan campos) */
export async function getEventoRequerimiento(evento_id: string): Promise<EventoRequerimiento> {
  const [p, t, pe, m] = await Promise.all([
    supabase.from("evento_requerimiento_platos").select("*").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_transporte").select("*").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_personal").select("*").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_menaje").select("*").eq("evento_id", evento_id),
  ]);

  if (p.error) throw p.error;
  if (t.error) throw t.error;
  if (pe.error) throw pe.error;
  if (m.error) throw m.error;

  const mapMenaje = (data: any[]) => (data ?? []).map((x: any) => ({
    menaje_id: x.menaje_id,
    nombre: x.nombre ?? "",
    precio_alquiler: Number(x.precio_alquiler),
    cantidad: x.cantidad,
    subtotal: Number(x.subtotal),
  }));

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
      menaje: mapMenaje(m.data),
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
    menaje: mapMenaje(m.data),
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
    .update({ is_definitiva: true, estado: "Cotización Aprobada" })
    .eq("id", version_id)
    .select("id,total")
    .single();
  if (e2) throw e2;

  // 3) sincronizar cabecera
  const totalDef = Number(v!.total);
  const { error: e3 } = await supabase
    .from("cotizaciones")
    .update({ total_cotizado: totalDef, estado: "Cotización Aprobada" })
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

  if ((items.menaje ?? []).length > 0) {
    const rows = (items.menaje ?? []).map((m) => ({
      cotizacion_id,
      cotizacion_version_id,
      menaje_id: m.menaje_id,
      cantidad: m.cantidad,
      precio_alquiler: m.precio_alquiler,
      subtotal: m.precio_alquiler * m.cantidad,
    }));
    const { error } = await supabase.from("cotizacion_menaje_items").insert(rows);
    if (error) throw error;
  }
}

/**
 * Eliminar una versión de cotización y todos sus items relacionados
 */
export async function deleteVersionCotizacion(versionId: string): Promise<void> {
  // Primero eliminar todos los items relacionados
  const { error: platosError } = await supabase
    .from("cotizacion_platos")
    .delete()
    .eq("cotizacion_version_id", versionId);

  if (platosError) throw platosError;

  const { error: transporteError } = await supabase
    .from("cotizacion_transporte_items")
    .delete()
    .eq("cotizacion_version_id", versionId);

  if (transporteError) throw transporteError;

  const { error: personalError } = await supabase
    .from("cotizacion_personal_items")
    .delete()
    .eq("cotizacion_version_id", versionId);

  if (personalError) throw personalError;

  const { error: menajeError } = await supabase
    .from("cotizacion_menaje_items")
    .delete()
    .eq("cotizacion_version_id", versionId);

  if (menajeError) throw menajeError;

  // Finalmente eliminar la versión
  const { error: versionError } = await supabase
    .from("cotizacion_versiones")
    .delete()
    .eq("id", versionId);

  if (versionError) throw versionError;
}

/** =====================
 *  INGREDIENTES CATÁLOGO
 *  ===================== */

export async function getIngredientesCatalogo(): Promise<IngredienteCatalogo[]> {
  const { data, error } = await supabase
    .from("ingredientes_catalogo")
    .select("*")
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({ ...d, costo_por_unidad: Number(d.costo_por_unidad) }));
}

export async function createIngrediente(
  ingrediente: Omit<IngredienteCatalogo, "id" | "created_at">
): Promise<IngredienteCatalogo> {
  const { data, error } = await supabase
    .from("ingredientes_catalogo")
    .insert(ingrediente)
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, costo_por_unidad: Number(data.costo_por_unidad) } as IngredienteCatalogo;
}

export async function updateIngrediente(
  id: string,
  updates: Partial<Omit<IngredienteCatalogo, "id" | "created_at">>
): Promise<IngredienteCatalogo> {
  const { data, error } = await supabase
    .from("ingredientes_catalogo")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, costo_por_unidad: Number(data.costo_por_unidad) } as IngredienteCatalogo;
}

export async function deleteIngrediente(id: string): Promise<void> {
  const { error } = await supabase
    .from("ingredientes_catalogo")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Fetch a plato with its ingredients joined */
export async function getPlatoConIngredientes(platoId: string): Promise<PlatoCatalogo & { ingredientes: PlatoIngrediente[] }> {
  const { data: plato, error: e1 } = await supabase
    .from("platos_catalogo")
    .select("*")
    .eq("id", platoId)
    .single();
  if (e1) throw e1;

  const { data: items, error: e2 } = await supabase
    .from("plato_ingredientes")
    .select("*, ingredientes_catalogo(*)")
    .eq("plato_id", platoId);
  if (e2) throw e2;

  const ingredientes: PlatoIngrediente[] = (items ?? []).map((row: any) => ({
    id: row.id,
    plato_id: row.plato_id,
    ingrediente_id: row.ingrediente_id,
    cantidad: Number(row.cantidad),
    ingrediente: row.ingredientes_catalogo
      ? { ...row.ingredientes_catalogo, costo_por_unidad: Number(row.ingredientes_catalogo.costo_por_unidad) }
      : undefined,
  }));

  return {
    ...(plato as any),
    precio: Number((plato as any).precio),
    ingredientes,
  };
}

/** Upsert ingredients for a plato (replace all) */
export async function upsertPlatoIngredientes(
  platoId: string,
  items: Array<{ ingrediente_id: string; cantidad: number }>
): Promise<void> {
  // Delete existing
  const { error: delErr } = await supabase
    .from("plato_ingredientes")
    .delete()
    .eq("plato_id", platoId);
  if (delErr) throw delErr;

  if (items.length === 0) return;

  const rows = items.map((item) => ({
    plato_id: platoId,
    ingrediente_id: item.ingrediente_id,
    cantidad: item.cantidad,
  }));
  const { error: insErr } = await supabase.from("plato_ingredientes").insert(rows);
  if (insErr) throw insErr;
}

/** Actualizar campos de un plato */
export async function updatePlato(
  id: string,
  updates: Partial<Omit<PlatoCatalogo, "id" | "created_at" | "ingredientes">>
): Promise<PlatoCatalogo> {
  const { data, error } = await supabase
    .from("platos_catalogo")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, precio: Number(data.precio) } as PlatoCatalogo;
}

/** Obtener TODOS los plato_ingredientes con join ingredientes_catalogo (para costos en bulk) */
export async function getAllPlatoIngredientes(): Promise<PlatoIngrediente[]> {
  const { data, error } = await supabase
    .from("plato_ingredientes")
    .select("*, ingredientes_catalogo(*)");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    plato_id: row.plato_id,
    ingrediente_id: row.ingrediente_id,
    cantidad: Number(row.cantidad),
    ingrediente: row.ingredientes_catalogo
      ? { ...row.ingredientes_catalogo, costo_por_unidad: Number(row.ingredientes_catalogo.costo_por_unidad) }
      : undefined,
  }));
}

/** =====================
 *      CREAR PLATO
 *  ===================== */
export async function createPlato(
  plato: Omit<PlatoCatalogo, "id" | "created_at" | "ingredientes">
): Promise<PlatoCatalogo> {
  const { data, error } = await supabase
    .from("platos_catalogo")
    .insert(plato)
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, precio: Number(data.precio) } as PlatoCatalogo;
}

/** =====================
 *  PROVEEDORES INGREDIENTE
 *  ===================== */

/** Convertir cantidad de presentación a unidad base del ingrediente */
export function convertirAUnidadBase(
  presentacionCantidad: number,
  presentacionUnidad: string,
  unidadBase: string
): number {
  // kg → gr
  if (presentacionUnidad === "kg" && unidadBase === "gr") return presentacionCantidad * 1000;
  // lt → ml
  if (presentacionUnidad === "lt" && unidadBase === "ml") return presentacionCantidad * 1000;
  // misma unidad
  return presentacionCantidad;
}

export async function getProveedoresByIngrediente(ingredienteId: string): Promise<IngredienteProveedor[]> {
  const { data, error } = await supabase
    .from("ingrediente_proveedores")
    .select("*")
    .eq("ingrediente_id", ingredienteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    ...d,
    presentacion_cantidad: Number(d.presentacion_cantidad),
    precio_presentacion: Number(d.precio_presentacion),
    costo_por_unidad_base: Number(d.costo_por_unidad_base),
  }));
}

export async function createProveedor(
  data: Omit<IngredienteProveedor, "id" | "created_at">
): Promise<IngredienteProveedor> {
  const { data: row, error } = await supabase
    .from("ingrediente_proveedores")
    .insert(data)
    .select("*")
    .single();
  if (error) throw error;
  return {
    ...row,
    presentacion_cantidad: Number(row.presentacion_cantidad),
    precio_presentacion: Number(row.precio_presentacion),
    costo_por_unidad_base: Number(row.costo_por_unidad_base),
  } as IngredienteProveedor;
}

export async function updateProveedor(
  id: string,
  updates: Partial<Omit<IngredienteProveedor, "id" | "created_at">>
): Promise<IngredienteProveedor> {
  const { data: row, error } = await supabase
    .from("ingrediente_proveedores")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return {
    ...row,
    presentacion_cantidad: Number(row.presentacion_cantidad),
    precio_presentacion: Number(row.precio_presentacion),
    costo_por_unidad_base: Number(row.costo_por_unidad_base),
  } as IngredienteProveedor;
}

export async function deleteProveedor(id: string): Promise<void> {
  const { error } = await supabase
    .from("ingrediente_proveedores")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function setProveedorPrincipal(
  ingredienteId: string,
  proveedorId: string
): Promise<void> {
  // Desmarcar todos
  const { error: e1 } = await supabase
    .from("ingrediente_proveedores")
    .update({ es_principal: false })
    .eq("ingrediente_id", ingredienteId);
  if (e1) throw e1;

  // Marcar el seleccionado
  const { data: prov, error: e2 } = await supabase
    .from("ingrediente_proveedores")
    .update({ es_principal: true })
    .eq("id", proveedorId)
    .select("costo_por_unidad_base")
    .single();
  if (e2) throw e2;

  // Actualizar costo del ingrediente
  const { error: e3 } = await supabase
    .from("ingredientes_catalogo")
    .update({ costo_por_unidad: Number(prov.costo_por_unidad_base) })
    .eq("id", ingredienteId);
  if (e3) throw e3;
}

/** =====================
 *  PERSONAL ASIGNACIONES
 *  ===================== */

/** Guardar asignaciones de personal para una versión de cotización */
export async function savePersonalAsignaciones(
  cotizacion_version_id: string,
  personalItems: CotizacionPersonalLocal[]
): Promise<void> {
  // Borrar asignaciones existentes de esta versión
  const { error: delErr } = await supabase
    .from("cotizacion_personal_asignaciones")
    .delete()
    .eq("cotizacion_version_id", cotizacion_version_id);
  if (delErr) throw delErr;

  // Recopilar todas las asignaciones
  const rows: Array<{
    cotizacion_version_id: string;
    personal_costo_id: string;
    personal_id: string;
  }> = [];

  for (const item of personalItems) {
    if (item.asignados && item.asignados.length > 0) {
      for (const asig of item.asignados) {
        rows.push({
          cotizacion_version_id,
          personal_costo_id: item.personal_costo_id,
          personal_id: asig.personal_id,
        });
      }
    }
  }

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("cotizacion_personal_asignaciones")
      .insert(rows);
    if (insErr) throw insErr;
  }
}

/** Cargar asignaciones de personal para una versión de cotización */
export async function loadPersonalAsignaciones(
  cotizacion_version_id: string
): Promise<Record<string, PersonalAsignacion[]>> {
  const { data, error } = await supabase
    .from("cotizacion_personal_asignaciones")
    .select("personal_costo_id, personal_id, personal(nombre_completo)")
    .eq("cotizacion_version_id", cotizacion_version_id);
  if (error) throw error;

  const result: Record<string, PersonalAsignacion[]> = {};
  for (const row of data ?? []) {
    const costoId = row.personal_costo_id;
    if (!result[costoId]) result[costoId] = [];
    result[costoId].push({
      personal_id: row.personal_id,
      nombre_completo: (row as any).personal?.nombre_completo ?? "",
    });
  }
  return result;
}
