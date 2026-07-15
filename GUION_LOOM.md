# Guion del Loom — recorrido de la app para la encargada de seguimiento

> Documento interno. Duración objetivo: **8-10 minutos**. Público: la persona (no técnica)
> que llevará el seguimiento y los requerimientos por parte de Selecta.
> Complementa `GUIA_SEGUIMIENTO.html` — el video muestra el flujo vivo, la guía queda de referencia.

## Antes de grabar (2 minutos de preparación)

- [ ] Entrar como **admin** en `https://selecta-eventos.netlify.app` (el perfil admin ve todo, que es lo que queremos mostrar).
- [ ] Cerrar pestañas ajenas, ocultar la barra de marcadores (Ctrl+Shift+B), zoom del navegador al 100 %.
- [ ] Tener listas las dos cotizaciones de demo (buscarlas antes en /cotizaciones):
  - **Boda Valentina & Andrés — Llanogrande** ($26.681.000, 120 invitados)
  - **Cóctel Corporativo Altavista — Lanzamiento Q3** ($7.502.000, 80 invitados)
- [ ] Decidir la aprobación en cámara: el guion aprueba **la boda** (es irreversible: se convierte en evento). Eso está bien — queda como material de demo en /eventos y /cocina. El cóctel se deja pendiente a propósito, como ejemplo de "propuesta en curso".

**Tono**: como se le explica a alguien del negocio, no a un desarrollador. Nada de "base de datos", "deploy", "rol en el sistema" — decir "quién puede ver qué", "queda guardado", "se actualiza solo".

---

## Escena 1 — La promesa (30 s) · en /panorama

Decir mientras se ve el panorama general:

> "Este video muestra qué hace la app de Selecta de punta a punta. La idea en una frase:
> todo lo que hoy vive en Excel, WhatsApp y llamadas — cotizaciones, eventos, cocina,
> inventario — pasa a vivir en un solo lugar, y cada área ve exactamente lo suyo.
> Al final te cuento qué necesitamos de ustedes para que esto quede andando con datos reales."

## Escena 2 — El tablero comercial (1 min) · /pipeline

- Mostrar las columnas y las tarjetas.
- Decir: el tablero se mueve **solo** — cuando una cotización cambia de estado, la tarjeta cambia de columna. Nadie mantiene este tablero a mano.
- Señalar el total de plata por columna ("cuánto hay en juego en cada etapa").

## Escena 3 — Armar una propuesta (2 min) · /cotizaciones

- Abrir la **Boda Valentina & Andrés**.
- Recorrer el resumen: los 4 platos del menú × 120 invitados, el personal (Wedding Day, capitán, meseros…), transporte, menaje. Señalar el **precio por invitado** que se calcula solo.
- Decir: esto se armó con el asistente paso a paso, eligiendo del **catálogo de 393 platos con los precios 2026** — el comercial no puede inventarse un precio.
- Mencionar (sin abrirlo entero) que una cotización puede tener **opciones A/B/C** para cuando el cliente pide alternativas.
- Clic en **Compartir** → mostrar el link público → abrirlo en una pestaña de incógnito: "esto es lo que ve su cliente, sin usuario ni contraseña, en el celular".
- Mostrar el botón de **PDF** y el documento con la identidad de Selecta.

## Escena 4 — El momento clave: aprobar (1.5 min) · en la misma cotización

- Decir: "el cliente dijo que sí". Clic en **Aprobar** la Opción A.
- Si se negocia un precio final distinto, aquí un administrador puede fijarlo — y queda
  registrado **quién lo cambió, cuándo y de cuánto a cuánto** (mostrar el Historial de cambios
  abajo: "cada movimiento de dinero deja huella, esto es lo que ordena las cuentas a fin de mes").
- Aprobar → la cotización se convierte en **evento** automáticamente.

## Escena 5 — El evento y sus áreas (1.5 min) · /eventos

- Abrir el evento recién creado.
- Pasar por los paneles sin profundizar: **Menaje** (se reserva del inventario, con calendario — no se puede prometer lo que no hay), **Personal** (se asignan empleados y el pago se calcula solo según su modalidad: por hora, jornada, nocturna), **Transporte**, **Cierre** (el balance final del evento).
- Mensaje: "operaciones no arranca de cero: hereda todo lo que se cotizó".

## Escena 6 — Cocina (1 min) · /cocina

- Mostrar el día/semana del evento aprobado.
- Señalar la **receta escalada a 120 porciones**: "el chef no multiplica en la cabeza; abre esto el día del evento".
- Cambiar entre vista por evento y consolidado.

## Escena 7 — Inventario con lectura de facturas (1 min) · /inventario

- Pestaña Movimientos → **Registrar ingreso**.
- Decir: "cuando llega mercadería, se le toma foto a la factura y la app la lee sola: saca los
  productos, los cruza con el catálogo y convierte bolsas y botellas a kilos y litros. Uno solo
  revisa y confirma." (Si no se quiere subir una factura en cámara, basta mostrar el diálogo
  de subida y contarlo.)
- Cerrar con **Cancelar** (no confirmar un ingreso de mentira).

## Escena 8 — Quién ve qué (45 s) · /usuarios

- Mostrar la tabla de usuarios y los 4 perfiles.
- Decir: "comercial ve ventas, operaciones ve eventos, cocina ve producción, y administración ve
  todo y es la única que toca precios y crea usuarios. No hay registro abierto: si alguien no
  tiene perfil, entra y ve una pantalla de acceso pendiente, nada más."

## Escena 9 — El cierre: qué necesitamos de ustedes (1 min) · sobre la guía HTML

- Abrir `GUIA_SEGUIMIENTO.html` en pantalla.
- Decir: "todo lo que viste calcula sobre el catálogo. Hoy faltan datos que solo Selecta tiene:
  los **costos reales de los insumos** (sin eso no hay margen real), el **catálogo real de menaje**,
  unas **decisiones cortas** que están listadas acá, y lo más importante: **cotizar el próximo
  evento real en la app**. Esta guía tiene la lista completa con el porqué de cada cosa — se puede
  ir marcando lo que se complete. Cualquier cosa rara que encuentren o idea que surja, me la
  mandan como dice la última sección: qué esperaban, qué pasó, en qué pantalla."

---

## Después de grabar

- [ ] Pegar el link del Loom en `GUIA_SEGUIMIENTO.html` (buscar `PEGAR_LINK_DEL_LOOM_AQUI`, quitar el `display:none` del recuadro) y reenviar el archivo.
- [ ] Verificar en /eventos que el evento de la boda quedó bien como material de demo.
- Nota: tras la aprobación en cámara quedará **1 evento demo** (boda) y **1 cotización pendiente** (cóctel) en prod — es el estado deseado, no limpiar.
