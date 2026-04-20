-- Hardening de set_version_definitiva: bloquea re-aprobar una cotización que
-- ya tiene una versión definitiva distinta. Regla de negocio: "una cotización
-- se aprueba una sola vez; después de aprobada, no se puede cambiar a otra
-- versión" (hablado con el usuario el 2026-04-20).
--
-- Idempotente cuando p_version_id == versión ya definitiva (no falla, no re-crea
-- evento, sale silencioso).
--
-- Aplicado vía mcp__supabase__apply_migration el 2026-04-20.

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

  -- 2) marcar seleccionada
  UPDATE public.cotizacion_versiones
  SET is_definitiva = true, estado = 'Cotización Aprobada'
  WHERE id = p_version_id
  RETURNING total INTO v_total;

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
