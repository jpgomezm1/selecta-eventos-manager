/* eslint-env node */
/**
 * Genera múltiples archivos SQL con chunks de INSERTs para staging table.
 * Outputs: /tmp/chunk-NN.sql
 */
const fs = require("fs");
const path = require("path");

const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";
const compras = JSON.parse(fs.readFileSync(path.join(CACHE, "precios-compras.json"), "utf8"));

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

const esc = (s) => String(s).replace(/'/g, "''");
const CHUNK = 200;

let idx = 0;
const files = [];
for (let i = 0; i < productos.length; i += CHUNK) {
  const slice = productos.slice(i, i + CHUNK);
  const rows = slice.map((p) =>
    `('${esc(p.nombre_norm)}', '${esc(p.nombre_archivo)}', ${p.vlr_uni}, '${esc(p.proveedor)}', ${p.n_proveedores})`
  );
  const sql = `INSERT INTO _staging_precios_compras (nombre_norm, nombre_archivo, vlr_uni, proveedor, n_proveedores) VALUES\n${rows.join(",\n")};`;
  const fname = path.join(CACHE, `chunk-${String(idx).padStart(2, "0")}.sql`);
  fs.writeFileSync(fname, sql, "utf8");
  files.push(fname);
  idx++;
}

console.log(`Generados ${files.length} chunks (${productos.length} productos):`);
for (const f of files) {
  const size = fs.statSync(f).size;
  console.log(`  ${f} (${(size / 1024).toFixed(1)} KB)`);
}
