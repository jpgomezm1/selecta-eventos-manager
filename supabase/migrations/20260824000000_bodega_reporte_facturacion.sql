-- Bodega: valorizar lo que se pierde y sacar el reporte para facturar el evento.
--
-- Lo que pidió el cliente es "el reporte que se necesita para emitir la factura
-- del evento". El dato crudo ya se captura —al devolver menaje se registra la
-- merma y la pantalla calcula el faltante— pero no sirve para facturar por tres
-- razones, y esta migración las cierra:
--
-- 1. NO HAY VALOR. `menaje_catalogo` tiene `precio_alquiler` (lo que se cobra
--    por prestarlo), no cuánto cuesta reponerlo. Sin eso "se rompieron 12 copas"
--    no se convierte en un renglón de factura.
--
-- 2. EL FALTANTE SE PIERDE. `registrar_devolucion_menaje` calcula
--    despachado - devuelto - merma, lo descuenta del stock… y no lo guarda.
--    Queda solo la merma. Después nadie puede decir cuántas se rompieron y
--    cuántas no volvieron, que son dos conversaciones distintas con el cliente:
--    una se cobra como daño, la otra hay que reclamarla.
--
-- 3. NO SE DISTINGUE LA CAUSA. Roto, perdido y "otro" caen todos en un entero.
--
-- Además `CierreEventoPanel` compara contra `evento_requerimiento_menaje`, que
-- es lo COTIZADO, no lo que realmente salió de bodega. Si se despachó de menos
-- o volvió incompleto, el cierre no se entera.

-- =========================================================================
-- 1) Cuánto cuesta reponerlo
-- =========================================================================

alter table public.menaje_catalogo
  add column if not exists costo_reposicion numeric not null default 0
  check (costo_reposicion >= 0);

comment on column public.menaje_catalogo.costo_reposicion is
  'Lo que cuesta reponer una unidad. Distinto de precio_alquiler, que es lo que se le cobra al cliente por usarla en un evento. Este es el que se factura cuando algo se rompe o no vuelve.';

-- =========================================================================
-- 2) Faltante y causa, guardados
-- =========================================================================

alter table public.menaje_mov_items
  add column if not exists faltante integer not null default 0 check (faltante >= 0);

alter table public.menaje_mov_items
  add column if not exists causa text
  check (causa is null or causa in ('roto', 'perdido', 'otro'));

comment on column public.menaje_mov_items.faltante is
  'Lo que no volvió y tampoco se reportó como roto. Se guarda en vez de recalcularlo: es una decisión que se toma al recibir la devolución, y si después alguien corrige la salida no queremos que el faltante histórico cambie solo.';

comment on column public.menaje_mov_items.causa is
  'Por qué se perdieron unidades. Sin esto, "roto" y "extraviado" son el mismo número y no se pueden cobrar distinto.';

-- =========================================================================
-- 3) La devolución guarda lo que antes calculaba y tiraba
-- =========================================================================

create or replace function public.registrar_devolucion_menaje(
  p_reserva_id uuid,
  p_evento_id  uuid,
  p_items      jsonb
)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_mov_id uuid;
  v_hay_faltante boolean;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay items para devolución.';
  end if;

  -- Idempotencia: sin esto, devolver dos veces desbalancea el stock.
  if exists (
    select 1 from public.menaje_movimientos
    where reserva_id = p_reserva_id and tipo = 'ingreso'
  ) then
    raise exception 'Esta reserva ya tiene una devolución registrada. Si necesitas corregir, cancela el movimiento existente primero.'
      using errcode = '22023';
  end if;

  select exists (
    select 1 from jsonb_array_elements(p_items) as it
    where (
      coalesce((it->>'cantidad_despachada')::int, 0)
      - coalesce((it->>'cantidad_devuelta')::int, 0)
      - coalesce((it->>'merma')::int, 0)
    ) > 0
  ) into v_hay_faltante;

  insert into public.menaje_movimientos (tipo, estado, evento_id, reserva_id, fecha, notas)
  values (
    'ingreso', 'confirmado', p_evento_id, p_reserva_id, current_date,
    case when v_hay_faltante
      then 'Inventario descompletado — ver detalle por item'
      else 'Devolución de menaje de evento'
    end
  )
  returning id into v_mov_id;

  -- El faltante ahora se persiste. Antes se calculaba acá abajo para descontar
  -- del stock y se perdía; era imposible reconstruir después cuánto se rompió
  -- y cuánto no volvió.
  insert into public.menaje_mov_items (movimiento_id, menaje_id, cantidad, merma, faltante, causa, nota)
  select
    v_mov_id,
    (it->>'menaje_id')::uuid,
    coalesce((it->>'cantidad_devuelta')::int, 0),
    coalesce((it->>'merma')::int, 0),
    greatest(0,
      coalesce((it->>'cantidad_despachada')::int, 0)
      - coalesce((it->>'cantidad_devuelta')::int, 0)
      - coalesce((it->>'merma')::int, 0)
    ),
    nullif(it->>'causa', ''),
    nullif(it->>'nota', '')
  from jsonb_array_elements(p_items) as it;

  -- Merma y faltante descuentan igual del stock: en los dos casos la unidad ya
  -- no está en bodega. Lo que cambia es cómo se le cobra al cliente.
  with perdidas as (
    select
      (it->>'menaje_id')::uuid as menaje_id,
      coalesce((it->>'merma')::int, 0)
        + greatest(0,
            coalesce((it->>'cantidad_despachada')::int, 0)
            - coalesce((it->>'cantidad_devuelta')::int, 0)
            - coalesce((it->>'merma')::int, 0)
          ) as total
    from jsonb_array_elements(p_items) as it
  )
  update public.menaje_catalogo mc
  set stock_total = greatest(0, mc.stock_total - p.total)
  from perdidas p
  where mc.id = p.menaje_id and p.total > 0;

  update public.menaje_reservas set estado = 'devuelto' where id = p_reserva_id;

  return v_mov_id;
end;
$function$;

-- =========================================================================
-- 4) El reporte para facturar
-- =========================================================================

create or replace function public.fn_reporte_facturacion_evento(p_evento_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_cotizado numeric := 0;
  v_perdido  numeric := 0;
  v_menaje   jsonb   := '[]'::jsonb;
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
           -- Varias filas del mismo artículo pueden traer causas distintas;
           -- se listan todas en vez de inventar una sola.
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
    'total_a_facturar', v_cotizado + v_perdido,
    'menaje', v_menaje,
    -- Banderas para que la pantalla pueda decir "este reporte todavía no está
    -- listo para facturar" en vez de mostrar un total incompleto sin avisar.
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
  'Todo lo que hace falta para facturar un evento: lo cotizado (de cotizaciones.total_cotizado, que respeta descuentos y lugar), más el menaje roto o no devuelto valorizado a costo de reposición. Incluye banderas de si el reporte está completo.';

grant execute on function public.fn_reporte_facturacion_evento(uuid) to authenticated;

-- =========================================================================
-- 5) Las dos RPC que solo vivían en la base remota
-- =========================================================================

-- `despachar_menaje_desde_reserva` y `registrar_compra_en_inventario` se
-- aplicaron a mano en el SQL Editor y nunca quedaron en el repo (ver
-- AUDIT_PASO_1.md). Se recuperan tal cual están en producción con
-- pg_get_functiondef: si se pierde el acceso al proyecto Supabase o hay que
-- recrear el entorno, esta lógica no era reproducible desde el código.

create or replace function public.despachar_menaje_desde_reserva(
  p_reserva_id uuid,
  p_evento_id  uuid,
  p_items      jsonb
)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_mov_id uuid;
  v_is_parcial boolean;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La reserva no tiene items.';
  end if;

  if exists (
    select 1 from public.menaje_movimientos
    where reserva_id = p_reserva_id and tipo = 'salida'
  ) then
    raise exception 'El menaje ya fue despachado para esta reserva.';
  end if;

  select exists (
    select 1 from jsonb_array_elements(p_items) as it
    where (it->>'cantidad_despachada')::numeric < (it->>'cantidad_reservada')::numeric
  ) into v_is_parcial;

  insert into public.menaje_movimientos (tipo, estado, evento_id, reserva_id, fecha, notas)
  values (
    'salida', 'confirmado', p_evento_id, p_reserva_id, current_date,
    case when v_is_parcial
      then 'Despacho parcial — ver notas por item'
      else 'Despacho de menaje para evento'
    end
  )
  returning id into v_mov_id;

  insert into public.menaje_mov_items (movimiento_id, menaje_id, cantidad, merma, nota)
  select
    v_mov_id,
    (it->>'menaje_id')::uuid,
    coalesce((it->>'cantidad_despachada')::int, 0),
    0,
    nullif(it->>'nota', '')
  from jsonb_array_elements(p_items) as it;

  return v_mov_id;
end;
$function$;

create or replace function public.registrar_compra_en_inventario(
  p_orden_id  uuid,
  p_evento_id uuid
)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_mov_id uuid;
begin
  if not exists (
    select 1 from public.evento_orden_compra_items
    where orden_id = p_orden_id and cantidad_comprar > 0 and ingrediente_id is not null
  ) then
    return null;
  end if;

  insert into public.inventario_movimientos (tipo, estado, evento_id, fecha, notas)
  values ('compra', 'confirmado', p_evento_id, current_date, 'Compra desde orden de evento')
  returning id into v_mov_id;

  insert into public.inventario_mov_items (movimiento_id, ingrediente_id, cantidad, costo_unitario)
  select v_mov_id, i.ingrediente_id, i.cantidad_comprar, i.costo_unitario
  from public.evento_orden_compra_items i
  where i.orden_id = p_orden_id and i.cantidad_comprar > 0 and i.ingrediente_id is not null;

  update public.ingredientes_catalogo c
  set stock_actual = coalesce(c.stock_actual, 0) + i.cantidad_comprar
  from public.evento_orden_compra_items i
  where i.orden_id = p_orden_id and i.cantidad_comprar > 0 and i.ingrediente_id = c.id;

  return v_mov_id;
end;
$function$;
