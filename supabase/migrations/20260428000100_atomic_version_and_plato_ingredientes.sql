-- RPCs atómicos para cerrar dos windows de inconsistencia detectados en la
-- auditoría de apiCotizador.ts (2026-04-28):
--
-- 1) `updateVersionCotizacion` hacía UPDATE de la versión + DELETE en paralelo
--    de 4 tablas hijo + INSERT de nuevos items, sin transacción. Si fallaba
--    a mitad, la versión quedaba sin items o con items mezclados.
--
-- 2) `upsertPlatoIngredientes` hacía DELETE + INSERT secuencial. Si el INSERT
--    fallaba, el plato quedaba sin ingredientes (cálculo de costos roto).
--
-- Mismo patrón que `fn_inventario_movimiento_create_atomic` y
-- `create_ingrediente_with_proveedor`: payload jsonb, validaciones con
-- errcode '22023', security invoker (RLS aplica).

-- ============================================================
-- 1) fn_update_version_cotizacion_atomic
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

grant execute on function public.fn_update_version_cotizacion_atomic(jsonb) to authenticated;

comment on function public.fn_update_version_cotizacion_atomic(jsonb)
  is 'RPC atómico: UPDATE de cotizacion_versiones + DELETE/INSERT de los 4 tipos de items en una sola transacción. Reemplaza el patrón viejo de 6 round-trips paralelos en apiCotizador.updateVersionCotizacion.';

-- ============================================================
-- 2) fn_upsert_plato_ingredientes_atomic
-- ============================================================
create or replace function public.fn_upsert_plato_ingredientes_atomic(
  p_plato_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_plato_id is null then
    raise exception '"p_plato_id" es obligatorio'
      using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) != 'array' then
    raise exception '"p_items" debe ser un array (puede ser vacío)'
      using errcode = '22023';
  end if;

  -- DELETE + INSERT en la misma transacción. Si el INSERT falla
  -- (ej. ingrediente_id inválido), el DELETE se revierte y el plato
  -- conserva sus ingredientes originales.
  delete from public.plato_ingredientes where plato_id = p_plato_id;

  if jsonb_array_length(p_items) > 0 then
    insert into public.plato_ingredientes (plato_id, ingrediente_id, cantidad)
    select
      p_plato_id,
      (x->>'ingrediente_id')::uuid,
      (x->>'cantidad')::numeric
    from jsonb_array_elements(p_items) as x;
  end if;
end;
$$;

grant execute on function public.fn_upsert_plato_ingredientes_atomic(uuid, jsonb) to authenticated;

comment on function public.fn_upsert_plato_ingredientes_atomic(uuid, jsonb)
  is 'RPC atómico: borra todos los ingredientes del plato y reinserta los nuevos en una sola transacción. Si el INSERT falla, el plato conserva sus ingredientes originales (no quedará huérfano).';
