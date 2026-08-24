-- Dos caminos escriben movimientos de menaje: los RPC atomicos
-- (despachar_menaje_desde_reserva / registrar_devolucion_menaje) que usa
-- ReservaDetalleDialog, y el CRUD manual de MovimientoDialog, que los esquiva.
-- Esta migracion cierra las dos formas en que eso rompe el inventario.

-- ------------------------------------------------------------------- 1
-- Los dos RPC ya validan con `if exists (...)` que una reserva no se despache
-- ni se devuelva dos veces, pero esa comprobacion no sirve contra el CRUD
-- manual, que inserta directo, ni contra dos llamadas simultaneas: ambas leen
-- antes de que la otra escriba y las dos pasan.
--
-- Peor aun: una salida creada a mano hace que el RPC se niegue a correr, asi
-- que la reserva queda marcada como despachada sin haber pasado por las
-- validaciones. El indice lo vuelve imposible por cualquiera de los caminos.
create unique index if not exists menaje_movimientos_uno_por_reserva_y_tipo
  on public.menaje_movimientos (reserva_id, tipo)
  where reserva_id is not null;

comment on index public.menaje_movimientos_uno_por_reserva_y_tipo is
  'Una sola salida y una sola devolucion por reserva. Backstop de los RPC, que dan el mensaje amable antes de llegar aca.';

-- ------------------------------------------------------------------- 2
-- El trigger descuenta del stock la merma, pero no el faltante. Cuando se
-- agrego `faltante` para separar lo roto de lo perdido, el RPC de devolucion
-- se actualizo y este trigger no: una devolucion registrada por el camino
-- manual dejaba en el inventario unas piezas que ya nadie tiene.
--
-- No hay riesgo de descontar dos veces: los RPC insertan con estado
-- 'confirmado' de una, y este trigger solo corre en la TRANSICION a confirmado
-- (NEW.estado = 'confirmado' and OLD.estado <> 'confirmado'), que nunca ocurre
-- para una fila que nacio confirmada.
create or replace function public.apply_merma_on_confirm()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  mov record;
  it  record;
begin
  if (TG_OP = 'UPDATE') then
    if (NEW.estado = 'confirmado' and OLD.estado <> 'confirmado') then
      select * into mov from public.menaje_movimientos where id = NEW.id;
      if mov.tipo = 'ingreso' then
        for it in
          select mi.menaje_id,
                 coalesce(mi.merma, 0) + coalesce(mi.faltante, 0) as perdido
          from public.menaje_mov_items mi
          where mi.movimiento_id = mov.id
        loop
          if it.perdido > 0 then
            update public.menaje_catalogo
            set stock_total = greatest(0, stock_total - it.perdido)
            where id = it.menaje_id;
          end if;
        end loop;
      end if;
    end if;
  end if;
  return NEW;
end;
$function$;

comment on function public.apply_merma_on_confirm() is
  'Al confirmar un ingreso, descuenta del stock lo roto (merma) y lo no devuelto (faltante). Solo corre en la transicion a confirmado.';
