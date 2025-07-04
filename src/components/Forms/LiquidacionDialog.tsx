import { Calculator, DollarSign, Printer, FileDown } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EventoConPersonal } from "@/types/database";

interface LiquidacionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  evento: EventoConPersonal;
}

export function LiquidacionDialog({ open, onOpenChange, evento }: LiquidacionDialogProps) {
  const calcularTotalEvento = () => {
    return evento.personal.reduce((total, person) => {
      return total + (person.pago_calculado || 0);
    }, 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)}h`;
  };

  const handleExportPDF = () => {
    // TODO: Implementar exportación a PDF
    console.log("Exportar PDF - funcionalidad pendiente");
  };

  const handlePrint = () => {
    window.print();
  };

  const totalEvento = calcularTotalEvento();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Liquidación de Evento</DialogTitle>
              <DialogDescription>
                {evento.nombre_evento} - {format(new Date(evento.fecha_evento), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del evento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumen del Evento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Evento</p>
                  <p className="font-semibold">{evento.nombre_evento}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fecha</p>
                  <p className="font-semibold">
                    {format(new Date(evento.fecha_evento), "dd/MM/yyyy", { locale: es })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ubicación</p>
                  <p className="font-semibold">{evento.ubicacion}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Personal</p>
                  <p className="font-semibold">{evento.personal.length} empleados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detalle de liquidación */}
          <Card>
            <CardHeader>
              <CardTitle>Detalle de Liquidación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Header de la tabla */}
                <div className="hidden md:grid grid-cols-6 gap-4 pb-2 text-sm font-medium text-muted-foreground border-b">
                  <div>EMPLEADO</div>
                  <div>ROL</div>
                  <div className="text-center">HORAS</div>
                  <div className="text-right">TARIFA/H</div>
                  <div className="text-right">TOTAL</div>
                  <div className="text-center">ESTADO</div>
                </div>

                {/* Filas de empleados */}
                {evento.personal.map((person, index) => {
                  const hasHours = person.horas_trabajadas && person.horas_trabajadas > 0;
                  const pago = person.pago_calculado || 0;

                  return (
                    <div key={person.id || index}>
                      {/* Desktop view */}
                      <div className="hidden md:grid grid-cols-6 gap-4 py-3 items-center hover:bg-muted/30 rounded-lg px-2">
                        <div>
                          <p className="font-medium">{person.nombre_completo}</p>
                        </div>
                        <div>
                          <Badge variant="outline" className="text-xs">
                            {person.rol}
                          </Badge>
                        </div>
                        <div className="text-center">
                          {hasHours ? (
                            <span className="font-medium">{formatHours(person.horas_trabajadas!)}</span>
                          ) : (
                            <span className="text-muted-foreground">Sin definir</span>
                          )}
                        </div>
                        <div className="text-right">
                          {formatCurrency(Number(person.tarifa_hora))}
                        </div>
                        <div className="text-right font-semibold">
                          {hasHours ? formatCurrency(pago) : "-"}
                        </div>
                        <div className="text-center">
                          {hasHours ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Listo
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              Pendiente
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Mobile view */}
                      <div className="md:hidden border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{person.nombre_completo}</p>
                            <Badge variant="outline" className="text-xs mt-1">
                              {person.rol}
                            </Badge>
                          </div>
                          {hasHours ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Listo
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              Pendiente
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Horas: </span>
                            {hasHours ? formatHours(person.horas_trabajadas!) : "Sin definir"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tarifa: </span>
                            {formatCurrency(Number(person.tarifa_hora))}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground">Total: </span>
                          <span className="font-semibold">
                            {hasHours ? formatCurrency(pago) : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <Separator />

                {/* Total */}
                <div className="flex justify-end">
                  <div className="bg-primary/5 p-4 rounded-lg">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-medium">TOTAL EVENTO:</span>
                      <span className="text-2xl font-bold text-primary">
                        {formatCurrency(totalEvento)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}