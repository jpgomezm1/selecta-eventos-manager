import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Mail, Sparkles, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCan } from "@/hooks/useCan";
import {
  conciliarSoporte,
  descargarComprobante,
  descartarSoporte,
  guardarLecturaIA,
  listSoportes,
  urlComprobante,
  type EstadoSoporte,
  type SoportePago,
} from "@/integrations/supabase/apiSoportes";
import { leerComprobante } from "@/services/soporteScanner";
import type { FacturaCartera } from "@/types/cartera";
import { fechaCorta, money } from "./formato";

/**
 * Bandeja de soportes de pago.
 *
 * Reemplaza el WhatsApp donde hoy los comerciales mandan los comprobantes. Lo
 * que llega al buzón entra acá; alguien lo mira, lo empata con una factura y
 * recién ahí nace el abono.
 *
 * La IA lee el comprobante y PROPONE monto, fecha y referencia. No concilia
 * sola a propósito: un comprobante mal leído que se aplique solo mueve el saldo
 * de una factura sin que nadie lo note, y eso es peor que el desorden que
 * venimos a arreglar.
 */

interface Props {
  facturas: FacturaCartera[];
}

const METODOS = ["Transferencia", "Consignación", "Efectivo", "Cheque", "Otro"];

export default function BandejaSoportes({ facturas }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const can = useCan();
  const puedeConciliar = can(["admin"]);

  const [filtro, setFiltro] = useState<EstadoSoporte>("pendiente");
  const [abierto, setAbierto] = useState<SoportePago | null>(null);

  const { data: soportes = [], isLoading } = useQuery({
    queryKey: ["soportes-pago", filtro],
    queryFn: () => listSoportes(filtro),
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["soportes-pago"] });
    qc.invalidateQueries({ queryKey: ["cartera-facturas"] });
    qc.invalidateQueries({ queryKey: ["cartera-resumen"] });
  };

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-0.5 rounded-md bg-muted p-1">
          {(["pendiente", "conciliado", "descartado"] as const).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setFiltro(e)}
              aria-pressed={filtro === e}
              className={`rounded-sm px-3 py-1.5 text-sm capitalize transition-colors ${
                filtro === e
                  ? "bg-background font-semibold text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {e === "pendiente" ? "Pendientes" : e === "conciliado" ? "Conciliados" : "Descartados"}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Los comprobantes que llegan al buzón entran acá.
        </p>
      </div>

      {soportes.length === 0 ? (
        <div className="py-14 text-center">
          <Mail className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-4 font-serif text-lg">
            {filtro === "pendiente" ? "No hay soportes pendientes" : `Nada en ${filtro}s`}
          </p>
          {filtro === "pendiente" && (
            <p className="mx-auto mt-2 max-w-[52ch] text-sm text-muted-foreground">
              Cuando un comercial mande un comprobante al buzón de pagos, aparece acá para
              conciliarlo contra una factura.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {soportes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAbierto(s)}
              className="flex w-full items-center gap-4 rounded-md border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">
                  {s.asunto || "(sin asunto)"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {s.remitente ?? "remitente desconocido"} · {fechaCorta(s.recibido_at)}
                  {s.archivo_nombre && ` · ${s.archivo_nombre}`}
                </p>
              </div>
              {s.monto_detectado != null && (
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  ~{money(s.monto_detectado)}
                </span>
              )}
              {!s.archivo_url && (
                <span className="shrink-0 text-xs text-warning">sin adjunto</span>
              )}
            </button>
          ))}
        </div>
      )}

      {abierto && (
        <DetalleSoporte
          soporte={abierto}
          facturas={facturas}
          puedeConciliar={puedeConciliar}
          onClose={() => setAbierto(null)}
          onCambio={() => {
            refrescar();
            setAbierto(null);
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

function DetalleSoporte({
  soporte,
  facturas,
  puedeConciliar,
  onClose,
  onCambio,
  toast,
}: {
  soporte: SoportePago;
  facturas: FacturaCartera[];
  puedeConciliar: boolean;
  onClose: () => void;
  onCambio: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [monto, setMonto] = useState(
    soporte.monto_detectado != null ? String(Math.round(soporte.monto_detectado)) : ""
  );
  const [fecha, setFecha] = useState(soporte.fecha_detectada ?? "");
  const [referencia, setReferencia] = useState(soporte.referencia_detectada ?? "");
  const [metodo, setMetodo] = useState(METODOS[0]);
  const [facturaId, setFacturaId] = useState("");
  const [busca, setBusca] = useState("");
  const [leyendo, setLeyendo] = useState(false);

  const pendientes = useMemo(
    () => facturas.filter((f) => f.saldo > 0.005 && !f.anulada),
    [facturas]
  );

  /**
   * Sugerencias de factura: primero las de saldo parecido al monto del
   * comprobante. Es el atajo que más ahorra — la mayoría de los pagos son por
   * el total de una factura.
   */
  const candidatas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (q) {
      return pendientes
        .filter(
          (f) =>
            f.numero.toLowerCase().includes(q) || f.cliente_nombre.toLowerCase().includes(q)
        )
        .slice(0, 6);
    }
    const m = Number(monto) || 0;
    if (m <= 0) return pendientes.slice(0, 6);
    return [...pendientes]
      .sort((a, b) => Math.abs(a.saldo - m) - Math.abs(b.saldo - m))
      .slice(0, 6);
  }, [pendientes, busca, monto]);

  const elegida = facturas.find((f) => f.id === facturaId);
  const valor = Number(monto) || 0;
  const excede = elegida ? valor > elegida.saldo + 0.005 : false;

  const leerConIA = async () => {
    if (!soporte.archivo_url || !soporte.archivo_nombre) return;
    setLeyendo(true);
    try {
      const file = await descargarComprobante(soporte.archivo_url, soporte.archivo_nombre);
      if (!file) throw new Error("No se pudo descargar el comprobante");
      const r = await leerComprobante(file);
      if (r.monto != null) setMonto(String(Math.round(r.monto)));
      if (r.fecha) setFecha(r.fecha);
      if (r.referencia) setReferencia(r.referencia);
      await guardarLecturaIA(soporte.id, {
        monto_detectado: r.monto,
        fecha_detectada: r.fecha,
        referencia_detectada: r.referencia,
        banco_detectado: r.banco,
        notas: r.notas,
      });
      toast({
        title: `Comprobante leído · confianza ${r.confianza}`,
        description:
          r.confianza === "baja"
            ? "El documento no se leía bien. Verifica el monto y la fecha antes de conciliar."
            : r.notas ?? "Revisa los datos antes de conciliar.",
        variant: r.confianza === "baja" ? "destructive" : undefined,
      });
    } catch (e) {
      toast({
        title: "No se pudo leer",
        description: e instanceof Error ? e.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setLeyendo(false);
    }
  };

  const abrirAdjunto = async () => {
    if (!soporte.archivo_url) return;
    const url = await urlComprobante(soporte.archivo_url);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else toast({ title: "No se pudo abrir el archivo", variant: "destructive" });
  };

  const conciliar = useMutation({
    mutationFn: () =>
      conciliarSoporte({
        soporteId: soporte.id,
        facturaId,
        monto: valor,
        fecha: fecha || null,
        metodo,
        referencia: referencia.trim() || null,
      }),
    onSuccess: () => {
      toast({ title: "Abono registrado", description: `${money(valor)} aplicados a ${elegida?.numero}` });
      onCambio();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo conciliar", description: e.message, variant: "destructive" }),
  });

  const descartar = useMutation({
    mutationFn: () => descartarSoporte(soporte.id, "Descartado desde la bandeja"),
    onSuccess: () => {
      toast({ title: "Soporte descartado" });
      onCambio();
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo descartar", description: e.message, variant: "destructive" }),
  });

  const yaConciliado = soporte.estado !== "pendiente";

  return (
    <Card className="border-primary/40 bg-primary/5 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-serif text-lg tracking-tight">{soporte.asunto || "(sin asunto)"}</p>
          <p className="text-sm text-muted-foreground">
            {soporte.remitente ?? "remitente desconocido"} · {fechaCorta(soporte.recibido_at)}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Cerrar" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {soporte.cuerpo && (
        <p className="mb-4 whitespace-pre-line rounded-sm border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          {soporte.cuerpo.slice(0, 400)}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {soporte.archivo_url ? (
          <>
            <Button variant="outline" size="sm" onClick={() => void abrirAdjunto()}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver comprobante
            </Button>
            {puedeConciliar && !yaConciliado && (
              <Button variant="outline" size="sm" disabled={leyendo} onClick={() => void leerConIA()}>
                {leyendo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Leer con IA
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-warning">
            Este correo llegó sin comprobante adjunto. Los datos hay que escribirlos a mano.
          </p>
        )}
      </div>

      {yaConciliado ? (
        <p className="text-sm text-muted-foreground">
          Este soporte ya está <strong className="text-foreground">{soporte.estado}</strong>.
        </p>
      ) : !puedeConciliar ? (
        <p className="text-sm text-muted-foreground">
          Conciliar es de administración: mueve el saldo de una factura.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs text-muted-foreground">Monto</Label>
              <Input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Fecha del pago</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
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
            <Label className="text-xs text-muted-foreground">Referencia</Label>
            <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">¿Contra qué factura?</Label>
            {elegida ? (
              <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-background px-3">
                <span className="truncate text-sm">
                  {elegida.numero} · {elegida.cliente_nombre}
                  <span className="ml-2 text-xs text-muted-foreground">
                    saldo {money(elegida.saldo)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setFacturaId("")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  cambiar
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por número o cliente…"
                />
                {candidatas.length > 0 && (
                  <ul className="mt-1 overflow-hidden rounded-md border border-border">
                    {candidatas.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setFacturaId(f.id)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span className="truncate">
                            {f.numero} · {f.cliente_nombre}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {money(f.saldo)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!busca && valor > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Ordenadas por saldo parecido a {money(valor)}.
                  </p>
                )}
              </>
            )}
          </div>

          {excede && (
            <p className="text-sm text-destructive">
              El monto excede el saldo de {elegida?.numero} en{" "}
              <strong>{money(valor - (elegida?.saldo ?? 0))}</strong>. Revisa el comprobante o
              la factura.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={descartar.isPending}
              onClick={() => descartar.mutate()}
            >
              Descartar
            </Button>
            <Button
              disabled={!facturaId || valor <= 0 || excede || conciliar.isPending}
              onClick={() => conciliar.mutate()}
            >
              {conciliar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conciliar y registrar abono
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
