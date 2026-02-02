-- =============================================
-- RECETARIO: Database Migration
-- Run this in Supabase SQL Editor BEFORE the seed script
-- =============================================

-- 1a. Create new tables

-- Master ingredient catalog
CREATE TABLE public.ingredientes_catalogo (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  unidad text NOT NULL,          -- 'gr', 'ml', 'und', 'kg', 'lt'
  costo_por_unidad numeric NOT NULL DEFAULT 0 CHECK (costo_por_unidad >= 0),
  proveedor text,                -- e.g. 'Gam', 'Alpina', 'Knorr'
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ingredientes_catalogo_pkey PRIMARY KEY (id)
);

-- Junction: which ingredients go into which dish, with quantities
CREATE TABLE public.plato_ingredientes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plato_id uuid NOT NULL,
  ingrediente_id uuid NOT NULL,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT plato_ingredientes_pkey PRIMARY KEY (id),
  CONSTRAINT plato_ingredientes_plato_id_fkey FOREIGN KEY (plato_id) REFERENCES public.platos_catalogo(id) ON DELETE CASCADE,
  CONSTRAINT plato_ingredientes_ingrediente_id_fkey FOREIGN KEY (ingrediente_id) REFERENCES public.ingredientes_catalogo(id) ON DELETE RESTRICT,
  CONSTRAINT plato_ingredientes_unique UNIQUE (plato_id, ingrediente_id)
);

-- 1b. Add new columns to platos_catalogo
ALTER TABLE public.platos_catalogo
  ADD COLUMN porciones_receta integer,
  ADD COLUMN tiempo_preparacion text,
  ADD COLUMN temperatura_coccion text,
  ADD COLUMN rendimiento text,
  ADD COLUMN notas text;

-- 1c. Clear existing platos data (removes FK references first)
DELETE FROM cotizacion_platos;
DELETE FROM evento_requerimiento_platos;
DELETE FROM platos_catalogo;

-- 1d. Enable RLS (match existing patterns)
ALTER TABLE public.ingredientes_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plato_ingredientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.ingredientes_catalogo FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.plato_ingredientes FOR ALL USING (true) WITH CHECK (true);
