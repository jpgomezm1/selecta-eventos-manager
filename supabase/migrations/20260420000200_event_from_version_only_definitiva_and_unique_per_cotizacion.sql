-- A) Borrar el único evento huérfano en DB (Matrimonio Prueba #1, Segunda Opcion
--    que no es definitiva). Sin ops — las FKs CASCADE limpian las 2 filas
--    de evento_requerimiento_* asociadas.
--
-- B) Hardening de ensure_event_from_version: aplica la regla de negocio
--    "una cotización tiene un solo evento, vinculado a su versión definitiva".
--
--    Cambios vs versión previa:
--    - Idempotencia a nivel cotización (no solo versión): si ya hay un evento
--      para cualquier versión de la cotización, devolverlo.
--    - Guard: si no hay evento previo, exige que la versión pasada sea
--      is_definitiva=true. Evita crear eventos "fantasma" desde versiones
--      no-aprobadas.
--
-- Aplicado vía mcp__supabase__apply_migration el 2026-04-20.

DELETE FROM public.eventos WHERE id = 'cfa6400c-950e-44e4-9671-0ea8ab9c34ce';

CREATE OR REPLACE FUNCTION public.ensure_event_from_version(
  p_cotizacion_id uuid,
  p_cotizacion_version_id uuid,
  p_nombre_evento text,
  p_fecha_evento date,
  p_ubicacion text,
  p_descripcion text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_evento_id uuid;
  v_is_definitiva boolean;
BEGIN
  -- 1) Idempotencia a nivel cotización: si ya existe un evento para
  --    cualquier versión de esta cotización, devolverlo sin crear otro.
  SELECT e.id INTO v_evento_id
  FROM public.eventos e
  JOIN public.cotizacion_versiones cv ON cv.id = e.cotizacion_version_id
  WHERE cv.cotizacion_id = p_cotizacion_id
  ORDER BY e.created_at ASC
  LIMIT 1;

  IF v_evento_id IS NOT NULL THEN
    RETURN v_evento_id;
  END IF;

  -- 2) Guard: no hay evento previo. Solo permitir crearlo si la versión
  --    que se está convirtiendo es la definitiva.
  SELECT is_definitiva INTO v_is_definitiva
  FROM public.cotizacion_versiones
  WHERE id = p_cotizacion_version_id;

  IF v_is_definitiva IS DISTINCT FROM true THEN
    RAISE EXCEPTION
      'No se puede crear evento desde una versión que no es definitiva (version_id=%)',
      p_cotizacion_version_id;
  END IF;

  -- 3) Crear evento + snapshots.
  INSERT INTO public.eventos (nombre_evento, ubicacion, fecha_evento, descripcion, cotizacion_version_id)
  VALUES (
    p_nombre_evento,
    COALESCE(p_ubicacion, ''),
    COALESCE(p_fecha_evento, CURRENT_DATE),
    p_descripcion,
    p_cotizacion_version_id
  )
  RETURNING id INTO v_evento_id;

  INSERT INTO public.evento_requerimiento_platos (
    evento_id, plato_id, nombre, precio_unitario, cantidad, subtotal
  )
  SELECT
    v_evento_id,
    cp.plato_id,
    COALESCE(pc.nombre, ''),
    COALESCE(cp.precio_unitario, 0)::numeric,
    cp.cantidad,
    COALESCE(cp.subtotal, 0)::numeric
  FROM public.cotizacion_platos cp
  LEFT JOIN public.platos_catalogo pc ON pc.id = cp.plato_id
  WHERE cp.cotizacion_version_id = p_cotizacion_version_id;

  INSERT INTO public.evento_requerimiento_transporte (
    evento_id, transporte_id, lugar, tarifa_unitaria, cantidad, subtotal
  )
  SELECT
    v_evento_id,
    ct.transporte_id,
    COALESCE(tt.lugar, ''),
    COALESCE(ct.tarifa_unitaria, 0)::numeric,
    ct.cantidad,
    COALESCE(ct.subtotal, 0)::numeric
  FROM public.cotizacion_transporte_items ct
  LEFT JOIN public.transporte_tarifas tt ON tt.id = ct.transporte_id
  WHERE ct.cotizacion_version_id = p_cotizacion_version_id;

  INSERT INTO public.evento_requerimiento_personal (
    evento_id, personal_costo_id, rol, tarifa_estimada_por_persona, cantidad, subtotal
  )
  SELECT
    v_evento_id,
    cpi.personal_costo_id,
    COALESCE(pcc.rol, ''),
    COALESCE(cpi.tarifa_estimada_por_persona, 0),
    cpi.cantidad,
    COALESCE(cpi.subtotal, 0)
  FROM public.cotizacion_personal_items cpi
  LEFT JOIN public.personal_costos_catalogo pcc ON pcc.id = cpi.personal_costo_id
  WHERE cpi.cotizacion_version_id = p_cotizacion_version_id;

  INSERT INTO public.evento_requerimiento_menaje (
    evento_id, menaje_id, nombre, precio_alquiler, cantidad, subtotal
  )
  SELECT
    v_evento_id,
    cmi.menaje_id,
    COALESCE(mc.nombre, ''),
    COALESCE(cmi.precio_alquiler, 0),
    cmi.cantidad,
    COALESCE(cmi.precio_alquiler, 0) * cmi.cantidad
  FROM public.cotizacion_menaje_items cmi
  LEFT JOIN public.menaje_catalogo mc ON mc.id = cmi.menaje_id
  WHERE cmi.cotizacion_version_id = p_cotizacion_version_id;

  RETURN v_evento_id;
END;
$function$;
