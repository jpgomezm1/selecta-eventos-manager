-- Agregar columnas para control de liquidación a nivel de evento
ALTER TABLE eventos 
ADD COLUMN fecha_liquidacion DATE;