-- Crear tabla para registro de pagos
CREATE TABLE public.registro_pagos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  fecha_pago DATE NOT NULL,
  tipo_liquidacion VARCHAR(20) NOT NULL CHECK (tipo_liquidacion IN ('evento', 'multiple')),
  monto_total DECIMAL(10,2) NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL,
  notas TEXT,
  usuario_liquidador VARCHAR(100),
  numero_comprobante VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de relación con eventos específicos del pago
CREATE TABLE public.registro_pago_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registro_pago_id UUID NOT NULL REFERENCES public.registro_pagos(id) ON DELETE CASCADE,
  evento_id UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  horas_trabajadas DECIMAL(4,2) NOT NULL,
  monto_evento DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS para ambas tablas
ALTER TABLE public.registro_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_pago_eventos ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS
CREATE POLICY "Registro de pagos accesible para usuarios autenticados" 
ON public.registro_pagos 
FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Registro pago eventos accesible para usuarios autenticados" 
ON public.registro_pago_eventos 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_registro_pagos_empleado_id ON public.registro_pagos(empleado_id);
CREATE INDEX idx_registro_pagos_fecha_pago ON public.registro_pagos(fecha_pago);
CREATE INDEX idx_registro_pagos_numero_comprobante ON public.registro_pagos(numero_comprobante);
CREATE INDEX idx_registro_pago_eventos_registro_id ON public.registro_pago_eventos(registro_pago_id);
CREATE INDEX idx_registro_pago_eventos_evento_id ON public.registro_pago_eventos(evento_id);

-- Crear función para generar número de comprobante automático
CREATE OR REPLACE FUNCTION public.generate_comprobante_number()
RETURNS TEXT AS $$
DECLARE
    fecha_actual DATE := CURRENT_DATE;
    contador INTEGER;
    numero_comprobante TEXT;
BEGIN
    -- Obtener el siguiente número secuencial para la fecha actual
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(numero_comprobante FROM '.*-(\d+)$') AS INTEGER
        )
    ), 0) + 1
    INTO contador
    FROM public.registro_pagos
    WHERE numero_comprobante LIKE 'TXN-' || TO_CHAR(fecha_actual, 'YYYYMMDD') || '-%';
    
    -- Generar el número de comprobante
    numero_comprobante := 'TXN-' || TO_CHAR(fecha_actual, 'YYYYMMDD') || '-' || LPAD(contador::TEXT, 3, '0');
    
    RETURN numero_comprobante;
END;
$$ LANGUAGE plpgsql;