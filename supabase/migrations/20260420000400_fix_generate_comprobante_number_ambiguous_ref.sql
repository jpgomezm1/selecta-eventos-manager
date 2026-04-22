-- La función tenía una variable local 'numero_comprobante TEXT' con el mismo
-- nombre que la columna 'numero_comprobante' de la tabla registro_pagos. Eso
-- generaba "column reference is ambiguous" (Postgres 42702) al ejecutarse,
-- bloqueando todo el flujo de pago individual desde PersonalDetalle.
-- Fix: calificar la columna con la tabla en el WHERE/SELECT.
--
-- Aplicado vía mcp__supabase__apply_migration el 2026-04-20.

CREATE OR REPLACE FUNCTION public.generate_comprobante_number()
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
    fecha_actual DATE := CURRENT_DATE;
    contador INTEGER;
    numero_comprobante TEXT;
BEGIN
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(rp.numero_comprobante FROM '.*-(\d+)$') AS INTEGER
        )
    ), 0) + 1
    INTO contador
    FROM public.registro_pagos rp
    WHERE rp.numero_comprobante LIKE 'TXN-' || TO_CHAR(fecha_actual, 'YYYYMMDD') || '-%';

    numero_comprobante := 'TXN-' || TO_CHAR(fecha_actual, 'YYYYMMDD') || '-' || LPAD(contador::TEXT, 3, '0');

    RETURN numero_comprobante;
END;
$function$;
