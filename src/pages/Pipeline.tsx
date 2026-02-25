import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listCotizaciones, marcarCotizacionEnviada, rechazarCotizacion, reabrirCotizacion } from "@/integrations/supabase/apiCotizador";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { FunnelStats } from "@/components/Pipeline/FunnelStats";
import { PipelineBoard } from "@/components/Pipeline/PipelineBoard";
import { RechazoDialog } from "@/components/Pipeline/RechazoDialog";

export default function PipelinePage() {
  const nav = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [rechazoDialog, setRechazoDialog] = useState<{ open: boolean; cotizacionId: string; cotizacionName: string }>({
    open: false,
    cotizacionId: "",
    cotizacionName: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["cotizaciones"],
    queryFn: listCotizaciones,
  });

  const enviarMutation = useMutation({
    mutationFn: marcarCotizacionEnviada,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      toast({ title: "Cotización marcada como Enviada", description: "Se registró la fecha de envío." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo marcar como enviada.", variant: "destructive" });
    },
  });

  const rechazarMutation = useMutation({
    mutationFn: ({ id, motivo, notas }: { id: string; motivo: string; notas: string | null }) =>
      rechazarCotizacion(id, motivo, notas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      setRechazoDialog({ open: false, cotizacionId: "", cotizacionName: "" });
      toast({ title: "Cotización rechazada", description: "Se registró el motivo de rechazo." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo rechazar la cotización.", variant: "destructive" });
    },
  });

  const reabrirMutation = useMutation({
    mutationFn: reabrirCotizacion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cotizaciones"] });
      toast({ title: "Cotización reabierta", description: "Vuelve al estado Pendiente por Aprobación." });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo reabrir la cotización.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-selecta-green rounded-full animate-spin" />
          <p className="text-slate-500">Cargando pipeline...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Error al cargar pipeline</h3>
          <p className="text-slate-500">No se pudieron obtener las cotizaciones</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  const cotizaciones = data ?? [];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <TrendingUp className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pipeline de Ventas</h1>
            <p className="text-slate-500 mt-1">Seguimiento del embudo de cotizaciones</p>
          </div>
        </div>
      </div>

      <FunnelStats cotizaciones={cotizaciones} />

      <PipelineBoard
        cotizaciones={cotizaciones}
        onMarcarEnviada={(id) => enviarMutation.mutate(id)}
        onRechazar={(id, nombre) => setRechazoDialog({ open: true, cotizacionId: id, cotizacionName: nombre })}
        onReabrir={(id) => reabrirMutation.mutate(id)}
        onNavigateToEditor={(id) => nav(`/cotizaciones/${id}`)}
      />

      <RechazoDialog
        open={rechazoDialog.open}
        onOpenChange={(open) => setRechazoDialog((prev) => ({ ...prev, open }))}
        cotizacionName={rechazoDialog.cotizacionName}
        onConfirm={(motivo, notas) =>
          rechazarMutation.mutate({ id: rechazoDialog.cotizacionId, motivo, notas: notas || null })
        }
        isPending={rechazarMutation.isPending}
      />
    </div>
  );
}
