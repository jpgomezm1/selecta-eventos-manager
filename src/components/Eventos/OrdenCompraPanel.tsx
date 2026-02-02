import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, RefreshCw, CheckCircle, Package, FileText, Truck } from "lucide-react";
import {
  generateOrdenCompra,
  getOrdenCompra,
  updateOrdenCompraEstado,
  updateOrdenCompraItem,
  regenerateOrdenCompra,
  recalcOrdenTotal,
  despacharIngredientesEvento,
} from "@/integrations/supabase/apiOrdenCompra";
import type { OrdenCompra, OrdenCompraItem } from "@/types/cotizador";

type Props = {
  eventoId: string;
  onChanged?: () => void;
};

export default function OrdenCompraPanel({ eventoId, onChanged }: Props) {
  const { toast } = useToast();
  const [orden, setOrden] = useState<OrdenCompra | null>(null);
  const [items, setItems] = useState<OrdenCompraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [despachado, setDespachado] = useState(false);

  useEffect(() => {
    loadOrden();
  }, [eventoId]);

  const loadOrden = async () => {
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
      // Check if ingredients already dispatched
      const { data: usoMov } = await supabase
        .from("inventario_movimientos")
        .select("id")
        .eq("evento_id", eventoId)
        .eq("tipo", "uso")
        .limit(1)
        .maybeSingle();
      setDespachado(!!usoMov);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateOrdenCompra(eventoId);
      setOrden(result.orden);
      setItems(result.items);
      toast({ title: "Orden generada", description: "La orden de compra fue creada desde el requerimiento." });
      onChanged?.();
    } catch (err: any) {
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
    } catch (err: any) {
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
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDespachar = async () => {
    setDispatching(true);
    try {
      await despacharIngredientesEvento(eventoId);
      setDespachado(true);
      toast({ title: "Ingredientes despachados", description: "Se creó el movimiento de uso y se actualizó el inventario." });
      onChanged?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  };

  const handleItemUpdate = async (item: OrdenCompraItem, field: "cantidad_comprar" | "costo_unitario", value: number) => {
    const patch = { [field]: value } as any;
    if (field === "cantidad_comprar") {
      patch.costo_unitario = item.costo_unitario;
    } else {
      patch.cantidad_comprar = item.cantidad_comprar;
    }
    patch.subtotal = patch.cantidad_comprar * patch.costo_unitario;

    // Optimistic update
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, [field]: value, subtotal: patch.cantidad_comprar * patch.costo_unitario }
          : i
      )
    );

    try {
      await updateOrdenCompraItem(item.id, {
        cantidad_comprar: patch.cantidad_comprar,
        costo_unitario: patch.costo_unitario,
      });
      if (orden) {
        await recalcOrdenTotal(orden.id);
        const result = await getOrdenCompra(eventoId);
        if (result) setOrden(result.orden);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      loadOrden();
    }
  };

  const estadoBadge = (estado: string) => {
    const map: Record<string, string> = {
      borrador: "bg-slate-100 text-slate-700",
      aprobada: "bg-blue-50 text-blue-700",
      comprada: "bg-emerald-50 text-emerald-700",
      cancelada: "bg-red-50 text-red-700",
    };
    return <Badge variant="secondary" className={map[estado] ?? map.borrador}>{estado.charAt(0).toUpperCase() + estado.slice(1)}</Badge>;
  };

  const totalCalculado = items.reduce((a, i) => a + i.subtotal, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!orden) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <ShoppingCart className="h-7 w-7 text-slate-400" />
        </div>
        <p className="text-slate-900 font-medium mb-1">Sin orden de compra</p>
        <p className="text-slate-500 text-sm mb-4">
          Genera una orden automáticamente desde las recetas del menú
        </p>
        <Button onClick={handleGenerate} disabled={generating} size="sm">
          <ShoppingCart className="h-4 w-4 mr-2" />
          {generating ? "Generando..." : "Generar Orden de Compra"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {estadoBadge(orden.estado)}
          {orden.estado === "comprada" && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Inventario actualizado
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
          {orden.estado === "comprada" && !despachado && (
            <Button variant="outline" size="sm" onClick={handleDespachar} disabled={dispatching} className="h-8">
              <Truck className="h-3.5 w-3.5 mr-1" />
              {dispatching ? "Despachando..." : "Despachar al Evento"}
            </Button>
          )}
          {orden.estado === "comprada" && despachado && (
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ingredientes despachados
            </Badge>
          )}
          {(orden.estado === "borrador" || orden.estado === "aprobada") && (
            <Button variant="ghost" size="sm" onClick={() => handleEstado("cancelada")} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-lg">
          <Package className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No se generaron items (sin recetas definidas)</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-medium">Ingrediente</TableHead>
                <TableHead className="font-medium">Unidad</TableHead>
                <TableHead className="text-right font-medium">Necesario</TableHead>
                <TableHead className="text-right font-medium">En Inventario</TableHead>
                <TableHead className="text-right font-medium">A Comprar</TableHead>
                <TableHead className="text-right font-medium">Costo Unit.</TableHead>
                <TableHead className="text-right font-medium">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-slate-900">{item.nombre}</TableCell>
                  <TableCell className="text-slate-600">{item.unidad}</TableCell>
                  <TableCell className="text-right text-slate-600">
                    {item.cantidad_necesaria.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right text-slate-600">
                    {item.cantidad_inventario.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    {orden.estado === "borrador" ? (
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        className="w-24 text-right h-8 ml-auto"
                        value={item.cantidad_comprar}
                        onChange={(e) => handleItemUpdate(item, "cantidad_comprar", Number(e.target.value))}
                      />
                    ) : (
                      <span className="font-medium text-slate-900">
                        {item.cantidad_comprar.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    )}
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
                      <span className="text-slate-600">${item.costo_unitario.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
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
          <div className="bg-emerald-50 rounded-lg p-4 text-right">
            <p className="text-xs text-emerald-600 mb-1">Total Estimado</p>
            <p className="text-xl font-semibold text-emerald-700">${totalCalculado.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
