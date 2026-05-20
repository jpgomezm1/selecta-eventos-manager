# Agenda — Reunión Selecta 2026-05-21

Brief no técnico para la reunión con el cliente. La app está lista; lo que necesitamos hoy es destrabar lo que solo ellos pueden definir y mostrarles cómo funciona para que empiecen a operar.

---

## 1. Qué les hace falta para que esto esté andando

### Datos del catálogo

- **17 platos sin código.** Están cargados en la BD pero no se pudieron mapear al portafolio comercial. Hay que revisarlos uno por uno: ¿son platos descontinuados, duplicados, o les falta el código en el Excel del portafolio?
- **Gaseosa BEB-003 con 2 precios distintos.** En `PORTAFOLIO COMERCIAL precios 2026.xlsx` aparece con dos valores. Definir cuál es el correcto.
- **209 platos sin receta.** No es bloqueante para vender (los precios al cliente sí están), pero afecta el cálculo automático de costos en `/cocina`. Se pueden generar con la herramienta AI del recetario uno por uno, o ir cargando solo los que más venden.

### Decisiones de producto

- **Naming del menú lateral.** Hoy `/bodega` aparece como "Menaje" y `/cocina` como "Producción". ¿Quieren que las URLs coincidan con los labels, o lo dejamos así?
- **Form de cliente nuevo.** Hoy se puede crear un cliente con solo el nombre (sin teléfono, sin email, sin cédula). ¿Qué campos quieren obligatorios? Recomendado: nombre + al menos uno de contacto.
- **¿Cocina puede crear platos?** Hoy el rol `cocina` puede crear platos nuevos en `/recetario`. ¿Es intencional o debería ser admin-only?

### Datos operativos para empezar a trabajar

- Cargar el **roster real de empleados** (la app tiene importador masivo desde Excel en `/personal`).
- Cargar los **clientes reales**, o ir creándolos a medida que se cotiza.
- Decidir **quiénes acceden con qué rol** (admin / comercial / operaciones / cocina) y darles cuenta.

### 3 acciones de 5 minutos en Dashboard de Supabase (de su lado, sin código)

- Subir versión de Postgres (botón "Upgrade" en el dashboard de Supabase).
- Bajar expiry de códigos OTP a 30 minutos (Auth → Email provider).
- Activar protección contra contraseñas filtradas (Auth → Password protection → HaveIBeenPwned).

---

## 2. Cómo podemos ayudarlos a destrabar esto

### Lo que ya está listo de nuestro lado

- Catálogo de platos: 49 → 393 cargados.
- Precios portafolio 2026: 197 actualizados con el ajuste anual del +15 a +18 %.
- Recetas: 138 platos con receta cargada (+800 ingredientes mapeados).
- Tarifas de transporte verificadas.
- 16 hallazgos del walk técnico cerrados.

### Lo que podemos hacer si lo piden

- Sesión de **carga masiva del roster** — si nos pasan el Excel de empleados, lo procesamos y queda andando.
- Sesión de **carga de clientes** vía Excel si tienen base existente.
- **Workshop corto** (1 hora) por área: pipeline + cotizador, cocina, menaje. Se puede grabar para onboardings futuros.
- **Generación de recetas faltantes** con la herramienta AI del recetario.
- **Onboarding de usuarios** — crear cuentas y asignar roles desde `/usuarios`.

### Lo que es decisión solo de ellos

- Los 6 ítems del bloque anterior (datos + decisiones de producto).

---

## 3. Cómo funciona la app (tour conceptual breve)

El flujo del negocio mapea uno a uno a la app:

1. **Pipeline** (`/pipeline`) — tablero kanban con todas las cotizaciones por estado, desde prospecto hasta aprobada.
2. **Cotizaciones** (`/cotizaciones/nueva`) — wizard de varios pasos para armar una propuesta. Soporta **opciones A/B/C** con precios distintos (típico cuando el cliente pide alternativas). Admin puede sobrescribir el total final si negocia con el cliente. Se genera un **PDF editorial** y un **link público** para compartir sin necesidad de cuenta.
3. **Eventos** (`/eventos`) — cuando una cotización se aprueba, se convierte en evento. Ahí se gestionan los paneles por área:
   - **Menaje**: reserva de inventario con calendario.
   - **Personal**: asignación de empleados con cálculo automático según modalidad (por hora, jornada, nocturna, etc.).
   - **Transporte**: rutas y costos.
   - **Cierre**: balance final del evento.
4. **Cocina** (`/cocina`) — vista de producción del día o la semana. Muestra los platos a preparar consolidados, con la receta escalada al número real de invitados. Es lo que el chef abre cuando llega al sitio.
5. **Bodega / Inventario** (`/bodega` y `/inventario`) — dos cosas distintas: menaje (lo que se alquila y se devuelve) e ingredientes (con lectura automática de facturas vía AI cuando llega mercadería).
6. **Catálogos** (`/catalogos`, solo admin) — master data: lista de platos con precio, tarifas de personal, tarifas de transporte. Cambiar acá se refleja en todas las cotizaciones nuevas.
7. **Roles** — 4 perfiles:
   - **admin**: todo.
   - **comercial**: ventas y cotizaciones.
   - **operaciones**: eventos, menaje, personal, transporte.
   - **cocina**: recetario, inventario, producción.

   Cada rol solo ve lo suyo en el menú; los botones de acción también se ocultan si no tiene permiso.

### Demo en vivo sugerida (si hay tiempo)

- Crear una cotización de punta a punta (~90 segundos).
- Generar el PDF.
- Compartir el link público.
- Mostrar `/cocina` con la receta escalada.
