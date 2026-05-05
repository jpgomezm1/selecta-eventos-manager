/* eslint-env node */
/**
 * Inspecciona los xlsx en Selecta/Datos/ y reporta sheets, columnas, primeras filas.
 * No toca DB. Solo lee.
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const DATOS_DIR = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos";

const files = fs.readdirSync(DATOS_DIR).filter((f) => f.endsWith(".xlsx"));

for (const fname of files) {
  const fpath = path.join(DATOS_DIR, fname);
  console.log("\n========================================");
  console.log("FILE:", fname);
  console.log("SIZE:", (fs.statSync(fpath).size / 1024).toFixed(1), "KB");
  console.log("========================================");

  const wb = XLSX.readFile(fpath);
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
    const header = rows[0] ? Object.keys(rows[0]) : [];

    console.log(`\n  SHEET: "${sheetName}"`);
    console.log(`    rango: ${ws["!ref"]} | filas (sin header): ${rows.length}`);
    console.log(`    columnas (${header.length}):`);
    for (const h of header) console.log(`      - ${h}`);

    console.log(`    primeras 3 filas:`);
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      const r = rows[i];
      const compact = {};
      for (const k of header) {
        const v = r[k];
        if (v === null || v === undefined) continue;
        compact[k] = typeof v === "string" && v.length > 50 ? v.slice(0, 50) + "…" : v;
      }
      console.log(`      [${i}]`, JSON.stringify(compact));
    }
  }
}
