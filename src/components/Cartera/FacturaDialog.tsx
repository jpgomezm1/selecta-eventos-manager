import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

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
import { crearFactura } from "@/integrations/supabase/apiCartera";
import { listClientes } from "@/integrations/supabase/apiClientes";
import type { EmpresaEmisora } from "@/types/cartera";
import { hoyISO, money } from "./formato";

/**
 * Alta manual de una factura.
 *
 * Las facturas se emiten en el sistema de facturación electrónica del cliente,
 * no acá — decisión tomada. Esto solo registra en el CRM una factura que ya
 * existe afuera, para poder hacerle seguimiento de cobro.
 */

interface Props {
  abierto: boolean;
  onClose: () => void;
  emisoras: EmpresaEmisora[];
}

export default function FacturaDialog({ abierto, onClose, emisoras }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [emisoraId, setEmisoraId] = useState(emisoras[0]?.id ?? "");
  const [clienteId, setClienteId] = useState("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [diasCredito, setDiasCredito] = useState("30");
  const [valor, setValor] = useState("");
  const [notas, setNotas] = useState("");

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes"],
    queryFn: listClientes,
    enabled: abierto,
  });

  const opciones = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    if (!q) return clientes.slice(0, 8);
    return clientes
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(q) ||
          (c.nit ?? "").includes(q) ||
          (c.cedula ?? "").includes(q)
      )
      .slice(0, 8);
  }, [clientes, buscaCliente]);

  const elegido = clientes.find((c) => c.id === clienteId);
  const monto = Number(valor) || 0;
  const dias = Number(diasCredito) || 0;

  const vencimiento = useMemo(() => {
    if (!fecha) return "";
    const [y, m, d] = fecha.split("-").map(Number);
    const base = new Date(y, m - 1, d + dias);
    return `${String(base.getDate()).padStart(2, "0")}/${String(base.getMonth() + 1).padStart(2, "0")}/${base.getFullYear()}`;
  }, [fecha, dias]);

  const listo = emisoraId && clienteId && numero.trim() && fecha && monto > 0;

  const guardar = useMutation({
    mutationFn: () =>
      crearFactura({
        empresa_emisora_id: emisoraId,
        cliente_id: clienteId,
        numero: numero.trim(),
        fecha_emision: fecha,
        dias_credito: dias,
        valor_total: monto,
        notas: notas.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cartera-facturas"] });
      qc.invalidateQueries({ queryKey: ["cartera-resumen"] });
      toast({ title: `Factura ${numero.trim()} registrada` });
      setNumero("");
      setValor("");
      setNotas("");
      setClienteId("");
      setBuscaCliente("");
      onClose();
    },
    onError: (e: Error) => {
      const dup = e.message.includes("duplicate") || e.message.includes("unique");
      toast({
        title: dup ? "Esa factura ya está registrada" : "No se pudo guardar",
        description: dup
          ? `Ya existe una factura ${numero.trim()} para esa empresa.`
          : e.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar factura</DialogTitle>
          <DialogDescription>
            Se registra una factura que ya se emitió, para hacerle seguimiento de cobro.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">Empresa que factura</Label>
            <select
              value={emisoraId}
              onChange={(e) => setEmisoraId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {emisoras.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Número de factura</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="FECP4890" />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Cliente</Label>
          {elegido ? (
            <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-background px-3">
              <span className="truncate text-sm">
                {elegido.nombre}
                <span className="ml-2 text-xs text-muted-foreground">
                  {elegido.nit ?? elegido.cedula ?? "sin documento"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setClienteId("")}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                cambiar
              </button>
            </div>
          ) : (
            <>
              <Input
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
                placeholder="Buscar por nombre o NIT…"
              />
              {opciones.length > 0 && (
                <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border">
                  {opciones.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setClienteId(c.id)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <span className="truncate">{c.nombre}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {c.nit ?? c.cedula ?? "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">Fecha de emisión</Label>
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Días de plazo</Label>
            <Input
              value={diasCredito}
              onChange={(e) => setDiasCredito(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Valor</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="2500000"
              inputMode="numeric"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Notas (opcional)</Label>
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>

        {monto > 0 && vencimiento && (
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{money(monto)}</strong>, vence el{" "}
            <strong className="text-foreground">{vencimiento}</strong>.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!listo || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar factura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
