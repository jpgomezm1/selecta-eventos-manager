import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UtensilsCrossed, Plus, AlertTriangle, CheckCircle, Package, Clock, Save, Truck, RotateCcw } from "lucide-react";
import {
  menajeDisponiblePorRango,
  getOrCreateReservaForEvento,
  readReserva,
  saveReservaItems,
  setReservaEstado,
  despacharMenajeDesdeReserva,
  registrarDevolucionMenaje,
} from "@/integrations/supabase/apiMenaje";
import { supabase } from "@/integrations/supabase/client";
import type { MenajeDisponible, MenajeReserva } from "@/types/menaje";

type Props = {
  eventoId: string;
  fechaEvento: string;
};

export default function MenajePanel({ eventoId, fechaEvento }: Props) {
  const { toast } = useToast();
  const [disponibles, setDisponibles] = useState<MenajeDisponible[]>([]);
  const [reserva, setReserva] = useState<MenajeReserva | null>(null);
  const [items, setItems] = useState<Array<{ menaje_id: string; nombre: string; unidad: string; cantidad: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [despachado, setDespachado] = useState(false);
  const [showDevolucion, setShowDevolucion] = useState(false);
  const [devolucionItems, setDevolucionItems] = useState<Array<{ menaje_id: string; nombre: string; cantidad_original: number; cantidad_devuelta: number; merma: number }>>([]);
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await getOrCreateReservaForEvento(eventoId, fechaEvento);
        setReserva(r);
        const disp = await menajeDisponiblePorRango(r.fecha_inicio, r.fecha_fin);
        setDisponibles(disp);
        const rf = await readReserva(r.id);
        const mapped = rf.items.map((it: any) => ({
          menaje_id: it.menaje_id,
          nombre: it.menaje?.nombre ?? "",
          unidad: it.menaje?.unidad ?? "unidad",
          cantidad: it.cantidad,
        }));
        setItems(mapped);
        // Check if already dispatched
        const { data: salidaMov } = await supabase
          .from("menaje_movimientos")
          .select("id")
          .eq("reserva_id", r.id)
          .eq("tipo", "salida")
          .limit(1)
          .maybeSingle();
        setDespachado(!!salidaMov);
      } catch (err: any) {
        toast({ title: "Error", description: err.message ?? "No se pudo cargar menaje.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventoId, fechaEvento, toast]);

  const catalogForSelect = useMemo(() => {
    const taken = new Set(items.map((i) => i.menaje_id));
    return disponibles.filter((d) => !taken.has(d.id));
  }, [disponibles, items]);

  const disponibilidadById = useMemo(() => {
    const m = new Map<string, MenajeDisponible>();
    disponibles.forEach((d) => m.set(d.id, d));
    return m;
  }, [disponibles]);

  const handleAddItem = (menaje_id: string) => {
    const ref = disponibilidadById.get(menaje_id);
    if (!ref) return;
    setItems((prev) => [...prev, { menaje_id, nombre: ref.nombre, unidad: ref.unidad, cantidad: 1 }]);
  };

  const handleQty = (menaje_id: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.menaje_id === menaje_id ? { ...i, cantidad: Math.max(0, qty) } : i)));
  };

  const handleRemove = (menaje_id: string) => {
    setItems((prev) => prev.filter((i) => i.menaje_id !== menaje_id));
  };

  function getOriginalQty(menaje_id: string) {
    const rec = (reserva as any)?._baseline_items as Array<{ menaje_id: string; cantidad: number }> | undefined;
    if (!rec) return 0;
    return rec.find((x) => x.menaje_id === menaje_id)?.cantidad ?? 0;
  }

  const overbookWarnings = items.filter((i) => {
    const ref = disponibilidadById.get(i.menaje_id);
    if (!ref) return false;
    return i.cantidad > ref.disponible + (getOriginalQty(i.menaje_id) ?? 0);
  });

  const handleSave = async () => {
    if (!reserva) return;
    if (overbookWarnings.length > 0) {
      toast({ title: "Sin disponibilidad", description: "Hay items que superan la disponibilidad.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveReservaItems(
        reserva.id,
        items.filter((i) => i.cantidad > 0).map((i) => ({ menaje_id: i.menaje_id, cantidad: i.cantidad }))
      );
      toast({ title: "Reserva guardada", description: "El menaje quedó bloqueado para la fecha del evento." });
      const disp = await menajeDisponiblePorRango(reserva.fecha_inicio, reserva.fecha_fin);
      setDisponibles(disp);
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo guardar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEstado = async (estado: MenajeReserva["estado"]) => {
    if (!reserva) return;
    try {
      await setReservaEstado(reserva.id, estado);
      setReserva({ ...reserva, estado });
      toast({ title: "Estado actualizado", description: `Reserva en estado "${estado}".` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo actualizar.", variant: "destructive" });
    }
  };

  const handleDespacharMenaje = async () => {
    if (!reserva) return;
    setDispatching(true);
    try {
      await despacharMenajeDesdeReserva(reserva.id, eventoId);
      setDespachado(true);
      toast({ title: "Menaje despachado", description: "Se registró la salida de menaje para el evento." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDispatching(false);
    }
  };

  const handleStartDevolucion = () => {
    setDevolucionItems(
      items.map((i) => ({
        menaje_id: i.menaje_id,
        nombre: i.nombre,
        cantidad_original: i.cantidad,
        cantidad_devuelta: i.cantidad,
        merma: 0,
      }))
    );
    setShowDevolucion(true);
  };

  const handleConfirmDevolucion = async () => {
    if (!reserva) return;
    setReturning(true);
    try {
      await registrarDevolucionMenaje(
        reserva.id,
        eventoId,
        devolucionItems.map((i) => ({
          menaje_id: i.menaje_id,
          cantidad_devuelta: i.cantidad_devuelta,
          merma: i.merma,
        }))
      );
      setReserva({ ...reserva, estado: "devuelto" });
      setShowDevolucion(false);
      toast({ title: "Devolución registrada", description: "El menaje fue devuelto y las mermas aplicadas al inventario." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setReturning(false);
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

  return (
    <Card>
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5 text-slate-600" />
            <h2 className="font-semibold text-slate-900">Gestión de Menaje</h2>
          </div>
          {reserva && estadoBadge(reserva.estado)}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Add item */}
        <div className="flex gap-3">
          <Select onValueChange={(v) => handleAddItem(v)}>
            <SelectTrigger className="flex-1 h-10">
              <SelectValue placeholder={loading ? "Cargando inventario..." : "Selecciona menaje para reservar"} />
            </SelectTrigger>
            <SelectContent>
              {catalogForSelect.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">Sin items disponibles</div>
              ) : (
                catalogForSelect.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nombre} — Disp: {d.disponible}/{d.stock_total} {d.unidad}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-medium">Item</TableHead>
                <TableHead className="font-medium">Unidad</TableHead>
                <TableHead className="text-center font-medium">Disponible</TableHead>
                <TableHead className="text-center font-medium">Cantidad</TableHead>
                <TableHead className="text-right font-medium">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <UtensilsCrossed className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-slate-900 font-medium">Sin menaje reservado</p>
                    <p className="text-sm text-slate-500 mt-1">Agrega items necesarios para el evento</p>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((i) => {
                  const ref = disponibilidadById.get(i.menaje_id);
                  const disp = ref ? ref.disponible + (getOriginalQty(i.menaje_id) ?? 0) : 0;
                  const over = i.cantidad > disp;
                  return (
                    <TableRow key={i.menaje_id}>
                      <TableCell className="font-medium text-slate-900">{i.nombre}</TableCell>
                      <TableCell className="text-slate-600">{i.unidad}</TableCell>
                      <TableCell className="text-center">
                        {ref ? (
                          <span className={disp > 0 ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                            {disp}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Input
                            type="number"
                            min={0}
                            className={`w-20 text-center h-8 ${over ? "border-red-300 bg-red-50" : ""}`}
                            value={i.cantidad}
                            onChange={(e) => handleQty(i.menaje_id, Number(e.target.value))}
                          />
                          {over && (
                            <span className="text-xs text-red-600 flex items-center gap-0.5">
                              <AlertTriangle className="h-3 w-3" /> Sin stock
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleRemove(i.menaje_id)} className="h-8 text-slate-500 hover:text-red-600 hover:bg-red-50">
                          Quitar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Status & actions */}
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-xl font-semibold text-slate-900">{items.length}</div>
                <div className="text-xs text-slate-500">Items</div>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Estado:</span>
                {reserva && estadoBadge(reserva.estado)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => handleEstado("borrador")} disabled={!reserva || reserva.estado === "borrador"}>
                <Clock className="h-3.5 w-3.5 mr-1" /> Borrador
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleEstado("confirmado")} disabled={!reserva || reserva.estado === "confirmado"}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Confirmar
              </Button>
              {reserva?.estado === "confirmado" && !despachado && (
                <Button variant="outline" size="sm" onClick={handleDespacharMenaje} disabled={dispatching}>
                  <Truck className="h-3.5 w-3.5 mr-1" /> {dispatching ? "Despachando..." : "Despachar Menaje"}
                </Button>
              )}
              {despachado && reserva?.estado !== "devuelto" && (
                <Button variant="outline" size="sm" onClick={handleStartDevolucion}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Registrar Devolución
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving || !reserva} size="sm">
                {saving ? "Guardando..." : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1" /> Guardar Reserva
                  </>
                )}
              </Button>
            </div>
          </div>

          {overbookWarnings.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Inventario insuficiente</p>
                <p className="text-xs text-red-700">{overbookWarnings.length} item(s) superan la disponibilidad.</p>
              </div>
            </div>
          )}
        </div>

        {/* Devolución inline form */}
        {showDevolucion && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-amber-900 flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Registrar Devolución de Menaje
            </h3>
            <div className="border border-amber-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-100/50 hover:bg-amber-100/50">
                    <TableHead className="font-medium">Item</TableHead>
                    <TableHead className="text-center font-medium">Original</TableHead>
                    <TableHead className="text-center font-medium">Devuelto</TableHead>
                    <TableHead className="text-center font-medium">Merma</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devolucionItems.map((di, idx) => (
                    <TableRow key={di.menaje_id}>
                      <TableCell className="font-medium text-slate-900">{di.nombre}</TableCell>
                      <TableCell className="text-center text-slate-600">{di.cantidad_original}</TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          max={di.cantidad_original}
                          className="w-20 text-center h-8 mx-auto"
                          value={di.cantidad_devuelta}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDevolucionItems((prev) =>
                              prev.map((p, i) => i === idx ? { ...p, cantidad_devuelta: val, merma: Math.max(0, p.cantidad_original - val) } : p)
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          className="w-20 text-center h-8 mx-auto"
                          value={di.merma}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDevolucionItems((prev) =>
                              prev.map((p, i) => i === idx ? { ...p, merma: val } : p)
                            );
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDevolucion(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleConfirmDevolucion} disabled={returning}>
                {returning ? "Registrando..." : "Confirmar Devolución"}
              </Button>
            </div>
          </div>
        )}

        {/* Dispatched indicator */}
        {despachado && reserva?.estado !== "devuelto" && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <CheckCircle className="h-4 w-4" /> Menaje despachado — pendiente devolución
          </div>
        )}
        {reserva?.estado === "devuelto" && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
            <Package className="h-4 w-4" /> Menaje devuelto
          </div>
        )}
      </div>
    </Card>
  );
}
