-- ============================================================================
-- Schema baseline for Selecta eventos manager (project: xvvbxyjcieckbbdcuoge).
-- Generated 2026-04-20 via MCP supabase tools (pg_policy / pg_indexes /
-- information_schema.columns / pg_proc / pg_trigger / pg_views).
--
-- Purpose: snapshot of the real DB so the repo stops drifting from Supabase.
-- This file targets a clean Postgres 15 (Supabase-hosted) and assumes the
-- `auth` schema plus extensions `pgcrypto` and `uuid-ossp` already exist.
--
-- Audit notes (see AUDIT_PASO_1.md):
--   * cotizacion_menaje_items has NO foreign keys despite referencing
--     cotizaciones, cotizacion_versiones and menaje_catalogo by id.
--   * cotizacion_lugares has RLS DISABLED (all other tables have RLS on).
--   * RLS policies are permissive (USING true) — no per-user isolation.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Catalog / master-data tables (no foreign keys to internal tables)
-- ----------------------------------------------------------------------------

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  telefono text,
  correo text,
  empresa text,
  nit text,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  tipo text NOT NULL DEFAULT 'persona_natural'
    CHECK (tipo IN ('persona_natural', 'empresa')),
  cedula text
);

CREATE TABLE public.cliente_contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  cargo text,
  telefono text,
  correo text,
  es_principal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.platos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  categoria text,
  tipo_menu text NOT NULL
    CHECK (tipo_menu IN ('Menu General', 'Armalo a tu Gusto')),
  created_at timestamptz DEFAULT now(),
  porciones_receta integer,
  tiempo_preparacion text,
  temperatura_coccion text,
  rendimiento text,
  notas text,
  margen_ganancia numeric
);

CREATE TABLE public.personal_costos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rol text NOT NULL UNIQUE,
  tarifa numeric(10,2) NOT NULL CHECK (tarifa >= 0),
  created_at timestamptz DEFAULT now(),
  modalidad_cobro text NOT NULL DEFAULT 'por_hora'
    CHECK (modalidad_cobro IN (
      'por_hora','jornada_9h','jornada_10h',
      'jornada_hasta_10h','jornada_nocturna','por_evento'
    ))
);
COMMENT ON TABLE public.personal_costos_catalogo IS
  'Catálogo de tarifas estándar por rol para el módulo de cotizaciones.';

CREATE TABLE public.personal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_completo text NOT NULL,
  numero_cedula text NOT NULL UNIQUE,
  rol text NOT NULL
    CHECK (rol IN (
      'Coordinador','Mesero','Chef','Bartender',
      'Decorador','Técnico de Sonido','Fotógrafo','Otro'
    )),
  tarifa numeric(10,2) NOT NULL CHECK (tarifa > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  modalidad_cobro text NOT NULL DEFAULT 'por_hora'
    CHECK (modalidad_cobro IN (
      'por_hora','jornada_9h','jornada_10h',
      'jornada_hasta_10h','jornada_nocturna','por_evento'
    )),
  tarifa_hora_extra numeric
    CHECK (tarifa_hora_extra IS NULL OR tarifa_hora_extra >= 0)
);

CREATE TABLE public.transporte_tarifas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lugar text NOT NULL,
  tarifa numeric(10,2) NOT NULL CHECK (tarifa >= 0),
  tipo_evento text NOT NULL
    CHECK (tipo_evento IN (
      'Eventos Grandes','Eventos Pequeños','Selecta To Go','Eventos Noche'
    )),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.lugares_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  direccion text,
  ciudad text,
  capacidad_estimada integer,
  precio_referencia numeric DEFAULT 0,
  notas text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.menaje_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  nombre text NOT NULL,
  categoria text NOT NULL,
  unidad text NOT NULL,
  stock_total integer NOT NULL CHECK (stock_total >= 0),
  activo boolean NOT NULL DEFAULT true,
  precio_alquiler numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.ingredientes_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  unidad text NOT NULL,
  costo_por_unidad numeric NOT NULL DEFAULT 0 CHECK (costo_por_unidad >= 0),
  proveedor text,
  created_at timestamptz DEFAULT now(),
  stock_actual numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.ingrediente_proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingrediente_id uuid NOT NULL REFERENCES public.ingredientes_catalogo(id) ON DELETE CASCADE,
  proveedor text NOT NULL,
  presentacion_cantidad numeric NOT NULL,
  presentacion_unidad text NOT NULL,
  precio_presentacion numeric NOT NULL,
  costo_por_unidad_base numeric NOT NULL,
  es_principal boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.plato_ingredientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plato_id uuid NOT NULL REFERENCES public.platos_catalogo(id) ON DELETE CASCADE,
  ingrediente_id uuid NOT NULL REFERENCES public.ingredientes_catalogo(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT plato_ingredientes_unique UNIQUE (plato_id, ingrediente_id)
);

-- ----------------------------------------------------------------------------
-- 2. Cotizaciones domain
-- ----------------------------------------------------------------------------

CREATE TABLE public.cotizaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_cotizacion text NOT NULL,
  cliente_nombre text,
  numero_invitados integer NOT NULL CHECK (numero_invitados > 0),
  fecha_evento_estimada date,
  total_cotizado numeric(12,2) NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Borrador'
    CHECK (estado IN (
      'Pendiente por Aprobación','Enviada','Cotización Aprobada','Rechazada'
    )),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  ubicacion_evento text,
  comercial_encargado text NOT NULL DEFAULT 'Sin asignar',
  contacto_telefono text,
  contacto_correo text,
  hora_inicio time,
  hora_fin time,
  hora_montaje_inicio time,
  hora_montaje_fin time,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  contacto_id uuid REFERENCES public.cliente_contactos(id) ON DELETE SET NULL,
  motivo_rechazo text,
  notas_rechazo text,
  fecha_envio timestamptz,
  fecha_cierre timestamptz,
  CONSTRAINT chk_motivo_rechazo CHECK (
    motivo_rechazo IS NULL
    OR motivo_rechazo IN ('Precio','Competencia','Cambio de fecha','Cliente desistió','Otro')
  )
);
CREATE INDEX idx_cotizaciones_estado ON public.cotizaciones(estado);

CREATE TABLE public.cotizacion_versiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  nombre_opcion text NOT NULL,
  version_index integer NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Borrador'
    CHECK (estado IN (
      'Pendiente por Aprobación','Enviada','Cotización Aprobada','Rechazada'
    )),
  is_definitiva boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_cotver_cot_ver ON public.cotizacion_versiones(cotizacion_id, version_index);
CREATE UNIQUE INDEX idx_cotver_definitiva_unique
  ON public.cotizacion_versiones(cotizacion_id) WHERE (is_definitiva = true);

CREATE TABLE public.cotizacion_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);
CREATE INDEX idx_share_tokens_cotizacion ON public.cotizacion_share_tokens(cotizacion_id);
CREATE INDEX idx_share_tokens_token ON public.cotizacion_share_tokens(token)
  WHERE (is_active = true);

-- NOTE: cotizacion_lugares is the ONLY table with RLS disabled.
CREATE TABLE public.cotizacion_lugares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  direccion text,
  ciudad text,
  capacidad_estimada integer,
  precio_referencia numeric DEFAULT 0,
  notas text,
  es_seleccionado boolean NOT NULL DEFAULT false,
  orden integer NOT NULL DEFAULT 1
);

CREATE TABLE public.cotizacion_platos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  plato_id uuid NOT NULL REFERENCES public.platos_catalogo(id) ON DELETE CASCADE,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(10,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  cotizacion_version_id uuid REFERENCES public.cotizacion_versiones(id) ON DELETE CASCADE
);
CREATE INDEX idx_cotizacion_platos_cotizacion_id ON public.cotizacion_platos(cotizacion_id);

CREATE TABLE public.cotizacion_personal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  personal_costo_id uuid NOT NULL REFERENCES public.personal_costos_catalogo(id),
  cantidad integer NOT NULL CHECK (cantidad > 0),
  tarifa_estimada_por_persona numeric NOT NULL,
  subtotal numeric NOT NULL,
  cotizacion_version_id uuid REFERENCES public.cotizacion_versiones(id) ON DELETE CASCADE
);
CREATE INDEX idx_cotizacion_personal_items_cotizacion_id ON public.cotizacion_personal_items(cotizacion_id);

CREATE TABLE public.cotizacion_transporte_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  transporte_id uuid NOT NULL REFERENCES public.transporte_tarifas(id) ON DELETE CASCADE,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  tarifa_unitaria numeric(10,2) NOT NULL,
  subtotal numeric(12,2) NOT NULL,
  cotizacion_version_id uuid REFERENCES public.cotizacion_versiones(id) ON DELETE CASCADE
);
CREATE INDEX idx_cotizacion_transporte_items_cotizacion_id ON public.cotizacion_transporte_items(cotizacion_id);

-- NOTE: cotizacion_menaje_items has NO declared foreign keys on the real DB,
-- despite cotizacion_id / cotizacion_version_id / menaje_id clearly being
-- logical FKs. Kept here verbatim to match what Supabase reports; fix in a
-- later migration (audit item 2A).
CREATE TABLE public.cotizacion_menaje_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL,
  cotizacion_version_id uuid NOT NULL,
  menaje_id uuid NOT NULL,
  cantidad integer NOT NULL DEFAULT 1,
  precio_alquiler numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.cotizacion_personal_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_version_id uuid NOT NULL,
  personal_costo_id uuid NOT NULL,
  personal_id uuid NOT NULL REFERENCES public.personal(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotizacion_personal_asignaciones_unique
    UNIQUE (cotizacion_version_id, personal_costo_id, personal_id)
);

-- ----------------------------------------------------------------------------
-- 3. Eventos domain
-- ----------------------------------------------------------------------------

CREATE TABLE public.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_evento text NOT NULL,
  ubicacion text NOT NULL,
  fecha_evento date NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  estado_liquidacion text DEFAULT 'pendiente'
    CHECK (estado_liquidacion IN ('pendiente','liquidado')),
  fecha_liquidacion date,
  cotizacion_version_id uuid REFERENCES public.cotizacion_versiones(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX eventos_cotver_unique
  ON public.eventos(cotizacion_version_id) WHERE (cotizacion_version_id IS NOT NULL);
CREATE INDEX idx_eventos_fecha ON public.eventos(fecha_evento);

CREATE TABLE public.evento_personal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid REFERENCES public.eventos(id) ON DELETE CASCADE,
  personal_id uuid REFERENCES public.personal(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  hora_inicio time,
  hora_fin time,
  horas_trabajadas numeric(4,2),
  pago_calculado numeric(10,2),
  estado_pago varchar(20) DEFAULT 'pendiente'
    CHECK (estado_pago IN ('pendiente','pagado')),
  fecha_pago date,
  metodo_pago varchar(50)
    CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo','transferencia','nomina','otro')),
  notas_pago text,
  CONSTRAINT evento_personal_evento_id_personal_id_key UNIQUE (evento_id, personal_id)
);
CREATE INDEX idx_evento_personal_estado ON public.evento_personal(estado_pago);
CREATE INDEX idx_evento_personal_evento ON public.evento_personal(evento_id);
CREATE INDEX idx_evento_personal_personal ON public.evento_personal(personal_id);
CREATE INDEX idx_evento_personal_personal_id ON public.evento_personal(personal_id);

CREATE TABLE public.evento_requerimiento_platos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  plato_id uuid NOT NULL REFERENCES public.platos_catalogo(id),
  nombre text,
  precio_unitario numeric NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  subtotal numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.evento_requerimiento_personal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  personal_costo_id uuid NOT NULL REFERENCES public.personal_costos_catalogo(id),
  rol text,
  tarifa_estimada_por_persona numeric NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  subtotal numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.evento_requerimiento_transporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  transporte_id uuid NOT NULL REFERENCES public.transporte_tarifas(id),
  lugar text,
  tarifa_unitaria numeric NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  subtotal numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.evento_requerimiento_menaje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  menaje_id uuid REFERENCES public.menaje_catalogo(id),
  nombre text NOT NULL DEFAULT '',
  precio_alquiler numeric NOT NULL DEFAULT 0,
  cantidad integer NOT NULL DEFAULT 1,
  subtotal numeric NOT NULL DEFAULT 0
);

CREATE TABLE public.evento_orden_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','aprobada','comprada','cancelada')),
  total_estimado numeric DEFAULT 0,
  notas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.evento_orden_compra_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id uuid NOT NULL REFERENCES public.evento_orden_compra(id) ON DELETE CASCADE,
  ingrediente_id uuid REFERENCES public.ingredientes_catalogo(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  unidad text NOT NULL,
  cantidad_necesaria numeric NOT NULL DEFAULT 0,
  cantidad_inventario numeric NOT NULL DEFAULT 0,
  cantidad_comprar numeric NOT NULL DEFAULT 0,
  costo_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 4. Menaje (rental equipment) movements/reservations
-- ----------------------------------------------------------------------------

CREATE TABLE public.menaje_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','confirmado','devuelto','cancelado')),
  notas text
);

CREATE TABLE public.menaje_reserva_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid NOT NULL REFERENCES public.menaje_reservas(id) ON DELETE CASCADE,
  menaje_id uuid NOT NULL REFERENCES public.menaje_catalogo(id) ON DELETE RESTRICT,
  cantidad integer NOT NULL CHECK (cantidad > 0)
);

CREATE TABLE public.menaje_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  evento_id uuid REFERENCES public.eventos(id) ON DELETE SET NULL,
  reserva_id uuid REFERENCES public.menaje_reservas(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('salida','ingreso')),
  fecha date NOT NULL,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','confirmado','cancelado')),
  notas text
);

CREATE TABLE public.menaje_mov_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id uuid NOT NULL REFERENCES public.menaje_movimientos(id) ON DELETE CASCADE,
  menaje_id uuid NOT NULL REFERENCES public.menaje_catalogo(id) ON DELETE RESTRICT,
  cantidad integer NOT NULL CHECK (cantidad >= 0),
  merma integer NOT NULL DEFAULT 0 CHECK (merma >= 0),
  nota text
);

-- ----------------------------------------------------------------------------
-- 5. Inventario (insumos) & transporte orders
-- ----------------------------------------------------------------------------

CREATE TABLE public.inventario_movimientos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL CHECK (tipo IN ('compra','uso','ajuste','devolucion')),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','confirmado','cancelado')),
  evento_id uuid REFERENCES public.eventos(id),
  proveedor text,
  notas text,
  factura_url text
);

CREATE TABLE public.inventario_mov_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movimiento_id uuid NOT NULL REFERENCES public.inventario_movimientos(id) ON DELETE CASCADE,
  ingrediente_id uuid NOT NULL REFERENCES public.ingredientes_catalogo(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL CHECK (cantidad > 0),
  costo_unitario numeric DEFAULT 0
);

CREATE TABLE public.transporte_ordenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','programado','finalizado','cancelado')),
  pickup_nombre text,
  pickup_direccion text,
  descripcion_carga text,
  destino_direccion text,
  hora_recepcion_inicio time,
  hora_recogida_inicio time,
  contacto_nombre text,
  contacto_telefono text,
  vehiculo text,
  notas text,
  hora_recepcion_fin time,
  hora_recogida_fin time
);

-- ----------------------------------------------------------------------------
-- 6. Pagos personal
-- ----------------------------------------------------------------------------

CREATE TABLE public.registro_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empleado_id uuid NOT NULL REFERENCES public.personal(id) ON DELETE CASCADE,
  fecha_pago date NOT NULL,
  tipo_liquidacion varchar(20) NOT NULL
    CHECK (tipo_liquidacion IN ('evento','multiple')),
  monto_total numeric(10,2) NOT NULL,
  metodo_pago varchar(50) NOT NULL,
  notas text,
  usuario_liquidador varchar(100),
  numero_comprobante varchar(50) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_registro_pagos_empleado_id ON public.registro_pagos(empleado_id);
CREATE INDEX idx_registro_pagos_fecha_pago ON public.registro_pagos(fecha_pago);
CREATE INDEX idx_registro_pagos_numero_comprobante ON public.registro_pagos(numero_comprobante);

CREATE TABLE public.registro_pago_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_pago_id uuid NOT NULL REFERENCES public.registro_pagos(id) ON DELETE CASCADE,
  evento_id uuid NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
  horas_trabajadas numeric(4,2) NOT NULL,
  monto_evento numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_registro_pago_eventos_evento_id ON public.registro_pago_eventos(evento_id);
CREATE INDEX idx_registro_pago_eventos_registro_id ON public.registro_pago_eventos(registro_pago_id);

-- ----------------------------------------------------------------------------
-- 7. Views
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_menaje_reservas_cal AS
  SELECT
    r.id AS reserva_id,
    r.evento_id,
    e.nombre_evento,
    r.fecha_inicio,
    r.fecha_fin,
    r.estado,
    json_agg(
      json_build_object('menaje_id', ri.menaje_id, 'cantidad', ri.cantidad)
      ORDER BY ri.menaje_id
    ) AS items
  FROM public.menaje_reservas r
  JOIN public.eventos e ON e.id = r.evento_id
  LEFT JOIN public.menaje_reserva_items ri ON ri.reserva_id = r.id
  GROUP BY r.id, r.evento_id, e.nombre_evento, r.fecha_inicio, r.fecha_fin, r.estado;

-- ----------------------------------------------------------------------------
-- 8. Functions
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at_menaje_mov()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at_menaje_reservas()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at_transporte_orden()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_evento_ubicacion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ubicacion_evento IS DISTINCT FROM NEW.ubicacion_evento THEN
    UPDATE public.eventos
      SET ubicacion = NEW.ubicacion_evento,
          updated_at = now()
      FROM public.cotizacion_versiones cv
      WHERE eventos.cotizacion_version_id = cv.id
        AND cv.cotizacion_id = NEW.id
        AND NEW.ubicacion_evento IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_merma_on_confirm()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  mov record;
  it record;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF (NEW.estado = 'confirmado' AND OLD.estado <> 'confirmado') THEN
      SELECT * INTO mov FROM public.menaje_movimientos WHERE id = NEW.id;
      IF mov.tipo = 'ingreso' THEN
        FOR it IN
          SELECT mi.menaje_id, mi.merma
          FROM public.menaje_mov_items mi
          WHERE mi.movimiento_id = mov.id
        LOOP
          IF it.merma > 0 THEN
            UPDATE public.menaje_catalogo
              SET stock_total = greatest(0, stock_total - it.merma)
              WHERE id = it.menaje_id;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_comprobante_number()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  fecha_actual DATE := CURRENT_DATE;
  contador INTEGER;
  numero_comprobante TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(numero_comprobante FROM '.*-(\d+)$') AS INTEGER)
  ), 0) + 1
  INTO contador
  FROM public.registro_pagos
  WHERE numero_comprobante LIKE 'TXN-' || TO_CHAR(fecha_actual, 'YYYYMMDD') || '-%';

  numero_comprobante := 'TXN-' || TO_CHAR(fecha_actual, 'YYYYMMDD') || '-' || LPAD(contador::TEXT, 3, '0');
  RETURN numero_comprobante;
END;
$$;

CREATE OR REPLACE FUNCTION public.cotizacion_has_active_share(cot_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cotizacion_share_tokens
    WHERE cotizacion_id = cot_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.fn_menaje_disponible(_inicio date, _fin date)
RETURNS TABLE(
  id uuid, nombre text, categoria text, unidad text,
  stock_total integer, reservado integer, disponible integer
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
    SELECT
      m.id, m.nombre, m.categoria, m.unidad, m.stock_total::int,
      COALESCE((
        SELECT sum(ri.cantidad)::int
        FROM public.menaje_reservas r
        JOIN public.menaje_reserva_items ri ON ri.reserva_id = r.id
        WHERE ri.menaje_id = m.id
          AND r.estado IN ('borrador','confirmado')
          AND daterange(r.fecha_inicio, r.fecha_fin, '[]') && daterange(_inicio, _fin, '[]')
      ), 0)::int,
      (
        m.stock_total::int
        - COALESCE((
            SELECT sum(ri.cantidad)::int
            FROM public.menaje_reservas r
            JOIN public.menaje_reserva_items ri ON ri.reserva_id = r.id
            WHERE ri.menaje_id = m.id
              AND r.estado IN ('borrador','confirmado')
              AND daterange(r.fecha_inicio, r.fecha_fin, '[]') && daterange(_inicio, _fin, '[]')
          ), 0)::int
      )::int
    FROM public.menaje_catalogo m
    WHERE m.activo = true
    ORDER BY m.categoria, m.nombre;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Triggers
-- ----------------------------------------------------------------------------

CREATE TRIGGER update_cotizaciones_updated_at
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_sync_evento_ubicacion
  AFTER UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.sync_evento_ubicacion();

CREATE TRIGGER trg_cotver_updated
  BEFORE UPDATE ON public.cotizacion_versiones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER update_eventos_updated_at
  BEFORE UPDATE ON public.eventos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_personal_updated_at
  BEFORE UPDATE ON public.personal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_updated_at_menaje_reservas
  BEFORE UPDATE ON public.menaje_reservas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_menaje_reservas();

CREATE TRIGGER trg_updated_at_menaje_mov
  BEFORE UPDATE ON public.menaje_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_menaje_mov();

CREATE TRIGGER trg_apply_merma_on_confirm
  AFTER UPDATE ON public.menaje_movimientos
  FOR EACH ROW EXECUTE FUNCTION public.apply_merma_on_confirm();

CREATE TRIGGER trg_updated_at_transporte_orden
  BEFORE UPDATE ON public.transporte_ordenes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_transporte_orden();

-- ----------------------------------------------------------------------------
-- 10. Row Level Security
--
-- All tables below have RLS enabled EXCEPT public.cotizacion_lugares (which is
-- left disabled in the real DB — see AUDIT_PASO_1.md item S1).
--
-- Policy style observations:
--   * Every policy that targets `authenticated` uses USING (true) — no
--     per-user filtering. Any logged-in user can read/write any row.
--   * Many policies were created TO PUBLIC but gated via
--     auth.role() = 'authenticated' in the USING expression — equivalent
--     effect but leaks RLS through to anon when the check returns false.
--   * `Anon read shared *` policies on cotizacion_* delegate to
--     cotizacion_has_active_share() — the only non-trivial rule in the set.
-- ----------------------------------------------------------------------------

ALTER TABLE public.clientes                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_contactos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizaciones                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_versiones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_share_tokens        ENABLE ROW LEVEL SECURITY;
-- Note: cotizacion_lugares intentionally left without RLS (matches real DB).
ALTER TABLE public.cotizacion_platos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_personal_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_personal_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_transporte_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_menaje_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platos_catalogo                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_costos_catalogo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transporte_tarifas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lugares_catalogo               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menaje_catalogo                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menaje_reservas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menaje_reserva_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menaje_movimientos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menaje_mov_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_movimientos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_mov_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredientes_catalogo          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingrediente_proveedores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plato_ingredientes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_personal                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_requerimiento_platos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_requerimiento_personal  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_requerimiento_transporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_requerimiento_menaje    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_orden_compra            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evento_orden_compra_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transporte_ordenes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_pagos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_pago_eventos          ENABLE ROW LEVEL SECURITY;

-- Clientes
CREATE POLICY "Auth users can CRUD clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read clientes shared"    ON public.clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Auth users can CRUD cliente_contactos" ON public.cliente_contactos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read contactos shared"           ON public.cliente_contactos FOR SELECT TO anon USING (true);

-- Cotizaciones
CREATE POLICY "Cotizaciones accesibles para usuarios autenticados" ON public.cotizaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth select cotizaciones" ON public.cotizaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cotizaciones" ON public.cotizaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cotizaciones" ON public.cotizaciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cotizaciones" ON public.cotizaciones FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon read shared cotizaciones" ON public.cotizaciones FOR SELECT TO anon USING (public.cotizacion_has_active_share(id));

CREATE POLICY "auth select cotizacion_versiones" ON public.cotizacion_versiones FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cotizacion_versiones" ON public.cotizacion_versiones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cotizacion_versiones" ON public.cotizacion_versiones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cotizacion_versiones" ON public.cotizacion_versiones FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon read shared versiones" ON public.cotizacion_versiones FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

CREATE POLICY "Auth users manage share tokens"   ON public.cotizacion_share_tokens FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read active share tokens"    ON public.cotizacion_share_tokens FOR SELECT TO anon USING (is_active = true);

CREATE POLICY "Items de cotizacion (platos) accesibles" ON public.cotizacion_platos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth select cotizacion_platos" ON public.cotizacion_platos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cotizacion_platos" ON public.cotizacion_platos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cotizacion_platos" ON public.cotizacion_platos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cotizacion_platos" ON public.cotizacion_platos FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon read shared platos" ON public.cotizacion_platos FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

CREATE POLICY "auth select cotizacion_personal_items" ON public.cotizacion_personal_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cotizacion_personal_items" ON public.cotizacion_personal_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cotizacion_personal_items" ON public.cotizacion_personal_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cotizacion_personal_items" ON public.cotizacion_personal_items FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon read shared personal" ON public.cotizacion_personal_items FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

CREATE POLICY "Items de cotizacion (transporte) accesibles" ON public.cotizacion_transporte_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth select cotizacion_transporte_items" ON public.cotizacion_transporte_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cotizacion_transporte_items" ON public.cotizacion_transporte_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cotizacion_transporte_items" ON public.cotizacion_transporte_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete cotizacion_transporte_items" ON public.cotizacion_transporte_items FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon read shared transporte" ON public.cotizacion_transporte_items FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

CREATE POLICY "Authenticated users full access" ON public.cotizacion_menaje_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Anon read shared menaje" ON public.cotizacion_menaje_items FOR SELECT TO anon USING (public.cotizacion_has_active_share(cotizacion_id));

CREATE POLICY "Authenticated users full access" ON public.cotizacion_personal_asignaciones FOR ALL USING (auth.role() = 'authenticated');

-- Catálogos
CREATE POLICY "Catalogo de platos accesible para usuarios autenticados" ON public.platos_catalogo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read platos catalogo"                               ON public.platos_catalogo FOR SELECT TO anon USING (true);
CREATE POLICY "Catalogo de costos de personal accesible" ON public.personal_costos_catalogo FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read personal costos"               ON public.personal_costos_catalogo FOR SELECT TO anon USING (true);
CREATE POLICY "Personal accesible para usuarios autenticados" ON public.personal FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Tarifas de transporte accesibles para usuarios autenticados" ON public.transporte_tarifas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon read transporte tarifas" ON public.transporte_tarifas FOR SELECT TO anon USING (true);
CREATE POLICY "Auth CRUD on lugares_catalogo" ON public.lugares_catalogo FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Menaje
CREATE POLICY "menaje_catalogo_select" ON public.menaje_catalogo FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "menaje_catalogo_write"  ON public.menaje_catalogo FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Anon read menaje catalogo" ON public.menaje_catalogo FOR SELECT TO anon USING (true);
CREATE POLICY "menaje_reservas_crud"      ON public.menaje_reservas FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "menaje_reserva_items_crud" ON public.menaje_reserva_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "menaje_movimientos_crud"   ON public.menaje_movimientos FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "menaje_mov_items_crud"     ON public.menaje_mov_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Inventario / Recetario
CREATE POLICY "Authenticated users full access" ON public.inventario_movimientos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON public.inventario_mov_items   FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated"     ON public.ingredientes_catalogo  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated"     ON public.ingrediente_proveedores FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated"     ON public.plato_ingredientes     FOR ALL USING (true) WITH CHECK (true);

-- Eventos
CREATE POLICY "Eventos accesible para usuarios autenticados" ON public.eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all eventos"                             ON public.eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Evento_personal accesible para usuarios autenticados" ON public.evento_personal FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all er_platos" ON public.evento_requerimiento_platos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all er_pers"   ON public.evento_requerimiento_personal FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth all er_trans"  ON public.evento_requerimiento_transporte FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_full"          ON public.evento_requerimiento_menaje FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_full"          ON public.evento_orden_compra FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth_full"          ON public.evento_orden_compra_items FOR ALL USING (auth.role() = 'authenticated');

-- Transporte órdenes
CREATE POLICY "transporte_ordenes_crud" ON public.transporte_ordenes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Pagos
CREATE POLICY "Registro de pagos accesible para usuarios autenticados"  ON public.registro_pagos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Registro pago eventos accesible para usuarios autenticados" ON public.registro_pago_eventos FOR ALL USING (true) WITH CHECK (true);
