-- Carga masiva de costos de insumos desde Excel.
--
-- El flujo manual (IngredientesTable) es: crear/actualizar la fila de
-- ingrediente_proveedores → marcarla principal → sincronizar
-- ingredientes_catalogo.costo_por_unidad. Hacer eso desde el cliente para 300
-- filas son ~900 round trips y, si se cae a mitad, deja media carga aplicada
-- sin forma de saber dónde quedó. Esta RPC hace todo el lote en una
-- transacción: o entra completo o no entra nada.
--
-- Payload esperado:
-- [{ ingrediente_id, proveedor, presentacion_cantidad, presentacion_unidad,
--    precio_presentacion, costo_por_unidad_base }, ...]
--
-- El costo_por_unidad_base llega ya convertido a la unidad base del
-- ingrediente desde el cliente (misma función `convertirAUnidadBase` que usa
-- el alta manual y el escáner de facturas), para no duplicar la tabla de
-- conversiones en SQL y que las dos rutas no se desincronicen.

create or replace function public.fn_bulk_upsert_costos_proveedor(
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_row            jsonb;
  v_ingrediente_id uuid;
  v_proveedor      text;
  v_proveedor_id   uuid;
  v_creados        int := 0;
  v_actualizados   int := 0;
begin
  if jsonb_typeof(p_payload) <> 'array' then
    raise exception 'p_payload debe ser un array de filas';
  end if;

  for v_row in select * from jsonb_array_elements(p_payload)
  loop
    v_ingrediente_id := (v_row->>'ingrediente_id')::uuid;
    v_proveedor      := btrim(v_row->>'proveedor');

    if v_ingrediente_id is null or v_proveedor is null or v_proveedor = '' then
      raise exception 'Fila inválida: ingrediente_id y proveedor son obligatorios (%)', v_row;
    end if;

    -- Bloqueamos el ingrediente para que dos cargas simultáneas no se pisen
    -- el proveedor principal.
    perform 1 from public.ingredientes_catalogo
    where id = v_ingrediente_id
    for update;

    if not found then
      raise exception 'El ingrediente % no existe', v_ingrediente_id;
    end if;

    -- Match case-insensitive: el Excel del cliente no es consistente con
    -- mayúsculas ("Colanta" vs "COLANTA") y no queremos duplicar proveedores.
    select id into v_proveedor_id
    from public.ingrediente_proveedores
    where ingrediente_id = v_ingrediente_id
      and lower(btrim(proveedor)) = lower(v_proveedor)
    limit 1;

    if v_proveedor_id is null then
      insert into public.ingrediente_proveedores (
        ingrediente_id, proveedor, presentacion_cantidad, presentacion_unidad,
        precio_presentacion, costo_por_unidad_base, es_principal
      ) values (
        v_ingrediente_id,
        v_proveedor,
        (v_row->>'presentacion_cantidad')::numeric,
        v_row->>'presentacion_unidad',
        (v_row->>'precio_presentacion')::numeric,
        (v_row->>'costo_por_unidad_base')::numeric,
        false
      )
      returning id into v_proveedor_id;

      v_creados := v_creados + 1;
    else
      update public.ingrediente_proveedores
      set presentacion_cantidad = (v_row->>'presentacion_cantidad')::numeric,
          presentacion_unidad   = v_row->>'presentacion_unidad',
          precio_presentacion   = (v_row->>'precio_presentacion')::numeric,
          costo_por_unidad_base = (v_row->>'costo_por_unidad_base')::numeric
      where id = v_proveedor_id;

      v_actualizados := v_actualizados + 1;
    end if;

    -- Mismo efecto que fn_set_proveedor_principal, en línea para no pagar
    -- el lookup dos veces por fila.
    update public.ingrediente_proveedores
    set es_principal = false
    where ingrediente_id = v_ingrediente_id
      and id <> v_proveedor_id;

    update public.ingrediente_proveedores
    set es_principal = true
    where id = v_proveedor_id;

    update public.ingredientes_catalogo
    set costo_por_unidad = (v_row->>'costo_por_unidad_base')::numeric
    where id = v_ingrediente_id;
  end loop;

  return jsonb_build_object(
    'creados', v_creados,
    'actualizados', v_actualizados
  );
end;
$$;

grant execute on function public.fn_bulk_upsert_costos_proveedor(jsonb) to authenticated;
