-- RPC atómica para marcar un proveedor como principal de un ingrediente.
-- Reemplaza la secuencia de 3 writes de apiCotizador.ts que, si fallaba a mitad,
-- dejaba al ingrediente sin proveedor principal (e1 commit + e2 fail) o con el
-- costo desincronizado del proveedor activo (e1 y e2 commit + e3 fail).

create or replace function public.fn_set_proveedor_principal(
  p_ingrediente_id uuid,
  p_proveedor_id uuid
)
returns void
language plpgsql
security invoker
as $$
declare
  v_costo numeric;
begin
  perform 1
  from public.ingrediente_proveedores
  where id = p_proveedor_id and ingrediente_id = p_ingrediente_id
  for update;

  if not found then
    raise exception 'Proveedor % no existe o no pertenece al ingrediente %',
      p_proveedor_id, p_ingrediente_id;
  end if;

  update public.ingrediente_proveedores
  set es_principal = false
  where ingrediente_id = p_ingrediente_id
    and id <> p_proveedor_id;

  update public.ingrediente_proveedores
  set es_principal = true
  where id = p_proveedor_id
  returning costo_por_unidad_base into v_costo;

  update public.ingredientes_catalogo
  set costo_por_unidad = coalesce(v_costo, 0)
  where id = p_ingrediente_id;
end;
$$;

grant execute on function public.fn_set_proveedor_principal(uuid, uuid) to authenticated;
