import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, RefreshCw, CheckCircle, Package, FileText, FileDown, AlertTriangle } from "lucide-react";
import { generateOrdenCompraPDF } from "@/lib/orden-compra-pdf";
import {
  generateOrdenCompra,
  getOrdenCompra,
  updateOrdenCompraEstado,
  updateOrdenCompraItem,
  regenerateOrdenCompra,
  recalcOrdenTotal,
} from "@/integrations/supabase/apiOrdenCompra";
import { PanelHeader } from "@/components/Layout/PageHeader";
import type { OrdenCompra, OrdenCompraItem } from "@/types/cotizador";

type Props = {
  eventoId: string;
  eventoInfo?: {
    nombre_evento: string;
    fecha_evento: string;
    ubicacion: string;
    comercial_encargado?: string | null;
  };
  onChanged?: () => void;
};

export default function OrdenCompraPanel({ eventoId, eventoInfo, onChanged }: Props) {
  const { toast } = useToast();
  const [orden, setOrden] = useState<OrdenCompra | null>(null);
  const [items, setItems] = useState<OrdenCompraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const loadOrden = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getOrdenCompra(eventoId);
      if (result) {
        setOrden(result.orden);
        setItems(result.items);
      } else {
        setOrden(null);
        setItems([]);
      }
    } catch (err) {
      toast({ title: "Error", description: (err as Error)?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [eventoId, toast]);

  useEffect(() => {
    loadOrden();
  }, [loadOrden]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateOrdenCompra(eventoId);
      setOrden(result.orden);
      setItems(result.items);
      toast({ title: "Orden generada", description: "La orden de compra fue creada desde el requerimiento." });
      onChanged?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const result = await regenerateOrdenCompra(eventoId);
      setOrden(result.orden);
      setItems(result.items);
      toast({ title: "Orden regenerada" });
      onChanged?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleEstado = async (estado: OrdenCompra["estado"]) => {
    if (!orden) return;
    try {
      const updated = await updateOrdenCompraEstado(orden.id, estado);
      setOrden(updated);
      const desc = estado === "comprada"
        ? "Orden comprada — inventario de ingredientes actualizado"
        : `Orden ${estado}`;
      toast({ title: "Estado actualizado", description: desc });
      onChanged?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadPDF = async () => {
    if (!orden || !eventoInfo) return;
    setDownloadingPdf(true);
    try {
      await generateOrdenCompraPDF({ orden, items, evento: eventoInfo });
      toast({ title: "PDF generado" });
    } catch (err) {
      toast({ title: "Error al generar PDF", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const handleItemUpdate = (item: OrdenCompraItem, field: "cantidad_comprar" | "costo_unitario", value: number) => {
    // Optimistic local update — instant UI feedback.
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== item.id) return i;
        const cantidad = field === "cantidad_comprar" ? value : i.cantidad_comprar;
        const costo = field === "costo_unitario" ? value : i.costo_unitario;
        return { ...i, [field]: value, subtotal: cantidad * costo };
      })
    );

    // Debounced server sync per item: collapses bursts of keystrokes into 1 round-trip.
    const existing = debounceTimers.current.get(item.id);
    if (existing) clearTimeout(existing);

    const newTimer = setTimeout(async () => {
      debounceTimers.current.delete(item.id);
      const latest = itemsRef.current.find((i) => i.id === item.id);
      if (!latest) return;
      try {
        await updateOrdenCompraItem(item.id, {
          cantidad_comprar: latest.cantidad_comprar,
          costo_unitario: latest.costo_unitario,
        });
        if (orden) {
          await recalcOrdenTotal(orden.id);
          const result = await getOrdenCompra(eventoId);
          if (result) setOrden(result.orden);
        }
      } catch (err) {
        toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
        loadOrden();
      }
    }, 400);

    debounceTimers.current.set(item.id, newTimer);
  };

  const estadoBadge = (estado: string) => {
    const variantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      borrador: "outline",
      aprobada: "secondary",
      comprada: "default",
      cancelada: "destructive",
    };
    return <Badge variant={variantMap[estado] ?? "outline"} className="font-normal">{estado.charAt(0).toUpperCase() + estado.slice(1)}</Badge>;
  };

  const totalCalculado = items.reduce((a, i) => a + i.subtotal, 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted/70" />
        <p className="text-sm italic text-muted-foreground">Cargando orden…</p>
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShoppingCart className="h-9 w-9 mx-auto text-muted-foreground/60 mb-4" strokeWidth={1.5} />
        <p className="font-serif text-[20px] text-foreground mb-1">Sin orden de compra</p>
        <p className="max-w-xs text-sm text-muted-foreground mb-4">
          Genera una orden automáticamente desde las recetas del menú.
        </p>
        <Button onClick={handleGenerate} disabled={generating} size="sm">
          <ShoppingCart className="h-4 w-4 mr-2" />
          {generating ? "Generando..." : "Generar Orden de Compra"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PanelHeader
        kicker="Operación"
        title="Orden de compra"
        description="Insumos a comprar generados desde las recetas del menú."
      />
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {estadoBadge(orden.estado)}
          {orden.estado === "comprada" && (
            <span className="text-xs text-primary flex items-center gap-1">
              <CheckCircle className="h-3 w-3" strokeWidth={1.75} /> Inventario actualizado
            </span>
          )}
          {orden.estado === "borrador" && (
            <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={generating} className="h-8">
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${generating ? "animate-spin" : ""}`} />
              Regenerar
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {orden.estado === "borrador" && (
            <Button variant="outline" size="sm" onClick={() => handleEstado("aprobada")} className="h-8">
              <FileText className="h-3.5 w-3.5 mr-1" />
              Aprobar
            </Button>
          )}
          {orden.estado === "aprobada" && (
            <Button variant="outline" size="sm" onClick={() => handleEstado("comprada")} className="h-8">
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Marcar Comprada
            </Button>
          )}
          {items.length > 0 && eventoInfo && (
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={downloadingPdf} className="h-8">
              <FileDown className="h-3.5 w-3.5 mr-1" />
              {downloadingPdf ? "Generando..." : "Descargar PDF"}
            </Button>
          )}
          {(orden.estado === "borrador" || orden.estado === "aprobada") && (
            <Button variant="ghost" size="sm" onClick={() => handleEstado("cancelada")} className="h-8 text-muted-foreground hover:text-destructive">
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-8 bg-muted/40 rounded-lg">
          <Package className="h-8 w-8 text-muted-foreground/70 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No se generaron items (sin recetas definidas)</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="kicker text-muted-foreground">Ingrediente</TableHead>
                <TableHead className="kicker text-muted-foreground">Unidad</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Necesario</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">En Inventario</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">A Comprar</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Costo Unit.</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground">{item.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{item.unidad}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.cantidad_necesaria.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {item.cantidad_inventario.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {(() => {
                      const necesario = Math.max(0, item.cantidad_necesaria - item.cantidad_inventario);
                      const insuficiente = item.cantidad_comprar < necesario;
                      return orden.estado === "borrador" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {insuficiente && (
                            <AlertTriangle
                              className="h-3.5 w-3.5 text-warning"
                              strokeWidth={1.75}
                              aria-label={`Recomendado: ${necesario.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                            />
                          )}
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            className={`w-24 text-right h-8 ${insuficiente ? "border-warning/60" : ""}`}
                            value={item.cantidad_comprar}
                            onChange={(e) => handleItemUpdate(item, "cantidad_comprar", Number(e.target.value))}
                            title={insuficiente ? `Cantidad menor a la necesaria (${necesario.toLocaleString(undefined, { maximumFractionDigits: 2 })}). Verifica si es intencional.` : undefined}
                          />
                        </div>
                      ) : (
                        <span className="font-medium text-foreground">
                          {item.cantidad_comprar.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    {orden.estado === "borrador" ? (
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        className="w-28 text-right h-8 ml-auto"
                        value={item.costo_unitario}
                        onChange={(e) => handleItemUpdate(item, "costo_unitario", Number(e.target.value))}
                      />
                    ) : (
                      <span className="text-muted-foreground">${item.costo_unitario.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    ${item.subtotal.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="rounded-md border border-border p-4 text-right">
            <p className="kicker text-muted-foreground mb-1">Total estimado</p>
            <p className="text-xl font-semibold text-primary tabular-nums">${totalCalculado.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
