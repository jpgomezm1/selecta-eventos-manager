-- Insumos en /carga/:token: crear insumos nuevos y manejar varios proveedores.
--
-- La primera versión asumía un proveedor por insumo y un catálogo cerrado: la
-- grilla solo dejaba completar el costo de lo que ya existía. `ingrediente_
-- proveedores` siempre soportó varios por insumo (con `es_principal` marcando
-- cuál define el costo vigente), pero nadie lo estaba usando — 16 insumos con
-- proveedor, ninguno con dos.
--
-- Por qué no se reusan las RPC que ya existen:
--   - create_ingrediente_with_proveedor exige has_role('admin'|'cocina'), y
--     quien abre /carga no tiene sesión. El insert va en línea acá.
--   - fn_set_proveedor_principal no tiene guard de rol y es SECURITY INVOKER,
--     así que sí se reusa: adentro de estas funciones corre como owner.
--
-- Crear insumos desde una página pública tiene un riesgo conocido, y es el
-- mismo que llevó al importador de Excel a NO crear ingredientes: un typo
-- ("Aceite Girasol" vs "Aceite de girasol") ensucia el catálogo con duplicados
-- que después rompen el costeo de los platos. Acá se ataca en dos capas — el
-- SQL rechaza el nombre exacto repetido, y la UI avisa antes de crear si hay
-- uno parecido.

-- =========================================================================
-- 1) Lectura: ahora con TODOS los proveedores de cada insumo
-- =========================================================================

create or replace function public.fn_carga_publica_datos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_out jsonb;
begin
  perform public.fn_carga_token_id(p_token);

  select jsonb_build_object(

    'ingredientes', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'nombre', i.nombre,
          'unidad', i.unidad,
          'costo_por_unidad', i.costo_por_unidad,
          'proveedores', coalesce(pv.lista, '[]'::jsonb)
        ) order by i.nombre
      ), '[]'::jsonb)
      from public.ingredientes_catalogo i
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'proveedor', p.proveedor,
            'presentacion_cantidad', p.presentacion_cantidad,
            'presentacion_unidad', p.presentacion_unidad,
            'precio_presentacion', p.precio_presentacion,
            'costo_por_unidad_base', p.costo_por_unidad_base,
            'es_principal', coalesce(p.es_principal, false)
          )
          -- El principal primero: es el que define el costo vigente y el que
          -- la pantalla muestra arriba.
          order by coalesce(p.es_principal, false) desc, p.proveedor
        ) as lista
        from public.ingrediente_proveedores p
        where p.ingrediente_id = i.id
      ) pv on true
    ),

    'platos', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', pl.id,
          'nombre', pl.nombre,
          'categoria', pl.categoria,
          'precio', pl.precio,
          'sin_insumos', pl.sin_insumos,
          'items', coalesce(it.items, '[]'::jsonb)
        ) order by pl.nombre
      ), '[]'::jsonb)
      from public.platos_catalogo pl
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'ingrediente_id', pi.ingrediente_id,
            'cantidad', pi.cantidad
          )
        ) as items
        from public.plato_ingredientes pi
        where pi.plato_id = pl.id
      ) it on true
    ),

    'menaje', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'nombre', m.nombre,
          'categoria', m.categoria,
          'unidad', m.unidad,
          'stock_total', m.stock_total,
          'precio_alquiler', m.precio_alquiler
        ) order by m.categoria, m.nombre
      ), '[]'::jsonb)
      from public.menaje_catalogo m
      where m.activo
    )

  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.fn_carga_publica_datos(text) from public;
grant execute on function public.fn_carga_publica_datos(text) to anon, authenticated;

-- =========================================================================
-- 2) Crear un insumo nuevo
-- =========================================================================

create or replace function public.fn_carga_publica_insumo_crear(
  p_token  text,
  p_nombre text,
  p_unidad text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nombre text := btrim(p_nombre);
  v_unidad text := lower(btrim(p_unidad));
  v_id     uuid;
  v_previo text;
begin
  perform public.fn_carga_token_id(p_token);

  if v_nombre is null or v_nombre = '' then
    raise exception 'El nombre del insumo es obligatorio' using errcode = '22023';
  end if;
  if length(v_nombre) > 120 then
    raise exception 'El nombre es demasiado largo' using errcode = '22023';
  end if;
  -- Mismas siete que ofrece el alta manual en la app (IngredientesTable).
  if v_unidad not in ('gr', 'kg', 'lb', 'oz', 'ml', 'lt', 'und') then
    raise exception 'Unidad no válida: %', p_unidad using errcode = '22023';
  end if;

  select nombre into v_previo
  from public.ingredientes_catalogo
  where lower(btrim(nombre)) = lower(v_nombre)
  limit 1;

  if v_previo is not null then
    raise exception '"%" ya existe en el recetario', v_previo
      using errcode = '22023';
  end if;

  insert into public.ingredientes_catalogo (nombre, unidad, costo_por_unidad)
  values (v_nombre, v_unidad, 0)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'nombre', v_nombre, 'unidad', v_unidad);
end;
$$;

revoke all on function public.fn_carga_publica_insumo_crear(text, text, text) from public;
grant execute on function public.fn_carga_publica_insumo_crear(text, text, text) to anon, authenticated;

-- =========================================================================
-- 3) Guardar un proveedor (alta o edición)
-- =========================================================================

create or replace function public.fn_carga_publica_proveedor_guardar(
  p_token   text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id          uuid    := nullif(p_payload->>'id', '')::uuid;
  v_ing_id      uuid    := nullif(p_payload->>'ingrediente_id', '')::uuid;
  v_proveedor   text    := btrim(p_payload->>'proveedor');
  v_cantidad    numeric := (p_payload->>'presentacion_cantidad')::numeric;
  v_unidad      text    := btrim(p_payload->>'presentacion_unidad');
  v_precio      numeric := (p_payload->>'precio_presentacion')::numeric;
  v_costo       numeric := (p_payload->>'costo_por_unidad_base')::numeric;
  v_principal   boolean := coalesce((p_payload->>'es_principal')::boolean, false);
  v_accion      text;
  v_cuantos     integer;
begin
  perform public.fn_carga_token_id(p_token);

  if v_ing_id is null
     or not exists (select 1 from public.ingredientes_catalogo where id = v_ing_id) then
    raise exception 'El insumo no existe' using errcode = '22023';
  end if;
  if v_proveedor is null or v_proveedor = '' then
    raise exception 'El nombre del proveedor es obligatorio' using errcode = '22023';
  end if;
  if v_cantidad is null or v_cantidad <= 0 then
    raise exception 'La presentación tiene que ser mayor que cero' using errcode = '22023';
  end if;
  if v_precio is null or v_precio <= 0 then
    raise exception 'El precio tiene que ser mayor que cero' using errcode = '22023';
  end if;
  if v_costo is null or v_costo <= 0 then
    raise exception 'El costo por unidad no se pudo calcular' using errcode = '22023';
  end if;

  -- Bloquea el insumo para que dos guardados simultáneos no se pisen el
  -- proveedor principal. Mismo criterio que fn_bulk_upsert_costos_proveedor.
  perform 1 from public.ingredientes_catalogo where id = v_ing_id for update;

  if v_id is not null then
    -- Edición: la fila tiene que pertenecer a este insumo.
    if not exists (
      select 1 from public.ingrediente_proveedores
      where id = v_id and ingrediente_id = v_ing_id
    ) then
      raise exception 'El proveedor no pertenece a este insumo' using errcode = '22023';
    end if;
  else
    -- Alta: match case-insensitive contra los que ya tiene, para no crear
    -- "Colanta" y "COLANTA" como dos proveedores del mismo insumo.
    select id into v_id
    from public.ingrediente_proveedores
    where ingrediente_id = v_ing_id
      and lower(btrim(proveedor)) = lower(v_proveedor)
    limit 1;
  end if;

  if v_id is null then
    insert into public.ingrediente_proveedores (
      ingrediente_id, proveedor, presentacion_cantidad, presentacion_unidad,
      precio_presentacion, costo_por_unidad_base, es_principal
    )
    values (v_ing_id, v_proveedor, v_cantidad, v_unidad, v_precio, v_costo, false)
    returning id into v_id;
    v_accion := 'creado';
  else
    update public.ingrediente_proveedores
    set proveedor             = v_proveedor,
        presentacion_cantidad = v_cantidad,
        presentacion_unidad   = v_unidad,
        precio_presentacion   = v_precio,
        costo_por_unidad_base = v_costo
    where id = v_id;
    v_accion := 'actualizado';
  end if;

  select count(*) into v_cuantos
  from public.ingrediente_proveedores where ingrediente_id = v_ing_id;

  -- El primer proveedor de un insumo es principal sí o sí: si no, el insumo
  -- quedaría con proveedor cargado y costo 0, que es peor que no tener nada.
  if v_principal or v_cuantos = 1 then
    perform public.fn_set_proveedor_principal(v_ing_id, v_id);
    v_principal := true;
  else
    -- Si se editó el que ya era principal, hay que re-sincronizar el costo del
    -- insumo: fn_set_proveedor_principal no corre en esta rama.
    update public.ingredientes_catalogo i
    set costo_por_unidad = v_costo
    where i.id = v_ing_id
      and exists (
        select 1 from public.ingrediente_proveedores p
        where p.id = v_id and coalesce(p.es_principal, false)
      );
    select coalesce(es_principal, false) into v_principal
    from public.ingrediente_proveedores where id = v_id;
  end if;

  return jsonb_build_object(
    'id', v_id, 'accion', v_accion, 'es_principal', v_principal
  );
end;
$$;

revoke all on function public.fn_carga_publica_proveedor_guardar(text, jsonb) from public;
grant execute on function public.fn_carga_publica_proveedor_guardar(text, jsonb) to anon, authenticated;

-- =========================================================================
-- 4) Elegir cuál proveedor manda
-- =========================================================================

create or replace function public.fn_carga_publica_proveedor_principal(
  p_token        text,
  p_ingrediente_id uuid,
  p_proveedor_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_carga_token_id(p_token);
  -- La RPC que ya usa la app: apaga los demás, prende este y sincroniza
  -- ingredientes_catalogo.costo_por_unidad en una sola transacción.
  perform public.fn_set_proveedor_principal(p_ingrediente_id, p_proveedor_id);
end;
$$;

revoke all on function public.fn_carga_publica_proveedor_principal(text, uuid, uuid) from public;
grant execute on function public.fn_carga_publica_proveedor_principal(text, uuid, uuid) to anon, authenticated;

-- =========================================================================
-- 5) Borrar un proveedor
-- =========================================================================

create or replace function public.fn_carga_publica_proveedor_borrar(
  p_token text,
  p_id    uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ing_id    uuid;
  v_era_princ boolean;
  v_nuevo     uuid;
begin
  perform public.fn_carga_token_id(p_token);

  select ingrediente_id, coalesce(es_principal, false)
  into v_ing_id, v_era_princ
  from public.ingrediente_proveedores
  where id = p_id;

  if v_ing_id is null then
    return;  -- ya no está: borrar dos veces no es un error
  end if;

  perform 1 from public.ingredientes_catalogo where id = v_ing_id for update;

  delete from public.ingrediente_proveedores where id = p_id;

  if not v_era_princ then
    return;
  end if;

  -- Se fue el principal: asciende otro, o el insumo vuelve a costo 0. Sin
  -- esto el insumo quedaría con el costo del proveedor que ya no existe.
  select id into v_nuevo
  from public.ingrediente_proveedores
  where ingrediente_id = v_ing_id
  order by created_at
  limit 1;

  if v_nuevo is not null then
    perform public.fn_set_proveedor_principal(v_ing_id, v_nuevo);
  else
    update public.ingredientes_catalogo
    set costo_por_unidad = 0, proveedor = null
    where id = v_ing_id;
  end if;
end;
$$;

revoke all on function public.fn_carga_publica_proveedor_borrar(text, uuid) from public;
grant execute on function public.fn_carga_publica_proveedor_borrar(text, uuid) to anon, authenticated;

-- =========================================================================
-- 6) Se va el guardado por lote
-- =========================================================================

-- fn_carga_publica_costos recibia hasta 500 filas de una y era lo que usaba la
-- grilla vieja. Con el guardado por proveedor queda sin llamador, y un endpoint
-- publico de escritura masiva que nadie usa es superficie de ataque regalada.
-- El wrapper se va; fn_bulk_upsert_costos_proveedor se queda, que es la que
-- sigue usando el importador de Excel de la app (con sesion y rol).

drop function if exists public.fn_carga_publica_costos(text, jsonb);
