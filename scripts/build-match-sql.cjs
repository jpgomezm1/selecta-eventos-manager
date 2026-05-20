/* eslint-env node */
/**
 * Genera el SQL que hace match entre PRECIOS COMPRAS y ingredientes_catalogo
 * pasando el archivo como JSON literal a Postgres.
 *
 * Output: prints SQL a stdout. Pegar en MCP execute_sql.
 */
const fs = require("fs");
const path = require("path");

const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";
const compras = JSON.parse(fs.readFileSync(path.join(CACHE, "precios-compras.json"), "utf8"));

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Por cada producto único: menor vlrUni > 0
const productos = compras.porNombreNorm.map(({ key, items }) => {
  const validos = items.filter((i) => i.vlrUni != null && i.vlrUni > 0);
  if (validos.length === 0) return null;
  validos.sort((a, b) => a.vlrUni - b.vlrUni);
  const mejor = validos[0];
  return {
    nombre_norm: key,
    nombre_archivo: mejor.producto,
    vlr_uni: mejor.vlrUni,
    proveedor: mejor.proveedor,
    n_proveedores: validos.length,
  };
}).filter(Boolean);

console.log("-- Generado " + productos.length + " productos únicos con vlrUni > 0");
console.log("-- ============================================================");
console.log("WITH archivo (nombre_norm, nombre_archivo, vlr_uni, proveedor, n_proveedores) AS (");
console.log("  VALUES");
const rows = productos.map((p) => {
  const esc = (s) => String(s).replace(/'/g, "''");
  return `    (${"'" + esc(p.nombre_norm) + "'"}, ${"'" + esc(p.nombre_archivo) + "'"}, ${p.vlr_uni}, ${"'" + esc(p.proveedor) + "'"}, ${p.n_proveedores})`;
});
console.log(rows.join(",\n"));
console.log("),");
console.log(`bd AS (
  SELECT id, nombre, unidad, costo_por_unidad, proveedor,
         regexp_replace(
           regexp_replace(
             lower(translate(nombre,
               'áéíóúñüÁÉÍÓÚÑÜàèìòùâêîôûäëïöüçÇ',
               'aeiounuAEIOUNUaeiouaeiouaeioucC')),
             '[^a-z0-9 ]', ' ', 'g'),
           '\\s+', ' ', 'g'
         ) AS nombre_norm
  FROM ingredientes_catalogo
)
SELECT
  CASE
    WHEN bd.id IS NULL THEN 'SOLO_ARCHIVO'
    WHEN archivo.nombre_norm IS NULL THEN 'SOLO_BD'
    WHEN ROUND(bd.costo_por_unidad::numeric, 2) = ROUND(archivo.vlr_uni::numeric, 2) THEN 'SIN_CAMBIO'
    ELSE 'CAMBIO'
  END AS estado,
  bd.id AS bd_id,
  bd.nombre AS bd_nombre,
  bd.unidad,
  bd.costo_por_unidad AS bd_costo,
  bd.proveedor AS bd_proveedor,
  archivo.nombre_archivo,
  archivo.vlr_uni AS archivo_costo,
  archivo.proveedor AS archivo_proveedor,
  archivo.n_proveedores
FROM archivo FULL OUTER JOIN bd
  ON trim(regexp_replace(archivo.nombre_norm, '\\s+', ' ', 'g'))
   = trim(bd.nombre_norm)
ORDER BY estado, COALESCE(bd.nombre, archivo.nombre_archivo);`);
