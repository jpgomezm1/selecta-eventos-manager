/* eslint-env node */
/**
 * Inspecciona el sheet PRECIOS COMPRAS más a fondo: detecta headers de proveedor
 * y agrupa productos por proveedor.
 */
const XLSX = require("xlsx");
const path = require("path");

const FILE = path.join(
  "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos",
  "ESTANDARIZACIÓN COSTOS 2025 (1).xlsx",
);

const wb = XLSX.readFile(FILE);
const ws = wb.Sheets["PRECIOS COMPRAS"];
const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });

console.log("Total filas (incl. header):", rows.length);

// Header esperado: ["PRODUCTO","CANT","PRECIO","VLR UNI", null, ...]
console.log("Header row 0:", JSON.stringify(rows[0]));

const proveedores = new Map();
let proveedorActual = "(sin proveedor)";
let totalProductos = 0;
let productosSinDatos = 0;

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
    // header de proveedor
    proveedorActual = String(producto).trim();
    if (!proveedores.has(proveedorActual)) {
      proveedores.set(proveedorActual, []);
    }
    continue;
  }

  totalProductos++;
  if (!proveedores.has(proveedorActual)) {
    proveedores.set(proveedorActual, []);
  }
  proveedores.get(proveedorActual).push({
    producto: String(producto).trim(),
    cant,
    precio,
    vlrUni,
    rowIdx: i + 1, // 1-based para Excel
  });
}

console.log("\nProveedores detectados:", proveedores.size);
for (const [prov, items] of proveedores) {
  console.log(`  - ${prov}: ${items.length} productos`);
}

console.log("\nTotal productos con datos:", totalProductos);

// Productos únicos por nombre
const nombres = new Set();
const duplicados = new Map();
for (const items of proveedores.values()) {
  for (const it of items) {
    const key = it.producto.toUpperCase();
    if (nombres.has(key)) {
      duplicados.set(key, (duplicados.get(key) || 1) + 1);
    } else {
      nombres.add(key);
    }
  }
}
console.log("Nombres únicos:", nombres.size);
console.log("Productos duplicados (mismo nombre, distintos proveedores):", duplicados.size);
console.log("Top 10 más duplicados:");
[...duplicados.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([k, v]) => console.log(`  - ${k}: ${v}x`));
