# TODO — Selecta Eventos Manager

Pendientes priorizados fuera del scope del walk del sidebar.

## 🔴 Prioridad alta

### Edge function `generate-recipe` — hardening de seguridad y costos

**Ubicación:** `supabase/functions/generate-recipe/index.ts`

**Qué hace:** thin proxy a `api.anthropic.com/v1/messages`. La invocan dos flujos del frontend:
- `src/services/anthropic.ts::generateRecipeFromDescription` — genera recetas desde descripción (tokens bajos).
- `src/services/invoiceScanner.ts::scanInvoice` — lectura de facturas PDF/imagen (tokens altos, 50K–100K por request).

**Riesgo:** no tiene rate-limit ni tracking por usuario. Un usuario autenticado puede hacer miles de requests en minutos y quemar los créditos de Anthropic. El abuse de `scanInvoice` es más caro por request.

**Protección actual (ya validada en repo):**
- `supabase/config.toml` no declara `[functions.generate-recipe]` con `verify_jwt = false`, así que el default de Supabase aplica: `verify_jwt = true`. Solo usuarios con JWT válido pueden invocarla. Anónimos no.

**Acciones a completar (en orden):**

1. **Verificar configuración en Supabase Dashboard** (5 minutos):
   - [ ] Functions → `generate-recipe` → `verify_jwt` está **ON**.
   - [ ] Authentication → Providers → Email signup está **cerrado** (solo staff puede crear cuentas, o si está abierto, es decisión consciente).
   - [ ] Anthropic Console → Settings → Usage limits → hay un **límite mensual de gasto** configurado con alerta.

2. **Rate-limit por usuario en la edge function:**
   - [x] Migration `supabase/migrations/20260422000000_edge_function_calls_rate_limit.sql` crea la tabla con RLS on + sin policies (solo service role).
   - [x] `generate-recipe/index.ts` reescrito: valida JWT, detecta si el body tiene adjunto (factura), aplica umbrales 20/min texto vs 5/min adjunto, rechaza con 429 + Retry-After si excede. Fail-open si la tabla falla (no bloquear usuarios reales por error operativo).
   - [ ] **Pendiente aplicar a prod** (apply_migration + deploy_edge_function). Requiere confirmación explícita del usuario.
   - [ ] Limpieza periódica de filas antiguas (cron o scheduled trigger). Sugerido: `delete from edge_function_calls where called_at < now() - interval '1 hour'` cada hora, via pg_cron o función scheduled.

3. **Opcional — restringir por rol:**
   - [ ] Si solo determinados empleados deben poder usar la función, leer el `role` / claim del JWT o consultar una tabla de permisos, rechazar si no autorizado.

**Notas:**
- El hallazgo original se catalogó como #37 del walk y está en `project_selecta_roadmap.md` del usuario.
- Es scope aparte del walk porque toca infraestructura de edge function + schema de rate-limit + config del Dashboard.
