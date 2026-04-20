-- Fusión de ingredientes duplicados (case-insensitive o nombre exacto).
-- Canónico = el con más referencias agregadas.
-- Cada duplicado se funde: UPDATEs en las 4 tablas dependientes + DELETE de la fila duplicada.
--
-- Aplicado vía mcp__supabase__apply_migration el 2026-04-20.

-- Aceite de oliva: canonical 6616a0d9 (2 refs) <- dup abee0a6d (1 ref)
UPDATE plato_ingredientes          SET ingrediente_id='6616a0d9-5b0a-4284-8002-65515b8da150' WHERE ingrediente_id='abee0a6d-e1fd-42d2-901b-edbe8116fe20';
UPDATE ingrediente_proveedores     SET ingrediente_id='6616a0d9-5b0a-4284-8002-65515b8da150' WHERE ingrediente_id='abee0a6d-e1fd-42d2-901b-edbe8116fe20';
UPDATE evento_orden_compra_items   SET ingrediente_id='6616a0d9-5b0a-4284-8002-65515b8da150' WHERE ingrediente_id='abee0a6d-e1fd-42d2-901b-edbe8116fe20';
UPDATE inventario_mov_items        SET ingrediente_id='6616a0d9-5b0a-4284-8002-65515b8da150' WHERE ingrediente_id='abee0a6d-e1fd-42d2-901b-edbe8116fe20';
DELETE FROM ingredientes_catalogo  WHERE id='abee0a6d-e1fd-42d2-901b-edbe8116fe20';

-- Hielo: canonical 497a7f33 (6 refs) <- dup 2e3c4a95 (2 refs)
UPDATE plato_ingredientes          SET ingrediente_id='497a7f33-cd54-4a18-a3e3-b02a4c6e0a29' WHERE ingrediente_id='2e3c4a95-d3ba-4551-a1e1-932a612294d9';
UPDATE ingrediente_proveedores     SET ingrediente_id='497a7f33-cd54-4a18-a3e3-b02a4c6e0a29' WHERE ingrediente_id='2e3c4a95-d3ba-4551-a1e1-932a612294d9';
UPDATE evento_orden_compra_items   SET ingrediente_id='497a7f33-cd54-4a18-a3e3-b02a4c6e0a29' WHERE ingrediente_id='2e3c4a95-d3ba-4551-a1e1-932a612294d9';
UPDATE inventario_mov_items        SET ingrediente_id='497a7f33-cd54-4a18-a3e3-b02a4c6e0a29' WHERE ingrediente_id='2e3c4a95-d3ba-4551-a1e1-932a612294d9';
DELETE FROM ingredientes_catalogo  WHERE id='2e3c4a95-d3ba-4551-a1e1-932a612294d9';

-- Queso Parmesano: canonical b0e945d0 (6 refs) <- dup d290c4b3 (2 refs)
UPDATE plato_ingredientes          SET ingrediente_id='b0e945d0-fd36-4861-a08d-3a39f5ece0a5' WHERE ingrediente_id='d290c4b3-9be7-4df2-84b3-93240cb1d343';
UPDATE ingrediente_proveedores     SET ingrediente_id='b0e945d0-fd36-4861-a08d-3a39f5ece0a5' WHERE ingrediente_id='d290c4b3-9be7-4df2-84b3-93240cb1d343';
UPDATE evento_orden_compra_items   SET ingrediente_id='b0e945d0-fd36-4861-a08d-3a39f5ece0a5' WHERE ingrediente_id='d290c4b3-9be7-4df2-84b3-93240cb1d343';
UPDATE inventario_mov_items        SET ingrediente_id='b0e945d0-fd36-4861-a08d-3a39f5ece0a5' WHERE ingrediente_id='d290c4b3-9be7-4df2-84b3-93240cb1d343';
DELETE FROM ingredientes_catalogo  WHERE id='d290c4b3-9be7-4df2-84b3-93240cb1d343';

-- Sal: canonical b9ac91f5 (19 refs) <- dup 97800fa0 (2 refs)
UPDATE plato_ingredientes          SET ingrediente_id='b9ac91f5-7831-4024-846b-67db2911cee6' WHERE ingrediente_id='97800fa0-1d88-4d05-9870-12a47ec297a7';
UPDATE ingrediente_proveedores     SET ingrediente_id='b9ac91f5-7831-4024-846b-67db2911cee6' WHERE ingrediente_id='97800fa0-1d88-4d05-9870-12a47ec297a7';
UPDATE evento_orden_compra_items   SET ingrediente_id='b9ac91f5-7831-4024-846b-67db2911cee6' WHERE ingrediente_id='97800fa0-1d88-4d05-9870-12a47ec297a7';
UPDATE inventario_mov_items        SET ingrediente_id='b9ac91f5-7831-4024-846b-67db2911cee6' WHERE ingrediente_id='97800fa0-1d88-4d05-9870-12a47ec297a7';
DELETE FROM ingredientes_catalogo  WHERE id='97800fa0-1d88-4d05-9870-12a47ec297a7';

-- Normalizar capitalización de los canónicos a Title Case para consistencia con el resto del catálogo
UPDATE ingredientes_catalogo SET nombre='Aceite de Oliva' WHERE id='6616a0d9-5b0a-4284-8002-65515b8da150';
UPDATE ingredientes_catalogo SET nombre='Queso Parmesano' WHERE id='b0e945d0-fd36-4861-a08d-3a39f5ece0a5';
