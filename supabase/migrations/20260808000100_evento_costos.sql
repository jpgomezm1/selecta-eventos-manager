-- Rentabilidad por evento.
--
-- Los ingresos del evento ya viven en las tablas evento_requerimiento_* (lo
-- que se le cobra al cliente) y una parte de los costos es derivable: el costo
-- de alimentos sale del recetario y el de personal de evento_personal.pago_calculado.
-- Lo que faltaba es dónde registrar los costos que la app no conoce —
-- decoración, flores, AV, fletes, gastos administrativos — que hoy el cliente
-- lleva en un Excel aparte.
--
-- Esta tabla es solo para esos costos manuales. Los derivados NO se guardan:
-- se recalculan al vuelo para que un cambio de costo de insumo se refleje en
-- el margen sin tener que reprocesar eventos.

create table if not exists public.evento_costos (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references public.eventos(id) on delete cascade,
  categoria    text not null,
  descripcion  text,
  proveedor    text,
  monto        numeric not null default 0 check (monto >= 0),
  estado_pago  text not null default 'pendiente'
               check (estado_pago in ('pendiente', 'anticipo', 'pagado', 'credito')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists evento_costos_evento_id_idx
  on public.evento_costos(evento_id);

-- Reserva de imprevistos como % del costo total, igual que en el formato de
-- briefing financiero que usa el cliente. Vive en el evento y no en una fila
-- de costo porque se aplica sobre el total, no es un gasto puntual.
alter table public.eventos
  add column if not exists imprevisto_pct numeric not null default 0
  check (imprevisto_pct >= 0 and imprevisto_pct <= 100);

alter table public.evento_costos enable row level security;

-- Mismo criterio que el resto de tablas de evento: admin y operaciones
-- gestionan; comercial y cocina leen (necesitan ver el margen para cotizar y
-- para entender por qué se les pide ajustar un menú).
drop policy if exists "evento_costos: rol select" on public.evento_costos;
create policy "evento_costos: rol select" on public.evento_costos
  for select to authenticated
  using (
    public.has_role('admin') or public.has_role('operaciones')
    or public.has_role('comercial') or public.has_role('cocina')
  );

drop policy if exists "evento_costos: rol write" on public.evento_costos;
create policy "evento_costos: rol write" on public.evento_costos
  for all to authenticated
  using (public.has_role('admin') or public.has_role('operaciones'))
  with check (public.has_role('admin') or public.has_role('operaciones'));
