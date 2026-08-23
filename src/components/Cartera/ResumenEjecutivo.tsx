import { AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { KPI } from "@/components/Layout/PageHeader";
import { TRAMOS, TRAMO_LABEL, type ResumenCartera } from "@/types/cartera";
import { money, pct } from "./formato";

/**
 * Réplica de la hoja «Resumen Ejecutivo» de la planilla del cliente.
 *
 * Se respeta su estructura a propósito: es el reporte que ya leen y del que ya
 * discuten los números. Cambiarles la forma en el primer contacto con el módulo
 * solo agrega ruido a la conversación de si los datos están bien.
 */

interface Props {
  resumen: ResumenCartera;
}

export default function ResumenEjecutivo({ resumen }: Props) {
  const t = resumen.totales;
  const porTramo = new Map(resumen.composicion.map((c) => [c.tramo, c.valor]));
  const maximo = Math.max(1, ...resumen.composicion.map((c) => c.valor));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-6 lg:grid-cols-4">
        <KPI kicker="Cartera total" value={money(t.cartera_total)} hint={`${t.facturas} facturas · ${t.clientes} clientes`} />
        <KPI kicker="Corriente / por vencer" value={money(t.corriente)} hint={pct(t.pct_corriente)} />
        <KPI
          kicker="Vencida total"
          value={money(t.vencida)}
          hint={pct(t.pct_vencida)}
          tone={t.pct_vencida > 0.4 ? "warning" : undefined}
        />
        <KPI
          kicker="Vencida > 60 días"
          value={money(t.critica)}
          hint={`${pct(t.pct_critica)} · ${t.clientes_criticos} clientes en riesgo`}
          tone={t.critica > 0 ? "destructive" : undefined}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="kicker mb-5">Composición por tramo de edad</h3>
          <div className="space-y-3">
            {TRAMOS.map((tramo) => {
              const valor = porTramo.get(tramo) ?? 0;
              const share = t.cartera_total > 0 ? valor / t.cartera_total : 0;
              return (
                <div key={tramo} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-4">
                  <span className="text-sm text-muted-foreground">{TRAMO_LABEL[tramo]}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${tramo === "corriente" ? "bg-primary" : "bg-warning"}`}
                      style={{ width: `${(valor / maximo) * 100}%` }}
                    />
                  </div>
                  <span className="w-44 text-right text-sm tabular-nums">
                    {money(valor)}
                    <span className="ml-2 text-xs text-muted-foreground">{pct(share)}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {t.critica > 0 && (
        <div className="flex gap-3 rounded-r-sm border-l-[3px] border-destructive bg-destructive/5 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" strokeWidth={1.75} />
          <p className="text-[15px] leading-relaxed">
            <strong className="font-semibold">{money(t.critica)}</strong> lleva más de 60 días
            vencido, repartido en <strong className="font-semibold">{t.clientes_criticos} clientes</strong>.
            Es {pct(t.pct_critica)} de la cartera y es la plata que más difícil se vuelve de
            recuperar con cada mes que pasa.
          </p>
        </div>
      )}
    </div>
  );
}
