# Estado del proyecto — Selecta Eventos Manager

> Actualizado: 2026-07-15. Documento interno de seguimiento. Complementa `README.md` y el dossier de presentación.

## Dónde estamos

La app está **funcional y verificada de punta a punta en producción** (`https://selecta-eventos.netlify.app`). Los tres pasos de la auditoría original están cerrados, el sistema de usuarios y roles opera con signup cerrado, y el flujo completo cotización → aprobación → evento → cocina fue probado contra prod con datos reales, incluyendo el fix de override de total sincronizado a cabecera.

**Lo que funciona y está probado:**

- **Cotizador**: wizard completo (evento, menú, personal, transporte, menaje), múltiples opciones por versión, override de total por admin con audit log (email + timestamp), link público compartible sin sesión, PDF con paleta editorial.
- **Eventos y pipeline**: aprobación crea evento, visible en /eventos, /pipeline y /cocina con recetas escaladas a porciones del evento.
- **Cocina**: vista de producción por día/semana, responsive a 375px (fix voseo + wrap desplegado hoy, `c53eaa2`).
- **Inventario + factura AI**: escáner de facturas (imagen/PDF) contra Anthropic vía edge function — probado hoy en vivo: extracción y matching contra catálogo impecables, conversiones de presentación (bolsas×kg, botellas×L) correctas, servicios no alimentarios excluidos.
- **Rate-limit del edge function**: verificado hoy en prod — límite 20/min texto (la llamada 21 devuelve 429 con Retry-After), 5/min con adjuntos. Gating por rol (solo admin/cocina consumen tokens).
- **Seguridad de app**: rutas gateadas por rol (`/sin-acceso` para cuentas sin rol), RPCs atómicos (ingredientes, devolución de menaje idempotente), creación de usuarios solo por admin vía edge function.
- **Catálogo**: 393 platos con precio de portafolio 2026 (ajuste +15-18% aplicado), modelo precio = manual / costo = derivado.

**Datos de demo en prod (creados hoy, NO borrar):**

| Cotización | Cliente | Total |
|---|---|---|
| Boda Valentina & Andrés — Llanogrande (120 inv., 22/08/2026) | Valentina Restrepo (persona) | $26.681.000 |
| Cóctel Corporativo Altavista — Lanzamiento Q3 (80 inv., 10/09/2026) | Constructora Altavista S.A.S. (empresa) | $7.502.000 |

Ambas en estado **Pendiente** a propósito: permiten demostrar en vivo el compartir link público y el flujo de aprobación.

## Qué falta

### Antes de / durante la reunión con el cliente
1. **Decisiones del cliente** pendientes desde la agenda de mayo (H1/H3/H5 + datos). El cliente aún no ha usado la app — la adopción es el riesgo principal del proyecto, no la técnica.

### Datos (bloquean valor real, no funcionalidad)
2. **Costos de ingredientes casi todos en $0** — de 325 ingredientes, la gran mayoría no tiene `costo_por_unidad` (solo 43 se actualizaron en F3a). Sin esto, el costo derivado de los platos y el margen no significan nada.
3. **Catálogo de menaje es seed** — solo 9 items con precios de prueba (ej. plato base $25.000/alquiler). Revisar items y tarifas reales antes de cotizar menaje en serio.
4. **17 platos huérfanos sin código** desde la carga del catálogo (F2).
5. **Gaseosa BEB-003 con 2 precios distintos** en el archivo fuente — decisión pendiente.

### Tests
6. ~~Cuenta sin rol~~ — **CERRADO 2026-07-15**: usuario QA temporal creado en prod con autorización explícita; una cuenta autenticada sin rol es redirigida a `/sin-acceso` (también al navegar por URL directa a rutas protegidas) y `generate-recipe` le responde 403 con mensaje claro. Usuario QA eliminado al terminar. **No queda ningún test pendiente.**

### Descartado / pospuesto (decisión de Tomás)
- Acciones de dashboard Supabase (rotar service role key, Postgres upgrade, OTP 30 min, leaked password protection, límite de gasto Anthropic) — **descartadas el 2026-07-15**. Riesgo residual asumido: la service role key actual sigue vigente y los advisors de Supabase seguirán marcando estos puntos.
- Telegram clock-in/out — pospuesto.
- Backlog de producto (reportes, notificaciones, onboarding) — requiere conversación con el cliente post-reunión.

## Convenciones operativas (recordatorio)

- Nunca commitear directo a `main`: rama + merge tras validación. Cada push a `main` dispara deploy en Netlify.
- Typecheck (`npx tsc --noEmit -p tsconfig.app.json`) + `npm run lint` obligatorios tras cambios. No introducir `any` nuevos.
- UI en español neutro (sin voseo). Migraciones se corren a mano en el SQL Editor de Supabase y se registran en `supabase/migrations/`.
- Credenciales QA: `admin@selecta.testing` / `pruebas123`.
