import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      // catálogo personal
      const { data: pers, error: e1 } = await supabase
        .from("personal")
        .select("*")
        .order("nombre_completo");
      if (e1) throw e1;

      // asignaciones
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
      const { error } = await supabase
        .from("evento_personal")
        .delete()
        .eq("id", evento_personal_id);
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
 
  const getRoleBadgeVariant = (rol: string) => {
    const variants: Record<string, string> = {
      "Coordinador": "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200",
      "Chef": "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200",
      "Mesero": "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200",
      "Bartender": "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200",
      "Decorador": "bg-gradient-to-r from-pink-50 to-pink-100 text-pink-700 border-pink-200",
      "Técnico de Sonido": "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200",
      "Fotógrafo": "bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-700 border-yellow-200",
      "Otro": "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200"
    };
    return variants[rol] || variants["Otro"];
  };
 
  const getEstadoBadge = (estado: string) => {
    if (estado === 'pagado') {
      return "bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200 shadow-sm";
    }
    return "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200 shadow-sm";
  };
 
  return (
    <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-50/50 to-blue-100/50 backdrop-blur-sm border-b border-slate-200/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Users className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800">Gestión de Personal</CardTitle>
          </div>
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold px-3 py-1 shadow-sm">
            {asignados.length} asignados
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Asignar nuevo personal premium */}
        <Card className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm border-slate-200/40 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Select value={selectToAdd} onValueChange={setSelectToAdd}>
                <SelectTrigger className="flex-1 bg-white/90 border-slate-200/50 rounded-xl h-12 shadow-sm hover:shadow-md transition-all">
                  <SelectValue placeholder="Selecciona personal para asignar al evento" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl shadow-2xl">
                  {noAsignadosCatalog.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      Sin candidatos disponibles
                    </div>
                  ) : (
                    noAsignadosCatalog.map(p => (
                      <SelectItem key={p.id} value={p.id} className="rounded-xl">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-700">
                              {p.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold">{p.nombre_completo}</div>
                            <div className="text-xs text-slate-500">{p.rol} • ${Number(p.tarifa_hora).toLocaleString()}/h</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={handleAdd} 
                disabled={!selectToAdd}
                className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-xl hover:scale-105 transition-all duration-200 rounded-xl px-6 shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Asignar
              </Button>
            </div>
          </CardContent>
        </Card>
 
        {/* Tabla de asignados premium */}
        <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-slate-50/80 to-slate-100/80 border-b border-slate-200/60">
                <TableHead className="font-bold text-slate-800">Empleado</TableHead>
                <TableHead className="font-bold text-slate-800">Rol</TableHead>
                <TableHead className="text-center font-bold text-slate-800">Inicio</TableHead>
                <TableHead className="text-center font-bold text-slate-800">Fin</TableHead>
                <TableHead className="text-center font-bold text-slate-800">Horas</TableHead>
                <TableHead className="text-right font-bold text-slate-800">Pago</TableHead>
                <TableHead className="text-center font-bold text-slate-800">Estado</TableHead>
                <TableHead className="text-right font-bold text-slate-800">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-6 h-6 border-2 border-selecta-green/30 border-t-selecta-green rounded-full animate-spin"></div>
                      <span className="font-medium">Cargando personal...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : asignados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="w-20 h-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-4">
                      <Users className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Sin personal asignado</h3>
                    <p className="text-sm text-slate-500">Comienza asignando empleados a este evento</p>
                  </TableCell>
                </TableRow>
              ) : (
                asignados.map((p, index) => (
                  <TableRow 
                    key={p.evento_personal_id} 
                    className="hover:bg-gradient-to-r hover:from-slate-50/50 hover:to-slate-100/50 transition-all duration-200"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl flex items-center justify-center shadow-sm">
                          <span className="text-sm font-bold text-blue-700">
                            {p.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <span className="font-semibold text-slate-800">{p.nombre_completo}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={`${getRoleBadgeVariant(p.rol)} border font-semibold shadow-sm`}>
                        {p.rol}
                      </Badge>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        className="w-32 text-center bg-white/80 border-slate-200/50 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all"
                        value={p.hora_inicio ?? ""}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { hora_inicio: e.target.value })}
                      />
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        className="w-32 text-center bg-white/80 border-slate-200/50 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all"
                        value={p.hora_fin ?? ""}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { hora_fin: e.target.value })}
                      />
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-24 text-center bg-white/80 border-slate-200/50 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all"
                        value={p.horas_trabajadas ?? 0}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { horas_trabajadas: Number(e.target.value) })}
                      />
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <DollarSign className="h-3 w-3 text-selecta-green" />
                        <Input
                          type="number"
                          min={0}
                          step={1000}
                          className="w-32 text-right bg-white/80 border-slate-200/50 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all"
                          value={p.pago_calculado ?? 0}
                          onChange={(e) => handleUpdateRow(p.evento_personal_id!, { pago_calculado: Number(e.target.value) })}
                        />
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <Select
                        value={p.estado_pago ?? "pendiente"}
                        onValueChange={(v) => handleUpdateRow(p.evento_personal_id!, { estado_pago: v as any })}
                      >
                        <SelectTrigger className="w-32 mx-auto bg-white/80 border-slate-200/50 rounded-xl shadow-sm hover:shadow-md transition-all">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl">
                          <SelectItem value="pendiente" className="rounded-xl">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-3 w-3 text-orange-600" />
                              <span>Pendiente</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="pagado" className="rounded-xl">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              <span>Pagado</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleSaveRow(p)}
                          className="bg-white hover:bg-green-50 border-slate-200 hover:border-green-300 rounded-xl transition-all duration-200 hover:scale-105"
                        >
                          <Save className="h-3 w-3 mr-1" />
                          Guardar
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRemove(p.evento_personal_id!)}
                          className="hover:bg-red-50 hover:text-red-700 rounded-xl transition-all duration-200 hover:scale-105"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
 
        {/* Resumen y liquidación premium */}
        <Card className="bg-gradient-to-r from-emerald-50/80 to-green-50/80 backdrop-blur-sm border-emerald-200/60 rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-700">{asignados.length}</div>
                  <div className="text-sm text-emerald-600 font-semibold">Empleados</div>
                </div>
                
                <div className="w-px h-12 bg-emerald-200"></div>
                
                <div className="text-center">
                  <div className="text-sm text-emerald-600 font-semibold">Total Calculado</div>
                  <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                    ${totalCalculado.toLocaleString()}
                  </div>
                </div>
              </div>
              
              <Button
                variant="default"
                onClick={handleLiquidar}
                disabled={estadoLiquidacion === "liquidado" || asignados.length === 0}
                className={`group ${
                  estadoLiquidacion === "liquidado" 
                    ? "bg-gradient-to-r from-green-600 to-green-700 cursor-not-allowed opacity-75" 
                    : "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-xl hover:shadow-2xl transform hover:scale-105"
                } transition-all duration-300 rounded-2xl px-6 py-3 relative overflow-hidden`}
              >
                <div className="relative z-10 flex items-center space-x-2">
                  {estadoLiquidacion === "liquidado" ? (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-bold">Evento Liquidado</span>
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-5 w-5" />
                      <span className="font-bold">Procesar Liquidación</span>
                    </>
                  )}
                </div>
                {estadoLiquidacion !== "liquidado" && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                )}
              </Button>
            </div>
 
            {/* Advertencias si las hay */}
            {asignados.some(p => !p.horas_trabajadas || p.horas_trabajadas <= 0) && (
              <div className="mt-4 p-4 bg-orange-50/80 rounded-2xl border border-orange-200/60">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Información incompleta</p>
                    <p className="text-xs text-orange-700">
                      Algunos empleados no tienen horas de trabajo definidas. Complete esta información para proceder con la liquidación.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
 
        {/* Dialog de liquidación */}
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
      </CardContent>
    </Card>
  );
 }