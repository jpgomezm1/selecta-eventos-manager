/* eslint-env node */
/**
 * Extrae (nombre, precio) del PORTAFOLIO COMERCIAL precios 2026.xlsx
 * Sheets: PORTAFOLIO 2026 (col 0 = descripción, col 1 = precio neto)
 *         Arma tu plato (col 0 = nombre, col 3 = precio)
 *
 * Heurística: el "nombre" del plato es el primer trozo antes de ":" o "(" si los hay.
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const FILE = path.join(
  "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos",
  "PORTAFOLIO COMERCIAL precios 2026.xlsx",
);
const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";
if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });

const wb = XLSX.readFile(FILE);

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Extrae el "nombre corto" del plato (primer trozo antes de descripción/paréntesis)
const extractNombre = (descripcion) => {
  let s = String(descripcion).trim();
  // Quitar prefijos como "BEBIDAS PARA EL SERVICIO: ", "ESTACIÓN DE CAFÉ: "
  // Si tiene ":", tomar el lado derecho como nombre
  if (s.includes(":")) {
    // PERO si el lado izquierdo es muy descriptivo y tiene mayúsculas todo, mejor lado izquierdo
    const left = s.split(":")[0].trim();
    const right = s.split(":")[1].trim();
    // Si left es ALL CAPS (categoría), usar right
    if (left === left.toUpperCase() && left.length < 60) {
      s = right;
    } else {
      s = left;
    }
  }
  // Quitar todo después de "(" si lo hay
  if (s.includes("(")) {
    s = s.split("(")[0].trim();
  }
  // Limpiar comas excesivas
  if (s.length > 80) {
    s = s.split(",")[0].trim();
  }
  return s;
};

const items = [];

// SHEET 1: PORTAFOLIO 2026
const ws1 = wb.Sheets["PORTAFOLIO 2026"];
const rows1 = XLSX.utils.sheet_to_json(ws1, { defval: null, raw: true, header: 1 });
for (let r = 0; r < rows1.length; r++) {
  const row = rows1[r] || [];
  const desc = row[0];
  const precio = row[1];
  if (typeof desc !== "string" || typeof precio !== "number" || precio <= 0) continue;
  if (desc.length < 5) continue;
  const nombre = extractNombre(desc);
  items.push({ sheet: "PORTAFOLIO 2026", row: r, descripcion: desc, nombre, nombre_norm: norm(nombre), precio });
}

// SHEET 2: Arma tu plato
const ws2 = wb.Sheets["Arma tu plato"];
const rows2 = XLSX.utils.sheet_to_json(ws2, { defval: null, raw: true, header: 1 });
for (let r = 0; r < rows2.length; r++) {
  const row = rows2[r] || [];
  const desc = row[0];
  const precio = row[3];
  if (typeof desc !== "string" || typeof precio !== "number" || precio <= 0) continue;
  if (desc.length < 5) continue;
  const nombre = extractNombre(desc);
  items.push({ sheet: "Arma tu plato", row: r, descripcion: desc, nombre, nombre_norm: norm(nombre), precio });
}

console.log(`Total items extraídos: ${items.length}`);
console.log(`  PORTAFOLIO 2026: ${items.filter(i => i.sheet === 'PORTAFOLIO 2026').length}`);
console.log(`  Arma tu plato: ${items.filter(i => i.sheet === 'Arma tu plato').length}`);

const out = path.join(CACHE, "portafolio-2026.json");
fs.writeFileSync(out, JSON.stringify(items, null, 2), "utf8");
console.log(`Output: ${out}`);

// Muestra
console.log("\nMuestra (primeros 15):");
items.slice(0, 15).forEach(i => console.log(`  $${i.precio} | "${i.nombre}" | norm: "${i.nombre_norm}"`));
