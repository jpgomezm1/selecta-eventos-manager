import { useState, useEffect } from "react";
import {
  CalendarDays,
  MapPin,
  Users,
  Calculator,
  X,
  CheckCircle,
  AlertTriangle,
  FileText,
  Clock,
  TrendingUp,
  Award,
  Receipt,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal } from "@/types/database";
import { formatLocalDate } from "@/lib/dateLocal";
import { getModalidadCobroLabel, requiereRegistroHoras } from "@/lib/calcularPagoPersonal";

interface LiquidacionDialogProps {
  evento: EventoConPersonal | null;
  isOpen: boolean;
  onClose: () => void;
  onLiquidationComplete: () => void;
}

interface FormularioLiquidacion {
  fecha_pago: string;
  metodo_pago: "efectivo" | "transferencia" | "nomina" | "otro";
  notas_pago: string;
}

export function LiquidacionDialog({
  evento,
  isOpen,
  onClose,
  onLiquidationComplete,
}: LiquidacionDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formulario, setFormulario] = useState<FormularioLiquidacion>({
    fecha_pago: new Date().toISOString().split("T")[0],
    metodo_pago: "transferencia",
    notas_pago: "Liquidación completa del evento",
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const empleadosPendientes = evento?.personal.filter((p) => p.estado_pago !== "pagado") || [];
  const empleadosPagados = evento?.personal.filter((p) => p.estado_pago === "pagado") || [];
  const empleadosSinHoras = empleadosPendientes.filter(
    (p) => requiereRegistroHoras(p.modalidad_cobro) && (!p.horas_trabajadas || p.horas_trabajadas === 0)
  );
  const puedeLiberar = empleadosSinHoras.length === 0 && empleadosPendientes.length > 0;

  const totalPendientes = empleadosPendientes.reduce((sum, p) => sum + (p.pago_calculado || 0), 0);
  const totalPagados = empleadosPagados.reduce((sum, p) => sum + (p.pago_calculado || 0), 0);
  const totalGeneral = totalPendientes + totalPagados;

  const handleLiquidacionCompleta = async () => {
    if (!evento || empleadosPendientes.length === 0) return;

    setLoading(true);
    try {
      const empleadosPendientesIds = empleadosPendientes.map((p) => p.evento_personal_id).filter(Boolean);

      const { error: eventoPersonalError } = await supabase
        .from("evento_personal")
        .update({
          estado_pago: "pagado",
          fecha_pago: formulario.fecha_pago,
          metodo_pago: formulario.metodo_pago,
          notas_pago: formulario.notas_pago,
        })
        .in("id", empleadosPendientesIds);

      if (eventoPersonalError) throw eventoPersonalError;

      const { data: todosLosEmpleados, error: checkError } = await supabase
        .from("evento_personal")
        .select("estado_pago")
        .eq("evento_id", evento.id);

      if (checkError) throw checkError;

      const todosLiquidados = todosLosEmpleados?.every((emp) => emp.estado_pago === "pagado");

      if (todosLiquidados) {
        const { error: eventoError } = await supabase
          .from("eventos")
          .update({
            estado_liquidacion: "liquidado",
            fecha_liquidacion: formulario.fecha_pago,
          })
          .eq("id", evento.id);

        if (eventoError) throw eventoError;
      }

      toast({
        title: "Liquidación confirmada",
        description: `${empleadosPendientes.length} empleados · $${totalPendientes.toLocaleString()}`,
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
      fecha_pago: new Date().toISOString().split("T")[0],
      metodo_pago: "transferencia",
      notas_pago: "Liquidación completa del evento",
    });
    setShowConfirmDialog(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetFormulario();
    }
  }, [isOpen]);

  if (!evento) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-5xl max-h-[95vh] overflow-auto">
        {/* Header */}
        <DialogHeader className="pb-6 border-b border-border">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-start gap-4">
              <Calculator className="h-6 w-6 text-primary mt-1" strokeWidth={1.75} />
              <div>
                <span className="kicker text-muted-foreground">Liquidación</span>
                <DialogTitle className="font-serif text-2xl text-foreground mt-0.5">
                  {evento.nombre_evento}
                </DialogTitle>
                <DialogDescription asChild>
                  <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {formatLocalDate(evento.fecha_evento, "es-CO")}
                    </span>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {evento.ubicacion}
                    </span>
                  </div>
                </DialogDescription>
              </div>
            </div>

            {/* Stats rápidas */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="border border-border rounded-md px-4 py-2 text-center">
                <div className="font-semibold text-foreground tabular-nums">
                  {empleadosPendientes.length + empleadosPagados.length}
                </div>
                <div className="kicker text-muted-foreground mt-0.5">Empleados</div>
              </div>
              <div className="border border-border rounded-md px-4 py-2 text-center">
                <div className="font-semibold text-primary tabular-nums">
                  ${totalGeneral.toLocaleString()}
                </div>
                <div className="kicker text-muted-foreground mt-0.5">Total</div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Advertencia si hay empleados sin horas */}
          {empleadosSinHoras.length > 0 && (
            <div className="bg-muted/40 border border-border rounded-md p-5">
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle
                  className="h-5 w-5 text-[hsl(30_55%_42%)] mt-0.5 flex-shrink-0"
                  strokeWidth={1.75}
                />
                <div>
                  <h4 className="font-semibold text-foreground">Empleados por hora sin horas registradas</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Estos empleados cobran por hora y necesitan horas definidas para calcular su pago.
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5 ml-8">
                {empleadosSinHoras.map((emp) => (
                  <li key={emp.id} className="flex items-center gap-2 text-sm">
                    <span className="text-foreground font-medium">{emp.nombre_completo}</span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {emp.rol}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* KPIs editoriales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </CardHeader>
              <CardContent>
                <div className="kicker text-muted-foreground">Pendientes de pago</div>
                <div className="font-serif text-3xl font-semibold text-foreground tabular-nums mt-1">
                  {empleadosPendientes.length}
                </div>
                <div className="text-sm text-[hsl(30_55%_42%)] font-medium tabular-nums mt-2">
                  ${totalPendientes.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CheckCircle className="h-4 w-4 text-primary" strokeWidth={1.75} />
              </CardHeader>
              <CardContent>
                <div className="kicker text-muted-foreground">Ya pagados</div>
                <div className="font-serif text-3xl font-semibold text-foreground tabular-nums mt-1">
                  {empleadosPagados.length}
                </div>
                <div className="text-sm text-primary font-medium tabular-nums mt-2">
                  ${totalPagados.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </CardHeader>
              <CardContent>
                <div className="kicker text-muted-foreground">Total empleados</div>
                <div className="font-serif text-3xl font-semibold text-foreground tabular-nums mt-1">
                  {empleadosPendientes.length + empleadosPagados.length}
                </div>
                <div className="text-sm text-muted-foreground tabular-nums mt-2">
                  ${totalGeneral.toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de empleados */}
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" strokeWidth={1.75} />
                <CardTitle className="font-serif text-lg text-foreground">
                  Detalle de liquidación
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-5 py-3 text-left kicker text-muted-foreground">Empleado</th>
                      <th className="px-5 py-3 text-left kicker text-muted-foreground">Rol</th>
                      <th className="px-5 py-3 text-center kicker text-muted-foreground">Horas</th>
                      <th className="px-5 py-3 text-right kicker text-muted-foreground">Tarifa</th>
                      <th className="px-5 py-3 text-right kicker text-muted-foreground">Total</th>
                      <th className="px-5 py-3 text-center kicker text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Pendientes */}
                    {empleadosPendientes.length > 0 && (
                      <>
                        <tr className="bg-muted/30">
                          <td
                            colSpan={6}
                            className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            <div className="flex items-center gap-3">
                              <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                              <span>Pendientes de pago ({empleadosPendientes.length})</span>
                              <span className="font-mono tabular-nums normal-case tracking-normal text-[hsl(30_55%_42%)]">
                                ${totalPendientes.toLocaleString()}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {empleadosPendientes.map((person) => (
                          <tr
                            key={person.id}
                            className={`border-b border-border/60 transition-colors hover:bg-muted/20 ${
                              !person.horas_trabajadas && requiereRegistroHoras(person.modalidad_cobro)
                                ? "bg-destructive/5"
                                : ""
                            }`}
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                  <span className="text-[11px] font-medium">
                                    {person.nombre_completo
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-foreground">{person.nombre_completo}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <Badge variant="outline" className="font-normal">
                                {person.rol}
                              </Badge>
                            </td>
                            <td className="px-5 py-3 text-center">
                              {person.horas_trabajadas ? (
                                <span className="font-mono tabular-nums text-foreground">
                                  {person.horas_trabajadas}h
                                </span>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs font-normal text-destructive border-destructive/40"
                                >
                                  Sin definir
                                </Badge>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono tabular-nums text-foreground">
                                  ${(Number(person.tarifa) || 0).toLocaleString()}
                                </span>
                                <span className="kicker text-muted-foreground mt-0.5">
                                  {getModalidadCobroLabel(person.modalidad_cobro)}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="font-semibold text-primary tabular-nums">
                                ${Number(person.pago_calculado || 0).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <Badge
                                variant="outline"
                                className="text-xs font-normal text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]"
                              >
                                <Clock className="h-3 w-3 mr-1" strokeWidth={1.75} />
                                Pendiente
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}

                    {/* Pagados */}
                    {empleadosPagados.length > 0 && (
                      <>
                        <tr className="bg-muted/30">
                          <td
                            colSpan={6}
                            className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            <div className="flex items-center gap-3">
                              <CheckCircle className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                              <span>Ya pagados ({empleadosPagados.length})</span>
                              <span className="font-mono tabular-nums normal-case tracking-normal text-primary">
                                ${totalPagados.toLocaleString()}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {empleadosPagados.map((person) => (
                          <tr
                            key={person.id}
                            className="border-b border-border/60 bg-primary/[0.02]"
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                                  <span className="text-[11px] font-medium">
                                    {person.nombre_completo
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                </div>
                                <span className="font-medium text-foreground">{person.nombre_completo}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              <Badge variant="outline" className="font-normal">
                                {person.rol}
                              </Badge>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className="font-mono tabular-nums text-muted-foreground">
                                {person.horas_trabajadas ?? 0}h
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono tabular-nums text-muted-foreground">
                                  ${(Number(person.tarifa) || 0).toLocaleString()}
                                </span>
                                <span className="kicker text-muted-foreground mt-0.5">
                                  {getModalidadCobroLabel(person.modalidad_cobro)}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className="font-semibold text-primary tabular-nums">
                                ${Number(person.pago_calculado || 0).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="default" className="text-xs font-normal">
                                  <CheckCircle className="h-3 w-3 mr-1" strokeWidth={1.75} />
                                  Pagado
                                </Badge>
                                {person.fecha_pago && (
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    {new Date(person.fecha_pago).toLocaleDateString("es-CO")}
                                  </span>
                                )}
                                {person.metodo_pago && (
                                  <span className="text-[10px] text-muted-foreground capitalize">
                                    {person.metodo_pago}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totales */}
              <div className="p-5 space-y-3 border-t border-border">
                {totalPendientes > 0 && (
                  <div className="flex items-center justify-between p-4 rounded-md border border-primary/30 bg-primary/5">
                    <div className="flex items-center gap-3">
                      <Calculator className="h-5 w-5 text-primary" strokeWidth={1.75} />
                      <span className="kicker text-primary">Total a liquidar</span>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-2xl font-semibold text-primary tabular-nums">
                        ${totalPendientes.toLocaleString()}
                      </div>
                      <div className="kicker text-muted-foreground">
                        {empleadosPendientes.length} empleados
                      </div>
                    </div>
                  </div>
                )}

                {totalPagados > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-primary" strokeWidth={1.75} />
                      <span className="kicker text-muted-foreground">Total ya pagado</span>
                    </div>
                    <span className="font-mono text-base text-primary tabular-nums">
                      ${totalPagados.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Formulario de liquidación */}
          {empleadosPendientes.length > 0 ? (
            <Card>
              <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" strokeWidth={1.75} />
                  <CardTitle className="font-serif text-lg text-foreground">
                    Configuración de liquidación
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="metodo_pago" className="text-sm font-medium text-foreground">
                      Método de pago
                    </Label>
                    <Select
                      value={formulario.metodo_pago}
                      onValueChange={(value: "efectivo" | "transferencia" | "nomina" | "otro") =>
                        setFormulario((prev) => ({ ...prev, metodo_pago: value }))
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
                    <Label htmlFor="fecha_pago" className="text-sm font-medium text-foreground">
                      Fecha de pago
                    </Label>
                    <Input
                      id="fecha_pago"
                      type="date"
                      value={formulario.fecha_pago}
                      onChange={(e) =>
                        setFormulario((prev) => ({
                          ...prev,
                          fecha_pago: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="notas_pago" className="text-sm font-medium text-foreground">
                      Notas de liquidación
                    </Label>
                    <Textarea
                      id="notas_pago"
                      placeholder="Observaciones adicionales sobre la liquidación..."
                      value={formulario.notas_pago}
                      onChange={(e) =>
                        setFormulario((prev) => ({
                          ...prev,
                          notas_pago: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>
                </div>

                {/* Vista previa */}
                <div className="mt-5 p-4 rounded-md border border-border bg-muted/30">
                  <div className="kicker text-muted-foreground mb-3">Vista previa</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="kicker text-muted-foreground">Empleados</div>
                      <div className="font-semibold text-foreground tabular-nums mt-0.5">
                        {empleadosPendientes.length}
                      </div>
                    </div>
                    <div>
                      <div className="kicker text-muted-foreground">Total</div>
                      <div className="font-semibold text-primary tabular-nums mt-0.5">
                        ${totalPendientes.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="kicker text-muted-foreground">Fecha</div>
                      <div className="font-mono tabular-nums text-foreground mt-0.5">
                        {new Date(formulario.fecha_pago).toLocaleDateString("es-CO")}
                      </div>
                    </div>
                    <div>
                      <div className="kicker text-muted-foreground">Método</div>
                      <div className="font-medium text-foreground capitalize mt-0.5">
                        {formulario.metodo_pago}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center space-y-3">
                <CheckCircle className="h-8 w-8 text-primary mx-auto" strokeWidth={1.5} />
                <div>
                  <h4 className="font-serif text-lg text-foreground">
                    Evento completamente liquidado
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    Todos los empleados de este evento ya han sido pagados. No hay liquidaciones
                    pendientes.
                  </p>
                </div>
                {empleadosPagados.length > 0 && empleadosPagados[0].fecha_pago && (
                  <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Award className="h-4 w-4" strokeWidth={1.75} />
                    <span>
                      Última liquidación:{" "}
                      {new Date(empleadosPagados[0].fecha_pago).toLocaleDateString("es-CO")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Botones de acción */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-5 border-t border-border">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" strokeWidth={1.75} />
                Cerrar
              </Button>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" strokeWidth={1.75} />
                Exportar PDF
              </Button>
            </div>

            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={!puedeLiberar || loading}
                  variant={empleadosPendientes.length > 0 ? "default" : "outline"}
                >
                  {empleadosPendientes.length > 0 ? (
                    <>
                      Liquidar {empleadosPendientes.length} empleados
                      <Badge
                        variant="outline"
                        className="ml-2 font-normal tabular-nums bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20"
                      >
                        ${totalPendientes.toLocaleString()}
                      </Badge>
                    </>
                  ) : (
                    "Evento completamente liquidado"
                  )}
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent className="sm:max-w-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-3 font-serif text-xl">
                    <AlertTriangle className="h-5 w-5 text-destructive" strokeWidth={1.75} />
                    Confirmar liquidación
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-4 mt-3">
                      <p className="text-sm text-muted-foreground">
                        ¿Estás seguro de que deseas procesar el pago de los empleados pendientes de
                        este evento?
                      </p>

                      {/* Resumen */}
                      <div className="rounded-md border border-border bg-muted/30 p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Calculator className="h-4 w-4 text-primary" strokeWidth={1.75} />
                          <span className="kicker text-muted-foreground">
                            Resumen de la liquidación
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Empleados a pagar: </span>
                            <strong className="text-foreground tabular-nums">
                              {empleadosPendientes.length}
                            </strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total a liquidar: </span>
                            <strong className="text-primary tabular-nums">
                              ${totalPendientes.toLocaleString()}
                            </strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fecha: </span>
                            <strong className="text-foreground">
                              {new Date(formulario.fecha_pago).toLocaleDateString("es-CO")}
                            </strong>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Método: </span>
                            <strong className="text-foreground capitalize">
                              {formulario.metodo_pago}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Advertencia */}
                      <div className="flex items-start gap-3 p-4 rounded-md border border-destructive/30 bg-destructive/5">
                        <AlertTriangle
                          className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5"
                          strokeWidth={1.75}
                        />
                        <div>
                          <p className="font-medium text-destructive">Acción irreversible</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Marcará permanentemente como pagados a todos los empleados seleccionados.
                            No podrás deshacer esta operación.
                          </p>
                        </div>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter className="pt-4">
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLiquidacionCompleta} disabled={loading}>
                    {loading ? (
                      <>
                        <div className="w-4 h-4 rounded-full bg-primary-foreground/30 animate-pulse mr-2" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" strokeWidth={1.75} />
                        Confirmar pago
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Footer informativo */}
          <div className="flex items-center justify-center gap-3 pt-3 text-xs text-muted-foreground">
            <span>Sistema de liquidación seguro</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            <span className="flex items-center gap-1.5 font-mono tabular-nums">
              <Receipt className="h-3.5 w-3.5" strokeWidth={1.75} />
              {new Date().toLocaleTimeString("es-CO", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
