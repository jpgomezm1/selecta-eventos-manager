-- Endurece registrar_devolucion_menaje: rechaza si la reserva ya tiene un
-- movimiento de tipo "ingreso" registrado. La UI ya bloquea el botón cuando
-- la reserva pasa a estado "devuelto", pero un cliente que llame el RPC
-- directo (con JWT, vía MCP, etc.) podía registrar múltiples devoluciones e
-- inflar/reducir el stock arbitrariamente.
--
-- Defense in depth — la UI sigue siendo el primer guard (botón oculto), la BD
-- es la red de seguridad final.

create or replace function public.registrar_devolucion_menaje(
  p_reserva_id uuid,
  p_evento_id uuid,
  p_items jsonb
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

  -- Idempotencia: una reserva sólo puede tener UNA devolución (movimiento
  -- ingreso). Bloquea segundas llamadas que inflan o desbalancean el stock.
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
    'ingreso',
    'confirmado',
    p_evento_id,
    p_reserva_id,
    current_date,
    case when v_hay_faltante
      then 'Inventario descompletado — ver detalle por item'
      else 'Devolución de menaje de evento'
    end
  )
  returning id into v_mov_id;

  insert into public.menaje_mov_items (movimiento_id, menaje_id, cantidad, merma, nota)
  select
    v_mov_id,
    (it->>'menaje_id')::uuid,
    coalesce((it->>'cantidad_devuelta')::int, 0),
    coalesce((it->>'merma')::int, 0),
    nullif(it->>'nota', '')
  from jsonb_array_elements(p_items) as it;

  -- Descontar (merma + faltante) del stock en una única sentencia.
  with losses as (
    select
      (it->>'menaje_id')::uuid as menaje_id,
      coalesce((it->>'merma')::int, 0)
        + greatest(0,
            coalesce((it->>'cantidad_despachada')::int, 0)
            - coalesce((it->>'cantidad_devuelta')::int, 0)
            - coalesce((it->>'merma')::int, 0)
          ) as total_loss
    from jsonb_array_elements(p_items) as it
  )
  update public.menaje_catalogo mc
  set stock_total = greatest(0, mc.stock_total - l.total_loss)
  from losses l
  where mc.id = l.menaje_id and l.total_loss > 0;

  update public.menaje_reservas set estado = 'devuelto' where id = p_reserva_id;

  return v_mov_id;
end;
$function$;
