-- Cambia ON DELETE CASCADE -> RESTRICT en las FK que apuntan a catálogos
-- desde tablas de cotizaciones históricas. Antes: borrar un plato/tarifa
-- borraba silenciosamente todos los items históricos en cotizaciones viejas
-- (perdiendo trazabilidad). Después: el borrado falla con error de FK si la
-- entrada del catálogo está en uso, forzando a archivar en vez de borrar.
--
-- Aplicado vía mcp__supabase__apply_migration el 2026-04-20.

ALTER TABLE public.cotizacion_platos
  DROP CONSTRAINT cotizacion_platos_plato_id_fkey,
  ADD  CONSTRAINT cotizacion_platos_plato_id_fkey
       FOREIGN KEY (plato_id) REFERENCES public.platos_catalogo(id)
       ON DELETE RESTRICT;

ALTER TABLE public.cotizacion_transporte_items
  DROP CONSTRAINT cotizacion_transporte_items_transporte_id_fkey,
  ADD  CONSTRAINT cotizacion_transporte_items_transporte_id_fkey
       FOREIGN KEY (transporte_id) REFERENCES public.transporte_tarifas(id)
       ON DELETE RESTRICT;
