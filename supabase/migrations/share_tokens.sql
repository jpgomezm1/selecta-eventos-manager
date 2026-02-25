-- ============================================
-- Migration: Shareable links for cotizaciones
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Tabla de share tokens
CREATE TABLE public.cotizacion_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE INDEX idx_share_tokens_token ON public.cotizacion_share_tokens(token) WHERE is_active = true;
CREATE INDEX idx_share_tokens_cotizacion ON public.cotizacion_share_tokens(cotizacion_id);

ALTER TABLE public.cotizacion_share_tokens ENABLE ROW LEVEL SECURITY;

-- Auth users can manage tokens
CREATE POLICY "Auth users manage share tokens"
  ON public.cotizacion_share_tokens FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Anon can read active tokens (to validate the public link)
CREATE POLICY "Anon read active share tokens"
  ON public.cotizacion_share_tokens FOR SELECT TO anon
  USING (is_active = true);

-- 2. Helper function: does a cotizacion have an active share?
CREATE OR REPLACE FUNCTION public.cotizacion_has_active_share(cot_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cotizacion_share_tokens
    WHERE cotizacion_id = cot_id AND is_active = true
  );
$$;

-- 3. Anon SELECT policies on cotizacion tables (only when shared)
CREATE POLICY "Anon read shared cotizaciones" ON public.cotizaciones
  FOR SELECT TO anon USING (public.cotizacion_has_active_share(id));

CREATE POLICY "Anon read shared versiones" ON public.cotizacion_versiones
  FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

CREATE POLICY "Anon read shared platos" ON public.cotizacion_platos
  FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

CREATE POLICY "Anon read shared personal" ON public.cotizacion_personal_items
  FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

CREATE POLICY "Anon read shared transporte" ON public.cotizacion_transporte_items
  FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

CREATE POLICY "Anon read shared menaje" ON public.cotizacion_menaje_items
  FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

-- 4. Anon read on catalog/reference tables (for JOINs)
CREATE POLICY "Anon read platos catalogo" ON public.platos_catalogo
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read personal costos" ON public.personal_costos_catalogo
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read transporte tarifas" ON public.transporte_tarifas
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read menaje catalogo" ON public.menaje_catalogo
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read clientes shared" ON public.clientes
  FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read contactos shared" ON public.cliente_contactos
  FOR SELECT TO anon USING (true);
