import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Send, Trophy, XCircle } from "lucide-react";
import type { Cotizacion } from "@/types/cotizador";

const STAGES = [
  { key: "Pendiente por Aprobación", label: "Pendiente", color: "bg-yellow-500", textColor: "text-yellow-700", bgLight: "bg-yellow-50", borderColor: "border-yellow-200", icon: Clock },
  { key: "Enviada", label: "Enviada", color: "bg-blue-500", textColor: "text-blue-700", bgLight: "bg-blue-50", borderColor: "border-blue-200", icon: Send },
  { key: "Cotización Aprobada", label: "Ganada", color: "bg-green-500", textColor: "text-green-700", bgLight: "bg-green-50", borderColor: "border-green-200", icon: Trophy },
  { key: "Rechazada", label: "Perdida", color: "bg-red-500", textColor: "text-red-700", bgLight: "bg-red-50", borderColor: "border-red-200", icon: XCircle },
] as const;

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

    // Tasa de envío: (enviadas+ganadas) / (pendientes+enviadas+ganadas)
    const pendientes = grouped[0].count;
    const enviadas = grouped[1].count;
    const ganadas = grouped[2].count;
    const perdidas = grouped[3].count;
    const denomEnvio = pendientes + enviadas + ganadas;
    const tasaEnvio = denomEnvio > 0 ? ((enviadas + ganadas) / denomEnvio) * 100 : 0;

    // Win rate: ganadas / (ganadas+perdidas)
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
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.grouped.map((s) => (
          <Card key={s.key} className={`border-t-4 ${s.borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bgLight}`}>
                  <s.icon className={`h-5 w-5 ${s.textColor}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{s.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{s.count}</p>
                  <p className={`text-sm font-semibold ${s.textColor}`}>{formatCOP(s.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel Bars */}
      <Card>
        <CardContent className="p-6 space-y-3">
          {stats.grouped.map((s) => (
            <div key={s.key} className="flex items-center gap-4">
              <div
                className={`h-8 rounded-md ${s.color} transition-all duration-500`}
                style={{ width: `${(s.count / stats.maxCount) * 100}%`, minWidth: s.count > 0 ? "2rem" : "0" }}
              />
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                {s.label} {s.count}
              </span>
            </div>
          ))}

          {/* Conversion rates */}
          <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Tasa de envío: {stats.tasaEnvio.toFixed(0)}%
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Win rate: {stats.winRate.toFixed(0)}%
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
