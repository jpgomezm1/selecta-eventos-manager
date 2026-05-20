/* eslint-env node */
/**
 * Parsea sheets de recetas en ESTANDARIZACIÓN COSTOS 2025 (1).xlsx.
 *
 * Estructura: bloques horizontales de 4-5 cols por plato, REPETIDOS VERTICALMENTE.
 * Cada bloque tiene:
 *   row N-2: nombre del plato (en col del bloque)
 *   row N-1: porciones tipo "28 un", "1pax"
 *   row N:   header "MEDIDA / INGREDIENTES / CT UNITARIO / PRECIO"
 *   row N+1..K: ingredientes
 *   row K+1..: secciones MANO DE OBRA / CIF / SUBTOTAL (skip)
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

const RECIPE_SHEETS = [
  "BEBIDAS", "DESAYUNO", "SELECTA TO GO", "REFRIGERIOS", "PASABOCAS",
  "CHARCUTERIA Y SUSHI", "PARRILLA Y PICADAS", "ENTRADAS ", "TIPICOS E INTERNACIONAL",
  "SALSAS Y ADEREZOS", "PROTEINA", "ACOMPAÑAMIENTOS", "FRITOS", "PANADERIA",
  "HAMBURGUESAS", "TOPING", "PLATOS", "EMPLEADOS SELECTA",
];

const STOP_KEYWORDS = [
  "MANO DE OBRA", "MANO OBRA", "CIF", "SUBTOTAL", "TOTAL MDO", "TOTAL CIF",
  "TOTAL", "Servicios Publicos", "MARGEN", "PRECIO DE VENTA", "MARGEN DE GANANCIA",
  "DEPRECIACION", "INSUMOS", "DECORACION", "PLATO Y DECORACION", "PLATO Y DECO",
  "5MIN", "10MIN", "3MIN", "15MIN", "20MIN", "30MIN", "Directa", "Indirecta",
];

const isStopRow = (row, colStart) => {
  for (let c = colStart; c < colStart + 4; c++) {
    const v = row[c];
    if (typeof v !== "string") continue;
    const u = v.trim().toUpperCase();
    if (STOP_KEYWORDS.some((k) => u === k.toUpperCase() || u.startsWith(k.toUpperCase()))) return true;
  }
  return false;
};

const isHeaderText = (v) => {
  if (typeof v !== "string") return false;
  const u = v.trim().toUpperCase();
  return ["MEDIDA", "INGREDIENTES", "INGREDIENTE", "CT UNITARIO", "CT UNI", "PRECIO", "UND DE MEDIDA"].includes(u);
};

const wb = XLSX.readFile(FILE);
const allRecipes = [];

for (const sheetName of RECIPE_SHEETS) {
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`  Sheet faltante: "${sheetName}"`);
    continue;
  }

  const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true, header: 1 });
  if (rows.length < 3) continue;

  // Encontrar TODAS las filas con MEDIDA (header de bloque)
  const headerRows = []; // [{ row, cols: [c1, c2...] }]
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const medidaCols = [];
    for (let c = 0; c < row.length; c++) {
      if (typeof row[c] === "string" && row[c].trim().toUpperCase() === "MEDIDA") {
        medidaCols.push(c);
      }
    }
    if (medidaCols.length > 0) headerRows.push({ row: r, cols: medidaCols });
  }

  if (headerRows.length === 0) {
    console.warn(`  ${sheetName}: sin header MEDIDA`);
    continue;
  }

  for (let h = 0; h < headerRows.length; h++) {
    const { row: headerRowIdx, cols } = headerRows[h];
    const nextHeaderRowIdx = h + 1 < headerRows.length ? headerRows[h + 1].row : rows.length;

    for (let i = 0; i < cols.length; i++) {
      const colStart = cols[i];
      const colEnd = i + 1 < cols.length ? cols[i + 1] : (rows[headerRowIdx].length || 30);

      // Buscar nombre del plato en las filas headerRowIdx-2..headerRowIdx-1
      // El nombre puede estar en col anterior al MEDIDA (colStart-1) o en colStart
      let nombrePlato = null;
      for (let r = Math.max(0, headerRowIdx - 3); r < headerRowIdx; r++) {
        const row = rows[r] || [];
        for (let c = Math.max(0, colStart - 1); c < colEnd; c++) {
          const v = row[c];
          if (typeof v === "string") {
            const t = v.trim();
            if (t.length > 2 && !isHeaderText(t) && t.toUpperCase() !== "MP" && t.toUpperCase() !== "MATERIA PRIMA"
                && !/^\d+\s*(un|pax|porc|kilo|gra|min|gr|kg|ml)/i.test(t)
                && !STOP_KEYWORDS.some((k) => t.toUpperCase() === k.toUpperCase())) {
              nombrePlato = t;
              break;
            }
          }
        }
        if (nombrePlato) break;
      }
      if (!nombrePlato) continue;

      // Porciones: buscar string con número + (pax|un|porc|kilo) en filas headerRowIdx-2..headerRowIdx-1
      let porciones = null;
      for (let r = Math.max(0, headerRowIdx - 3); r < headerRowIdx; r++) {
        const row = rows[r] || [];
        for (let c = colStart; c < colEnd; c++) {
          const v = row[c];
          if (typeof v === "string" && /\d/.test(v) && /(pax|un|porc|kilo|gra|gr\b)/i.test(v)) {
            porciones = v.trim();
            break;
          }
        }
        if (porciones) break;
      }

      // Extraer ingredientes desde headerRowIdx+1 hasta el próximo bloque o stop row
      const ingredientes = [];
      for (let r = headerRowIdx + 1; r < nextHeaderRowIdx; r++) {
        const row = rows[r] || [];
        if (isStopRow(row, colStart)) break;

        const medida = row[colStart];
        const ingrediente = row[colStart + 1];
        const ctUnitario = row[colStart + 2];
        const precio = row[colStart + 3];

        if (medida == null && ingrediente == null && ctUnitario == null && precio == null) continue;
        if (typeof medida === "string" && isHeaderText(medida)) continue;
        if (typeof ingrediente !== "string" || !ingrediente.trim()) continue;
        const ingT = ingrediente.trim();
        if (STOP_KEYWORDS.some((k) => ingT.toUpperCase() === k.toUpperCase() || ingT.toUpperCase().startsWith(k.toUpperCase()))) continue;

        ingredientes.push({
          medida: typeof medida === "number" ? medida : (medida ? String(medida).trim() : null),
          ingrediente: ingT,
          ct_unitario: typeof ctUnitario === "number" ? ctUnitario : null,
          precio: typeof precio === "number" ? precio : null,
        });
      }

      if (ingredientes.length === 0) continue;

      allRecipes.push({
        sheet: sheetName.trim(),
        nombre: nombrePlato,
        porciones_raw: porciones,
        ingredientes,
      });
    }
  }
}

console.log(`Total recetas extraídas: ${allRecipes.length}`);
const porSheet = {};
for (const r of allRecipes) {
  porSheet[r.sheet] = (porSheet[r.sheet] || 0) + 1;
}
for (const [k, v] of Object.entries(porSheet).sort()) {
  console.log(`  ${k}: ${v}`);
}

const out = path.join(CACHE, "recetas-extracted.json");
fs.writeFileSync(out, JSON.stringify(allRecipes, null, 2), "utf8");
console.log(`\nOutput: ${out}`);

// Top 10 ingredientes más grandes y más chicos
const sizes = allRecipes.map((r) => r.ingredientes.length).sort((a, b) => a - b);
console.log(`\nTamaños de receta: min=${sizes[0]}, mediana=${sizes[Math.floor(sizes.length/2)]}, max=${sizes[sizes.length-1]}`);
