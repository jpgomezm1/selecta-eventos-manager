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
import { TRAMO_LABEL, type FacturaCartera, type Tramo } from "@/types/cartera";
import { fechaCorta, money } from "./formato";

/**
 * Detalle de facturas — la hoja «Detalle Facturas» de su planilla.
 *
 * Muestra saldo y no valor facturado como número principal: la cartera es lo
 * que falta cobrar, no lo que se facturó. El valor original queda al lado
 * cuando hay abonos, que es el único caso en que los dos números difieren.
 */

interface Props {
  facturas: FacturaCartera[];
  onAbonar: (f: FacturaCartera) => void;
  puedeAbonar: boolean;
}

const TONO: Record<Tramo, string> = {
  corriente: "text-muted-foreground",
  "31-60": "text-warning",
  "61-90": "text-warning",
  "91-120": "text-destructive",
  "121-150": "text-destructive",
  ">150": "text-destructive",
};

type Filtro = "pendientes" | "vencidas" | "saldadas" | "todas";

export default function TablaFacturas({ facturas, onAbonar, puedeAbonar }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [visibles, setVisibles] = useState(50);

  const conteos = useMemo(
    () => ({
      pendientes: facturas.filter((f) => f.saldo > 0.005 && !f.anulada).length,
      vencidas: facturas.filter((f) => f.saldo > 0.005 && !f.anulada && f.tramo !== "corriente").length,
      saldadas: facturas.filter((f) => f.saldo <= 0.005 && !f.anulada).length,
      todas: facturas.length,
    }),
    [facturas]
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return facturas.filter((f) => {
      const pendiente = f.saldo > 0.005 && !f.anulada;
      if (filtro === "pendientes" && !pendiente) return false;
      if (filtro === "vencidas" && (!pendiente || f.tramo === "corriente")) return false;
      if (filtro === "saldadas" && (f.saldo > 0.005 || f.anulada)) return false;
      if (!q) return true;
      return (
        f.numero.toLowerCase().includes(q) ||
        f.cliente_nombre.toLowerCase().includes(q) ||
        (f.cliente_documento ?? "").toLowerCase().includes(q)
      );
    });
  }, [facturas, busqueda, filtro]);

  const totalFiltrado = filtradas.reduce((s, f) => s + f.saldo, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setVisibles(50);
            }}
            placeholder="Buscar factura, cliente o NIT…"
            className="pl-9"
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-1">
          {(["pendientes", "vencidas", "saldadas", "todas"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setFiltro(f);
                setVisibles(50);
              }}
              aria-pressed={filtro === f}
              className={`rounded-sm px-3 py-1.5 text-sm capitalize transition-colors ${
                filtro === f
                  ? "bg-background font-semibold text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
              <span className="ml-1.5 text-xs tabular-nums opacity-70">{conteos[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Factura</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Edad</TableHead>
              <TableHead>Tramo</TableHead>
              {puedeAbonar && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.slice(0, visibles).map((f) => (
              <TableRow key={f.id} className={f.anulada ? "opacity-50" : undefined}>
                <TableCell>
                  <div className="font-medium">{f.numero}</div>
                  <div className="text-xs text-muted-foreground">{f.emisora}</div>
                </TableCell>
                <TableCell>
                  <div className="max-w-[20rem] truncate">{f.cliente_nombre}</div>
                  <div className="text-xs text-muted-foreground">{f.cliente_documento ?? "—"}</div>
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {fechaCorta(f.fecha_emision)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div className="font-semibold">{money(f.saldo)}</div>
                  {f.abonado > 0 && (
                    <div className="text-xs text-muted-foreground">
                      de {money(f.valor_total)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {f.edad_dias} d
                </TableCell>
                <TableCell>
                  <span className={`text-sm ${TONO[f.tramo]}`}>{TRAMO_LABEL[f.tramo]}</span>
                </TableCell>
                {puedeAbonar && (
                  <TableCell>
                    {f.saldo > 0.005 && !f.anulada && (
                      <Button variant="outline" size="sm" onClick={() => onAbonar(f)}>
                        Abonar
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filtradas.length === 0 && (
              <TableRow>
                <TableCell colSpan={puedeAbonar ? 7 : 6} className="py-10 text-center text-muted-foreground">
                  Ninguna factura coincide con el filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tabular-nums text-muted-foreground">
          {filtradas.length} {filtradas.length === 1 ? "factura" : "facturas"} ·{" "}
          {money(totalFiltrado)} por cobrar
        </p>
        {visibles < filtradas.length && (
          <Button variant="outline" size="sm" onClick={() => setVisibles((v) => v + 50)}>
            Ver {Math.min(50, filtradas.length - visibles)} más
          </Button>
        )}
      </div>
    </div>
  );
}
