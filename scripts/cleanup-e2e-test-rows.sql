-- Limpieza de los datos que dejó la pasada E2E del 2026-05-11 (TESTING_HALLAZGOS.md:217):
--   · Cotización TEST fcc7f1e4-4091-4b37-8148-d31db74cf8c2 (override $99.999, estado "Pendiente por Aprobación")
--   · Cliente  TEST "TEST E2E Tómas O'Brien" (id cbbb16bc…)
-- Correr en el SQL Editor de Supabase. Primero el bloque de verificación, luego el DO.

-- ── 1. Verificación previa (solo lectura) ─────────────────────────────────────
select c.id, c.estado, c.total_cotizado,
       (select count(*) from cotizacion_versiones v where v.cotizacion_id = c.id) as versiones,
       (select count(*) from eventos e join cotizacion_versiones v on e.cotizacion_version_id = v.id
         where v.cotizacion_id = c.id) as eventos_ligados   -- debe ser 0
from cotizaciones c
where c.id = 'fcc7f1e4-4091-4b37-8148-d31db74cf8c2';

select id, nombre from clientes where id::text like 'cbbb16bc%';

-- ── 2. Borrado (transaccional, con guardas) ───────────────────────────────────
do $$
declare
  v_cotizacion uuid := 'fcc7f1e4-4091-4b37-8148-d31db74cf8c2';
  v_eventos int;
begin
  -- Guarda: si la cotización llegó a generar evento, NO borrar nada y avisar.
  select count(*) into v_eventos
  from eventos e
  join cotizacion_versiones v on e.cotizacion_version_id = v.id
  where v.cotizacion_id = v_cotizacion;
  if v_eventos > 0 then
    raise exception 'La cotización TEST tiene % evento(s) ligado(s); revisar a mano antes de borrar', v_eventos;
  end if;

  -- asignaciones de personal: sin FK con cascade, se borran explícitamente
  delete from cotizacion_personal_asignaciones
  where cotizacion_version_id in
    (select id from cotizacion_versiones where cotizacion_id = v_cotizacion);

  -- la cabecera cascadea versiones, items, lugares, share tokens y audit log
  delete from cotizaciones where id = v_cotizacion;

  -- cliente TEST (contactos cascadean; cotizaciones ya no lo referencian)
  delete from clientes
  where id::text like 'cbbb16bc%' and nombre like 'TEST E2E%';

  raise notice 'Limpieza E2E completada';
end $$;

-- ── 3. Verificación posterior (debe devolver 0 filas en ambas) ────────────────
select id from cotizaciones where id = 'fcc7f1e4-4091-4b37-8148-d31db74cf8c2';
select id from clientes where id::text like 'cbbb16bc%';
