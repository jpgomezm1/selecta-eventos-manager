import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Circle,
  ClipboardList,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { computeChecklist } from "@/lib/eventoChecklist";
import type { ChecklistData } from "@/lib/eventoChecklist";

type Props = {
  cotizacionVersionId: string;
};

async function fetchChecklistData(versionId: string) {
  // Find the event linked to this version
  const { data: evento, error: evErr } = await supabase
    .from("eventos")
    .select("id, fecha_evento, estado_liquidacion")
    .eq("cotizacion_version_id", versionId)
    .maybeSingle();

  if (evErr) throw evErr;
  if (!evento) return null;

  const eventoId = evento.id;

  const [
    { data: personalReq, error: ePersReq },
    { data: personalAsig, error: ePersAsig },
    { data: ordenCompra, error: eOrden },
    { data: menajeReserva, error: eReserva },
    { data: transporteOrden, error: eTransp },
    { data: despachoMenaje, error: eDespacho },
  ] = await Promise.all([
    supabase
      .from("evento_requerimiento_personal")
      .select("id")
      .eq("evento_id", eventoId),
    supabase
      .from("evento_personal")
      .select("id")
      .eq("evento_id", eventoId),
    supabase
      .from("evento_orden_compra")
      .select("estado")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("menaje_reservas")
      .select("estado")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transporte_ordenes")
      .select("estado")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("menaje_movimientos")
      .select("id")
      .eq("evento_id", eventoId)
      .eq("tipo", "salida")
      .eq("estado", "confirmado")
      .limit(1),
  ]);

  const firstErr = ePersReq ?? ePersAsig ?? eOrden ?? eReserva ?? eTransp ?? eDespacho;
  if (firstErr) throw firstErr;

  const checklistData: ChecklistData = {
    personalAsignadoCount: (personalAsig ?? []).length,
    personalRequeridoCount: (personalReq ?? []).length,
    ordenCompra: ordenCompra ?? null,
    menajeReserva: menajeReserva ?? null,
    transporteOrden: transporteOrden ?? null,
    fechaEvento: evento.fecha_evento,
    estadoLiquidacion: evento.estado_liquidacion ?? "",
    menajeDespachado: (despachoMenaje ?? []).length > 0,
  };

  return { eventoId, checklistData };
}

export function CotizacionChecklist({ cotizacionVersionId }: Props) {
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["cotizacion-checklist", cotizacionVersionId],
    queryFn: () => fetchChecklistData(cotizacionVersionId),
    enabled: !!cotizacionVersionId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <div className="w-5 h-5 border-2 border-slate-200 border-t-selecta-green rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { eventoId, checklistData } = data;
  const checklist = computeChecklist(checklistData);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" />
          Checklist
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">Progreso</span>
            <span className="font-bold text-slate-800">
              {checklist.completedCount}/{checklist.totalCount}
            </span>
          </div>
          <Progress value={checklist.percent} className="h-2" />
          <p className="text-xs text-slate-500">{checklist.percent}% completado</p>
        </div>

        {/* Checklist items */}
        <div className="space-y-1">
          {checklist.items.map((item) => (
            <div
              key={item.key}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
                item.completed ? "text-slate-500" : "text-slate-700"
              )}
            >
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />
              )}
              <span className={cn(item.completed && "line-through")}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Link to event */}
        <Button
          variant="outline"
          size="sm"
          className="w-full text-sm"
          onClick={() => nav(`/eventos/${eventoId}`)}
        >
          Ver evento completo
          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
