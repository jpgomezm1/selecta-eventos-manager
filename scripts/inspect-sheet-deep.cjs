/* eslint-env node */
/**
 * Inspecciona una sheet en profundidad: imprime todas las filas con headers
 * "MEDIDA" para entender estructura vertical.
 */
const XLSX = require("xlsx");
const path = require("path");

const FILE = path.join(
  "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos",
  "ESTANDARIZACIÓN COSTOS 2025 (1).xlsx",
);

const sheetName = process.argv[2] || "DESAYUNO";
const wb = XLSX.readFile(FILE);
const ws = wb.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });

console.log(`Sheet: ${sheetName}, total filas: ${rows.length}`);
console.log(`Range: ${ws["!ref"]}`);

// Find all rows with "MEDIDA" header
console.log("\nFilas con MEDIDA (potenciales headers de bloque):");
for (let r = 0; r < rows.length; r++) {
  const row = rows[r] || [];
  const medidaCols = [];
  for (let c = 0; c < row.length; c++) {
    if (typeof row[c] === "string" && row[c].trim().toUpperCase() === "MEDIDA") {
      medidaCols.push(c);
    }
  }
  if (medidaCols.length > 0) {
    console.log(`  Row ${r}: MEDIDA en cols [${medidaCols.join(", ")}]`);
  }
}

// Print first 20 rows
console.log("\nPrimeras 20 filas (compactas):");
for (let r = 0; r < Math.min(20, rows.length); r++) {
  const row = rows[r] || [];
  const compact = {};
  for (let c = 0; c < row.length; c++) {
    if (row[c] != null) compact[c] = typeof row[c] === "string" && row[c].length > 30 ? row[c].slice(0, 30) + "…" : row[c];
  }
  if (Object.keys(compact).length > 0) console.log(`  [${r}] ${JSON.stringify(compact)}`);
}
