# Correo de soportes de pago — AgentMail

Los comerciales mandan los comprobantes a un buzón; el CRM los recibe, los deja
en una bandeja y alguien los concilia contra una factura. Reemplaza el WhatsApp
donde hoy se pierden.

**Todo el código está desplegado.** Lo único que falta es conectar la cuenta.

## 1. Crear el buzón ✅

Hecho: **`selecta@agentmail.to`**

No hay que configurar esa dirección en ningún lado. La edge function no está
amarrada a un buzón: registra el `inbox_id` que venga en cada webhook, así que
si mañana se agrega un segundo buzón, entra igual.

## 2. Suscribir el webhook

Desde el dashboard de AgentMail, o con la API key en la mano:

```sh
curl -s -X POST https://api.agentmail.to/v0/webhooks \
  -H "Authorization: Bearer $AGENTMAIL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://xvvbxyjcieckbbdcuoge.supabase.co/functions/v1/recibir-soporte-pago",
    "event_types": ["message.received"],
    "client_id": "selecta-pagos-webhook"
  }'
```

Devuelve un `secret` que empieza con `whsec_`. Ese es el del paso 3 — **se
muestra una sola vez**, cópialo antes de cerrar.

El `client_id` lo hace idempotente: si corres el comando dos veces no quedan dos
webhooks mandando el mismo correo por duplicado.

## 3. Cargar los dos secrets en Supabase

Dashboard → Project Settings → Edge Functions → Secrets:

| Secret | De dónde sale | Para qué |
|---|---|---|
| `AGENTMAIL_WEBHOOK_SECRET` | `webhook.secret` del paso 2 | Verificar la firma Svix. **Sin esto la función rechaza todo** — falla cerrada a propósito. |
| `AGENTMAIL_API_KEY` | Tu cuenta de AgentMail | Bajar los adjuntos. Sin esto el correo entra pero sin comprobante. |

## Verificar que quedó bien

```sh
export AGENTMAIL_WEBHOOK_SECRET=whsec_...
python scripts-plantillas/probar_soportes_pago.py
```

Firma un evento igual que AgentMail y comprueba el flujo entero: que sin firma
no entre, que una petición vieja se rechace, que el correo llegue a la bandeja,
que un reintento no duplique, y que conciliar cree el abono y baje la cartera.

Después, un correo real al buzón con un PDF adjunto cierra lo único que el
script no cubre: la descarga del adjunto, que necesita un thread de verdad.

## Cómo funciona

```
selecta@agentmail.to → AgentMail → webhook firmado (Svix)
                          ↓
              recibir-soporte-pago (edge function, sin JWT)
                  verifica firma · baja el adjunto · guarda en storage
                          ↓
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

**La lectura es bajo demanda, no al recibir.** El spam que llegue al buzón no
quema tokens, y la llamada queda bajo el rate-limit por usuario que ya existe
en `generate-recipe`.

**Idempotencia por `message_id`.** Svix reintenta los webhooks que fallan. Sin
el índice único, un reintento duplicaría el soporte y alguien conciliaría el
mismo pago dos veces. Es el error más caro de este módulo.

**El adjunto no viaja en el webhook.** AgentMail capa el payload a 1 MB y manda
solo metadatos; hay que pedirle la URL de descarga a la API. Si esa descarga
falla, el correo entra igual —perder el archivo no debe hacer que se pierda el
aviso de que alguien pagó— y queda el `attachment_id` para reintentar.

**Conciliar es solo de admin.** Es lo que mueve el saldo de una factura.
Comercial ve la bandeja pero no concilia.
