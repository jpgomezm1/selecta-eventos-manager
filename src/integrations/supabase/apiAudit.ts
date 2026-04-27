import { supabase } from "./client";

export type AuditEntry = {
  id: string;
  cotizacion_id: string | null;
  cotizacion_version_id: string | null;
  table_name: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_at: string;
};

export async function listCotizacionAudit(cotizacionId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc("list_cotizacion_audit", {
    p_cotizacion_id: cotizacionId,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    cotizacion_id: row.cotizacion_id,
    cotizacion_version_id: row.cotizacion_version_id,
    table_name: row.table_name,
    field: row.field,
    old_value: row.old_value,
    new_value: row.new_value,
    changed_by: row.changed_by,
    changed_by_email: row.changed_by_email,
    changed_at: row.changed_at,
  }));
}
