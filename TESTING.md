# Plan de Testing E2E — Selecta

Documento para una pasada manual completa antes de entregar al cliente. Diseñado para hacerse en una sola sesión de ~60 min con DevTools abierto todo el tiempo.

---

## 0. Setup

### URLs
- **Local (dev):** http://localhost:4000/
- **Producción (Netlify):** https://selecta-eventos.netlify.app
- **Supabase project:** `xvvbxyjcieckbbdcuoge` (Selecta-Personal)

<!-- ### Credenciales -->

Completar antes de empezar. Si falta alguna cuenta, crearla desde `/usuarios` con la cuenta admin.

| Rol           | Email                                  | Password    |
|---------------|----------------------------------------|-------------|
| `admin`       | `admin@selecta.testing`                | `pruebas123` |
| `comercial`   | `comercial@selecta.testing`            | `pruebas123` |
| `operaciones` | `operaciones@selecta.testing`          | `pruebas123` |
| `cocina`      | `cocina@selecta.testing`               | `pruebas123` |
| Sin rol       | _crear desde `/usuarios` y dejar sin roles asignados_ | `pruebas123` |

> Cuentas reales (no usar para testing destructivo): `jpgomez@stayirrelevant.com`, `tomasmejiarico122@gmail.com` — ambas con rol `admin`.

### Herramientas durante el testeo
- DevTools abierto en pestaña **Console** + **Network** (filtro: `Fetch/XHR`).
- Si aparece algún log rojo, warning de React Query, key duplicada, o status 4xx/5xx en Network → es un bug. Capturar y reportar.
- En cada pantalla nueva, hacer un refresh manual (Cmd/Ctrl+R) para validar que carga bien sin estado previo.

---

## 1. Matriz de acceso por rol

Confirma esta tabla entrando con cada cuenta. Si una cuenta ve algo que NO debería, es un bug de seguridad.

| Ruta                    | admin | comercial | operaciones | cocina | sin rol |
|-------------------------|:-----:|:---------:|:-----------:|:------:|:-------:|
| `/panorama`             | sí    | sí        | sí          | sí     | redirige a `/sin-acceso` |
| `/eventos`              | sí    | sí        | sí          | sí     | — |
| `/eventos/:id`          | sí    | sí        | sí          | sí     | — |
| `/cotizaciones`         | sí    | sí        | sí          | NO     | — |
| `/cotizaciones/nueva`   | sí    | sí        | NO          | NO     | — |
| `/cotizaciones/:id`     | sí    | sí        | sí          | NO     | — |
| `/pipeline`             | sí    | sí        | NO          | NO     | — |
| `/clientes`             | sí    | sí        | NO          | NO     | — |
| `/personal`             | sí    | NO        | sí          | NO     | — |
| `/transporte`           | sí    | NO        | sí          | NO     | — |
| `/bodega`               | sí    | NO        | sí          | NO     | — |
| `/inventario`           | sí    | NO        | NO          | sí     | — |
| `/recetario`            | sí    | NO        | NO          | sí     | — |
| `/cocina`               | sí    | NO        | NO          | sí     | — |
| `/catalogos`            | sí    | NO        | NO          | NO     | — |
| `/usuarios`             | sí    | NO        | NO          | NO     | — |

**Cómo testear:** entrar con cada rol → intentar navegar manualmente a una ruta que NO le toca (tipo: comercial pegando `/inventario` en la URL). Debería redirigir a `/panorama`.

---

## 2. Smoke test (5 min)

Si esto pasa, el sistema arranca sano. Si algo falla acá, parar todo y reportar.

1. Login con admin.
2. Navegar a `/panorama` — KPIs y cards cargan sin error.
3. Navegar a `/cotizaciones` — la lista paga (con paginación si hay > 15).
4. Navegar a `/eventos` — la lista y el calendario cargan.
5. Navegar a `/recetario` — los 393 platos aparecen.
6. Navegar a `/cocina` — la vista de hoy carga (puede estar vacía si no hay eventos).
7. Logout → volver a entrar.

---

## 3. Flujo end-to-end principal (cotización → evento → cierre)

Este es el "golden path". Hacerlo de punta a punta con una cotización TEST creada para esto.

### 3.1 Crear cliente
- `/clientes` → **Nuevo cliente**.
- Nombre: `TEST [tu_inicial] [timestamp]`.
- Edge cases:
  - Crear sin teléfono / sin email — ¿deja guardar o exige campos?
  - Crear con caracteres especiales (tildes, ñ, comilla simple: `O'Brien`).

### 3.2 Crear cotización
- `/cotizaciones/nueva`.
- Cliente: el recién creado.
- Wizard paso a paso. Cosas a probar en cada paso:
  - **Lugares:** agregar 2 lugares. Cambiar precio del lugar y verificar que se refleje en el total.
  - **Opción A:** agregar 3 platos:
    - 1 con receta nueva (algún plato cargado en F3b — ej. de PARRILLA, PROTEINA).
    - 1 del portafolio 2026 (cualquier código BEB/COC/PAN/etc.).
    - 1 sin receta (ej. un vino VIN-* o BEB-* sin ingredientes).
  - **Opción B:** duplicar Opción A → modificar cantidades. Verificar que A y B son independientes.
  - **Opción C:** agregar manualmente. Llegar a la letra Z y agregar una más → debe pasar a AA.
  - **Personal:** 2 mozos en `por_hora`, 1 chef en `jornada_10h`. Verificar que el subtotal se calcule correctamente.
  - **Transporte:** agregar 1 tarifa.
  - **Menaje:** agregar al menos 1 categoría.

**Edge cases del cotizador:**
- Cantidad 0 en un plato — ¿se guarda? ¿qué pasa con el subtotal?
- Cantidad negativa — ¿valida?
- Borrar todos los platos de una opción — ¿la opción queda en $0 sin romper?
- Eliminar una opción del medio (B de [A, B, C]) — ¿el orden y los nombres se recalculan?
- Cambiar el cliente a mitad del wizard — ¿pierde el estado?
- Cerrar el navegador en medio del wizard y volver a abrir — ¿hay autosave o se pierde?

### 3.3 Guardar y revisar la cotización
- Guardar → ir a `/cotizaciones/:id`.
- Verificar subtotales de cada opción.
- Generar PDF de la opción A → comparar con lo que muestra la UI (totales, lugares, platos, personal).
- Generar PDF "premium" si existe — ¿el layout es consistente con el normal?
- Compartir link público → abrir en incógnito.

**Edge cases del PDF:**
- Cotización con muchos platos (10+) en una opción — ¿se pagina bien?
- Cliente con nombre muy largo — ¿se corta o se desborda?

### 3.4 Override del total (solo admin)
- En la cotización, sobrescribir el total a un valor distinto.
- Guardar.
- Verificar:
  - El total visible cambia al override.
  - Aparece un audit row con tu email + timestamp + valor original + valor nuevo.
- **Edge cases:**
  - Override a $0 — ¿deja?
  - Override negativo — debería rechazar.
  - Revertir el override (volver al valor calculado).

### 3.5 Convertir a evento
- Aprobar la cotización → convertir a evento.
- Verificar que aparece en `/eventos`.
- Click → entrar al detalle.

### 3.6 Detalle de evento
En `/eventos/:id`, probar cada tab:

**Tab Personal:**
- Asignar empleados a los roles definidos.
- Marcar `hora_inicio` y `hora_fin` en uno (modalidad `por_hora` o `jornada_hasta_10h`).
- Verificar:
  - `horas_trabajadas` se calcula solo.
  - `pago_calculado` se actualiza.
- **Edge case:** hora fin antes que hora inicio (en `jornada_nocturna` esto es válido por cruce de medianoche; en otras debería rechazar o no auto-calcular).

**Tab Menaje:**
- Reservar un set de menaje.
- Confirmar salida.
- Registrar devolución parcial: devolver 5 de 10, merma 2 — verificar que `5 + 2 ≤ 10` se respeta en el input.
- **Edge case crítico:** intentar registrar devolución dos veces sobre la misma reserva → el RPC debe rechazar con error claro.
- **Edge case:** intentar `devuelto + merma > despachado` → debe bloquear.

**Tab Transporte:**
- Agregar orden con tarifa.
- Cambiar el tipo de evento — ¿la tarifa se ajusta?

**Tab Orden de Compra:**
- Agregar items.
- Dejar uno con `cantidad_comprar < cantidad_necesaria - inventario` → debe aparecer warning (ícono alerta + borde olive + tooltip).
- Tipear rápido en cantidades → autosave debounced a 400ms; verificar que no parpadee.
- **Edge case:** cantidad 0 — ¿permite guardar la orden completa?

**Tab Cierre:**
- Verificar que las cifras cuadren con la cotización.
- Si hay override, debe reflejarse acá.

### 3.7 Vista de Cocina
- `/cocina` con la fecha del evento creado.
- Verificar:
  - Los platos del evento aparecen.
  - La receta está escalada a las porciones reales del evento.
- Cambiar a vista semana → el evento aparece en su día.
- **Edge case:** evento sin platos con receta (todos vinos/bebidas) — la vista no debe romper, debería decir "sin recetas".

---

## 4. Tests funcionales por dominio

### 4.1 Recetario (`/recetario`)
- Buscar por nombre — usar tildes y mayúsculas para verificar match insensible.
- Filtrar por categoría.
- Abrir un plato → ver detalle.
- Editar precio → guardar → recargar → verificar persistencia.
- Crear nuevo ingrediente desde el dialog (debe usar el RPC `create_ingrediente_with_proveedor` — si crea solo el ingrediente y queda sin proveedor, es bug).
- **Edge case:** ingrediente con proveedor duplicado (mismo nombre 2 veces) — ¿maneja?
- **Edge case:** plato con 0 ingredientes — ¿el costo se calcula como $0 sin error?
- Generar receta con AI (botón con texto descriptivo) — debe pegar a la edge function. Si está rate-limited, verificar mensaje claro de "intenta en X segundos".

### 4.2 Inventario (`/inventario`)
- Crear movimiento manual de **ingreso** con 3 ingredientes.
- Guardar como borrador → editar → confirmar.
- Verificar que el stock se actualizó.
- Crear movimiento de **salida** y verificar que el stock baja.
- Eliminar un movimiento confirmado → debe revertir stock.
- **Cargar factura AI:** subir PDF o imagen de una factura real.
  - Si toma > 90 segundos → debe dar error de timeout claro.
  - Si la AI se equivoca y editás un match manual → la confianza debe pasar a "media" (no quedar "alta").
- **Edge case:** crear movimiento con item cantidad = 0 → botones de guardar y confirmar deben estar disabled.
- **Edge case:** cancelar un movimiento confirmado → verificar que stock revierte Y que estadísticas excluyen los cancelados.

### 4.3 Bodega / Menaje (`/bodega`)
- Ver el calendario de reservas.
- Click en una reserva → abrir detalle.
- Crear movimiento (ingreso o salida) de menaje.
- **Edge case:** reservas con `fecha_inicio` borde de día — verificar TZ (no debe saltarse a otro día por UTC).

### 4.4 Personal (`/personal`)
- Lista paginada.
- Crear empleado nuevo con cada modalidad (`por_hora`, `jornada_9h`, `jornada_10h`, `jornada_hasta_10h`, `jornada_nocturna`, `por_evento`).
- Entrar al detalle → tab "Estadísticas Avanzadas" debe mostrar "Próximamente" (es esperado, depende del Telegram clock-in/out futuro).
- Liquidación consolidada.
- **Edge case:** carga masiva Excel — descargar el template, llenarlo, subir. Validar que matchee roles/modalidades correctamente (ver `INSTRUCCIONES_CARGA_MASIVA.md`).

### 4.5 Catálogos (`/catalogos`)
Solo admin. Probar cada tab:
- **Platos:** ya está cargado con 393. Buscar, editar precio de uno → verificar que se refleje en cotizaciones futuras.
- **Personal costos:** la nomenclatura debe decir "precio al cliente" en todos los textos.
- **Transporte:** lista de tarifas.
- **Menaje:** lista de categorías.
- **Lugares:** crear nuevo con checkbox "Activo" desmarcado → verificar que NO aparezca en el selector de cotizaciones.

### 4.6 Pipeline (`/pipeline`)
- Drag & drop una tarjeta entre columnas.
- El label "Abrir para aprobar" (NO "Aprobar") debe estar en las cards del estado correcto.
- **Edge case:** cotización sin fecha de evento — ¿se ve en alguna columna o se filtra?

### 4.7 Usuarios (`/usuarios`)
Solo admin.
- Crear usuario nuevo con email + password + rol(es).
- Verificar que recibe email de Supabase con link (si está habilitado).
- Cambiar rol de un usuario existente.
- Desactivar usuario → confirmar que no puede loguear.
- **Edge case crítico:** intentar pegar `/auth/signup` en URL → debe dar 404 o redirigir. El signup público está cerrado.

---

## 5. Cross-cutting

### 5.1 Responsive 375px (iPhone SE)
DevTools → modo dispositivo → iPhone SE.
Recorrer:
- `/panorama`
- `/eventos` y `/eventos/:id` (todos los tabs)
- `/cotizaciones/nueva` (wizard completo)
- `/cotizaciones/:id` (con el PDF embebido)
- `/cocina`
- `/recetario` → detalle de plato

Buscar: textos cortados, botones tapados, tablas con scroll horizontal indeseado, menú lateral que tapa contenido.

### 5.2 Performance
- Lista de cotizaciones con scroll a la página 5+ — ¿lento?
- Abrir una cotización con muchas versiones — antes había N+1 (resuelto el 2026-04-29). Confirmar que no haya regresión.
- Recetario con 393 platos — search debe ser instantáneo (debounced).
- Network tab: ninguna pantalla principal debería hacer > 10 requests al cargar.

### 5.3 Seguridad
- Logueado como `cocina` → pegar `/usuarios` en URL → redirige a `/panorama`.
- Logueado como `comercial` → pegar `/inventario` en URL → redirige.
- Cuenta sin rol → cualquier ruta protegida → redirige a `/sin-acceso`.
- Edge function `generate-recipe`:
  - Hacer 21 llamadas seguidas al generar receta de texto → la 21ª debe dar 429.
  - Hacer 6 escaneos de factura → el 6º debe dar 429.
  - Sin token JWT (testeable con `curl` directo) → debe dar 401.

### 5.4 TZ y formatos
- Cualquier fecha mostrada — verificar que no se "corra" un día al guardar y recargar.
- Moneda en COP — ¿siempre con punto de mil correcto?
- Decimales en cantidades — coherencia (¿algunos usan coma, otros punto?).

---

## 6. Reporte de bugs

Para cada bug encontrado, anotar:

```
Pantalla: /ruta/exacta
Rol: admin / comercial / operaciones / cocina
Pasos:
  1. ...
  2. ...
Esperado: ...
Observado: ...
Console / Network error: [pegar acá si aplica]
Severidad: bloqueante / mayor / menor / cosmético
```

**Severidad guía:**
- **Bloqueante:** impide completar el flujo principal (cotizar → evento → cierre).
- **Mayor:** dato incorrecto, datos perdidos, error visible al usuario final.
- **Menor:** comportamiento raro pero recuperable.
- **Cosmético:** layout, copy, alineación.

---

## 7. Pendientes conocidos (NO son bugs, no reportar)

- Tab "Estadísticas Avanzadas" en detalle de empleado = "Próximamente" (esperando Telegram clock-in/out).
- 17 platos en BD sin código + 209 sin receta (decisión de datos, no de código).
- BEB-003 Gaseosa con 1 solo precio cuando el archivo tenía 2 (decisión pendiente del cliente).
- No hay reportes/analytics, ni notificaciones activas, ni onboarding (backlog producto, sin definir).
