# Estado del proyecto — Selecta Eventos Manager

> Actualizado: 2026-08-24. Documento interno de seguimiento. Complementa `README.md` y el dossier de presentación.

## Dónde estamos

La app está **funcional y verificada de punta a punta en producción** (`https://selecta-eventos.netlify.app`). Los tres pasos de la auditoría original están cerrados, el sistema de usuarios y roles opera con signup cerrado, y el flujo completo cotización → aprobación → evento → cocina fue probado contra prod con datos reales, incluyendo el fix de override de total sincronizado a cabecera.

**Lo que funciona y está probado:**

- **Cotizador**: wizard completo (evento, menú, personal, transporte, menaje), múltiples opciones por versión, override de total por admin con audit log (email + timestamp), link público compartible sin sesión, PDF con paleta editorial.
- **Eventos y pipeline**: aprobación crea evento, visible en /eventos, /pipeline y /cocina con recetas escaladas a porciones del evento.
- **Cocina**: vista de producción por día/semana, responsive a 375px.
- **Inventario + factura AI**: escáner de facturas (imagen/PDF) contra Anthropic vía edge function — extracción y matching contra catálogo verificados, conversiones de presentación (bolsas×kg, botellas×L) correctas.
- **Rate-limit del edge function**: 20/min texto (la llamada 21 devuelve 429 con Retry-After), 5/min con adjuntos. Gating por rol.
- **Seguridad de app**: rutas gateadas por rol (`/sin-acceso` para cuentas sin rol), RPCs atómicos, creación de usuarios solo por admin vía edge function.
- **Catálogo**: 393 platos con precio de portafolio 2026, modelo precio = manual / costo = derivado.

### Carga pública del catálogo — `/carga/:token` (2026-08-23)

Reemplaza el ida y vuelta de plantillas de Excel: el cliente completa insumos, recetas y menaje en el navegador y se guarda al momento. Escritura anónima por token vía RPC `security definer` (mismo patrón que `/compartido/:token`).

Cubre lo que el Excel no podía: varios proveedores por insumo con uno principal, precio directo sin proveedor, recetas que no llevan insumos (una botella de agua), asociar ingredientes ya creados, filtros por estado y búsqueda por pestaña.

Regresión: `scripts-plantillas/probar_carga_publica.py` — 56 chequeos contra prod, revierte todo lo que escribe.

### Los cuatro módulos que pidió el cliente (2026-08-23 / 24)

| Módulo | Estado |
|---|---|
| **Cartera** (`/cartera`) | Operativo. 128 facturas de los dos libros (Selecta + Isabela) importadas, $350.056.023. |
| **Bodega — reporte para facturar** | Operativo. Valoriza lo roto y lo perdido a costo de reposición. |
| **Consumos durante el evento** | Operativo. Panel mobile-first, hora editable para que el registro tardío no se castigue. |
| **Soportes de pago por correo** | Operativo. Buzón `selecta@agentmail.to`, cron cada 10 min, verificado de punta a punta. Ver `AGENTMAIL.md`. |

Notas de diseño que conviene no perder:

- **Los tramos de mora se dedujeron de los datos del cliente**, no se inventaron: bandas sobre la EDAD de la factura, corte 2026-08-07, frontera estricta. Isabela cuadra exacto en los cuatro totales; Selecta cuadra en total, en crítica >60d y en los 22 clientes críticos, con una diferencia de $227.484 (0,08%) trazable a 4 facturas (NUVANT FECP4836, EL COLOMBIANO FECP4587 y FECP4658, MICROPLAST FECP4580) — **pendiente confirmar con el cliente si esos tienen plazo distinto a 30 días**.
- **La IA propone, no concilia.** El lector de comprobantes sugiere monto, fecha y referencia; el abono solo nace cuando una persona confirma. Un comprobante mal leído que se aplicara solo movería el saldo de una factura sin que nadie lo note.
- **El ingreso de un evento es `cotizaciones.total_cotizado`**, nunca la suma de los `evento_requerimiento_*`: esa suma ignora el precio del lugar y el `total_override`. Todo módulo nuevo debe leer de ahí.

**Datos de demo en prod (NO borrar):**

| Cotización | Cliente | Total |
|---|---|---|
| Boda Valentina & Andrés — Llanogrande (120 inv., 22/08/2026) | Valentina Restrepo (persona) | $26.681.000 |
| Cóctel Corporativo Altavista — Lanzamiento Q3 (80 inv., 10/09/2026) | Constructora Altavista S.A.S. (empresa) | $7.502.000 |

Ambas en estado **Pendiente** a propósito: permiten demostrar en vivo el compartir link público y el flujo de aprobación.

## Qué falta

### Lo que bloquea
1. **Nadie ha revisado visualmente** `/cartera`, el panel de Cierre del evento ni el de Consumos. Solo `/carga/:token` se abrió y se miró.
2. **Los tres clientes con plazo dudoso** de la cartera (arriba). Es un campo, no un rediseño.
3. **Rotar la API key de AgentMail**: se compartió por chat el 2026-08-24. Se rota con `vault.update_secret` (ver `AGENTMAIL.md`), sin tocar código.

### El riesgo real: adopción
4. **Hay 0 eventos en el sistema.** Los cuatro módulos cuelgan del evento — bodega, consumos y el reporte de facturación nacen vacíos hasta que uno real recorra el ciclo completo. Sigue siendo cierto lo que decía este documento en julio: *la adopción es el riesgo principal del proyecto, no la técnica*.

### Datos (bloquean valor, no funcionalidad)
5. **Costos de insumos**: 55 de 325 tienen `costo_por_unidad`. Sin esto el costo derivado de los platos y el margen no significan nada — el panel de rentabilidad lo advierte en pantalla en vez de mostrar un margen falso.
6. **Recetas**: 184 de 393 platos resueltos (con insumos o marcados como "sin insumos").
7. **Costo de reposición del menaje**: 0 de 9. Mientras esté en cero, el reporte de bodega valoriza en cero lo roto y lo perdido. Ya se pide en `/carga/:token` → Menaje.
8. **17 platos huérfanos sin código** desde la carga del catálogo (F2).
9. **Gaseosa BEB-003 con 2 precios distintos** en el archivo fuente — decisión pendiente.

### Descartado / pospuesto (decisión de Tomás)
- Acciones de dashboard Supabase (rotar service role key, Postgres upgrade, OTP 30 min, leaked password protection, límite de gasto Anthropic) — **descartadas el 2026-07-15**. Riesgo residual asumido.
- Telegram clock-in/out — pospuesto.
- Backlog de producto (reportes, notificaciones, onboarding) — requiere conversación con el cliente.

## Convenciones operativas (recordatorio)

- Nunca commitear directo a `main`: rama + merge tras validación. Cada push a `main` dispara deploy en Netlify.
- Typecheck (`npx tsc --noEmit -p tsconfig.app.json`) + `npm run lint` obligatorios tras cambios. Hay 6 errores preexistentes de `jspdf` (`getNumberOfPages`) — no deben crecer. No introducir `any` nuevos.
- UI en español neutro (sin voseo). Migraciones se corren a mano en el SQL Editor de Supabase y se registran en `supabase/migrations/`.
- **Toda función nueva del esquema `public` nace con `execute` concedido a `anon` y `authenticated`**, y `revoke ... from public` NO se los quita: hay que nombrar a `anon` explícitamente. Ya se coló dos veces.
- Credenciales QA: `admin@selecta.testing` / `pruebas123`.
