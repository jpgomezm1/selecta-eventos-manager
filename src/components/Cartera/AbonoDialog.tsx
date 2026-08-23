import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { borrarAbono, listAbonos, registrarAbono } from "@/integrations/supabase/apiCartera";
import type { FacturaCartera } from "@/types/cartera";
import { fechaCorta, hoyISO, money } from "./formato";

/**
 * Registrar un abono contra una factura.
 *
 * Muestra los abonos ya registrados en la misma pantalla a propósito: el error
 * caro acá es cargar dos veces el mismo pago, y eso pasa cuando quien registra
 * no ve lo que ya está.
 */

interface Props {
  factura: FacturaCartera | null;
  onClose: () => void;
}

const METODOS = ["Transferencia", "Consignación", "Efectivo", "Cheque", "Otro"];

export default function AbonoDialog({ factura, onClose }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [fecha, setFecha] = useState(hoyISO());
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState(METODOS[0]);
  const [referencia, setReferencia] = useState("");

  const { data: abonos = [], isLoading } = useQuery({
    queryKey: ["cartera-abonos", factura?.id],
    queryFn: () => listAbonos(factura!.id),
    enabled: Boolean(factura),
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["cartera-abonos", factura?.id] });
    qc.invalidateQueries({ queryKey: ["cartera-facturas"] });
    qc.invalidateQueries({ queryKey: ["cartera-resumen"] });
  };

  const crear = useMutation({
    mutationFn: () =>
      registrarAbono({
        factura_id: factura!.id,
        fecha,
        monto: Number(monto),
        metodo,
        referencia: referencia.trim() || null,
      }),
    onSuccess: () => {
      refrescar();
      setMonto("");
      setReferencia("");
      toast({ title: "Abono registrado" });
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo registrar", description: e.message, variant: "destructive" }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => borrarAbono(id),
    onSuccess: () => {
      refrescar();
      toast({ title: "Abono eliminado" });
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo eliminar", description: e.message, variant: "destructive" }),
  });

  if (!factura) return null;

  const valor = Number(monto) || 0;
  // El saldo que llega es el de antes de este abono; el que importa al operador
  // es cómo queda la factura si confirma.
  const saldoResultante = factura.saldo - valor;
  const excede = valor > factura.saldo + 0.005;

  return (
    <Dialog open={Boolean(factura)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Abonos de {factura.numero}</DialogTitle>
          <DialogDescription>
            {factura.cliente_nombre} · facturado {money(factura.valor_total)} · saldo actual{" "}
            <strong className="text-foreground">{money(factura.saldo)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)_150px]">
          <div>
            <Label className="text-xs text-muted-foreground">Fecha</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Monto</Label>
            <Input
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="1500000"
              inputMode="numeric"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Método</Label>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {METODOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Referencia (opcional)</Label>
          <Input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Número de transferencia, comprobante…"
          />
        </div>

        {valor > 0 && (
          <p className={`text-sm ${excede ? "text-destructive" : "text-muted-foreground"}`}>
            {excede ? (
              <>
                Este abono excede el saldo en{" "}
                <strong>{money(valor - factura.saldo)}</strong>. Revisen el monto o la factura.
              </>
            ) : (
              <>
                La factura quedaría en{" "}
                <strong className="text-foreground">{money(saldoResultante)}</strong>
                {saldoResultante < 0.005 && " — saldada"}
              </>
            )}
          </p>
        )}

        <div className="rounded-md border border-border">
          <div className="border-b border-border px-4 py-2">
            <span className="kicker">Abonos registrados</span>
          </div>
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : abonos.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Todavía no hay abonos en esta factura.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {abonos.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm tabular-nums">
                      <strong className="font-semibold">{money(a.monto)}</strong>
                      <span className="ml-2 text-muted-foreground">{fechaCorta(a.fecha)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.metodo ?? "sin método"}
                      {a.referencia && ` · ${a.referencia}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar abono"
                    disabled={eliminar.isPending}
                    onClick={() => eliminar.mutate(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            disabled={valor <= 0 || excede || crear.isPending}
            onClick={() => crear.mutate()}
          >
            {crear.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar abono
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
