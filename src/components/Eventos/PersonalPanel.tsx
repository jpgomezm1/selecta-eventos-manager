import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  listPersonal,
  listEventoPersonal,
  addEventoPersonal,
  updateEventoPersonal,
  removeEventoPersonal,
} from "@/integrations/supabase/apiPersonal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Trash2, Users, Clock, AlertTriangle, CheckCircle, Save, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LiquidacionDialog } from "@/components/Forms/LiquidacionDialog";
import { calcularPagoPersonal, getModalidadCobroLabel, requiereRegistroHoras } from "@/lib/calcularPagoPersonal";
import type { Personal, PersonalAsignado, EventoConPersonal } from "@/types/database";

type Props = {
  eventoId: string;
  fechaEvento: string;
  estadoLiquidacion: "pendiente" | "liquidado";
  nombreEvento: string;
  ubicacion: string;
  onChanged?: () => void;
};

export default function PersonalPanel({ eventoId, fechaEvento, estadoLiquidacion, nombreEvento, ubicacion, onChanged }: Props) {
  const { toast } = useToast();
  const [catalogo, setCatalogo] = useState<Personal[]>([]);
  const [asignados, setAsignados] = useState<PersonalAsignado[]>([]);
  const [selectToAdd, setSelectToAdd] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [liquidacionEvento, setLiquidacionEvento] = useState<EventoConPersonal | null>(null);
  const [isLiquidacionOpen, setIsLiquidacionOpen] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catalog, assigned] = await Promise.all([
        listPersonal(),
        listEventoPersonal(eventoId),
      ]);
      setCatalogo(catalog);
      setAsignados(assigned);
    } catch (err) {
      toast({ title: "Error", description: err.message ?? "No se pudo cargar personal.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const noAsignadosCatalog = useMemo(
    () => catalogo.filter(p => !asignados.some(a => a.id === p.id)),
    [catalogo, asignados]
  );

  const totalCalculado = useMemo(
    () => asignados.reduce((acc, p) => acc + (Number(p.pago_calculado) || 0), 0),
    [asignados]
  );

  const sinHoras = useMemo(
    () => asignados.filter(p => requiereRegistroHoras(p.modalidad_cobro) && (!p.horas_trabajadas || p.horas_trabajadas <= 0)),
    [asignados]
  );

  const sinPagoExclusivo = useMemo(
    () => asignados.filter(p =>
      (!p.pago_calculado || Number(p.pago_calculado) <= 0) &&
      !(requiereRegistroHoras(p.modalidad_cobro) && (!p.horas_trabajadas || p.horas_trabajadas <= 0))
    ),
    [asignados]
  );

  const handleAdd = async () => {
    if (!selectToAdd) return;
    try {
      const persona = catalogo.find(p => p.id === selectToAdd);
      if (!persona) return;
      // Pre-calculate pago for fixed-rate workers (jornada, por_evento)
      const tarifa = Number(persona.tarifa) || 0;
      const pagoInicial = !requiereRegistroHoras(persona.modalidad_cobro) && tarifa > 0
        ? calcularPagoPersonal(persona.modalidad_cobro, tarifa)
        : null;
      await addEventoPersonal({
        evento_id: eventoId,
        personal_id: persona.id,
        estado_pago: "pendiente",
        ...(pagoInicial != null ? { pago_calculado: pagoInicial } : {}),
      });
      setSelectToAdd("");
      await fetchData();
      onChanged?.();
      toast({ title: "Personal asignado", description: `${persona.nombre_completo} agregado al evento.` });
    } catch (err) {
      toast({ title: "Error", description: err.message ?? "No se pudo asignar.", variant: "destructive" });
    }
  };

  const handleRemove = async (evento_personal_id: string) => {
    try {
      await removeEventoPersonal(evento_personal_id);
      await fetchData();
      onChanged?.();
    } catch (err) {
      toast({ title: "Error", description: err.message ?? "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const handleUpdateRow = (id: string, patch: Partial<PersonalAsignado>) => {
    setAsignados(prev => prev.map(p => (p.evento_personal_id === id ? { ...p, ...patch } : p)));
  };

  /** When hours change, auto-recalculate pago based on modalidad */
  const handleHorasChange = (epId: string, horas: number, person: PersonalAsignado) => {
    const tarifa = Number(person.tarifa) || 0;
    const tarifaExtra = Number(person.tarifa_hora_extra) || 0;
    const pago = calcularPagoPersonal(person.modalidad_cobro, tarifa, horas, tarifaExtra);
    handleUpdateRow(epId, { horas_trabajadas: horas, pago_calculado: pago });
  };

  const handleSaveRow = async (row: PersonalAsignado) => {
    if (!row.evento_personal_id) return;
    try {
      await updateEventoPersonal(row.evento_personal_id, {
        hora_inicio: row.hora_inicio || null,
        hora_fin: row.hora_fin || null,
        horas_trabajadas: row.horas_trabajadas != null ? Number(row.horas_trabajadas) : null,
        pago_calculado: row.pago_calculado != null ? Number(row.pago_calculado) : null,
        estado_pago: row.estado_pago || "pendiente",
        fecha_pago: row.fecha_pago || null,
        metodo_pago: row.metodo_pago || null,
        notas_pago: row.notas_pago || null,
      });
      toast({ title: "Guardado", description: `${row.nombre_completo}: cambios aplicados.` });
    } catch (err) {
      toast({ title: "Error", description: err.message ?? "No se pudo guardar.", variant: "destructive" });
      await fetchData();
    }
  };

  const handleLiquidar = () => {
    // Only require hours for workers paid by hour or jornada_hasta_10h
    const sinHoras = asignados.filter(p =>
      requiereRegistroHoras(p.modalidad_cobro) && (!p.horas_trabajadas || p.horas_trabajadas <= 0)
    );
    if (sinHoras.length > 0) {
      toast({
        title: "Información faltante",
        description: `${sinHoras.length} empleado(s) con cobro por hora no tienen horas definidas.`,
        variant: "destructive",
      });
      return;
    }
    // Check that all workers have a pago_calculado > 0
    const sinPago = asignados.filter(p => !p.pago_calculado || Number(p.pago_calculado) <= 0);
    if (sinPago.length > 0) {
      toast({
        title: "Pago faltante",
        description: `${sinPago.length} empleado(s) no tienen pago calculado.`,
        variant: "destructive",
      });
      return;
    }
    const evento: EventoConPersonal = {
      id: eventoId,
      nombre_evento: nombreEvento,
      ubicacion: ubicacion,
      fecha_evento: fechaEvento,
      descripcion: null,
      estado_liquidacion: estadoLiquidacion,
      personal: asignados,
      costo_total: totalCalculado,
    } as EventoConPersonal;
    setLiquidacionEvento(evento);
    setIsLiquidacionOpen(true);
  };

  const getRoleBadgeClass = (rol: string) => {
    const variants: Record<string, string> = {
      "Coordinador": "bg-purple-50 text-purple-700",
      "Chef": "bg-orange-50 text-orange-700",
      "Mesero": "bg-blue-50 text-blue-700",
      "Bartender": "bg-emerald-50 text-emerald-700",
      "Decorador": "bg-pink-50 text-pink-700",
      "Técnico de Sonido": "bg-indigo-50 text-indigo-700",
      "Fotógrafo": "bg-yellow-50 text-yellow-700",
      "Otro": "bg-slate-100 text-slate-700"
    };
    return variants[rol] || variants["Otro"];
  };

  return (
    <Card>
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" />
            <h2 className="font-semibold text-slate-900">Gestión de Personal</h2>
          </div>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
            {asignados.length} asignados
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Add personnel */}
        <div className="flex gap-3">
          <Select value={selectToAdd} onValueChange={setSelectToAdd}>
            <SelectTrigger className="flex-1 h-10">
              <SelectValue placeholder="Selecciona personal para asignar al evento" />
            </SelectTrigger>
            <SelectContent>
              {noAsignadosCatalog.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">Sin candidatos disponibles</div>
              ) : (
                noAsignadosCatalog.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre_completo} — {p.rol} · ${(Number(p.tarifa) || 0).toLocaleString()} ({getModalidadCobroLabel(p.modalidad_cobro)})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={!selectToAdd} size="sm" className="h-10">
            <Plus className="h-4 w-4 mr-2" />
            Asignar
          </Button>
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-medium">Empleado</TableHead>
                <TableHead className="font-medium">Rol</TableHead>
                <TableHead className="text-center font-medium">Inicio</TableHead>
                <TableHead className="text-center font-medium">Fin</TableHead>
                <TableHead className="text-center font-medium">Horas</TableHead>
                <TableHead className="text-right font-medium">Pago</TableHead>
                <TableHead className="text-center font-medium">Estado</TableHead>
                <TableHead className="text-right font-medium">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                      <span>Cargando personal...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : asignados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="h-6 w-6 text-slate-400" />
                    </div>
                    <p className="text-slate-900 font-medium">Sin personal asignado</p>
                    <p className="text-sm text-slate-500 mt-1">Comienza asignando empleados a este evento</p>
                  </TableCell>
                </TableRow>
              ) : (
                asignados.map((p) => (
                  <TableRow key={p.evento_personal_id} data-modalidad={p.modalidad_cobro}>
                    <TableCell>
                      <div>
                        <div className="font-medium text-slate-900">{p.nombre_completo}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-slate-500">
                            {getModalidadCobroLabel(p.modalidad_cobro)} · ${(Number(p.tarifa) || 0).toLocaleString()}{p.modalidad_cobro === 'por_hora' ? '/h' : ''}
                          </span>
                          {p.modalidad_cobro === 'jornada_hasta_10h' && Number(p.tarifa_hora_extra) > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-slate-400 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Hora extra: ${Number(p.tarifa_hora_extra).toLocaleString()}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getRoleBadgeClass(p.rol)}>{p.rol}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        className="w-28 text-center h-8"
                        value={p.hora_inicio ?? ""}
                        disabled={p.estado_pago === 'pagado'}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { hora_inicio: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        className="w-28 text-center h-8"
                        value={p.hora_fin ?? ""}
                        disabled={p.estado_pago === 'pagado'}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { hora_fin: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className={`w-20 text-center h-8 ${!requiereRegistroHoras(p.modalidad_cobro) ? 'opacity-60' : ''}`}
                        value={p.horas_trabajadas ?? (requiereRegistroHoras(p.modalidad_cobro) ? '' : 0)}
                        placeholder={requiereRegistroHoras(p.modalidad_cobro) ? 'Req.' : 'Opc.'}
                        disabled={p.estado_pago === 'pagado'}
                        onChange={(e) => handleHorasChange(p.evento_personal_id!, Number(e.target.value), p)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          className="w-28 text-right h-8 ml-auto"
                          value={p.pago_calculado ?? 0}
                          disabled={p.estado_pago === 'pagado'}
                          onChange={(e) => handleUpdateRow(p.evento_personal_id!, { pago_calculado: Number(e.target.value) })}
                        />
                        {!requiereRegistroHoras(p.modalidad_cobro) && (
                          <div className="text-[10px] text-emerald-600 text-right mt-0.5 mr-1">Tarifa fija</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={p.estado_pago ?? "pendiente"}
                        disabled={p.estado_pago === 'pagado'}
                        onValueChange={(v) => handleUpdateRow(p.evento_personal_id!, { estado_pago: v as PersonalAsignado["estado_pago"] })}
                      >
                        <SelectTrigger className="w-28 mx-auto h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">Pendiente</SelectItem>
                          <SelectItem value="pagado">Pagado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleSaveRow(p)} disabled={p.estado_pago === 'pagado'} className="h-8">
                          <Save className="h-3 w-3 mr-1" />
                          Guardar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRemove(p.evento_personal_id!)} disabled={p.estado_pago === 'pagado'} className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary & liquidation */}
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-xl font-semibold text-slate-900">{asignados.length}</div>
                <div className="text-xs text-slate-500">Empleados</div>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              {(() => {
                const porHora = asignados.filter(p => p.modalidad_cobro === 'por_hora').length;
                const porJornada = asignados.filter(p => ['jornada_9h', 'jornada_10h', 'jornada_hasta_10h', 'jornada_nocturna'].includes(p.modalidad_cobro)).length;
                const porEvento = asignados.filter(p => p.modalidad_cobro === 'por_evento').length;
                return (
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {porHora > 0 && <span>{porHora} por hora</span>}
                    {porJornada > 0 && <span>{porJornada} por jornada</span>}
                    {porEvento > 0 && <span>{porEvento} por evento</span>}
                  </div>
                );
              })()}
              <div className="w-px h-10 bg-slate-200" />
              <div className="text-center">
                <div className="text-xs text-slate-500">Total Calculado</div>
                <div className="text-xl font-semibold text-emerald-700">${totalCalculado.toLocaleString()}</div>
              </div>
            </div>

            <Button
              onClick={handleLiquidar}
              disabled={estadoLiquidacion === "liquidado" || asignados.length === 0}
              size="sm"
            >
              {estadoLiquidacion === "liquidado" ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Evento Liquidado
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Procesar Liquidación
                </>
              )}
            </Button>
          </div>

          {sinHoras.length > 0 && (
            <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">Horas requeridas</p>
                <p className="text-xs text-orange-700">
                  {sinHoras.map(p => p.nombre_completo).join(', ')} — cobran por hora y necesitan horas definidas.
                </p>
              </div>
            </div>
          )}

          {sinPagoExclusivo.length > 0 && (
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Sin pago calculado</p>
                <p className="text-xs text-red-700">
                  {sinPagoExclusivo.map(p => p.nombre_completo).join(', ')} — no tienen pago asignado.
                </p>
              </div>
            </div>
          )}
        </div>

        {liquidacionEvento && (
          <LiquidacionDialog
            evento={liquidacionEvento}
            isOpen={isLiquidacionOpen}
            onClose={() => {
              setIsLiquidacionOpen(false);
              setLiquidacionEvento(null);
            }}
            onLiquidationComplete={() => { fetchData(); onChanged?.(); }}
          />
        )}
      </div>
    </Card>
  );
}
