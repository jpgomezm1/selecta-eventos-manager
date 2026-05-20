/* eslint-env node */
/**
 * Parsea sheet "PRECIOS COMPRAS" del archivo ESTANDARIZACIÓN COSTOS 2025.
 * Detecta headers de proveedor (filas con solo PRODUCTO sin CANT/PRECIO/VLR UNI)
 * y agrupa productos por proveedor. Escribe JSON a Datos/.cache/.
 *
 * Output: { proveedores: [{ nombre, productos: [{ producto, cant, precio, vlrUni }] }],
 *           totalProductos, productosUnicos }
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const FILE = path.join(
  "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos",
  "ESTANDARIZACIÓN COSTOS 2025 (1).xlsx",
);
const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";

if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });

const wb = XLSX.readFile(FILE);
const ws = wb.Sheets["PRECIOS COMPRAS"];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });

const proveedores = [];
let proveedorActual = null;

for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || r.length === 0) continue;
  const producto = r[0];
  const cant = r[1];
  const precio = r[2];
  const vlrUni = r[3];

  if (!producto) continue;

  const tienenDatos = cant != null || precio != null || vlrUni != null;

  if (!tienenDatos) {
    proveedorActual = { nombre: String(producto).trim(), productos: [] };
    proveedores.push(proveedorActual);
    continue;
  }

  if (!proveedorActual) {
    proveedorActual = { nombre: "(sin proveedor)", productos: [] };
    proveedores.push(proveedorActual);
  }

  proveedorActual.productos.push({
    producto: String(producto).trim(),
    cant: cant != null ? Number(cant) : null,
    precio: precio != null ? Number(precio) : null,
    vlrUni: vlrUni != null ? Number(vlrUni) : null,
    rowIdx: i + 1,
  });
}

// Aplanar para análisis cruzado
const todos = [];
for (const p of proveedores) {
  for (const it of p.productos) {
    todos.push({ ...it, proveedor: p.nombre });
  }
}

// Agrupar por nombre normalizado
const norm = (s) =>
  s.toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const porNombre = new Map();
for (const it of todos) {
  const k = norm(it.producto);
  if (!porNombre.has(k)) porNombre.set(k, []);
  porNombre.get(k).push(it);
}

const out = {
  totalProductos: todos.length,
  productosUnicos: porNombre.size,
  proveedoresCount: proveedores.length,
  proveedores,
  todos,
  porNombreNorm: [...porNombre.entries()].map(([k, v]) => ({ key: k, items: v })),
};

const outPath = path.join(CACHE, "precios-compras.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");

console.log(`Productos: ${todos.length}`);
console.log(`Únicos por nombre: ${porNombre.size}`);
console.log(`Proveedores: ${proveedores.length}`);
console.log(`Output: ${outPath}`);
