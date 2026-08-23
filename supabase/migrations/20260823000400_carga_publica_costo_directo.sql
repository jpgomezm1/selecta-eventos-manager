-- Precio de un insumo sin tener que nombrar al proveedor.
--
-- La grilla exigía proveedor para poder guardar un costo. Los datos dicen otra
-- cosa: de los 55 insumos con costo, 40 no tienen ninguna fila en
-- `ingrediente_proveedores`. El costo vive en
-- `ingredientes_catalogo.costo_por_unidad` y la fila de proveedor es opcional —
-- cuando existe, su `costo_por_unidad_base` es la fuente y el campo del insumo
-- es el espejo.
--
-- Así que esto no agrega un estado nuevo: destapa el que ya era mayoritario.
--
-- Regla: solo se puede fijar el costo a mano si el insumo NO tiene proveedores.
-- Con proveedores, el costo es derivado del principal y cualquier valor puesto
-- a mano lo pisaría el próximo guardado sin que nadie se entere. En ese caso la
-- función rechaza y manda a editar el proveedor, que es donde el dato manda.
--
-- La presentación no se guarda en este camino (no hay dónde: esas columnas
-- viven en la fila de proveedor). La pantalla igual la pide para hacer la
-- división ella misma — que el cliente escriba "25 kg por $120.000" y no
-- "$4.800" — pero lo que queda persistido es el costo por unidad base.

create or replace function public.fn_carga_publica_costo_directo(
  p_token         text,
  p_ingrediente_id uuid,
  p_costo         numeric
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cuantos integer;
begin
  perform public.fn_carga_token_id(p_token);

  if p_ingrediente_id is null
     or not exists (select 1 from public.ingredientes_catalogo where id = p_ingrediente_id) then
    raise exception 'El insumo no existe' using errcode = '22023';
  end if;
  if p_costo is null or p_costo < 0 then
    raise exception 'El costo no puede ser negativo' using errcode = '22023';
  end if;

  perform 1 from public.ingredientes_catalogo where id = p_ingrediente_id for update;

  select count(*) into v_cuantos
  from public.ingrediente_proveedores
  where ingrediente_id = p_ingrediente_id;

  if v_cuantos > 0 then
    raise exception 'Este insumo ya tiene proveedor: cambien el precio ahí para que los dos números no se contradigan'
      using errcode = '22023';
  end if;

  -- p_costo = 0 es la forma de borrarlo y dejar el insumo sin costo otra vez.
  update public.ingredientes_catalogo
  set costo_por_unidad = p_costo
  where id = p_ingrediente_id;

  return p_costo;
end;
$$;

revoke all on function public.fn_carga_publica_costo_directo(text, uuid, numeric) from public;
grant execute on function public.fn_carga_publica_costo_directo(text, uuid, numeric) to anon, authenticated;
