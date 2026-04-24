-- Sistema de roles para Selecta.
-- 4 roles fijos: admin, comercial, operaciones, cocina.
-- Un usuario puede tener varios roles (aunque hoy la UI asume 1).
-- has_role() se usa en RLS y en route guards del frontend.

create type public.user_role as enum ('admin', 'comercial', 'operaciones', 'cocina');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null,
  created_at timestamptz default now(),
  unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles(user_id);

alter table public.user_roles enable row level security;

-- security definer para que has_role funcione desde RLS de otras tablas
-- sin infinite recursion en las policies de user_roles.
create or replace function public.has_role(_role public.user_role)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = _role
  );
$$;

grant execute on function public.has_role(public.user_role) to authenticated;

create policy "Usuarios ven sus propios roles"
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admin gestiona todos los roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- Asignar admin a los usuarios actuales (Tomás y jpgomez)
insert into public.user_roles (user_id, role)
select id, 'admin'::public.user_role
from auth.users
where email in ('tomasmejiarico122@gmail.com', 'jpgomez@stayirrelevant.com')
on conflict do nothing;
