-- ===================================================================
-- Cleanup de datos de prueba creados por scripts/seed-test-data.sql.
-- Borra TODO lo marcado con:
--   • Prefijo "[QA-RESP] " en nombres
--   • Cédulas que empiezan con "QA-RESP-"
--   • Correos que terminan en "-qa-resp@selecta.testing"
-- Las cascades se encargan de los items hijos (versiones, items, etc.).
-- ===================================================================

begin;

-- 1) Eventos (cascade: evento_personal, requerimientos, orden compra,
--    menaje_reservas + items, transporte_ordenes).
delete from public.eventos where nombre_evento like '[QA-RESP]%';

-- 2) Cotizaciones (cascade: versiones, items de platos/personal/transporte/menaje, lugares).
delete from public.cotizaciones where nombre_cotizacion like '[QA-RESP]%';

-- 3) Personal y catálogos
delete from public.personal where numero_cedula like 'QA-RESP-%';
delete from public.personal_costos_catalogo where rol like '[QA-RESP]%';
delete from public.menaje_catalogo where nombre like '[QA-RESP]%';

-- 4) Cliente y contactos
delete from public.cliente_contactos where nombre like '[QA-RESP]%';
delete from public.clientes where nombre like '[QA-RESP]%';

commit;

-- Verificación (debería retornar 0 en todo)
select '[QA-RESP] personal_costos_catalogo' tabla, count(*) restantes from public.personal_costos_catalogo where rol like '[QA-RESP]%'
union all
select '[QA-RESP] personal',           count(*) from public.personal           where numero_cedula like 'QA-RESP-%'
union all
select '[QA-RESP] menaje_catalogo',    count(*) from public.menaje_catalogo    where nombre like '[QA-RESP]%'
union all
select '[QA-RESP] clientes',           count(*) from public.clientes           where nombre like '[QA-RESP]%'
union all
select '[QA-RESP] cliente_contactos',  count(*) from public.cliente_contactos  where nombre like '[QA-RESP]%'
union all
select '[QA-RESP] cotizaciones',       count(*) from public.cotizaciones       where nombre_cotizacion like '[QA-RESP]%'
union all
select '[QA-RESP] eventos',            count(*) from public.eventos            where nombre_evento like '[QA-RESP]%';
