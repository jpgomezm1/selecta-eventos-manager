# Actualizar costos de insumos con Excel

Pantalla: **Recetario → Ingredientes → "Actualizar costos con Excel"**.

Sirve para cargar de una sola vez lo que cuesta cada insumo. Sin esto, el costo
de los platos y el margen de los eventos se calculan sobre $0 y no significan
nada.

## Formato del archivo

Una fila por combinación de insumo y proveedor:

| INGREDIENTE | PROVEEDOR | PRESENTACION | UNIDAD | PRECIO |
|---|---|---|---|---|
| Arroz | Cooperativa Colanta | 25 | kg | $ 120.000 |
| Aceite de girasol | Distrito Horeka | 20 | lt | $ 180.000 |
| Servilleta | Global Product Sourcing | 500 | und | $ 45.000 |

**PRESENTACION + UNIDAD + PRECIO es cómo se compra**, no cómo se cocina: un
bulto de 25 kg a $120.000. La app divide y obtiene el costo por unidad base del
ingrediente (en el ejemplo, $4.800/kg).

Los encabezados aceptan variantes: `INSUMO`/`NOMBRE`/`PRODUCTO` por
`INGREDIENTE`, `CANTIDAD` por `PRESENTACION`, `VALOR`/`COSTO` por `PRECIO`.

### Unidades aceptadas

| Escribe | Se entiende como |
|---|---|
| g, gr, grs, gramo(s) | gr |
| kg, kgs, kilo(s), kilogramo(s) | kg |
| lb, libra(s) | lb |
| oz, onza(s) | oz |
| ml, mililitro(s) | ml |
| l, lt, lts, litro(s) | lt |
| und, un, uni, unidad(es) | und |

La unidad del Excel debe ser **compatible** con la unidad base del ingrediente:
peso con peso, volumen con volumen, `und` solo con `und`. Si un ingrediente está
en `kg` y el archivo trae `lt`, esa fila se rechaza — no hay forma de convertir
litros a kilos sin saber la densidad.

## Qué hace y qué no hace

- **Actualiza** el costo de ingredientes que ya existen en el recetario.
- **Crea o actualiza** el proveedor de cada insumo y lo deja como principal, que
  es el que define el costo vigente.
- **No crea ingredientes nuevos.** Si el nombre no existe en el recetario, la
  fila se marca en rojo y se ignora. Esto es a propósito: evita que un typo
  ("Aceite Girasol" vs "Aceite de girasol") llene el catálogo de duplicados que
  después rompen el costeo de los platos.

## Cómo se usa

1. Descarga la plantilla desde el mismo diálogo — viene con ingredientes reales
   de tu catálogo, así no tienes que adivinar los nombres.
2. Llena las columnas y sube el archivo.
3. Revisa la vista previa: por cada fila válida se ve el costo anterior y el
   nuevo. Las filas con problemas muestran el motivo.
4. Aplica. La carga es **todo o nada**: si algo falla, no queda nada aplicado y
   se puede corregir el archivo sin quedar a medias.

## Errores frecuentes

| Mensaje | Qué pasó |
|---|---|
| `"X" no existe en el recetario` | El nombre no coincide con ningún ingrediente. Revisa contra la plantilla. |
| `No se puede convertir lt → kg` | La unidad del archivo no es compatible con la unidad base del ingrediente. |
| `Unidad no reconocida` | Usa una de la tabla de arriba. |
| `Fila repetida` | El mismo ingrediente y proveedor aparecen dos veces. Deja una sola. |
