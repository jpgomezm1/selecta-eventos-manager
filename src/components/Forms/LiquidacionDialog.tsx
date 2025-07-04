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
    if (!evento) return;
    
    setLoading(true);
    try {
      // Actualizar todos los registros de evento_personal
      const { error: eventoPersonalError } = await supabase
        .from("evento_personal")
        .update({
          estado_pago: 'pagado',
          fecha_pago: formulario.fecha_pago,
          metodo_pago: formulario.metodo_pago,
          notas_pago: formulario.notas_pago
        })
        .eq("evento_id", evento.id);

      if (eventoPersonalError) throw eventoPersonalError;

      // Actualizar el estado del evento
      const { error: eventoError } = await supabase
        .from("eventos")
        .update({
          estado_liquidacion: 'liquidado',
          fecha_liquidacion: formulario.fecha_pago
        })
        .eq("id", evento.id);

      if (eventoError) throw eventoError;

      const totalEmpleados = evento.personal.length;
      const totalMonto = evento.costo_total || 0;

      toast({
        title: "✅ Liquidación confirmada",
        description: `Liquidación confirmada para ${totalEmpleados} empleados ($${totalMonto.toLocaleString()})`,
      });

      setShowConfirmDialog(false);
      onLiquidationComplete();
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar la liquidación masiva",
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

  // Verificar si hay empleados sin horas definidas
  const empleadosSinHoras = evento?.personal.filter(p => !p.horas_trabajadas || p.horas_trabajadas === 0) || [];
  const puedeLiberar = empleadosSinHoras.length === 0;

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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {evento.personal.map((person) => (
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
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      TOTAL:
                    </td>
                    <td className="px-4 py-3 text-right text-lg font-bold text-primary">
                      ${Number(evento.costo_total || 0).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Formulario de liquidación */}
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
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={!puedeLiberar || loading}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  💰 Confirmar Liquidación Completa
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
                      <p>¿Estás seguro de que deseas confirmar el pago completo de todos los empleados de este evento?</p>
                      
                      <div className="bg-gray-50 p-3 rounded-lg space-y-2">
                        <p className="font-medium">Esta acción:</p>
                        <ul className="text-sm space-y-1">
                          <li>• Marcará como PAGADO a {evento.personal.length} empleados</li>
                          <li>• Total a liquidar: ${Number(evento.costo_total || 0).toLocaleString()}</li>
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