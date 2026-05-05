/* eslint-env node */
/**
 * Cruza los 377 platos extraídos del archivo (PLATOS_CATALOGO-ESTANDARIZACION)
 * con los 49 platos de BD. Genera reporte y SQL de UPDATE para los matches.
 *
 * Inputs:
 *   - /tmp/precios-extracted.json (output de extract-precios-platos.cjs)
 *   - /tmp/platos-bd.json (49 platos de BD vía MCP, formato [{id, nombre, precio, categoria, tipo_menu}])
 *
 * Outputs (a stdout):
 *   - Reporte de matches/no-matches
 *   - SQL de UPDATE listo para ejecutar (solo para matches con precio nuevo distinto al actual)
 */
const fs = require("fs");

const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";
const extracted = JSON.parse(fs.readFileSync(`${CACHE}/precios-extracted.json`, "utf8"));
const bd = JSON.parse(fs.readFileSync(`${CACHE}/platos-bd.json`, "utf8"));

const norm = (s) =>
  s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Index del archivo por nombre normalizado
const archivoByNorm = new Map();
for (const p of extracted.all) {
  const k = norm(p.nombre);
  if (!archivoByNorm.has(k)) archivoByNorm.set(k, []);
  archivoByNorm.get(k).push(p);
}

// Match
const matches = [];
const sinMatch = [];
for (const dbp of bd) {
  const k = norm(dbp.nombre);
  const candidates = archivoByNorm.get(k) ?? [];
  if (candidates.length > 0) {
    matches.push({ db: dbp, archivo: candidates });
  } else {
    sinMatch.push(dbp);
  }
}

// En archivo pero no en BD (candidatos a INSERT)
const bdNorms = new Set(bd.map((p) => norm(p.nombre)));
const soloEnArchivo = extracted.all.filter((p) => !bdNorms.has(norm(p.nombre)));

// Reporte
console.log("=".repeat(80));
console.log("MATCH BD ↔ ARCHIVO (PLATOS_CATALOGO-ESTANDARIZACION)");
console.log("=".repeat(80));
console.log(`BD: ${bd.length} platos  |  Archivo: ${extracted.total} platos`);
console.log(`Matches: ${matches.length}  |  Sin match (BD): ${sinMatch.length}  |  Solo en archivo: ${soloEnArchivo.length}`);
console.log();

console.log("─── MATCHES (UPDATE candidatos) ─────────────────────────────────────");
const cambios = [];
const sinCambio = [];
const ambig = [];
for (const m of matches) {
  if (m.archivo.length > 1) {
    ambig.push(m);
    continue;
  }
  const a = m.archivo[0];
  const precioActual = Number(m.db.precio);
  const precioNuevo = Number(a.precio);
  if (precioActual === precioNuevo) {
    sinCambio.push({ db: m.db, archivo: a });
  } else {
    cambios.push({ db: m.db, archivo: a, delta: precioNuevo - precioActual });
  }
}
console.log(`  ${cambios.length} con cambio de precio`);
console.log(`  ${sinCambio.length} ya tienen el precio correcto`);
console.log(`  ${ambig.length} ambiguos (>1 candidato en archivo)`);
console.log();

console.log("─── CAMBIOS DETALLADOS ──────────────────────────────────────────────");
console.log("nombre BD                                        |  actual  → nuevo    | codigo  | categoria archivo");
console.log("-".repeat(120));
for (const c of cambios.sort((a, b) => a.db.nombre.localeCompare(b.db.nombre))) {
  const nm = c.db.nombre.padEnd(48).slice(0, 48);
  const pa = String(Number(c.db.precio)).padStart(8);
  const pn = String(c.archivo.precio).padStart(8);
  console.log(`${nm} | ${pa} → ${pn}  | ${(c.archivo.codigo ?? "-").padEnd(7)} | ${c.archivo.categoria}`);
}
console.log();

if (ambig.length > 0) {
  console.log("─── AMBIGUOS (revisar a mano) ───────────────────────────────────────");
  for (const m of ambig) {
    console.log(`  [BD] ${m.db.nombre} (${m.db.precio})`);
    for (const a of m.archivo) {
      console.log(`    [archivo] ${a.codigo} - ${a.nombre} ($${a.precio}) [${a.categoria} / ${a.sheet}]`);
    }
  }
  console.log();
}

console.log("─── BD SIN MATCH EN ARCHIVO ─────────────────────────────────────────");
for (const p of sinMatch.sort((a, b) => a.nombre.localeCompare(b.nombre))) {
  console.log(`  ${p.nombre.padEnd(48).slice(0, 48)} | ${String(Number(p.precio)).padStart(8)} | ${p.categoria}`);
}
console.log();

console.log("─── SOLO EN ARCHIVO (candidatos a INSERT — fase 2) ──────────────────");
console.log(`Total: ${soloEnArchivo.length}`);
const porCat = soloEnArchivo.reduce((acc, p) => {
  acc[p.categoria ?? "(null)"] = (acc[p.categoria ?? "(null)"] ?? 0) + 1;
  return acc;
}, {});
for (const [cat, n] of Object.entries(porCat).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(32)} ${n}`);
}
console.log();

console.log("─── SQL UPDATE (transaccional) ──────────────────────────────────────");
console.log("BEGIN;");
console.log();
for (const c of cambios.sort((a, b) => a.db.nombre.localeCompare(b.db.nombre))) {
  console.log(
    `UPDATE platos_catalogo SET precio = ${c.archivo.precio} WHERE id = '${c.db.id}'; -- ${c.db.nombre} (${c.archivo.codigo})`
  );
}
console.log();
console.log("-- Verificar y luego: COMMIT;  ó  ROLLBACK;");
