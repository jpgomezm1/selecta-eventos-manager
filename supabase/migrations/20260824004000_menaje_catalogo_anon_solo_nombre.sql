-- La cotizacion compartida (/compartido/:token) necesita el NOMBRE del menaje
-- para que el cliente lea "Cuchara postre" y no un uuid. La politica que lo
-- permite es `using (true)` sobre toda la tabla, y RLS no sabe de columnas: con
-- la anon key —que viaja en el bundle del frontend, o sea que es publica— se
-- podia leer el catalogo entero con stock y precio_alquiler.
--
-- Al agregar costo_reposicion para valorizar la merma, ese descuido paso de
-- filtrar precios de venta a filtrar la estructura de costos. Se cierra con
-- grants por columna, que es lo que RLS no puede hacer.

revoke select on public.menaje_catalogo from anon;
grant  select (id, nombre) on public.menaje_catalogo to anon;
