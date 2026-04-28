-- RPC atómico para crear ingrediente con su primer proveedor.
-- Hoy `NuevoIngredienteDialog` hace 3 ops sin transacción
-- (createIngrediente → createProveedor → updateIngrediente.costo_por_unidad).
-- Si la 2ª falla, queda ingrediente huérfano con costo_por_unidad=0.
-- Este RPC envuelve todo en una transacción única — si cualquier paso
-- falla, rollback automático y el ingrediente no queda creado.
--
-- Roles permitidos: admin o cocina (mismos que tienen WRITE en
-- ingredientes_catalogo según la matriz de RLS).
--
-- Si el payload trae proveedor null, el ingrediente se crea sin
-- proveedor y costo_por_unidad queda en 0 (caso "creo ahora, asigno
-- proveedor después" — válido).

create or replace function public.create_ingrediente_with_proveedor(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ingrediente jsonb;
  v_proveedor jsonb;
  v_ing_id uuid;
  v_costo_base numeric;
  v_proveedor_nombre text;
begin
  -- 1) Guard de rol.
  if not (public.has_role('admin') or public.has_role('cocina')) then
    raise exception 'Solo administración o cocina pueden crear ingredientes' using errcode = '42501';
  end if;

  -- 2) Validar payload.
  v_ingrediente := p_payload->'ingrediente';
  if v_ingrediente is null or jsonb_typeof(v_ingrediente) != 'object' then
    raise exception 'Payload debe incluir "ingrediente" como objeto' using errcode = '22023';
  end if;
  if (v_ingrediente->>'nombre') is null or trim(v_ingrediente->>'nombre') = '' then
    raise exception 'El ingrediente requiere "nombre"' using errcode = '22023';
  end if;
  if (v_ingrediente->>'unidad') is null or trim(v_ingrediente->>'unidad') = '' then
    raise exception 'El ingrediente requiere "unidad"' using errcode = '22023';
  end if;

  -- 3) Insertar ingrediente. costo_por_unidad arranca en 0; si llega
  --    proveedor lo actualizamos abajo con el costo_por_unidad_base.
  insert into public.ingredientes_catalogo (
    nombre, unidad, costo_por_unidad, proveedor
  )
  values (
    trim(v_ingrediente->>'nombre'),
    trim(v_ingrediente->>'unidad'),
    0,
    null
  )
  returning id into v_ing_id;

  -- 4) Si hay proveedor, insertarlo y actualizar el ingrediente con su
  --    costo_por_unidad_base + nombre del proveedor en denormalizado.
  v_proveedor := p_payload->'proveedor';
  if v_proveedor is not null and jsonb_typeof(v_proveedor) != 'null' then
    -- Validación mínima del bloque proveedor.
    if (v_proveedor->>'proveedor') is null or trim(v_proveedor->>'proveedor') = '' then
      raise exception 'Si se incluye proveedor, "proveedor" (nombre) es obligatorio' using errcode = '22023';
    end if;
    if (v_proveedor->>'costo_por_unidad_base') is null then
      raise exception 'Si se incluye proveedor, "costo_por_unidad_base" es obligatorio' using errcode = '22023';
    end if;

    v_costo_base := (v_proveedor->>'costo_por_unidad_base')::numeric;
    v_proveedor_nombre := trim(v_proveedor->>'proveedor');

    insert into public.ingrediente_proveedores (
      ingrediente_id,
      proveedor,
      presentacion_cantidad,
      presentacion_unidad,
      precio_presentacion,
      costo_por_unidad_base,
      es_principal
    )
    values (
      v_ing_id,
      v_proveedor_nombre,
      (v_proveedor->>'presentacion_cantidad')::numeric,
      v_proveedor->>'presentacion_unidad',
      (v_proveedor->>'precio_presentacion')::numeric,
      v_costo_base,
      true
    );

    update public.ingredientes_catalogo
    set costo_por_unidad = v_costo_base,
        proveedor = v_proveedor_nombre
    where id = v_ing_id;
  end if;

  return v_ing_id;
end;
$$;

grant execute on function public.create_ingrediente_with_proveedor(jsonb) to authenticated;

comment on function public.create_ingrediente_with_proveedor(jsonb)
  is 'RPC atómico: crea ingrediente + primer proveedor en una sola transacción. Reemplaza las 3 ops sueltas que hacía NuevoIngredienteDialog y eliminaba el riesgo de ingredientes huérfanos cuando una falla.';
