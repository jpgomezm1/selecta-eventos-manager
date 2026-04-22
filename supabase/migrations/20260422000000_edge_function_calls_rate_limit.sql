-- Tabla de tracking para rate-limit de edge functions.
-- Cada fila = una invocación de una edge function por un usuario autenticado.
-- La edge function hace count en ventana de 60s y rechaza si excede el umbral.
--
-- RLS ON + sin policies: solo el service role escribe/lee (bypassa RLS).
-- Los usuarios autenticados no pueden consultar ni insertar desde el cliente.

create table if not exists public.edge_function_calls (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  function_name text not null,
  called_at     timestamptz not null default now()
);

create index if not exists edge_function_calls_user_fn_called_idx
  on public.edge_function_calls (user_id, function_name, called_at desc);

alter table public.edge_function_calls enable row level security;

-- (Sin policies: bloquea acceso desde cliente; la edge function usa service role.)

comment on table public.edge_function_calls is
  'Tracking de invocaciones de edge functions por usuario para rate-limit server-side. Ver supabase/functions/generate-recipe/index.ts.';
