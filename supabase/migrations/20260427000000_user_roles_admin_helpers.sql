-- Helpers para que un admin gestione roles desde la UI sin acceso directo a auth.users.
-- Tres RPCs SECURITY DEFINER, todas con guard explícito por has_role('admin').
-- has_role() ya existe (migration 20260424000000_roles_sistema.sql) y es la única
-- forma de validar privilegios sin caer en recursión sobre user_roles.

-- 1) Listado de usuarios con sus roles agregados.
create or replace function public.list_users_with_roles()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  roles public.user_role[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Solo administradores pueden listar usuarios' using errcode = '42501';
  end if;

  return query
    select
      u.id,
      u.email::text,
      u.created_at,
      u.last_sign_in_at,
      coalesce(
        array_agg(ur.role order by ur.role) filter (where ur.role is not null),
        '{}'::public.user_role[]
      ) as roles
    from auth.users u
    left join public.user_roles ur on ur.user_id = u.id
    group by u.id, u.email, u.created_at, u.last_sign_in_at
    order by u.email;
end;
$$;

-- 2) Asignar un rol. Idempotente.
create or replace function public.assign_role(target_user_id uuid, target_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Solo administradores pueden asignar roles' using errcode = '42501';
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, target_role)
  on conflict (user_id, role) do nothing;
end;
$$;

-- 3) Quitar un rol. Idempotente.
create or replace function public.revoke_role(target_user_id uuid, target_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Solo administradores pueden quitar roles' using errcode = '42501';
  end if;

  delete from public.user_roles
  where user_id = target_user_id and role = target_role;
end;
$$;

grant execute on function public.list_users_with_roles() to authenticated;
grant execute on function public.assign_role(uuid, public.user_role) to authenticated;
grant execute on function public.revoke_role(uuid, public.user_role) to authenticated;
