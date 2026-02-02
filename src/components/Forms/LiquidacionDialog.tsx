import { useState, useEffect } from "react";
import { CalendarDays, MapPin, Users, DollarSign, Calculator, X, CheckCircle, AlertTriangle, FileText, Clock, Sparkles, TrendingUp, Award, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal } from "@/types/database";
import { calcularPagoPersonal, getModalidadCobroLabel } from "@/lib/calcularPagoPersonal";

interface LiquidacionDialogProps {
  evento: EventoConPersonal | null;
  isOpen: boolean;
  onClose: () => void;
  onLiquidationComplete: () => void;
}

interface FormularioLiquidacion {
  fecha_pago: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'nomina' | 'otro';
  notas_pago: string;
}

export function LiquidacionDialog({ evento, isOpen, onClose, onLiquidationComplete }: LiquidacionDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formulario, setFormulario] = useState<FormularioLiquidacion>({
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'transferencia',
    notas_pago: 'Liquidación completa del evento'
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleLiquidacionCompleta = async () => {
    if (!evento || empleadosPendientes.length === 0) return;
    
    setLoading(true);
    try {
      // Solo actualizar empleados pendientes de pago
      const empleadosPendientesIds = empleadosPendientes.map(p => p.evento_personal_id).filter(Boolean);
      
      const { error: eventoPersonalError } = await supabase
        .from("evento_personal")
        .update({
          estado_pago: 'pagado',
          fecha_pago: formulario.fecha_pago,
          metodo_pago: formulario.metodo_pago,
          notas_pago: formulario.notas_pago
        })
        .in("id", empleadosPendientesIds);

      if (eventoPersonalError) throw eventoPersonalError;

      // Verificar si todos los empleados del evento están pagados
      const { data: todosLosEmpleados, error: checkError } = await supabase
        .from("evento_personal")
        .select("estado_pago")
        .eq("evento_id", evento.id);

      if (checkError) throw checkError;

      const todosLiquidados = todosLosEmpleados?.every(emp => emp.estado_pago === 'pagado');

      // Solo actualizar estado del evento si todos están liquidados
      if (todosLiquidados) {
        const { error: eventoError } = await supabase
          .from("eventos")
          .update({
            estado_liquidacion: 'liquidado',
            fecha_liquidacion: formulario.fecha_pago
          })
          .eq("id", evento.id);

        if (eventoError) throw eventoError;
      }

      toast({
        title: "✅ Liquidación confirmada",
        description: `Liquidación confirmada para ${empleadosPendientes.length} empleados ($${totalPendientes.toLocaleString()})`,
      });

      setShowConfirmDialog(false);
      onLiquidationComplete();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar la liquidación",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetFormulario = () => {
    setFormulario({
      fecha_pago: new Date().toISOString().split('T')[0],
      metodo_pago: 'transferencia',
      notas_pago: 'Liquidación completa del evento'
    });
    setShowConfirmDialog(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetFormulario();
    }
  }, [isOpen]);

  // Separar empleados por estado de pago
  const empleadosPendientes = evento?.personal.filter(p => p.estado_pago !== 'pagado') || [];
  const empleadosPagados = evento?.personal.filter(p => p.estado_pago === 'pagado') || [];
  
  // Verificar si hay empleados pendientes sin horas definidas
  const empleadosSinHoras = empleadosPendientes.filter(p => !p.horas_trabajadas || p.horas_trabajadas === 0);
  const puedeLiberar = empleadosSinHoras.length === 0 && empleadosPendientes.length > 0;
  
  // Calcular totales
  const totalPendientes = empleadosPendientes.reduce((sum, p) => sum + (p.pago_calculado || 0), 0);
  const totalPagados = empleadosPagados.reduce((sum, p) => sum + (p.pago_calculado || 0), 0);
  const totalGeneral = totalPendientes + totalPagados;

  // Obtener badge de método de pago
  const getMetodoBadge = (metodo: string) => {
    const configs = {
      efectivo: { class: "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200", icon: <DollarSign className="h-3 w-3 mr-1" /> },
      transferencia: { class: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200", icon: <Receipt className="h-3 w-3 mr-1" /> },
      nomina: { class: "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200", icon: <Users className="h-3 w-3 mr-1" /> },
      otro: { class: "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-gray-200", icon: <FileText className="h-3 w-3 mr-1" /> }
    };
    
    const config = configs[metodo as keyof typeof configs] || configs.otro;
    return (
      <Badge className={`${config.class} shadow-sm hover:shadow-md transition-shadow font-medium`}>
        {config.icon}
        {metodo.charAt(0).toUpperCase() + metodo.slice(1)}
      </Badge>
    );
  };

  if (!evento) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[95vh] overflow-auto bg-white/95 backdrop-blur-2xl border-white/30 shadow-2xl rounded-3xl">
        {/* Header premium */}
        <DialogHeader className="pb-6 border-b border-slate-200/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl">
                  <Calculator className="h-7 w-7 text-white" />
                </div>
                <div className="absolute inset-0 w-14 h-14 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-3xl blur-xl"></div>
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Liquidación de Evento
                </DialogTitle>
                <DialogDescription className="text-slate-600 text-base mt-2">
                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-slate-800">{evento.nombre_evento}</span>
                    <span className="text-slate-400">•</span>
                    <span className="flex items-center space-x-1">
                      <CalendarDays className="h-4 w-4" />
                      <span>{new Date(evento.fecha_evento).toLocaleDateString('es-CO')}</span>
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>{evento.ubicacion}</span>
                    </span>
                  </div>
                </DialogDescription>
              </div>
            </div>
            
            {/* Stats rápidas */}
            <div className="hidden lg:flex items-center space-x-3">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/30">
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-800">{empleadosPendientes.length + empleadosPagados.length}</div>
                  <div className="text-xs text-slate-600">Empleados</div>
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/30">
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-600">${totalGeneral.toLocaleString()}</div>
                  <div className="text-xs text-slate-600">Total</div>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-8">
          {/* Advertencia si hay empleados sin horas */}
          {empleadosSinHoras.length > 0 && (
            <div className="bg-gradient-to-r from-orange-50/80 to-red-50/80 backdrop-blur-sm border-2 border-orange-200/60 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <AlertTriangle className="h-6 w-6 text-white animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-orange-800">Empleados sin horas registradas</h4>
                  <p className="text-sm text-orange-700">Se requiere completar la información antes de proceder</p>
                </div>
              </div>
              <div className="bg-white/60 rounded-2xl p-4 space-y-2">
                {empleadosSinHoras.map(emp => (
                  <div key={emp.id} className="flex items-center space-x-3 text-sm bg-orange-50/60 rounded-xl p-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                    <span className="text-orange-800 font-semibold">{emp.nombre_completo}</span>
                    <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">
                      {emp.rol}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumen ejecutivo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-r from-blue-50/80 to-blue-100/80 backdrop-blur-sm border-blue-200/30 rounded-3xl shadow-xl overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Clock className="h-8 w-8 text-blue-600" />
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-700">{empleadosPendientes.length}</div>
                  <p className="text-sm font-semibold text-blue-600 mt-1">Pendientes de Pago</p>
                  <div className="text-lg font-bold text-blue-800 mt-2">${totalPendientes.toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-50/80 to-green-100/80 backdrop-blur-sm border-green-200/30 rounded-3xl shadow-xl overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-700">{empleadosPagados.length}</div>
                  <p className="text-sm font-semibold text-green-600 mt-1">Ya Pagados</p>
                  <div className="text-lg font-bold text-green-800 mt-2">${totalPagados.toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-50/80 to-purple-100/80 backdrop-blur-sm border-purple-200/30 rounded-3xl shadow-xl overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                  <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-700">{empleadosPendientes.length + empleadosPagados.length}</div>
                  <p className="text-sm font-semibold text-purple-600 mt-1">Total Empleados</p>
                  <div className="text-lg font-bold text-purple-800 mt-2">${totalGeneral.toLocaleString()}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de empleados premium */}
          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm border-b border-slate-200/30">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-800">Detalle de Liquidación</CardTitle>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50/80 to-slate-100/80 border-b border-slate-200/60">
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-800">Empleado</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-800">Rol</th>
                      <th className="px-6 py-4 text-center text-sm font-bold text-slate-800">Horas</th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-slate-800">Tarifa/H</th>
                      <th className="px-6 py-4 text-right text-sm font-bold text-slate-800">Total</th>
                      <th className="px-6 py-4 text-center text-sm font-bold text-slate-800">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40">
                    {/* Empleados pendientes */}
                    {empleadosPendientes.length > 0 && (
                      <>
                        <tr className="bg-gradient-to-r from-blue-50/60 to-blue-100/60">
                          <td colSpan={6} className="px-6 py-4 text-sm font-bold text-blue-900">
                            <div className="flex items-center space-x-3">
                              <Clock className="h-5 w-5" />
                              <span>EMPLEADOS PENDIENTES DE PAGO ({empleadosPendientes.length})</span>
                              <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                                ${totalPendientes.toLocaleString()}
                              </Badge>
                            </div>
                          </td>
                        </tr>
                        {empleadosPendientes.map((person, index) => (
                          <tr 
                            key={person.id} 
                            className={`hover:bg-gradient-to-r hover:from-slate-50/50 hover:to-slate-100/50 transition-all duration-200 ${!person.horas_trabajadas ? "bg-red-50/60 border-l-4 border-red-300" : ""}`}
                            style={{ animationDelay: `${index * 100}ms` }}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                                  <span className="text-sm font-bold text-blue-700">
                                    {person.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-slate-800">{person.nombre_completo}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <Badge className="bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200/60 font-medium shadow-sm">
                                {person.rol}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {person.horas_trabajadas ? (
                                <div className="flex items-center justify-center space-x-1">
                                  <Clock className="h-4 w-4 text-slate-500" />
                                  <span className="font-bold text-slate-800">{person.horas_trabajadas}h</span>
                                </div>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 border-red-200 animate-pulse">
                                  Sin definir
                                </Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <div className="flex items-center space-x-1">
                                  <DollarSign className="h-4 w-4 text-selecta-green" />
                                  <span className="font-semibold text-slate-800">{Number(person.tarifa_hora).toLocaleString()}</span>
                                </div>
                                <span className="text-xs text-slate-500">{getModalidadCobroLabel(person.modalidad_cobro)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-3 py-2 rounded-xl border border-emerald-200/60">
                                <span className="font-bold text-emerald-700">${Number(person.pago_calculado || 0).toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge className="bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200/60 shadow-sm animate-pulse">
                                ⏳ Pendiente
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                    
                    {/* Empleados ya pagados */}
                    {empleadosPagados.length > 0 && (
                      <>
                        <tr className="bg-gradient-to-r from-green-50/60 to-green-100/60">
                          <td colSpan={6} className="px-6 py-4 text-sm font-bold text-green-900">
                            <div className="flex items-center space-x-3">
                              <CheckCircle className="h-5 w-5" />
                              <span>EMPLEADOS YA PAGADOS ({empleadosPagados.length})</span>
                              <Badge className="bg-green-100 text-green-800 border-green-200">
                                ${totalPagados.toLocaleString()}
                              </Badge>
                            </div>
                          </td>
                        </tr>
                        {empleadosPagados.map((person, index) => (
                          <tr key={person.id} className="bg-green-50/30 opacity-80" style={{ animationDelay: `${(empleadosPendientes.length + index) * 100}ms` }}>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-green-100 to-green-200 rounded-xl flex items-center justify-center">
                                  <span className="text-sm font-bold text-green-700">
                                    {person.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </span>
                                </div>
                                <span className="text-sm font-bold text-slate-800">{person.nombre_completo}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <Badge className="bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200/60 font-medium shadow-sm">
                                {person.rol}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                <Clock className="h-4 w-4 text-slate-500" />
                                <span className="font-bold text-slate-600">{person.horas_trabajadas}h</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <div className="flex items-center space-x-1">
                                  <DollarSign className="h-4 w-4 text-selecta-green" />
                                  <span className="font-semibold text-slate-600">{Number(person.tarifa_hora).toLocaleString()}</span>
                                </div>
                                <span className="text-xs text-slate-500">{getModalidadCobroLabel(person.modalidad_cobro)}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="bg-gradient-to-r from-green-50 to-green-100 px-3 py-2 rounded-xl border border-green-200/60">
                                <span className="font-bold text-green-700">${Number(person.pago_calculado || 0).toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="space-y-2">
                                <Badge className="bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200/60 shadow-sm">
                                  ✅ Pagado
                                </Badge>
                                {person.fecha_pago && (
                                  <div className="text-xs text-green-600 font-medium bg-green-50/60 rounded-lg px-2 py-1">
                                    {new Date(person.fecha_pago).toLocaleDateString('es-CO')}
                                  </div>
                                )}
                                {person.metodo_pago && (
                                  <div className="text-xs">
                                    {getMetodoBadge(person.metodo_pago)}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>

                {/* Totales premium */}
                <div className="mt-6 space-y-4">
                  {totalPendientes > 0 && (
                    <div className="flex justify-between items-center p-6 bg-gradient-to-r from-emerald-50/80 to-green-50/80 rounded-2xl border border-emerald-200/60 shadow-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl flex items-center justify-center">
                          <Calculator className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-lg font-bold text-emerald-800">TOTAL A LIQUIDAR:</span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                          ${totalPendientes.toLocaleString()}
                        </div>
                        <div className="text-sm text-emerald-700">{empleadosPendientes.length} empleados</div>
                      </div>
                    </div>
                  )}
                  
                  {totalPagados > 0 && (
                    <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50/60 to-green-100/60 rounded-2xl border border-green-200/60">
                      <div className="flex items-center space-x-3">
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <span className="text-base font-bold text-green-800">TOTAL YA PAGADO:</span>
                      </div>
                      <div className="text-xl font-bold text-green-700">${totalPagados.toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formulario de liquidación premium */}
          {empleadosPendientes.length > 0 ? (
            <Card className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm border-slate-200/40 rounded-3xl shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-50/50 to-purple-100/50 border-b border-purple-200/30">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-slate-800">Configuración de Liquidación</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3 group">
                    <Label htmlFor="metodo_pago" className="text-slate-700 font-bold flex items-center space-x-3 text-base">
                      <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                        <DollarSign className="h-4 w-4 text-white" />
                      </div>
                      <span>Método de pago</span>
                    </Label>
                    <Select 
                      value={formulario.metodo_pago} 
                      onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') => setFormulario(prev => ({ ...prev, metodo_pago: value }))
                    }
                  >
                    <SelectTrigger className="bg-white/90 border-slate-200/50 rounded-2xl h-12 shadow-sm hover:shadow-md transition-all group-hover:border-orange-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl shadow-2xl">
                      <SelectItem value="efectivo" className="rounded-xl">
                        <div className="flex items-center space-x-2">
                          <DollarSign className="h-4 w-4 text-orange-600" />
                          <span>Efectivo</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="transferencia" className="rounded-xl">
                        <div className="flex items-center space-x-2">
                          <Receipt className="h-4 w-4 text-blue-600" />
                          <span>Transferencia</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="nomina" className="rounded-xl">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-purple-600" />
                          <span>Nómina</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="otro" className="rounded-xl">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-gray-600" />
                          <span>Otro</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 group">
                  <Label htmlFor="fecha_pago" className="text-slate-700 font-bold flex items-center space-x-3 text-base">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <CalendarDays className="h-4 w-4 text-white" />
                    </div>
                    <span>Fecha de pago</span>
                  </Label>
                  <Input
                    id="fecha_pago"
                    type="date"
                    value={formulario.fecha_pago}
                    onChange={(e) => setFormulario(prev => ({
                      ...prev,
                      fecha_pago: e.target.value
                    }))}
                    className="bg-white/90 border-slate-200/50 rounded-2xl h-12 focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all group-hover:border-blue-300"
                  />
                </div>

                <div className="space-y-3 md:col-span-2 group">
                  <Label htmlFor="notas_pago" className="text-slate-700 font-bold flex items-center space-x-3 text-base">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <FileText className="h-4 w-4 text-white" />
                    </div>
                    <span>Notas de liquidación</span>
                  </Label>
                  <Textarea
                    id="notas_pago"
                    placeholder="Observaciones adicionales sobre la liquidación..."
                    value={formulario.notas_pago}
                    onChange={(e) => setFormulario(prev => ({
                      ...prev,
                      notas_pago: e.target.value
                    }))}
                    rows={4}
                    className="bg-white/90 border-slate-200/50 rounded-2xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all group-hover:border-green-300 resize-none"
                  />
                </div>
              </div>

              {/* Preview de la liquidación */}
              <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50/60 to-green-50/60 rounded-2xl border border-emerald-200/40">
                <h5 className="text-sm font-bold text-emerald-800 mb-3 flex items-center space-x-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Vista Previa de Liquidación</span>
                </h5>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-white/60 rounded-xl p-3 text-center">
                    <div className="font-bold text-emerald-700">{empleadosPendientes.length}</div>
                    <div className="text-emerald-600 text-xs">Empleados</div>
                  </div>
                  <div className="bg-white/60 rounded-xl p-3 text-center">
                    <div className="font-bold text-emerald-700">${totalPendientes.toLocaleString()}</div>
                    <div className="text-emerald-600 text-xs">Total</div>
                  </div>
                  <div className="bg-white/60 rounded-xl p-3 text-center">
                    <div className="font-bold text-emerald-700">{new Date(formulario.fecha_pago).toLocaleDateString('es-CO')}</div>
                    <div className="text-emerald-600 text-xs">Fecha</div>
                  </div>
                  <div className="bg-white/60 rounded-xl p-3 text-center">
                    <div className="font-bold text-emerald-700 capitalize">{formulario.metodo_pago}</div>
                    <div className="text-emerald-600 text-xs">Método</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-r from-blue-50/80 to-blue-100/80 backdrop-blur-sm border-blue-200/60 rounded-3xl shadow-xl overflow-hidden">
            <CardContent className="p-8">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                  <CheckCircle className="h-10 w-10 text-white" />
                </div>
                <h4 className="text-2xl font-bold text-blue-800 mb-3">Evento Completamente Liquidado</h4>
                <p className="text-base text-blue-700 mb-4 max-w-md mx-auto">
                  Todos los empleados de este evento ya han sido pagados. No hay liquidaciones pendientes.
                </p>
                {empleadosPagados.length > 0 && empleadosPagados[0].fecha_pago && (
                  <div className="inline-flex items-center space-x-2 bg-white/60 rounded-2xl px-4 py-2 border border-blue-200/50">
                    <Award className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-700">
                      Última liquidación: {new Date(empleadosPagados[0].fecha_pago).toLocaleDateString('es-CO')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Botones de acción premium */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-slate-200/50">
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 rounded-2xl px-6 py-3 font-semibold transition-all duration-200 hover:shadow-md"
            >
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
            <Button 
              variant="outline"
              className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 rounded-2xl px-6 py-3 font-semibold transition-all duration-200 hover:shadow-md"
            >
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
          
          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogTrigger asChild>
              <Button 
                className={empleadosPendientes.length > 0 
                  ? "group bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-8 py-4 border-0 relative overflow-hidden" 
                  : "rounded-2xl px-6 py-3"
                }
                variant={empleadosPendientes.length > 0 ? "default" : "outline"}
                disabled={!puedeLiberar || loading}
              >
                <div className="relative z-10 flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span className="font-bold">
                    {empleadosPendientes.length > 0 
                      ? `Liquidar ${empleadosPendientes.length} Empleados`
                      : "Evento Completamente Liquidado"
                    }
                  </span>
                  {empleadosPendientes.length > 0 && (
                    <Badge className="bg-white/20 text-white border-white/30 ml-2">
                      ${totalPendientes.toLocaleString()}
                    </Badge>
                  )}
                </div>
                {empleadosPendientes.length > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                )}
              </Button>
            </AlertDialogTrigger>
            
            <AlertDialogContent className="bg-white/95 backdrop-blur-2xl border-white/30 shadow-2xl rounded-3xl sm:max-w-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-2xl font-bold text-slate-800">Confirmar Liquidación Masiva</span>
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-6 mt-4">
                    <p className="text-slate-600 text-base">
                      ¿Estás completamente seguro de que deseas procesar el pago de los empleados pendientes de este evento?
                    </p>
                    
                    {/* Resumen de la acción */}
                    <Card className="bg-gradient-to-r from-slate-50/80 to-white/80 border-slate-200/60 rounded-2xl shadow-sm">
                      <CardContent className="p-6">
                        <h4 className="font-bold text-slate-800 mb-4 flex items-center space-x-2">
                          <Calculator className="h-5 w-5 text-selecta-green" />
                          <span>Resumen de la liquidación:</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span>Empleados a pagar: <strong>{empleadosPendientes.length}</strong></span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span>Total a liquidar: <strong>${totalPendientes.toLocaleString()}</strong></span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                              <span>Fecha: <strong>{new Date(formulario.fecha_pago).toLocaleDateString('es-CO')}</strong></span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                              <span>Método: <strong className="capitalize">{formulario.metodo_pago}</strong></span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Advertencia */}
                    <div className="bg-gradient-to-r from-red-50/80 to-orange-50/80 p-6 rounded-2xl border border-red-200/60">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                        <div>
                          <p className="text-red-800 font-bold text-base">Acción Irreversible</p>
                          <p className="text-red-700 text-sm mt-1">
                            Esta acción marcará permanentemente como pagados a todos los empleados seleccionados. No podrás deshacer esta operación.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <AlertDialogFooter className="pt-6">
                <AlertDialogCancel className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 rounded-2xl px-6 py-3 font-semibold">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLiquidacionCompleta}
                  disabled={loading}
                  className="group bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl px-8 py-3 relative overflow-hidden"
                >
                  {loading ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="font-semibold">Procesando liquidación...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 relative z-10">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-bold">Confirmar Pago</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Footer informativo */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center justify-center space-x-4 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/30">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-600">Sistema de liquidación seguro</span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <div className="flex items-center space-x-2">
              <Receipt className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-500">
                {new Date().toLocaleTimeString('es-CO', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
}