-- ============================================================================
-- Script para agregar modalidades de cobro al personal
-- Fecha: 2025-09-30
-- Descripción: Agrega columnas para manejar diferentes modalidades de cobro
--              (por hora, por jornada 9h, 10h, hasta 10h, nocturna, por evento)
-- ============================================================================

-- Tipo ENUM para modalidades de cobro
-- Nota: En PostgreSQL con Supabase, es mejor usar CHECK constraints que ENUMs

-- 1. Agregar columna modalidad_cobro a personal_costos_catalogo
ALTER TABLE public.personal_costos_catalogo
ADD COLUMN IF NOT EXISTS modalidad_cobro text NOT NULL DEFAULT 'por_hora'
CHECK (modalidad_cobro IN (
  'por_hora',              -- Cobro por hora trabajada
  'jornada_9h',            -- Jornada fija de 9 horas
  'jornada_10h',           -- Jornada fija de 10 horas
  'jornada_hasta_10h',     -- Jornada hasta 10 horas (si pasa de 10h, cobra extra)
  'jornada_nocturna',      -- Jornada nocturna (horarios especiales)
  'por_evento'             -- Cobro fijo por evento completo
));

-- 2. Agregar columna modalidad_cobro a personal
ALTER TABLE public.personal
ADD COLUMN IF NOT EXISTS modalidad_cobro text NOT NULL DEFAULT 'por_hora'
CHECK (modalidad_cobro IN (
  'por_hora',
  'jornada_9h',
  'jornada_10h',
  'jornada_hasta_10h',
  'jornada_nocturna',
  'por_evento'
));

-- 3. Renombrar columna tarifa_hora a tarifa en personal para mayor claridad
-- Nota: No ejecutar si ya existe o causa conflicto
ALTER TABLE public.personal
RENAME COLUMN tarifa_hora TO tarifa;

-- 4. Agregar comentarios para documentación
COMMENT ON COLUMN public.personal_costos_catalogo.modalidad_cobro IS
'Modalidad de cobro: por_hora, jornada_9h, jornada_10h, jornada_hasta_10h, jornada_nocturna, por_evento';

COMMENT ON COLUMN public.personal.modalidad_cobro IS
'Modalidad de cobro: por_hora, jornada_9h, jornada_10h, jornada_hasta_10h, jornada_nocturna, por_evento';

COMMENT ON COLUMN public.personal.tarifa IS
'Tarifa según modalidad: puede ser por hora, por jornada o por evento completo';

-- 5. Agregar columna para tarifa extra por hora (opcional, para jornadas que excedan límite)
ALTER TABLE public.personal
ADD COLUMN IF NOT EXISTS tarifa_hora_extra numeric
CHECK (tarifa_hora_extra IS NULL OR tarifa_hora_extra >= 0);

COMMENT ON COLUMN public.personal.tarifa_hora_extra IS
'Tarifa por hora extra cuando se excede la jornada (aplica para jornada_hasta_10h)';

-- 6. Actualizar registros existentes (todos quedan como por_hora por defecto)
UPDATE public.personal_costos_catalogo
SET modalidad_cobro = 'por_hora'
WHERE modalidad_cobro IS NULL;

UPDATE public.personal
SET modalidad_cobro = 'por_hora'
WHERE modalidad_cobro IS NULL;

-- ============================================================================
-- Ejemplos de uso:
-- ============================================================================
-- Mesero que cobra por hora:
--   modalidad_cobro = 'por_hora', tarifa = 15000

-- Chef que cobra jornada de 10h:
--   modalidad_cobro = 'jornada_10h', tarifa = 180000

-- Coordinador que cobra hasta 10h (si pasa, cobra extra):
--   modalidad_cobro = 'jornada_hasta_10h', tarifa = 200000, tarifa_hora_extra = 25000

-- Bartender que cobra por evento:
--   modalidad_cobro = 'por_evento', tarifa = 250000

-- ============================================================================
-- Notas importantes:
-- ============================================================================
-- 1. La lógica de cálculo de pago debe implementarse en el frontend/backend
-- 2. Para 'jornada_hasta_10h': si trabaja <= 10h, cobra tarifa fija
--    si trabaja > 10h, cobra tarifa + (horas_extra * tarifa_hora_extra)
-- 3. Para 'por_evento': no importan las horas, siempre cobra la tarifa fija
-- 4. Para jornadas fijas (9h, 10h): cobra la tarifa sin importar horas exactas
-- ============================================================================