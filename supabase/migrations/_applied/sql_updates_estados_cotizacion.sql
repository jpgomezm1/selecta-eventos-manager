-- ================================================
-- COMANDOS SQL PARA ACTUALIZAR ESTADOS DE COTIZACIÓN
-- ================================================
-- Ejecutar estos comandos en orden en la base de datos de Supabase

-- 1. Actualizar registros existentes que tengan el estado "Borrador"
UPDATE cotizaciones
SET estado = 'Pendiente por Aprobación'
WHERE estado = 'Borrador';

-- 2. Actualizar registros existentes en la tabla de versiones
UPDATE cotizacion_versiones
SET estado = 'Pendiente por Aprobación'
WHERE estado = 'Borrador';

-- 3. Verificar que no existan estados "Enviada" que deban ser actualizados
-- (opcional - revisar si hay registros con este estado y decidir qué hacer)
SELECT estado, COUNT(*) as cantidad
FROM cotizaciones
GROUP BY estado;

-- 4. Si existe una constrainta de CHECK en la tabla cotizaciones, actualizarla
-- Primero eliminamos la constraint existente (si existe)
ALTER TABLE cotizaciones
DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;

-- Agregar nueva constraint con los estados actualizados
ALTER TABLE cotizaciones
ADD CONSTRAINT cotizaciones_estado_check
CHECK (estado IN (
    'Pendiente por Aprobación',
    'Enviada',
    'Cotización Aprobada',
    'Rechazada'
));

-- 5. Si existe una constrainta de CHECK en la tabla cotizacion_versiones, actualizarla
-- Primero eliminamos la constraint existente (si existe)
ALTER TABLE cotizacion_versiones
DROP CONSTRAINT IF EXISTS cotizacion_versiones_estado_check;

-- Agregar nueva constraint con los estados actualizados
ALTER TABLE cotizacion_versiones
ADD CONSTRAINT cotizacion_versiones_estado_check
CHECK (estado IN (
    'Pendiente por Aprobación',
    'Enviada',
    'Cotización Aprobada',
    'Rechazada'
));

-- 6. Actualizar el valor por defecto si está definido en la tabla
ALTER TABLE cotizaciones
ALTER COLUMN estado SET DEFAULT 'Pendiente por Aprobación';

ALTER TABLE cotizacion_versiones
ALTER COLUMN estado SET DEFAULT 'Pendiente por Aprobación';

-- 7. Verificación final - revisar que todos los estados estén correctos
SELECT
    'cotizaciones' as tabla,
    estado,
    COUNT(*) as cantidad
FROM cotizaciones
GROUP BY estado
UNION ALL
SELECT
    'cotizacion_versiones' as tabla,
    estado,
    COUNT(*) as cantidad
FROM cotizacion_versiones
GROUP BY estado
ORDER BY tabla, estado;

-- 8. Verificar la integridad de los datos después de las actualizaciones
SELECT
    c.id,
    c.nombre_cotizacion,
    c.estado as estado_cotizacion,
    COUNT(cv.id) as num_versiones,
    STRING_AGG(cv.estado, ', ') as estados_versiones
FROM cotizaciones c
LEFT JOIN cotizacion_versiones cv ON c.id = cv.cotizacion_id
GROUP BY c.id, c.nombre_cotizacion, c.estado
ORDER BY c.created_at DESC
LIMIT 10;

-- ================================================
-- NOTAS IMPORTANTES:
-- ================================================
-- 1. Ejecutar estos comandos durante una ventana de mantenimiento
-- 2. Hacer backup de la base de datos antes de ejecutar
-- 3. Verificar que no hay transacciones activas antes de modificar constraints
-- 4. Los comandos están diseñados para ser idempotentes (se pueden ejecutar múltiples veces)
-- 5. El estado "Enviada" se mantiene por compatibilidad, pero el flujo principal usa los nuevos estados