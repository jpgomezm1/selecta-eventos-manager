import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, DollarSign, Clock, CheckCircle, AlertCircle, Eye, Download, BarChart3, User, CreditCard, TrendingUp, Filter, Users, Award, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      return (
        <Badge className="bg-gradient-to-r from-emerald-50 to-green-100 text-emerald-700 border-emerald-200/60 hover:shadow-md transition-shadow">
          <CheckCircle className="h-3 w-3 mr-1" />
          Pagado
        </Badge>
      );
    }
    
    // Verificar si está vencido (más de 30 días)
    if (fechaEvento) {
      const fechaEventoDate = new Date(fechaEvento);
      const hoy = new Date();
      const diffDias = Math.floor((hoy.getTime() - fechaEventoDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias > 30) {
        return (
          <Badge className="bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-red-200/60 hover:shadow-md transition-shadow animate-pulse">
            <AlertCircle className="h-3 w-3 mr-1" />
            Vencido ({diffDias}d)
          </Badge>
        );
      }
    }
    
    return (
      <Badge className="bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200/60 hover:shadow-md transition-shadow">
        <Clock className="h-3 w-3 mr-1" />
        Pendiente
      </Badge>
    );
  };

  const getRowClassName = (estado: string, fechaEvento?: string) => {
    if (estado === 'pagado') return "hover:bg-emerald-50/30 transition-all duration-200";
    
    if (fechaEvento) {
      const fechaEventoDate = new Date(fechaEvento);
      const hoy = new Date();
      const diffDias = Math.floor((hoy.getTime() - fechaEventoDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDias > 30) return "hover:bg-red-50/30 transition-all duration-200 border-l-2 border-red-200";
    }
    
    return "hover:bg-orange-50/30 transition-all duration-200";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md mx-auto px-6">
            {/* Icono animado */}
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-r from-selecta-green via-primary to-selecta-green rounded-3xl flex items-center justify-center mx-auto shadow-2xl animate-bounce">
                <User className="h-12 w-12 text-white animate-pulse" />
              </div>
              <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-3xl blur-xl animate-pulse mx-auto"></div>
            </div>
            
            <h3 className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent mb-3">
              Cargando Empleado
            </h3>
            <p className="text-slate-600 text-lg">Preparando información detallada del personal...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!personal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md mx-auto px-6">
            <div className="w-24 h-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
              <User className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">Personal no encontrado</h3>
            <p className="text-slate-600 text-lg mb-6">El empleado solicitado no existe en el sistema</p>
            <Button 
              onClick={() => navigate("/personal")} 
              className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-xl hover:scale-105 transition-all duration-300 rounded-2xl px-8 py-3"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Volver a Personal
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Elementos decorativos mejorados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-gradient-to-r from-purple-100/40 to-pink-100/40 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 space-y-8">
        {/* Header premium */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center space-x-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/personal")}
              className="flex items-center space-x-2 hover:bg-white/60 rounded-2xl px-4 py-2 transition-all duration-200 hover:shadow-md group"
            >
              <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Volver a Personal</span>
            </Button>
            
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-selecta-green via-primary to-selecta-green rounded-3xl flex items-center justify-center shadow-2xl">
                  <span className="text-xl font-bold text-white">
                    {personal.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="absolute -bottom-2 -right-2">
                  <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
              
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-selecta-green via-primary to-selecta-green bg-clip-text text-transparent leading-tight">
                  {personal.nombre_completo}
                </h1>
                <div className="flex items-center space-x-3 mt-2">
                  <Badge className={`${getRoleBadgeVariant(personal.rol)} border font-semibold px-3 py-1 rounded-xl shadow-sm`}>
                    {personal.rol}
                  </Badge>
                  <span className="text-slate-600 font-medium">CC: {personal.numero_cedula}</span>
                  <div className="flex items-center space-x-1 text-selecta-green font-semibold">
                    <DollarSign className="h-4 w-4" />
                    <span>${Number(personal.tarifa_hora).toLocaleString()}/hora</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards premium */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50/80 to-blue-100/80 border-b border-blue-200/30">
              <div className="flex items-center justify-between">
                <Calendar className="h-8 w-8 text-blue-600" />
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-blue-600 mb-1">Trabajos Totales</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                  {totalTrabajos}
                </p>
                <p className="text-xs text-slate-500 mt-1">Eventos completados</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-orange-50/80 to-orange-100/80 border-b border-orange-200/30">
              <div className="flex items-center justify-between">
                <Clock className="h-8 w-8 text-orange-600" />
                <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-orange-600 mb-1">Pagos Pendientes</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                  ${totalPendiente.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">Por liquidar</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-emerald-50/80 to-emerald-100/80 border-b border-emerald-200/30">
              <div className="flex items-center justify-between">
                <DollarSign className="h-8 w-8 text-emerald-600" />
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-emerald-600 mb-1">Total Ganado</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                  ${totalPagado.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">Pagos completados</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-purple-50/80 to-purple-100/80 border-b border-purple-200/30">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm font-medium text-purple-600 mb-1">Promedio/Evento</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
                  ${totalTrabajos > 0 ? Math.round((totalPagado + totalPendiente) / totalTrabajos).toLocaleString() : '0'}
                </p>
                <p className="text-xs text-slate-500 mt-1">Ganancia media</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contenido con pestañas premium */}
        <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
          <Tabs defaultValue="historial" className="space-y-0">
            <CardHeader className="bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm border-b border-slate-200/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-selecta-green to-primary rounded-2xl flex items-center justify-center shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800">Panel de Control del Empleado</CardTitle>
                    <CardDescription className="text-slate-600">Gestión integral de trabajos y pagos</CardDescription>
                  </div>
                </div>
                
                <TabsList className="grid w-auto grid-cols-3 bg-slate-100/80 rounded-2xl p-1 shadow-inner">
                  <TabsTrigger value="historial" className="flex items-center space-x-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Historial</span>
                  </TabsTrigger>
                  <TabsTrigger value="pagos" className="flex items-center space-x-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <CreditCard className="h-4 w-4" />
                    <span className="hidden sm:inline">Pagos</span>
                  </TabsTrigger>
                  <TabsTrigger value="estadisticas" className="flex items-center space-x-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
                   <TrendingUp className="h-4 w-4" />
                   <span className="hidden sm:inline">Stats</span>
                 </TabsTrigger>
               </TabsList>
             </div>
           </CardHeader>

           {/* Pestaña de Historial */}
           <TabsContent value="historial" className="space-y-6 p-6">
             <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
               <div className="flex items-center space-x-3">
                 <div className="w-10 h-10 bg-gradient-to-r from-selecta-green to-primary rounded-2xl flex items-center justify-center shadow-lg">
                   <Calendar className="h-5 w-5 text-white" />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-slate-800">Historial de Trabajos</h3>
                   <p className="text-sm text-slate-600">Registro completo de eventos trabajados ({trabajosFiltrados.length})</p>
                 </div>
               </div>
               
               <div className="flex items-center space-x-3">
                 <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                   <SelectTrigger className="w-48 bg-white/80 border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md transition-all">
                     <Filter className="h-4 w-4 mr-2 text-slate-500" />
                     <SelectValue placeholder="Filtrar por estado" />
                   </SelectTrigger>
                   <SelectContent className="bg-white/95 backdrop-blur-xl border-white/30 rounded-2xl shadow-2xl">
                     <SelectItem value="todos">Todos los estados</SelectItem>
                     <SelectItem value="pendiente">Pendientes</SelectItem>
                     <SelectItem value="pagado">Pagados</SelectItem>
                   </SelectContent>
                 </Select>
                 
                 <Button variant="outline" size="sm" className="bg-white/80 border-slate-200/50 rounded-2xl hover:bg-white hover:shadow-md transition-all">
                   <Download className="h-4 w-4 mr-2" />
                   <span className="hidden sm:inline">Exportar</span>
                 </Button>
               </div>
             </div>

             {trabajosFiltrados.length === 0 ? (
               <div className="text-center py-16">
                 <div className="relative mb-8">
                   <div className="w-24 h-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                     <Calendar className="h-12 w-12 text-slate-400" />
                   </div>
                   <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-slate-100/50 to-slate-200/50 rounded-3xl blur-xl mx-auto"></div>
                 </div>
                 <h3 className="text-2xl font-bold text-slate-800 mb-3">
                   {trabajos.length === 0 ? "Sin trabajos registrados" : "No se encontraron resultados"}
                 </h3>
                 <p className="text-slate-600 text-lg max-w-md mx-auto">
                   {trabajos.length === 0 
                     ? "Este empleado aún no tiene eventos asignados en el sistema" 
                     : "Intenta modificar los filtros para encontrar los trabajos que buscas"
                   }
                 </p>
               </div>
             ) : (
               <>
                 {/* Selección múltiple para eventos pendientes */}
                 {eventosPendientes.length > 0 && (
                   <div className="space-y-4">
                     <div className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/30">
                       <div className="flex items-center space-x-3">
                         <Checkbox
                           id="seleccionar-todos"
                           checked={eventosPendientes.length > 0 && eventosPendientes.every(t => eventosSeleccionados.has(t.id))}
                           onCheckedChange={handleSeleccionarTodos}
                           className="data-[state=checked]:bg-selecta-green data-[state=checked]:border-selecta-green"
                         />
                         <Label htmlFor="seleccionar-todos" className="text-sm font-semibold text-slate-700 cursor-pointer">
                           Seleccionar todos los pendientes ({eventosPendientes.length})
                         </Label>
                       </div>
                     </div>
                     
                     {eventosSeleccionados.size > 0 && (
                       <div className="bg-gradient-to-r from-emerald-50/80 to-green-50/80 backdrop-blur-sm p-6 rounded-2xl border border-emerald-200/60 shadow-lg">
                         <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                           <div className="flex items-center space-x-4">
                             <div className="w-12 h-12 bg-gradient-to-r from-emerald-600 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                               <DollarSign className="h-6 w-6 text-white" />
                             </div>
                             <div>
                               <div className="flex items-center space-x-4 text-sm">
                                 <span className="font-bold text-emerald-800">SELECCIONADOS:</span>
                                 <span className="text-emerald-700 bg-white/60 rounded-full px-3 py-1">{totalEventosSeleccionados} eventos</span>
                                 <span className="text-emerald-700 bg-white/60 rounded-full px-3 py-1">{totalHorasSeleccionadas}h trabajadas</span>
                               </div>
                               <div className="mt-1">
                                 <span className="font-bold text-emerald-800 text-lg">TOTAL A PAGAR:</span>
                                 <span className="text-emerald-700 font-bold text-xl ml-2">${totalPagoSeleccionado.toLocaleString()}</span>
                               </div>
                             </div>
                           </div>
                           <Button 
                             onClick={() => setIsLiquidacionMasivaOpen(true)}
                             className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3"
                           >
                             <DollarSign className="h-5 w-5 mr-2" />
                             Liquidar Eventos Seleccionados
                           </Button>
                         </div>
                       </div>
                     )}
                   </div>
                 )}
                 
                 <div className="bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border border-slate-200/30">
                   <Table>
                     <TableHeader>
                       <TableRow className="border-slate-200/40 bg-gradient-to-r from-slate-50/80 to-slate-100/80">
                         {eventosPendientes.length > 0 && (
                           <TableHead className="w-12 text-slate-800 font-bold py-4"></TableHead>
                         )}
                         <TableHead className="text-slate-800 font-bold py-4">Fecha</TableHead>
                         <TableHead className="text-slate-800 font-bold py-4">Evento</TableHead>
                         <TableHead className="text-slate-800 font-bold py-4">Horas</TableHead>
                         <TableHead className="text-slate-800 font-bold py-4">Pago</TableHead>
                         <TableHead className="text-slate-800 font-bold py-4">Estado</TableHead>
                         <TableHead className="text-right text-slate-800 font-bold py-4">Acciones</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {trabajosFiltrados.map((trabajo, index) => (
                         <TableRow 
                           key={trabajo.id}
                           className={`${getRowClassName(trabajo.estado_pago, trabajo.evento.fecha_evento)} group`}
                           style={{ animationDelay: `${index * 50}ms` }}
                         >
                           {eventosPendientes.length > 0 && (
                             <TableCell className="py-4">
                               {trabajo.estado_pago === 'pendiente' ? (
                                 <Checkbox
                                   checked={eventosSeleccionados.has(trabajo.id)}
                                   onCheckedChange={(checked) => handleSeleccionarEvento(trabajo.id, checked as boolean)}
                                   className="data-[state=checked]:bg-selecta-green data-[state=checked]:border-selecta-green"
                                 />
                               ) : (
                                 <div className="h-4 w-4" />
                               )}
                             </TableCell>
                           )}
                           <TableCell className="font-semibold text-slate-800 py-4">
                             {new Date(trabajo.evento.fecha_evento).toLocaleDateString('es-CO', {
                               day: '2-digit',
                               month: 'short',
                               year: 'numeric'
                             })}
                           </TableCell>
                           <TableCell className="py-4">
                             <Button
                               variant="link"
                               className="p-0 h-auto text-left font-semibold text-selecta-green hover:text-primary transition-colors"
                               onClick={() => navigate(`/eventos`)}
                             >
                               {trabajo.evento.nombre_evento}
                             </Button>
                           </TableCell>
                           <TableCell className="text-slate-600 py-4 font-medium">
                             <div className="flex items-center space-x-1">
                               <Clock className="h-4 w-4 text-slate-400" />
                               <span>{trabajo.horas_trabajadas ? `${trabajo.horas_trabajadas}h` : '-'}</span>
                             </div>
                           </TableCell>
                           <TableCell className="font-bold text-slate-800 py-4">
                             <div className="flex items-center space-x-1">
                               <DollarSign className="h-4 w-4 text-selecta-green" />
                               <span>${Number(trabajo.pago_calculado || 0).toLocaleString()}</span>
                             </div>
                           </TableCell>
                           <TableCell className="py-4">
                             {getEstadoBadge(trabajo.estado_pago, trabajo.evento.fecha_evento)}
                           </TableCell>
                           <TableCell className="text-right py-4">
                             <div className="flex justify-end space-x-2 opacity-70 group-hover:opacity-100 transition-opacity">
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
                                       className="bg-white/80 border-emerald-200/60 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 rounded-xl transition-all duration-200 hover:scale-105"
                                     >
                                       <CheckCircle className="h-4 w-4 mr-1" />
                                       <span className="hidden sm:inline">Marcar Pagado</span>
                                     </Button>
                                   </DialogTrigger>
                                   <DialogContent className="sm:max-w-lg bg-white/95 backdrop-blur-2xl border-white/30 shadow-2xl rounded-3xl">
                                     <DialogHeader>
                                       <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                                         Registrar Pago Individual
                                       </DialogTitle>
                                       <DialogDescription className="text-slate-600 text-base">
                                         Confirma el pago de este evento específico
                                       </DialogDescription>
                                     </DialogHeader>
                                     
                                     <div className="space-y-6">
                                       {/* Información del trabajo */}
                                       <div className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/60">
                                         <div className="grid grid-cols-2 gap-4 text-sm">
                                           <div>
                                             <p className="font-bold text-slate-800 mb-1">Empleado:</p>
                                             <p className="text-slate-600">{personal.nombre_completo}</p>
                                           </div>
                                           <div>
                                             <p className="font-bold text-slate-800 mb-1">Evento:</p>
                                             <p className="text-slate-600">{trabajo.evento.nombre_evento}</p>
                                           </div>
                                           <div>
                                             <p className="font-bold text-slate-800 mb-1">Horas trabajadas:</p>
                                             <p className="text-slate-600">{trabajo.horas_trabajadas}h</p>
                                           </div>
                                           <div>
                                             <p className="font-bold text-slate-800 mb-1">Monto a pagar:</p>
                                             <p className="text-emerald-700 font-bold text-lg">${Number(trabajo.pago_calculado || 0).toLocaleString()}</p>
                                           </div>
                                         </div>
                                       </div>
                                       
                                       <div className="space-y-4">
                                         <div className="space-y-2">
                                           <Label htmlFor="fecha_pago" className="text-slate-700 font-semibold">Fecha de pago</Label>
                                           <Input
                                             id="fecha_pago"
                                             type="date"
                                             value={formularioPago.fecha_pago}
                                             onChange={(e) => setFormularioPago(prev => ({
                                               ...prev,
                                               fecha_pago: e.target.value
                                             }))}
                                             className="bg-white/80 border-slate-200/50 rounded-2xl h-12 focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                                           />
                                         </div>

                                         <div className="space-y-2">
                                           <Label htmlFor="metodo_pago" className="text-slate-700 font-semibold">Método de pago</Label>
                                           <Select 
                                             value={formularioPago.metodo_pago} 
                                             onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') => 
                                               setFormularioPago(prev => ({ ...prev, metodo_pago: value }))
                                             }
                                           >
                                             <SelectTrigger className="bg-white/80 border-slate-200/50 rounded-2xl h-12">
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
                                           <Label htmlFor="notas_pago" className="text-slate-700 font-semibold">Notas (opcional)</Label>
                                           <Textarea
                                             id="notas_pago"
                                             placeholder="Observaciones adicionales del pago..."
                                             value={formularioPago.notas_pago}
                                             onChange={(e) => setFormularioPago(prev => ({
                                               ...prev,
                                               notas_pago: e.target.value
                                             }))}
                                             className="bg-white/80 border-slate-200/50 rounded-2xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green min-h-[100px]"
                                           />
                                         </div>
                                       </div>

                                       <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t border-slate-200/50">
                                         <Button 
                                           variant="outline" 
                                           onClick={() => {
                                             setIsDialogOpen(false);
                                             resetFormulario();
                                           }}
                                           className="rounded-2xl border-slate-200/50 hover:bg-slate-50 transition-all"
                                         >
                                           Cancelar
                                         </Button>
                                         <Button 
                                           onClick={handleMarcarPagado}
                                           className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-xl hover:scale-105 transition-all duration-300 rounded-2xl px-6"
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
                                 className="hover:bg-blue-100 hover:text-blue-700 rounded-xl p-2 transition-all duration-200 hover:scale-105"
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
             <div className="text-center py-16">
               <div className="relative mb-8">
                 <div className="w-24 h-24 bg-gradient-to-r from-purple-100 to-purple-200 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                   <BarChart3 className="h-12 w-12 text-purple-600" />
                 </div>
                 <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-purple-100/50 to-purple-200/50 rounded-3xl blur-xl mx-auto"></div>
               </div>
               <h3 className="text-2xl font-bold text-slate-800 mb-3">Estadísticas Avanzadas</h3>
               <p className="text-slate-600 text-lg max-w-md mx-auto mb-6">
                 Análisis detallado de rendimiento, tendencias de pagos y métricas de productividad
               </p>
               <div className="inline-flex items-center space-x-3 bg-purple-50/80 rounded-2xl px-6 py-3 border border-purple-200/60">
                 <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
                 <span className="text-sm font-semibold text-purple-700">Próximamente disponible</span>
                 <Award className="h-4 w-4 text-purple-600" />
               </div>
             </div>
           </TabsContent>
         </Tabs>
       </Card>

       {/* Footer premium */}
       <div className="text-center pt-8">
         <div className="inline-flex items-center justify-center space-x-4 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/30">
           <div className="flex items-center space-x-2">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
             <span className="text-sm font-medium text-slate-600">Sistema actualizado</span>
           </div>
           <div className="w-px h-4 bg-slate-300"></div>
           <div className="flex items-center space-x-2">
             <Clock className="h-4 w-4 text-slate-500" />
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
     
     {/* Dialog de Liquidación Consolidada - mantengo la funcionalidad original */}
     <Dialog open={isLiquidacionMasivaOpen} onOpenChange={setIsLiquidacionMasivaOpen}>
       <DialogContent className="sm:max-w-2xl bg-white/95 backdrop-blur-2xl border-white/30 shadow-2xl rounded-3xl">
         <DialogHeader>
           <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
             Liquidación Consolidada
           </DialogTitle>
           <DialogDescription className="text-slate-600 text-base">
             {personal?.nombre_completo} - {personal?.rol}
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-6">
           {/* Resumen de eventos seleccionados */}
           <div className="border border-slate-200/60 rounded-2xl p-4 bg-slate-50/50">
             <h4 className="font-semibold mb-3 text-slate-800">Eventos Seleccionados</h4>
             <div className="space-y-2 max-h-40 overflow-y-auto">
               {eventosSeleccionadosList.map((trabajo) => (
                 <div key={trabajo.id} className="flex justify-between items-center text-sm py-2 px-3 bg-white/60 rounded-xl">
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
           <div className="bg-gradient-to-r from-emerald-50/80 to-green-50/80 p-6 rounded-2xl border border-emerald-200/60">
             <div className="space-y-3">
               <div className="flex justify-between text-slate-700">
                 <span className="font-semibold">Total de eventos:</span>
                 <span className="font-bold">{totalEventosSeleccionados}</span>
               </div>
               <div className="flex justify-between text-slate-700">
                 <span className="font-semibold">Total horas trabajadas:</span>
                 <span className="font-bold">{totalHorasSeleccionadas.toFixed(1)}h</span>
               </div>
               <div className="flex justify-between text-xl font-bold text-emerald-800 pt-2 border-t border-emerald-200/60">
                 <span>Total a pagar:</span>
                 <span>${totalPagoSeleccionado.toLocaleString()}</span>
               </div>
             </div>
           </div>

           {/* Formulario de pago */}
           <div className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="metodo_pago_masivo" className="text-slate-700 font-semibold">Método de pago</Label>
               <Select 
                 value={formularioLiquidacionMasiva.metodo_pago} 
                 onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') => 
                   setFormularioLiquidacionMasiva(prev => ({ ...prev, metodo_pago: value }))
                 }
               >
                 <SelectTrigger className="bg-white/80 border-slate-200/50 rounded-2xl h-12">
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
               <Label htmlFor="fecha_pago_masivo" className="text-slate-700 font-semibold">Fecha de pago</Label>
               <Input
                 id="fecha_pago_masivo"
                 type="date"
                 value={formularioLiquidacionMasiva.fecha_pago}
                 onChange={(e) => setFormularioLiquidacionMasiva(prev => ({
                   ...prev,
                   fecha_pago: e.target.value
                 }))}
                 className="bg-white/80 border-slate-200/50 rounded-2xl h-12 focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
               />
             </div>

             <div className="space-y-2">
               <Label htmlFor="notas_masivo" className="text-slate-700 font-semibold">Notas (opcional)</Label>
               <Textarea
                 id="notas_masivo"
                 placeholder={`Liquidación consolidada de ${totalEventosSeleccionados} eventos`}
                 value={formularioLiquidacionMasiva.notas_pago}
                 onChange={(e) => setFormularioLiquidacionMasiva(prev => ({
                   ...prev,
                   notas_pago: e.target.value
                 }))}
                 className="bg-white/80 border-slate-200/50 rounded-2xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
               />
             </div>
           </div>

           <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t border-slate-200/50">
             <Button 
               variant="outline" 
               onClick={() => setIsLiquidacionMasivaOpen(false)}
               className="rounded-2xl border-slate-200/50 hover:bg-slate-50"
             >
               Cerrar
             </Button>
             <Button variant="outline" className="rounded-2xl border-slate-200/50 hover:bg-slate-50">
               <Download className="h-4 w-4 mr-2" />
               Exportar PDF
             </Button>
             <Button 
               onClick={() => setIsConfirmacionMasivaOpen(true)}
               className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl"
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
       <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-2xl border-white/30 shadow-2xl rounded-3xl">
         <DialogHeader>
           <DialogTitle className="flex items-center space-x-2">
             <AlertCircle className="h-6 w-6 text-orange-500" />
             <span className="text-xl font-bold text-slate-800">Confirmar Liquidación Múltiple</span>
           </DialogTitle>
           <DialogDescription className="text-slate-600 text-base">
             ¿Confirmas el pago de los eventos seleccionados para {personal?.nombre_completo}?
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-6">
           <div className="bggradient-to-r from-orange-50/80 to-orange-100/80 p-6 rounded-2xl border border-orange-200/60 space-y-3">
             <p className="text-sm font-semibold text-orange-800 mb-3">Esta acción marcará como PAGADO:</p>
             <div className="grid grid-cols-2 gap-4 text-sm">
               <div>
                 <span className="font-bold text-orange-800">Eventos:</span>
                 <span className="text-orange-700 ml-2">{totalEventosSeleccionados}</span>
               </div>
               <div>
                 <span className="font-bold text-orange-800">Total:</span>
                 <span className="text-orange-700 ml-2">${totalPagoSeleccionado.toLocaleString()}</span>
               </div>
               <div>
                 <span className="font-bold text-orange-800">Fecha:</span>
                 <span className="text-orange-700 ml-2">{new Date(formularioLiquidacionMasiva.fecha_pago).toLocaleDateString('es-CO')}</span>
               </div>
               <div>
                 <span className="font-bold text-orange-800">Método:</span>
                 <span className="text-orange-700 ml-2 capitalize">{formularioLiquidacionMasiva.metodo_pago}</span>
               </div>
             </div>
           </div>
           
           <div className="flex items-center space-x-3 text-orange-600 bg-orange-50/50 rounded-xl p-3">
             <AlertCircle className="h-5 w-5" />
             <span className="text-sm font-medium">Esta acción no se puede deshacer</span>
           </div>
         </div>

         <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-6 border-t border-slate-200/50">
           <Button 
             variant="outline" 
             onClick={() => setIsConfirmacionMasivaOpen(false)}
             className="rounded-2xl border-slate-200/50 hover:bg-slate-50"
           >
             Cancelar
           </Button>
           <Button 
             onClick={handleLiquidacionMasiva}
             className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl"
           >
             <CheckCircle className="h-5 w-5 mr-2" />
             Confirmar Pago
           </Button>
         </div>
       </DialogContent>
     </Dialog>
   </div>
 );
}