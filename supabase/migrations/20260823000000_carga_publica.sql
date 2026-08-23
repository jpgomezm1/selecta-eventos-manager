-- Carga de datos desde la página pública `/carga/:token`.
--
-- Problema: /carga se abre sin sesión (a propósito — meterle un login al paso
-- previo a que el cliente nos mande la data es garantizar que no la mande),
-- pero las tablas de catálogo exigen rol. Hoy la página solo sabe servir .xlsx.
--
-- Solución: un token en la URL + funciones SECURITY DEFINER concedidas a `anon`.
-- La página nunca toca las tablas: llama estas funciones, que validan el token
-- por dentro y escriben como owner. Ventajas sobre abrir RLS a anon:
--   - la superficie es exactamente lo que estas funciones dejan hacer
--   - se revoca apagando una fila (carga_tokens.is_active = false)
--   - queda registro de si el cliente entró (ultima_actividad)
--
-- Mismo espíritu que cotizacion_share_tokens + /compartido/:token, que ya
-- existe en el proyecto para lectura.
--
-- Además: `platos_catalogo.sin_insumos`. Hasta hoy "no tiene receta" y "no
-- lleva insumos" eran el mismo estado (cero filas en plato_ingredientes), así
-- que una botella de agua iba a quedar en la lista de pendientes para siempre.
-- Son 51 de los 209 platos sin receta: vinos, gaseosas, cócteles e
-- "IMPLEMENTOS PARA EL SERVICIO".

-- =========================================================================
-- 1) Tokens de carga
-- =========================================================================

create table if not exists public.carga_tokens (
  id uuid primary key default gen_random_uuid(),
  -- 32 hex sin guiones. gen_random_uuid() es built-in desde PG13; no
  -- dependemos de pgcrypto estando o no en el search_path.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', ''),
  nombre text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  expira_at timestamptz,
  ultima_actividad timestamptz
);

comment on table public.carga_tokens is
  'Links de carga pública (/carga/:token). Sin policies a propósito: solo la '
  'alcanzan service_role y las funciones fn_carga_publica_* (SECURITY DEFINER).';

alter table public.carga_tokens enable row level security;
-- Sin policies: RLS on + cero policies = nadie con anon/authenticated la lee.
-- Las funciones de abajo la consultan como owner.

-- =========================================================================
-- 2) Platos que no llevan insumos
-- =========================================================================

alter table public.platos_catalogo
  add column if not exists sin_insumos boolean not null default false;

comment on column public.platos_catalogo.sin_insumos is
  'true = el plato no lleva insumos y nunca los va a llevar (una botella de '
  'agua, un vino). Distingue "ya lo respondieron" de "falta cargarlo": sin '
  'esta columna ambos casos son cero filas en plato_ingredientes.';

-- =========================================================================
-- 3) Validación del token (helper interno — NO se concede a anon)
-- =========================================================================

create or replace function public.fn_carga_token_id(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from public.carga_tokens
  where token = p_token
    and is_active
    and (expira_at is null or expira_at > now());

  if v_id is null then
    raise exception 'Link inválido o vencido'
      using errcode = '42501';
  end if;

  update public.carga_tokens
  set ultima_actividad = now()
  where id = v_id;

  return v_id;
end;
$$;

-- Postgres concede EXECUTE a PUBLIC por defecto en cada función nueva, y
-- Supabase suma anon/authenticated por default privileges. Este helper no debe
-- ser llamable desde el REST: solo lo usan las funciones de abajo, que corren
-- como owner.
revoke all on function public.fn_carga_token_id(text) from public;

-- =========================================================================
-- 4) Lectura: todo lo que la página necesita, en una sola llamada
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
          'proveedor', pr.proveedor,
          'presentacion_cantidad', pr.presentacion_cantidad,
          'presentacion_unidad', pr.presentacion_unidad,
          'precio_presentacion', pr.precio_presentacion
        ) order by i.nombre
      ), '[]'::jsonb)
      from public.ingredientes_catalogo i
      -- lateral + limit 1: es_principal debería ser único por ingrediente,
      -- pero si alguna vez quedaran dos, preferimos una fila arbitraria a
      -- duplicar el ingrediente entero en la respuesta.
      left join lateral (
        select p.proveedor, p.presentacion_cantidad,
               p.presentacion_unidad, p.precio_presentacion
        from public.ingrediente_proveedores p
        where p.ingrediente_id = i.id and p.es_principal
        limit 1
      ) pr on true
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
-- 5) Escritura: costos de insumos
-- =========================================================================

create or replace function public.fn_carga_publica_costos(
  p_token   text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_carga_token_id(p_token);

  if jsonb_typeof(p_payload) <> 'array' then
    raise exception 'El payload debe ser un array de filas'
      using errcode = '22023';
  end if;
  -- Tope de lote: la página guarda por fila o por bloque chico. Un array
  -- gigante desde un link público solo puede ser un error o un abuso.
  if jsonb_array_length(p_payload) > 500 then
    raise exception 'Máximo 500 filas por guardado'
      using errcode = '22023';
  end if;

  -- Reusa la misma RPC que usa el importador de Excel de la app: una sola
  -- transacción, y las dos rutas no se pueden desincronizar.
  return public.fn_bulk_upsert_costos_proveedor(p_payload);
end;
$$;

revoke all on function public.fn_carga_publica_costos(text, jsonb) from public;
grant execute on function public.fn_carga_publica_costos(text, jsonb) to anon, authenticated;

-- =========================================================================
-- 6) Escritura: receta de un plato
-- =========================================================================

create or replace function public.fn_carga_publica_receta(
  p_token    text,
  p_plato_id uuid,
  p_items    jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_carga_token_id(p_token);

  if not exists (select 1 from public.platos_catalogo where id = p_plato_id) then
    raise exception 'El plato no existe'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items debe ser un array'
      using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Máximo 100 insumos por plato'
      using errcode = '22023';
  end if;

  -- Guardar una receta contradice "no lleva insumos": si el cliente escribe
  -- ingredientes, la marca se cae sola en vez de dejar los dos estados a la vez.
  if jsonb_array_length(p_items) > 0 then
    update public.platos_catalogo
    set sin_insumos = false
    where id = p_plato_id and sin_insumos;
  end if;

  -- DELETE + INSERT en una transacción: si el insert falla, el plato conserva
  -- su receta anterior en vez de quedar vacío.
  perform public.fn_upsert_plato_ingredientes_atomic(p_plato_id, p_items);
end;
$$;

revoke all on function public.fn_carga_publica_receta(text, uuid, jsonb) from public;
grant execute on function public.fn_carga_publica_receta(text, uuid, jsonb) to anon, authenticated;

-- =========================================================================
-- 7) Escritura: marcar platos que no llevan insumos
-- =========================================================================

create or replace function public.fn_carga_publica_sin_insumos(
  p_token     text,
  p_plato_ids uuid[],
  p_valor     boolean
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
begin
  perform public.fn_carga_token_id(p_token);

  if p_plato_ids is null or array_length(p_plato_ids, 1) is null then
    return 0;
  end if;
  if array_length(p_plato_ids, 1) > 500 then
    raise exception 'Máximo 500 platos por operación'
      using errcode = '22023';
  end if;

  -- No borra recetas. Un plato con receta cargada no puede marcarse como que
  -- no lleva insumos: la UI solo ofrece la marca para los que están vacíos, y
  -- acá se refuerza para que un request armado a mano no destruya nada.
  update public.platos_catalogo pl
  set sin_insumos = p_valor
  where pl.id = any(p_plato_ids)
    and (
      not p_valor
      or not exists (
        select 1 from public.plato_ingredientes pi where pi.plato_id = pl.id
      )
    );

  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.fn_carga_publica_sin_insumos(text, uuid[], boolean) from public;
grant execute on function public.fn_carga_publica_sin_insumos(text, uuid[], boolean) to anon, authenticated;

-- =========================================================================
-- 8) Escritura: menaje
-- =========================================================================

create or replace function public.fn_carga_publica_menaje(
  p_token text,
  p_fila  jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id        uuid := nullif(p_fila->>'id', '')::uuid;
  v_nombre    text := btrim(p_fila->>'nombre');
  v_categoria text := btrim(p_fila->>'categoria');
  v_unidad    text := btrim(p_fila->>'unidad');
  v_stock     integer;
  v_precio    numeric;
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

  if v_stock < 0 then
    raise exception 'El stock no puede ser negativo' using errcode = '22023';
  end if;
  if v_precio < 0 then
    raise exception 'El precio de alquiler no puede ser negativo' using errcode = '22023';
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
      (nombre, categoria, unidad, stock_total, precio_alquiler, activo)
    values (v_nombre, v_categoria, v_unidad, v_stock, v_precio, true)
    returning id into v_id;
    return jsonb_build_object('id', v_id, 'accion', 'creado');
  end if;

  update public.menaje_catalogo
  set nombre          = v_nombre,
      categoria       = v_categoria,
      unidad          = v_unidad,
      stock_total     = v_stock,
      precio_alquiler = v_precio
  where id = v_id;

  return jsonb_build_object('id', v_id, 'accion', 'actualizado');
end;
$$;

revoke all on function public.fn_carga_publica_menaje(text, jsonb) from public;
grant execute on function public.fn_carga_publica_menaje(text, jsonb) to anon, authenticated;

-- =========================================================================
-- 9) Escritura: dar de baja un artículo de menaje
-- =========================================================================

create or replace function public.fn_carga_publica_menaje_baja(
  p_token text,
  p_id    uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.fn_carga_token_id(p_token);

  -- Baja lógica, no DELETE: el artículo puede estar amarrado a una reserva o
  -- a una cotización vieja (FK RESTRICT), y borrarlo rompería el histórico.
  -- Sirve sobre todo para que el cliente saque las 9 filas de demo que
  -- sembramos nosotros sin tener que pedírnoslo.
  update public.menaje_catalogo
  set activo = false
  where id = p_id;
end;
$$;

revoke all on function public.fn_carga_publica_menaje_baja(text, uuid) from public;
grant execute on function public.fn_carga_publica_menaje_baja(text, uuid) to anon, authenticated;

-- =========================================================================
-- 10) Un token para arrancar
-- =========================================================================

insert into public.carga_tokens (nombre)
select 'Selecta — carga inicial'
where not exists (select 1 from public.carga_tokens);

-- Para saber qué link mandar:
--   select token from public.carga_tokens where is_active;
-- Para revocarlo:
--   update public.carga_tokens set is_active = false where token = '...';
