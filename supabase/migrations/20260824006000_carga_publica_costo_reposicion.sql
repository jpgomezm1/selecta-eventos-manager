-- El reporte de facturacion valoriza lo roto y lo perdido con
-- menaje_catalogo.costo_reposicion, pero la pagina de carga publica nunca pidio
-- ese dato: la pestana Menaje solo tenia stock y precio de alquiler. Los 9
-- articulos estan en costo_reposicion = 0, o sea que el reporte de bodega
-- valoriza cualquier perdida en cero y la factura sale incompleta.
--
-- Se expone en el mismo formulario donde el cliente ya esta cargando el resto.
-- (Se detecto abriendo la pagina, no leyendo el codigo.)

create or replace function public.fn_carga_publica_datos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
          'precio_alquiler', m.precio_alquiler,
          'costo_reposicion', coalesce(m.costo_reposicion, 0)
        ) order by m.categoria, m.nombre
      ), '[]'::jsonb)
      from public.menaje_catalogo m
      where m.activo
    )

  ) into v_out;

  return v_out;
end;
$function$;

create or replace function public.fn_carga_publica_menaje(
  p_token text,
  p_fila  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id        uuid := nullif(p_fila->>'id', '')::uuid;
  v_nombre    text := btrim(p_fila->>'nombre');
  v_categoria text := btrim(p_fila->>'categoria');
  v_unidad    text := btrim(p_fila->>'unidad');
  v_stock     integer;
  v_precio    numeric;
  v_repo      numeric;
begin
  perform public.fn_carga_token_id(p_token);

  if v_nombre is null or v_nombre = '' then
    raise exception 'El nombre es obligatorio' using errcode = '22023';
  end if;
  if v_categoria is null or v_categoria = '' then
    raise exception 'La categoría es obligatoria' using errcode = '22023';
  end if;
  if v_unidad is null or v_unidad = '' then
    raise exception 'La unidad es obligatoria' using errcode = '22023';
  end if;

  v_stock  := coalesce((p_fila->>'stock_total')::numeric, 0)::integer;
  v_precio := coalesce((p_fila->>'precio_alquiler')::numeric, 0);
  v_repo   := coalesce((p_fila->>'costo_reposicion')::numeric, 0);

  if v_stock < 0 then
    raise exception 'El stock no puede ser negativo' using errcode = '22023';
  end if;
  if v_precio < 0 then
    raise exception 'El precio de alquiler no puede ser negativo' using errcode = '22023';
  end if;
  if v_repo < 0 then
    raise exception 'El costo de reposición no puede ser negativo' using errcode = '22023';
  end if;

  -- Sin id explícito, un nombre que ya existe actualiza en vez de duplicar:
  -- el cliente escribe "Copa vino tinto" sin saber que ya está sembrada.
  if v_id is null then
    select id into v_id
    from public.menaje_catalogo
    where lower(btrim(nombre)) = lower(v_nombre) and activo
    limit 1;
  end if;

  if v_id is null then
    insert into public.menaje_catalogo
      (nombre, categoria, unidad, stock_total, precio_alquiler, costo_reposicion, activo)
    values (v_nombre, v_categoria, v_unidad, v_stock, v_precio, v_repo, true)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'accion', 'creado');
  end if;

  update public.menaje_catalogo
  set nombre           = v_nombre,
      categoria        = v_categoria,
      unidad           = v_unidad,
      stock_total      = v_stock,
      precio_alquiler  = v_precio,
      costo_reposicion = v_repo
  where id = v_id;

  return jsonb_build_object('id', v_id, 'accion', 'actualizado');
end;
$fn$;

-- Supabase vuelve a conceder execute a anon/authenticated en cada `create or
-- replace`; acá anon SÍ debe poder (la página es pública y va por token), pero
-- se re-declara explícito para que no dependa del default.
revoke all on function public.fn_carga_publica_datos(text) from public;
revoke all on function public.fn_carga_publica_menaje(text, jsonb) from public;
grant execute on function public.fn_carga_publica_datos(text) to anon, authenticated;
grant execute on function public.fn_carga_publica_menaje(text, jsonb) to anon, authenticated;
