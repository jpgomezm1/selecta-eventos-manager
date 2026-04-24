-- RPCs atómicas para confirmar y borrar/reversar movimientos de inventario.
-- Reemplaza los loops manuales de apiInventario.ts que podían dejar stock
-- inconsistente si fallaban a mitad de camino.
--
-- Ambas funciones:
--   - toman solo el movimiento_id (leen los items de la DB)
--   - bloquean filas involucradas con FOR UPDATE para serializar con
--     operaciones concurrentes sobre el mismo ingrediente o movimiento
--   - lanzan excepción y hacen rollback si alguna validación falla
--   - son SECURITY INVOKER (respetan las RLS policies del caller)

create or replace function public.fn_inventario_movimiento_confirmar(
  p_movimiento_id uuid
)
returns public.inventario_movimientos
language plpgsql
security invoker
as $$
declare
  v_mov public.inventario_movimientos;
  v_item record;
  v_stock numeric;
  v_nombre text;
  v_new_stock numeric;
begin
  select * into v_mov
  from public.inventario_movimientos
  where id = p_movimiento_id
  for update;

  if not found then
    raise exception 'Movimiento % no existe', p_movimiento_id;
  end if;

  if v_mov.estado = 'confirmado' then
    raise exception 'Movimiento % ya estaba confirmado', p_movimiento_id;
  end if;

  for v_item in
    select ingrediente_id, cantidad
    from public.inventario_mov_items
    where movimiento_id = p_movimiento_id
  loop
    select stock_actual, nombre
    into v_stock, v_nombre
    from public.ingredientes_catalogo
    where id = v_item.ingrediente_id
    for update;

    if not found then
      raise exception 'Ingrediente % no existe', v_item.ingrediente_id;
    end if;

    if v_mov.tipo = 'compra' then
      v_new_stock := v_stock + v_item.cantidad;
    elsif v_mov.tipo in ('uso', 'devolucion') then
      if v_stock < v_item.cantidad then
        raise exception
          'Stock insuficiente para "%": hay %, se intenta descontar %',
          v_nombre, v_stock, v_item.cantidad;
      end if;
      v_new_stock := v_stock - v_item.cantidad;
    elsif v_mov.tipo = 'ajuste' then
      v_new_stock := v_item.cantidad;
    else
      raise exception 'Tipo de movimiento desconocido: %', v_mov.tipo;
    end if;

    update public.ingredientes_catalogo
    set stock_actual = v_new_stock
    where id = v_item.ingrediente_id;
  end loop;

  update public.inventario_movimientos
  set estado = 'confirmado'
  where id = p_movimiento_id
  returning * into v_mov;

  return v_mov;
end;
$$;


create or replace function public.fn_inventario_movimiento_delete_con_reversa(
  p_movimiento_id uuid
)
returns void
language plpgsql
security invoker
as $$
declare
  v_mov public.inventario_movimientos;
  v_item record;
  v_stock numeric;
  v_nombre text;
  v_new_stock numeric;
begin
  select * into v_mov
  from public.inventario_movimientos
  where id = p_movimiento_id
  for update;

  if not found then
    raise exception 'Movimiento % no existe', p_movimiento_id;
  end if;

  if v_mov.estado = 'confirmado' then
    for v_item in
      select ingrediente_id, cantidad
      from public.inventario_mov_items
      where movimiento_id = p_movimiento_id
    loop
      select stock_actual, nombre
      into v_stock, v_nombre
      from public.ingredientes_catalogo
      where id = v_item.ingrediente_id
      for update;

      if not found then
        raise exception 'Ingrediente % no existe', v_item.ingrediente_id;
      end if;

      if v_mov.tipo = 'compra' then
        if v_stock < v_item.cantidad then
          raise exception
            'No se puede reversar la compra de "%": stock actual % es menor que % (probablemente ya se consumió).',
            v_nombre, v_stock, v_item.cantidad;
        end if;
        v_new_stock := v_stock - v_item.cantidad;
      elsif v_mov.tipo in ('uso', 'devolucion') then
        v_new_stock := v_stock + v_item.cantidad;
      else
        -- 'ajuste' no tiene reversa significativa: se deja el stock como está.
        v_new_stock := v_stock;
      end if;

      update public.ingredientes_catalogo
      set stock_actual = v_new_stock
      where id = v_item.ingrediente_id;
    end loop;
  end if;

  delete from public.inventario_mov_items where movimiento_id = p_movimiento_id;
  delete from public.inventario_movimientos where id = p_movimiento_id;
end;
$$;


grant execute on function public.fn_inventario_movimiento_confirmar(uuid) to authenticated;
grant execute on function public.fn_inventario_movimiento_delete_con_reversa(uuid) to authenticated;
