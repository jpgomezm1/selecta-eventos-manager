# Auditoría Paso 1 — Capa de datos

**Fecha:** 2026-04-20
**Alcance:** snapshot del schema real en Supabase (`xvvbxyjcieckbbdcuoge`), sincronización de `types.ts`, corrida de `tsc --noEmit`, inventario de RLS. **No se arregló nada** — este reporte alimenta el paso 2.

Archivos producidos en este paso:

- [`supabase/migrations/00_schema_baseline.sql`](supabase/migrations/00_schema_baseline.sql) — dump del schema actual (37 tablas + 1 vista + 10 funciones + 9 triggers + policies RLS).
- [`src/integrations/supabase/types.ts`](src/integrations/supabase/types.ts) — regenerado vía `mcp__supabase__generate_typescript_types` (pasó de ~6 tablas a las 37 reales + vista + 3 funciones).
- `supabase/migrations/_applied/` — parches sueltos verificados como ya aplicados (ver sección 7).

---

## 1. Inventario de tablas (37) + 1 vista

Agrupadas por dominio:

| Dominio | Tablas |
|---|---|
| **Clientes** | `clientes`, `cliente_contactos` |
| **Cotizaciones** | `cotizaciones`, `cotizacion_versiones`, `cotizacion_lugares`, `cotizacion_share_tokens`, `cotizacion_platos`, `cotizacion_personal_items`, `cotizacion_personal_asignaciones`, `cotizacion_transporte_items`, `cotizacion_menaje_items` |
| **Eventos** | `eventos`, `evento_personal`, `evento_requerimiento_platos`, `evento_requerimiento_personal`, `evento_requerimiento_transporte`, `evento_requerimiento_menaje`, `evento_orden_compra`, `evento_orden_compra_items` |
| **Catálogos** | `platos_catalogo`, `personal_costos_catalogo`, `personal`, `transporte_tarifas`, `lugares_catalogo`, `menaje_catalogo` |
| **Menaje (bodega)** | `menaje_reservas`, `menaje_reserva_items`, `menaje_movimientos`, `menaje_mov_items` |
| **Inventario (insumos) / Recetario** | `ingredientes_catalogo`, `ingrediente_proveedores`, `plato_ingredientes`, `inventario_movimientos`, `inventario_mov_items` |
| **Transporte (órdenes)** | `transporte_ordenes` |
| **Pagos** | `registro_pagos`, `registro_pago_eventos` |
| **Vistas** | `v_menaje_reservas_cal` |

Diferencia con la exploración previa: la lista planeada mencionaba ~35 tablas. La BD real tiene **37** — las 35 esperadas más coinciden. Ninguna tabla "fantasma" aparece; ninguna tabla esperada faltó.

El `types.ts` anterior solo cubría 6 tablas (`clientes`, `cliente_contactos`, `cotizacion_lugares`, `cotizacion_menaje_items`, `cotizacion_personal_asignaciones`, `cotizacion_versiones`); las 31 restantes trabajaban contra `any`, ocultando errores de tipo en todo el resto del código.

---

## 2. Hallazgos de schema

### 2A. `cotizacion_menaje_items` sin foreign keys — **crítico** → **CERRADO 2026-04-20**

La tabla tenía las 3 columnas (`cotizacion_id`, `cotizacion_version_id`, `menaje_id`) sin FK declarada. Items huérfanos posibles silenciosamente.

**Estado actual (2026-04-20):** las 3 FKs existen y siguen el patrón de las tablas hermanas:
- `cotizacion_id → cotizaciones(id) ON DELETE CASCADE`
- `cotizacion_version_id → cotizacion_versiones(id) ON DELETE CASCADE`
- `menaje_id → menaje_catalogo(id) ON DELETE RESTRICT`

Verificado además que las 4 tablas hermanas (`cotizacion_platos/personal_items/transporte_items/menaje_items`) tienen las FKs correspondientes.

**Hallazgo secundario (no estaba en §2A):** `cotizacion_platos.plato_id` y `cotizacion_transporte_items.transporte_id` están con `ON DELETE CASCADE`. Borrar un plato/tarifa del catálogo borra silenciosamente los items históricos en cotizaciones viejas — pierde trazabilidad. Considerar cambiar a `RESTRICT` (igual que `menaje_id`).

### 2B. `cotizacion_lugares` sin RLS — **crítico** → **CERRADO 2026-04-20**

Era la única tabla en `public` con `rls_enabled = false`. Todos sus datos (nombres de venues, precios, notas) eran leíbles/editables por cualquiera con la anon key.

**Estado actual (2026-04-20):** `rls_enabled = true` con 2 policies consistentes con el resto del schema:
- `Anon read shared lugares` (SELECT, role `anon`) — `qual: cotizacion_has_active_share(cotizacion_id)`. Consistente con las otras 6 policies anon de `cotizacion_*`.
- `Auth CRUD on cotizacion_lugares` (ALL, role `authenticated`) — `qual: true`. Consistente con el Patrón A del §7.

### 2C. Sin tipos `ENUM`, todo son `TEXT + CHECK`

Los estados de negocio viven como `text` con `CHECK (estado IN (...))`. No hay impacto inmediato pero dificulta refactors (renombrar un estado obliga a `ALTER CONSTRAINT` + update datos + update TS).

### 2D. `cotizacion_versiones.estado` duplica `cotizaciones.estado`

Ambas tablas tienen un CHECK idéntico con los 4 estados (`Pendiente por Aprobación`, `Enviada`, `Cotización Aprobada`, `Rechazada`). El default `'Borrador'` en BOTH columnas es inconsistente con el CHECK, lo que significa que un `INSERT` que no setee explícitamente `estado` fallaría el constraint. Ya había un parche (`sql_updates_estados_cotizacion.sql`) para esto pero aparentemente el default nunca se cambió.

### 2E. Columnas `estado_pago`/`metodo_pago` tipadas como `varchar(20)`/`varchar(50)`

`evento_personal.estado_pago` y `registro_pagos.*` usan `character varying` con límites cortos. No es un bug, pero es inconsistente con el resto del schema (todos los demás `estado`s son `text`).

---

## 3. Errores de TypeScript (`npx tsc --noEmit -p tsconfig.app.json`)

Total: **82 errores**. Clasificados:

### (a) Bugs reales — código que rompe en runtime

**`src/components/Cotizador/CotizacionChecklist.tsx`** hace queries a **3 tablas que no existen**:
- [CotizacionChecklist.tsx:53](src/components/Cotizador/CotizacionChecklist.tsx#L53) → `"ordenes_compra"` (la tabla real es `evento_orden_compra`)
- [CotizacionChecklist.tsx:68](src/components/Cotizador/CotizacionChecklist.tsx#L68) → `"despachos_ingredientes"` (no existe; lo equivalente es `inventario_movimientos` con `tipo='uso'`)
- [CotizacionChecklist.tsx:73](src/components/Cotizador/CotizacionChecklist.tsx#L73) → `"despachos_menaje"` (no existe; lo equivalente es `menaje_movimientos` con `tipo='salida'`)

Efecto: cada una devuelve `{ error }`, el código ignora el error y usa `?? null` / `.length > 0`, así que el checklist siempre muestra "sin orden/despachos" sin importar el estado real. **Dead code pretendiendo funcionar** — todo esto corre en prod hoy devolviendo estados incorrectos.

**`src/integrations/supabase/apiCotizador.ts`** (líneas 476, 488, 500, 514) — `ensureEventFromVersion` construye `rows` con `.map((r: any) => ...)` sobre catálogos tipados como `any`. `Map.get()` devuelve `unknown` y la coerción cae a Postgrest. Arreglable tipando los catálogos cargados desde `platos_catalogo`/`transporte_tarifas`/etc. con `Tables<"...">`.

### (b) Tipos locales redundantes / desactualizados

- [NuevoMovimientoDialog.tsx:68](src/components/Inventario/NuevoMovimientoDialog.tsx#L68) — el tipo `InventarioMovimiento` exportado por `apiInventario` marca `factura_url` como requerido; en la BD es nullable. El componente no pasa `factura_url` y el type error lo delata. Fix: propagar el tipo oficial `TablesInsert<"inventario_movimientos">` o ajustar el tipo local.
- Hay un `src/types/database.ts` que predate la regeneración de `types.ts`. Revisar si duplica cosas que ahora están en el types canónico.

### (c) Casts/spreads no relacionados con la BD

~70 errores `TS2556 — A spread argument must either have a tuple type or be passed to a rest parameter` en `src/lib/pdf-generator.ts`, `src/lib/premium-pdf-generator.ts`, `src/lib/selecta-premium-pdf.ts`. Son llamadas al API de `jspdf` donde se spreadea un tuple mal tipado. Pre-existente y ajeno a esta auditoría — notarlo pero no bloquear con esto.

---

## 4. Funciones multi-paso sin transacción — **CERRADO 2026-04-20**

Las 6 funciones identificadas fueron movidas a RPCs `plpgsql` (atómicas por default).

| Archivo cliente | Función JS | RPC en DB |
|---|---|---|
| [apiCotizador.ts:252](src/integrations/supabase/apiCotizador.ts) | `createCotizacionWithVersions` | `create_cotizacion_with_versions(p_payload jsonb)` |
| [apiCotizador.ts:388](src/integrations/supabase/apiCotizador.ts) | `ensureEventFromVersion` | `ensure_event_from_version(p_cotizacion_id, p_cotizacion_version_id, p_nombre_evento, p_fecha_evento, p_ubicacion, p_descripcion)` |
| [apiCotizador.ts:596](src/integrations/supabase/apiCotizador.ts) | `setVersionDefinitiva` | `set_version_definitiva(p_cotizacion_id, p_version_id)` — llama internamente a `ensure_event_from_version` en el mismo scope |
| [apiOrdenCompra.ts:193](src/integrations/supabase/apiOrdenCompra.ts) | `registrarCompraEnInventario` | `registrar_compra_en_inventario(p_orden_id, p_evento_id)` |
| [apiMenaje.ts:357](src/integrations/supabase/apiMenaje.ts) | `despacharMenajeDesdeReserva` | `despachar_menaje_desde_reserva(p_reserva_id, p_evento_id, p_items jsonb)` |
| [apiMenaje.ts:411](src/integrations/supabase/apiMenaje.ts) | `registrarDevolucionMenaje` | `registrar_devolucion_menaje(p_reserva_id, p_evento_id, p_items jsonb)` |

Las 6 RPCs son `language plpgsql`, `security_definer = false` (corren como el caller). En el contexto de este proyecto donde todas las policies de `authenticated` son `USING (true)`, no hay diferencia práctica con `SECURITY DEFINER`.

**Hallazgos secundarios (no estaban en el alcance original del §4):**
- `addVersionToCotizacion` y `updateVersionCotizacion` siguen siendo no atómicas (insert versión + insert items en pasos). Riesgo similar pero menor (afectan una versión, no toda la cotización).
- `updateVersionCotizacion` recalcula `total` client-side con la fórmula vieja (sin lugares) — bug paralelo al N2 de la sesión e2e: editar una versión post-creación pierde el costo del lugar del `total`.

---

## 5. Queries directas a Supabase saltándose los api modules — confirmadas

[`src/components/Eventos/PersonalPanel.tsx`](src/components/Eventos/PersonalPanel.tsx) hace queries directas en:
- líneas 41-62 (fetch de `evento_personal` con join a `personal`),
- líneas 106-114 (insert en `evento_personal`),
- línea 124 (update de `evento_personal`).

El CLAUDE.md del proyecto prescribe que todo pase por los api modules de `src/integrations/supabase/`. No existe `apiPersonal.ts` — crearlo es parte del paso 2.

Adicional: [`CotizacionChecklist.tsx`](src/components/Cotizador/CotizacionChecklist.tsx) también hace queries directas (además de usar nombres de tablas inexistentes — punto 3a).

---

## 6. Errores silenciados — confirmados

- [apiClientes.ts:58](src/integrations/supabase/apiClientes.ts#L58) — `searchClientes` hace `try { ... } catch { return [] }`.
- [apiClientes.ts:127](src/integrations/supabase/apiClientes.ts#L127) — `listContactos` hace `try { ... } catch { return [] }`.
- [apiShare.ts:97](src/integrations/supabase/apiShare.ts#L97) — tragado similar.

Todos enmascaran fallas de red/RLS mostrando listas vacías al usuario. Fix: propagar a React Query para que se muestren los estados de error en UI.

---

## 7. Políticas RLS — todas permisivas

De **64 policies** inventariadas, **ninguna** filtra por `auth.uid()` o cualquier dato de sesión. Todas entran en una de estas categorías:

### Patrón A: `USING (true)` sobre role `authenticated`

Efecto: cualquier usuario logueado puede leer/escribir cualquier fila de cualquier cotización/evento/cliente. No hay separación por empresa/tenant/user. 37 policies en este patrón.

Tablas: `clientes`, `cliente_contactos`, `cotizaciones`, `cotizacion_versiones`, `cotizacion_share_tokens`, `cotizacion_platos`, `cotizacion_personal_items`, `cotizacion_transporte_items`, `eventos`, `evento_personal`, `evento_requerimiento_*`, `personal`, `personal_costos_catalogo`, `platos_catalogo`, `transporte_tarifas`, `lugares_catalogo`, `registro_pagos`, `registro_pago_eventos`.

### Patrón B: `USING (auth.role() = 'authenticated')` sobre `PUBLIC`

Semánticamente similar al A pero implementado sobre `TO PUBLIC`. Más inestable — si la función `auth.role()` llega a fallar (ej. JWT malformado), cae a `NULL`/falso y bloquea al usuario. 20 policies en este patrón.

Tablas: `menaje_catalogo`, `menaje_reservas`, `menaje_reserva_items`, `menaje_movimientos`, `menaje_mov_items`, `inventario_movimientos`, `inventario_mov_items`, `evento_orden_compra`, `evento_orden_compra_items`, `evento_requerimiento_menaje`, `transporte_ordenes`, `cotizacion_menaje_items`, `cotizacion_personal_asignaciones`, `ingrediente_proveedores`.

### Patrón C: policies anónimas (únicas que filtran)

Sólo estas 7 `policies` tienen lógica no trivial — usadas por el flujo de `/compartido/:token`:

| Tabla | Policy | Expresión |
|---|---|---|
| `cotizacion_share_tokens` | "Anon read active share tokens" | `is_active = true` |
| `cotizaciones` | "Anon read shared cotizaciones" | `cotizacion_has_active_share(id)` |
| `cotizacion_versiones` | "Anon read shared versiones" | `cotizacion_has_active_share(cotizacion_id)` |
| `cotizacion_platos` | "Anon read shared platos" | `cotizacion_has_active_share(cotizacion_id)` |
| `cotizacion_personal_items` | "Anon read shared personal" | `cotizacion_has_active_share(cotizacion_id)` |
| `cotizacion_transporte_items` | "Anon read shared transporte" | `cotizacion_has_active_share(cotizacion_id)` |
| `cotizacion_menaje_items` | "Anon read shared menaje" | `cotizacion_has_active_share(cotizacion_id)` |

Además, varios catálogos (`platos_catalogo`, `personal_costos_catalogo`, `transporte_tarifas`, `menaje_catalogo`, `clientes`, `cliente_contactos`) tienen "Anon read ... shared" con `USING (true)` — leíbles por el anon sin ningún filtro. No es un gran riesgo porque son datos de catálogo, pero leakea por ej. la lista completa de clientes a cualquiera que tenga la anon key.

### Policies duplicadas

`cotizaciones`, `cotizacion_platos`, `cotizacion_transporte_items`, `cotizacion_versiones`, `cotizacion_personal_items` tienen a la vez una policy `FOR ALL` y policies individuales `FOR SELECT`/`INSERT`/`UPDATE`/`DELETE`. Todas permisivas → no cambia el resultado, pero son legacy ("auth all xxx" + "auth select xxx" + "auth insert xxx"...). Consolidar en paso 2.

---

## 8. Parches SQL sueltos — movidos a `_applied/`

Se verificó contra el dump que los siguientes ya están aplicados en la BD y se movieron a [`supabase/migrations/_applied/`](supabase/migrations/_applied/):

| Archivo | Qué hace | Verificación |
|---|---|---|
| `sql_updates_estados_cotizacion.sql` | Actualiza CHECK de `estado` en `cotizaciones`/`cotizacion_versiones` a los 4 estados actuales. | CHECK en BD coincide ✓ |
| `sql_updates_modalidad_cobro_personal.sql` | Agrega `modalidad_cobro`, `tarifa_hora_extra` a `personal` y `modalidad_cobro` a `personal_costos_catalogo`. | Columnas + CHECKs existen ✓ |
| `share_tokens.sql` | Crea `cotizacion_share_tokens`, función `cotizacion_has_active_share`, 11 policies de anon. | Todo existe ✓ |
| `pipeline_columns.sql` | Agrega `motivo_rechazo`, `notas_rechazo`, `fecha_envio`, `fecha_cierre` + `chk_motivo_rechazo`. | Todo existe ✓ |
| `cotizacion_lugares_precio.sql` | Crea `cotizacion_lugares`. | Tabla existe ✓ (pero sin RLS — ver hallazgo 2B) |
| `scripts/migration-recetario.sql` (copia) | Crea `ingredientes_catalogo`, `plato_ingredientes`, agrega columnas recetario a `platos_catalogo`. | Todo existe ✓ |

**Nota:** el archivo original en `scripts/` se dejó ahí para no romper el seed existente — se copió, no se movió.

Los 5 archivos timestamped que ya estaban en `supabase/migrations/` (`20250704*.sql`) se dejaron donde estaban.

---

## 9. TODO encontrado en código

- [`Dashboard/ProximosEventos.tsx:170`](src/components/Dashboard/ProximosEventos.tsx#L170) — confirmado, ya identificado antes.

---

## 10. Advisor de Supabase

Pendiente: correr `mcp__supabase__get_advisors({type: "security"})` y `{type: "performance"}` al principio del paso 2 para capturar hallazgos que Supabase mismo reporta (missing indexes, RLS warnings, secrets expuestos, etc.). No se incluyó en este paso para no ampliar el alcance.

---

## Priorización sugerida para paso 2

1. **[Crítico — seguridad]** 2B: habilitar RLS en `cotizacion_lugares`.
2. **[Crítico — correctness]** 2A: agregar FKs a `cotizacion_menaje_items`.
3. **[Alto — bug funcional]** 3a: arreglar `CotizacionChecklist.tsx` — usar los nombres reales de tablas.
4. **[Alto — riesgo de datos]** §4: envolver las 6 funciones multi-paso en RPCs `plpgsql` transaccionales.
5. **[Medio — arquitectura]** §5: crear `apiPersonal.ts` y mover las queries directas de `PersonalPanel.tsx` y `CotizacionChecklist.tsx`.
6. **[Medio — UX]** §6: dejar de silenciar errores en `apiClientes.ts` / `apiShare.ts`.
7. **[Medio — tipado]** 3a (parte 2): tipar los `Map<any, any>` de `ensureEventFromVersion` con `Tables<"...">`.
8. **[Bajo — housekeeping]** Consolidar policies duplicadas del patrón A.
9. **[Bajo — housekeeping]** `InventarioMovimiento` type (3b).
10. **[Fuera del alcance del paso 2, pero visible]** Los 70 errores de `pdf-generator.ts` son un ticket aparte.

**No** está listo todavía para paso 3 (validación de lógica de negocio: cálculo de pagos, precios, stock): hasta que no se arregle §4, cualquier test E2E sobre esos flujos puede dar falsos positivos.
