-- Agregar columnas para registro de horas y liquidación
ALTER TABLE evento_personal 
ADD COLUMN hora_inicio TIME,
ADD COLUMN hora_fin TIME,
ADD COLUMN horas_trabajadas DECIMAL(4,2),
ADD COLUMN pago_calculado DECIMAL(10,2);

-- Agregar columna de estado de liquidación a eventos
ALTER TABLE eventos 
ADD COLUMN estado_liquidacion TEXT DEFAULT 'pendiente' CHECK (estado_liquidacion IN ('pendiente', 'liquidado'));