-- Create cotizacion_lugares table (stores places for each cotización)
CREATE TABLE IF NOT EXISTS public.cotizacion_lugares (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL,
  nombre text NOT NULL,
  direccion text,
  ciudad text,
  capacidad_estimada integer,
  precio_referencia numeric DEFAULT 0,
  notas text,
  es_seleccionado boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 1,
  CONSTRAINT cotizacion_lugares_pkey PRIMARY KEY (id),
  CONSTRAINT cotizacion_lugares_cotizacion_id_fkey FOREIGN KEY (cotizacion_id) REFERENCES public.cotizaciones(id) ON DELETE CASCADE
);
