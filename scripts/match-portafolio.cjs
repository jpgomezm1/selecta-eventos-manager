/* eslint-env node */
/**
 * Inventario de mismatches: PORTAFOLIO COMERCIAL precios 2026.xlsx ↔ platos_catalogo
 * Genera reporte markdown en C:/Users/tomas/OneDrive/Irrelevant/Selecta/inventario-mismatch-portafolio-2026.md
 *
 * No toca la DB. Solo lee Excel + recibe los platos del sistema inline.
 */

const XLSX = require("xlsx");
const fs = require("fs");

const EXCEL_PATH = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/PORTAFOLIO COMERCIAL precios 2026.xlsx";
const REPORT_PATH = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/inventario-mismatch-portafolio-2026.md";

// === Datos del sistema (snapshot 2026-04-30) ===
const platosSistema = [
  { nombre: "Aperol Spritz Clásico", precio: 22190, categoria: "Bebida" },
  { nombre: "Arancinis", precio: 0, categoria: "Entrada" },
  { nombre: "Arroz al Curri", precio: 0, categoria: "Guarnición" },
  { nombre: "Arroz al Wok", precio: 0, categoria: "Guarnición" },
  { nombre: "Arroz de Arándanos", precio: 0, categoria: "Guarnición" },
  { nombre: "Arroz de Coco", precio: 0, categoria: "Guarnición" },
  { nombre: "Arroz Frito", precio: 0, categoria: "Guarnición" },
  { nombre: "Arroz Simple", precio: 0, categoria: "Guarnición" },
  { nombre: "Bowl Toscano", precio: 0, categoria: "Fuerte" },
  { nombre: "Canastilla de Pasta Filo", precio: 0, categoria: "Pasaboca" },
  { nombre: "Consomé de Pollo", precio: 0, categoria: "Guarnición" },
  { nombre: "Coral", precio: 0, categoria: "Pasaboca" },
  { nombre: "Crema de Ahuyama", precio: 0, categoria: "Entrada" },
  { nombre: "Crema de Champiñón", precio: 0, categoria: "Entrada" },
  { nombre: "Crema de Maíz", precio: 0, categoria: "Entrada" },
  { nombre: "Crema de Tomate", precio: 0, categoria: "Entrada" },
  { nombre: "Crepes", precio: 0, categoria: "Guarnición" },
  { nombre: "Encocado de Plátano Maduro con Camarones", precio: 0, categoria: "Entrada" },
  { nombre: "Ensalada Caprese", precio: 0, categoria: "Entrada" },
  { nombre: "Ensalada César", precio: 0, categoria: "Entrada" },
  { nombre: "Ensalada de la Casa", precio: 0, categoria: "Entrada" },
  { nombre: "Ensalada Waldorf", precio: 0, categoria: "Entrada" },
  { nombre: "Frijoles", precio: 0, categoria: "Guarnición" },
  { nombre: "Hamburguesa Sweet Pesto", precio: 0, categoria: "Fuerte" },
  { nombre: "Lasaña de Pollo", precio: 0, categoria: "Fuerte" },
  { nombre: "Lasaña de Solomito", precio: 0, categoria: "Fuerte" },
  { nombre: "Lulada", precio: 0, categoria: "Bebida" },
  { nombre: "Medallones de Pollo con Ravioles", precio: 0, categoria: "Fuerte" },
  { nombre: "Mil Hojas de Papa", precio: 0, categoria: "Guarnición" },
  { nombre: "Mini Bao de Camarón Crispy", precio: 0, categoria: "Entrada" },
  { nombre: "Mini Bao de Pollo Crispy", precio: 0, categoria: "Entrada" },
  { nombre: "Mini Bowl Árabe", precio: 0, categoria: "Fuerte" },
  { nombre: "Mini Bowl Costeño", precio: 0, categoria: "Fuerte" },
  { nombre: "Mini Bowl Orzo con Maicitos", precio: 0, categoria: "Fuerte" },
  { nombre: "Orzo al Pesto", precio: 0, categoria: "Guarnición" },
  { nombre: "Panceta al Estilo Selecta", precio: 0, categoria: "Fuerte" },
  { nombre: "Pesca Blanca en Mantequilla Finas Hierbas", precio: 0, categoria: "Fuerte" },
  { nombre: "Pesca Blanca Sobre Cama Encocada", precio: 0, categoria: "Fuerte" },
  { nombre: "Piña Colada", precio: 0, categoria: "Bebida" },
  { nombre: "Plátano Maduro Asado con Burrata", precio: 0, categoria: "Entrada" },
  { nombre: "Plato prueba", precio: 0, categoria: "Entrada" },
  { nombre: "Plato Prueba #2", precio: 0, categoria: "Entrada" },
  { nombre: "Risotto Cremoso de Champiñones con Parmesano", precio: 0, categoria: "Fuerte" },
  { nombre: "Risotto de Champiñones con Queso Parmesano", precio: 4669, categoria: "Fuerte" },
  { nombre: "Salmón al Grill", precio: 0, categoria: "Fuerte" },
  { nombre: "Sancocho Trifásico", precio: 0, categoria: "Fuerte" },
  { nombre: "Sangría", precio: 0, categoria: "Bebida" },
  { nombre: "Solomito de Cerdo Albardado", precio: 0, categoria: "Fuerte" },
  { nombre: "Solomito Rostizado con Gnocchi", precio: 0, categoria: "Fuerte" },
];

// === Normalización ===
const STOPWORDS = new Set([
  "de", "del", "con", "en", "la", "el", "los", "las", "y", "o", "a", "al", "por",
  "para", "un", "una", "unos", "unas", "su", "sus", "lo", "the", "of", "and",
  "tradicional", "clasico", "clasica", "tipo", "estilo", "casa", "selecta",
]);

function stripDiacritics(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Normaliza un nombre para match: lowercase, sin tildes, sin gramaje, sin puntuación. */
function normalize(s) {
  let r = stripDiacritics(String(s).toLowerCase());
  // Remover patrones tipo "x 150 gr", "x 1 unidad", "x 250 ml", "(300g)", "x180gr"
  r = r.replace(/\bx\s*\d+\s*(gr|g|ml|cc|uni|unidad|unidades)\b/gi, " ");
  r = r.replace(/\(\s*\d+\s*(gr|g|ml|cc|kg)\s*\)/gi, " ");
  r = r.replace(/\b\d+\s*(gr|g|ml|cc|uni|unidad|unidades|kg)\b/gi, " ");
  // Remover puntuación
  r = r.replace(/[^a-z0-9\s]/gi, " ");
  // Colapsar espacios
  r = r.replace(/\s+/g, " ").trim();
  return r;
}

function tokens(s) {
  return normalize(s).split(" ").filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function jaccard(aTokens, bTokens) {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return inter / union;
}

/** Overlap coefficient: |A ∩ B| / min(|A|, |B|).
 *  Tolerante cuando un nombre es mucho más largo que el otro
 *  (típico: Excel "Pollo Capresse con tocineta x 180gr" vs sistema "Pollo Capresse"). */
function overlap(aTokens, bTokens) {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.min(a.size, b.size);
}

// === Detección de encabezados en hoja 1 ===

/** Heurística: una fila es encabezado si:
 *  - col B === "2026" (encabezado de categoría) → siempre skip
 *  - col A está en ALL CAPS y col B vacía → sub-encabezado → skip
 *  - col B vacía pero col A NO está en ALL CAPS → ítem sin precio cargado → reportar como "sin precio"
 */
function clasificarFila(rawA, rawB) {
  const a = String(rawA || "").trim();
  const b = String(rawB || "").trim();
  if (!a) return { tipo: "vacia" };

  const esEncabezadoCategoria = b === "2026";
  if (esEncabezadoCategoria) return { tipo: "categoria", nombre: a };

  // ALL CAPS: sin minúsculas (al menos una letra)
  const tieneLetras = /[a-záéíóúñ]/i.test(a);
  const tieneMinusculas = /[a-záéíóúñ]/.test(a);
  const esAllCaps = tieneLetras && !tieneMinusculas;

  const precio = parseFloat(b);
  const tienePrecio = !isNaN(precio) && precio > 0;

  if (esAllCaps && !tienePrecio) return { tipo: "subcategoria", nombre: a };
  if (!tienePrecio) return { tipo: "sin_precio", nombre: a };
  return { tipo: "item", nombre: a, precio };
}

// === Extracción de items del Excel ===

function extraerHoja1(wb) {
  const ws = wb.Sheets["PORTAFOLIO 2026"];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const items = [];
  const sinPrecio = [];
  const subcategorias = [];
  let categoria = null;

  rows.forEach((r, idx) => {
    // skip cabecera de condiciones (primeras 8 filas)
    if (idx < 8) return;
    const fila = idx + 1;
    const cls = clasificarFila(r[0], r[1]);
    if (cls.tipo === "categoria") {
      categoria = cls.nombre;
    } else if (cls.tipo === "subcategoria") {
      subcategorias.push({ fila, categoria, nombre: cls.nombre });
    } else if (cls.tipo === "item") {
      items.push({ fila, categoria, nombre: cls.nombre, precio: cls.precio });
    } else if (cls.tipo === "sin_precio") {
      sinPrecio.push({ fila, categoria, nombre: cls.nombre });
    }
  });
  return { items, sinPrecio, subcategorias };
}

function extraerHojaArmaTuPlato(wb) {
  const ws = wb.Sheets["Arma tu plato"];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const items = [];
  const sinPrecio = [];
  let categoria = null;

  rows.forEach((r, idx) => {
    const fila = idx + 1;
    const a = String(r[0] || "").trim();
    const d = String(r[3] || "").trim();
    if (!a) return;
    if (d === "2026") {
      categoria = a;
      return;
    }
    const precio = parseFloat(d);
    const tienePrecio = !isNaN(precio) && precio > 0;
    const tieneLetras = /[a-záéíóúñ]/i.test(a);
    const tieneMinusculas = /[a-záéíóúñ]/.test(a);
    const esAllCaps = tieneLetras && !tieneMinusculas;
    if (esAllCaps && !tienePrecio) return; // subcategoría
    if (tienePrecio) items.push({ fila, categoria, nombre: a, precio });
    else if (!esAllCaps) sinPrecio.push({ fila, categoria, nombre: a });
  });
  return { items, sinPrecio };
}

// === Match ===

/** Dice coefficient (F1 sobre tokens): 2|A∩B| / (|A|+|B|).
 *  Penaliza asimetría: 1 token vs 10 tokens overlapping nunca da 1.0. */
function dice(aTokens, bTokens) {
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  if (inter === 0) return 0;
  return (2 * inter) / (a.size + b.size);
}

/** Para un plato del sistema, encuentra su mejor candidato en el Excel.
 *
 *  Reglas (en orden):
 *  1. Match exacto normalizado → score 1.0.
 *  2. Si Dice ≥ 0.5 → match (corpus chico simétrico, ej. "Lulada" vs "Lulada con aguardiente").
 *  3. Containment fuerte: TODOS los tokens del sistema están en el Excel Y comparten ≥2 tokens
 *     → match (ej. "Sancocho Trifásico" vs "Sancocho Trifásico: Una sopa..." con muchos tokens más).
 *
 *  Esto descarta falsos positivos como "Ensalada de la Casa" (1 token útil "ensalada"
 *  porque "casa" es stopword) → no pasa la regla 3 (necesita ≥2 tokens compartidos)
 *  ni la 2 (Dice = 2/(1+N) muy bajo).
 */
function buscarMejorMatchSistema(plato, excelItems) {
  if (plato.tokens.length === 0) return null;
  const tSet = new Set(plato.tokens);
  const candidatos = []; // { ex, fuerte, dice, inter }

  for (const ex of excelItems) {
    if (ex.norm === plato.norm) {
      return { excel: ex, score: 1.0, tipo: "exacto", fuerte: true };
    }
    const exSet = new Set(ex.tokens);
    let inter = 0;
    for (const t of tSet) if (exSet.has(t)) inter++;
    if (inter === 0) continue;
    const d = (2 * inter) / (tSet.size + exSet.size);
    const containmentSistema = inter / tSet.size;
    const fuerte = containmentSistema === 1 && inter >= 2;
    candidatos.push({ ex, fuerte, dice: d, inter });
  }

  if (candidatos.length === 0) return null;

  // Ranking bidimensional: containment fuerte > no fuerte; dentro de cada grupo, Dice más alto.
  candidatos.sort((a, b) => {
    if (a.fuerte !== b.fuerte) return a.fuerte ? -1 : 1;
    return b.dice - a.dice;
  });
  const top = candidatos[0];

  // Match aceptado si: containment fuerte, OR Dice ≥ 0.55
  if (top.fuerte) {
    return {
      excel: top.ex,
      score: top.dice,
      tipo: `cont=${top.inter}/${tSet.size} dice=${top.dice.toFixed(2)}`,
      fuerte: true,
    };
  }
  if (top.dice >= 0.55) {
    return {
      excel: top.ex,
      score: top.dice,
      tipo: `dice=${top.dice.toFixed(2)}`,
      fuerte: false,
    };
  }
  return null;
}

// === Reporte ===

function fmtPrecio(n) {
  if (n == null || n === 0) return "—";
  return "$ " + Math.round(n).toLocaleString("es-CO");
}

/** Confianza del match — para el reporte. */
function confianzaRank(m) {
  if (m.tipo === "exacto") return 3;
  if (m.fuerte && m.score >= 0.5) return 3; // containment fuerte + Dice alto
  if (m.fuerte) return 2; // containment fuerte pero Dice bajo (descripción Excel muy larga)
  if (m.score >= 0.65) return 2; // Dice puro alto sin containment
  return 1; // Dice borderline (0.55-0.65)
}
function confianza(m) {
  const r = confianzaRank(m);
  return r === 3 ? "🟢" : r === 2 ? "🟡" : "🔴";
}

function main() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const hoja1 = extraerHoja1(wb);
  const hojaArma = extraerHojaArmaTuPlato(wb);

  const sistemaIdx = platosSistema.map((p) => ({
    ...p,
    norm: normalize(p.nombre),
    tokens: tokens(p.nombre),
  }));

  const excelItems = hoja1.items.map((ex) => ({
    ...ex,
    norm: normalize(ex.nombre),
    tokens: tokens(ex.nombre),
  }));

  // Match 1→1: para cada plato del sistema, encontrar su mejor candidato en Excel.
  // Cada item del Excel puede ser reclamado por solo un plato del sistema (greedy por score).
  const candidatos = []; // { sistema, excel, score, tipo, fuerte }
  for (const p of sistemaIdx) {
    const m = buscarMejorMatchSistema(p, excelItems);
    if (m) candidatos.push({ sistema: p, excel: m.excel, score: m.score, tipo: m.tipo, fuerte: m.fuerte });
  }
  // Resolver conflictos: si dos platos del sistema reclaman el mismo item del Excel,
  // se queda el de match más confiable: containment fuerte > Dice puro; luego score más alto.
  candidatos.sort((a, b) => {
    if (a.fuerte !== b.fuerte) return a.fuerte ? -1 : 1;
    return b.score - a.score;
  });
  const usadosExcel = new Set();
  const usadosSistema = new Set();
  const matches = [];
  for (const c of candidatos) {
    const exKey = c.excel.fila + ":" + c.excel.nombre;
    if (usadosExcel.has(exKey)) continue;
    if (usadosSistema.has(c.sistema.nombre)) continue;
    usadosExcel.add(exKey);
    usadosSistema.add(c.sistema.nombre);
    matches.push(c);
  }

  // Solo en Excel: items que NINGÚN plato del sistema reclamó como match
  const soloEnExcel = excelItems.filter((ex) => {
    const exKey = ex.fila + ":" + ex.nombre;
    return !usadosExcel.has(exKey);
  });

  // Solo en sistema: platos sin match
  const soloEnSistema = sistemaIdx.filter((p) => !usadosSistema.has(p.nombre));

  // Items con precio distinto (sistema con precio > 0 y diferente al Excel)
  const precioDistinto = matches.filter(
    (m) => m.sistema.precio > 0 && Math.abs(m.sistema.precio - m.excel.precio) > 1
  );

  // Items en ambos pero sin precio en sistema (los 47 con $0)
  const enAmbosSinPrecio = matches.filter((m) => m.sistema.precio === 0);

  // === Build markdown ===
  const lines = [];
  lines.push("# Inventario de mismatches — PORTAFOLIO 2026 ↔ Sistema");
  lines.push("");
  lines.push("Generado: " + new Date().toISOString().slice(0, 10));
  lines.push("");
  lines.push("**Fuentes:**");
  lines.push(`- Excel: \`PORTAFOLIO COMERCIAL precios 2026.xlsx\` — hoja "PORTAFOLIO 2026" + "Arma tu plato"`);
  lines.push(`- Sistema: \`platos_catalogo\` (${platosSistema.length} filas)`);
  lines.push("");

  // ===== Resumen =====
  lines.push("## Resumen ejecutivo");
  lines.push("");
  lines.push(`- Items en Excel hoja 1 con precio cargado: **${hoja1.items.length}**`);
  lines.push(`- Items en Excel "Arma tu plato" con precio cargado: **${hojaArma.items.length}**`);
  lines.push(`- Sub-encabezados ignorados en hoja 1 (no son items): ${hoja1.subcategorias.length}`);
  lines.push(`- Items en Excel hoja 1 SIN precio cargado: **${hoja1.sinPrecio.length}** ⚠️`);
  lines.push(`- Items en Excel "Arma tu plato" SIN precio cargado: **${hojaArma.sinPrecio.length}** ⚠️`);
  lines.push(`- Platos en sistema: ${platosSistema.length}`);
  lines.push(`  - Con precio cargado: **${platosSistema.filter((p) => p.precio > 0).length}** / ${platosSistema.length}`);
  lines.push(`  - Con precio = 0 (cargados sin costo): **${platosSistema.filter((p) => p.precio === 0).length}** ⚠️`);
  lines.push("");
  lines.push(`- **Coinciden Excel ↔ sistema (con match):** ${matches.length}`);
  lines.push(`  - De estos, sistema tiene precio = 0 (necesita cargar): **${enAmbosSinPrecio.length}**`);
  lines.push(`  - De estos, precios distintos entre Excel y sistema: **${precioDistinto.length}**`);
  lines.push(`- **Solo en Excel (faltan cargar al sistema):** ${soloEnExcel.length} ⚠️`);
  lines.push(`- **Solo en sistema (revisar — posibles obsoletos / test data):** ${soloEnSistema.length}`);
  lines.push("");
  lines.push("### Cómo leer las tablas de matches");
  lines.push("");
  lines.push("Columna **Conf.** (confianza del match):");
  lines.push("- 🟢 alta — match exacto, o todos los tokens del nombre del sistema están en el Excel y hay Dice ≥ 0.5. **Asumir correcto.**");
  lines.push("- 🟡 media — containment fuerte pero Dice bajo (la descripción del Excel es mucho más larga que el nombre del sistema), o Dice puro alto. **Verificar manualmente** — puede ser correcto o ser un caso de \"el plato del sistema aparece como acompañamiento de un plato distinto\".");
  lines.push("- 🔴 borderline — Dice apenas pasó 0.55. **Casi seguro falso positivo.**");
  lines.push("");
  lines.push("Columna **Match** muestra:");
  lines.push("- `cont=N/M` — N de M tokens del nombre del sistema están contenidos en el Excel.");
  lines.push("- `dice=X.XX` — Dice coefficient: simétrico, mide overlap de tokens. ≥ 0.5 = match razonable.");
  lines.push("");

  // ===== Sección 1: Solo en Excel =====
  lines.push("## 1. Solo en Excel — faltan cargar al sistema");
  lines.push("");
  lines.push(`Total: **${soloEnExcel.length}** items. Agrupados por categoría del Excel.`);
  lines.push("");
  const porCategoria = {};
  for (const it of soloEnExcel) {
    const cat = it.categoria || "(sin categoría)";
    porCategoria[cat] = porCategoria[cat] || [];
    porCategoria[cat].push(it);
  }
  for (const cat of Object.keys(porCategoria).sort()) {
    lines.push(`### ${cat} (${porCategoria[cat].length})`);
    lines.push("");
    lines.push("| Fila | Item | Precio Excel |");
    lines.push("|---|---|---|");
    for (const it of porCategoria[cat]) {
      lines.push(`| ${it.fila} | ${it.nombre.slice(0, 90)} | ${fmtPrecio(it.precio)} |`);
    }
    lines.push("");
  }

  // ===== Sección 2: Solo en sistema =====
  lines.push("## 2. Solo en sistema — revisar (posibles obsoletos / test data)");
  lines.push("");
  lines.push(`Total: **${soloEnSistema.length}** items. No tienen match razonable en Excel.`);
  lines.push("");
  lines.push("| Item | Categoría sistema | Precio sistema |");
  lines.push("|---|---|---|");
  for (const ps of soloEnSistema) {
    lines.push(`| ${ps.nombre} | ${ps.categoria} | ${fmtPrecio(ps.precio)} |`);
  }
  lines.push("");

  // ===== Sección 3: Precio distinto =====
  lines.push("## 3. En ambos — precio distinto");
  lines.push("");
  lines.push(`Total: **${precioDistinto.length}** items con precio cargado en sistema que difiere del Excel.`);
  lines.push("");
  if (precioDistinto.length > 0) {
    lines.push("| Conf. | Sistema | Precio sistema | Precio Excel | Diferencia | Match |");
    lines.push("|---|---|---|---|---|---|");
    for (const m of precioDistinto) {
      const diff = m.excel.precio - m.sistema.precio;
      const diffStr = (diff >= 0 ? "+" : "") + Math.round(diff).toLocaleString("es-CO");
      const conf = confianza(m);
      lines.push(
        `| ${conf} | ${m.sistema.nombre} | ${fmtPrecio(m.sistema.precio)} | ${fmtPrecio(m.excel.precio)} | ${diffStr} | ${m.tipo} |`
      );
    }
  } else {
    lines.push("_(ninguno)_");
  }
  lines.push("");

  // ===== Sección 4: En ambos pero sistema sin precio =====
  lines.push("## 4. En ambos — sistema con precio = 0 (cargar precio del Excel)");
  lines.push("");
  lines.push(`Total: **${enAmbosSinPrecio.length}** items.`);
  lines.push("");
  if (enAmbosSinPrecio.length > 0) {
    lines.push("| Conf. | Sistema | Categoría sistema | Precio Excel a cargar | Item Excel (extracto) | Match |");
    lines.push("|---|---|---|---|---|---|");
    for (const m of enAmbosSinPrecio.sort((a, b) => {
      // Ordenar por confianza descendente, luego por nombre del sistema
      const ca = confianzaRank(a);
      const cb = confianzaRank(b);
      if (ca !== cb) return cb - ca;
      return a.sistema.nombre.localeCompare(b.sistema.nombre);
    })) {
      const conf = confianza(m);
      lines.push(
        `| ${conf} | ${m.sistema.nombre} | ${m.sistema.categoria} | ${fmtPrecio(m.excel.precio)} | ${m.excel.nombre.replace(/\n/g, " ").slice(0, 70)} | ${m.tipo} |`
      );
    }
  }
  lines.push("");

  // ===== Sección 5: Items SIN precio en Excel =====
  lines.push("## 5. Items SIN precio en Excel (errores de portafolio)");
  lines.push("");
  lines.push(`### Hoja "PORTAFOLIO 2026" — ${hoja1.sinPrecio.length} items`);
  lines.push("");
  if (hoja1.sinPrecio.length > 0) {
    lines.push("| Fila | Categoría | Item |");
    lines.push("|---|---|---|");
    for (const it of hoja1.sinPrecio) {
      lines.push(`| ${it.fila} | ${it.categoria || "?"} | ${it.nombre.slice(0, 80)} |`);
    }
  }
  lines.push("");
  lines.push(`### Hoja "Arma tu plato" — ${hojaArma.sinPrecio.length} items`);
  lines.push("");
  if (hojaArma.sinPrecio.length > 0) {
    lines.push("| Fila | Categoría | Item |");
    lines.push("|---|---|---|");
    for (const it of hojaArma.sinPrecio) {
      lines.push(`| ${it.fila} | ${it.categoria || "?"} | ${it.nombre.slice(0, 80)} |`);
    }
  }
  lines.push("");

  // ===== Sub-encabezados ignorados (para que el user pueda revisar el filtro) =====
  lines.push("## 6. Sub-encabezados ignorados (verificación del filtro)");
  lines.push("");
  lines.push("Las siguientes filas se trataron como labels (subcategoría sin precio) y NO entraron en el match. Si alguna es realmente un item con precio faltante, hay que reclasificarla.");
  lines.push("");
  lines.push("| Fila | Categoría | Sub-encabezado |");
  lines.push("|---|---|---|");
  for (const sc of hoja1.subcategorias) {
    lines.push(`| ${sc.fila} | ${sc.categoria || "?"} | ${sc.nombre.slice(0, 80)} |`);
  }
  lines.push("");

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
  console.log("Reporte escrito en:", REPORT_PATH);
  console.log("");
  console.log("Resumen:");
  console.log(`  Items Excel hoja 1: ${hoja1.items.length} con precio | ${hoja1.sinPrecio.length} sin precio | ${hoja1.subcategorias.length} subcategorías`);
  console.log(`  Items "Arma tu plato": ${hojaArma.items.length} con precio | ${hojaArma.sinPrecio.length} sin precio`);
  console.log(`  Match Excel ↔ sistema: ${matches.length}`);
  console.log(`    Sistema con precio=0 (cargar desde Excel): ${enAmbosSinPrecio.length}`);
  console.log(`    Precios distintos: ${precioDistinto.length}`);
  console.log(`  Solo en Excel (faltan cargar): ${soloEnExcel.length}`);
  console.log(`  Solo en sistema: ${soloEnSistema.length}`);
}

main();
