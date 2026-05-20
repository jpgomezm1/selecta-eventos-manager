/* eslint-env node */
const fs = require("fs");
const path = require("path");

const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";
const items = JSON.parse(fs.readFileSync(path.join(CACHE, "portafolio-2026.json"), "utf8"));

const esc = (s) => String(s).replace(/'/g, "''");
const CHUNK = 200;

for (let i = 0; i < items.length; i += CHUNK) {
  const slice = items.slice(i, i + CHUNK);
  const rows = slice.map((p) =>
    `('${esc(p.sheet)}', '${esc(p.nombre)}', '${esc(p.nombre_norm)}', ${p.precio})`
  );
  const sql = `INSERT INTO _staging_portafolio (sheet, nombre, nombre_norm, precio) VALUES\n${rows.join(",\n")};`;
  const fname = path.join(CACHE, `port-${String(Math.floor(i/CHUNK)).padStart(2, "0")}.sql`);
  fs.writeFileSync(fname, sql, "utf8");
  console.log(`${fname} (${slice.length} rows, ${(fs.statSync(fname).size/1024).toFixed(1)} KB)`);
}
