-- Pipeline de Ventas: columnas adicionales en cotizaciones
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS motivo_rechazo text,
  ADD COLUMN IF NOT EXISTS notas_rechazo text,
  ADD COLUMN IF NOT EXISTS fecha_envio timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_cierre timestamptz;

ALTER TABLE public.cotizaciones
  ADD CONSTRAINT chk_motivo_rechazo CHECK (
    motivo_rechazo IS NULL OR motivo_rechazo IN (
      'Precio', 'Competencia', 'Cambio de fecha', 'Cliente desistió', 'Otro'
    )
  );
