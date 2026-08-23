-- Cartera: facturas de venta, abonos y reporte de edades.
--
-- El cliente lleva la cartera en Excel: $350M en 128 facturas de 69 clientes,
-- 52% vencida. Esto lo trae al CRM.
--
-- Tres decisiones que vienen de mirar sus planillas, no de suponer:
--
-- 1. DOS EMPRESAS EMISORAS. "CARTERA SELECTA" e "cartera isabella" son libros
--    distintos: Selecta factura a empresas (numeración FECP####), Isabela a
--    personas naturales (numeración simple), y no comparten un solo cliente.
--    Sin `empresa_emisora_id` los dos libros se mezclan y ningún total cuadra.
--
-- 2. LOS TRAMOS SE MIDEN SOBRE LA EDAD DE LA FACTURA, no sobre los días de
--    mora. Se dedujo probando reglas contra las 128 filas que ellos ya tenían
--    clasificadas: bandas 31-60 / 61-90 / 91-120 / 121-150 / >150 sobre
--    (corte - fecha_emision), y corriente mientras la edad sea menor al plazo.
--    Reproduce el libro de Isabela exacto y el de Selecta con $227.484 de
--    diferencia sobre $283M (0,08%), en 4 facturas que ellos clasificaron un
--    tramo más abajo. `dias_mora` se expone aparte porque "está vencida" y
--    "hace cuánto se emitió" son dos preguntas distintas.
--
-- 3. EL SALDO NO SE ALMACENA. Se calcula como valor_total - suma(abonos).
--    Un saldo materializado se desincroniza el día que alguien corrija un abono.
--
-- Las facturas se crean a mano en el CRM (decisión tomada: no se integra con el
-- facturador electrónico externo). `fn_cartera_importar` existe para la carga
-- inicial de las 128 que ya tienen en Excel.

-- =========================================================================
-- 1) Empresas emisoras
-- =========================================================================

create table if not exists public.empresas_emisoras (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  nit        text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.empresas_emisoras is
  'Razones sociales que emiten factura. Selecta e Isabela llevan libros de cartera separados, con clientes y numeración distintos.';

insert into public.empresas_emisoras (nombre)
select 'Selecta' where not exists (select 1 from public.empresas_emisoras where nombre = 'Selecta');
insert into public.empresas_emisoras (nombre)
select 'Isabela' where not exists (select 1 from public.empresas_emisoras where nombre = 'Isabela');

alter table public.empresas_emisoras enable row level security;

drop policy if exists "empresas_emisoras: rol select" on public.empresas_emisoras;
create policy "empresas_emisoras: rol select" on public.empresas_emisoras
  for select to authenticated
  using (
    public.has_role('admin') or public.has_role('comercial')
    or public.has_role('operaciones')
  );

drop policy if exists "empresas_emisoras: rol write" on public.empresas_emisoras;
create policy "empresas_emisoras: rol write" on public.empresas_emisoras
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- Un cliente pertenece a un libro. Nullable: los 5 que ya existen son de demo
-- y los clientes de un evento pueden entrar antes de que se les facture.
alter table public.clientes
  add column if not exists empresa_emisora_id uuid references public.empresas_emisoras(id);

-- =========================================================================
-- 2) Facturas de venta
-- =========================================================================

create table if not exists public.facturas_venta (
  id                  uuid primary key default gen_random_uuid(),
  empresa_emisora_id  uuid not null references public.empresas_emisoras(id),
  cliente_id          uuid not null references public.clientes(id) on delete restrict,
  -- Las 128 históricas no tienen evento en el CRM; las nuevas sí lo van a tener.
  evento_id           uuid references public.eventos(id) on delete set null,
  numero              text not null,
  fecha_emision       date not null,
  dias_credito        integer not null default 30 check (dias_credito >= 0),
  valor_total         numeric(14,2) not null check (valor_total >= 0),
  anulada             boolean not null default false,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- La numeración se repite entre emisoras; dentro de una, no.
  unique (empresa_emisora_id, numero)
);

create index if not exists facturas_venta_cliente_idx on public.facturas_venta(cliente_id);
create index if not exists facturas_venta_emisora_idx on public.facturas_venta(empresa_emisora_id);
create index if not exists facturas_venta_fecha_idx   on public.facturas_venta(fecha_emision);
create index if not exists facturas_venta_evento_idx  on public.facturas_venta(evento_id);

comment on column public.facturas_venta.dias_credito is
  'Plazo pactado. NO define el tramo de edad (eso va sobre fecha_emision), pero sí si la factura está vencida y cuántos días lleva de mora.';

alter table public.facturas_venta enable row level security;

drop policy if exists "facturas_venta: rol select" on public.facturas_venta;
create policy "facturas_venta: rol select" on public.facturas_venta
  for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial'));

-- Crear y anular facturas es de administración. Comercial registra abonos
-- (policy de abajo), que es lo que hace en el día a día.
drop policy if exists "facturas_venta: rol write" on public.facturas_venta;
create policy "facturas_venta: rol write" on public.facturas_venta
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- =========================================================================
-- 3) Abonos
-- =========================================================================

create table if not exists public.factura_abonos (
  id             uuid primary key default gen_random_uuid(),
  factura_id     uuid not null references public.facturas_venta(id) on delete cascade,
  fecha          date not null default current_date,
  monto          numeric(14,2) not null check (monto > 0),
  metodo         text,
  referencia     text,
  -- Ruta en Storage del comprobante. La llena el módulo de soportes de pago
  -- cuando exista; por ahora se puede pegar a mano.
  soporte_url    text,
  registrado_por uuid default auth.uid(),
  notas          text,
  created_at     timestamptz not null default now()
);

create index if not exists factura_abonos_factura_idx on public.factura_abonos(factura_id);
create index if not exists factura_abonos_fecha_idx   on public.factura_abonos(fecha);

alter table public.factura_abonos enable row level security;

drop policy if exists "factura_abonos: rol select" on public.factura_abonos;
create policy "factura_abonos: rol select" on public.factura_abonos
  for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial'));

drop policy if exists "factura_abonos: rol write" on public.factura_abonos;
create policy "factura_abonos: rol write" on public.factura_abonos
  for all to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));

-- =========================================================================
-- 4) El tramo de edad, en un solo lugar
-- =========================================================================

create or replace function public.fn_cartera_tramo(
  p_edad_dias    integer,
  p_dias_credito integer default 30
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  -- Bandas deducidas de las 128 facturas ya clasificadas por el cliente.
  --
  -- El borde es ESTRICTO: una factura que vence hoy ya cuenta como vencida.
  -- No se eligió, se dedujo — MINEROS ALUVIAL FECP4841 ($11.976.250, 30 días
  -- exactos al corte) ellos la clasifican vencida. Con `<=` el libro de Selecta
  -- quedaba $11.748.766 lejos del suyo; con `<` queda a $227.484 (0,08%), y el
  -- de Isabela cuadra exacto en los dos casos.
  select case
    when p_edad_dias is null                        then 'corriente'
    when p_edad_dias < coalesce(p_dias_credito, 30) then 'corriente'
    when p_edad_dias <=  60 then '31-60'
    when p_edad_dias <=  90 then '61-90'
    when p_edad_dias <= 120 then '91-120'
    when p_edad_dias <= 150 then '121-150'
    else '>150'
  end;
$$;

comment on function public.fn_cartera_tramo(integer, integer) is
  'Tramo de cartera. Corriente mientras la edad sea MENOR al plazo pactado de esa factura; después, bandas por edad. Fuente única: la usan la vista y el reporte.';

-- =========================================================================
-- 5) Vista de cartera viva
-- =========================================================================

create or replace view public.v_cartera_facturas
with (security_invoker = true) as
select
  f.id,
  f.empresa_emisora_id,
  e.nombre                                   as emisora,
  f.cliente_id,
  c.nombre                                   as cliente_nombre,
  coalesce(c.nit, c.cedula)                  as cliente_documento,
  f.evento_id,
  f.numero,
  f.fecha_emision,
  f.dias_credito,
  (f.fecha_emision + f.dias_credito)         as fecha_vencimiento,
  f.valor_total,
  coalesce(ab.abonado, 0)                    as abonado,
  f.valor_total - coalesce(ab.abonado, 0)    as saldo,
  (current_date - f.fecha_emision)           as edad_dias,
  greatest(0, (current_date - f.fecha_emision) - f.dias_credito) as dias_mora,
  public.fn_cartera_tramo((current_date - f.fecha_emision), f.dias_credito) as tramo,
  f.anulada,
  f.notas,
  f.created_at
from public.facturas_venta f
join public.empresas_emisoras e on e.id = f.empresa_emisora_id
join public.clientes c          on c.id = f.cliente_id
left join lateral (
  select sum(a.monto) as abonado
  from public.factura_abonos a
  where a.factura_id = f.id
) ab on true;

comment on view public.v_cartera_facturas is
  'Cartera al día de hoy. security_invoker: respeta las policies de facturas_venta, no las esquiva.';

-- =========================================================================
-- 6) Reporte: resumen, matriz por edades y riesgo crítico
-- =========================================================================

create or replace function public.fn_cartera_resumen(
  p_fecha_corte date default current_date,
  p_empresa_id  uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_out jsonb;
begin
  -- Una sola pasada arma las tres vistas del informe del cliente: el resumen
  -- ejecutivo, la matriz por edades y la tabla de riesgo crítico.
  with base as (
    select
      f.id, f.cliente_id, f.numero, f.fecha_emision, f.valor_total,
      c.nombre as cliente_nombre,
      coalesce(c.nit, c.cedula) as cliente_documento,
      e.nombre as emisora,
      f.valor_total - coalesce((
        select sum(a.monto) from public.factura_abonos a
        where a.factura_id = f.id and a.fecha <= p_fecha_corte
      ), 0) as saldo,
      f.dias_credito,
      (p_fecha_corte - f.fecha_emision) as edad
    from public.facturas_venta f
    join public.clientes c          on c.id = f.cliente_id
    join public.empresas_emisoras e on e.id = f.empresa_emisora_id
    where not f.anulada
      and f.fecha_emision <= p_fecha_corte
      and (p_empresa_id is null or f.empresa_emisora_id = p_empresa_id)
  ),
  viva as (
    -- Una factura saldada no es cartera. El filtro va acá y no arriba para que
    -- el saldo se calcule antes de decidir.
    select *, public.fn_cartera_tramo(edad, dias_credito) as tramo
    from base where saldo > 0.005
  ),
  por_cliente as (
    select
      cliente_id, cliente_nombre, cliente_documento, emisora,
      sum(saldo)                                                   as total,
      sum(saldo) filter (where tramo = 'corriente')                as corriente,
      sum(saldo) filter (where tramo = '31-60')                    as t31_60,
      sum(saldo) filter (where tramo = '61-90')                    as t61_90,
      sum(saldo) filter (where tramo in ('91-120','121-150','>150')) as t_mas_90,
      sum(saldo) filter (where tramo <> 'corriente')               as vencido,
      sum(saldo) filter (where tramo in ('61-90','91-120','121-150','>150')) as critico
    from viva
    group by cliente_id, cliente_nombre, cliente_documento, emisora
  ),
  con_riesgo as (
    select *,
      case
        when coalesce(critico, 0) > 0 then 'CRITICO'
        when coalesce(vencido, 0) > 0 then 'VIGILANCIA'
        else 'SANO'
      end as estado_riesgo,
      case when total > 0 then coalesce(vencido, 0) / total else 0 end as pct_vencido
    from por_cliente
  ),
  totales as (
    select
      coalesce(sum(saldo), 0)                                            as cartera_total,
      coalesce(sum(saldo) filter (where tramo = 'corriente'), 0)         as corriente,
      coalesce(sum(saldo) filter (where tramo <> 'corriente'), 0)        as vencida,
      coalesce(sum(saldo) filter (where tramo in ('61-90','91-120','121-150','>150')), 0) as critica,
      count(*)                                                            as facturas
    from viva
  )
  select jsonb_build_object(
    'fecha_corte', p_fecha_corte,
    'totales', (
      select jsonb_build_object(
        'cartera_total', t.cartera_total,
        'corriente',     t.corriente,
        'vencida',       t.vencida,
        'critica',       t.critica,
        'facturas',      t.facturas,
        'clientes',      (select count(*) from con_riesgo),
        'clientes_criticos', (select count(*) from con_riesgo where estado_riesgo = 'CRITICO'),
        'pct_corriente', case when t.cartera_total > 0 then t.corriente / t.cartera_total else 0 end,
        'pct_vencida',   case when t.cartera_total > 0 then t.vencida   / t.cartera_total else 0 end,
        'pct_critica',   case when t.cartera_total > 0 then t.critica   / t.cartera_total else 0 end
      ) from totales t
    ),
    'composicion', (
      select coalesce(jsonb_agg(jsonb_build_object('tramo', tramo, 'valor', valor) order by orden), '[]'::jsonb)
      from (
        select tramo, sum(saldo) as valor,
               case tramo when 'corriente' then 1 when '31-60' then 2 when '61-90' then 3
                          when '91-120' then 4 when '121-150' then 5 else 6 end as orden
        from viva group by tramo
      ) x
    ),
    'por_cliente', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'cliente_id', cliente_id, 'nombre', cliente_nombre, 'documento', cliente_documento,
        'emisora', emisora, 'total', total,
        'corriente', coalesce(corriente, 0), 't31_60', coalesce(t31_60, 0),
        't61_90', coalesce(t61_90, 0), 't_mas_90', coalesce(t_mas_90, 0),
        'vencido', coalesce(vencido, 0), 'critico', coalesce(critico, 0),
        'pct_vencido', pct_vencido, 'estado_riesgo', estado_riesgo
      ) order by total desc), '[]'::jsonb)
      from con_riesgo
    )
  ) into v_out;

  return v_out;
end;
$$;

comment on function public.fn_cartera_resumen(date, uuid) is
  'Resumen ejecutivo + matriz por edades + riesgo por cliente, a una fecha de corte. p_empresa_id null = las dos emisoras consolidadas.';

grant execute on function public.fn_cartera_resumen(date, uuid) to authenticated;

-- =========================================================================
-- 7) Importador de la cartera existente
-- =========================================================================

create or replace function public.fn_cartera_importar(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fila        jsonb;
  v_emisora_id  uuid;
  v_cliente_id  uuid;
  v_doc         text;
  v_nombre      text;
  v_creados_cli int := 0;
  v_creadas     int := 0;
  v_repetidas   int := 0;
begin
  if jsonb_typeof(p_payload->'filas') <> 'array' then
    raise exception 'El payload debe traer "filas" como array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_payload->'filas') > 2000 then
    raise exception 'Máximo 2000 facturas por importación' using errcode = '22023';
  end if;

  select id into v_emisora_id
  from public.empresas_emisoras
  where nombre = btrim(p_payload->>'emisora');

  if v_emisora_id is null then
    raise exception 'No existe la empresa emisora "%"', p_payload->>'emisora'
      using errcode = '22023';
  end if;

  for v_fila in select * from jsonb_array_elements(p_payload->'filas')
  loop
    v_doc    := nullif(btrim(v_fila->>'documento'), '');
    v_nombre := btrim(v_fila->>'cliente');

    if v_nombre is null or v_nombre = '' then
      raise exception 'Hay una fila sin nombre de cliente' using errcode = '22023';
    end if;

    -- Match por documento primero (es el identificador fuerte); si no hay, por
    -- nombre exacto dentro de la misma emisora. Si no aparece, se crea.
    v_cliente_id := null;
    if v_doc is not null then
      select id into v_cliente_id from public.clientes
      where coalesce(nit, cedula) = v_doc limit 1;
    end if;
    if v_cliente_id is null then
      select id into v_cliente_id from public.clientes
      where lower(btrim(nombre)) = lower(v_nombre)
        and empresa_emisora_id is not distinct from v_emisora_id
      limit 1;
    end if;

    if v_cliente_id is null then
      -- Un NIT largo es empresa; una cédula, persona natural. Es la misma
      -- distinción que hace el form de clientes de la app.
      insert into public.clientes (nombre, tipo, nit, cedula, empresa_emisora_id)
      values (
        v_nombre,
        case when length(coalesce(v_doc, '')) >= 9 then 'empresa' else 'persona_natural' end,
        case when length(coalesce(v_doc, '')) >= 9 then v_doc else null end,
        case when length(coalesce(v_doc, '')) <  9 then v_doc else null end,
        v_emisora_id
      )
      returning id into v_cliente_id;
      v_creados_cli := v_creados_cli + 1;
    end if;

    -- Re-importar el mismo archivo no debe duplicar ni explotar.
    if exists (
      select 1 from public.facturas_venta
      where empresa_emisora_id = v_emisora_id and numero = btrim(v_fila->>'numero')
    ) then
      v_repetidas := v_repetidas + 1;
      continue;
    end if;

    insert into public.facturas_venta (
      empresa_emisora_id, cliente_id, numero, fecha_emision, valor_total,
      dias_credito, notas
    ) values (
      v_emisora_id,
      v_cliente_id,
      btrim(v_fila->>'numero'),
      (v_fila->>'fecha')::date,
      (v_fila->>'saldo')::numeric,
      coalesce((v_fila->>'dias_credito')::integer, 30),
      nullif(btrim(v_fila->>'notas'), '')
    );
    v_creadas := v_creadas + 1;
  end loop;

  return jsonb_build_object(
    'clientes_creados', v_creados_cli,
    'facturas_creadas', v_creadas,
    'facturas_repetidas', v_repetidas
  );
end;
$$;

comment on function public.fn_cartera_importar(jsonb) is
  'Carga inicial de la cartera desde Excel. Idempotente por (emisora, numero): re-importar el mismo archivo no duplica. El valor que entra es el SALDO pendiente, no el valor original de la factura.';

grant execute on function public.fn_cartera_importar(jsonb) to authenticated;


-- =========================================================================
-- 8) Auditoría contra la planilla
-- =========================================================================

-- Tramo de cada factura a una fecha de corte. Existe para poder comparar el
-- reporte contra el Excel del cliente factura por factura: un total que no
-- cuadra no dice cuál fila lo causa, y la respuesta casi siempre es que ese
-- cliente tiene un plazo distinto a 30 días y nadie lo había dicho.
-- La usa `scripts-plantillas/importar_cartera.py --verificar`.

create or replace function public.fn_cartera_tramos_a_corte(
  p_fecha_corte date default current_date
)
returns table (numero text, emisora text, saldo numeric, edad_dias integer, tramo text)
language sql
security invoker
set search_path = public, pg_temp
as $$
  select
    f.numero,
    e.nombre,
    f.valor_total - coalesce((
      select sum(a.monto) from public.factura_abonos a
      where a.factura_id = f.id and a.fecha <= p_fecha_corte
    ), 0),
    (p_fecha_corte - f.fecha_emision)::integer,
    public.fn_cartera_tramo((p_fecha_corte - f.fecha_emision)::integer, f.dias_credito)
  from public.facturas_venta f
  join public.empresas_emisoras e on e.id = f.empresa_emisora_id
  where not f.anulada and f.fecha_emision <= p_fecha_corte;
$$;

grant execute on function public.fn_cartera_tramos_a_corte(date) to authenticated;
