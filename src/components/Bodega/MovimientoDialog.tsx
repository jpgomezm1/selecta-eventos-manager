import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { MenajeMovimiento, SalidaConEvento } from "@/types/menaje";
import { menajeCatalogoList, readReserva, getSalidasConfirmadas } from "@/integrations/supabase/apiMenaje";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Calendar,
  FileText,
  Package,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Save,
  X,
  MapPin,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

type EventoConReserva = {
  evento_id: string;
  nombre_evento: string;
  fecha_evento: string;
  reserva_id: string;
};

type DialogItem = {
  menaje_id: string;
  cantidad: number;
  merma: number;
  nota: string;
  cantidad_esperada?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  movimiento: MenajeMovimiento & { items: Array<{ menaje_id: string; cantidad: number; merma?: number; nota?: string }> };
  onSave: (mov: MenajeMovimiento, items: Array<{ menaje_id: string; cantidad: number; merma?: number; nota?: string }>) => void;
};

export default function MovimientoDialog({ open, onOpenChange, movimiento, onSave }: Props) {
  const [mov, setMov] = useState(movimiento);
  const [items, setItems] = useState<DialogItem[]>([]);
  const [autoPopulated, setAutoPopulated] = useState(false);
  const [selectedSalidaId, setSelectedSalidaId] = useState<string | null>(null);

  const { data: catalogo } = useQuery({ queryKey: ["menaje-catalogo"], queryFn: menajeCatalogoList });

  // Fetch events with confirmed/active menaje reservations (for salida selector)
  const { data: eventosConReserva } = useQuery({
    queryKey: ["eventos-con-reserva-menaje"],
    queryFn: async (): Promise<EventoConReserva[]> => {
      const { data, error } = await supabase
        .from("menaje_reservas")
        .select("id, evento_id, estado, eventos!inner(id, nombre_evento, fecha_evento)")
        .in("estado", ["confirmado", "borrador"])
        .not("evento_id", "is", null);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        evento_id: r.evento_id,
        nombre_evento: r.eventos?.nombre_evento ?? "",
        fecha_evento: r.eventos?.fecha_evento ?? "",
        reserva_id: r.id,
      }));
    },
  });

  // Fetch confirmed salidas for ingreso selector
  const { data: salidasConfirmadas } = useQuery({
    queryKey: ["salidas-confirmadas"],
    queryFn: getSalidasConfirmadas,
    enabled: mov.tipo === "ingreso",
  });

  // Fetch reservation items when salida and reserva_id is set (for auto-populating)
  const { data: reservaData } = useQuery({
    queryKey: ["reserva-for-mov", mov.reserva_id],
    queryFn: () => readReserva(mov.reserva_id!),
    enabled: mov.tipo === "salida" && !!mov.reserva_id && !mov.id,
  });

  // Initialize from prop
  useEffect(() => {
    setMov(movimiento);
    setItems(
      (movimiento.items ?? []).map((i) => ({
        menaje_id: i.menaje_id,
        cantidad: i.cantidad,
        merma: i.merma ?? 0,
        nota: i.nota ?? "",
      }))
    );
    setAutoPopulated(false);
    setSelectedSalidaId(null);
  }, [movimiento]);

  // Auto-populate salida items from reservation
  useEffect(() => {
    if (
      mov.tipo === "salida" &&
      reservaData &&
      reservaData.items.length > 0 &&
      !mov.id && // only for new movements
      !autoPopulated
    ) {
      const newItems: DialogItem[] = reservaData.items.map((ri) => ({
        menaje_id: ri.menaje_id,
        cantidad: ri.cantidad,
        merma: 0,
        nota: "",
        cantidad_esperada: ri.cantidad,
      }));
      setItems(newItems);
      setAutoPopulated(true);
    }
  }, [reservaData, mov.tipo, mov.id, autoPopulated]);

  // Auto-populate ingreso items from selected salida
  const handleSelectSalida = (salidaId: string) => {
    if (salidaId === "__none__") {
      setSelectedSalidaId(null);
      setMov({ ...mov, evento_id: null, reserva_id: null } as any);
      setItems([]);
      setAutoPopulated(false);
      return;
    }
    const salida = salidasConfirmadas?.find((s) => s.movimiento_id === salidaId);
    if (!salida) return;

    setSelectedSalidaId(salidaId);
    setMov({ ...mov, evento_id: salida.evento_id, reserva_id: salida.reserva_id } as any);

    const newItems: DialogItem[] = salida.items.map((si) => ({
      menaje_id: si.menaje_id,
      cantidad: si.cantidad, // default: everything returned
      merma: 0,
      nota: "",
      cantidad_esperada: si.cantidad,
    }));
    setItems(newItems);
    setAutoPopulated(true);
  };

  const catalogForSelect = useMemo(() => {
    const taken = new Set(items.map((i) => i.menaje_id));
    return (catalogo ?? []).filter((c) => !taken.has(c.id));
  }, [catalogo, items]);

  const addItem = (id: string) => {
    setItems((prev) => [...prev, { menaje_id: id, cantidad: 1, merma: 0, nota: "" }]);
  };

  const updateItem = (id: string, patch: Partial<DialogItem>) =>
    setItems((prev) => prev.map((i) => (i.menaje_id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.menaje_id !== id));

  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);
  const totalMerma = items.reduce((sum, item) => sum + (item.merma || 0), 0);

  // Discrepancy calculations
  const itemsConFaltante = items.filter((i) => {
    if (!i.cantidad_esperada) return false;
    const faltante = i.cantidad_esperada - i.cantidad - (i.merma || 0);
    return faltante > 0;
  });

  const itemsConMerma = items.filter((i) => (i.merma || 0) > 0);

  const itemsConDiscrepanciaSalida = items.filter((i) => {
    if (!i.cantidad_esperada) return false;
    return i.cantidad !== i.cantidad_esperada;
  });

  // Validation
  const hasDiscrepancyWithoutNote =
    autoPopulated &&
    items.some((i) => {
      if (!i.cantidad_esperada) return false;
      const faltante = i.cantidad_esperada - i.cantidad - (i.merma || 0);
      const hasDiff =
        mov.tipo === "ingreso"
          ? faltante > 0 || (i.merma || 0) > 0
          : i.cantidad < i.cantidad_esperada;
      return hasDiff && !i.nota.trim();
    });

  // Si se va a guardar como confirmado, la salida no puede exceder el stock
  // disponible (el warning ya existía pero no bloqueaba el submit).
  const stockInsuficienteAlConfirmar =
    mov.tipo === "salida" &&
    mov.estado === "confirmado" &&
    items.some((i) => {
      const c = catalogo?.find((x) => x.id === i.menaje_id);
      return !!c && i.cantidad + (i.merma || 0) > c.stock_total;
    });

  const isValid =
    !!mov.fecha && items.length > 0 && !hasDiscrepancyWithoutNote && !stockInsuficienteAlConfirmar;

  // Find the selected salida's event name for read-only display
  const selectedSalida = salidasConfirmadas?.find((s) => s.movimiento_id === selectedSalidaId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <DialogTitle className="flex items-center space-x-3">
            <div className={cn(
              "p-2 rounded-lg",
              mov.tipo === "ingreso" ? "bg-green-100" : "bg-red-100"
            )}>
              {mov.tipo === "ingreso" ? (
                <ArrowUp className="h-5 w-5 text-green-600" />
              ) : (
                <ArrowDown className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {mov.id ? "Editar" : "Nuevo"} {mov.tipo === "ingreso" ? "Ingreso" : "Salida"}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {mov.tipo === "ingreso" ? "Registrar entrada de inventario" : "Registrar salida de inventario"}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 p-1">
          {/* Informacion general */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-slate-800">
                <Calendar className="h-4 w-4" />
                <span>Información General</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Fecha</label>
                  <Input
                    type="date"
                    value={mov.fecha}
                    onChange={(e) => setMov({ ...mov, fecha: e.target.value })}
                    className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Estado</label>
                  <Select value={mov.estado} onValueChange={(v) => setMov({ ...mov, estado: v as any })}>
                    <SelectTrigger className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="borrador">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-amber-400 rounded-full" />
                          <span>Borrador</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="confirmado">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full" />
                          <span>Confirmado</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="cancelado">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-400 rounded-full" />
                          <span>Cancelado</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo</label>
                  <div className="p-3 bg-white rounded-lg border border-slate-300">
                    <Badge className={cn(
                      "flex items-center space-x-1 w-fit",
                      mov.tipo === "ingreso" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
                    )}>
                      {mov.tipo === "ingreso" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      <span className="capitalize font-medium">{mov.tipo}</span>
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Selector: Evento (salida) or Orden de Salida (ingreso) */}
              <div className="mt-4 space-y-2">
                {mov.tipo === "ingreso" ? (
                  <>
                    <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>Orden de Salida</span>
                    </label>
                    <Select
                      value={selectedSalidaId ?? "__none__"}
                      onValueChange={handleSelectSalida}
                    >
                      <SelectTrigger className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20">
                        <SelectValue placeholder="Seleccionar orden de salida..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-slate-500">Sin orden de salida (ingreso manual)</span>
                        </SelectItem>
                        {(salidasConfirmadas ?? []).map((s) => (
                          <SelectItem key={s.movimiento_id} value={s.movimiento_id}>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{s.nombre_evento}</span>
                              <span className="text-xs text-slate-500">{s.fecha}</span>
                              <span className="text-xs text-slate-400">({s.items.length} items)</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedSalida && (
                      <div className="flex items-center space-x-2 mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                        <Info className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-blue-700">
                          Evento: <strong>{selectedSalida.nombre_evento}</strong> ({selectedSalida.fecha})
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>Evento (Orden de Menaje)</span>
                    </label>
                    <Select
                      value={mov.evento_id ?? "__none__"}
                      onValueChange={(v) => {
                        if (v === "__none__") {
                          setMov({ ...mov, evento_id: null, reserva_id: null } as any);
                          setItems([]);
                          setAutoPopulated(false);
                        } else {
                          const match = eventosConReserva?.find((e) => e.evento_id === v);
                          setMov({ ...mov, evento_id: v, reserva_id: match?.reserva_id ?? null } as any);
                          // Auto-populate will happen via useEffect when reservaData loads
                          setAutoPopulated(false);
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20">
                        <SelectValue placeholder="Seleccionar evento..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          <span className="text-slate-500">Sin evento asociado</span>
                        </SelectItem>
                        {(eventosConReserva ?? []).map((ev) => (
                          <SelectItem key={ev.evento_id} value={ev.evento_id}>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{ev.nombre_evento}</span>
                              <span className="text-xs text-slate-500">{ev.fecha_evento}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Notas</span>
                </label>
                <Input
                  placeholder="Descripción opcional del movimiento..."
                  value={mov.notas ?? ""}
                  onChange={(e) => setMov({ ...mov, notas: e.target.value })}
                  className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
            </CardContent>
          </Card>

          {/* Discrepancy alerts */}
          {autoPopulated && mov.tipo === "ingreso" && itemsConFaltante.length > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-red-700 text-sm font-medium">
                  Hay {itemsConFaltante.length} item(s) con faltante. Se requiere nota por cada diferencia.
                </span>
              </div>
            </div>
          )}

          {autoPopulated && mov.tipo === "ingreso" && itemsConFaltante.length === 0 && itemsConMerma.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-amber-700 text-sm font-medium">
                  Se registrará merma en {itemsConMerma.length} item(s).
                </span>
              </div>
            </div>
          )}

          {autoPopulated && mov.tipo === "salida" && itemsConDiscrepanciaSalida.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <Info className="h-4 w-4 text-amber-600" />
                <span className="text-amber-700 text-sm font-medium">
                  {itemsConDiscrepanciaSalida.length} item(s) difieren de la cantidad reservada. Se requiere nota.
                </span>
              </div>
            </div>
          )}

          {/* Agregar elementos */}
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2 text-slate-800">
                  <Package className="h-4 w-4" />
                  <span>Elementos del Movimiento</span>
                </CardTitle>

                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center space-x-1 bg-blue-50 px-3 py-1 rounded-lg">
                    <span className="text-blue-600 font-medium">{items.length}</span>
                    <span className="text-blue-600">elementos</span>
                  </div>
                  <div className="flex items-center space-x-1 bg-emerald-50 px-3 py-1 rounded-lg">
                    <span className="text-emerald-600 font-medium">{totalItems}</span>
                    <span className="text-emerald-600">unidades</span>
                  </div>
                  {totalMerma > 0 && (
                    <div className="flex items-center space-x-1 bg-amber-50 px-3 py-1 rounded-lg">
                      <span className="text-amber-600 font-medium">{totalMerma}</span>
                      <span className="text-amber-600">merma</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="flex gap-3 mb-6">
                <Select onValueChange={(v) => addItem(v)} disabled={catalogForSelect.length === 0}>
                  <SelectTrigger className="flex-1 bg-slate-50 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20">
                    <SelectValue placeholder={
                      catalogForSelect.length === 0
                        ? "No hay más elementos disponibles"
                        : "Agregar elemento adicional..."
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {catalogForSelect.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="py-3">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-2">
                            <Package className="h-4 w-4 text-slate-400" />
                            <span className="font-medium">{c.nombre}</span>
                          </div>
                          <div className="text-xs text-slate-500 ml-4">
                            Stock: {c.stock_total} {c.unidad}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tabla de elementos */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-slate-200">
                      <TableHead className="font-semibold text-slate-700">Elemento</TableHead>
                      {autoPopulated && (
                        <TableHead className="font-semibold text-slate-700 text-center">
                          {mov.tipo === "salida" ? "Reservado" : "Despachado"}
                        </TableHead>
                      )}
                      <TableHead className="font-semibold text-slate-700 text-center">Cantidad</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-center">Merma</TableHead>
                      {autoPopulated && mov.tipo === "ingreso" && (
                        <TableHead className="font-semibold text-slate-700 text-center">Faltante</TableHead>
                      )}
                      <TableHead className="font-semibold text-slate-700">Nota</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-center">Stock</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center">
                          <div className="flex flex-col items-center space-y-3">
                            <Package className="h-8 w-8 text-slate-300" />
                            <div>
                              <h3 className="font-medium text-slate-700">Sin elementos</h3>
                              <p className="text-sm text-slate-500 mt-1">
                                {mov.tipo === "ingreso" && !selectedSalidaId
                                  ? "Selecciona una orden de salida o agrega elementos manualmente"
                                  : mov.tipo === "salida" && !mov.evento_id
                                  ? "Selecciona un evento o agrega elementos manualmente"
                                  : "Selecciona elementos para incluir en este movimiento"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((i) => {
                        const c = catalogo?.find((x) => x.id === i.menaje_id);
                        const stockInsuficiente = mov.tipo === "salida" && c && (i.cantidad + (i.merma || 0)) > c.stock_total;
                        const faltante = i.cantidad_esperada
                          ? Math.max(0, i.cantidad_esperada - i.cantidad - (i.merma || 0))
                          : 0;
                        const hasDiff =
                          mov.tipo === "ingreso"
                            ? faltante > 0 || (i.merma || 0) > 0
                            : i.cantidad_esperada != null && i.cantidad < i.cantidad_esperada;
                        const needsNote = autoPopulated && hasDiff;

                        return (
                          <TableRow key={i.menaje_id} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Package className="h-4 w-4 text-slate-400" />
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {c?.nombre ?? "Elemento desconocido"}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {c?.categoria} • {c?.unidad}
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            {autoPopulated && (
                              <TableCell className="text-center">
                                <span className="font-medium text-slate-600">
                                  {i.cantidad_esperada ?? "—"}
                                </span>
                              </TableCell>
                            )}

                            <TableCell className="text-center">
                              <Input
                                className="w-20 text-center"
                                type="number"
                                min={0}
                                value={i.cantidad}
                                onChange={(e) => updateItem(i.menaje_id, { cantidad: Number(e.target.value) })}
                              />
                            </TableCell>

                            <TableCell className="text-center">
                              <Input
                                className="w-20 text-center"
                                type="number"
                                min={0}
                                value={i.merma}
                                onChange={(e) => updateItem(i.menaje_id, { merma: Number(e.target.value) })}
                              />
                            </TableCell>

                            {autoPopulated && mov.tipo === "ingreso" && (
                              <TableCell className="text-center">
                                <span className={cn(
                                  "font-bold",
                                  faltante > 0 ? "text-red-600" : "text-green-600"
                                )}>
                                  {faltante}
                                </span>
                              </TableCell>
                            )}

                            <TableCell>
                              <Input
                                className={cn(
                                  "w-32 text-sm",
                                  needsNote && !i.nota.trim() && "border-red-400 ring-1 ring-red-300"
                                )}
                                placeholder={needsNote ? "Requerida..." : "Opcional"}
                                value={i.nota}
                                onChange={(e) => updateItem(i.menaje_id, { nota: e.target.value })}
                              />
                            </TableCell>

                            <TableCell className="text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <span className={cn(
                                  "font-medium",
                                  stockInsuficiente ? "text-red-600" : "text-slate-700"
                                )}>
                                  {c?.stock_total ?? 0}
                                </span>
                                {stockInsuficiente && (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(i.menaje_id)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Stock alert for salida */}
              {mov.tipo === "salida" && items.some(i => {
                const c = catalogo?.find(x => x.id === i.menaje_id);
                return c && (i.cantidad + (i.merma || 0)) > c.stock_total;
              }) && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-red-700 text-sm font-medium">
                      Algunos elementos exceden el stock disponible
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            {!mov.fecha && "Ingrese una fecha"}
            {mov.fecha && items.length === 0 && "Agregue al menos un elemento"}
            {mov.fecha && items.length > 0 && hasDiscrepancyWithoutNote && "Agregue nota en los items con diferencia"}
            {mov.fecha && items.length > 0 && !hasDiscrepancyWithoutNote && stockInsuficienteAlConfirmar &&
              "No se puede confirmar: algunos elementos exceden el stock. Guarde como borrador o reduzca la cantidad."}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>

            <Button
              onClick={() => onSave(mov, items)}
              disabled={!isValid}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Movimiento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
