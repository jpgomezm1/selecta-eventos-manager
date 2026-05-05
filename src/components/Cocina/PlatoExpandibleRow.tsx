import { Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  nombre: string;
  cantidad: number;
  tiempoPreparacion?: string | null;
  onOpen: () => void;
  /** Para mostrar contexto en vista consolidada — ej. "2 eventos" */
  meta?: string;
  className?: string;
}

export default function PlatoExpandibleRow({
  nombre,
  cantidad,
  tiempoPreparacion,
  onOpen,
  meta,
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium leading-tight text-foreground truncate">{nombre}</div>
        {(tiempoPreparacion || meta) && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {tiempoPreparacion && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" strokeWidth={1.75} />
                {tiempoPreparacion}
              </span>
            )}
            {meta && <span>{meta}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-serif text-[18px] tabular-nums text-foreground">×{cantidad}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
      </div>
    </button>
  );
}
