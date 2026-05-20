-- Hardening de seguridad: cierre de hallazgos H10, H11, H12 del walk 2026-05-11.
--
-- H10 — RLS policies con USING(true) en cotizacion_lugares, cotizacion_personal_items
--       y cotizacion_versiones. Las 2 últimas ya tienen policies por rol; basta
--       dropear la "true". Para cotizacion_lugares no había policies por rol —
--       se agregan siguiendo el patrón de cotizacion_versiones.
--
-- H11 — Revoke EXECUTE de los trigger functions (trg_audit_*) y log_cotizacion_change
--       para anon/public. Las funciones siguen ejecutándose como SECURITY DEFINER
--       cuando los triggers las invocan; solo se cierra el path /rest/v1/rpc.
--
-- H12 — SET search_path = public, pg_temp en 13 funciones legacy del baseline.
--       Hardening contra hijacking via funciones homónimas en otro schema.
--
-- H9 (view v_menaje_reservas_cal SECURITY DEFINER) ya está resuelto: la view
-- tiene security_invoker=true en reloptions. No requiere acción.

-- =========================================================================
-- H10 — Cierre de RLS permisivas
-- =========================================================================

-- 1. cotizacion_versiones: ya tiene 4 policies por rol; solo dropeamos la "true".
DROP POLICY IF EXISTS "Cotizacion versiones accesibles para autenticados"
  ON public.cotizacion_versiones;

-- 2. cotizacion_personal_items: ya tiene 4 policies por rol; solo dropeamos la "true".
DROP POLICY IF EXISTS "Items de cotizacion (personal) accesibles"
  ON public.cotizacion_personal_items;

-- 3. cotizacion_lugares: no había policies por rol. Creamos las 4 antes de
--    dropear la permisiva para no dejar la tabla inaccesible ni siquiera por
--    un instante a operaciones en vuelo.
CREATE POLICY "cotizacion_lugares: rol select"
  ON public.cotizacion_lugares
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('admin'::public.user_role)
    OR public.has_role('comercial'::public.user_role)
    OR public.has_role('operaciones'::public.user_role)
  );

CREATE POLICY "cotizacion_lugares: rol insert"
  ON public.cotizacion_lugares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('admin'::public.user_role)
    OR public.has_role('comercial'::public.user_role)
  );

CREATE POLICY "cotizacion_lugares: rol update"
  ON public.cotizacion_lugares
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role('admin'::public.user_role)
    OR public.has_role('comercial'::public.user_role)
  )
  WITH CHECK (
    public.has_role('admin'::public.user_role)
    OR public.has_role('comercial'::public.user_role)
  );

CREATE POLICY "cotizacion_lugares: rol delete"
  ON public.cotizacion_lugares
  FOR DELETE
  TO authenticated
  USING (
    public.has_role('admin'::public.user_role)
    OR public.has_role('comercial'::public.user_role)
  );

DROP POLICY IF EXISTS "Auth CRUD on cotizacion_lugares"
  ON public.cotizacion_lugares;

-- =========================================================================
-- H11 — Cerrar RPC paths de triggers internos y audit-log writer
-- =========================================================================

REVOKE EXECUTE ON FUNCTION public.trg_audit_cotizacion()
  FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.trg_audit_cotizacion_version()
  FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.trg_audit_cotizacion_version_insert()
  FROM anon, authenticated, public;

-- log_cotizacion_change solo lo usan los triggers (que se ejecutan como SECURITY
-- DEFINER del propio trigger function). Cerramos el path PostgREST a anon/public;
-- authenticated lo dejamos porque algún flujo del frontend podría llamarlo
-- directamente (audit log de cambios manuales). Si se confirma que no, también
-- se puede revocar de authenticated en una próxima migration.
REVOKE EXECUTE ON FUNCTION public.log_cotizacion_change(
  p_table text, p_cotizacion_id uuid, p_version_id uuid,
  p_field text, p_old jsonb, p_new jsonb
) FROM anon, public;

-- =========================================================================
-- H12 — search_path inmutable en funciones legacy
-- =========================================================================

ALTER FUNCTION public.update_updated_at_column()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_updated_at()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_updated_at_menaje_mov()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_updated_at_menaje_reservas()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.set_updated_at_transporte_orden()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.sync_evento_ubicacion()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.apply_merma_on_confirm()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_comprobante_number()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_menaje_disponible(_inicio date, _fin date)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_set_proveedor_principal(p_ingrediente_id uuid, p_proveedor_id uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_inventario_movimiento_confirmar(uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_inventario_movimiento_delete_con_reversa(uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.cotizacion_has_active_share(uuid)
  SET search_path = public, pg_temp;
