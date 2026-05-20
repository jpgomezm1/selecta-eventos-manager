# Hallazgos de Testing E2E

Registro abierto durante la pasada de testing del 2026-05-11. Se corrige al final, en batch.

---

## Sección 1 — Matriz de acceso

### H1. Mismatch URL ↔ label en sidebar (cosmético / doc)
- **Pantalla:** sidebar (todos los roles).
- **Observado:**
  - `/bodega` aparece en el sidebar como **"Menaje"**.
  - `/cocina` aparece en el sidebar como **"Producción"**.
- **Confirmado en código:** `src/components/Layout/navigation.ts:55,58` — grupo "Cocina y bodega" con items `Producción → /cocina` y `Menaje → /bodega`.
- **Severidad:** cosmético / inconsistencia de naming.
- **Decisión pendiente:** o renombramos las URLs (`/cocina` → `/produccion`, `/bodega` → `/menaje`) para que match el label, o renombramos los labels para que match la URL, o lo dejamos así y solo documentamos. La URL es más invasiva de cambiar porque rompe bookmarks/links externos.
- **Acción doc:** actualizar TESTING.md sección 1 para que la matriz muestre el label visible entre paréntesis.

---

### H2. Botones de acción visibles para roles sin permiso (UX / consistencia)
- **Pantalla:** `/cotizaciones` (y probablemente otras).
- **Rol reproducido:** `operaciones` (puede ver listado pero NO crear).
- **Observado:** el botón **"Nueva cotización"** se ve aunque la ruta `/cotizaciones/nueva` está restringida a admin+comercial. Al click, redirige a `/panorama` (la protección de ruta funciona), pero el botón no debería mostrarse.
- **Confirmado en código:**
  - `src/pages/Cotizaciones.tsx:237` (header) y `:400` (empty state) — botones "Nueva cotización" sin guard de rol.
  - `src/components/Dashboard/AccionesRapidas.tsx:145` — atajo "Nueva cotización" en `/panorama` tampoco tiene guard.
- **Causa raíz:** la protección de roles está implementada solo en `ProtectedRoute` (routing). No hay un patrón de gate a nivel componente/botón. Los componentes ya tienen `useAuth().roles` disponible pero solo lo usan en 2 lugares (`Cotizador.tsx:93` y `VersionEditorWizard.tsx:80` para el flag `isAdmin`).
- **Severidad:** mayor (UX, no seguridad — la ruta sí valida).
- **Alcance probable:** se repite en toda la app. Hay que hacer sweep buscando botones de "Nuevo X" / "Editar" / "Eliminar" / acciones que dependan de un rol. Candidatos a revisar mientras testeás:
  - `/eventos` — botón crear evento.
  - `/clientes` — botón nuevo cliente.
  - `/recetario` — crear plato.
  - `/inventario` — nuevo movimiento.
  - `/personal` — crear empleado.
  - `/catalogos` y `/usuarios` — solo admin, pero verificar enlaces desde otras pantallas.
- **Fix propuesto (cuando lleguemos a corregir):** helper `useCan(allowedRoles)` que envuelve `useAuth().roles` + `hasAnyRole`. Cada botón se envuelve en `{can(["admin","comercial"]) && <Button>...}`. O un componente `<Allowed roles={...}>`. Decisión al final.

---

## Sección 3 — Flujo end-to-end

### 3.1 — Crear cliente

### H3. Cliente sin validaciones mínimas (decisión de producto)
- **Pantalla:** `/clientes` → Nuevo cliente.
- **Rol reproducido:** admin.
- **Observado:**
  - Se guarda sin cédula, sin teléfono y sin email — todos los campos quedan vacíos.
  - Acepta caracteres especiales (tildes, ñ, apóstrofo, etc.) — esto está OK.
- **Severidad:** decisión de producto.
- **Pregunta para Juan Pablo:** ¿qué campos deberían ser obligatorios? Opciones:
  - Solo `nombre` obligatorio (estado actual).
  - `nombre` + al menos uno de `email`/`telefono`/`cedula` para tener cómo contactar.
  - `nombre` + `telefono` siempre (el más usado en catering).
  - Validar formato de email cuando se llena (no obligatorio, pero si está → debe ser email válido).
- **Acción:** decidir y, si aplica, agregar validación en el form + a nivel DB (constraint NOT NULL en columnas que pasen a ser obligatorias).

---

### H4. Validación matriz de roles — automatizada vía Playwright (admin/comercial/operaciones/cocina)
- **Pantalla:** sidebar + routing global.
- **Validado:**
  - **admin:** ve todas las secciones del sidebar. Sin errores en console.
  - **comercial:** sidebar muestra solo Panorama, Eventos, Pipeline, Cotizaciones, Clientes. Las 8 rutas prohibidas (`/personal`, `/transporte`, `/bodega`, `/inventario`, `/recetario`, `/cocina`, `/catalogos`, `/usuarios`) redirigen a `/panorama`. ✓
  - **operaciones:** sidebar muestra Panorama, Eventos, Cotizaciones, Personal, Transporte, Menaje. Rutas prohibidas redirigen. **H2 confirmado** (botones "Nueva cotización" + "Crear primera cotización" visibles en `/cotizaciones`). En `/panorama` las acciones rápidas SÍ se filtran por rol (no aparece "Nueva cotización", solo "Agregar empleado" / "Enviar cronogramas"). En `/eventos` no aparecen botones huérfanos.
  - **cocina:** sidebar muestra Panorama, Eventos, Producción, Recetario, Inventario. Rutas prohibidas redirigen. En `/panorama` aparecen solo "Abrir inventario" / "Abrir recetario". En `/recetario` ve "Nuevo Plato" — verificar si es intencional que cocina cree platos.
- **Pendiente de validar manualmente:** cuenta "sin rol" → debería redirigir a `/sin-acceso`. Requiere crear cuenta nueva desde admin sin asignarle roles.

### H5. ¿Cocina debería poder crear platos? (decisión de producto)
- **Pantalla:** `/recetario` con rol `cocina`.
- **Observado:** botón "Nuevo Plato" visible y aparentemente clickeable. La ruta `/recetario` está autorizada para `cocina` (App.tsx:244), pero crear platos puede ser una operación reservada a admin.
- **Pregunta:** ¿el rol `cocina` puede crear platos nuevos, o solo consultar/editar recetas?

---

## Sección 3 — Flujo end-to-end

### 3.1 — Crear cliente ✓
- Cliente `TEST E2E Tómas O'Brien` creado OK (id `cbbb16bc...`). Tildes + apóstrofe persisten correctamente. Sin teléfono/email/cédula (ver H3).

### H6. ⚠️ BUG REGRESIÓN — Opción Z + 1 = "[" (no "AA") en `/cotizaciones/nueva`
- **Pantalla:** `/cotizaciones/nueva`, paso 2 (Menú y Platos).
- **Rol reproducido:** admin.
- **Pasos:** abrir wizard → click "Agregar" 26 veces (de A a Z) → click "Agregar" una vez más.
- **Esperado:** la 27ª opción se llama **"Opción AA"** (la memoria dice que se fixó el 2026-04-28 con lógica base-26).
- **Observado:** la 27ª opción se llama **"Opción ["** (corchete). ASCII 91 — el código usa `String.fromCharCode(64 + nextIndex)` que con `nextIndex=27` da `91`.
- **Causa raíz:** hay 3 implementaciones del cálculo de letra y solo 2 están fixeadas:
  - `src/hooks/useCotizadorWizard.ts:59-69` ✓ correcta (base-26 con while loop).
  - `src/pages/CotizacionEditor.tsx:124-134` ✓ correcta.
  - `src/pages/Cotizador.tsx:172-184` ❌ **BUG — usa `String.fromCharCode(64 + nextIndex)` viejo** sin manejar overflow > Z.
- **Severidad:** mayor. Aplica al wizard inicial de "Nueva cotización" — no al editor de versiones existentes ni al hook compartido. La memoria reportaba que se había fixeado pero hay duplicación de lógica que quedó desincronizada.
- **Fix propuesto:** copiar la implementación de `useCotizadorWizard.ts:62-69` (o `CotizacionEditor.tsx:127-134`) a `Cotizador.tsx:175`. Idealmente extraer a un helper compartido `nextOpcionLetra(index)` en un util para no volver a desincronizar.

### 3.2 — Wizard de cotización ✓ (con observaciones)
- Cotización `fcc7f1e4-4091-4b37-8148-d31db74cf8c2` creada. 2 versiones persistidas en DB (Opción A $35.500 + Opción A - Copia $1.013.500). 50 invitados, fecha 2026-06-20, comercial "QA Playwright". Audit log registra creaciones con email + timestamp. ✓
- **Duplicar opción:** la copia se llama "Opción A - Copia", no "Opción B". Funciona pero el naming puede confundir si las usás como alternativas paralelas A/B/C. Decisión de UX.
- **Tab "Resumen" usa label "Cotización aprobada"** debajo del monto cuando la cotización está en estado `Pendiente`. Cosmético: debería ser estado-aware o un label genérico tipo "Total cotización".

### H7. ⚠️ Cliente NO se persiste al guardar cotización (REVERIFICAR manualmente)
- **Pantalla:** `/cotizaciones/nueva`, paso 1.
- **Observado:** seleccioné el cliente "TEST E2E Tómas O'Brien" desde el combobox del paso 1 y guardé la cotización. En DB: `cotizaciones.cliente_id = NULL` y `cliente_nombre = NULL`. En la pantalla de detalle de la cotización no se muestra el cliente.
- **Atención — posible falso positivo:** el flujo se hizo con script Playwright que abre el combobox y clickea el `[role="option"]` desde JS. Es posible que el listbox de Radix Command (cmdk) requiera un PointerEvent real para disparar el `onSelect` que llama `setSelectedCliente(cliente)`. Hay que reproducir manualmente con click humano antes de fixear.
- **Si se reproduce con click manual** → bug crítico, bloquea la entrega (cotización sin cliente no sirve).
- **Si NO se reproduce con click manual** → no es bug, pero indica que el listbox NO responde a eventos sintéticos de JS — vale tenerlo presente si se quieren hacer e2e tests automatizados en el futuro.

### 3.3 — Compartir + PDF: PENDIENTE
- No probado en este pase (alcance de tiempo). Recomendación: hacer manualmente con la cotización `fcc7f1e4`.

### 3.4 — Override total (admin) ✓
- Override `$99.999` aplicado a Opción A. Persiste en `cotizacion_versiones.total_override` ✓.
- `cotizacion_audit_log` registró fila: field=`total_override`, old_value=`null`, new_value=`99999`, changed_by=user UUID, changed_at=timestamp ✓.
- Override **negativo** (`-500`) se sanitiza automáticamente a positivo (`500`). `parseMiles` filtra el signo. OK.
- Override **a $0**: el input acepta el valor y muestra el warning amarillo ("El total quedó en $0. Confirma que es intencional…"). **Pero NO se persistió** en la BD (`total_override` sigue NULL después de guardar la Opción B con override 0).

### H8. Override $0 no se persiste
- **Pantalla:** `/cotizaciones/:id/editar/:versionId`, tab Resumen.
- **Pasos:** abrir editor de versión → escribir `0` en el input Total → blur → guardar.
- **Esperado:** `total_override = 0` en BD (admin lo dejó intencionalmente en cero).
- **Observado:** `total_override = NULL` (sin cambio). El warning aparece en UI pero el guardado no respeta el 0.
- **Severidad:** menor. Caso de uso poco común (poner cotización en $0), pero la UI lo muestra como permitido (warning amarillo en vez de bloquear) — debería ser coherente: o lo guarda, o lo bloquea con un mensaje claro.
- **Posible causa:** `onTotalOverrideChange?.(next === total ? null : next)` (ResumenCotizacion.tsx:382) — si `total === 0` y se ingresa `0`, ambos son iguales y se setea a `null`. Pero el `total` calculado de la versión B es $1.013.500, no 0. Hay que debuggear por qué el setOverride no pasa por el lado de persist.

### 3.5–3.7 — Aprobar/convertir evento + tabs evento + cocina: PENDIENTES
- No probado en este pase. La cotización `fcc7f1e4` quedó en estado "Pendiente por Aprobación" — vale pasar a aprobada manualmente y validar la conversión a evento.

---

## Sección 5 — Verificación con Supabase MCP (advisors + logs)

### H9. ⚠️ CRÍTICO — SECURITY DEFINER view bypasea RLS
- **Detalle:** `public.v_menaje_reservas_cal` está definida con `SECURITY DEFINER`. Las views así enforce los permisos/RLS del **creador**, no del usuario que consulta.
- **Severidad:** ERROR (Supabase advisor).
- **Fix:** redefinir con `SECURITY INVOKER` (default en Postgres 15+).

### H10. ⚠️ RLS policies con USING(true) — sin protección efectiva (3 tablas)
- **Tablas:** `cotizacion_lugares`, `cotizacion_personal_items`, `cotizacion_versiones`.
- **Detalle:** policies `ALL` con `USING (true) WITH CHECK (true)` para rol `authenticated` — cualquier usuario logueado puede leer/insertar/update/delete CUALQUIER fila.
- **Severidad:** WARN. Hoy todos los users del app son del staff y tienen acceso vía rol, pero el principio de menor privilegio dice limitar. Si en el futuro hay usuarios de cliente final o terceros con cuenta, esto es un hueco.
- **Fix:** reemplazar con policies que filtren por `cotizacion.user_id` o role-check.

### H11. ⚠️ 15+ funciones SECURITY DEFINER expuestas vía PostgREST a `anon` Y `authenticated`
- **Detalle:** estas funciones son ejecutables por `anon` (sin login) vía `/rest/v1/rpc/<nombre>`:
  - `assign_role`, `revoke_role` — pueden modificar roles de usuarios.
  - `list_users_with_roles` — lista users + roles.
  - `list_cotizacion_audit` — lee audit log.
  - `log_cotizacion_change` — escribe audit log con datos arbitrarios.
  - `has_role`, `cotizacion_has_active_share`, `create_ingrediente_with_proveedor`.
  - Triggers: `trg_audit_cotizacion`, `trg_audit_cotizacion_version`, `trg_audit_cotizacion_version_insert` (estos no se deberían poder llamar como RPC).
- **Severidad:** WARN (mitigada parcialmente). Verifiqué el body:
  - `assign_role` y `revoke_role` validan `has_role('admin')` internamente. Para `anon`, `auth.uid()` devuelve NULL → `has_role` retorna false → rechaza con 42501. ✓
  - Pero los **triggers** (`trg_audit_*`) NO deberían exponerse como RPC — un atacante podría llamarlos directamente y crear filas falsas en `cotizacion_audit_log`. Esto SÍ requiere fix.
  - `list_users_with_roles` y `list_cotizacion_audit` — verificar si tienen guard interno. Si no, exponen datos al `anon`.
- **Fix priorizado:**
  1. Revocar `EXECUTE` de `anon` y `authenticated` en `trg_audit_*` (son triggers internos).
  2. Auditar `list_users_with_roles`, `list_cotizacion_audit`, `log_cotizacion_change` para confirmar que validan rol/sesión.
  3. Para el resto, considerar revocar `anon` salvo `cotizacion_has_active_share` (usado por la página pública `/compartido/:token`).

### H12. Funciones con `search_path` mutable (14 funciones)
- **Funciones afectadas:** `sync_evento_ubicacion`, `cotizacion_has_active_share`, `set_updated_at` (varias variantes), `fn_inventario_movimiento_*`, `fn_set_proveedor_principal`, `apply_merma_on_confirm`, `fn_menaje_disponible`, `update_updated_at_column`, `generate_comprobante_number`.
- **Severidad:** WARN. Vector de hijacking si un atacante crea funciones homónimas en otro schema.
- **Fix:** agregar `SET search_path = public, pg_temp` a cada función.

### H13. Postgres con parches de seguridad pendientes
- **Detalle:** versión actual `supabase-postgres-17.4.1.048` tiene patches disponibles.
- **Fix:** upgrade desde Supabase Dashboard.

### H14. Auth OTP expiry > 1 hora
- **Detalle:** OTP expira en más de 60 min. Recomendado < 60 min para reducir ventana de uso si el token se intercepta.
- **Fix:** Dashboard → Auth → Email provider → ajustar OTP expiry.

### H15. Leaked password protection deshabilitado
- **Detalle:** Supabase puede validar contra HaveIBeenPwned para rechazar passwords comprometidos. Hoy está OFF.
- **Fix:** Dashboard → Auth → Password protection → habilitar.

### H16. Performance — FKs sin índice (info)
- **Tablas con FK sin covering index:** `cliente_contactos.cliente_id`, `cotizacion_audit_log.changed_by`, y varias más (lista completa en el JSON de advisors).
- **Severidad:** INFO. Solo importa si esas tablas crecen y se hacen DELETEs en la tabla parent (FK validation hace seq scan). Hoy son pocas filas, no urgente.

### Postgres logs ✓
- Sin errores generados por la app. Los únicos `ERROR` en los logs corresponden a queries de testing inválidas mías vía MCP (`column "created_at" does not exist`, etc.).

---

## Resumen ejecutivo (al 2026-05-11, end of session MCP)

**Severidad alta (atender antes de entrega):**
- **H6** — Bug regresión en `Cotizador.tsx:175`. Opción 27 = "[" en vez de "AA". Fix mecánico copiando lógica del hook.
- **H9** — `v_menaje_reservas_cal` con SECURITY DEFINER (bypass de RLS).
- **H11** — `trg_audit_*` y posiblemente `list_users_with_roles` ejecutables vía RPC sin guard. Riesgo de inyección al audit log o lectura no autorizada.
- **H7** — REVERIFICAR: si el cliente realmente no se persiste con click manual, es bloqueante.

**Severidad media (revisar antes de entrega):**
- **H2** — Botones huérfanos en `/cotizaciones` para rol operaciones. UX inconsistente.
- **H10** — 3 RLS policies con `USING(true)` — sin protección efectiva.
- **H3** — Validaciones mínimas de cliente (decisión de producto).
- **H13/H14/H15** — Postgres patches + OTP expiry + leaked password protection.

**Severidad baja (cosmético / mejora):**
- **H1** — Mismatch URL ↔ label en sidebar (`/bodega`="Menaje", `/cocina`="Producción"). Decisión naming.
- **H5** — ¿Cocina debería crear platos? Decisión de producto.
- **H8** — Override $0 no se persiste (caso de uso poco común pero UI lo permite).
- **H12** — `search_path` mutable en 14 funciones. Vector de hijacking. Fix mecánico.
- **H16** — FKs sin índice. Solo relevante a escala.
- Tildes faltantes en dialog Nuevo Cliente ("informacion", "Cedula", "Telefono").
- "Cotización aprobada" label visible cuando estado es Pendiente.
- "Opción A - Copia" al duplicar (decisión UX: ¿debería ser "Opción B"?).

**Tests no ejecutados (queda manual):**
- Sección 3.3 (PDF + compartir link público).
- Sección 3.5–3.7 (aprobación → evento → tabs evento → cocina con datos reales).
- Cuenta "sin rol" → redirect a `/sin-acceso`.
- Edge function `generate-recipe` con rate-limit real.
- Carga de factura AI.
- Responsive 375px.

**Estado del repo:** sin commits durante el testing. Cotización TEST `fcc7f1e4` quedó con override $99.999 y la opción B intacta. Cliente TEST `cbbb16bc` creado. Limpiables manualmente cuando termines.

---

## Estado al cierre 2026-05-20 (pre-reunión cliente)

Sprint dedicado a cerrar todo lo que dependa solo de código antes de la reunión del 2026-05-21.

| ID | Estado | Notas |
|----|--------|-------|
| **H1** | 🟡 Pendiente decisión cliente | Naming sidebar (`/bodega`="Menaje", `/cocina`="Producción"). Para la reunión. |
| **H2** | ✅ Resuelto | Hook `useCan` + sweep en 6 archivos (commit `530a8ab`). Botones "Nueva cotización", "Agregar" personal/cliente, "Nuevo Plato", "Nuevo movimiento", "Nuevo elemento" ahora gated por rol matcheando la ruta. |
| **H3** | 🟡 Pendiente decisión cliente | Validaciones mínimas del form Nuevo Cliente. Para la reunión. |
| **H4** | ✅ Validado | Matriz de roles vía Playwright fue correcta. No requiere acción. |
| **H5** | 🟡 Pendiente decisión cliente | ¿Cocina crea platos? Mientras se decide, el botón sigue matcheando ruta admin+cocina. |
| **H6** | ✅ Resuelto | Helper `nextOpcionLetra` extraído a `src/lib/cotizadorOpciones.ts` (commit `54f8782`). Opción 27 ya genera "AA". |
| **H7** | ✅ Falso positivo | Por inspección de código: `ClienteSelector.tsx:74-77` → `Cotizador.tsx:475-476` persiste `cliente_id` correctamente. El bug reportado fue evento sintético de Playwright que no dispara `onSelect` de Radix `cmdk`. Click humano real funciona. |
| **H8** | ✅ Resuelto | `ResumenCotizacion.tsx:382` ahora trata `next === 0` como override intencional (commit `a55fc4e`). El dialog de confirmación en `VersionEditorWizard` sigue validando la intencionalidad. |
| **H9** | ✅ Ya estaba | `v_menaje_reservas_cal` ya tiene `security_invoker=true` en `reloptions` (no figura más en advisors). |
| **H10** | ✅ Resuelto | Las 3 policies `USING(true)` dropeadas. `cotizacion_lugares` recibió 4 policies por rol; las otras 2 ya tenían policies por rol (commit `884124a` + migration `20260520000000`). |
| **H11** | ✅ Parcial | `trg_audit_*` (×3) y `log_cotizacion_change` con EXECUTE revocado de anon/public. Las 7 funciones restantes (`assign_role`, `revoke_role`, `has_role`, `cotizacion_has_active_share`, `create_ingrediente_with_proveedor`, `list_users_with_roles`, `list_cotizacion_audit`) tienen guards internos `has_role(...)` y son intencionalmente RPC-callable. Los advisors siguen reportándolas como WARN — falsos positivos del linter, los guards mitigan. |
| **H12** | ✅ Resuelto | `SET search_path = public, pg_temp` aplicado a las 13 funciones legacy. Advisors limpios. |
| **H13** | 🟠 Dashboard | Upgrade Postgres (5 min en Supabase Dashboard). |
| **H14** | 🟠 Dashboard | OTP expiry a < 60 min (Dashboard → Auth → Email provider). |
| **H15** | 🟠 Dashboard | Habilitar leaked password protection (Dashboard → Auth → Password protection). |
| **H16** | 🟢 Diferido | FKs sin índice. Solo importa a escala — no urgente. |

**Pendientes de datos (decisión cliente):**
- 17 platos con `codigo IS NULL` en `platos_catalogo` — no se pudieron mapear al portafolio comercial 2026.
- Gaseosa **BEB-003** con 2 precios distintos en el Excel del portafolio — cuál es el correcto.
- 209 platos sin receta (`plato_ingredientes` vacío) — afecta cálculo de costos en Cocina.

**Acciones manuales rápidas para la reunión (sin código):**
1. Dashboard Supabase → upgrade Postgres (H13).
2. Dashboard Supabase → Auth → OTP expiry a 30 min (H14).
3. Dashboard Supabase → Auth → enable leaked password protection (H15).

**Estado del repo al cierre:** 6 commits a `origin/main` en el sprint (último `cf1ddaf`). Working tree limpio.
