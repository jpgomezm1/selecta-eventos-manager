import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RIESGO_LABEL, type EstadoRiesgo, type ResumenCartera } from "@/types/cartera";
import { money, pct } from "./formato";

/**
 * Matriz de cartera por edades — la hoja «Cartera por Edades» de su planilla,
 * con la de «Riesgo Crítico» como un filtro en vez de una pestaña aparte: son
 * la misma tabla, y tenerlas separadas obliga a cruzar dos vistas a mano.
 *
 * El estado de riesgo lo calcula el SQL (`fn_cartera_resumen`), no este
 * componente: si la regla vive en la pantalla, un export o un PDF la contradice.
 */

interface Props {
  resumen: ResumenCartera;
}

const BADGE: Record<EstadoRiesgo, string> = {
  SANO: "bg-primary/10 text-primary",
  VIGILANCIA: "bg-warning/15 text-warning",
  CRITICO: "bg-destructive/10 text-destructive",
};

type Filtro = "todos" | EstadoRiesgo;

export default function MatrizEdades({ resumen }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const conteos = useMemo(() => {
    const c = { todos: resumen.por_cliente.length, SANO: 0, VIGILANCIA: 0, CRITICO: 0 };
    for (const f of resumen.por_cliente) c[f.estado_riesgo] += 1;
    return c;
  }, [resumen]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return resumen.por_cliente.filter((f) => {
      if (filtro !== "todos" && f.estado_riesgo !== filtro) return false;
      if (!q) return true;
      return (
        f.nombre.toLowerCase().includes(q) ||
        (f.documento ?? "").toLowerCase().includes(q)
      );
    });
  }, [resumen, busqueda, filtro]);

  const totalFiltrado = filas.reduce((s, f) => s + f.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente o NIT…"
            className="pl-9"
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-1">
          {(["todos", "CRITICO", "VIGILANCIA", "SANO"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
                filtro === f
                  ? "bg-background font-semibold text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "todos" ? "Todos" : RIESGO_LABEL[f]}
              <span className="ml-1.5 text-xs tabular-nums opacity-70">{conteos[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Corriente</TableHead>
              <TableHead className="text-right">31–60</TableHead>
              <TableHead className="text-right">61–90</TableHead>
              <TableHead className="text-right">&gt; 90</TableHead>
              <TableHead className="text-right">% vencido</TableHead>
              <TableHead>Riesgo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.cliente_id}>
                <TableCell>
                  <div className="max-w-[22rem] truncate font-medium">{f.nombre}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.documento ?? "sin documento"} · {f.emisora}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{money(f.total)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {f.corriente > 0 ? money(f.corriente) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {f.t31_60 > 0 ? money(f.t31_60) : <span className="text-slate-300">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {f.t61_90 > 0 ? money(f.t61_90) : <span className="text-slate-300">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums text-destructive">
                  {f.t_mas_90 > 0 ? money(f.t_mas_90) : <span className="text-slate-300">—</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{pct(f.pct_vencido)}</TableCell>
                <TableCell>
                  <span
                    className={`inline-flex rounded-sm px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                      BADGE[f.estado_riesgo]
                    }`}
                  >
                    {RIESGO_LABEL[f.estado_riesgo]}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Ningún cliente coincide con el filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {filas.length > 0 && (
        <p className="text-sm tabular-nums text-muted-foreground">
          {filas.length} {filas.length === 1 ? "cliente" : "clientes"} · {money(totalFiltrado)}
          {filtro !== "todos" && ` de ${money(resumen.totales.cartera_total)} totales`}
        </p>
      )}

      {filas.length > 0 && filtro === "todos" && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => setFiltro("CRITICO")}
        >
          Ver solo los {conteos.CRITICO} en riesgo crítico
        </Button>
      )}
    </div>
  );
}
