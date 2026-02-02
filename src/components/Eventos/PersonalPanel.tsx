import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Trash2, Users, Clock, AlertTriangle, CheckCircle, Save } from "lucide-react";
import { LiquidacionDialog } from "@/components/Forms/LiquidacionDialog";
import type { Personal, PersonalAsignado, EventoConPersonal } from "@/types/database";

type Props = {
  eventoId: string;
  fechaEvento: string;
  estadoLiquidacion: "pendiente" | "liquidado";
};

export default function PersonalPanel({ eventoId, fechaEvento, estadoLiquidacion }: Props) {
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
      const { data: pers, error: e1 } = await supabase
        .from("personal")
        .select("*")
        .order("nombre_completo");
      if (e1) throw e1;

      const { data: evPers, error: e2 } = await supabase
        .from("evento_personal")
        .select(`
          id,
          hora_inicio,
          hora_fin,
          horas_trabajadas,
          pago_calculado,
          estado_pago,
          fecha_pago,
          metodo_pago,
          notas_pago,
          personal (*)
        `)
        .eq("evento_id", eventoId);
      if (e2) throw e2;

      const list: PersonalAsignado[] = (evPers || []).map((ep: any) => ({
        ...ep.personal,
        hora_inicio: ep.hora_inicio,
        hora_fin: ep.hora_fin,
        horas_trabajadas: ep.horas_trabajadas,
        pago_calculado: ep.pago_calculado,
        estado_pago: ep.estado_pago,
        fecha_pago: ep.fecha_pago,
        metodo_pago: ep.metodo_pago,
        notas_pago: ep.notas_pago,
        evento_personal_id: ep.id,
      }));

      setCatalogo((pers || []) as Personal[]);
      setAsignados(list);
    } catch (err: any) {
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

  const handleAdd = async () => {
    if (!selectToAdd) return;
    try {
      const persona = catalogo.find(p => p.id === selectToAdd);
      if (!persona) return;
      const { error } = await supabase.from("evento_personal").insert({
        evento_id: eventoId,
        personal_id: persona.id,
        estado_pago: "pendiente",
      });
      if (error) throw error;
      setSelectToAdd("");
      await fetchData();
      toast({ title: "Personal asignado", description: `${persona.nombre_completo} agregado al evento.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo asignar.", variant: "destructive" });
    }
  };

  const handleRemove = async (evento_personal_id: string) => {
    try {
      const { error } = await supabase.from("evento_personal").delete().eq("id", evento_personal_id);
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const handleUpdateRow = (id: string, patch: Partial<PersonalAsignado>) => {
    setAsignados(prev => prev.map(p => (p.evento_personal_id === id ? { ...p, ...patch } : p)));
  };

  const handleSaveRow = async (row: PersonalAsignado) => {
    try {
      const { error } = await supabase
        .from("evento_personal")
        .update({
          hora_inicio: row.hora_inicio || null,
          hora_fin: row.hora_fin || null,
          horas_trabajadas: row.horas_trabajadas != null ? Number(row.horas_trabajadas) : null,
          pago_calculado: row.pago_calculado != null ? Number(row.pago_calculado) : null,
          estado_pago: row.estado_pago || "pendiente",
          fecha_pago: row.fecha_pago || null,
          metodo_pago: row.metodo_pago || null,
          notas_pago: row.notas_pago || null,
        })
        .eq("id", row.evento_personal_id);
      if (error) throw error;
      toast({ title: "Guardado", description: `${row.nombre_completo}: cambios aplicados.` });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo guardar.", variant: "destructive" });
    }
  };

  const handleLiquidar = () => {
    const sinHoras = asignados.filter(p => !p.horas_trabajadas || p.horas_trabajadas <= 0);
    if (sinHoras.length > 0) {
      toast({
        title: "Información faltante",
        description: `${sinHoras.length} empleado(s) no tienen horas de trabajo definidas.`,
        variant: "destructive",
      });
      return;
    }
    const evento: EventoConPersonal = {
      id: eventoId,
      nombre_evento: "",
      ubicacion: "",
      fecha_evento: fechaEvento,
      descripcion: null,
      estado_liquidacion: estadoLiquidacion,
      personal: asignados,
      costo_total: totalCalculado,
    } as any;
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
                    {p.nombre_completo} — {p.rol} · ${Number(p.tarifa_hora).toLocaleString()}
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
                  <TableRow key={p.evento_personal_id}>
                    <TableCell className="font-medium text-slate-900">{p.nombre_completo}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getRoleBadgeClass(p.rol)}>{p.rol}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        className="w-28 text-center h-8"
                        value={p.hora_inicio ?? ""}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { hora_inicio: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        className="w-28 text-center h-8"
                        value={p.hora_fin ?? ""}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { hora_fin: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-20 text-center h-8"
                        value={p.horas_trabajadas ?? 0}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { horas_trabajadas: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        className="w-28 text-right h-8 ml-auto"
                        value={p.pago_calculado ?? 0}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { pago_calculado: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={p.estado_pago ?? "pendiente"}
                        onValueChange={(v) => handleUpdateRow(p.evento_personal_id!, { estado_pago: v as any })}
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
                        <Button variant="outline" size="sm" onClick={() => handleSaveRow(p)} className="h-8">
                          <Save className="h-3 w-3 mr-1" />
                          Guardar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRemove(p.evento_personal_id!)} className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50">
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

          {asignados.some(p => !p.horas_trabajadas || p.horas_trabajadas <= 0) && (
            <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">Información incompleta</p>
                <p className="text-xs text-orange-700">Algunos empleados no tienen horas definidas.</p>
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
            onLiquidationComplete={() => fetchData()}
          />
        )}
      </div>
    </Card>
  );
}
