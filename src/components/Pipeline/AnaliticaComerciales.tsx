import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import type { Cotizacion } from "@/types/cotizador";
import {
  calcularMetricasComerciales,
  calcularMotivosRechazo,
  DIAS_ALERTA_SIN_ENVIAR,
} from "@/lib/analiticaComercial";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = { cotizaciones: Cotizacion[] };

const formatCOP = (val: number) => {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString("es-CO")}`;
};

const formatDias = (dias: number | null) =>
  dias === null ? "—" : `${dias.toFixed(1)} d`;

export function AnaliticaComerciales({ cotizaciones }: Props) {
  const metricas = useMemo(() => calcularMetricasComerciales(cotizaciones), [cotizaciones]);
  const motivos = useMemo(() => calcularMotivosRechazo(cotizaciones), [cotizaciones]);

  const totalSinEnviar = metricas.reduce((s, m) => s + m.sinEnviarHace, 0);

  if (metricas.length === 0) {
    return (
      <p className="py-12 text-center text-sm italic text-muted-foreground">
        Todavía no hay cotizaciones para analizar.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {totalSinEnviar > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
          <div className="text-sm">
            <span className="font-medium">
              {totalSinEnviar} cotización{totalSinEnviar === 1 ? "" : "es"} sin enviar
            </span>{" "}
            <span className="text-muted-foreground">
              después de {DIAS_ALERTA_SIN_ENVIAR} días desde que se crearon.
            </span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comercial</TableHead>
              <TableHead className="text-right">Cotizaciones</TableHead>
              <TableHead className="text-right">Ganadas</TableHead>
              <TableHead className="text-right">Perdidas</TableHead>
              <TableHead className="text-right">Win rate</TableHead>
              <TableHead className="text-right">Valor ganado</TableHead>
              <TableHead className="text-right">Días a enviar</TableHead>
              <TableHead className="text-right">Días a cerrar</TableHead>
              <TableHead className="text-right">Sin enviar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metricas.map((m) => (
              <TableRow key={m.comercial}>
                <TableCell>
                  <div className="font-medium">{m.comercial}</div>
                  {m.motivoTop && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Pierde sobre todo por: {m.motivoTop.motivo}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.total}
                  <div className="text-xs text-muted-foreground">
                    {formatCOP(m.valorCotizado)}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-primary">{m.ganadas}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {m.perdidas}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.winRate === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={cn(
                        "font-medium",
                        m.winRate >= 50 ? "text-primary" : m.winRate < 25 ? "text-destructive" : ""
                      )}
                    >
                      {m.winRate.toFixed(0)}%
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCOP(m.valorGanado)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatDias(m.diasPromedioEnvio)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatDias(m.diasPromedioCierre)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.sinEnviarHace > 0 ? (
                    <Badge variant="destructive">{m.sinEnviarHace}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        «Días a enviar» es el tiempo entre crear la cotización y marcarla como enviada. «Días a
        cerrar», entre enviarla y aprobarla o rechazarla. Las cotizaciones que aún no llegaron a
        ese paso no entran en el promedio.
      </p>

      {motivos.length > 0 && (
        <div>
          <h3 className="kicker mb-4">Por qué se pierden</h3>
          <div className="space-y-2">
            {motivos.map((m) => (
              <div
                key={m.motivo}
                className="flex items-center justify-between gap-4 border-b border-border pb-2 text-sm last:border-0"
              >
                <span>{m.motivo}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {m.veces}× · {formatCOP(m.valorPerdido)} perdidos
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
