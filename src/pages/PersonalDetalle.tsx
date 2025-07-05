import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, DollarSign, Clock, CheckCircle, AlertCircle, Eye, Download, BarChart3, User, CreditCard, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Personal, EventoPersonal, Evento } from "@/types/database";
import { RegistroPagos } from "@/components/Forms/RegistroPagos";

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
  
  // Estados para liquidación múltiple
  const [eventosSeleccionados, setEventosSeleccionados] = useState<Set<string>>(new Set());
  const [isLiquidacionMasivaOpen, setIsLiquidacionMasivaOpen] = useState(false);
  const [isConfirmacionMasivaOpen, setIsConfirmacionMasivaOpen] = useState(false);
  const [formularioLiquidacionMasiva, setFormularioLiquidacionMasiva] = useState<FormularioPago>({
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'transferencia',
    notas_pago: ''
  });

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
      // Actualizar el estado del pago
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

      // Generar número de comprobante
      const { data: numeroComprobante } = await supabase.rpc('generate_comprobante_number');
      
      // Crear registro de pago
      const { data: registroPago, error: errorRegistro } = await supabase
        .from("registro_pagos")
        .insert({
          empleado_id: id,
          fecha_pago: formularioPago.fecha_pago,
          tipo_liquidacion: 'evento',
          monto_total: trabajoSeleccionado.pago_calculado || 0,
          metodo_pago: formularioPago.metodo_pago,
          notas: formularioPago.notas_pago || null,
          usuario_liquidador: 'Sistema',
          numero_comprobante: numeroComprobante
        })
        .select()
        .single();

      if (errorRegistro) throw errorRegistro;

      // Crear relación con el evento
      const { error: errorRelacion } = await supabase
        .from("registro_pago_eventos")
        .insert({
          registro_pago_id: registroPago.id,
          evento_id: trabajoSeleccionado.evento_id,
          horas_trabajadas: trabajoSeleccionado.horas_trabajadas || 0,
          monto_evento: trabajoSeleccionado.pago_calculado || 0
        });

      if (errorRelacion) throw errorRelacion;

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

  // Funciones para selección múltiple
  const eventosPendientes = trabajos.filter(t => t.estado_pago === 'pendiente');
  
  const handleSeleccionarEvento = (eventoId: string, seleccionado: boolean) => {
    const nuevaSeleccion = new Set(eventosSeleccionados);
    if (seleccionado) {
      nuevaSeleccion.add(eventoId);
    } else {
      nuevaSeleccion.delete(eventoId);
    }
    setEventosSeleccionados(nuevaSeleccion);
  };

  const handleSeleccionarTodos = (seleccionarTodos: boolean) => {
    if (seleccionarTodos) {
      const todosLosPendientes = new Set(eventosPendientes.map(t => t.id));
      setEventosSeleccionados(todosLosPendientes);
    } else {
      setEventosSeleccionados(new Set());
    }
  };

  const eventosSeleccionadosList = trabajos.filter(t => eventosSeleccionados.has(t.id));
  const totalEventosSeleccionados = eventosSeleccionadosList.length;
  const totalPagoSeleccionado = eventosSeleccionadosList.reduce((sum, t) => sum + (t.pago_calculado || 0), 0);
  const totalHorasSeleccionadas = eventosSeleccionadosList.reduce((sum, t) => sum + (t.horas_trabajadas || 0), 0);

  const handleLiquidacionMasiva = async () => {
    if (eventosSeleccionados.size === 0) return;

    try {
      // Actualizar todos los eventos seleccionados
      const { error } = await supabase
        .from("evento_personal")
        .update({
          estado_pago: 'pagado',
          fecha_pago: formularioLiquidacionMasiva.fecha_pago,
          metodo_pago: formularioLiquidacionMasiva.metodo_pago,
          notas_pago: formularioLiquidacionMasiva.notas_pago || null
        })
        .in("id", Array.from(eventosSeleccionados));

      if (error) throw error;

      // Verificar si todos los empleados de cada evento están pagados y actualizar estado del evento
      const eventosIds = new Set(eventosSeleccionadosList.map(t => t.evento_id));
      
      for (const eventoId of eventosIds) {
        if (eventoId) {
          const { data: todosLosEmpleados } = await supabase
            .from("evento_personal")
            .select("estado_pago")
            .eq("evento_id", eventoId);

          const todosEmpleadosPagados = todosLosEmpleados?.every(emp => emp.estado_pago === 'pagado');

          if (todosEmpleadosPagados) {
            await supabase
              .from("eventos")
              .update({
                estado_liquidacion: 'liquidado',
                fecha_liquidacion: formularioLiquidacionMasiva.fecha_pago
              })
              .eq("id", eventoId);
          }
        }
      }

      toast({
        title: "Liquidación confirmada",
        description: `Se han liquidado ${totalEventosSeleccionados} eventos por un total de $${totalPagoSeleccionado.toLocaleString()}`,
      });

      // Limpiar selección y cerrar dialogs
      setEventosSeleccionados(new Set());
      setIsLiquidacionMasivaOpen(false);
      setIsConfirmacionMasivaOpen(false);
      setFormularioLiquidacionMasiva({
        fecha_pago: new Date().toISOString().split('T')[0],
        metodo_pago: 'transferencia',
        notas_pago: ''
      });
      
      fetchTrabajos();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar la liquidación masiva",
        variant: "destructive",
      });
    }
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
      return <Badge className="bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-200/60 hover:from-green-200 hover:to-green-300"><CheckCircle className="h-3 w-3 mr-1" />Pagado</Badge>;
    }
    
    // Verificar si está vencido (más de 30 días)
    if (fechaEvento) {
      const fechaEventoDate = new Date(fechaEvento);
      const hoy = new Date();
      const diffDias = Math.floor((hoy.getTime() - fechaEventoDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias > 30) {
        return <Badge className="bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-red-200/60 hover:from-red-200 hover:to-red-300"><AlertCircle className="h-3 w-3 mr-1" />Vencido</Badge>;
      }
    }
    
    return <Badge className="bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-200/60 hover:from-orange-200 hover:to-orange-300"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
  };

  const getRowClassName = (estado: string, fechaEvento?: string) => {
    if (estado === 'pagado') return "hover:bg-green-50/50 transition-colors";
    
    if (fechaEvento) {
      const fechaEventoDate = new Date(fechaEvento);
      const hoy = new Date();
      const diffDias = Math.floor((hoy.getTime() - fechaEventoDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias > 30) return "hover:bg-red-50/50 transition-colors";
    }
    
    return "hover:bg-orange-50/50 transition-colors";
  };

  if (loading) {
    return (
      <div className="min-h-screen relative">
        {/* Background decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-selecta-green/3 to-primary/3 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-slate-100/50 to-selecta-green/5 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-selecta-green to-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl animate-pulse">
              <User className="h-8 w-8 text-white" />
            </div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-selecta-green mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Cargando información del personal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!personal) {
    return (
      <div className="min-h-screen relative">
        {/* Background decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-selecta-green/3 to-primary/3 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-slate-100/50 to-selecta-green/5 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Personal no encontrado</h3>
            <p className="text-slate-600 mb-4">El empleado solicitado no existe en el sistema</p>
            <Button 
              onClick={() => navigate("/personal")} 
              className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-lg hover:scale-105 transition-all duration-200 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Personal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background decorativo sutil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-selecta-green/3 to-primary/3 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-slate-100/50 to-selecta-green/5 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>
      </div>

      <div className="relative z-10 space-y-8">
        {/* Header mejorado */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/personal")}
              className="flex items-center space-x-2 hover:bg-white/60 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver a Personal</span>
            </Button>
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                  {personal.nombre_completo}
                </h1>
                <p className="text-slate-600 text-lg font-medium mt-1">
                  {personal.rol} • Cédula: {personal.numero_cedula} • ${Number(personal.tarifa_hora).toLocaleString()}/hora
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards con glassmorphism */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Trabajos Totales</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                    {totalTrabajos}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-blue-200 rounded-2xl flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Pagos Pendientes</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                    ${totalPendiente.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center">
                  <Clock className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Total Ganado</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                    ${totalPagado.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-2xl flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido con pestañas mejorado */}
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
            <Tabs defaultValue="historial" className="space-y-6">
              <div className="p-6 border-b border-slate-200/60">
                <TabsList className="grid w-full grid-cols-3 bg-slate-100/80 rounded-2xl p-1">
                  <TabsTrigger value="historial" className="flex items-center space-x-2 rounded-xl">
                    <Calendar className="h-4 w-4" />
                    <span>Historial</span>
                  </TabsTrigger>
                  <TabsTrigger value="pagos" className="flex items-center space-x-2 rounded-xl">
                    <CreditCard className="h-4 w-4" />
                    <span>Registro de Pagos</span>
                  </TabsTrigger>
                  <TabsTrigger value="estadisticas" className="flex items-center space-x-2 rounded-xl">
                    <TrendingUp className="h-4 w-4" />
                    <span>Estadísticas</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Pestaña de Historial */}
              <TabsContent value="historial" className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-selecta-green to-primary rounded-xl flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Historial de Trabajos</h3>
                      <p className="text-sm text-slate-600">Registro completo de eventos trabajados</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                      <SelectTrigger className="w-48 bg-white/80 border-slate-200/60 rounded-xl">
                        <SelectValue placeholder="Filtrar por estado" />
                      </SelectTrigger>
                      <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl">
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pendiente">Pendientes</SelectItem>
                        <SelectItem value="pagado">Pagados</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="bg-white/80 border-slate-200/60 rounded-xl hover:bg-white hover:shadow-md">
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  </div>
                </div>

                {trabajosFiltrados.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Calendar className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                      {trabajos.length === 0 ? "No hay trabajos registrados" : "No se encontraron trabajos"}
                    </h3>
                    <p className="text-slate-600 max-w-sm mx-auto">
                      {trabajos.length === 0 
                        ? "Este empleado aún no tiene eventos asignados" 
                        : "No se encontraron trabajos con los filtros seleccionados"
                      }
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Selección múltiple para eventos pendientes */}
                    {eventosPendientes.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="seleccionar-todos"
                            checked={eventosPendientes.length > 0 && eventosPendientes.every(t => eventosSeleccionados.has(t.id))}
                            onCheckedChange={handleSeleccionarTodos}
                          />
                          <Label htmlFor="seleccionar-todos" className="text-sm font-medium text-slate-700">
                            Seleccionar todos los pendientes ({eventosPendientes.length})
                          </Label>
                        </div>
                        
                        {eventosSeleccionados.size > 0 && (
                          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-xl border border-emerald-200/60">
                            <div className="text-sm">
                              <span className="font-medium text-emerald-800">SELECCIONADOS:</span> 
                              <span className="text-emerald-700"> {totalEventosSeleccionados} eventos | </span>
                              <span className="font-medium text-emerald-800">TOTAL A PAGAR:</span> 
                              <span className="text-emerald-700"> ${totalPagoSeleccionado.toLocaleString()}</span>
                            </div>
                            <Button 
                              onClick={() => setIsLiquidacionMasivaOpen(true)}
                              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-xl shadow-md"
                            >
                              <DollarSign className="h-4 w-4 mr-2" />
                              Liquidar Eventos Seleccionados
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100/80 hover:from-slate-100 hover:to-slate-200/80">
                            {eventosPendientes.length > 0 && <TableHead className="w-12 text-slate-800 font-bold"></TableHead>}
                            <TableHead className="text-slate-800 font-bold">Fecha</TableHead>
                            <TableHead className="text-slate-800 font-bold">Evento</TableHead>
                            <TableHead className="text-slate-800 font-bold">Horas</TableHead>
                            <TableHead className="text-slate-800 font-bold">Pago</TableHead>
                            <TableHead className="text-slate-800 font-bold">Estado</TableHead>
                            <TableHead className="text-right text-slate-800 font-bold">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trabajosFiltrados.map((trabajo) => (
                            <TableRow 
                              key={trabajo.id}
                              className={getRowClassName(trabajo.estado_pago, trabajo.evento.fecha_evento)}
                            >
                              {eventosPendientes.length > 0 && (
                               <TableCell>
                                 {trabajo.estado_pago === 'pendiente' ? (
                                   <Checkbox
                                     checked={eventosSeleccionados.has(trabajo.id)}
                                     onCheckedChange={(checked) => handleSeleccionarEvento(trabajo.id, checked as boolean)}
                                   />
                                 ) : (
                                   <div className="h-4 w-4" />
                                 )}
                               </TableCell>
                             )}
                             <TableCell className="font-medium text-slate-800">
                               {new Date(trabajo.evento.fecha_evento).toLocaleDateString('es-CO')}
                             </TableCell>
                             <TableCell>
                               <Button
                                 variant="link"
                                 className="p-0 h-auto text-left font-medium text-selecta-green hover:text-primary"
                                 onClick={() => navigate(`/eventos`)}
                               >
                                 {trabajo.evento.nombre_evento}
                               </Button>
                             </TableCell>
                             <TableCell className="text-slate-600">
                               {trabajo.horas_trabajadas ? `${trabajo.horas_trabajadas}h` : '-'}
                             </TableCell>
                             <TableCell className="font-semibold text-slate-800">
                               ${Number(trabajo.pago_calculado || 0).toLocaleString()}
                             </TableCell>
                             <TableCell>
                               {getEstadoBadge(trabajo.estado_pago, trabajo.evento.fecha_evento)}
                             </TableCell>
                             <TableCell className="text-right">
                               <div className="flex justify-end space-x-2">
                                 {trabajo.estado_pago === 'pendiente' && !eventosSeleccionados.has(trabajo.id) && (
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
                                         className="bg-white/80 border-emerald-200/60 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg"
                                       >
                                         <CheckCircle className="h-4 w-4 mr-1" />
                                         Marcar Pagado
                                       </Button>
                                     </DialogTrigger>
                                     <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
                                       <DialogHeader>
                                         <DialogTitle className="text-xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                                           Registrar Pago
                                         </DialogTitle>
                                         <DialogDescription className="text-slate-600">
                                           Marca este trabajo como pagado
                                         </DialogDescription>
                                       </DialogHeader>
                                       <div className="space-y-4">
                                         <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/60">
                                           <div className="space-y-2 text-sm">
                                             <p><strong className="text-slate-800">Empleado:</strong> <span className="text-slate-600">{personal.nombre_completo}</span></p>
                                             <p><strong className="text-slate-800">Evento:</strong> <span className="text-slate-600">{trabajo.evento.nombre_evento}</span></p>
                                             <p><strong className="text-slate-800">Horas trabajadas:</strong> <span className="text-slate-600">{trabajo.horas_trabajadas}h</span></p>
                                             <p><strong className="text-slate-800">Monto a pagar:</strong> <span className="text-emerald-700 font-semibold">${Number(trabajo.pago_calculado || 0).toLocaleString()}</span></p>
                                           </div>
                                         </div>
                                         
                                         <div className="space-y-2">
                                           <Label htmlFor="fecha_pago" className="text-slate-700 font-medium">Fecha de pago</Label>
                                           <Input
                                             id="fecha_pago"
                                             type="date"
                                             value={formularioPago.fecha_pago}
                                             onChange={(e) => setFormularioPago(prev => ({
                                               ...prev,
                                               fecha_pago: e.target.value
                                             }))}
                                             className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                                           />
                                         </div>

                                         <div className="space-y-2">
                                           <Label htmlFor="metodo_pago" className="text-slate-700 font-medium">Método de pago</Label>
                                           <Select 
                                             value={formularioPago.metodo_pago} 
                                             onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') => 
                                               setFormularioPago(prev => ({ ...prev, metodo_pago: value }))
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
                                           <Label htmlFor="notas_pago" className="text-slate-700 font-medium">Notas (opcional)</Label>
                                           <Textarea
                                             id="notas_pago"
                                             placeholder="Observaciones adicionales..."
                                             value={formularioPago.notas_pago}
                                             onChange={(e) => setFormularioPago(prev => ({
                                               ...prev,
                                               notas_pago: e.target.value
                                             }))}
                                             className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                                           />
                                         </div>

                                         <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200/60">
                                           <Button 
                                             variant="outline" 
                                             onClick={() => {
                                               setIsDialogOpen(false);
                                               resetFormulario();
                                             }}
                                             className="rounded-xl border-slate-200/60 hover:bg-slate-50"
                                           >
                                             Cancelar
                                           </Button>
                                           <Button 
                                             onClick={handleMarcarPagado}
                                             className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-lg hover:scale-105 transition-all duration-200 rounded-xl"
                                           >
                                             <CheckCircle className="h-4 w-4 mr-2" />
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
                                   className="hover:bg-blue-50 hover:text-blue-700 rounded-lg"
                                 >
                                   <Eye className="h-4 w-4" />
                                 </Button>
                               </div>
                             </TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                   </div>
                 </>
               )}
             </TabsContent>

             {/* Pestaña de Registro de Pagos */}
             <TabsContent value="pagos" className="p-6">
               <RegistroPagos empleadoId={id!} empleadoNombre={personal.nombre_completo} />
             </TabsContent>

             {/* Pestaña de Estadísticas */}
             <TabsContent value="estadisticas" className="p-6">
               <div className="text-center py-12">
                 <div className="w-20 h-20 bg-gradient-to-r from-purple-100 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-6">
                   <BarChart3 className="h-10 w-10 text-purple-600" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-800 mb-2">Estadísticas del Empleado</h3>
                 <p className="text-slate-600 max-w-sm mx-auto mb-4">
                   Análisis de rendimiento y pagos próximamente disponibles
                 </p>
                 <div className="inline-flex items-center space-x-2 bg-purple-50/80 rounded-full px-4 py-2 border border-purple-200/60">
                   <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                   <span className="text-sm font-medium text-purple-700">En desarrollo</span>
                 </div>
               </div>
             </TabsContent>
           </Tabs>
         </div>
       </div>

       {/* Footer decorativo sutil */}
       <div className="text-center pt-8">
         <div className="inline-flex items-center space-x-2 text-sm text-slate-400">
           <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
           <span>Última actualización: {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
           <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
         </div>
       </div>
     </div>
     
     {/* Dialog de Liquidación Consolidada */}
     <Dialog open={isLiquidacionMasivaOpen} onOpenChange={setIsLiquidacionMasivaOpen}>
       <DialogContent className="sm:max-w-2xl bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
         <DialogHeader>
           <DialogTitle className="text-xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
             Liquidación Consolidada
           </DialogTitle>
           <DialogDescription className="text-slate-600">
             {personal?.nombre_completo} - {personal?.rol}
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-6">
           {/* Resumen de eventos seleccionados */}
           <div className="border border-slate-200/60 rounded-xl p-4 bg-slate-50/50">
             <h4 className="font-medium mb-3 text-slate-800">Eventos Seleccionados</h4>
             <div className="space-y-2 max-h-40 overflow-y-auto">
               {eventosSeleccionadosList.map((trabajo) => (
                 <div key={trabajo.id} className="flex justify-between items-center text-sm">
                   <div>
                     <span className="font-medium text-slate-800">{new Date(trabajo.evento.fecha_evento).toLocaleDateString('es-CO')}</span>
                     <span className="ml-2 text-slate-600">{trabajo.evento.nombre_evento}</span>
                   </div>
                   <div className="flex space-x-4 text-right">
                     <span className="text-slate-600">{trabajo.horas_trabajadas}h</span>
                     <span className="w-20 text-slate-600">${(personal?.tarifa_hora || 0).toLocaleString()}</span>
                     <span className="w-24 font-medium text-slate-800">${(trabajo.pago_calculado || 0).toLocaleString()}</span>
                   </div>
                 </div>
               ))}
             </div>
           </div>

           {/* Resumen total */}
           <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-xl border border-emerald-200/60">
             <div className="space-y-1">
               <div className="flex justify-between text-slate-700">
                 <span className="font-medium">Total de eventos:</span>
                 <span>{totalEventosSeleccionados}</span>
               </div>
               <div className="flex justify-between text-slate-700">
                 <span className="font-medium">Total horas trabajadas:</span>
                 <span>{totalHorasSeleccionadas.toFixed(1)}h</span>
               </div>
               <div className="flex justify-between text-lg font-bold text-emerald-800">
                 <span>Total a pagar:</span>
                 <span>${totalPagoSeleccionado.toLocaleString()}</span>
               </div>
             </div>
           </div>

           {/* Formulario de pago */}
           <div className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="metodo_pago_masivo" className="text-slate-700 font-medium">Método de pago</Label>
               <Select 
                 value={formularioLiquidacionMasiva.metodo_pago} 
                 onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') => 
                   setFormularioLiquidacionMasiva(prev => ({ ...prev, metodo_pago: value }))
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
               <Label htmlFor="fecha_pago_masivo" className="text-slate-700 font-medium">Fecha de pago</Label>
               <Input
                 id="fecha_pago_masivo"
                 type="date"
                 value={formularioLiquidacionMasiva.fecha_pago}
                 onChange={(e) => setFormularioLiquidacionMasiva(prev => ({
                   ...prev,
                   fecha_pago: e.target.value
                 }))}
                 className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
               />
             </div>

             <div className="space-y-2">
               <Label htmlFor="notas_masivo" className="text-slate-700 font-medium">Notas (opcional)</Label>
               <Textarea
                 id="notas_masivo"
                 placeholder={`Liquidación de ${totalEventosSeleccionados} eventos`}
                 value={formularioLiquidacionMasiva.notas_pago}
                 onChange={(e) => setFormularioLiquidacionMasiva(prev => ({
                   ...prev,
                   notas_pago: e.target.value
                 }))}
                 className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
               />
             </div>
           </div>

           <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200/60">
             <Button 
               variant="outline" 
               onClick={() => setIsLiquidacionMasivaOpen(false)}
               className="rounded-xl border-slate-200/60 hover:bg-slate-50"
             >
               Cerrar
             </Button>
             <Button variant="outline" className="rounded-xl border-slate-200/60 hover:bg-slate-50">
               <Download className="h-4 w-4 mr-2" />
               Exportar PDF
             </Button>
             <Button 
               onClick={() => setIsConfirmacionMasivaOpen(true)}
               className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-xl shadow-md"
             >
               <DollarSign className="h-4 w-4 mr-2" />
               Confirmar Liquidación
             </Button>
           </div>
         </div>
       </DialogContent>
     </Dialog>

     {/* Modal de Confirmación */}
     <Dialog open={isConfirmacionMasivaOpen} onOpenChange={setIsConfirmacionMasivaOpen}>
       <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
         <DialogHeader>
           <DialogTitle className="flex items-center space-x-2">
             <AlertCircle className="h-5 w-5 text-orange-500" />
             <span className="text-xl font-bold text-slate-800">Confirmar Liquidación Múltiple</span>
           </DialogTitle>
           <DialogDescription className="text-slate-600">
             ¿Confirmas el pago de los eventos seleccionados para {personal?.nombre_completo}?
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-4">
           <div className="bg-orange-50/80 p-4 rounded-xl border border-orange-200/60 space-y-2">
             <p className="text-sm text-orange-800">Esta acción marcará como PAGADO:</p>
             <ul className="text-sm space-y-1 text-orange-700">
               <li>• <strong>{totalEventosSeleccionados}</strong> eventos seleccionados</li>
               <li>• <strong>Total:</strong> ${totalPagoSeleccionado.toLocaleString()}</li>
               <li>• <strong>Fecha:</strong> {new Date(formularioLiquidacionMasiva.fecha_pago).toLocaleDateString('es-CO')}</li>
               <li>• <strong>Método:</strong> {formularioLiquidacionMasiva.metodo_pago.charAt(0).toUpperCase() + formularioLiquidacionMasiva.metodo_pago.slice(1)}</li>
             </ul>
           </div>
           
           <div className="flex items-center space-x-2 text-sm text-orange-600">
             <AlertCircle className="h-4 w-4" />
             <span>Esta acción no se puede deshacer</span>
           </div>
         </div>

         <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200/60">
           <Button 
             variant="outline" 
             onClick={() => setIsConfirmacionMasivaOpen(false)}
             className="rounded-xl border-slate-200/60 hover:bg-slate-50"
           >
             Cancelar
           </Button>
           <Button 
             onClick={handleLiquidacionMasiva}
             className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 rounded-xl shadow-md"
           >
             <CheckCircle className="h-4 w-4 mr-2" />
             Confirmar Pago
           </Button>
         </div>
       </DialogContent>
     </Dialog>
   </div>
 );
}