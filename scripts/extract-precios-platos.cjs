/* eslint-env node */
/**
 * Lee los archivos de Datos/ y extrae lista plana de platos con precio.
 * Fuente primaria: PLATOS_CATALOGO-ESTANDARIZACION (formato tabular limpio).
 * Fuente cruzada: PORTAFOLIO COMERCIAL (texto plano).
 *
 * Output JSON a stdout: { platos: [{codigo, nombre, precio, categoria, tipo_menu, source}] }
 *
 * No hace match contra BD ni genera SQL — solo extrae.
 */
const XLSX = require("xlsx");
const path = require("path");

const DATOS = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos";

const PLATOS_FILE = path.join(DATOS, "PLATOS_CATALOGO-ESTANDARIZACION SELECTA EVENTOS.xlsx");

const wb = XLSX.readFile(PLATOS_FILE);
const platos = [];
const skipped = [];

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

  for (const r of rows) {
    // Soporte tanto " PRECIO " (con espacios) como "PRECIO"
    const precioKey = Object.keys(r).find((k) => k.trim().toUpperCase() === "PRECIO");
    const codigo = r["CODIGO"] ?? null;
    const nombre = r["NOMBRE"] ?? null;
    const precio = precioKey ? r[precioKey] : null;
    const categoria = r["CATEGORIA"] ?? null;
    const tipoMenu = r["TIPO MENU"] ?? null;

    // Filtros: si no hay nombre o precio, skip.
    if (!nombre || !precio) {
      if (nombre || precio) skipped.push({ sheet: sheetName, row: r });
      continue;
    }

    platos.push({
      codigo: codigo ? String(codigo).trim() : null,
      nombre: String(nombre).trim(),
      precio: Number(precio),
      categoria: categoria ? String(categoria).trim() : null,
      tipo_menu: tipoMenu ? String(tipoMenu).trim() : null,
      sheet: sheetName,
    });
  }
}

// Detectar duplicados por nombre normalizado y por codigo
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const byNombre = new Map();
const byCodigo = new Map();
for (const p of platos) {
  const k = norm(p.nombre);
  if (!byNombre.has(k)) byNombre.set(k, []);
  byNombre.get(k).push(p);
  if (p.codigo) {
    if (!byCodigo.has(p.codigo)) byCodigo.set(p.codigo, []);
    byCodigo.get(p.codigo).push(p);
  }
}

const dupesNombre = [...byNombre.entries()].filter(([, arr]) => arr.length > 1);
const dupesCodigo = [...byCodigo.entries()].filter(([, arr]) => arr.length > 1);

console.log(JSON.stringify({
  total: platos.length,
  skipped: skipped.length,
  dupesNombreCount: dupesNombre.length,
  dupesCodigoCount: dupesCodigo.length,
  bySheet: platos.reduce((acc, p) => { acc[p.sheet] = (acc[p.sheet] ?? 0) + 1; return acc; }, {}),
  byCategoria: platos.reduce((acc, p) => { acc[p.categoria ?? "(null)"] = (acc[p.categoria ?? "(null)"] ?? 0) + 1; return acc; }, {}),
  byTipoMenu: platos.reduce((acc, p) => { acc[p.tipo_menu ?? "(null)"] = (acc[p.tipo_menu ?? "(null)"] ?? 0) + 1; return acc; }, {}),
  rangePrecio: { min: Math.min(...platos.map((p) => p.precio)), max: Math.max(...platos.map((p) => p.precio)) },
  sample: platos.slice(0, 5),
  dupesNombre: dupesNombre.map(([k, arr]) => ({ key: k, items: arr })),
  dupesCodigo: dupesCodigo.map(([k, arr]) => ({ key: k, items: arr })),
  skippedSample: skipped.slice(0, 5),
  all: platos,
}, null, 2));
