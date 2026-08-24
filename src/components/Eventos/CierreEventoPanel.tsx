import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Loader2,
} from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PanelHeader } from "@/components/Layout/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { getReporteFacturacion } from "@/integrations/supabase/apiFacturacionEvento";
import { generateReporteFacturacionPDF } from "@/lib/reporte-facturacion-pdf";

/**
 * Cierre del evento: el reporte para emitir la factura.
 *
 * Antes este panel comparaba "cotizado vs costo real" y sumaba
 * `evento_requerimiento_menaje.subtotal` dentro del costo — pero ese subtotal es
 * el ALQUILER que paga el cliente, o sea un ingreso, no un costo. El "costo
 * real" salía inflado. Los costos ya los calcula bien el panel de Rentabilidad
 * (que usa el recetario y los pagos reales al personal), así que esa cuenta se
 * quitó de acá en vez de arrastrar un número equivocado en dos pantallas.
 *
 * Lo que queda es lo que pidió el cliente: cuánto se le cobró, cuánto hay que
 * sumarle por menaje roto o no devuelto, y el detalle para poder sustentarlo.
 * Todo sale de `fn_reporte_facturacion_evento`; acá no se suma nada.
 */

type Props = {
  eventoId: string;
};

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(Math.round(n || 0));

export default function CierreEventoPanel({ eventoId }: Props) {
  const { toast } = useToast();
  const [descargando, setDescargando] = useState(false);

  const { data: r, isLoading, error } = useQuery({
    queryKey: ["reporte-facturacion", eventoId],
    queryFn: () => getReporteFacturacion(eventoId),
  });

  const descargar = useMutation({
    mutationFn: async () => {
      setDescargando(true);
      await generateReporteFacturacionPDF(r!);
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo generar el PDF", description: e.message, variant: "destructive" }),
    onSettled: () => setDescargando(false),
  });

  if (isLoading) return <Skeleton className="h-72 w-full" />;

  if (error || !r) {
    return (
      <Card className="p-6">
        <p className="text-sm text-destructive">
          No se pudo cargar el reporte: {error instanceof Error ? error.message : "error desconocido"}
        </p>
      </Card>
    );
  }

  const perdidas = r.menaje.filter((m) => m.merma + m.faltante > 0);

  return (
    <div className="space-y-5">
      <PanelHeader
        kicker="Operación"
        title="Cierre del evento"
        description="Lo que hay que facturar: lo cotizado más el menaje que no volvió."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={descargando}
            onClick={() => descargar.mutate()}
          >
            {descargando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descargar PDF
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="kicker mb-1 text-muted-foreground">Cotizado al cliente</p>
          <p className="text-xl font-semibold tabular-nums">{money(r.cotizado)}</p>
        </Card>
        <Card className="p-4">
          <p className="kicker mb-1 text-muted-foreground">Menaje no devuelto</p>
          <p
            className={`text-xl font-semibold tabular-nums ${
              r.menaje_perdido > 0 ? "text-warning" : "text-muted-foreground"
            }`}
          >
            {r.menaje_perdido > 0 ? `+ ${money(r.menaje_perdido)}` : money(0)}
          </p>
        </Card>
        <Card className="border-primary/40 bg-primary/5 p-4">
          <p className="kicker mb-1 text-primary">Total a facturar</p>
          <p className="text-xl font-semibold tabular-nums text-primary">
            {money(r.total_a_facturar)}
          </p>
        </Card>
      </div>

      {/* Un reporte incompleto que no lo dice es peor que no tener reporte:
          se factura de menos y nadie se entera. */}
      {(!r.estado.hubo_despacho ||
        !r.estado.hubo_devolucion ||
        r.estado.sin_costo_reposicion) && (
        <div className="flex gap-3 rounded-r-sm border-l-[3px] border-warning bg-warning/5 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
          <ul className="space-y-1 text-[15px] leading-relaxed">
            {!r.estado.hubo_despacho && (
              <li>No hay despacho de menaje registrado para este evento.</li>
            )}
            {r.estado.hubo_despacho && !r.estado.hubo_devolucion && (
              <li>
                El menaje todavía no se ha devuelto — las pérdidas pueden cambiar y este total
                aún no es definitivo.
              </li>
            )}
            {r.estado.sin_costo_reposicion && (
              <li>
                Hay artículos perdidos <strong className="font-semibold">sin costo de reposición</strong>{" "}
                cargado: el total está subestimado. Cárgalo en Menaje → Inventario.
              </li>
            )}
          </ul>
        </div>
      )}

      {r.menaje.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h4 className="kicker text-muted-foreground">
              Menaje del evento
              {perdidas.length > 0 && ` · ${perdidas.length} con pérdidas`}
            </h4>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Artículo</TableHead>
                  <TableHead className="text-right">Salió</TableHead>
                  <TableHead className="text-right">Volvió</TableHead>
                  <TableHead className="text-right">Roto</TableHead>
                  <TableHead className="text-right">Falta</TableHead>
                  <TableHead className="text-right">Reposición</TableHead>
                  <TableHead className="text-right">A cobrar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.menaje.map((m) => {
                  const perdido = m.merma + m.faltante;
                  return (
                    <TableRow key={m.menaje_id}>
                      <TableCell>
                        <div className="font-medium">{m.nombre}</div>
                        {m.notas && (
                          <div className="text-xs text-muted-foreground">{m.notas}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{m.despachado}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.devuelto}</TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${m.merma > 0 ? "text-destructive" : "text-slate-300"}`}
                      >
                        {m.merma || "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${m.faltante > 0 ? "text-destructive" : "text-slate-300"}`}
                      >
                        {m.faltante || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {m.costo_reposicion > 0 ? (
                          money(m.costo_reposicion)
                        ) : perdido > 0 ? (
                          <span className="text-warning">sin cargar</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {m.valor_perdido > 0 ? money(m.valor_perdido) : <span className="text-slate-300">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <h4 className="kicker mb-3 text-muted-foreground">Estado de cierre</h4>
        <div className="space-y-2">
          <Fila etiqueta="Menaje devuelto" listo={r.estado.hubo_devolucion} textoListo="Devuelto" />
          <Fila
            etiqueta="Personal liquidado"
            listo={r.evento?.estado_liquidacion === "liquidado"}
            textoListo="Liquidado"
          />
          <Fila etiqueta="Factura emitida" listo={r.estado.ya_facturado} textoListo="Facturado" />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Los costos del evento y el margen están en la pestaña de Rentabilidad.
        </p>
      </Card>
    </div>
  );
}

function Fila({
  etiqueta,
  listo,
  textoListo,
}: {
  etiqueta: string;
  listo: boolean;
  textoListo: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{etiqueta}</span>
      {listo ? (
        <Badge variant="default" className="font-normal">
          <CheckCircle className="mr-1 h-3 w-3" />
          {textoListo}
        </Badge>
      ) : (
        <Badge variant="outline" className="border-warning-soft font-normal text-warning">
          <Clock className="mr-1 h-3 w-3" />
          Pendiente
        </Badge>
      )}
    </div>
  );
}
