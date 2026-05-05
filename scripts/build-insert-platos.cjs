/* eslint-env node */
/**
 * Genera SQL transaccional para Fase 2:
 *  1) Backfill de `codigo` en los 30 platos BD que matchearon semánticamente.
 *  2) INSERT de los platos del archivo que NO tienen contraparte en BD.
 *
 * Excluye códigos que ya están "consumidos" por el backfill + ACO-028 (Orzo al Pesto, dejado pendiente).
 */
const fs = require("fs");

const CACHE = "C:/Users/tomas/OneDrive/Irrelevant/Selecta/Datos/.cache";
const extracted = JSON.parse(fs.readFileSync(`${CACHE}/precios-extracted.json`, "utf8"));

// Mapping codigo → uuid BD (los 30 matches semánticos aplicados el 2026-05-05)
const BACKFILL = {
  // Alta confianza (25)
  "COC-006":  "5e7ee1e7-3edb-4b48-8fd8-d34603fc3781", // Aperol Spritz Clásico
  "ENT-014":  "c689f185-b8cd-408c-b711-ea7640b263d7", // Arancinis
  "COT-009":  "7e4207e0-7454-4a0b-8a89-bacf19856ba6", // Arroz al Wok
  "ACO-008":  "8399b19a-e5b1-486c-a47a-59764ba39a03", // Arroz de Arándanos
  "ACO-041":  "2fd2e202-6f52-48d7-b14f-25fc5393c6aa", // Arroz de Coco
  "ACO-020":  "0028914f-8ca2-4711-8011-69da8be7b26c", // Arroz Frito
  "BOW-003":  "c6b36eae-736f-46e0-b345-6a1fcb382a21", // Bowl Toscano
  "CAL-002":  "695c26a2-bf98-4c4d-9cdb-59872c722d69", // Consomé de Pollo
  "ENT-017":  "59a1f45b-4371-4980-8ca8-3906e90d9c3f", // Crema de Ahuyama
  "ENT-005":  "0fe63a68-f944-44ad-b34d-ff3618c18c1a", // Crema de Maíz
  "ENT-011":  "fd884161-37f0-419a-85c6-84b9aee0c123", // Encocado P.M.
  "ENS-007":  "5f1693e8-ac70-4334-8244-fe61e703643b", // Ensalada Caprese
  "ENT-013":  "3efa7db8-faa0-4381-bfe2-6bca023318d6", // Ensalada César
  "ENS-003":  "20629c47-8b8a-47c3-9094-fb5a6a4dec3b", // Ensalada de la Casa
  "HAM-003":  "07675d49-42ea-4e12-96b2-6fcc7d178440", // Hamburguesa Sweet Pesto
  "COT-004":  "5f05649c-2816-4222-af95-c24228f11f15", // Lasaña de Pollo
  "ACO-029":  "dff52c05-07ff-4b26-a86a-bd8094c0e194", // Mil Hojas de Papa
  "ORI-008":  "3c71f224-87be-4634-9480-16fcfe290543", // Mini Bao Camarón
  "ORI-007":  "b1bfabf1-398a-4ef2-a99e-5017ec51201b", // Mini Bao Pollo
  "PREM-002": "22f2ea3d-d35f-4114-bc72-cb00898071ea", // Panceta
  "COC-003":  "63bccba9-912d-4268-96e0-04981e33814e", // Piña Colada
  "PREM-005": "5301062b-1d15-453a-81d2-6d704adfaac2", // Salmón al Grill
  "TCOL-002": "f1243bea-c21e-4c87-b1ef-335c3672d6cc", // Sancocho Trifásico
  "COC-004":  "d205650a-8339-4b04-9579-54a5a53c8a27", // Sangría
  "PREM-007": "7f013e06-6d8b-4e8f-9dec-119371d2279d", // Solomito Cerdo Albardado
  // Media (5)
  "COT-007":  "dd902b5b-101a-415b-9c71-7d83176ae780", // Lasaña de Solomito
  "COC-002":  "5a8ffd54-ace3-459f-98e1-efac143c41e2", // Lulada
  "PCOM-009": "46ec1756-79fc-44c8-a6b8-1116b3a69f0b", // Plátano c/Burrata
  "ACO-002":  "a3883fef-c1e5-435c-a0c3-5b299a3042a6", // Risotto Cremoso
  "PREM-001": "70ab11bc-18c9-4727-b433-c17bf55d53b1", // Solomito Rostizado c/Gnocchi
};

// Códigos a NO insertar (ya consumidos por backfill + 1 pendiente)
const SKIP = new Set([
  ...Object.keys(BACKFILL),
  "ACO-028", // Orzo al Pesto: BD tiene un Orzo al Pesto $32500 sin código; no duplicar.
]);

// Verificar que todos los BACKFILL existan en archivo
const archivoByCodigo = new Map(extracted.all.map((p) => [p.codigo, p]));
const missingFromArchivo = Object.keys(BACKFILL).filter((c) => !archivoByCodigo.has(c));
if (missingFromArchivo.length > 0) {
  console.error("ERROR: códigos en BACKFILL no encontrados en archivo:", missingFromArchivo);
  process.exit(1);
}

// Detectar nombres duplicados entre BD-no-backfill (los 17 sin update) y los a insertar
// (No tengo dump fresco de BD pero los 17 nombres son conocidos del cierre 2026-05-05)
const NOMBRES_BD_SIN_BACKFILL = [
  "Arroz al Curri", "Arroz Simple", "Canastilla de Pasta Filo", "Coral",
  "Crema de Champiñón", "Crepes", "Ensalada Waldorf", "Frijoles",
  "Medallones de Pollo con Ravioles", "Mini Bowl Árabe", "Mini Bowl Costeño",
  "Mini Bowl Orzo con Maicitos", "Pesca Blanca en Mantequilla Finas Hierbas",
  "Pesca Blanca Sobre Cama Encocada",
  "Crema de Tomate", "Orzo al Pesto",
  "Risotto de Champiñones con Queso Parmesano", // duplicado pendiente
];
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const nombresBdSet = new Set(NOMBRES_BD_SIN_BACKFILL.map(norm));

// Filtrar candidatos a insert
const aInsertar = [];
const conflictosNombre = [];
for (const p of extracted.all) {
  if (SKIP.has(p.codigo)) continue;
  if (nombresBdSet.has(norm(p.nombre))) {
    conflictosNombre.push(p);
    continue;
  }
  aInsertar.push(p);
}

const sqlEscape = (v) => v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;

console.log("-- ============================================================================");
console.log("-- Fase 2: backfill de códigos + INSERT de platos del archivo");
console.log(`-- Generado: ${new Date().toISOString()}`);
console.log(`-- Backfill: ${Object.keys(BACKFILL).length} platos BD reciben código`);
console.log(`-- INSERT: ${aInsertar.length} platos nuevos`);
console.log(`-- Skip por backfill: ${Object.keys(BACKFILL).length}`);
console.log(`-- Skip por nombre duplicado con BD: ${conflictosNombre.length}`);
console.log("-- ============================================================================");
console.log();
console.log("BEGIN;");
console.log();
console.log("-- ---------------------- BACKFILL DE CODIGO ----------------------------------");
for (const [codigo, id] of Object.entries(BACKFILL)) {
  const p = archivoByCodigo.get(codigo);
  console.log(`UPDATE platos_catalogo SET codigo='${codigo}' WHERE id='${id}'; -- ${p.nombre}`);
}
console.log();
console.log(`-- ---------------------- INSERT (${aInsertar.length} platos) ---------------------------------`);
console.log("INSERT INTO platos_catalogo (codigo, nombre, precio, categoria, tipo_menu) VALUES");
const lines = aInsertar.map((p, i) => {
  const sep = i === aInsertar.length - 1 ? ";" : ",";
  return `  (${sqlEscape(p.codigo)}, ${sqlEscape(p.nombre)}, ${p.precio}, ${sqlEscape(p.categoria)}, ${sqlEscape(p.tipo_menu)})${sep}`;
});
console.log(lines.join("\n"));
console.log();
console.log("-- ---------------------- VERIFICACIÓN ---------------------------------------");
console.log("SELECT 'total_platos' k, COUNT(*) v FROM platos_catalogo");
console.log("UNION ALL SELECT 'con_codigo', COUNT(*) FROM platos_catalogo WHERE codigo IS NOT NULL");
console.log("UNION ALL SELECT 'con_precio', COUNT(*) FROM platos_catalogo WHERE precio>0");
console.log("UNION ALL SELECT 'sin_codigo_sin_precio', COUNT(*) FROM platos_catalogo WHERE codigo IS NULL AND precio=0;");
console.log();
console.log("COMMIT;");
console.error("\n=== STATS ===");
console.error(`Backfill: ${Object.keys(BACKFILL).length}`);
console.error(`Insert: ${aInsertar.length}`);
console.error(`Conflictos por nombre con BD: ${conflictosNombre.length}`);
if (conflictosNombre.length > 0) {
  console.error("Ejemplos:");
  for (const p of conflictosNombre.slice(0, 5)) console.error(`  ${p.codigo} - ${p.nombre} ($${p.precio})`);
}
console.error(`Total esperado en BD post-fase2: 47 + ${aInsertar.length} = ${47 + aInsertar.length}`);
