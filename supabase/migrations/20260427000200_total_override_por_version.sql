-- Override del precio total por versión.
-- En lugar de ajustar plato por plato, el admin puede asignar un total manual
-- a una versión completa (útil para clientes especiales: familia, amigos,
-- descuentos puntuales). Si total_override está seteado, ese es el monto que
-- se cobra y se muestra al cliente; si es NULL, se usa el total calculado
-- a partir de los items.

-- 1) Limpieza de la iteración anterior (override por línea de item).
--    Las columnas precio_override fueron agregadas en una rama exploratoria
--    que fue revertida; las dropeamos para no dejar metadata muerta.
alter table public.cotizacion_platos drop column if exists precio_override;
alter table public.cotizacion_personal_items drop column if exists precio_override;
alter table public.cotizacion_transporte_items drop column if exists precio_override;
alter table public.cotizacion_menaje_items drop column if exists precio_override;

-- 2) Columna nueva.
alter table public.cotizacion_versiones
  add column if not exists total_override numeric;

comment on column public.cotizacion_versiones.total_override
  is 'Total manual asignado por admin para esta versión. NULL = usar el total calculado desde los items.';

-- 3) Restaurar el RPC create_cotizacion_with_versions a su forma original
--    (sin override por línea). El override por versión se aplica desde el
--    frontend escribiendo directamente en cotizacion_versiones.total_override.
CREATE OR REPLACE FUNCTION public.create_cotizacion_with_versions(p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cotizacion_id uuid;
  v_cab jsonb;
  v_ver jsonb;
  v_ver_id uuid;
  v_items jsonb;
BEGIN
  v_cab := p_payload->'cotizacion';
  IF v_cab IS NULL THEN
    RAISE EXCEPTION 'Payload debe incluir "cotizacion".';
  END IF;

  INSERT INTO public.cotizaciones (
    nombre_cotizacion, cliente_nombre, numero_invitados, fecha_evento_estimada,
    ubicacion_evento, comercial_encargado, total_cotizado, estado,
    contacto_telefono, contacto_correo,
    hora_inicio, hora_fin, hora_montaje_inicio, hora_montaje_fin,
    cliente_id, contacto_id
  )
  VALUES (
    v_cab->>'nombre_cotizacion',
    v_cab->>'cliente_nombre',
    (v_cab->>'numero_invitados')::int,
    NULLIF(v_cab->>'fecha_evento_estimada', '')::date,
    NULLIF(v_cab->>'ubicacion_evento', ''),
    COALESCE(NULLIF(v_cab->>'comercial_encargado', ''), 'Sin asignar'),
    COALESCE((v_cab->>'total_cotizado')::numeric, 0),
    COALESCE(v_cab->>'estado', 'Pendiente por Aprobación'),
    NULLIF(v_cab->>'contacto_telefono', ''),
    NULLIF(v_cab->>'contacto_correo', ''),
    NULLIF(v_cab->>'hora_inicio', '')::time,
    NULLIF(v_cab->>'hora_fin', '')::time,
    NULLIF(v_cab->>'hora_montaje_inicio', '')::time,
    NULLIF(v_cab->>'hora_montaje_fin', '')::time,
    NULLIF(v_cab->>'cliente_id', '')::uuid,
    NULLIF(v_cab->>'contacto_id', '')::uuid
  )
  RETURNING id INTO v_cotizacion_id;

  INSERT INTO public.cotizacion_lugares (
    cotizacion_id, nombre, direccion, ciudad, capacidad_estimada,
    precio_referencia, notas, es_seleccionado, orden
  )
  SELECT
    v_cotizacion_id,
    l.value->>'nombre',
    NULLIF(l.value->>'direccion', ''),
    NULLIF(l.value->>'ciudad', ''),
    NULLIF(l.value->>'capacidad_estimada', '')::int,
    COALESCE((l.value->>'precio_referencia')::numeric, 0),
    NULLIF(l.value->>'notas', ''),
    COALESCE((l.value->>'es_seleccionado')::boolean, false),
    l.ordinality::int
  FROM jsonb_array_elements(COALESCE(p_payload->'lugares', '[]'::jsonb))
    WITH ORDINALITY AS l(value, ordinality);

  FOR v_ver IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'versiones', '[]'::jsonb))
  LOOP
    INSERT INTO public.cotizacion_versiones (
      cotizacion_id, nombre_opcion, version_index, total, total_override, estado, is_definitiva
    )
    VALUES (
      v_cotizacion_id,
      v_ver->>'nombre_opcion',
      (v_ver->>'version_index')::int,
      COALESCE((v_ver->>'total')::numeric, 0),
      NULLIF(v_ver->>'total_override', '')::numeric,
      COALESCE(v_ver->>'estado', 'Pendiente por Aprobación'),
      COALESCE((v_ver->>'is_definitiva')::boolean, false)
    )
    RETURNING id INTO v_ver_id;

    v_items := v_ver->'items';

    INSERT INTO public.cotizacion_platos (
      cotizacion_id, cotizacion_version_id, plato_id, cantidad, precio_unitario, subtotal
    )
    SELECT
      v_cotizacion_id, v_ver_id,
      (x->>'plato_id')::uuid,
      (x->>'cantidad')::int,
      (x->>'precio_unitario')::numeric,
      (x->>'precio_unitario')::numeric * (x->>'cantidad')::int
    FROM jsonb_array_elements(COALESCE(v_items->'platos', '[]'::jsonb)) AS x;

    INSERT INTO public.cotizacion_personal_items (
      cotizacion_id, cotizacion_version_id, personal_costo_id, cantidad,
      tarifa_estimada_por_persona, subtotal
    )
    SELECT
      v_cotizacion_id, v_ver_id,
      (x->>'personal_costo_id')::uuid,
      (x->>'cantidad')::int,
      (x->>'tarifa_estimada_por_persona')::numeric,
      (x->>'tarifa_estimada_por_persona')::numeric * (x->>'cantidad')::int
    FROM jsonb_array_elements(COALESCE(v_items->'personal', '[]'::jsonb)) AS x;

    INSERT INTO public.cotizacion_transporte_items (
      cotizacion_id, cotizacion_version_id, transporte_id, cantidad,
      tarifa_unitaria, subtotal
    )
    SELECT
      v_cotizacion_id, v_ver_id,
      (x->>'transporte_id')::uuid,
      (x->>'cantidad')::int,
      (x->>'tarifa_unitaria')::numeric,
      (x->>'tarifa_unitaria')::numeric * (x->>'cantidad')::int
    FROM jsonb_array_elements(COALESCE(v_items->'transportes', '[]'::jsonb)) AS x;

    INSERT INTO public.cotizacion_menaje_items (
      cotizacion_id, cotizacion_version_id, menaje_id, cantidad,
      precio_alquiler, subtotal
    )
    SELECT
      v_cotizacion_id, v_ver_id,
      (x->>'menaje_id')::uuid,
      (x->>'cantidad')::int,
      (x->>'precio_alquiler')::numeric,
      (x->>'precio_alquiler')::numeric * (x->>'cantidad')::int
    FROM jsonb_array_elements(COALESCE(v_items->'menaje', '[]'::jsonb)) AS x;
  END LOOP;

  RETURN v_cotizacion_id;
END;
$function$;
