-- Crear tabla Personal
CREATE TABLE public.personal (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_completo TEXT NOT NULL,
  numero_cedula TEXT UNIQUE NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('Coordinador', 'Mesero', 'Chef', 'Bartender', 'Decorador', 'Técnico de Sonido', 'Fotógrafo', 'Otro')),
  tarifa_hora DECIMAL(10,2) NOT NULL CHECK (tarifa_hora > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla Eventos
CREATE TABLE public.eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_evento TEXT NOT NULL,
  ubicacion TEXT NOT NULL,
  fecha_evento DATE NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla relación Eventos-Personal
CREATE TABLE public.evento_personal (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID REFERENCES public.eventos(id) ON DELETE CASCADE,
  personal_id UUID REFERENCES public.personal(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(evento_id, personal_id)
);

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_personal_rol ON public.personal(rol);
CREATE INDEX idx_eventos_fecha ON public.eventos(fecha_evento);
CREATE INDEX idx_evento_personal_evento ON public.evento_personal(evento_id);
CREATE INDEX idx_evento_personal_personal ON public.evento_personal(personal_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.personal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_personal ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS (permitir acceso a usuarios autenticados)
CREATE POLICY "Personal accesible para usuarios autenticados" 
ON public.personal FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Eventos accesible para usuarios autenticados" 
ON public.eventos FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Evento_personal accesible para usuarios autenticados" 
ON public.evento_personal FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para actualizar updated_at
CREATE TRIGGER update_personal_updated_at
    BEFORE UPDATE ON public.personal
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_eventos_updated_at
    BEFORE UPDATE ON public.eventos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();