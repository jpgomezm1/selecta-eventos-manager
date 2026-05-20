/* eslint-env node */
/**
 * Inspecciona PORTAFOLIO COMERCIAL precios 2026.xlsx en detalle.
 * Muestra estructura de cada sheet + primeras 30 filas en formato compacto.
 */
const XLSX = require("xlsx");
const path = require("path");

const FILE = path.join(
  "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos",
  "PORTAFOLIO COMERCIAL precios 2026.xlsx",
);

const wb = XLSX.readFile(FILE);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  console.log("\n========================================");
  console.log("SHEET:", sheetName);
  console.log("Range:", ws["!ref"]);
  console.log("Total filas:", rows.length);
  console.log("========================================");

  // Print first 50 non-empty rows compactly
  let printed = 0;
  for (let r = 0; r < rows.length && printed < 60; r++) {
    const row = rows[r] || [];
    const compact = {};
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v == null || v === "") continue;
      compact[c] = typeof v === "string" && v.length > 60 ? v.slice(0, 60) + "…" : v;
    }
    if (Object.keys(compact).length > 0) {
      console.log(`  [${r}] ${JSON.stringify(compact)}`);
      printed++;
    }
  }
}
