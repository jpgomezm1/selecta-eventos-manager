-- El buzón de AgentMail se lee por cron, no por webhook.
--
-- Un webhook que falla se pierde en silencio; acá cada corrida vuelve a mirar
-- una ventana solapada, así que un correo que no entró en una pasada entra en
-- la siguiente. En una bandeja de cobranza, un soporte perdido es un pago que
-- nadie registra. Además evita exponer un endpoint público sin autenticar y
-- deja un solo camino de escritura hacia soportes_pago.

create extension if not exists pg_cron  with schema pg_catalog;
create extension if not exists pg_net   with schema extensions;

-- La service role key no puede quedar escrita en el comando del cron: los jobs
-- son legibles por cualquiera que llegue a cron.job. Va al Vault y se lee en
-- el momento de disparar.
--
-- El valor real NO se pone acá. Se carga una sola vez con:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'service_role_key'),
--     '<service role key>');
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'service_role_key') then
    perform vault.create_secret('PENDIENTE', 'service_role_key',
      'Service role key del proyecto. La usa el cron de soportes de pago para llamar a la edge function.');
  end if;
end $$;

create or replace function public.fn_disparar_sync_soportes()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault, pg_temp
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets where name = 'service_role_key';

  if v_key is null or v_key = 'PENDIENTE' then
    raise notice 'sync soportes: falta cargar service_role_key en el Vault';
    return;
  end if;

  perform net.http_post(
    url     := 'https://xvvbxyjcieckbbdcuoge.supabase.co/functions/v1/sincronizar-soportes-pago',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

comment on function public.fn_disparar_sync_soportes() is
  'Llama a la edge function que sincroniza el buzon de AgentMail. La dispara pg_cron cada 10 minutos.';

revoke all on function public.fn_disparar_sync_soportes() from public, anon, authenticated;

-- Cada 10 minutos. Los comprobantes de pago no necesitan segundos: lo que
-- importa es que no se pierda ninguno, no que llegue instantáneo.
select cron.unschedule('sync-soportes-pago')
where exists (select 1 from cron.job where jobname = 'sync-soportes-pago');

select cron.schedule(
  'sync-soportes-pago',
  '*/10 * * * *',
  $cron$ select public.fn_disparar_sync_soportes(); $cron$
);
