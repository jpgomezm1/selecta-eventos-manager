import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  UtensilsCrossed, RefreshCw, CheckCircle, Package, Clock, FileDown,
} from "lucide-react";
import {
  getOrdenMenaje,
  generateOrdenMenaje,
  regenerateOrdenMenaje,
  saveReservaItems,
  setReservaEstado,
} from "@/integrations/supabase/apiMenaje";
import { generateOrdenMenajePDF } from "@/lib/orden-menaje-pdf";
import type { MenajeReserva, OrdenMenajeItem } from "@/types/menaje";

type Props = {
  eventoId: string;
  fechaEvento: string;
  eventoInfo?: {
    nombre_evento: string;
    fecha_evento: string;
    ubicacion: string;
    comercial_encargado?: string | null;
  };
  onChanged?: () => void;
};

export default function MenajePanel({ eventoId, fechaEvento, eventoInfo, onChanged }: Props) {
  const { toast } = useToast();
  const [reserva, setReserva] = useState<MenajeReserva | null>(null);
  const [items, setItems] = useState<OrdenMenajeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    loadOrden();
  }, [eventoId, fechaEvento]);

  const loadOrden = async () => {
    setLoading(true);
    try {
      const result = await getOrdenMenaje(eventoId, fechaEvento);
      if (result) {
        setReserva(result.reserva);
        setItems(result.items);
      } else {
        setReserva(null);
        setItems([]);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateOrdenMenaje(eventoId, fechaEvento);
      setReserva(result.reserva);
      setItems(result.items);
      toast({ title: "Orden generada", description: "La orden de menaje fue creada desde el requerimiento." });
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
      const result = await regenerateOrdenMenaje(eventoId, fechaEvento);
      setReserva(result.reserva);
      setItems(result.items);
      toast({ title: "Orden regenerada" });
      onChanged?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleItemUpdate = (menaje_id: string, field: "cantidad_reservar" | "precio_alquiler", value: number) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.menaje_id !== menaje_id) return i;
        if (field === "cantidad_reservar") {
          const clamped = Math.max(0, Math.min(value, i.disponible));
          if (value > i.disponible) {
            toast({
              title: "Stock insuficiente",
              description: `${i.nombre}: solo hay ${i.disponible} disponibles.`,
              variant: "destructive",
            });
          }
          return { ...i, cantidad_reservar: clamped };
        }
        return { ...i, [field]: Math.max(0, value) };
      })
    );
  };

  const handleSave = async () => {
    if (!reserva) return;
    setSaving(true);
    try {
      await saveReservaItems(
        reserva.id,
        items.filter((i) => i.cantidad_reservar > 0).map((i) => ({ menaje_id: i.menaje_id, cantidad: i.cantidad_reservar }))
      );
      toast({ title: "Reserva guardada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmar = async () => {
    if (!reserva) return;
    const insuficientes = items.filter((i) => i.cantidad_reservar < i.cantidad_requerida);
    if (insuficientes.length > 0) {
      const resumen = insuficientes
        .map((i) => `${i.nombre}: ${i.cantidad_reservar}/${i.cantidad_requerida}`)
        .join("\n");
      const ok = window.confirm(
        `Hay ${insuficientes.length} item(s) por debajo del requerimiento:\n\n${resumen}\n\n¿Confirmar de todos modos?`
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      await saveReservaItems(
        reserva.id,
        items.filter((i) => i.cantidad_reservar > 0).map((i) => ({ menaje_id: i.menaje_id, cantidad: i.cantidad_reservar }))
      );
      await setReservaEstado(reserva.id, "confirmado");
      setReserva({ ...reserva, estado: "confirmado" });
      toast({ title: "Orden confirmada", description: "El menaje quedó reservado y visible en el calendario de Bodega." });
      onChanged?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = async () => {
    if (!reserva) return;
    try {
      await setReservaEstado(reserva.id, "cancelado");
      setReserva(null);
      setItems([]);
      toast({ title: "Orden cancelada" });
      onChanged?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDownloadPDF = async () => {
    if (!eventoInfo) return;
    setDownloadingPdf(true);
    try {
      await generateOrdenMenajePDF({ items, evento: eventoInfo });
      toast({ title: "PDF generado" });
    } catch (err: any) {
      toast({ title: "Error al generar PDF", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const estadoBadge = (estado: string) => {
    const map: Record<string, { cls: string; icon: React.ReactNode }> = {
      borrador: { cls: "bg-slate-100 text-slate-700", icon: <Clock className="h-3 w-3 mr-1" /> },
      confirmado: { cls: "bg-blue-50 text-blue-700", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      devuelto: { cls: "bg-emerald-50 text-emerald-700", icon: <Package className="h-3 w-3 mr-1" /> },
    };
    const c = map[estado] ?? map.borrador;
    return (
      <Badge variant="secondary" className={c.cls}>
        {c.icon}
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
  };

  const totalCalculado = items.reduce((a, i) => a + i.cantidad_reservar * i.precio_alquiler, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!reserva) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <UtensilsCrossed className="h-7 w-7 text-slate-400" />
        </div>
        <p className="text-slate-900 font-medium mb-1">Sin orden de menaje</p>
        <p className="text-slate-500 text-sm mb-4">
          Genera una orden automáticamente desde el requerimiento del evento
        </p>
        <Button onClick={handleGenerate} disabled={generating} size="sm">
          <UtensilsCrossed className="h-4 w-4 mr-2" />
          {generating ? "Generando..." : "Generar Orden de Menaje"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {estadoBadge(reserva.estado)}
          {reserva.estado === "borrador" && (
            <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={generating} className="h-8">
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${generating ? "animate-spin" : ""}`} />
              Regenerar
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {reserva.estado === "borrador" && (
            <>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="h-8">
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleConfirmar} disabled={saving} className="h-8">
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Confirmar
              </Button>
            </>
          )}
          {items.length > 0 && eventoInfo && (
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={downloadingPdf} className="h-8">
              <FileDown className="h-3.5 w-3.5 mr-1" />
              {downloadingPdf ? "Generando..." : "Descargar PDF"}
            </Button>
          )}
          {reserva.estado === "borrador" && (
            <Button variant="ghost" size="sm" onClick={handleCancelar} className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50">
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {items.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 rounded-lg">
          <Package className="h-8 w-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No se generaron items (sin menaje en el requerimiento)</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-medium">Item</TableHead>
                <TableHead className="font-medium">Unidad</TableHead>
                <TableHead className="text-right font-medium">Requerido</TableHead>
                <TableHead className="text-right font-medium">Disponible</TableHead>
                <TableHead className="text-right font-medium">A Reservar</TableHead>
                <TableHead className="text-right font-medium">Precio Alq.</TableHead>
                <TableHead className="text-right font-medium">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const subtotal = item.cantidad_reservar * item.precio_alquiler;
                const insuficiente = item.disponible < item.cantidad_requerida;
                return (
                  <TableRow key={item.menaje_id}>
                    <TableCell className="font-medium text-slate-900">{item.nombre}</TableCell>
                    <TableCell className="text-slate-600">{item.unidad}</TableCell>
                    <TableCell className="text-right text-slate-600">
                      {item.cantidad_requerida.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={insuficiente ? "text-red-600 font-medium" : "text-emerald-600 font-medium"}>
                        {item.disponible.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {reserva.estado === "borrador" ? (
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          className="w-24 text-right h-8 ml-auto"
                          value={item.cantidad_reservar}
                          onChange={(e) => handleItemUpdate(item.menaje_id, "cantidad_reservar", Number(e.target.value))}
                        />
                      ) : (
                        <span className="font-medium text-slate-900">
                          {item.cantidad_reservar.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-slate-600">${item.precio_alquiler.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-900">
                      ${subtotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="bg-blue-50 rounded-lg p-4 text-right">
            <p className="text-xs text-blue-600 mb-1">Total Estimado Alquiler</p>
            <p className="text-xl font-semibold text-blue-700">${totalCalculado.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Read-only status indicators for non-borrador states */}
      {reserva.estado === "confirmado" && (
        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
          <CheckCircle className="h-4 w-4" /> Orden confirmada — pendiente despacho desde Bodega
        </div>
      )}
      {reserva.estado === "devuelto" && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
          <Package className="h-4 w-4" /> Menaje devuelto
        </div>
      )}
    </div>
  );
}
