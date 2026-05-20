/* eslint-env node */
/**
 * Dump tablas relevantes a Datos/.cache/*.json para procesamiento offline.
 * Usa VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY del .env del proyecto.
 *
 * Uso:
 *   node scripts/dump-bd.cjs <tabla> [columnas separadas por coma] [filename opcional]
 * Ej:
 *   node scripts/dump-bd.cjs ingredientes_catalogo id,nombre,unidad,costo_por_unidad,proveedor
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ENV = path.join(__dirname, "..", ".env");
const env = Object.fromEntries(
  fs.readFileSync(ENV, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env");
  process.exit(1);
}

const tabla = process.argv[2];
const cols = process.argv[3] || "*";
const fname = process.argv[4] || `${tabla}.json`;

if (!tabla) {
  console.error("Uso: node scripts/dump-bd.cjs <tabla> [columnas] [filename]");
  process.exit(1);
}

const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";
if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });

const sb = createClient(url, key);

(async () => {
  // Page through results to bypass default 1000-row limit
  const pageSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const { data, error } = await sb
      .from(tabla)
      .select(cols)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(error);
      process.exit(1);
    }
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  const out = path.join(CACHE, fname);
  fs.writeFileSync(out, JSON.stringify(all, null, 2), "utf8");
  console.log(`${tabla}: ${all.length} filas → ${out}`);
})();
