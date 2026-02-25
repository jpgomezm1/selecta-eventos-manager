import { supabase } from "@/integrations/supabase/client";
import type {
  Cotizacion,
  CotizacionVersion,
  CotizacionItemsState,
  LugarOption,
} from "@/types/cotizador";

export interface ShareToken {
  id: string;
  cotizacion_id: string;
  token: string;
  created_by: string | null;
  created_at: string;
  is_active: boolean;
}

/** Get the active share token for a cotizacion (if any) */
export async function getShareToken(cotizacionId: string): Promise<ShareToken | null> {
  const { data, error } = await supabase
    .from("cotizacion_share_tokens")
    .select("*")
    .eq("cotizacion_id", cotizacionId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data as ShareToken | null;
}

/** Create a share token (or return existing active one) */
export async function createShareToken(cotizacionId: string): Promise<{ token: string; url: string }> {
  // Check if one already exists
  const existing = await getShareToken(cotizacionId);
  if (existing) {
    return {
      token: existing.token,
      url: `${window.location.origin}/compartido/${existing.token}`,
    };
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("cotizacion_share_tokens")
    .insert({
      cotizacion_id: cotizacionId,
      created_by: user?.id ?? null,
    })
    .select("token")
    .single();
  if (error) throw error;

  return {
    token: data.token,
    url: `${window.location.origin}/compartido/${data.token}`,
  };
}

/** Deactivate a share token */
export async function deactivateShareToken(tokenId: string): Promise<void> {
  const { error } = await supabase
    .from("cotizacion_share_tokens")
    .update({ is_active: false })
    .eq("id", tokenId);
  if (error) throw error;
}

/** Fetch full cotizacion data using a public share token (no auth required) */
export async function getCotizacionByShareToken(token: string): Promise<{
  cotizacion: Cotizacion;
  versiones: Array<CotizacionVersion & { items: CotizacionItemsState }>;
  lugares: LugarOption[];
} | null> {
  // 1. Validate token and get cotizacion_id
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("cotizacion_share_tokens")
    .select("cotizacion_id")
    .eq("token", token)
    .eq("is_active", true)
    .maybeSingle();

  if (tokenErr || !tokenRow) return null;

  const cotizacion_id = tokenRow.cotizacion_id;

  // 2. Fetch cotizacion with optional joins
  let cot: any = null;
  // Try with client join first
  try {
    const { data, error } = await supabase
      .from("cotizaciones")
      .select("*, clientes(nombre, empresa, telefono, correo, tipo, cedula), cliente_contactos(nombre, cargo, telefono, correo)")
      .eq("id", cotizacion_id)
      .single();
    if (!error) cot = data;
  } catch {}

  // Fallback without joins
  if (!cot) {
    const { data, error } = await supabase
      .from("cotizaciones")
      .select("*")
      .eq("id", cotizacion_id)
      .single();
    if (error || !data) return null;
    cot = data;
  }

  // 3. Fetch versions
  const { data: vers, error: versErr } = await supabase
    .from("cotizacion_versiones")
    .select("*")
    .eq("cotizacion_id", cotizacion_id)
    .order("version_index", { ascending: true });
  if (versErr) return null;

  // 4. Fetch lugares
  let lugares: any[] = [];
  try {
    const { data } = await supabase
      .from("cotizacion_lugares")
      .select("*")
      .eq("cotizacion_id", cotizacion_id)
      .order("orden", { ascending: true });
    lugares = data ?? [];
  } catch {}

  // 5. Fetch items for each version (same logic as getCotizacionDetalle)
  const versiones = await Promise.all(
    (vers ?? []).map(async (v: any) => {
      const [{ data: p }, { data: t }, { data: pe }, { data: me }] = await Promise.all([
        supabase
          .from("cotizacion_platos")
          .select("*, platos_catalogo(nombre)")
          .eq("cotizacion_version_id", v.id),
        supabase
          .from("cotizacion_transporte_items")
          .select("*, transporte_tarifas(lugar)")
          .eq("cotizacion_version_id", v.id),
        supabase
          .from("cotizacion_personal_items")
          .select("*, personal_costos_catalogo(rol)")
          .eq("cotizacion_version_id", v.id),
        supabase
          .from("cotizacion_menaje_items")
          .select("*, menaje_catalogo(nombre)")
          .eq("cotizacion_version_id", v.id),
      ]);

      const items: CotizacionItemsState = {
        platos: (p ?? []).map((x: any) => ({
          plato_id: x.plato_id,
          nombre: x.platos_catalogo?.nombre || "Plato sin nombre",
          precio_unitario: Number(x.precio_unitario) || 0,
          cantidad: x.cantidad,
        })),
        transportes: (t ?? []).map((x: any) => ({
          transporte_id: x.transporte_id,
          lugar: x.transporte_tarifas?.lugar || "Lugar sin especificar",
          tarifa_unitaria: Number(x.tarifa_unitaria) || 0,
          cantidad: x.cantidad,
        })),
        personal: (pe ?? []).map((x: any) => ({
          personal_costo_id: x.personal_costo_id,
          rol: x.personal_costos_catalogo?.rol || "Rol sin especificar",
          tarifa_estimada_por_persona: Number(x.tarifa_estimada_por_persona) || 0,
          cantidad: x.cantidad,
        })),
        menaje: (me ?? []).map((x: any) => ({
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

  return {
    cotizacion: {
      ...(cot as any),
      total_cotizado: Number(cot.total_cotizado),
      cliente: cot.clientes ?? null,
      contacto: cot.cliente_contactos ?? null,
    } as Cotizacion,
    versiones,
    lugares: (lugares ?? []).map((l: any) => ({
      id: l.id,
      nombre: l.nombre,
      direccion: l.direccion,
      ciudad: l.ciudad,
      capacidad_estimada: l.capacidad_estimada,
      precio_referencia: l.precio_referencia ?? 0,
      notas: l.notas,
      es_seleccionado: l.es_seleccionado,
      orden: l.orden,
    })) as LugarOption[],
  };
}
