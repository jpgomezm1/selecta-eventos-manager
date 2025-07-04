import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, DollarSign, Clock, CheckCircle, AlertCircle, Eye, Filter, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Personal, EventoPersonal, Evento } from "@/types/database";

interface TrabajoConEvento extends EventoPersonal {
  evento: Evento;
}

interface FormularioPago {
  fecha_pago: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'nomina' | 'otro';
  notas_pago: string;
}

export default function PersonalDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [personal, setPersonal] = useState<Personal | null>(null);
  const [trabajos, setTrabajos] = useState<TrabajoConEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [formularioPago, setFormularioPago] = useState<FormularioPago>({
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'efectivo',
    notas_pago: ''
  });
  const [trabajoSeleccionado, setTrabajoSeleccionado] = useState<TrabajoConEvento | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPersonalData();
      fetchTrabajos();
    }
  }, [id]);

  const fetchPersonalData = async () => {
    try {
      const { data, error } = await supabase
        .from("personal")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPersonal(data as Personal);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar datos del personal",
        variant: "destructive",
      });
      navigate("/personal");
    }
  };

  const fetchTrabajos = async () => {
    try {
      const { data, error } = await supabase
        .from("evento_personal")
        .select(`
          *,
          evento:eventos(*)
        `)
        .eq("personal_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTrabajos(data as TrabajoConEvento[] || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar historial de trabajos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarPagado = async () => {
    if (!trabajoSeleccionado) return;

    try {
      const { error } = await supabase
        .from("evento_personal")
        .update({
          estado_pago: 'pagado',
          fecha_pago: formularioPago.fecha_pago,
          metodo_pago: formularioPago.metodo_pago,
          notas_pago: formularioPago.notas_pago || null
        })
        .eq("id", trabajoSeleccionado.id);

      if (error) throw error;

      toast({
        title: "Pago registrado",
        description: "El pago se ha marcado como realizado exitosamente",
      });

      fetchTrabajos();
      setIsDialogOpen(false);
      resetFormulario();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al registrar el pago",
        variant: "destructive",
      });
    }
  };

  const resetFormulario = () => {
    setFormularioPago({
      fecha_pago: new Date().toISOString().split('T')[0],
      metodo_pago: 'efectivo',
      notas_pago: ''
    });
    setTrabajoSeleccionado(null);
  };

  const trabajosFiltrados = trabajos.filter(trabajo => {
    if (filtroEstado === "todos") return true;
    return trabajo.estado_pago === filtroEstado;
  });

  const totalPendiente = trabajos
    .filter(t => t.estado_pago === 'pendiente')
    .reduce((sum, t) => sum + (t.pago_calculado || 0), 0);

  const totalPagado = trabajos
    .filter(t => t.estado_pago === 'pagado')
    .reduce((sum, t) => sum + (t.pago_calculado || 0), 0);

  const totalTrabajos = trabajos.length;

  const getEstadoBadge = (estado: string, fechaEvento?: string) => {
    if (estado === 'pagado') {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" />Pagado</Badge>;
    }
    
    // Verificar si está vencido (más de 30 días)
    if (fechaEvento) {
      const fechaEventoDate = new Date(fechaEvento);
      const hoy = new Date();
      const diffDias = Math.floor((hoy.getTime() - fechaEventoDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias > 30) {
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><AlertCircle className="h-3 w-3 mr-1" />Vencido</Badge>;
      }
    }
    
    return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
  };

  const getRowClassName = (estado: string, fechaEvento?: string) => {
    if (estado === 'pagado') return "bg-green-50";
    
    if (fechaEvento) {
      const fechaEventoDate = new Date(fechaEvento);
      const hoy = new Date();
      const diffDias = Math.floor((hoy.getTime() - fechaEventoDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias > 30) return "bg-red-50";
    }
    
    return "bg-yellow-50";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando información del personal...</p>
        </div>
      </div>
    );
  }

  if (!personal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Personal no encontrado</p>
          <Button onClick={() => navigate("/personal")} className="mt-4">
            Volver a Personal
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/personal")}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a Personal</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-selecta-blue">
              {personal.nombre_completo} - {personal.rol}
            </h1>
            <p className="text-muted-foreground">
              Cédula: {personal.numero_cedula} | Tarifa: ${Number(personal.tarifa_hora).toLocaleString()}/hora
            </p>
          </div>
        </div>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trabajos Totales</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalTrabajos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${totalPendiente.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ganado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalPagado.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historial de Trabajos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Historial de Trabajos</CardTitle>
              <CardDescription>
                Registro completo de eventos trabajados
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendientes</SelectItem>
                  <SelectItem value="pagado">Pagados</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trabajosFiltrados.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {trabajos.length === 0 
                  ? "No hay trabajos registrados" 
                  : "No se encontraron trabajos con los filtros seleccionados"
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trabajosFiltrados.map((trabajo) => (
                    <TableRow 
                      key={trabajo.id}
                      className={getRowClassName(trabajo.estado_pago, trabajo.evento.fecha_evento)}
                    >
                      <TableCell>
                        {new Date(trabajo.evento.fecha_evento).toLocaleDateString('es-CO')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="p-0 h-auto text-left font-medium"
                          onClick={() => navigate(`/eventos`)}
                        >
                          {trabajo.evento.nombre_evento}
                        </Button>
                      </TableCell>
                      <TableCell>
                        {trabajo.horas_trabajadas ? `${trabajo.horas_trabajadas}h` : '-'}
                      </TableCell>
                      <TableCell>
                        ${Number(trabajo.pago_calculado || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {getEstadoBadge(trabajo.estado_pago, trabajo.evento.fecha_evento)}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {trabajo.estado_pago === 'pendiente' && (
                          <Dialog open={isDialogOpen && trabajoSeleccionado?.id === trabajo.id} onOpenChange={(open) => {
                            if (!open) {
                              setIsDialogOpen(false);
                              resetFormulario();
                            }
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setTrabajoSeleccionado(trabajo);
                                  setIsDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Marcar Pagado
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Registrar Pago</DialogTitle>
                                <DialogDescription>
                                  Marca este trabajo como pagado
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="bg-muted p-4 rounded-lg">
                                  <p><strong>Empleado:</strong> {personal.nombre_completo}</p>
                                  <p><strong>Evento:</strong> {trabajo.evento.nombre_evento}</p>
                                  <p><strong>Horas trabajadas:</strong> {trabajo.horas_trabajadas}h</p>
                                  <p><strong>Monto a pagar:</strong> ${Number(trabajo.pago_calculado || 0).toLocaleString()}</p>
                                </div>
                                
                                <div className="space-y-2">
                                  <Label htmlFor="fecha_pago">Fecha de pago</Label>
                                  <Input
                                    id="fecha_pago"
                                    type="date"
                                    value={formularioPago.fecha_pago}
                                    onChange={(e) => setFormularioPago(prev => ({
                                      ...prev,
                                      fecha_pago: e.target.value
                                    }))}
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="metodo_pago">Método de pago</Label>
                                  <Select 
                                    value={formularioPago.metodo_pago} 
                                    onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') => 
                                      setFormularioPago(prev => ({ ...prev, metodo_pago: value }))
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
                                  <Label htmlFor="notas_pago">Notas (opcional)</Label>
                                  <Textarea
                                    id="notas_pago"
                                    placeholder="Observaciones adicionales..."
                                    value={formularioPago.notas_pago}
                                    onChange={(e) => setFormularioPago(prev => ({
                                      ...prev,
                                      notas_pago: e.target.value
                                    }))}
                                  />
                                </div>

                                <div className="flex justify-end space-x-2 pt-4">
                                  <Button 
                                    variant="outline" 
                                    onClick={() => {
                                      setIsDialogOpen(false);
                                      resetFormulario();
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button onClick={handleMarcarPagado}>
                                    Confirmar Pago
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/eventos`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}