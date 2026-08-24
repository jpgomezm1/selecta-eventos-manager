-- Soportes de pago recibidos por correo (AgentMail).
--
-- Reemplaza el WhatsApp donde hoy los comerciales mandan los comprobantes. El
-- correo llega a una bandeja; alguien lo concilia contra una factura y ahi
-- nace el abono.
--
-- Ya aplicada en produccion el 2026-08-24; este archivo la deja versionada.

-- ---------------------------------------------------------------- bandeja
create table if not exists public.soportes_pago (
  id                   uuid primary key default gen_random_uuid(),

  -- lo que trae el correo
  remitente            text,
  asunto               text,
  cuerpo               text,
  recibido_at          timestamptz not null default now(),
  archivo_url          text,          -- ruta dentro del bucket soportes-pago
  archivo_nombre       text,

  -- lo que propone la IA: son SUGERENCIAS, no mueven ningun saldo
  monto_detectado      numeric,
  fecha_detectada      date,
  referencia_detectada text,
  banco_detectado      text,

  estado               text not null default 'pendiente'
                         check (estado in ('pendiente','conciliado','descartado')),
  factura_id           uuid references public.facturas_venta(id) on delete set null,
  abono_id             uuid references public.factura_abonos(id) on delete set null,
  conciliado_por       uuid,
  conciliado_at        timestamptz,
  notas                text,
  created_at           timestamptz not null default now(),

  -- trazabilidad AgentMail
  message_id           text,
  thread_id            text,
  inbox_id             text,
  attachment_id        text          -- el adjunto se baja aparte, ver abajo
);

create index if not exists soportes_pago_estado_idx   on public.soportes_pago (estado);
create index if not exists soportes_pago_recibido_idx on public.soportes_pago (recibido_at desc);

-- Svix reintenta los webhooks que fallan, con el mismo message_id. Sin este
-- indice un reintento crearia un soporte duplicado y alguien conciliaria el
-- mismo pago dos veces. Parcial porque las filas cargadas a mano no lo tienen.
create unique index if not exists soportes_pago_message_id_key
  on public.soportes_pago (message_id) where message_id is not null;

alter table public.soportes_pago enable row level security;

drop policy if exists "soportes_pago: rol select" on public.soportes_pago;
create policy "soportes_pago: rol select" on public.soportes_pago
  for select to authenticated
  using (has_role('admin'::user_role) or has_role('comercial'::user_role));

-- Escribir aca es conciliar, y conciliar mueve el saldo de una factura.
drop policy if exists "soportes_pago: rol write" on public.soportes_pago;
create policy "soportes_pago: rol write" on public.soportes_pago
  for all to authenticated
  using (has_role('admin'::user_role))
  with check (has_role('admin'::user_role));

comment on table public.soportes_pago is
  'Bandeja de comprobantes de pago que llegan al buzon de AgentMail. Un soporte no es un abono: se convierte en uno al conciliarlo.';

-- ------------------------------------------------------------ conciliacion
-- En una sola transaccion: crea el abono y marca el soporte. Partido en dos
-- pasos desde el frontend, un fallo a mitad dejaria el abono creado y el
-- soporte pendiente, y alguien lo conciliaria otra vez.
create or replace function public.fn_conciliar_soporte_pago(
  p_soporte_id uuid,
  p_factura_id uuid,
  p_monto      numeric,
  p_fecha      date default null,
  p_metodo     text default null,
  p_referencia text default null
) returns uuid
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_abono_id uuid;
  v_estado   text;
  v_url      text;
begin
  select estado, archivo_url into v_estado, v_url
  from public.soportes_pago where id = p_soporte_id;

  if v_estado is null then
    raise exception 'El soporte no existe' using errcode = '22023';
  end if;
  -- Conciliar dos veces el mismo soporte duplica el abono y el saldo de la
  -- factura queda mal. Es el error mas caro de esta pantalla.
  if v_estado = 'conciliado' then
    raise exception 'Este soporte ya fue conciliado' using errcode = '22023';
  end if;
  if not exists (select 1 from public.facturas_venta where id = p_factura_id and not anulada) then
    raise exception 'La factura no existe o esta anulada' using errcode = '22023';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto del abono tiene que ser mayor que cero' using errcode = '22023';
  end if;

  insert into public.factura_abonos (factura_id, fecha, monto, metodo, referencia, soporte_url, notas)
  values (
    p_factura_id,
    coalesce(p_fecha, current_date),
    p_monto,
    coalesce(p_metodo, 'Transferencia'),
    p_referencia,
    v_url,
    'Conciliado desde soporte recibido por correo'
  )
  returning id into v_abono_id;

  update public.soportes_pago
  set estado         = 'conciliado',
      factura_id     = p_factura_id,
      abono_id       = v_abono_id,
      conciliado_por = auth.uid(),
      conciliado_at  = now()
  where id = p_soporte_id;

  return v_abono_id;
end;
$function$;

comment on function public.fn_conciliar_soporte_pago(uuid,uuid,numeric,date,text,text) is
  'Convierte un soporte de pago en un abono de la factura. Atomica y no reentrante: rechaza el soporte ya conciliado.';

-- Supabase concede execute a anon/authenticated por defecto en toda funcion
-- nueva del esquema public. La funcion es security invoker y las RLS la
-- cubren, pero anon no tiene nada que hacer llamandola.
revoke all on function public.fn_conciliar_soporte_pago(uuid,uuid,numeric,date,text,text) from public, anon;
grant execute on function public.fn_conciliar_soporte_pago(uuid,uuid,numeric,date,text,text) to authenticated;

-- ----------------------------------------------------------------- storage
-- Privado: son documentos bancarios. El frontend los ve con URL firmada de 1h.
insert into storage.buckets (id, name, public)
values ('soportes-pago', 'soportes-pago', false)
on conflict (id) do nothing;

drop policy if exists "soportes-pago: lectura autenticada" on storage.objects;
create policy "soportes-pago: lectura autenticada" on storage.objects
  for select to authenticated using (bucket_id = 'soportes-pago');

drop policy if exists "soportes-pago: escritura autenticada" on storage.objects;
create policy "soportes-pago: escritura autenticada" on storage.objects
  for insert to authenticated with check (bucket_id = 'soportes-pago');
