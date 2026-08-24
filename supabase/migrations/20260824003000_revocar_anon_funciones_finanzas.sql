-- Supabase concede execute a anon y authenticated por defecto en toda funcion
-- nueva del esquema public, y `revoke from public` NO se los quita: hay que
-- nombrarlos. Las seis son security invoker y las RLS ya impiden que anon lea
-- algo (verificado con la anon key: devuelve ceros y arrays vacios), pero
-- dejar la superficie abierta es apostar a que la RLS nunca se afloje.

revoke all on function public.fn_cartera_tramo(integer, integer)                          from public, anon;
revoke all on function public.fn_cartera_tramos_a_corte(date)                             from public, anon;
revoke all on function public.fn_cartera_resumen(date, uuid)                              from public, anon;
revoke all on function public.fn_cartera_importar(jsonb)                                  from public, anon;
revoke all on function public.fn_reporte_facturacion_evento(uuid)                         from public, anon;
revoke all on function public.fn_conciliar_soporte_pago(uuid,uuid,numeric,date,text,text) from public, anon;

grant execute on function public.fn_cartera_tramo(integer, integer)                          to authenticated;
grant execute on function public.fn_cartera_tramos_a_corte(date)                             to authenticated;
grant execute on function public.fn_cartera_resumen(date, uuid)                              to authenticated;
grant execute on function public.fn_cartera_importar(jsonb)                                  to authenticated;
grant execute on function public.fn_reporte_facturacion_evento(uuid)                         to authenticated;
grant execute on function public.fn_conciliar_soporte_pago(uuid,uuid,numeric,date,text,text) to authenticated;
