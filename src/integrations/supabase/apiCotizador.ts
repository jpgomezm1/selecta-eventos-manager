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
  LugarOption,
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
  return (data ?? []).map((d) => ({ ...d, precio: Number(d.precio) })) as PlatoCatalogo[];
}

export async function getTransporteTarifas(): Promise<TransporteTarifa[]> {
  const { data, error } = await supabase
    .from("transporte_tarifas")
    .select("*")
    .order("lugar", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, tarifa: Number(d.tarifa) })) as TransporteTarifa[];
}

export async function getPersonalCostosCatalogo(): Promise<PersonalCosto[]> {
  const { data, error } = await supabase
    .from("personal_costos_catalogo")
    .select("*")
    .order("rol", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => ({ ...d, tarifa: Number(d.tarifa) || 0 })) as PersonalCosto[];
}

/** =====================
 *   MIGRATION CHECK
 *  ===================== */
// Cache whether the new tables/columns exist so we don't retry on every call
let _migrationChecked = false;
let _hasClientesTable = false;
let _hasLugaresTable = false;
let _hasClienteIdCol = false;
let _hasContactoIdCol = false;
let _hasContactosTable = false;

async function checkMigration() {
  if (_migrationChecked) return;
  _migrationChecked = true;

  // Check clientes table
  const { error: e1 } = await supabase.from("clientes").select("id").limit(0);
  _hasClientesTable = !e1;

  // Check cotizacion_lugares table
  const { error: e2 } = await supabase.from("cotizacion_lugares").select("id").limit(0);
  _hasLugaresTable = !e2;

  // Check cliente_id column on cotizaciones (try a read with that column)
  const { error: e3 } = await supabase.from("cotizaciones").select("cliente_id").limit(0);
  _hasClienteIdCol = !e3;

  // Check cliente_contactos table
  const { error: e4 } = await supabase.from("cliente_contactos").select("id").limit(0);
  _hasContactosTable = !e4;

  // Check contacto_id column on cotizaciones
  const { error: e5 } = await supabase.from("cotizaciones").select("contacto_id").limit(0);
  _hasContactoIdCol = !e5;
}

/** =====================
 *   LISTADO / DETALLE
 *  ===================== */
export async function listCotizaciones(): Promise<Cotizacion[]> {
  await checkMigration();

  const selectParts = ["*"];
  if (_hasClientesTable) selectParts.push("clientes(nombre, empresa, telefono, correo, tipo, cedula)");
  if (_hasContactosTable && _hasContactoIdCol) selectParts.push("cliente_contactos(nombre, cargo, telefono, correo)");
  const selectQuery = selectParts.join(", ");

  const { data, error } = await supabase
    .from("cotizaciones")
    .select(selectQuery)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // El selectQuery es dinámico (depende de checkMigration), así que
  // supabase no infiere el row; lo tratamos como Record permisivo y
  // casteamos al tipo Cotizacion al final.
  type Row = Record<string, unknown>;
  return ((data ?? []) as unknown as Row[]).map((d) => ({
    ...d,
    total_cotizado: Number(d.total_cotizado),
    cliente: d.clientes ?? null,
    contacto: d.cliente_contactos ?? null,
  })) as unknown as Cotizacion[];
}

export async function getCotizacionDetalle(cotizacion_id: string): Promise<{
  cotizacion: Cotizacion;
  versiones: Array<CotizacionVersion & { items: CotizacionItemsState }>;
  lugares: LugarOption[];
}> {
  await checkMigration();

  const selectParts = ["*"];
  if (_hasClientesTable) selectParts.push("clientes(nombre, empresa, telefono, correo, tipo, cedula)");
  if (_hasContactosTable && _hasContactoIdCol) selectParts.push("cliente_contactos(nombre, cargo, telefono, correo)");
  const selectQuery = selectParts.join(", ");

  const { data: cot, error: e1 } = await supabase
    .from("cotizaciones")
    .select(selectQuery)
    .eq("id", cotizacion_id)
    .single();

  const { data: vers, error: e2 } = await supabase
    .from("cotizacion_versiones")
    .select("*")
    .eq("cotizacion_id", cotizacion_id)
    .order("version_index", { ascending: true });

  let lugares: LugarOption[] = [];
  if (_hasLugaresTable) {
    const { data } = await supabase
      .from("cotizacion_lugares")
      .select("*")
      .eq("cotizacion_id", cotizacion_id)
      .order("orden", { ascending: true });
    lugares = (data ?? []) as unknown as LugarOption[];
  }

  if (e1) throw e1;
  if (e2) throw e2;

  const versiones = await Promise.all(
    (vers ?? []).map(async (v) => {
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
        platos: (p ?? []).map((x) => ({
          plato_id: x.plato_id,
          nombre: x.platos_catalogo?.nombre || "Plato sin nombre",
          precio_unitario: Number(x.precio_unitario) || 0,
          cantidad: x.cantidad,
        })),
        transportes: (t ?? []).map((x) => ({
          transporte_id: x.transporte_id,
          lugar: x.transporte_tarifas?.lugar || "Lugar sin especificar",
          tarifa_unitaria: Number(x.tarifa_unitaria) || 0,
          cantidad: x.cantidad,
        })),
        personal: (pe ?? []).map((x) => ({
          personal_costo_id: x.personal_costo_id,
          rol: x.personal_costos_catalogo?.rol || "Rol sin especificar",
          tarifa_estimada_por_persona: Number(x.tarifa_estimada_por_persona) || 0,
          cantidad: x.cantidad,
        })),
        menaje: (me ?? []).map((x) => ({
          menaje_id: x.menaje_id,
          nombre: x.menaje_catalogo?.nombre || "Menaje sin nombre",
          precio_alquiler: Number(x.precio_alquiler) || 0,
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

  type CotRow = Cotizacion & { clientes?: unknown; cliente_contactos?: unknown };
  const cotRow = cot as unknown as CotRow;
  return {
    cotizacion: {
      ...cotRow,
      total_cotizado: Number(cotRow.total_cotizado),
      cliente: (cotRow.clientes ?? null) as Cotizacion["cliente"],
      contacto: (cotRow.cliente_contactos ?? null) as Cotizacion["contacto"],
    } as Cotizacion,
    versiones,
    lugares: (lugares ?? []).map((l) => ({
      id: l.id,
      nombre: l.nombre,
      direccion: l.direccion,
      ciudad: l.ciudad,
      capacidad_estimada: l.capacidad_estimada,
      precio_referencia: Number(l.precio_referencia ?? 0),
      notas: l.notas,
      es_seleccionado: l.es_seleccionado,
      orden: l.orden,
    })) as LugarOption[],
  };
}

/** =====================
 *   CREAR CON VERSIONES
 *  =====================
 *  Atomic: delega a la RPC `create_cotizacion_with_versions`. Todo el payload
 *  (cabecera + lugares[] + versiones[] con sus 4 tipos de items) se inserta
 *  en una única transacción — si algo falla, nada queda a medias. */
export async function createCotizacionWithVersions(
  payload: CotizacionWithVersionsDraft
): Promise<{ id: string }> {
  const rpcPayload = {
    cotizacion: {
      nombre_cotizacion: payload.cotizacion.nombre_cotizacion,
      cliente_nombre: payload.cotizacion.cliente_nombre,
      numero_invitados: payload.cotizacion.numero_invitados,
      fecha_evento_estimada: payload.cotizacion.fecha_evento_estimada
        ? payload.cotizacion.fecha_evento_estimada.toISOString().slice(0, 10)
        : null,
      ubicacion_evento: payload.cotizacion.ubicacion_evento ?? null,
      comercial_encargado: payload.cotizacion.comercial_encargado,
      total_cotizado: payload.cotizacion.total_cotizado,
      estado: payload.cotizacion.estado,
      contacto_telefono: payload.cotizacion.contacto_telefono ?? null,
      contacto_correo: payload.cotizacion.contacto_correo ?? null,
      hora_inicio: payload.cotizacion.hora_inicio ?? null,
      hora_fin: payload.cotizacion.hora_fin ?? null,
      hora_montaje_inicio: payload.cotizacion.hora_montaje_inicio ?? null,
      hora_montaje_fin: payload.cotizacion.hora_montaje_fin ?? null,
      cliente_id: payload.cotizacion.cliente_id ?? null,
      contacto_id: payload.cotizacion.contacto_id ?? null,
    },
    lugares: (payload.lugares ?? []).map((l) => ({
      nombre: l.nombre,
      direccion: l.direccion ?? null,
      ciudad: l.ciudad ?? null,
      capacidad_estimada: l.capacidad_estimada ?? null,
      precio_referencia: l.precio_referencia ?? 0,
      notas: l.notas ?? null,
      es_seleccionado: l.es_seleccionado,
    })),
    versiones: payload.versiones.map((v) => ({
      nombre_opcion: v.nombre_opcion,
      version_index: v.version_index,
      total: v.total,
      estado: v.estado,
      is_definitiva: v.is_definitiva ?? false,
      items: {
        platos: v.items.platos.map((p) => ({
          plato_id: p.plato_id,
          cantidad: p.cantidad,
          precio_unitario: p.precio_unitario,
        })),
        personal: v.items.personal.map((p) => ({
          personal_costo_id: p.personal_costo_id,
          cantidad: p.cantidad,
          tarifa_estimada_por_persona: p.tarifa_estimada_por_persona,
        })),
        transportes: v.items.transportes.map((t) => ({
          transporte_id: t.transporte_id,
          cantidad: t.cantidad,
          tarifa_unitaria: t.tarifa_unitaria,
        })),
        menaje: (v.items.menaje ?? []).map((m) => ({
          menaje_id: m.menaje_id,
          cantidad: m.cantidad,
          precio_alquiler: m.precio_alquiler,
        })),
      },
    })),
  };

  const { data, error } = await supabase.rpc("create_cotizacion_with_versions", {
    p_payload: rpcPayload,
  });
  if (error) throw error;
  if (!data) throw new Error("create_cotizacion_with_versions no devolvió id");
  return { id: data as string };
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
  items: CotizacionItemsState,
  nombre_opcion?: string
) {
  // Carga el precio del lugar seleccionado de la cotización para incluirlo en el
  // total. El lugar vive a nivel cotización (no versión), así que aplica a todas
  // las versiones por igual.
  const { data: lugares, error: lugaresError } = await supabase
    .from("cotizacion_lugares")
    .select("precio_referencia, es_seleccionado, orden")
    .eq("cotizacion_id", cotizacion_id)
    .order("orden", { ascending: true });
  if (lugaresError) throw lugaresError;
  const lugarSel =
    (lugares ?? []).find((l) => l.es_seleccionado) ?? (lugares ?? [])[0];
  const lugarPrecio = Number((lugarSel as { precio_referencia?: number } | undefined)?.precio_referencia ?? 0);

  const total =
    items.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0) +
    items.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0) +
    items.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0) +
    (items.menaje ?? []).reduce((a, m) => a + m.precio_alquiler * m.cantidad, 0) +
    lugarPrecio;

  const updateData: Record<string, unknown> = { total };
  if (nombre_opcion !== undefined) updateData.nombre_opcion = nombre_opcion;

  const { error: updateError } = await supabase
    .from("cotizacion_versiones")
    .update(updateData)
    .eq("id", version_id);
  if (updateError) throw updateError;

  // Supabase no lanza: resuelve con { error } poblado. Sin destructurar, los
  // fallos en estos deletes quedan invisibles y la re-inserción los oculta.
  const deleteResults = await Promise.all([
    supabase.from("cotizacion_platos").delete().eq("cotizacion_version_id", version_id),
    supabase.from("cotizacion_personal_items").delete().eq("cotizacion_version_id", version_id),
    supabase.from("cotizacion_transporte_items").delete().eq("cotizacion_version_id", version_id),
    supabase.from("cotizacion_menaje_items").delete().eq("cotizacion_version_id", version_id),
  ]);
  for (const r of deleteResults) {
    if (r.error) throw r.error;
  }

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
  // Atomic: la RPC crea el evento (idempotente por cotizacion_version_id) y
  // hace snapshot de platos/transporte/personal/menaje enriquecidos con
  // catálogos, todo en una transacción.
  const { data, error } = await supabase.rpc("ensure_event_from_version", {
    p_cotizacion_id: opts.cotizacion_id,
    p_cotizacion_version_id: opts.cotizacion_version_id,
    p_nombre_evento: opts.nombre_evento,
    p_fecha_evento: opts.fecha_evento,
    p_ubicacion: opts.ubicacion ?? "",
    p_descripcion: opts.descripcion ?? null,
  });
  if (error) throw error;
  if (!data) throw new Error("ensure_event_from_version no devolvió id");
  return { evento_id: data };
}

/** Leer snapshot del requerimiento de un evento (con enriquecimiento si faltan campos) */
export async function getEventoRequerimiento(evento_id: string): Promise<EventoRequerimiento> {
  // Pull linked cotización total + selected lugar. Lugares no se copian al evento
  // (no existe evento_requerimiento_lugares); se leen por join para que el evento
  // refleje siempre el total de la cotización congelada.
  const lugarPromise = supabase
    .from("eventos")
    .select(`
      cotizacion_versiones (
        cotizaciones (
          total_cotizado,
          cotizacion_lugares ( nombre, direccion, ciudad, precio_referencia, es_seleccionado, orden )
        )
      )
    `)
    .eq("id", evento_id)
    .maybeSingle();

  const [p, t, pe, m, ev] = await Promise.all([
    supabase.from("evento_requerimiento_platos").select("*").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_transporte").select("*").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_personal").select("*").eq("evento_id", evento_id),
    supabase.from("evento_requerimiento_menaje").select("*").eq("evento_id", evento_id),
    lugarPromise,
  ]);

  if (p.error) throw p.error;
  if (t.error) throw t.error;
  if (pe.error) throw pe.error;
  if (m.error) throw m.error;

  type LugarRow = {
    nombre: string;
    direccion?: string | null;
    ciudad?: string | null;
    precio_referencia?: number | null;
    es_seleccionado?: boolean;
    orden?: number;
  };
  type EvWithCot = {
    cotizacion_versiones?: {
      cotizaciones?: {
        total_cotizado?: number;
        cotizacion_lugares?: LugarRow[];
      };
    };
  };
  const cot = (ev.data as EvWithCot | null)?.cotizacion_versiones?.cotizaciones;
  const totalCotizacion = Number(cot?.total_cotizado ?? 0);
  const lugaresList: LugarRow[] = cot?.cotizacion_lugares ?? [];
  const lugarSel =
    lugaresList.find((l) => l.es_seleccionado) ??
    [...lugaresList].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0] ??
    null;
  const lugar = lugarSel
    ? {
        nombre: lugarSel.nombre,
        direccion: lugarSel.direccion ?? null,
        ciudad: lugarSel.ciudad ?? null,
        precio: Number(lugarSel.precio_referencia ?? 0),
      }
    : null;

  type MenajeRowLike = {
    menaje_id: string;
    nombre?: string;
    precio_alquiler?: number | string;
    cantidad: number;
    subtotal: number | string;
  };
  const mapMenaje = (data: MenajeRowLike[]) => (data ?? []).map((x) => ({
    menaje_id: x.menaje_id,
    nombre: x.nombre ?? "",
    precio_alquiler: Number(x.precio_alquiler) || 0,
    cantidad: x.cantidad,
    subtotal: Number(x.subtotal),
  }));

  // Si detectamos snapshot antiguo con nombres vacíos, enriquecemos en caliente y devolvemos ya enriquecido
  const needsEnrich =
    (p.data ?? []).some((x) => !x.nombre) ||
    (t.data ?? []).some((x) => !x.lugar) ||
    (pe.data ?? []).some((x) => !x.rol);

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
      platos: (p2.data ?? []).map((x) => ({
        plato_id: x.plato_id,
        nombre: x.nombre ?? "",
        precio_unitario: Number(x.precio_unitario) || 0,
        cantidad: x.cantidad,
        subtotal: Number(x.subtotal),
      })),
      transportes: (t2.data ?? []).map((x) => ({
        transporte_id: x.transporte_id,
        lugar: x.lugar ?? "",
        tarifa_unitaria: Number(x.tarifa_unitaria) || 0,
        cantidad: x.cantidad,
        subtotal: Number(x.subtotal),
      })),
      personal: (pe2.data ?? []).map((x) => ({
        personal_costo_id: x.personal_costo_id,
        rol: x.rol ?? "",
        tarifa_estimada_por_persona: Number(x.tarifa_estimada_por_persona) || 0,
        cantidad: x.cantidad,
        subtotal: Number(x.subtotal),
      })),
      menaje: mapMenaje(m.data),
      lugar,
      totalCotizacion,
    };
  }

  // Caso normal (ya está enriquecido)
  return {
    platos: (p.data ?? []).map((x) => ({
      plato_id: x.plato_id,
      nombre: x.nombre ?? "",
      precio_unitario: Number(x.precio_unitario) || 0,
      cantidad: x.cantidad,
      subtotal: Number(x.subtotal),
    })),
    transportes: (t.data ?? []).map((x) => ({
      transporte_id: x.transporte_id,
      lugar: x.lugar ?? "",
      tarifa_unitaria: Number(x.tarifa_unitaria) || 0,
      cantidad: x.cantidad,
      subtotal: Number(x.subtotal),
    })),
    personal: (pe.data ?? []).map((x) => ({
      personal_costo_id: x.personal_costo_id,
      rol: x.rol ?? "",
      tarifa_estimada_por_persona: Number(x.tarifa_estimada_por_persona) || 0,
      cantidad: x.cantidad,
      subtotal: Number(x.subtotal),
    })),
    menaje: mapMenaje(m.data),
    lugar,
    totalCotizacion,
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

  const missingPlatos = (p.data ?? []).filter((x) => !x.nombre);
  const missingTrans  = (t.data ?? []).filter((x) => !x.lugar);
  const missingPers   = (pe.data ?? []).filter((x) => !x.rol);

  if (missingPlatos.length) {
    const ids = missingPlatos.map((x) => x.plato_id);
    const { data, error } = await supabase.from("platos_catalogo").select("id,nombre").in("id", ids);
    if (error) throw error;
    const m = new Map((data ?? []).map((r) => [r.id, r.nombre]));
    const updates = await Promise.all(
      missingPlatos.map((row) =>
        supabase
          .from("evento_requerimiento_platos")
          .update({ nombre: m.get(row.plato_id) ?? "" })
          .eq("id", row.id)
      )
    );
    for (const r of updates) if (r.error) throw r.error;
  }
  if (missingTrans.length) {
    const ids = missingTrans.map((x) => x.transporte_id);
    const { data, error } = await supabase.from("transporte_tarifas").select("id,lugar").in("id", ids);
    if (error) throw error;
    const m = new Map((data ?? []).map((r) => [r.id, r.lugar]));
    const updates = await Promise.all(
      missingTrans.map((row) =>
        supabase
          .from("evento_requerimiento_transporte")
          .update({ lugar: m.get(row.transporte_id) ?? "" })
          .eq("id", row.id)
      )
    );
    for (const r of updates) if (r.error) throw r.error;
  }
  if (missingPers.length) {
    const ids = missingPers.map((x) => x.personal_costo_id);
    const { data, error } = await supabase.from("personal_costos_catalogo").select("id,rol").in("id", ids);
    if (error) throw error;
    const m = new Map((data ?? []).map((r) => [r.id, r.rol]));
    const updates = await Promise.all(
      missingPers.map((row) =>
        supabase
          .from("evento_requerimiento_personal")
          .update({ rol: m.get(row.personal_costo_id) ?? "" })
          .eq("id", row.id)
      )
    );
    for (const r of updates) if (r.error) throw r.error;
  }
}

/** =====================
 *  MARCAR DEFINITIVA
 *  ===================== */
export async function setVersionDefinitiva(cotizacion_id: string, version_id: string) {
  // Atomic: desmarca las otras versiones, marca la elegida como aprobada,
  // sincroniza el total en la cabecera y llama a ensure_event_from_version
  // internamente (mismo transaction scope).
  const { error } = await supabase.rpc("set_version_definitiva", {
    p_cotizacion_id: cotizacion_id,
    p_version_id: version_id,
  });
  if (error) throw error;
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
  return (data ?? []).map((d) => ({ ...d, costo_por_unidad: Number(d.costo_por_unidad) }));
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

  const ingredientes: PlatoIngrediente[] = (items ?? []).map((row) => ({
    id: row.id,
    plato_id: row.plato_id,
    ingrediente_id: row.ingrediente_id,
    cantidad: Number(row.cantidad),
    ingrediente: row.ingredientes_catalogo
      ? { ...row.ingredientes_catalogo, costo_por_unidad: Number(row.ingredientes_catalogo.costo_por_unidad) }
      : undefined,
  }));

  const platoRow = plato as PlatoCatalogo;
  return {
    ...platoRow,
    precio: Number(platoRow.precio),
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
  return (data ?? []).map((row) => ({
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
  if (presentacionUnidad === unidadBase) return presentacionCantidad;

  // Conversiones de peso → gr como pivot
  const pesoAGr: Record<string, number> = { gr: 1, kg: 1000, lb: 453.592, oz: 28.3495 };
  // Conversiones de volumen → ml como pivot
  const volAMl: Record<string, number> = { ml: 1, lt: 1000 };

  if (pesoAGr[presentacionUnidad] && pesoAGr[unidadBase]) {
    const enGr = presentacionCantidad * pesoAGr[presentacionUnidad];
    return enGr / pesoAGr[unidadBase];
  }

  if (volAMl[presentacionUnidad] && volAMl[unidadBase]) {
    const enMl = presentacionCantidad * volAMl[presentacionUnidad];
    return enMl / volAMl[unidadBase];
  }

  // Unidades incompatibles o und → devolver sin convertir
  return presentacionCantidad;
}

export async function getProveedoresByIngrediente(ingredienteId: string): Promise<IngredienteProveedor[]> {
  const { data, error } = await supabase
    .from("ingrediente_proveedores")
    .select("*")
    .eq("ingrediente_id", ingredienteId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((d) => ({
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
  const { error } = await supabase.rpc("fn_set_proveedor_principal", {
    p_ingrediente_id: ingredienteId,
    p_proveedor_id: proveedorId,
  });
  if (error) throw error;
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

/** =====================
 *  COTIZACIÓN LUGARES
 *  ===================== */

export async function getCotizacionLugares(cotizacion_id: string): Promise<LugarOption[]> {
  await checkMigration();
  if (!_hasLugaresTable) return [];

  const { data, error } = await supabase
    .from("cotizacion_lugares")
    .select("*")
    .eq("cotizacion_id", cotizacion_id)
    .order("orden", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((l) => ({
    id: l.id,
    nombre: l.nombre,
    direccion: l.direccion,
    ciudad: l.ciudad,
    capacidad_estimada: l.capacidad_estimada,
    precio_referencia: Number(l.precio_referencia ?? 0),
    notas: l.notas,
    es_seleccionado: l.es_seleccionado,
    orden: l.orden,
  }));
}

export async function saveCotizacionLugares(
  cotizacion_id: string,
  lugares: LugarOption[]
): Promise<void> {
  await checkMigration();
  if (!_hasLugaresTable) return;

  // Delete existing
  const { error: delErr } = await supabase
    .from("cotizacion_lugares")
    .delete()
    .eq("cotizacion_id", cotizacion_id);
  if (delErr) throw delErr;

  if (lugares.length === 0) return;

  const rows = lugares.map((l, i) => ({
    cotizacion_id,
    nombre: l.nombre,
    direccion: l.direccion || null,
    ciudad: l.ciudad || null,
    capacidad_estimada: l.capacidad_estimada || null,
    precio_referencia: l.precio_referencia || 0,
    notas: l.notas || null,
    es_seleccionado: l.es_seleccionado,
    orden: i + 1,
  }));
  const { error: insErr } = await supabase.from("cotizacion_lugares").insert(rows);
  if (insErr) throw insErr;
}

export async function setLugarSeleccionado(
  cotizacion_id: string,
  lugar_id: string
): Promise<void> {
  await checkMigration();
  if (!_hasLugaresTable) return;

  // Deselect all
  const { error: e1 } = await supabase
    .from("cotizacion_lugares")
    .update({ es_seleccionado: false })
    .eq("cotizacion_id", cotizacion_id);
  if (e1) throw e1;

  // Select the one
  const { error: e2 } = await supabase
    .from("cotizacion_lugares")
    .update({ es_seleccionado: true })
    .eq("id", lugar_id);
  if (e2) throw e2;
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
      nombre_completo: (row as { personal?: { nombre_completo?: string } }).personal?.nombre_completo ?? "",
    });
  }
  return result;
}

/** =====================
 *  PIPELINE DE VENTAS
 *  ===================== */

/** Marcar cotización como Enviada */
export async function marcarCotizacionEnviada(id: string) {
  const { error } = await supabase
    .from("cotizaciones")
    .update({ estado: "Enviada", fecha_envio: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { ok: true };
}

/** Rechazar cotización con motivo */
export async function rechazarCotizacion(id: string, motivo: string, notas: string | null) {
  const { error } = await supabase
    .from("cotizaciones")
    .update({
      estado: "Rechazada",
      motivo_rechazo: motivo,
      notas_rechazo: notas || null,
      fecha_cierre: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  return { ok: true };
}

/** Reabrir cotización rechazada */
export async function reabrirCotizacion(id: string) {
  const { error } = await supabase
    .from("cotizaciones")
    .update({
      estado: "Pendiente por Aprobación",
      motivo_rechazo: null,
      notas_rechazo: null,
      fecha_cierre: null,
    })
    .eq("id", id);
  if (error) throw error;
  return { ok: true };
}
