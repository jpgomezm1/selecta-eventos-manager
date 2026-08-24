-- Misma trampa que en fn_cartera_resumen, pero acá la función es LANGUAGE sql
-- y no tiene bloque `begin` donde normalizar el parámetro: se normaliza en un
-- CTE, que es el equivalente en SQL puro.
--
-- Sin esto, `fn_cartera_tramos_a_corte(null)` devuelve cero filas: una
-- conciliación contra el Excel del cliente daría "no hay facturas" en vez de
-- las 128 que hay.
create or replace function public.fn_cartera_tramos_a_corte(
  p_fecha_corte date default current_date
)
returns table (numero text, emisora text, saldo numeric, edad_dias integer, tramo text)
language sql
set search_path to 'public', 'pg_temp'
as $function$
  with corte as (
    -- Un null explícito no debe significar "sin cartera": significa hoy.
    select coalesce(p_fecha_corte, current_date) as dia
  )
  select
    f.numero,
    e.nombre,
    f.valor_total - coalesce((
      select sum(a.monto) from public.factura_abonos a
      where a.factura_id = f.id and a.fecha <= c.dia
    ), 0),
    (c.dia - f.fecha_emision)::integer,
    public.fn_cartera_tramo((c.dia - f.fecha_emision)::integer, f.dias_credito)
  from public.facturas_venta f
  join public.empresas_emisoras e on e.id = f.empresa_emisora_id
  cross join corte c
  where not f.anulada and f.fecha_emision <= c.dia;
$function$;

revoke all on function public.fn_cartera_tramos_a_corte(date) from public, anon;
grant execute on function public.fn_cartera_tramos_a_corte(date) to authenticated;
