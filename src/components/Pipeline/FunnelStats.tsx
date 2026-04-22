import { useMemo } from "react";
import { Clock, Send, Trophy, XCircle, type LucideIcon } from "lucide-react";
import type { Cotizacion } from "@/types/cotizador";
import { cn } from "@/lib/utils";

type StageTone = "neutral" | "primary" | "destructive" | "warning";

type Stage = {
  key: Cotizacion["estado"] | "Pendiente por Aprobación" | "Enviada" | "Cotización Aprobada" | "Rechazada";
  label: string;
  tone: StageTone;
  icon: LucideIcon;
};

const STAGES: Stage[] = [
  { key: "Pendiente por Aprobación", label: "Pendientes", tone: "warning", icon: Clock },
  { key: "Enviada", label: "Enviadas", tone: "neutral", icon: Send },
  { key: "Cotización Aprobada", label: "Ganadas", tone: "primary", icon: Trophy },
  { key: "Rechazada", label: "Perdidas", tone: "destructive", icon: XCircle },
];

const TONE_TEXT: Record<StageTone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  warning: "text-[hsl(30_55%_42%)]",
  destructive: "text-destructive",
};

const TONE_BAR: Record<StageTone, string> = {
  neutral: "bg-foreground/70",
  primary: "bg-primary",
  warning: "bg-[hsl(30_55%_42%)]",
  destructive: "bg-destructive",
};

type Props = { cotizaciones: Cotizacion[] };

export function FunnelStats({ cotizaciones }: Props) {
  const stats = useMemo(() => {
    const grouped = STAGES.map((s) => {
      const items = cotizaciones.filter((c) => c.estado === s.key);
      return {
        ...s,
        count: items.length,
        total: items.reduce((sum, c) => sum + c.total_cotizado, 0),
      };
    });

    const maxCount = Math.max(...grouped.map((g) => g.count), 1);

    const pendientes = grouped[0].count;
    const enviadas = grouped[1].count;
    const ganadas = grouped[2].count;
    const perdidas = grouped[3].count;
    const denomEnvio = pendientes + enviadas + ganadas;
    const tasaEnvio = denomEnvio > 0 ? ((enviadas + ganadas) / denomEnvio) * 100 : 0;
    const denomWin = ganadas + perdidas;
    const winRate = denomWin > 0 ? (ganadas / denomWin) * 100 : 0;

    return { grouped, maxCount, tasaEnvio, winRate };
  }, [cotizaciones]);

  const formatCOP = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
    return `$${val.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-6 md:grid-cols-4">
        {stats.grouped.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.key}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[s.tone])} strokeWidth={1.75} />
                <span className="kicker">{s.label}</span>
              </div>
              <div
                className={cn(
                  "font-serif text-[40px] leading-none tracking-[-0.025em] tabular-nums md:text-[48px]",
                  TONE_TEXT[s.tone]
                )}
              >
                {s.count}
              </div>
              <div className="mt-2 text-[11.5px] tabular-nums text-muted-foreground">
                {formatCOP(s.total)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Funnel bars */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="kicker">Embudo</span>
          <div className="flex items-center gap-4 text-[11.5px] tabular-nums text-muted-foreground">
            <span>
              Tasa de envío{" "}
              <span className="font-medium text-foreground">{stats.tasaEnvio.toFixed(0)}%</span>
            </span>
            <span className="h-3 w-px bg-border" />
            <span>
              Win rate{" "}
              <span className="font-medium text-primary">{stats.winRate.toFixed(0)}%</span>
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {stats.grouped.map((s) => {
            const pct = (s.count / stats.maxCount) * 100;
            return (
              <div key={s.key} className="flex items-center gap-4">
                <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {s.label}
                </span>
                <div className="relative flex-1">
                  <div
                    className={cn(
                      "h-6 rounded-sm transition-all duration-500",
                      TONE_BAR[s.tone],
                      s.count === 0 && "opacity-30"
                    )}
                    style={{ width: `${Math.max(pct, s.count > 0 ? 4 : 2)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-serif text-[15px] tabular-nums text-foreground">
                  {s.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
