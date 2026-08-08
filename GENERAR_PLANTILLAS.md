# Regenerar las plantillas de carga (`/carga`)

La página pública `/carga` sirve dos Excel desde `public/plantillas/`. **No se
generan en el navegador**: la página es anónima y las tablas de catálogo exigen
rol, así que un fetch desde ahí devolvería vacío. Son archivos estáticos que se
regeneran a mano cuando el catálogo cambia lo suficiente como para que valga la
pena.

## Cuándo regenerarlas

- Cuando el cliente devuelva una tanda cargada (para que la siguiente plantilla
  no vuelva a pedir lo que ya mandó).
- Cuando entren insumos o platos nuevos al catálogo.

Si no se regeneran, la plantilla sigue sirviendo: pide de más, no de menos. Lo
que queda desactualizado son los contadores de la página (`DATOS` en
`src/pages/CargaDatos.tsx`), que hay que ajustar a mano en el mismo commit.

## Cómo

Los scripts viven fuera del repo, en la carpeta de trabajo del CTO
(`Board irrelevant/CTO/proyectos/selecta-eventos/scripts-plantillas/`). Necesitan
Python con `openpyxl` y `requests`.

```sh
python fetch_catalogo.py      # baja el catálogo de Supabase → catalogo_selecta.json
python generar_templates.py   # arma los dos .xlsx en templates/
```

`fetch_catalogo.py` lee la service role key del `.env` del bot de Telegram
(`personal_rotativo/.env`), porque necesita saltarse RLS. Pagina de a 1000 filas:
`plato_ingredientes` pasa de ese tope y sin paginar se corta en silencio.

Después:

```sh
cp "templates/Selecta - 1 Costos de insumos.xlsx" public/plantillas/selecta-costos-insumos.xlsx
cp "templates/Selecta - 2 Recetas.xlsx"           public/plantillas/selecta-recetas.xlsx
```

Y actualizar `DATOS` en `src/pages/CargaDatos.tsx` con las cifras que imprime
`generar_templates.py`.

## Qué contiene cada archivo

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

> Pendiente: el importador de la hoja de recetas todavía no existe. El de costos
> sí, y está en Recetario → Ingredientes → "Actualizar costos con Excel".
