# Correo de soportes de pago — AgentMail

Los comerciales mandan los comprobantes a un buzón; el CRM los recoge cada 10
minutos, los deja en una bandeja y alguien los concilia contra una factura.
Reemplaza el WhatsApp donde hoy se pierden.

**Buzón:** `selecta@agentmail.to`

**Falta un solo paso**: cargar `AGENTMAIL_API_KEY` en Supabase.

## El único paso pendiente

Dashboard de Supabase → Project Settings → Edge Functions → Secrets → añadir:

| Secret | Valor |
|---|---|
| `AGENTMAIL_API_KEY` | la API key de AgentMail |

Opcional: `AGENTMAIL_INBOX_ID` si algún día se cambia de buzón. Sin ella se usa
`selecta@agentmail.to`.

Ya está hecho todo lo demás: la edge function desplegada, el cron programado
cada 10 minutos y la service role key cargada en el Vault.

## Por qué cron y no webhook

Un webhook es más inmediato, pero para comprobantes de pago la inmediatez no
vale nada y la pérdida silenciosa sí cuesta:

- **Un webhook que falla se pierde y nadie se entera.** El cron vuelve a mirar
  una ventana solapada en cada corrida, así que un correo que no entró hoy
  entra en la siguiente pasada. En cobranza, un soporte perdido es un pago que
  nadie registra.
- **No hay endpoint público sin autenticar.** El webhook obligaba a exponer una
  función con `verify_jwt = false` que escribía en la tabla de cobranza. La
  sincronización solo la puede disparar el cron.
- **Un secreto en vez de dos.** No hace falta el `whsec_` de Svix.
- **Un solo camino de escritura** hacia `soportes_pago`. Dos caminos
  escribiendo la misma tabla es el problema que se acaba de cerrar en el
  inventario de menaje.

Lo que hace la relectura segura es el índice único parcial sobre `message_id`:
los repetidos chocan contra el índice en vez de duplicarse. Sin eso, releer una
ventana solapada significaría conciliar el mismo pago dos veces.

## Verificar

```sh
python scripts-plantillas/probar_soportes_pago.py
```

Comprueba que solo el cron pueda disparar la sincronización, que correrla dos
veces no duplique, y que conciliar cree el abono y baje la cartera sin dejar
conciliar dos veces. Hoy pasa 9 de 9; con la key cargada agrega los chequeos de
la sincronización real.

Estado del cron, desde el SQL Editor:

```sql
select jobname, schedule, active from cron.job where jobname = 'sync-soportes-pago';
select status_code, content::text, created from net._http_response order by id desc limit 5;
```

Y un correo de verdad al buzón con un PDF adjunto cierra lo único que el script
no cubre: la descarga del adjunto, que necesita un mensaje real.

## Cómo funciona

```
selecta@agentmail.to
        ↓  (pg_cron cada 10 min → pg_net → service role key del Vault)
sincronizar-soportes-pago (edge function, solo el cron entra)
        ↓  lista mensajes nuevos · baja el adjunto · guarda en storage
soportes_pago (bandeja, estado=pendiente)
        ↓
Cartera → Soportes → "Leer con IA" propone monto/fecha/referencia
        ↓
alguien elige la factura y concilia
        ↓
factura_abonos ← el saldo de la factura baja
```

### Decisiones que conviene conocer

**La IA propone, no concilia.** Un comprobante mal leído que se aplique solo
mueve el saldo de una factura sin que nadie lo note — peor que el desorden que
venimos a arreglar. Por eso `monto_detectado` y compañía son sugerencias, y el
abono solo nace cuando una persona confirma.

**La lectura es bajo demanda, no al sincronizar.** El spam que llegue al buzón
no quema tokens, y la llamada queda bajo el rate-limit por usuario que ya
existe en `generate-recipe`.

**El adjunto se baja aparte.** El listado solo trae metadatos; hay que pedirle
la URL de descarga a la API. Si esa descarga falla, el correo entra igual
—perder el archivo no debe hacer que se pierda el aviso de que alguien pagó— y
queda el `attachment_id` para reintentar.

**La service role key vive en el Vault, no en el cron.** `cron.job` es legible
para cualquiera que llegue a esa tabla.

**Conciliar es solo de admin.** Es lo que mueve el saldo de una factura.
Comercial ve la bandeja pero no concilia.
