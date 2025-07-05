import { useState, useEffect } from "react";
import { CalendarDays, MapPin, Users, DollarSign, Calculator, X, CheckCircle, AlertTriangle, FileText, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal } from "@/types/database";

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

  if (!evento) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-auto bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                Liquidación de Evento
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-slate-600 ml-13">
            <div className="flex items-center space-x-4 mt-2">
              <span className="font-medium">{evento.nombre_evento}</span>
              <span className="text-slate-400">•</span>
              <span>{new Date(evento.fecha_evento).toLocaleDateString('es-CO')}</span>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Advertencia si hay empleados sin horas */}
          {empleadosSinHoras.length > 0 && (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200/60 rounded-2xl p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <h4 className="font-bold text-orange-800">Empleados sin horas registradas</h4>
              </div>
              <p className="text-sm text-orange-700 mb-2">
                Los siguientes empleados no tienen horas trabajadas definidas:
              </p>
              <div className="space-y-1">
                {empleadosSinHoras.map(emp => (
                  <div key={emp.id} className="flex items-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-orange-800 font-medium">{emp.nombre_completo}</span>
                    <span className="text-orange-600">- {emp.rol}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla de empleados y pagos */}
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-1 shadow-lg border border-white/20">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-200/60">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">Resumen de Liquidación</h3>
                </div>
              </div>
              
              <div className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60">
                        <th className="px-4 py-3 text-left text-sm font-bold text-slate-800">Empleado</th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-slate-800">Rol</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-slate-800">Horas</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-800">Tarifa</th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-slate-800">Total</th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-slate-800">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/40">
                      {/* Empleados pendientes */}
                      {empleadosPendientes.length > 0 && (
                        <>
                          <tr className="bg-gradient-to-r from-blue-50 to-blue-100/80">
                            <td colSpan={6} className="px-4 py-3 text-sm font-bold text-blue-900">
                              <div className="flex items-center space-x-2">
                                <Clock className="h-4 w-4" />
                                <span>EMPLEADOS PENDIENTES DE PAGO ({empleadosPendientes.length})</span>
                              </div>
                            </td>
                          </tr>
                          {empleadosPendientes.map((person) => (
                            <tr 
                              key={person.id} 
                              className={`hover:bg-slate-50/50 transition-colors ${!person.horas_trabajadas ? "bg-red-50/80" : ""}`}
                            >
                              <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                {person.nombre_completo}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">
                                <Badge className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-200/60 text-xs">
                                  {person.rol}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-center text-sm">
                                {person.horas_trabajadas ? (
                                  <span className="font-medium text-slate-800">{person.horas_trabajadas}h</span>
                                ) : (
                                  <span className="text-red-600 font-bold bg-red-100/80 px-2 py-1 rounded-lg text-xs">
                                    Sin definir
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-600 font-medium">
                                ${Number(person.tarifa_hora).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                                ${Number(person.pago_calculado || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge className="bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-200/60">
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
                          <tr className="bg-gradient-to-r from-green-50 to-green-100/80">
                            <td colSpan={6} className="px-4 py-3 text-sm font-bold text-green-900">
                              <div className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4" />
                                <span>EMPLEADOS YA PAGADOS ({empleadosPagados.length})</span>
                              </div>
                            </td>
                          </tr>
                          {empleadosPagados.map((person) => (
                            <tr key={person.id} className="bg-green-50/50 opacity-80">
                              <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                {person.nombre_completo}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <Badge className="bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-200/60 text-xs">
                                  {person.rol}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-center text-sm font-medium text-slate-600">
                                {person.horas_trabajadas}h
                              </td>
                              <td className="px-4 py-3 text-right text-sm text-slate-600 font-medium">
                                ${Number(person.tarifa_hora).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-sm font-bold text-slate-800">
                                ${Number(person.pago_calculado || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="space-y-1">
                                  <Badge className="bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-200/60">
                                    ✅ Pagado
                                  </Badge>
                                  {person.fecha_pago && (
                                    <div className="text-xs text-green-600 font-medium">
                                      {new Date(person.fecha_pago).toLocaleDateString('es-CO')}
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

                  {/* Totales */}
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between items-center p-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200/60">
                      <span className="text-sm font-bold text-emerald-800">TOTAL A LIQUIDAR:</span>
                      <span className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                        ${totalPendientes.toLocaleString()}
                      </span>
                    </div>
                    {totalPagados > 0 && (
                      <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-green-100/80 rounded-xl border border-green-200/60">
                        <span className="text-sm font-bold text-green-800">TOTAL YA PAGADO:</span>
                        <span className="text-lg font-bold text-green-700">
                          ${totalPagados.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Formulario de liquidación */}
          {empleadosPendientes.length > 0 ? (
            <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/40">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <h4 className="font-bold text-slate-800">Datos de liquidación</h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metodo_pago" className="text-slate-700 font-semibold flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-selecta-green" />
                    <span>Método de pago</span>
                  </Label>
                  <Select 
                    value={formulario.metodo_pago} 
                    onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') => 
                      setFormulario(prev => ({ ...prev, metodo_pago: value }))
                    }
                  >
                    <SelectTrigger className="bg-white/80 border-slate-200/60 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl">
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="nomina">Nómina</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_pago" className="text-slate-700 font-semibold flex items-center space-x-2">
                    <CalendarDays className="h-4 w-4 text-selecta-green" />
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
                    className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notas_pago" className="text-slate-700 font-semibold flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-selecta-green" />
                    <span>Notas</span>
                  </Label>
                  <Textarea
                    id="notas_pago"
                    placeholder="Observaciones sobre la liquidación..."
                    value={formulario.notas_pago}
                    onChange={(e) => setFormulario(prev => ({
                      ...prev,
                      notas_pago: e.target.value
                    }))}
                    rows={3}
                    className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-50 to-blue-100/80 border-2 border-blue-200/60 rounded-2xl p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <h4 className="font-bold text-blue-800">Evento Completamente Liquidado</h4>
              </div>
              <p className="text-sm text-blue-700 mb-2">
                Todos los empleados de este evento ya han sido pagados. No hay liquidaciones pendientes.
              </p>
              {empleadosPagados.length > 0 && empleadosPagados[0].fecha_pago && (
                <p className="text-sm text-blue-700 font-medium">
                  Última liquidación: {new Date(empleadosPagados[0].fecha_pago).toLocaleDateString('es-CO')}
                </p>
              )}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-between items-center pt-4 border-t border-slate-200/60">
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="rounded-xl border-slate-200/60 hover:bg-slate-50"
              >
                Cerrar
              </Button>
              <Button 
                variant="outline"
                className="rounded-xl border-slate-200/60 hover:bg-slate-50"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
            
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <AlertDialogTrigger asChild>
                <Button 
                  className={empleadosPendientes.length > 0 
                    ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white rounded-xl shadow-lg px-6" 
                    : "rounded-xl"
                  }
                  variant={empleadosPendientes.length > 0 ? "default" : "outline"}
                  disabled={!puedeLiberar || loading}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {empleadosPendientes.length > 0 
                    ? `💰 Liquidar Empleados Pendientes (${empleadosPendientes.length})`
                    : "✅ Evento Completamente Liquidado"
                  }
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span className="text-xl font-bold text-slate-800">Confirmar Liquidación</span>
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-4">
                      <p className="text-slate-600">¿Estás seguro de que deseas confirmar el pago de los empleados pendientes de este evento?</p>
                      
                      <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/60 space-y-2">
                        <p className="font-semibold text-slate-800">Esta acción:</p>
                        <ul className="text-sm space-y-1 text-slate-700">
                          <li className="flex items-center space-x-2">
                            <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                            <span>Marcará como <strong>PAGADO</strong> a {empleadosPendientes.length} empleados</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                            <span>Total a liquidar: <strong>${totalPendientes.toLocaleString()}</strong></span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                            <span>Fecha de pago: <strong>{new Date(formulario.fecha_pago).toLocaleDateString('es-CO')}</strong></span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <div className="w-1 h-1 bg-slate-400 rounded-full"></div>
                            <span>Método: <strong>{formulario.metodo_pago.charAt(0).toUpperCase() + formulario.metodo_pago.slice(1)}</strong></span>
                          </li>
                        </ul>
                      </div>
                      
                      <div className="bg-red-50/80 p-4 rounded-xl border border-red-200/60">
                        <p className="text-red-800 font-bold text-sm flex items-center space-x-2">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Esta acción no se puede deshacer</span>
                        </p>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLiquidacionCompleta}
                    disabled={loading}
                    className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-xl"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Procesando...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>✅ Confirmar Pago</span>
                      </div>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}