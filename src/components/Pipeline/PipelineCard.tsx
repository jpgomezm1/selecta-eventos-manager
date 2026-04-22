import { Button } from "@/components/ui/button";
import { Send, XCircle, RotateCcw, Check, Calendar, Building2, User } from "lucide-react";
import type { Cotizacion } from "@/types/cotizador";
import { formatLocalDate } from "@/lib/dateLocal";
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
    <article className="group rounded-md border border-border bg-card px-3 py-3 transition-colors hover:border-primary/40 hover:bg-accent/30">
      {/* Name */}
      <button
        onClick={onAbrir}
        className="block w-full text-left font-serif text-[14px] leading-snug tracking-tight text-foreground transition-colors hover:text-primary"
      >
        {c.nombre_cotizacion}
      </button>

      {/* Cliente */}
      <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        {clienteTipo === "empresa" ? (
          <Building2 className="h-3 w-3 shrink-0" strokeWidth={1.75} />
        ) : (
          <User className="h-3 w-3 shrink-0" strokeWidth={1.75} />
        )}
        <span className="truncate">{clienteName}</span>
      </div>

      {c.comercial_encargado && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          <span className="italic">por</span> {c.comercial_encargado}
        </div>
      )}

      {c.fecha_evento_estimada && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" strokeWidth={1.75} />
          <span className="capitalize tabular-nums">
            {formatLocalDate(c.fecha_evento_estimada, "es-CO", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
      )}

      {/* Total */}
      <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Total
        </span>
        <span className="font-serif text-[15px] leading-none tracking-tight tabular-nums text-foreground">
          ${c.total_cotizado.toLocaleString()}
        </span>
      </div>

      {/* Motivo rechazo */}
      {c.estado === "Rechazada" && c.motivo_rechazo && (
        <div className="mt-2 rounded-sm border border-destructive/30 bg-destructive/5 px-2 py-1 text-[11px] italic text-destructive">
          {c.motivo_rechazo}
        </div>
      )}

      {/* Actions */}
      {(onMarcarEnviada || onRechazar || onReabrir) && (
        <div className="mt-3 flex flex-wrap items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
          {c.estado === "Pendiente por Aprobación" && onMarcarEnviada && (
            <PipelineAction onClick={onMarcarEnviada} icon={Send} label="Enviar" />
          )}
          {c.estado === "Enviada" && (
            <PipelineAction onClick={onAbrir} icon={Check} label="Aprobar" tone="primary" />
          )}
          {(c.estado === "Pendiente por Aprobación" || c.estado === "Enviada") && onRechazar && (
            <PipelineAction onClick={onRechazar} icon={XCircle} label="Rechazar" tone="destructive" />
          )}
          {c.estado === "Rechazada" && onReabrir && (
            <PipelineAction onClick={onReabrir} icon={RotateCcw} label="Reabrir" />
          )}
        </div>
      )}
    </article>
  );
}

function PipelineAction({
  onClick,
  icon: Icon,
  label,
  tone = "neutral",
}: {
  onClick: () => void;
  icon: typeof Send;
  label: string;
  tone?: "neutral" | "primary" | "destructive";
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-7 gap-1 px-2 text-[11px] font-medium",
        tone === "primary" && "text-primary hover:bg-primary/10 hover:text-primary",
        tone === "destructive" && "text-destructive hover:bg-destructive/10 hover:text-destructive",
        tone === "neutral" && "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={1.75} />
      {label}
    </Button>
  );
}
