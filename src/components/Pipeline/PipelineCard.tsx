import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, XCircle, RotateCcw, ExternalLink, Calendar, User, Building2, DollarSign } from "lucide-react";
import type { Cotizacion } from "@/types/cotizador";
import { cn } from "@/lib/utils";

type Props = {
  cotizacion: Cotizacion;
  onMarcarEnviada?: () => void;
  onRechazar?: () => void;
  onReabrir?: () => void;
  onAbrir: () => void;
};

export function PipelineCard({ cotizacion: c, onMarcarEnviada, onRechazar, onReabrir, onAbrir }: Props) {
  const clienteName = c.cliente?.nombre || c.cliente_nombre || "Sin cliente";
  const clienteTipo = c.cliente?.tipo;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Name */}
        <button
          onClick={onAbrir}
          className="text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors text-left line-clamp-2 w-full"
        >
          {c.nombre_cotizacion}
        </button>

        {/* Cliente */}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          {clienteTipo === "empresa" ? (
            <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          ) : (
            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          )}
          <span className="truncate font-medium">{clienteName}</span>
          {clienteTipo && (
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", clienteTipo === "empresa" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-slate-50 text-slate-500 border-slate-200")}>
              {clienteTipo === "empresa" ? "Empresa" : "Persona"}
            </Badge>
          )}
        </div>

        {/* Comercial */}
        {c.comercial_encargado && (
          <div className="text-xs text-slate-500">
            <span className="font-medium">{c.comercial_encargado}</span>
          </div>
        )}

        {/* Date */}
        {c.fecha_evento_estimada && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{new Date(c.fecha_evento_estimada).toLocaleDateString("es-CO")}</span>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center gap-1.5 p-2 bg-emerald-50 rounded-lg border border-emerald-200/60">
          <DollarSign className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-bold text-emerald-700">
            ${c.total_cotizado.toLocaleString()}
          </span>
        </div>

        {/* Motivo rechazo */}
        {c.estado === "Rechazada" && c.motivo_rechazo && (
          <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 text-xs">
            {c.motivo_rechazo}
          </Badge>
        )}

        {/* Actions by stage */}
        <div className="flex flex-wrap gap-2 pt-1">
          {c.estado === "Pendiente por Aprobación" && (
            <>
              {onMarcarEnviada && (
                <Button size="sm" variant="outline" onClick={onMarcarEnviada} className="text-xs h-7 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200">
                  <Send className="h-3 w-3 mr-1" />
                  Enviar
                </Button>
              )}
              {onRechazar && (
                <Button size="sm" variant="outline" onClick={onRechazar} className="text-xs h-7 bg-red-50 hover:bg-red-100 text-red-700 border-red-200">
                  <XCircle className="h-3 w-3 mr-1" />
                  Rechazar
                </Button>
              )}
            </>
          )}

          {c.estado === "Enviada" && (
            <>
              <Button size="sm" variant="outline" onClick={onAbrir} className="text-xs h-7 bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                <ExternalLink className="h-3 w-3 mr-1" />
                Aprobar
              </Button>
              {onRechazar && (
                <Button size="sm" variant="outline" onClick={onRechazar} className="text-xs h-7 bg-red-50 hover:bg-red-100 text-red-700 border-red-200">
                  <XCircle className="h-3 w-3 mr-1" />
                  Rechazar
                </Button>
              )}
            </>
          )}

          {c.estado === "Rechazada" && onReabrir && (
            <Button size="sm" variant="outline" onClick={onReabrir} className="text-xs h-7 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200">
              <RotateCcw className="h-3 w-3 mr-1" />
              Reabrir
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
