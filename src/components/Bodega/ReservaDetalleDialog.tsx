import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Package, Clock, Truck, RotateCcw, Calendar, AlertTriangle } from "lucide-react";
import {
  readReserva,
  despacharMenajeDesdeReserva,
  registrarDevolucionMenaje,
  getSalidaItemsForReserva,
} from "@/integrations/supabase/apiMenaje";
import type { MenajeReservaCal, MenajeReservaFull } from "@/types/menaje";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reservaCal: MenajeReservaCal;
  onUpdated: () => void;
};

type DespachoItem = {
  menaje_id: string;
  nombre: string;
  unidad: string;
  cantidad_reservada: number;
  cantidad_despachada: number;
  nota: string;
};

type DevolucionItem = {
  menaje_id: string;
  nombre: string;
  unidad: string;
  cantidad_despachada: number;
  cantidad_devuelta: number;
  merma: number;
  nota: string;
};

export default function ReservaDetalleDialog({ open, onOpenChange, reservaCal, onUpdated }: Props) {
  const { toast } = useToast();
  const [reservaFull, setReservaFull] = useState<MenajeReservaFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [despachado, setDespachado] = useState(false);
  const [estado, setEstado] = useState(reservaCal.estado);

  // Despacho
  const [showDespacho, setShowDespacho] = useState(false);
  const [despachoItems, setDespachoItems] = useState<DespachoItem[]>([]);
  const [dispatching, setDispatching] = useState(false);

  // Devolucion
  const [showDevolucion, setShowDevolucion] = useState(false);
  const [devolucionItems, setDevolucionItems] = useState<DevolucionItem[]>([]);
  const [returning, setReturning] = useState(false);

  const loadDetalle = useCallback(async () => {
    setLoading(true);
    setEstado(reservaCal.estado);
    try {
      const rf = await readReserva(reservaCal.reserva_id);
      setReservaFull(rf);

      // Check if dispatched
      const { data: salidaMov } = await supabase
        .from("menaje_movimientos")
        .select("id")
        .eq("reserva_id", reservaCal.reserva_id)
        .eq("tipo", "salida")
        .limit(1)
        .maybeSingle();
      setDespachado(!!salidaMov);
    } catch (err) {
      toast({ title: "Error", description: (err as Error)?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [reservaCal.reserva_id, reservaCal.estado, toast]);

  useEffect(() => {
    if (open) {
      setShowDespacho(false);
      setShowDevolucion(false);
      loadDetalle();
    }
  }, [open, loadDetalle]);

  // ---- Despacho ----

  const handleStartDespacho = () => {
    if (!reservaFull) return;
    setDespachoItems(
      reservaFull.items.map((i) => ({
        menaje_id: i.menaje_id,
        nombre: i.menaje?.nombre ?? "",
        unidad: i.menaje?.unidad ?? "und",
        cantidad_reservada: Number(i.cantidad) || 0,
        cantidad_despachada: Number(i.cantidad) || 0,
        nota: "",
      }))
    );
    setShowDespacho(true);
  };

  const despachoNotaRequired = (item: DespachoItem) =>
    item.cantidad_despachada < item.cantidad_reservada;

  const despachoValid = () =>
    despachoItems.every(
      (it) => !despachoNotaRequired(it) || it.nota.trim().length > 0
    );

  const handleConfirmDespacho = async () => {
    if (!despachoValid()) {
      toast({
        title: "Notas requeridas",
        description: "Agrega una nota para cada item con despacho menor al reservado.",
        variant: "destructive",
      });
      return;
    }
    setDispatching(true);
    try {
      await despacharMenajeDesdeReserva(
        reservaCal.reserva_id,
        reservaCal.evento_id,
        despachoItems.map((it) => ({
          menaje_id: it.menaje_id,
          cantidad_reservada: it.cantidad_reservada,
          cantidad_despachada: it.cantidad_despachada,
          nota: it.nota || undefined,
        }))
      );
      setDespachado(true);
      setShowDespacho(false);
      toast({ title: "Menaje despachado", description: "Se registró la salida de menaje." });
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  };

  // ---- Devolucion ----

  const handleStartDevolucion = async () => {
    try {
      const salidaItems = await getSalidaItemsForReserva(reservaCal.reserva_id);
      if (salidaItems.length === 0) {
        toast({ title: "Sin salida", description: "No se encontró despacho para esta reserva.", variant: "destructive" });
        return;
      }
      setDevolucionItems(
        salidaItems.map((i) => ({
          menaje_id: i.menaje_id,
          nombre: i.nombre,
          unidad: i.unidad,
          cantidad_despachada: i.cantidad_despachada,
          cantidad_devuelta: i.cantidad_despachada,
          merma: 0,
          nota: "",
        }))
      );
      setShowDevolucion(true);
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getFaltante = (item: DevolucionItem) =>
    Math.max(0, item.cantidad_despachada - item.cantidad_devuelta - item.merma);

  const devolucionNotaRequired = (item: DevolucionItem) =>
    getFaltante(item) > 0 || item.merma > 0;

  const devolucionValid = () =>
    devolucionItems.every(
      (it) => !devolucionNotaRequired(it) || it.nota.trim().length > 0
    );

  const handleConfirmDevolucion = async () => {
    if (!devolucionValid()) {
      toast({
        title: "Notas requeridas",
        description: "Agrega una nota para cada item con merma o faltante.",
        variant: "destructive",
      });
      return;
    }
    setReturning(true);
    try {
      await registrarDevolucionMenaje(
        reservaCal.reserva_id,
        reservaCal.evento_id,
        devolucionItems.map((it) => ({
          menaje_id: it.menaje_id,
          cantidad_despachada: it.cantidad_despachada,
          cantidad_devuelta: it.cantidad_devuelta,
          merma: it.merma,
          nota: it.nota || undefined,
        }))
      );
      setEstado("devuelto");
      setShowDevolucion(false);
      toast({ title: "Devolución registrada", description: "Menaje devuelto y ajustes de stock aplicados." });
      onUpdated();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setReturning(false);
    }
  };

  // ---- Render helpers ----

  const estadoBadge = (est: string) => {
    const map: Record<string, { cls: string; icon: React.ReactNode }> = {
      borrador: { cls: "bg-slate-100 text-slate-700", icon: <Clock className="h-3 w-3 mr-1" /> },
      confirmado: { cls: "bg-blue-50 text-blue-700", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      devuelto: { cls: "bg-emerald-50 text-emerald-700", icon: <Package className="h-3 w-3 mr-1" /> },
    };
    const c = map[est] ?? map.borrador;
    return (
      <Badge variant="secondary" className={c.cls}>
        {c.icon}
        {est.charAt(0).toUpperCase() + est.slice(1)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-slate-600" />
            {reservaCal.nombre_evento}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              {reservaCal.fecha_inicio === reservaCal.fecha_fin
                ? reservaCal.fecha_inicio
                : `${reservaCal.fecha_inicio} → ${reservaCal.fecha_fin}`}
            </div>
            <div className="flex items-center gap-2">
              {estadoBadge(estado)}
              {despachado && estado !== "devuelto" && (
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                  <CheckCircle className="h-3 w-3 mr-1" /> Despachado
                </Badge>
              )}
            </div>
          </div>

          {/* Items table (read-only) */}
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>
          ) : reservaFull && reservaFull.items.length > 0 ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="font-medium">Item</TableHead>
                    <TableHead className="font-medium">Unidad</TableHead>
                    <TableHead className="text-right font-medium">Cantidad Reservada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservaFull.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium text-slate-900">{it.menaje?.nombre ?? it.menaje_id}</TableCell>
                      <TableCell className="text-slate-600">{it.menaje?.unidad ?? "und"}</TableCell>
                      <TableCell className="text-right font-medium">{Number(it.cantidad)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">Sin items en la reserva</p>
          )}

          {/* Actions */}
          {!showDespacho && !showDevolucion && (
            <div className="flex justify-end gap-2">
              {estado === "confirmado" && !despachado && (
                <Button size="sm" onClick={handleStartDespacho}>
                  <Truck className="h-3.5 w-3.5 mr-1" />
                  Aprobar Despacho
                </Button>
              )}
              {despachado && estado !== "devuelto" && (
                <Button size="sm" variant="outline" onClick={handleStartDevolucion}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Registrar Devolución
                </Button>
              )}
              {estado === "devuelto" && (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <Package className="h-4 w-4" /> Menaje devuelto
                </div>
              )}
            </div>
          )}

          {/* ===== DESPACHO FORM ===== */}
          {showDespacho && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-blue-900 flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4" /> Confirmar Despacho
              </h3>
              <p className="text-xs text-blue-700">
                Confirma la cantidad real a despachar. Si es menor a lo reservado, indica el motivo.
              </p>
              <div className="border border-blue-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-100/50 hover:bg-blue-100/50">
                      <TableHead className="font-medium text-xs">Item</TableHead>
                      <TableHead className="text-center font-medium text-xs">Reservado</TableHead>
                      <TableHead className="text-center font-medium text-xs">A Despachar</TableHead>
                      <TableHead className="font-medium text-xs">Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despachoItems.map((di, idx) => {
                      const needsNota = despachoNotaRequired(di);
                      return (
                        <TableRow key={di.menaje_id}>
                          <TableCell className="font-medium text-slate-900 text-sm">
                            {di.nombre}
                            <span className="text-slate-400 text-xs ml-1">({di.unidad})</span>
                          </TableCell>
                          <TableCell className="text-center text-slate-600">{di.cantidad_reservada}</TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={0}
                              max={di.cantidad_reservada}
                              className="w-20 text-center h-7 mx-auto text-sm"
                              value={di.cantidad_despachada}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(di.cantidad_reservada, Number(e.target.value) || 0));
                                setDespachoItems((prev) =>
                                  prev.map((p, i) => i === idx ? { ...p, cantidad_despachada: val } : p)
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder={needsNota ? "Requerido..." : "Opcional"}
                              className={`h-7 text-sm ${needsNota && !di.nota.trim() ? "border-red-400 bg-red-50" : ""}`}
                              value={di.nota}
                              onChange={(e) =>
                                setDespachoItems((prev) =>
                                  prev.map((p, i) => i === idx ? { ...p, nota: e.target.value } : p)
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDespacho(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleConfirmDespacho} disabled={dispatching}>
                  {dispatching ? "Despachando..." : "Confirmar Despacho"}
                </Button>
              </div>
            </div>
          )}

          {/* ===== DEVOLUCION FORM ===== */}
          {showDevolucion && (
            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-amber-900 flex items-center gap-2 text-sm">
                <RotateCcw className="h-4 w-4" /> Registrar Devolución
              </h3>
              <p className="text-xs text-amber-700">
                Registra lo que regresó. Si hay merma o faltante, indica el motivo.
              </p>
              <div className="border border-amber-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-100/50 hover:bg-amber-100/50">
                      <TableHead className="font-medium text-xs">Item</TableHead>
                      <TableHead className="text-center font-medium text-xs">Despachado</TableHead>
                      <TableHead className="text-center font-medium text-xs">Devuelto</TableHead>
                      <TableHead className="text-center font-medium text-xs">Merma</TableHead>
                      <TableHead className="text-center font-medium text-xs">Faltante</TableHead>
                      <TableHead className="font-medium text-xs">Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devolucionItems.map((di, idx) => {
                      const faltante = getFaltante(di);
                      const needsNota = devolucionNotaRequired(di);
                      return (
                        <TableRow key={di.menaje_id}>
                          <TableCell className="font-medium text-slate-900 text-sm">
                            {di.nombre}
                            <span className="text-slate-400 text-xs ml-1">({di.unidad})</span>
                          </TableCell>
                          <TableCell className="text-center text-slate-600">{di.cantidad_despachada}</TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={0}
                              max={di.cantidad_despachada - di.merma}
                              className="w-16 text-center h-7 mx-auto text-sm"
                              value={di.cantidad_devuelta}
                              onChange={(e) => {
                                // Cap: devuelto + merma <= despachado.
                                const limite = di.cantidad_despachada - di.merma;
                                const val = Math.max(0, Math.min(limite, Number(e.target.value) || 0));
                                setDevolucionItems((prev) =>
                                  prev.map((p, i) => i === idx ? { ...p, cantidad_devuelta: val } : p)
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={0}
                              max={di.cantidad_despachada - di.cantidad_devuelta}
                              className="w-16 text-center h-7 mx-auto text-sm"
                              value={di.merma}
                              onChange={(e) => {
                                // Cap: devuelto + merma <= despachado. Si excede, recorta merma.
                                const limite = di.cantidad_despachada - di.cantidad_devuelta;
                                const val = Math.max(0, Math.min(limite, Number(e.target.value) || 0));
                                setDevolucionItems((prev) =>
                                  prev.map((p, i) => i === idx ? { ...p, merma: val } : p)
                                );
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {faltante > 0 ? (
                              <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-sm">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {faltante}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-sm">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              placeholder={needsNota ? "Requerido..." : "Opcional"}
                              className={`h-7 text-sm min-w-[120px] ${needsNota && !di.nota.trim() ? "border-red-400 bg-red-50" : ""}`}
                              value={di.nota}
                              onChange={(e) =>
                                setDevolucionItems((prev) =>
                                  prev.map((p, i) => i === idx ? { ...p, nota: e.target.value } : p)
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowDevolucion(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleConfirmDevolucion} disabled={returning}>
                  {returning ? "Registrando..." : "Confirmar Devolución"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
