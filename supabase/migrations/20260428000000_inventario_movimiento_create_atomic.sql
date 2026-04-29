-- RPC atómico para crear movimiento de inventario + sus items en una sola transacción.
-- Cierra el último gap de atomicidad en inventario: hoy `apiInventario.ts` hace 2 INSERTs
-- separados (movimiento + items). Si la 2da falla, queda un movimiento huérfano sin items.
-- Este RPC envuelve todo en una transacción única y opcionalmente confirma el movimiento
-- reusando `fn_inventario_movimiento_confirmar` (que aplica el delta de stock atómicamente).

create or replace function public.fn_inventario_movimiento_create_atomic(
  p_payload jsonb,
  p_confirmar boolean default false
)
returns public.inventario_movimientos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mov public.inventario_movimientos;
  v_movimiento jsonb;
  v_items jsonb;
  v_tipo text;
  v_item jsonb;
begin
  -- 1) Validar estructura del payload.
  v_movimiento := p_payload->'movimiento';
  if v_movimiento is null or jsonb_typeof(v_movimiento) != 'object' then
    raise exception 'Payload debe incluir "movimiento" como objeto'
      using errcode = '22023';
  end if;

  v_items := p_payload->'items';
  if v_items is null or jsonb_typeof(v_items) != 'array' then
    raise exception 'Payload debe incluir "items" como array'
      using errcode = '22023';
  end if;

  -- 2) Validar tipo de movimiento (replica el CHECK de la tabla, falla más temprano y claro).
  v_tipo := v_movimiento->>'tipo';
  if v_tipo is null or v_tipo not in ('compra', 'uso', 'ajuste', 'devolucion') then
    raise exception 'El movimiento requiere "tipo" en (compra, uso, ajuste, devolucion)'
      using errcode = '22023';
  end if;

  -- 3) Insertar la cabecera del movimiento en estado borrador.
  insert into public.inventario_movimientos (
    tipo,
    fecha,
    estado,
    evento_id,
    proveedor,
    notas,
    factura_url
  )
  values (
    v_tipo,
    coalesce((v_movimiento->>'fecha')::date, current_date),
    coalesce(nullif(v_movimiento->>'estado', ''), 'borrador'),
    nullif(v_movimiento->>'evento_id', '')::uuid,
    nullif(v_movimiento->>'proveedor', ''),
    nullif(v_movimiento->>'notas', ''),
    nullif(v_movimiento->>'factura_url', '')
  )
  returning * into v_mov;

  -- 4) Insertar los items asociados.
  for v_item in select * from jsonb_array_elements(v_items)
  loop
    insert into public.inventario_mov_items (
      movimiento_id,
      ingrediente_id,
      cantidad,
      costo_unitario
    )
    values (
      v_mov.id,
      (v_item->>'ingrediente_id')::uuid,
      (v_item->>'cantidad')::numeric,
      coalesce((v_item->>'costo_unitario')::numeric, 0)
    );
  end loop;

  -- 5) Si el caller pidió confirmar, delegamos en el RPC existente que aplica
  --    el delta de stock con FOR UPDATE y devuelve la fila ya en estado 'confirmado'.
  if p_confirmar then
    perform public.fn_inventario_movimiento_confirmar(v_mov.id);
    select * into v_mov
    from public.inventario_movimientos
    where id = v_mov.id;
  end if;

  return v_mov;
end;
$$;

grant execute on function public.fn_inventario_movimiento_create_atomic(jsonb, boolean) to authenticated;

comment on function public.fn_inventario_movimiento_create_atomic(jsonb, boolean)
  is 'RPC atómico: crea cabecera + items de un movimiento de inventario en una sola transacción. Si p_confirmar=true delega en fn_inventario_movimiento_confirmar para aplicar el delta de stock. Reemplaza los 2 INSERTs sueltos que hacía apiInventario.ts y elimina el riesgo de movimientos huérfanos sin items.';
