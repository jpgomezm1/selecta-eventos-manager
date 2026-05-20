/* eslint-env node */
/**
 * Cruza productos de PRECIOS COMPRAS contra ingredientes_catalogo de BD.
 * Genera reporte de matches/no-matches y SQL de UPDATE.
 *
 * Inputs:
 *   - Datos/.cache/precios-compras.json (output de extract-precios-compras.cjs)
 *   - Datos/.cache/ingredientes-bd.json (dump del SELECT vía MCP)
 *
 * Output a stdout: reporte + SQL.
 */
const fs = require("fs");
const path = require("path");

const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";

const compras = JSON.parse(fs.readFileSync(path.join(CACHE, "precios-compras.json"), "utf8"));
const bd = JSON.parse(fs.readFileSync(path.join(CACHE, "ingredientes-bd.json"), "utf8"));

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Index BD por nombre normalizado
const bdByNorm = new Map();
for (const ing of bd) {
  const k = norm(ing.nombre);
  if (!bdByNorm.has(k)) bdByNorm.set(k, []);
  bdByNorm.get(k).push(ing);
}

// Por cada producto único del archivo, escoger menor vlrUni (más barato)
const productosArchivo = compras.porNombreNorm.map(({ key, items }) => {
  const validos = items.filter((i) => i.vlrUni != null && i.vlrUni > 0);
  if (validos.length === 0) return null;
  validos.sort((a, b) => a.vlrUni - b.vlrUni);
  const mejor = validos[0];
  return {
    key,
    nombre: mejor.producto,
    vlrUni: mejor.vlrUni,
    cant: mejor.cant,
    precio: mejor.precio,
    proveedor: mejor.proveedor,
    todosProveedores: items.map((i) => ({
      proveedor: i.proveedor,
      cant: i.cant,
      precio: i.precio,
      vlrUni: i.vlrUni,
    })),
  };
}).filter(Boolean);

// Match exacto por norm
const matches = [];
const sinMatchEnArchivo = []; // BD ingredients sin match en archivo
const soloEnArchivo = [];     // archivo productos sin match en BD

const archivoKeys = new Set(productosArchivo.map((p) => p.key));
const bdKeysMatched = new Set();

for (const p of productosArchivo) {
  const cand = bdByNorm.get(p.key);
  if (cand && cand.length > 0) {
    matches.push({ archivo: p, bd: cand[0], bdAmbig: cand.length > 1 ? cand : null });
    bdKeysMatched.add(p.key);
  } else {
    soloEnArchivo.push(p);
  }
}

for (const ing of bd) {
  if (!bdKeysMatched.has(norm(ing.nombre))) {
    sinMatchEnArchivo.push(ing);
  }
}

// Cambios reales: matches donde costo_por_unidad cambia
const cambios = [];
const sinCambio = [];
for (const m of matches) {
  const actual = Number(m.bd.costo_por_unidad || 0);
  const nuevo = Number(m.archivo.vlrUni);
  // Round 2 decimales para evitar diffs por floating
  const round = (n) => Math.round(n * 100) / 100;
  if (round(actual) === round(nuevo)) {
    sinCambio.push(m);
  } else {
    cambios.push({ ...m, actual, nuevo, delta: nuevo - actual });
  }
}

// Reporte
console.log("=".repeat(80));
console.log("MATCH PRECIOS_COMPRAS ↔ ingredientes_catalogo");
console.log("=".repeat(80));
console.log(`Archivo: ${productosArchivo.length} productos únicos con vlrUni>0`);
console.log(`BD: ${bd.length} ingredientes`);
console.log(`Matches: ${matches.length}  |  Solo en archivo: ${soloEnArchivo.length}  |  Solo en BD: ${sinMatchEnArchivo.length}`);
console.log(`  → Cambios de costo: ${cambios.length}  |  Sin cambio: ${sinCambio.length}`);
console.log();

console.log("─── CAMBIOS DE COSTO_POR_UNIDAD ─────────────────────────────────────");
console.log("nombre BD                                  | unidad | actual    → nuevo     | proveedor archivo");
console.log("-".repeat(120));
for (const c of cambios.sort((a, b) => a.bd.nombre.localeCompare(b.bd.nombre))) {
  const nm = c.bd.nombre.padEnd(42).slice(0, 42);
  const un = (c.bd.unidad || "?").padEnd(6);
  const pa = c.actual.toFixed(2).padStart(9);
  const pn = c.nuevo.toFixed(2).padStart(9);
  console.log(`${nm} | ${un} | ${pa} → ${pn}  | ${c.archivo.proveedor}`);
}
console.log();

if (sinMatchEnArchivo.length > 0) {
  console.log("─── BD SIN MATCH EN ARCHIVO (mantienen costo actual) ────────────────");
  for (const ing of sinMatchEnArchivo.sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    console.log(`  ${ing.nombre.padEnd(42).slice(0, 42)} | ${(ing.unidad || "?").padEnd(6)} | costo=${ing.costo_por_unidad}`);
  }
  console.log();
}

console.log("─── SOLO EN ARCHIVO (candidatos a INSERT, requiere unidad) ─────────");
console.log(`Total: ${soloEnArchivo.length}`);
for (const p of soloEnArchivo.sort((a, b) => a.nombre.localeCompare(b.nombre)).slice(0, 30)) {
  const nm = p.nombre.padEnd(50).slice(0, 50);
  const v = String(p.vlrUni.toFixed(2)).padStart(9);
  console.log(`  ${nm} | vlrUni=${v} | cant=${p.cant} | ${p.proveedor}`);
}
if (soloEnArchivo.length > 30) console.log(`  ... y ${soloEnArchivo.length - 30} más (ver JSON cache)`);
console.log();

// SQL UPDATE
console.log("─── SQL UPDATE (transaccional) ──────────────────────────────────────");
console.log("BEGIN;");
console.log();
for (const c of cambios.sort((a, b) => a.bd.nombre.localeCompare(b.bd.nombre))) {
  // proveedor preserve si BD ya tiene uno; solo update costo_por_unidad
  console.log(
    `UPDATE ingredientes_catalogo SET costo_por_unidad = ${c.nuevo} WHERE id = '${c.bd.id}'; -- ${c.bd.nombre} (${c.actual}→${c.nuevo}, archivo: ${c.archivo.proveedor})`
  );
}
console.log();
console.log("-- Verificar y luego: COMMIT;  ó  ROLLBACK;");

// Persist split outputs
fs.writeFileSync(
  path.join(CACHE, "match-ingredientes.json"),
  JSON.stringify({ cambios, sinCambio, sinMatchEnArchivo, soloEnArchivo }, null, 2),
  "utf8",
);
console.log("\nDetalle JSON: " + path.join(CACHE, "match-ingredientes.json"));
