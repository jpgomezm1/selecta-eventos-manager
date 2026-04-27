-- Trazabilidad de cambios en cotizaciones.
--
-- Tabla genérica `cotizacion_audit_log` que registra cambios sensibles —
-- pricing (total, total_override) y state machine (estado, is_definitiva).
-- Cada fila identifica al usuario (auth.uid()) que realizó el cambio.
--
-- Por qué solo estos campos: cantidad/precio_unitario de items individuales
-- generan ruido cuando alguien edita una opción de varias líneas; el cambio
-- agregado se ve en el `total` de la versión. Si más adelante se necesita
-- granularidad por línea, se agregan triggers para items.

-- 1) Tabla del log.
create table public.cotizacion_audit_log (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid references public.cotizaciones(id) on delete cascade,
  cotizacion_version_id uuid references public.cotizacion_versiones(id) on delete cascade,
  table_name text not null,
  field text not null,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create index cotizacion_audit_log_cot_idx
  on public.cotizacion_audit_log(cotizacion_id, changed_at desc);
create index cotizacion_audit_log_ver_idx
  on public.cotizacion_audit_log(cotizacion_version_id, changed_at desc);

-- 2) RLS: lectura para los mismos roles que ven cotizaciones (admin,
--    comercial, operaciones); inserción solo a través de los triggers
--    (que corren con security definer, así que ignoran RLS).
alter table public.cotizacion_audit_log enable row level security;

create policy "audit log: select por rol"
  on public.cotizacion_audit_log for select to authenticated
  using (public.has_role('admin') or public.has_role('comercial') or public.has_role('operaciones'));

-- 3) Trigger fn — log condicional. Recibe el nombre de la tabla, los IDs
--    relevantes, y un par (field, old, new). Si old IS DISTINCT FROM new,
--    inserta. JSONB para preservar tipos.
create or replace function public.log_cotizacion_change(
  p_table text,
  p_cotizacion_id uuid,
  p_version_id uuid,
  p_field text,
  p_old jsonb,
  p_new jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_old is distinct from p_new then
    insert into public.cotizacion_audit_log (
      cotizacion_id, cotizacion_version_id, table_name, field,
      old_value, new_value, changed_by
    ) values (
      p_cotizacion_id, p_version_id, p_table, p_field,
      p_old, p_new, auth.uid()
    );
  end if;
end;
$$;

-- 4) Trigger en cotizacion_versiones — registra cambios de precio + estado.
create or replace function public.trg_audit_cotizacion_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_cotizacion_change(
    'cotizacion_versiones', NEW.cotizacion_id, NEW.id,
    'total', to_jsonb(OLD.total), to_jsonb(NEW.total)
  );
  perform public.log_cotizacion_change(
    'cotizacion_versiones', NEW.cotizacion_id, NEW.id,
    'total_override', to_jsonb(OLD.total_override), to_jsonb(NEW.total_override)
  );
  perform public.log_cotizacion_change(
    'cotizacion_versiones', NEW.cotizacion_id, NEW.id,
    'nombre_opcion', to_jsonb(OLD.nombre_opcion), to_jsonb(NEW.nombre_opcion)
  );
  perform public.log_cotizacion_change(
    'cotizacion_versiones', NEW.cotizacion_id, NEW.id,
    'estado', to_jsonb(OLD.estado), to_jsonb(NEW.estado)
  );
  perform public.log_cotizacion_change(
    'cotizacion_versiones', NEW.cotizacion_id, NEW.id,
    'is_definitiva', to_jsonb(OLD.is_definitiva), to_jsonb(NEW.is_definitiva)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_audit_cotizacion_version on public.cotizacion_versiones;
create trigger trg_audit_cotizacion_version
  after update on public.cotizacion_versiones
  for each row execute function public.trg_audit_cotizacion_version();

-- 5) Trigger en cotizaciones — registra cambios de estado y monto cabecera.
create or replace function public.trg_audit_cotizacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.log_cotizacion_change(
    'cotizaciones', NEW.id, null,
    'estado', to_jsonb(OLD.estado), to_jsonb(NEW.estado)
  );
  perform public.log_cotizacion_change(
    'cotizaciones', NEW.id, null,
    'total_cotizado', to_jsonb(OLD.total_cotizado), to_jsonb(NEW.total_cotizado)
  );
  perform public.log_cotizacion_change(
    'cotizaciones', NEW.id, null,
    'numero_invitados', to_jsonb(OLD.numero_invitados), to_jsonb(NEW.numero_invitados)
  );
  return NEW;
end;
$$;

drop trigger if exists trg_audit_cotizacion on public.cotizaciones;
create trigger trg_audit_cotizacion
  after update on public.cotizaciones
  for each row execute function public.trg_audit_cotizacion();

-- 6) Trigger AFTER INSERT en versiones para registrar la creación inicial
--    (con el total inicial y override si llegó).
create or replace function public.trg_audit_cotizacion_version_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cotizacion_audit_log (
    cotizacion_id, cotizacion_version_id, table_name, field,
    old_value, new_value, changed_by
  ) values (
    NEW.cotizacion_id, NEW.id, 'cotizacion_versiones', 'created',
    null,
    jsonb_build_object(
      'nombre_opcion', NEW.nombre_opcion,
      'total', NEW.total,
      'total_override', NEW.total_override,
      'estado', NEW.estado
    ),
    auth.uid()
  );
  return NEW;
end;
$$;

drop trigger if exists trg_audit_cotizacion_version_insert on public.cotizacion_versiones;
create trigger trg_audit_cotizacion_version_insert
  after insert on public.cotizacion_versiones
  for each row execute function public.trg_audit_cotizacion_version_insert();
