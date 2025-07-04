import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download, Printer, FileText, ClipboardList } from "lucide-react";
import { RegistroPagoConEventos } from "@/types/database";

interface ComprobanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  registroPago: RegistroPagoConEventos | null;
  empleadoNombre: string;
}

export function ComprobanteModal({ isOpen, onClose, registroPago, empleadoNombre }: ComprobanteModalProps) {
  if (!registroPago) return null;

  const tipoIcon = registroPago.tipo_liquidacion === 'evento' 
    ? <FileText className="h-5 w-5" />
    : <ClipboardList className="h-5 w-5" />;

  const tipoTexto = registroPago.tipo_liquidacion === 'evento' 
    ? 'Liquidación por Evento'
    : `Liquidación Múltiple (${registroPago.eventos.length} eventos)`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center space-x-2 text-xl">
            {tipoIcon}
            <span>Comprobante de Pago #{registroPago.numero_comprobante.split('-').pop()}</span>
          </DialogTitle>
          <DialogDescription>
            Registro oficial de liquidación
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del empleado y pago */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos del Pago</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Empleado</p>
                  <p className="font-medium">{empleadoNombre}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fecha de pago</p>
                  <p className="font-medium">{new Date(registroPago.fecha_pago).toLocaleDateString('es-CO')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Método de pago</p>
                  <p className="font-medium capitalize">{registroPago.metodo_pago}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tipo</p>
                  <p className="font-medium">{tipoTexto}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detalle de eventos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {registroPago.tipo_liquidacion === 'evento' ? 'Detalle del Evento' : 'Detalle de Eventos'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {registroPago.eventos.map((eventoDetalle, index) => (
                  <div key={eventoDetalle.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{index + 1}. {eventoDetalle.evento.nombre_evento}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(eventoDetalle.evento.fecha_evento).toLocaleDateString('es-CO')} - {eventoDetalle.evento.ubicacion}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${eventoDetalle.monto_evento.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Horas trabajadas: {eventoDetalle.horas_trabajadas}h</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Resumen */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {registroPago.tipo_liquidacion === 'multiple' && (
                  <>
                    <div className="flex justify-between">
                      <span>Total eventos:</span>
                      <span className="font-medium">{registroPago.eventos.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total horas:</span>
                      <span className="font-medium">
                        {registroPago.eventos.reduce((sum, e) => sum + e.horas_trabajadas, 0).toFixed(1)}h
                      </span>
                    </div>
                  </>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total pagado:</span>
                  <span>${registroPago.monto_total.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información adicional */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Liquidado por:</p>
                  <p className="font-medium">{registroPago.usuario_liquidador || 'Sistema'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">ID Transacción:</p>
                  <p className="font-medium font-mono">{registroPago.numero_comprobante}</p>
                </div>
              </div>
              {registroPago.notas && (
                <div className="mt-4">
                  <p className="text-muted-foreground">Notas:</p>
                  <p className="text-sm">{registroPago.notas}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}