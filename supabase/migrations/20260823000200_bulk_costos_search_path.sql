-- Fija el search_path de fn_bulk_upsert_costos_proveedor.
--
-- Venía sin `SET search_path` desde 20260808000000. Mientras solo la llamaba el
-- importador de Excel (usuario autenticado, con rol) el riesgo era teórico;
-- ahora fn_carga_publica_costos la invoca desde un endpoint que se alcanza sin
-- sesión, así que se cierra el hueco de hijacking por funciones homónimas en
-- otro schema. Mismo hardening que hizo H12 sobre las funciones del baseline.
--
-- ALTER en vez de CREATE OR REPLACE: no hace falta reescribir el cuerpo.

alter function public.fn_bulk_upsert_costos_proveedor(jsonb)
  set search_path = public, pg_temp;
