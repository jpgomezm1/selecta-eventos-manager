import { useMemo } from "react";
import { Clock, Send, Trophy, XCircle, type LucideIcon } from "lucide-react";
import { PipelineCard } from "./PipelineCard";
import type { Cotizacion } from "@/types/cotizador";
import { cn } from "@/lib/utils";

type ColumnTone = "neutral" | "primary" | "destructive" | "warning";

type Column = {
  key: Cotizacion["estado"] | "Pendiente por Aprobación" | "Enviada" | "Cotización Aprobada" | "Rechazada";
  label: string;
  tone: ColumnTone;
  icon: LucideIcon;
};

const COLUMNS: Column[] = [
  { key: "Pendiente por Aprobación", label: "Pendientes", tone: "warning", icon: Clock },
  { key: "Enviada", label: "Enviadas", tone: "neutral", icon: Send },
  { key: "Cotización Aprobada", label: "Ganadas", tone: "primary", icon: Trophy },
  { key: "Rechazada", label: "Perdidas", tone: "destructive", icon: XCircle },
];

const TONE_ACCENT: Record<ColumnTone, string> = {
  neutral: "bg-foreground/30",
  primary: "bg-primary",
  warning: "bg-[hsl(30_55%_42%)]",
  destructive: "bg-destructive",
};

const TONE_TEXT: Record<ColumnTone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  warning: "text-[hsl(30_55%_42%)]",
  destructive: "text-destructive",
};

type Props = {
  cotizaciones: Cotizacion[];
  onMarcarEnviada: (id: string) => void;
  onRechazar: (id: string, nombre: string) => void;
  onReabrir: (id: string) => void;
  onNavigateToEditor: (id: string) => void;
};

export function PipelineBoard({ cotizaciones, onMarcarEnviada, onRechazar, onReabrir, onNavigateToEditor }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, Cotizacion[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const c of cotizaciones) {
      const list = map.get(c.estado);
      if (list) list.push(c);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || "").getTime() -
          new Date(a.updated_at || a.created_at || "").getTime()
      );
    }
    return map;
  }, [cotizaciones]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = grouped.get(col.key) || [];
        const Icon = col.icon;
        return (
          <section
            key={col.key}
            className="flex flex-col overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="relative border-b border-border px-4 py-3">
              <div className={cn("absolute left-0 top-0 h-0.5 w-full", TONE_ACCENT[col.tone])} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[col.tone])} strokeWidth={1.75} />
                  <span className="kicker">{col.label}</span>
                </div>
                <span
                  className={cn(
                    "font-serif text-[15px] tabular-nums",
                    items.length > 0 ? TONE_TEXT[col.tone] : "text-muted-foreground"
                  )}
                >
                  {items.length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {items.length === 0 ? (
                <p className="py-10 text-center text-[11.5px] italic text-muted-foreground">
                  Sin cotizaciones
                </p>
              ) : (
                <div className="space-y-2.5">
                  {items.map((c) => (
                    <PipelineCard
                      key={c.id}
                      cotizacion={c}
                      onMarcarEnviada={c.estado === "Pendiente por Aprobación" ? () => onMarcarEnviada(c.id) : undefined}
                      onRechazar={c.estado === "Pendiente por Aprobación" || c.estado === "Enviada" ? () => onRechazar(c.id, c.nombre_cotizacion) : undefined}
                      onReabrir={c.estado === "Rechazada" ? () => onReabrir(c.id) : undefined}
                      onAbrir={() => onNavigateToEditor(c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
