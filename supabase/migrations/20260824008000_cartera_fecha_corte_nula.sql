-- `fn_cartera_resumen(null, null)` devolvia cartera_total = 0, y
-- `fn_cartera_tramos_a_corte(null)` devolvia cero filas.
--
-- El DEFAULT current_date solo aplica cuando el parametro se OMITE; si alguien
-- pasa null explicito —cosa que hace cualquier cliente que mande el payload
-- completo, incluido PostgREST— la fecha de corte queda en null y todas las
-- comparaciones contra ella dan null, asi que no sobrevive ninguna factura.
--
-- El resultado es un reporte de cobranza que dice CERO en silencio. Que la
-- pantalla hoy mande siempre la fecha no arregla nada: el error vuelve con el
-- primer script, integracion o job que no lo haga. Se normaliza dentro de la
-- funcion, que es donde no se puede esquivar.
--
-- Se parchea sobre la definicion viva en vez de reescribir el cuerpo entero:
-- asi no hay forma de que se pierda algo por transcribirlo mal.
do $$
declare
  def   text;
  ancla text := E'declare\n  v_out jsonb;\nbegin\n';
begin
  def := pg_get_functiondef('public.fn_cartera_resumen(date, uuid)'::regprocedure);
  if position(ancla in def) = 0 then
    raise exception 'No se encontro el ancla en fn_cartera_resumen';
  end if;
  def := replace(def, ancla, ancla ||
    E'  -- Un null explicito no debe significar "sin cartera": significa hoy.\n' ||
    E'  p_fecha_corte := coalesce(p_fecha_corte, current_date);\n');
  execute def;
end $$;
