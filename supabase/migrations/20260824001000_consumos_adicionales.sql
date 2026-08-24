-- Consumos adicionales durante el evento.
--
-- Lo pidió el cliente así: "que el comercial que dirige el evento pueda ir
-- registrando los consumos adicionales que se van dando durante el evento".
--
-- NO va en `evento_costos`. Esa tabla es lo que Selecta le PAGA a proveedores
-- (decoración, flores, fletes); esto es lo que se le COBRA al cliente. Meterlos
-- juntos rompe el margen en las dos direcciones: infla el costo y esconde el
-- ingreso. Son dos tablas porque son dos cosas.
--
-- Diseñado para cómo se va a usar de verdad, no para el ideal: es poco probable
-- que el comercial registre en el instante exacto en medio de un evento. Por eso
-- `ocurrido_at` es editable y separado de `registrado_at` — se puede llenar al
-- final de la noche sin mentir sobre cuándo pasó, y sin castigar el registro
-- tardío con un dato falso.

create table if not exists public.evento_cargos_adicionales (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references public.eventos(id) on delete cascade,
  -- Si salió del catálogo, se guarda de dónde: permite auditar el precio
  -- después y detectar si alguien cobró distinto al portafolio.
  plato_id        uuid references public.platos_catalogo(id) on delete set null,
  concepto        text not null,
  cantidad        numeric not null check (cantidad > 0),
  precio_unitario numeric not null check (precio_unitario >= 0),
  -- Generada: el subtotal no puede desviarse de sus factores.
  subtotal        numeric generated always as (cantidad * precio_unitario) stored,
  ocurrido_at     timestamptz not null default now(),
  registrado_por  uuid default auth.uid(),
  registrado_at   timestamptz not null default now(),
  notas           text
);

create index if not exists evento_cargos_adicionales_evento_idx
  on public.evento_cargos_adicionales(evento_id);

comment on table public.evento_cargos_adicionales is
  'Consumos extra durante el evento que se le facturan al cliente. Distinto de evento_costos, que es lo que Selecta le paga a proveedores.';

comment on column public.evento_cargos_adicionales.ocurrido_at is
  'Cuándo se consumió. Separado de registrado_at porque casi nunca se registra en el momento: el comercial lo carga al final de la noche y este campo deja que la hora real sea la correcta.';

alter table public.evento_cargos_adicionales enable row level security;

-- Operaciones y cocina lo leen (necesitan saber qué salió de más);
-- comercial y admin lo escriben, que son quienes dirigen el evento.
drop policy if exists "evento_cargos_adicionales: rol select" on public.evento_cargos_adicionales;
create policy "evento_cargos_adicionales: rol select" on public.evento_cargos_adicionales
  for select to authenticated
  using (
    public.has_role('admin') or public.has_role('comercial')
    or public.has_role('operaciones') or public.has_role('cocina')
  );

drop policy if exists "evento_cargos_adicionales: rol write" on public.evento_cargos_adicionales;
create policy "evento_cargos_adicionales: rol write" on public.evento_cargos_adicionales
  for all to authenticated
  using (public.has_role('admin') or public.has_role('comercial'))
  with check (public.has_role('admin') or public.has_role('comercial'));

-- =========================================================================
-- El reporte de facturación los incluye
-- =========================================================================

-- Sin esto los consumos se registran pero no llegan a la factura, que es
-- exactamente el problema que el cliente quiere resolver.

create or replace function public.fn_reporte_facturacion_evento(p_evento_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cotizado numeric := 0;
  v_perdido  numeric := 0;
  v_extras   numeric := 0;
  v_menaje   jsonb   := '[]'::jsonb;
  v_cargos   jsonb   := '[]'::jsonb;
begin
  if not exists (select 1 from public.eventos where id = p_evento_id) then
    raise exception 'El evento no existe' using errcode = '22023';
  end if;

  -- Lo que se le cobró al cliente sale de `cotizaciones.total_cotizado`, NO de
  -- sumar `evento_requerimiento_*`. Esas tablas son un snapshot por ítem que no
  -- refleja el `total_override` (descuentos) ni el precio del lugar, así que un
  -- evento con descuento facturaría de más. Ver 20260715000000.
  select coalesce(c.total_cotizado, 0) into v_cotizado
  from public.eventos e
  join public.cotizacion_versiones cv on cv.id = e.cotizacion_version_id
  join public.cotizaciones c          on c.id = cv.cotizacion_id
  where e.id = p_evento_id;

  -- El detalle de menaje y su total salen de la MISMA pasada: si se calculan
  -- por separado, el día que alguien toque una de las dos el total del reporte
  -- deja de ser la suma de sus renglones.
  with salida as (
    select mi.menaje_id, sum(mi.cantidad) as despachado
    from public.menaje_movimientos mm
    join public.menaje_mov_items mi on mi.movimiento_id = mm.id
    where mm.evento_id = p_evento_id and mm.tipo = 'salida' and mm.estado = 'confirmado'
    group by mi.menaje_id
  ),
  ingreso as (
    select mi.menaje_id,
           sum(mi.cantidad)              as devuelto,
           sum(coalesce(mi.merma, 0))    as merma,
           sum(coalesce(mi.faltante, 0)) as faltante,
           string_agg(distinct mi.causa, ', ')             as causas,
           string_agg(distinct nullif(mi.nota, ''), ' · ') as notas
    from public.menaje_movimientos mm
    join public.menaje_mov_items mi on mi.movimiento_id = mm.id
    where mm.evento_id = p_evento_id and mm.tipo = 'ingreso' and mm.estado = 'confirmado'
    group by mi.menaje_id
  ),
  detalle as (
    select
      mc.id, mc.nombre, mc.categoria, mc.unidad, mc.costo_reposicion,
      coalesce(s.despachado, 0) as despachado,
      coalesce(i.devuelto, 0)   as devuelto,
      coalesce(i.merma, 0)      as merma,
      coalesce(i.faltante, 0)   as faltante,
      i.causas, i.notas,
      (coalesce(i.merma, 0) + coalesce(i.faltante, 0)) * mc.costo_reposicion as valor_perdido
    from salida s
    full outer join ingreso i on i.menaje_id = s.menaje_id
    join public.menaje_catalogo mc on mc.id = coalesce(s.menaje_id, i.menaje_id)
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'menaje_id', d.id, 'nombre', d.nombre, 'categoria', d.categoria, 'unidad', d.unidad,
      'despachado', d.despachado, 'devuelto', d.devuelto,
      'merma', d.merma, 'faltante', d.faltante,
      'costo_reposicion', d.costo_reposicion, 'valor_perdido', d.valor_perdido,
      'causas', d.causas, 'notas', d.notas
    ) order by d.valor_perdido desc, d.nombre), '[]'::jsonb),
    coalesce(sum(d.valor_perdido), 0)
  into v_menaje, v_perdido
  from detalle d;

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', ca.id, 'concepto', ca.concepto, 'cantidad', ca.cantidad,
      'precio_unitario', ca.precio_unitario, 'subtotal', ca.subtotal,
      'ocurrido_at', ca.ocurrido_at, 'notas', ca.notas
    ) order by ca.ocurrido_at), '[]'::jsonb),
    coalesce(sum(ca.subtotal), 0)
  into v_cargos, v_extras
  from public.evento_cargos_adicionales ca
  where ca.evento_id = p_evento_id;

  return jsonb_build_object(
    'evento', (
      select jsonb_build_object(
        'id', e.id, 'nombre', e.nombre_evento, 'fecha', e.fecha_evento,
        'ubicacion', e.ubicacion, 'estado_liquidacion', e.estado_liquidacion
      ) from public.eventos e where e.id = p_evento_id
    ),
    'cliente', (
      select jsonb_build_object('nombre', cl.nombre, 'documento', coalesce(cl.nit, cl.cedula))
      from public.eventos e
      join public.cotizacion_versiones cv on cv.id = e.cotizacion_version_id
      join public.cotizaciones c          on c.id = cv.cotizacion_id
      left join public.clientes cl        on cl.id = c.cliente_id
      where e.id = p_evento_id
    ),
    'cotizado', v_cotizado,
    'menaje_perdido', v_perdido,
    'consumos_adicionales', v_extras,
    'total_a_facturar', v_cotizado + v_perdido + v_extras,
    'menaje', v_menaje,
    'cargos', v_cargos,
    'estado', jsonb_build_object(
      'hubo_despacho', exists (
        select 1 from public.menaje_movimientos
        where evento_id = p_evento_id and tipo = 'salida' and estado = 'confirmado'
      ),
      'hubo_devolucion', exists (
        select 1 from public.menaje_movimientos
        where evento_id = p_evento_id and tipo = 'ingreso' and estado = 'confirmado'
      ),
      'sin_costo_reposicion', exists (
        select 1
        from public.menaje_movimientos mm
        join public.menaje_mov_items mi on mi.movimiento_id = mm.id
        join public.menaje_catalogo mc  on mc.id = mi.menaje_id
        where mm.evento_id = p_evento_id and mm.tipo = 'ingreso'
          and (coalesce(mi.merma,0) + coalesce(mi.faltante,0)) > 0
          and coalesce(mc.costo_reposicion, 0) = 0
      ),
      'ya_facturado', exists (
        select 1 from public.facturas_venta where evento_id = p_evento_id and not anulada
      )
    )
  );
end;
$$;

comment on function public.fn_reporte_facturacion_evento(uuid) is
  'Todo lo que hace falta para facturar un evento: lo cotizado (de cotizaciones.total_cotizado, que respeta descuentos y lugar), el menaje roto o no devuelto a costo de reposición, y los consumos adicionales del evento. Incluye banderas de si el reporte está completo.';

grant execute on function public.fn_reporte_facturacion_evento(uuid) to authenticated;
