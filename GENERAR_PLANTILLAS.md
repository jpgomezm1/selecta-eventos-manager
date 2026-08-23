# La carga de datos del cliente (`/carga`)

Hay dos caminos para lo mismo, y el primero es el bueno:

| Ruta | Qué es | Cuándo |
|---|---|---|
| **`/carga/:token`** | Editor web: el cliente escribe en la pantalla y se guarda al momento | Es el que hay que mandar |
| `/carga` | Las cinco plantillas .xlsx para descargar | Fallback, para quien prefiera Excel |

## El editor web

Se abre sin sesión, igual que `/compartido/:token`. Lo que autoriza a escribir
es el token de la URL, que validan por dentro las funciones
`fn_carga_publica_*` (SECURITY DEFINER, migración
`supabase/migrations/20260823000000_carga_publica.sql`). La página nunca toca
las tablas: si hace falta un dato nuevo, se agrega al jsonb que arma
`fn_carga_publica_datos` — no un query nuevo en el front.

Cubre costos, recetas y menaje. Clientes y personal quedan fuera a propósito:
los datos de clientes son personales y no van detrás de un link sin login, y
personal ya tiene su importador dentro de la app.

**Para sacar el link:**

```sql
select token from public.carga_tokens where is_active;
-- https://selecta-eventos.netlify.app/carga/<token>
```

**Para revocarlo** (se vence el acceso sin tocar código ni deploy):

```sql
update public.carga_tokens set is_active = false where token = '...';
```

**Para saber si entraron:** `carga_tokens.ultima_actividad` se actualiza en cada
llamada. Es la forma barata de contestar "¿lo están usando?" sin preguntar.

Después de aplicar la migración, correr la prueba end-to-end —usa la anon key,
o sea que prueba exactamente lo que puede hacer el navegador, y revierte todo lo
que escribe:

```sh
python scripts-plantillas/probar_carga_publica.py
```

### Platos que no llevan insumos

`platos_catalogo.sin_insumos`. Hasta que existió esta columna, "no tiene receta"
y "no lleva insumos" eran el mismo estado (cero filas en `plato_ingredientes`),
así que una botella de agua iba a figurar como pendiente para siempre. Son 51 de
los 209 platos sin receta: vinos, gaseosas, cócteles e "IMPLEMENTOS PARA EL
SERVICIO". El editor deja marcar una categoría entera de un golpe.

La marca se cae sola si después se le carga una receta al plato, y no se puede
poner sobre un plato que ya tiene una — eso lo refuerza el SQL, no solo la UI.

---

# Las plantillas de Excel (`/carga`)

La página pública `/carga` sirve cinco Excel desde `public/plantillas/`. **No se
generan en el navegador**: la página es anónima y las tablas de catálogo exigen
rol, así que un fetch desde ahí devolvería vacío. Son archivos estáticos que se
regeneran a mano cuando el catálogo cambia lo suficiente como para que valga la
pena.

## Qué contiene cada archivo

Las tres primeras son las que hacen que los números de la app dejen de ser
inventados. Las dos últimas no bloquean nada.

| # | Archivo | Quién la llena | Cómo vuelve a la base |
|---|---|---|---|
| 1 | Costos de insumos | compras | **El cliente solo**: Recetario → Ingredientes → "Actualizar costos con Excel" |
| 2 | Recetas | cocina | `cargar_devuelto.py recetas` |
| 3 | Menaje | bodega | `cargar_devuelto.py menaje` |
| 4 | Clientes | quien tenga la base | `cargar_devuelto.py clientes` |
| 5 | Personal | RRHH | **El cliente solo**: Personal → "Carga masiva" |

**Costos de insumos** — todos los insumos con nombre y unidad base pre-llenos.
Los que no tienen costo van primero y resaltados. Columnas a llenar: proveedor,
presentación, unidad, precio.

Los encabezados están alineados con lo que espera el importador
(`src/lib/mapeoExcelCostos.ts`). Ojo al tocarlos: la hoja tiene una columna
`UNIDAD BASE` (informativa) y otra `UNIDAD` (la de compra). El importador
resuelve la ambigüedad porque `UNIDAD BASE` no está en su lista de alias — si se
renombra alguna de las dos, revisar `leerColumna`.

**Recetas** — los platos sin receta, uno por fila, con listas desplegables de
plato e insumo apuntando a una hoja oculta. Trae además una hoja `Ejemplos` con
las recetas ya cargadas, como referencia de formato.

**Menaje** — la única que empieza en blanco: lo que hay hoy en `menaje_catalogo`
son 9 filas de demo que pusimos nosotros, no datos del cliente. Van en una hoja
`Ejemplo del sistema` para que se vea el formato, y no se pre-llenan en la hoja
de trabajo para que nadie las confunda con inventario real.

**Clientes** — dos hojas, porque la app modela dos cosas distintas: una empresa
tiene NIT y además personas de contacto (`cliente_contactos`); una persona
natural tiene cédula y nada más.

**Personal** — los encabezados **no se tocan**: los lee el importador que ya está
en producción (`src/lib/mapeoExcelPersonal.ts`). `ROL` y `PRESTA SERVICIOS POR`
solo aceptan las etiquetas que ese archivo sabe traducir, y por eso son listas
cerradas. Al 2026-08-23 el roster ya está cargado (67 personas), así que esta
plantilla sirve para altas, no para la carga inicial.

## Cuándo regenerarlas

- Cuando el cliente devuelva una tanda cargada (para que la siguiente plantilla
  no vuelva a pedir lo que ya mandó).
- Cuando entren insumos o platos nuevos al catálogo.

Si no se regeneran, la plantilla sigue sirviendo: pide de más, no de menos. Lo
que queda desactualizado son los contadores de la página (`DATOS` en
`src/pages/CargaDatos.tsx`), que hay que ajustar a mano en el mismo commit.

## Cómo se regeneran

Los scripts viven fuera del repo, en la carpeta de trabajo del CTO
(`Board irrelevant/CTO/proyectos/selecta-eventos/scripts-plantillas/`). Necesitan
Python con `openpyxl` y `requests`.

```sh
python fetch_catalogo.py      # baja el catálogo de Supabase → catalogo_selecta.json
python generar_templates.py   # arma los cinco .xlsx en templates/
```

`supa.py` lee la service role key del `.env` del bot de Telegram
(`personal_rotativo/.env`), porque necesita saltarse RLS. Pagina de a 1000 filas:
`plato_ingredientes` pasa de ese tope y sin paginar se corta en silencio.

Después:

```sh
cp "templates/Selecta - 1 Costos de insumos.xlsx" public/plantillas/selecta-costos-insumos.xlsx
cp "templates/Selecta - 2 Recetas.xlsx"           public/plantillas/selecta-recetas.xlsx
cp "templates/Selecta - 3 Menaje.xlsx"            public/plantillas/selecta-menaje.xlsx
cp "templates/Selecta - 4 Clientes.xlsx"          public/plantillas/selecta-clientes.xlsx
cp "templates/Selecta - 5 Personal.xlsx"          public/plantillas/selecta-personal.xlsx
```

Y actualizar `DATOS` en `src/pages/CargaDatos.tsx` con las cifras que imprime
`generar_templates.py`.

## Cómo se cargan de vuelta

Costos y personal los sube el cliente desde la app. Las otras tres las cargamos
nosotros con `cargar_devuelto.py`, que **por defecto no escribe nada**:

```sh
python cargar_devuelto.py menaje "Selecta - 3 Menaje.xlsx"             # simulacro
python cargar_devuelto.py menaje "Selecta - 3 Menaje.xlsx" --aplicar   # escribe
```

El simulacro imprime fila por fila qué cargaría y qué rechaza (nombres que no
existen en el catálogo, cantidades inválidas, duplicados). Revisar ese reporte
antes de aplicar: la plantilla la llena gente a mano y siempre vuelve con algo
raro.

Dos cosas que el cargador hace a propósito y conviene tener presentes:

- **Recetas reemplaza, no suma.** Si un plato aparece en el Excel, sus líneas
  reemplazan por completo la receta que tuviera. Va por
  `fn_upsert_plato_ingredientes_atomic`, así que si el insert falla el plato
  conserva la receta vieja. El simulacro avisa cuáles va a reemplazar.
- **Menaje no borra nada.** Los artículos que están en el sistema y no vienen en
  el Excel se reportan pero se quedan: pueden estar amarrados a una reserva o a
  una cotización vieja. Borrarlos es decisión del cliente, desde la app.
