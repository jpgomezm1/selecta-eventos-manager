-- Cierra fn_carga_token_id al REST.
--
-- La migración anterior hacía `revoke all ... from public`, que no alcanza:
-- Supabase tiene default privileges que conceden EXECUTE a anon, authenticated
-- y service_role de forma NOMINAL en cada función nueva del schema public. Un
-- revoke a PUBLIC (el pseudo-rol) no toca esos grants por nombre, así que el
-- helper quedaba llamable desde /rest/v1/rpc: cualquiera con un token válido
-- podía sacar el uuid interno de la fila y disparar el update de
-- ultima_actividad.
--
-- Lo detectó `scripts-plantillas/probar_carga_publica.py`, que prueba con la
-- anon key en vez de con el service role — por eso vio lo que el navegador ve.
--
-- Las fn_carga_publica_* sí deben quedar concedidas a anon: son la superficie
-- que usa la página. La que no es fn_carga_token_id, que solo la invocan ellas
-- por dentro — y ahí corre como owner (postgres), sin necesitar el grant.
--
-- Al agregar una función nueva a este conjunto: si es interna, revocarla de
-- `anon, authenticated, public`, no solo de `public`.

revoke all on function public.fn_carga_token_id(text)
  from anon, authenticated, public;
