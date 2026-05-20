/* eslint-env node */
/**
 * Genera chunks SQL compactos: una staging table donde cada receta tiene un jsonb
 * con sus ingredientes, para reducir #calls al MCP.
 */
const fs = require("fs");
const path = require("path");

const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";
const recetas = JSON.parse(fs.readFileSync(path.join(CACHE, "recetas-extracted.json"), "utf8"));

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const esc = (s) => String(s).replace(/'/g, "''");

const rows = [];
recetas.forEach((r, idx) => {
  const ings = r.ingredientes
    .filter((i) => typeof i.medida === "number" && i.medida > 0 && i.ingrediente)
    .map((i) => ({ ingrediente: i.ingrediente, ingrediente_norm: norm(i.ingrediente), medida: i.medida }));
  if (ings.length === 0) return;
  const ingsJson = JSON.stringify(ings).replace(/'/g, "''");
  const porciones = r.porciones_raw ? "'" + esc(r.porciones_raw) + "'" : "NULL";
  rows.push(`(${idx}, '${esc(r.sheet)}', '${esc(r.nombre)}', '${esc(norm(r.nombre))}', ${porciones}, '${ingsJson}'::jsonb)`);
});

console.log(`Recetas con ingredientes válidos: ${rows.length}`);

const CHUNK = 200;
const files = [];
for (let i = 0; i < rows.length; i += CHUNK) {
  const slice = rows.slice(i, i + CHUNK);
  const sql = `INSERT INTO _staging_recetas (idx, sheet, nombre, nombre_norm, porciones, ingredientes) VALUES\n${slice.join(",\n")};`;
  const fname = path.join(CACHE, `rec-${String(files.length).padStart(2, "0")}.sql`);
  fs.writeFileSync(fname, sql, "utf8");
  files.push({ fname, size: fs.statSync(fname).size });
}
files.forEach((f) => console.log(`  ${f.fname} (${(f.size / 1024).toFixed(1)} KB)`));
