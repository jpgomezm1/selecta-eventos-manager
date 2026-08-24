import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelHeader } from "@/components/Layout/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useCan } from "@/hooks/useCan";
import {
  borrarCargoAdicional,
  crearCargoAdicional,
  listCargosAdicionales,
} from "@/integrations/supabase/apiConsumos";
import { getPlatosCatalogo } from "@/integrations/supabase/apiCotizador";

/**
 * Consumos adicionales durante el evento.
 *
 * Pensado para el celular del comercial, parado en el evento: pocos campos,
 * targets grandes, y el catálogo a un toque para no tener que escribir el
 * nombre ni acordarse del precio.
 *
 * Está diseñado asumiendo que NO se va a llenar en el momento exacto. Por eso
 * la hora es editable y arranca en "ahora" pero se puede corregir: es mucho más
 * probable que esto se cargue al final de la noche, y forzar una hora falsa
 * sería peor que aceptar el registro tardío.
 *
 * Lo que se carga acá suma al total del reporte de facturación. Es lo que se le
 * COBRA al cliente — los costos de Selecta van en Rentabilidad.
 */

const money = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(Math.round(n || 0));

function ahoraLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ConsumosPanel({ eventoId }: { eventoId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const can = useCan();
  const puedeEditar = can(["admin", "comercial"]);

  const [abierto, setAbierto] = useState(false);
  const [concepto, setConcepto] = useState("");
  const [platoId, setPlatoId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  const [cuando, setCuando] = useState(ahoraLocal());
  const [notas, setNotas] = useState("");
  const [busca, setBusca] = useState("");

  const { data: cargos = [], isLoading } = useQuery({
    queryKey: ["cargos-adicionales", eventoId],
    queryFn: () => listCargosAdicionales(eventoId),
  });

  const { data: platos = [] } = useQuery({
    queryKey: ["platos-catalogo"],
    queryFn: getPlatosCatalogo,
    enabled: abierto,
  });

  const sugerencias = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return platos.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 6);
  }, [platos, busca]);

  const total = cargos.reduce((s, c) => s + c.subtotal, 0);
  const previa = (Number(cantidad) || 0) * (Number(precio) || 0);
  const listo = concepto.trim() && Number(cantidad) > 0 && Number(precio) >= 0;

  const limpiar = () => {
    setConcepto("");
    setPlatoId(null);
    setCantidad("1");
    setPrecio("");
    setNotas("");
    setBusca("");
    setCuando(ahoraLocal());
  };

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ["cargos-adicionales", eventoId] });
    // El reporte de facturación los suma: si no se invalida, el total del
    // cierre queda viejo hasta que alguien recargue la página.
    qc.invalidateQueries({ queryKey: ["reporte-facturacion", eventoId] });
  };

  const crear = useMutation({
    mutationFn: () =>
      crearCargoAdicional({
        evento_id: eventoId,
        plato_id: platoId,
        concepto: concepto.trim(),
        cantidad: Number(cantidad),
        precio_unitario: Number(precio),
        ocurrido_at: new Date(cuando).toISOString(),
        notas: notas.trim() || null,
      }),
    onSuccess: () => {
      refrescar();
      limpiar();
      setAbierto(false);
      toast({ title: "Consumo registrado" });
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo registrar", description: e.message, variant: "destructive" }),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => borrarCargoAdicional(id),
    onSuccess: () => {
      refrescar();
      toast({ title: "Consumo eliminado" });
    },
    onError: (e: Error) =>
      toast({ title: "No se pudo eliminar", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-56 w-full" />;

  return (
    <div className="space-y-5">
      <PanelHeader
        kicker="Durante el evento"
        title="Consumos adicionales"
        description="Lo que se consumió de más y hay que cobrarle al cliente."
        actions={
          puedeEditar && !abierto ? (
            <Button size="sm" onClick={() => setAbierto(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar
            </Button>
          ) : undefined
        }
      />

      {abierto && (
        <Card className="border-primary/40 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="kicker text-primary">Nuevo consumo</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar"
              onClick={() => {
                setAbierto(false);
                limpiar();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">¿Qué se consumió?</Label>
              {platoId ? (
                <div className="flex h-11 items-center justify-between gap-2 rounded-md border border-input bg-background px-3">
                  <span className="truncate text-sm">{concepto}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPlatoId(null);
                      setConcepto("");
                      setPrecio("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    cambiar
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    className="h-11"
                    value={concepto}
                    onChange={(e) => {
                      setConcepto(e.target.value);
                      setBusca(e.target.value);
                    }}
                    placeholder="Botella de vino, hora extra de bar…"
                  />
                  {/* El catálogo trae el precio: evita que cada comercial cobre
                      distinto por lo mismo. */}
                  {sugerencias.length > 0 && (
                    <ul className="mt-1 overflow-hidden rounded-md border border-border">
                      {sugerencias.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setPlatoId(p.id);
                              setConcepto(p.nombre);
                              setPrecio(String(Math.round(p.precio)));
                              setBusca("");
                            }}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-accent"
                          >
                            <span className="truncate">{p.nombre}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {money(p.precio)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Cantidad</Label>
                <Input
                  className="h-11"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Precio unitario</Label>
                <Input
                  className="h-11"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                  placeholder="65000"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">¿Cuándo?</Label>
              <Input
                type="datetime-local"
                className="h-11"
                value={cuando}
                onChange={(e) => setCuando(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Arranca en la hora actual. Si lo estás cargando después, corrígela — nadie
                espera que esto se llene en medio del evento.
              </p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Nota (opcional)</Label>
              <Input
                className="h-11"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Lo pidió el novio, autorizado por…"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-sm text-muted-foreground">
                {previa > 0 ? (
                  <>
                    Suma <strong className="text-foreground tabular-nums">{money(previa)}</strong>
                  </>
                ) : (
                  "Cantidad × precio"
                )}
              </span>
              <Button
                className="h-11"
                disabled={!listo || crear.isPending}
                onClick={() => crear.mutate()}
              >
                {crear.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {cargos.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          Todavía no hay consumos adicionales en este evento.
        </p>
      ) : (
        <Card className="divide-y divide-border">
          {cargos.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{c.concepto}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {c.cantidad} × {money(c.precio_unitario)} ·{" "}
                  {new Date(c.ocurrido_at).toLocaleString("es-CO", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {c.notas && ` · ${c.notas}`}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{money(c.subtotal)}</span>
              {puedeEditar && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar ${c.concepto}`}
                  disabled={eliminar.isPending}
                  onClick={() => eliminar.mutate(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between bg-muted/40 px-4 py-3">
            <span className="kicker text-muted-foreground">Total a sumar a la factura</span>
            <span className="font-serif text-lg tabular-nums">{money(total)}</span>
          </div>
        </Card>
      )}
    </div>
  );
}
