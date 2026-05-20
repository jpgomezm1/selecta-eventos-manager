/* eslint-env node */
/**
 * Parsea TARIFAS TRANSPORTE PARA JUAMPA.xlsx → JSON con (lugar, tipo_evento, tarifa).
 * Sheets:
 *   - DESDE BODEGA      → "Eventos Grandes"
 *   - DESDE SELECTA     → "Eventos Pequeños"
 *   - NOCHE FESTIVOS... → "Eventos Noche"
 *   - MOTO              → "Selecta To Go"
 *
 * El header está en row 1 (0-indexed). En sheets DESDE/NOCHE: col 0 = LUGAR, col 10 (__EMPTY_9) = TARIFA 2026.
 * En MOTO: col 0 = LUGAR, col 1 = TARIFA.
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const FILE = path.join(
  "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos",
  "TARIFAS TRANSPORTE PARA JUAMPA.xlsx",
);
const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";
if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });

const wb = XLSX.readFile(FILE);

const SHEET_TO_TIPO = {
  "DESDE BODEGA": "Eventos Grandes",
  "DESDE SELECTA": "Eventos Pequeños",
  "NOCHE FESTIVOS O DOMINICALES": "Eventos Noche",
  "MOTO": "Selecta To Go",
};

const out = [];

for (const [sheetName, tipoEvento] of Object.entries(SHEET_TO_TIPO)) {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`  Sheet faltante: "${sheetName}"`);
    continue;
  }
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  // Skip header row (row 0); data desde row 1
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const lugar = r[0];
    if (!lugar || typeof lugar !== "string") continue;
    const lugarNorm = lugar.trim();
    if (!lugarNorm) continue;

    let tarifa = null;
    if (sheetName === "MOTO") {
      tarifa = r[1];
    } else {
      // Última col TARIFAS ESTABLECIDAS 2026 = col 10 (índice array)
      tarifa = r[10] != null ? r[10] : r[9];
    }

    if (tarifa == null || typeof tarifa !== "number" || tarifa <= 0) continue;

    out.push({
      lugar: lugarNorm,
      tipo_evento: tipoEvento,
      tarifa: Math.round(tarifa),
      sheet: sheetName,
    });
  }
}

console.log(`Total filas extraídas: ${out.length}`);
const por_tipo = {};
for (const o of out) {
  por_tipo[o.tipo_evento] = (por_tipo[o.tipo_evento] || 0) + 1;
}
for (const [k, v] of Object.entries(por_tipo)) {
  console.log(`  ${k}: ${v}`);
}

const outPath = path.join(CACHE, "transporte-extracted.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(`\nOutput: ${outPath}`);

// Print SQL preview
console.log("\nMuestra SQL:");
for (const r of out.slice(0, 5)) {
  const lugar = r.lugar.replace(/'/g, "''");
  const tipo = r.tipo_evento.replace(/'/g, "''");
  console.log(`  ('${lugar}', ${r.tarifa}, '${tipo}'),`);
}
console.log(`  ... ${out.length} filas total`);
