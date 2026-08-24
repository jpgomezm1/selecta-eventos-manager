# Correo de soportes de pago — AgentMail

Los comerciales mandan los comprobantes a un buzón; el CRM los recibe, los deja
en una bandeja y alguien los concilia contra una factura. Reemplaza el WhatsApp
donde hoy se pierden.

**Todo el código está desplegado.** Lo único que falta es conectar la cuenta:
tres pasos y dos secrets.

## 1. Crear el buzón

Con la API key de AgentMail:

```python
from agentmail import AgentMail
client = AgentMail()                       # lee AGENTMAIL_API_KEY del entorno

inbox = client.inboxes.create(
    username="pagos",                      # queda pagos@<tu-dominio>.agentmail.to
    client_id="selecta-pagos",             # idempotente: no duplica si se repite
)
print(inbox.inbox_id)
```

## 2. Suscribir el webhook

```python
webhook = client.webhooks.create(
    url="https://xvvbxyjcieckbbdcuoge.supabase.co/functions/v1/recibir-soporte-pago",
    event_types=["message.received"],
    client_id="selecta-pagos-webhook",
)
print(webhook.secret)                      # empieza con whsec_ — es el de abajo
```

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
correo → AgentMail → webhook firmado (Svix)
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
