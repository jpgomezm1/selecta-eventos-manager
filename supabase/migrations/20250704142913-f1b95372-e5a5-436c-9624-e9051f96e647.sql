-- Agregar columnas para control de pagos
ALTER TABLE evento_personal 
ADD COLUMN estado_pago VARCHAR(20) DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado')),
ADD COLUMN fecha_pago DATE,
ADD COLUMN metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('efectivo', 'transferencia', 'nomina', 'otro') OR metodo_pago IS NULL),
ADD COLUMN notas_pago TEXT;

-- Crear índice para consultas rápidas por estado de pago
CREATE INDEX idx_evento_personal_estado ON evento_personal(estado_pago);

-- Crear índice para consultas por empleado
CREATE INDEX idx_evento_personal_personal_id ON evento_personal(personal_id);