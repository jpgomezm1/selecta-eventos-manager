-- Fix: cotizaciones.total_cotizado ignoraba total_override (auditoría 2026-07-15).
--
-- Síntoma: la vista pública y el PDF muestran el override del admin, pero la
-- cabecera (pipeline, listados, monto del evento, balance de cierre) se quedaba
-- con el total calculado — dos precios distintos para la misma cotización, y la
-- "Diferencia" del cierre distorsionada en (total calculado − override).
--
-- Cambios:
--   1) set_version_definitiva: la cabecera toma coalesce(total_override, total).
--   2) fn_update_version_cotizacion_atomic: si la versión editada es la
--      definitiva (cotización ya aprobada), re-sincroniza la cabecera en la
--      misma transacción — antes, editar después de aprobar dejaba la cabecera
--      congelada incluso para cambios de total.
--
-- Los triggers trg_audit_* ya registran cambios de total_cotizado, así que el
-- re-sync queda auditado sin trabajo extra.
--
-- Aplicar a mano en el SQL Editor de Supabase.

-- ============================================================
-- 1) set_version_definitiva — cabecera con total efectivo
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_version_definitiva(
  p_cotizacion_id uuid,
  p_version_id uuid
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_total numeric;
  v_nombre text;
  v_fecha date;
  v_ubicacion_cotizacion text;
  v_lugar_nombre text;
  v_lugar_direccion text;
  v_lugar_ciudad text;
  v_ubicacion text;
  v_existing_def_id uuid;
BEGIN
  -- 0) Guard: si ya hay una versión definitiva para esta cotización,
  --    solo permitir si es la misma que se está "reafirmando".
  SELECT id INTO v_existing_def_id
  FROM public.cotizacion_versiones
  WHERE cotizacion_id = p_cotizacion_id AND is_definitiva = true
  LIMIT 1;

  IF v_existing_def_id IS NOT NULL AND v_existing_def_id <> p_version_id THEN
    RAISE EXCEPTION
      'La cotización % ya tiene una versión definitiva (%). No se puede cambiar a otra versión.',
      p_cotizacion_id, v_existing_def_id;
  END IF;

  -- 1) desmarcar todas
  UPDATE public.cotizacion_versiones
  SET is_definitiva = false
  WHERE cotizacion_id = p_cotizacion_id;

  -- 2) marcar seleccionada. El total efectivo es el override del admin si
  --    existe; si no, el calculado — lo mismo que ven el cliente (vista
  --    pública) y el PDF.
  UPDATE public.cotizacion_versiones
  SET is_definitiva = true, estado = 'Cotización Aprobada'
  WHERE id = p_version_id
  RETURNING COALESCE(total_override, total) INTO v_total;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'Versión % no existe o no pertenece a la cotización %', p_version_id, p_cotizacion_id;
  END IF;

  -- 3) sincronizar cabecera
  UPDATE public.cotizaciones
  SET total_cotizado = v_total,
      estado = 'Cotización Aprobada',
      fecha_cierre = now()
  WHERE id = p_cotizacion_id;

  -- 4) leer datos para armar evento
  SELECT nombre_cotizacion, fecha_evento_estimada, ubicacion_evento
  INTO v_nombre, v_fecha, v_ubicacion_cotizacion
  FROM public.cotizaciones
  WHERE id = p_cotizacion_id;

  -- 5) lugar seleccionado (si existe)
  SELECT nombre, direccion, ciudad
  INTO v_lugar_nombre, v_lugar_direccion, v_lugar_ciudad
  FROM public.cotizacion_lugares
  WHERE cotizacion_id = p_cotizacion_id AND es_seleccionado = true
  LIMIT 1;

  IF v_lugar_nombre IS NOT NULL THEN
    v_ubicacion := concat_ws(', ',
      NULLIF(v_lugar_nombre, ''),
      NULLIF(v_lugar_direccion, ''),
      NULLIF(v_lugar_ciudad, '')
    );
  ELSE
    v_ubicacion := COALESCE(v_ubicacion_cotizacion, '');
  END IF;

  -- 6) crear evento (si no existe) + snapshots. La guard interna de
  --    ensure_event_from_version verifica is_definitiva y devuelve el evento
  --    existente si ya hay uno para la cotización.
  PERFORM public.ensure_event_from_version(
    p_cotizacion_id,
    p_version_id,
    v_nombre,
    v_fecha,
    v_ubicacion,
    NULL
  );
END;
$function$;

-- ============================================================
-- 2) fn_update_version_cotizacion_atomic — re-sync de cabecera
--    cuando se edita la versión definitiva
-- ============================================================
create or replace function public.fn_update_version_cotizacion_atomic(
  p_payload jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cotizacion_id uuid;
  v_version_id uuid;
  v_total numeric;
  v_items jsonb;
begin
  -- Validar payload.
  v_cotizacion_id := nullif(p_payload->>'cotizacion_id', '')::uuid;
  v_version_id := nullif(p_payload->>'version_id', '')::uuid;
  if v_cotizacion_id is null or v_version_id is null then
    raise exception 'Payload requiere "cotizacion_id" y "version_id"'
      using errcode = '22023';
  end if;

  v_total := coalesce((p_payload->>'total')::numeric, 0);
  v_items := p_payload->'items';
  if v_items is null or jsonb_typeof(v_items) != 'object' then
    raise exception 'Payload requiere "items" como objeto con platos/personal/transportes/menaje'
      using errcode = '22023';
  end if;

  -- 1) UPDATE de la cabecera de versión.
  --    `nombre_opcion` y `total_override` son opcionales: si la key existe en el
  --    payload, se setea (incluso a NULL); si la key no existe, no se toca.
  if (p_payload ? 'nombre_opcion') and (p_payload ? 'total_override') then
    update public.cotizacion_versiones
    set total = v_total,
        nombre_opcion = p_payload->>'nombre_opcion',
        total_override = nullif(p_payload->>'total_override', '')::numeric
    where id = v_version_id and cotizacion_id = v_cotizacion_id;
  elsif p_payload ? 'nombre_opcion' then
    update public.cotizacion_versiones
    set total = v_total,
        nombre_opcion = p_payload->>'nombre_opcion'
    where id = v_version_id and cotizacion_id = v_cotizacion_id;
  elsif p_payload ? 'total_override' then
    update public.cotizacion_versiones
    set total = v_total,
        total_override = nullif(p_payload->>'total_override', '')::numeric
    where id = v_version_id and cotizacion_id = v_cotizacion_id;
  else
    update public.cotizacion_versiones
    set total = v_total
    where id = v_version_id and cotizacion_id = v_cotizacion_id;
  end if;

  if not found then
    raise exception 'Versión % no existe en cotización %', v_version_id, v_cotizacion_id
      using errcode = '22023';
  end if;

  -- 1b) Si esta versión es la definitiva, la cabecera debe seguir el total
  --     efectivo (override si existe, calculado si no). Antes de esto, editar
  --     una versión ya aprobada dejaba total_cotizado congelado al valor del
  --     momento de la aprobación.
  update public.cotizaciones c
  set total_cotizado = coalesce(v.total_override, v.total)
  from public.cotizacion_versiones v
  where v.id = v_version_id
    and v.cotizacion_id = v_cotizacion_id
    and v.is_definitiva = true
    and c.id = v_cotizacion_id;

  -- 2) DELETE de items existentes en las 4 tablas hijo.
  --    En la misma transacción, así que un rollback restaura todo.
  delete from public.cotizacion_platos where cotizacion_version_id = v_version_id;
  delete from public.cotizacion_personal_items where cotizacion_version_id = v_version_id;
  delete from public.cotizacion_transporte_items where cotizacion_version_id = v_version_id;
  delete from public.cotizacion_menaje_items where cotizacion_version_id = v_version_id;

  -- 3) INSERT de nuevos items desde el payload.
  insert into public.cotizacion_platos (
    cotizacion_id, cotizacion_version_id, plato_id, cantidad, precio_unitario, subtotal
  )
  select
    v_cotizacion_id, v_version_id,
    (x->>'plato_id')::uuid,
    (x->>'cantidad')::int,
    (x->>'precio_unitario')::numeric,
    (x->>'precio_unitario')::numeric * (x->>'cantidad')::int
  from jsonb_array_elements(coalesce(v_items->'platos', '[]'::jsonb)) as x;

  insert into public.cotizacion_personal_items (
    cotizacion_id, cotizacion_version_id, personal_costo_id, cantidad,
    tarifa_estimada_por_persona, subtotal
  )
  select
    v_cotizacion_id, v_version_id,
    (x->>'personal_costo_id')::uuid,
    (x->>'cantidad')::int,
    (x->>'tarifa_estimada_por_persona')::numeric,
    (x->>'tarifa_estimada_por_persona')::numeric * (x->>'cantidad')::int
  from jsonb_array_elements(coalesce(v_items->'personal', '[]'::jsonb)) as x;

  insert into public.cotizacion_transporte_items (
    cotizacion_id, cotizacion_version_id, transporte_id, cantidad,
    tarifa_unitaria, subtotal
  )
  select
    v_cotizacion_id, v_version_id,
    (x->>'transporte_id')::uuid,
    (x->>'cantidad')::int,
    (x->>'tarifa_unitaria')::numeric,
    (x->>'tarifa_unitaria')::numeric * (x->>'cantidad')::int
  from jsonb_array_elements(coalesce(v_items->'transportes', '[]'::jsonb)) as x;

  insert into public.cotizacion_menaje_items (
    cotizacion_id, cotizacion_version_id, menaje_id, cantidad,
    precio_alquiler, subtotal
  )
  select
    v_cotizacion_id, v_version_id,
    (x->>'menaje_id')::uuid,
    (x->>'cantidad')::int,
    (x->>'precio_alquiler')::numeric,
    (x->>'precio_alquiler')::numeric * (x->>'cantidad')::int
  from jsonb_array_elements(coalesce(v_items->'menaje', '[]'::jsonb)) as x;
end;
$$;

-- ============================================================
-- 3) Backfill: cabeceras ya aprobadas cuya versión definitiva
--    tiene override — alinear con el total efectivo
-- ============================================================
update public.cotizaciones c
set total_cotizado = coalesce(v.total_override, v.total)
from public.cotizacion_versiones v
where v.cotizacion_id = c.id
  and v.is_definitiva = true
  and c.total_cotizado is distinct from coalesce(v.total_override, v.total);
