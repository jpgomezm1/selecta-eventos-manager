import { useState, useEffect } from "react";
import { CalendarDays, MapPin, Users, DollarSign, Calculator, X, CheckCircle, AlertTriangle } from "lucide-react";
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5 text-primary" />
            <span>Liquidación de Evento</span>
          </DialogTitle>
          <DialogDescription>
            {evento.nombre_evento} - {new Date(evento.fecha_evento).toLocaleDateString('es-CO')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Advertencia si hay empleados sin horas */}
          {empleadosSinHoras.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <h4 className="font-medium text-orange-800">Empleados sin horas registradas</h4>
              </div>
              <p className="text-sm text-orange-700 mt-2">
                Los siguientes empleados no tienen horas trabajadas definidas:
              </p>
              <ul className="list-disc list-inside text-sm text-orange-700 mt-1">
                {empleadosSinHoras.map(emp => (
                  <li key={emp.id}>{emp.nombre_completo} - {emp.rol}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Tabla de empleados y pagos */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-3 border-b">
              <h3 className="font-semibold">Resumen de Liquidación</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Empleado</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Rol</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-900">Horas</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Tarifa</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Total</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-900">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {/* Empleados pendientes */}
                  {empleadosPendientes.length > 0 && (
                    <>
                      <tr className="bg-blue-50">
                        <td colSpan={6} className="px-4 py-2 text-sm font-semibold text-blue-900">
                          EMPLEADOS PENDIENTES DE PAGO ({empleadosPendientes.length})
                        </td>
                      </tr>
                      {empleadosPendientes.map((person) => (
                        <tr key={person.id} className={!person.horas_trabajadas ? "bg-red-50" : ""}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {person.nombre_completo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {person.rol}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {person.horas_trabajadas ? `${person.horas_trabajadas}h` : 
                              <span className="text-red-500 font-medium">Sin definir</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">
                            ${Number(person.tarifa_hora).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            ${Number(person.pago_calculado || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="secondary">⏳ Pendiente</Badge>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  
                  {/* Empleados ya pagados */}
                  {empleadosPagados.length > 0 && (
                    <>
                      <tr className="bg-green-50">
                        <td colSpan={6} className="px-4 py-2 text-sm font-semibold text-green-900">
                          EMPLEADOS YA PAGADOS ({empleadosPagados.length})
                        </td>
                      </tr>
                      {empleadosPagados.map((person) => (
                        <tr key={person.id} className="bg-green-50 opacity-75">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {person.nombre_completo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {person.rol}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">
                            {person.horas_trabajadas}h
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">
                            ${Number(person.tarifa_hora).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            ${Number(person.pago_calculado || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              ✅ Pagado
                              {person.fecha_pago && (
                                <div className="text-xs text-green-600 mt-1">
                                  {new Date(person.fecha_pago).toLocaleDateString('es-CO')}
                                </div>
                              )}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      TOTAL A LIQUIDAR:
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-primary">
                      ${totalPendientes.toLocaleString()}
                    </td>
                    <td className="px-4 py-3"></td>
                  </tr>
                  {totalPagados > 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-green-700">
                        TOTAL YA PAGADO:
                      </td>
                      <td className="px-4 py-3 text-right text-lg font-bold text-green-700">
                        ${totalPagados.toLocaleString()}
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>

          {/* Formulario de liquidación */}
          {empleadosPendientes.length > 0 ? (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="font-medium mb-4">Datos de liquidación</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="metodo_pago">Método de pago</Label>
                  <Select 
                    value={formulario.metodo_pago} 
                    onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') => 
                      setFormulario(prev => ({ ...prev, metodo_pago: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="nomina">Nómina</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha_pago">Fecha de pago</Label>
                  <Input
                    id="fecha_pago"
                    type="date"
                    value={formulario.fecha_pago}
                    onChange={(e) => setFormulario(prev => ({
                      ...prev,
                      fecha_pago: e.target.value
                    }))}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notas_pago">Notas</Label>
                  <Textarea
                    id="notas_pago"
                    placeholder="Observaciones sobre la liquidación..."
                    value={formulario.notas_pago}
                    onChange={(e) => setFormulario(prev => ({
                      ...prev,
                      notas_pago: e.target.value
                    }))}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-800">Evento Completamente Liquidado</h4>
              </div>
              <p className="text-sm text-blue-700 mt-2">
                Todos los empleados de este evento ya han sido pagados. No hay liquidaciones pendientes.
              </p>
              {empleadosPagados.length > 0 && empleadosPagados[0].fecha_pago && (
                <p className="text-sm text-blue-700 mt-1">
                  Última liquidación: {new Date(empleadosPagados[0].fecha_pago).toLocaleDateString('es-CO')}
                </p>
              )}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-between items-center pt-4">
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
            
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <AlertDialogTrigger asChild>
                <Button 
                  className={empleadosPendientes.length > 0 ? "bg-green-600 hover:bg-green-700 text-white" : ""}
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
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span>Confirmar Liquidación</span>
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>¿Estás seguro de que deseas confirmar el pago de los empleados pendientes de este evento?</p>
                      
                      <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                        <p className="font-medium">Esta acción:</p>
                        <ul className="text-sm space-y-1">
                          <li>• Marcará como PAGADO a {empleadosPendientes.length} empleados</li>
                          <li>• Total a liquidar: ${totalPendientes.toLocaleString()}</li>
                          <li>• Fecha de pago: {new Date(formulario.fecha_pago).toLocaleDateString('es-CO')}</li>
                          <li>• Método: {formulario.metodo_pago.charAt(0).toUpperCase() + formulario.metodo_pago.slice(1)}</li>
                        </ul>
                      </div>
                      
                      <div className="bg-red-50 p-3 rounded-lg">
                        <p className="text-red-800 font-medium text-sm">
                          ⚠️ Esta acción no se puede deshacer
                        </p>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLiquidacionCompleta}
                    disabled={loading}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        ✅ Confirmar Pago
                      </>
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