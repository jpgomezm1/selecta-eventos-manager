import { useState, useEffect } from "react";
import { Plus, Calendar, MapPin, Edit, Trash2, Users, DollarSign, Grid3X3, CalendarDays, Filter, X, Sparkles, TrendingUp, Eye } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EventoForm } from "@/components/Forms/EventoForm";
import { LiquidacionDialog } from "@/components/Forms/LiquidacionDialog";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal, Personal, PersonalAsignado } from "@/types/database";
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from "react-router-dom";

// Configurar localizer para español
import moment from 'moment';
import 'moment/locale/es';
moment.locale('es');
const localizer = momentLocalizer(moment);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: EventoConPersonal;
}

export default function EventosPage() {
  const nav = useNavigate();
  const [eventos, setEventos] = useState<EventoConPersonal[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvento, setSelectedEvento] = useState<EventoConPersonal | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [liquidacionEvento, setLiquidacionEvento] = useState<EventoConPersonal | null>(null);
  const [isLiquidacionOpen, setIsLiquidacionOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [selectedComercialFilter, setSelectedComercialFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchEventos();
    fetchPersonal();
  }, []);

  const fetchPersonal = async () => {
    try {
      const { data, error } = await supabase
        .from("personal")
        .select("*")
        .order("nombre_completo");

      if (error) throw error;
      setPersonal(data as Personal[] || []);
    } catch (error) {
      console.error("Error fetching personal:", error);
    }
  };

  const fetchEventos = async () => {
    try {
      const { data, error } = await supabase
        .from("eventos")
        .select(`
          *,
          evento_personal (
            id,
            hora_inicio,
            hora_fin,
            horas_trabajadas,
            pago_calculado,
            estado_pago,
            fecha_pago,
            metodo_pago,
            notas_pago,
            personal (*)
          ),
          cotizacion_versiones (
            cotizaciones (
              ubicacion_evento,
              comercial_encargado
            )
          )
        `)
        .order("fecha_evento", { ascending: false });

      if (error) throw error;

      const eventosConPersonal: EventoConPersonal[] = (data || []).map((evento) => {
        const personalAsignado = evento.evento_personal?.map((ep: any) => ({
          ...ep.personal,
          hora_inicio: ep.hora_inicio,
          hora_fin: ep.hora_fin,
          horas_trabajadas: ep.horas_trabajadas,
          pago_calculado: ep.pago_calculado,
          estado_pago: ep.estado_pago,
          fecha_pago: ep.fecha_pago,
          metodo_pago: ep.metodo_pago,
          notas_pago: ep.notas_pago,
          evento_personal_id: ep.id,
        })) || [];
        const costoTotal = personalAsignado.reduce((sum: number, p: PersonalAsignado) => sum + (p.pago_calculado || Number(p.tarifa_hora)), 0);

        // Extraer información de la cotización si existe
        const cotizacionInfo = evento.cotizacion_versiones?.cotizaciones;
        const ubicacionEvento = cotizacionInfo?.ubicacion_evento || evento.ubicacion;
        const comercialEncargado = cotizacionInfo?.comercial_encargado;

        return {
          ...evento,
          ubicacion: ubicacionEvento,
          comercial_encargado: comercialEncargado,
          estado_liquidacion: (evento.estado_liquidacion as 'pendiente' | 'liquidado') || 'pendiente',
          personal: personalAsignado,
          costo_total: costoTotal,
        };
      });

      setEventos(eventosConPersonal);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar los eventos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEventoSubmit = () => {
    fetchEventos();
    setIsDialogOpen(false);
    setSelectedEvento(null);
  };

  const handleLiquidarEvento = async (evento: EventoConPersonal) => {
    const personalSinHoras = evento.personal.filter(p => !p.horas_trabajadas || p.horas_trabajadas <= 0);
    
    if (personalSinHoras.length > 0) {
      toast({
        title: "Información faltante",
        description: `${personalSinHoras.length} empleado(s) no tienen horas de trabajo definidas. Complete la información antes de liquidar.`,
        variant: "destructive",
      });
      return;
    }

    const personalSobrecarga = evento.personal.filter(p => p.horas_trabajadas && p.horas_trabajadas > 12);
    if (personalSobrecarga.length > 0) {
      toast({
        title: "Advertencia",
        description: `${personalSobrecarga.length} empleado(s) trabajaron más de 12 horas. Verifique la información.`,
        variant: "destructive",
      });
    }

    setLiquidacionEvento(evento);
    setIsLiquidacionOpen(true);
  };

  const handleDeleteEvento = async (id: string) => {
    try {
      const { error } = await supabase
        .from("eventos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Evento eliminado",
        description: "El evento ha sido eliminado exitosamente",
      });
      fetchEventos();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar el evento",
        variant: "destructive",
      });
    }
  };

  const getEventStatus = (fechaEvento: string) => {
    const eventDate = new Date(fechaEvento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate < today) return { status: "Pasado", variant: "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200", icon: "⏳" };
    if (eventDate.getTime() === today.getTime()) return { status: "Hoy", variant: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200 animate-pulse", icon: "🎯" };
    return { status: "Próximo", variant: "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200", icon: "📅" };
  };

  const getLiquidacionBadge = (estado: string) => {
    if (estado === 'liquidado') {
      return "bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200 shadow-sm";
    }
    return "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200 shadow-sm";
  };

  // Obtener lista de comerciales únicos
  const comerciales = [...new Set(eventos
    .map(evento => evento.comercial_encargado)
    .filter(Boolean)
  )].sort();

  // Filtrar eventos según los filtros seleccionados
  const filteredEventos = eventos.filter(evento => {
    const matchesPersonal = selectedPersonFilter === 'all' ||
      evento.personal.some(p => p.id === selectedPersonFilter);
    const matchesComercial = selectedComercialFilter === 'all' ||
      evento.comercial_encargado === selectedComercialFilter;

    return matchesPersonal && matchesComercial;
  });

  // Convertir eventos para el calendario
  const calendarEvents: CalendarEvent[] = filteredEventos.map(evento => ({
    id: evento.id,
    title: evento.nombre_evento,
    start: new Date(evento.fecha_evento),
    end: new Date(evento.fecha_evento),
    resource: evento
  }));

  // Componente personalizado para eventos del calendario
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const { status, icon } = getEventStatus(event.resource.fecha_evento);
    const isLiquidado = event.resource.estado_liquidacion === 'liquidado';
    
    return (
      <div className="text-xs p-2 h-full">
        <div className="font-semibold truncate mb-1 flex items-center space-x-1">
          <span>{icon}</span>
          <span>{event.title}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs opacity-75 flex items-center space-x-1">
            <Users className="h-3 w-3" />
            <span>{event.resource.personal.length}</span>
          </span>
          <div className="flex space-x-1">
            {isLiquidado && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
            {status === 'Hoy' && <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>}
          </div>
        </div>
      </div>
    );
  };

  // Estilos personalizados para el calendario
  const calendarStyle = {
    backgroundColor: 'white',
    borderRadius: '16px',
    border: 'none',
    fontFamily: 'inherit',
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const { status } = getEventStatus(event.resource.fecha_evento);
    const isLiquidado = event.resource.estado_liquidacion === 'liquidado';
    
    let backgroundColor = '#f1f5f9';
    let borderColor = '#cbd5e1';
    
    if (status === 'Hoy') {
      backgroundColor = '#dbeafe';
      borderColor = '#3b82f6';
    } else if (status === 'Próximo') {
      backgroundColor = '#d1fae5';
      borderColor = '#10b981';
    }
    
    if (isLiquidado) {
      backgroundColor = '#ecfdf5';
      borderColor = '#059669';
    }

    return {
      style: {
        backgroundColor,
        borderLeft: `4px solid ${borderColor}`,
        border: 'none',
        borderRadius: '12px',
        color: '#374151',
        fontSize: '12px',
        padding: '6px',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      }
    };
  };

  const totalEventos = eventos.length;
  const eventosHoy = eventos.filter(e => getEventStatus(e.fecha_evento).status === 'Hoy').length;
  const eventosProximos = eventos.filter(e => getEventStatus(e.fecha_evento).status === 'Próximo').length;
  const eventosLiquidados = eventos.filter(e => e.estado_liquidacion === 'liquidado').length;

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
                <Calendar className="h-12 w-12 text-white animate-pulse" />
              </div>
              <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-3xl blur-xl animate-pulse mx-auto"></div>
            </div>
            
            <h3 className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent mb-3">
              Cargando Eventos
            </h3>
            <p className="text-slate-600 text-lg">Preparando la gestión de eventos...</p>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start space-x-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-selecta-green via-primary to-selecta-green rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-3xl blur-xl"></div>
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-selecta-green via-primary to-selecta-green bg-clip-text text-transparent leading-tight">
                  Gestión de Eventos
                </h1>
                <p className="text-slate-600 text-lg font-medium mt-2 max-w-md">
                  Planificación integral y administración de eventos empresariales
                </p>
              </div>
            </div>
            
            {/* Línea decorativa animada */}
            <div className="flex items-center justify-center lg:justify-start space-x-2 mb-4">
              <div className="w-16 h-1 bg-gradient-to-r from-selecta-green to-primary rounded-full"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <div className="w-8 h-1 bg-gradient-to-r from-primary to-selecta-green rounded-full"></div>
            </div>
            
            {/* Stats mejoradas */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg border border-white/30 hover:shadow-xl transition-shadow">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-slate-700">{totalEventos} eventos</span>
                </div>
              </div>
              {eventosHoy > 0 && (
                <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg border border-white/30 hover:shadow-xl transition-shadow">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-bold text-blue-700">{eventosHoy} hoy</span>
                  </div>
                </div>
              )}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg border border-white/30 hover:shadow-xl transition-shadow">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3 h-3 text-selecta-green" />
                  <span className="text-sm font-bold text-slate-700">{eventosProximos} próximos</span>
                </div>
              </div>
            </div>
          </div>

          {/* Botón Crear Evento */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="group bg-gradient-to-r from-selecta-green to-primary hover:from-primary hover:to-selecta-green shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-8 py-4 border-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Plus className="h-5 w-5 mr-3 relative z-10" />
                <span className="font-semibold relative z-10">Crear Evento</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-2xl border-white/30 shadow-2xl rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                  {selectedEvento ? "Editar Evento" : "Crear Nuevo Evento"}
                </DialogTitle>
                <DialogDescription className="text-slate-600 text-base">
                  {selectedEvento 
                    ? "Modifica los datos del evento seleccionado" 
                    : "Completa la información del nuevo evento"
                  }
                </DialogDescription>
              </DialogHeader>
              <EventoForm
                evento={selectedEvento}
                personal={personal}
                onSubmit={handleEventoSubmit}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setSelectedEvento(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50/80 to-blue-100/80 border-b border-blue-200/30 pb-3">
              <div className="flex items-center justify-between">
                <Calendar className="h-6 w-6 text-blue-600" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totalEventos}</div>
                <p className="text-xs text-blue-600 font-medium">Total Eventos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-emerald-50/80 to-emerald-100/80 border-b border-emerald-200/30 pb-3">
              <div className="flex items-center justify-between">
                <Sparkles className="h-6 w-6 text-emerald-600" />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">{eventosProximos}</div>
                <p className="text-xs text-emerald-600 font-medium">Próximos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-orange-50/80 to-orange-100/80 border-b border-orange-200/30 pb-3">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-6 w-6 text-orange-600" />
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{eventosHoy}</div>
                <p className="text-xs text-orange-600 font-medium">Hoy</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-green-50/80 to-green-100/80 border-b border-green-200/30 pb-3">
              <div className="flex items-center justify-between">
                <DollarSign className="h-6 w-6 text-green-600" />
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{eventosLiquidados}</div>
                <p className="text-xs text-green-600 font-medium">Liquidados</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controles de vista y filtros premium */}
        <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Toggle de vista premium */}
              <div className="flex items-center space-x-2 bg-gradient-to-r from-slate-50/80 to-white/80 rounded-2xl p-1 shadow-inner">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`rounded-xl transition-all duration-200 ${
                    viewMode === 'grid' 
                      ? 'bg-white shadow-md hover:shadow-lg' 
                      : 'hover:bg-white/60'
                  }`}
                >
                  <Grid3X3 className="h-4 w-4 mr-2" />
                  Vista Tarjetas
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('calendar')}
                  className={`rounded-xl transition-all duration-200 ${
                    viewMode === 'calendar' 
                      ? 'bg-white shadow-md hover:shadow-lg' 
                      : 'hover:bg-white/60'
                  }`}
                >
                  <CalendarDays className="h-4 w-4 mr-2" />
                  Vista Calendario
                </Button>
              </div>

              {/* Filtros premium */}
              <div className="flex flex-wrap items-center gap-6">
                {/* Filtro por personal */}
                <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-slate-600" />
                  <span className="text-sm font-semibold text-slate-700">Empleado:</span>
                </div>
                <Select value={selectedPersonFilter} onValueChange={setSelectedPersonFilter}>
                  <SelectTrigger className="w-56 bg-white/80 border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <SelectValue placeholder="Todos los empleados" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/30 rounded-2xl shadow-2xl">
                    <SelectItem value="all">Todos los empleados</SelectItem>
                    {personal.map((person) => (
                      <SelectItem key={person.id} value={person.id} className="rounded-xl">
                        {person.nombre_completo} - {person.rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPersonFilter !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedPersonFilter('all')}
                    className="text-slate-500 hover:text-slate-700 rounded-xl"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                </div>

                {/* Filtro por comercial */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="text-sm font-semibold text-slate-700">Comercial:</span>
                  </div>
                  <Select value={selectedComercialFilter} onValueChange={setSelectedComercialFilter}>
                    <SelectTrigger className="w-56 bg-white/80 border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md transition-all">
                      <SelectValue placeholder="Todos los comerciales" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/95 backdrop-blur-xl border-white/30 rounded-2xl shadow-2xl">
                      <SelectItem value="all">Todos los comerciales</SelectItem>
                      {comerciales.map((comercial) => (
                        <SelectItem key={comercial} value={comercial} className="rounded-xl">
                          {comercial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedComercialFilter !== 'all' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedComercialFilter('all')}
                      className="text-slate-500 hover:text-slate-700 rounded-xl"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contenido principal */}
        {viewMode === 'calendar' ? (
          /* Vista de Calendario Premium */
          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm border-b border-slate-200/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-selecta-green to-primary rounded-2xl flex items-center justify-center shadow-lg">
                    <CalendarDays className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800">Calendario de Eventos</CardTitle>
                    <CardDescription className="text-slate-600">
                      {selectedPersonFilter === 'all' && selectedComercialFilter === 'all'
                        ? `Vista completa - ${filteredEventos.length} eventos`
                        : `${filteredEventos.length} eventos filtrados`
                      }
                    </CardDescription>
                  </div>
                </div>
                
                {/* Leyenda premium */}
                <div className="hidden lg:flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-2 bg-white/60 rounded-full px-3 py-1">
                    <div className="w-3 h-3 bg-blue-200 border-l-4 border-blue-500 rounded"></div>
                    <span className="font-medium">Hoy</span>
                  </div>
                  <div className="flex items-center space-x-2 bg-white/60 rounded-full px-3 py-1">
                    <div className="w-3 h-3 bg-green-200 border-l-4 border-green-500 rounded"></div>
                    <span className="font-medium">Próximo</span>
                  </div>
                  <div className="flex items-center space-x-2 bg-white/60 rounded-full px-3 py-1">
                    <div className="w-3 h-3 bg-emerald-200 border-l-4 border-emerald-500 rounded"></div>
                   <span className="font-medium">Liquidado</span>
                 </div>
               </div>
             </div>
           </CardHeader>
           
           <CardContent className="p-6">
             <div className="calendar-container bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-inner" style={{ height: '650px' }}>
               <BigCalendar
                 localizer={localizer}
                 events={calendarEvents}
                 startAccessor="start"
                 endAccessor="end"
                 style={calendarStyle}
                 views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
                 defaultView={Views.MONTH}
                 messages={{
                   next: "Siguiente",
                   previous: "Anterior",
                   today: "Hoy",
                   month: "Mes",
                   week: "Semana",
                   agenda: "Agenda",
                   date: "Fecha",
                   time: "Hora",
                   event: "Evento",
                   noEventsInRange: "No hay eventos en este rango",
                   showMore: (total) => `+ Ver ${total} más`
                 }}
                 components={{
                   event: EventComponent,
                 }}
                 eventPropGetter={eventStyleGetter}
                 onSelectEvent={(event) => {
                   nav(`/eventos/${event.resource.id}`);
                 }}
                 popup
                 step={60}
                 showMultiDayTimes
               />
             </div>
           </CardContent>
         </Card>
       ) : (
         /* Vista Grid Premium */
         <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
           <CardHeader className="bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm border-b border-slate-200/30">
             <div className="flex items-center space-x-3">
               <div className="w-12 h-12 bg-gradient-to-r from-selecta-green to-primary rounded-2xl flex items-center justify-center shadow-lg">
                 <Grid3X3 className="h-6 w-6 text-white" />
               </div>
               <div>
                 <CardTitle className="text-xl font-bold text-slate-800">Catálogo de Eventos ({filteredEventos.length})</CardTitle>
                 <CardDescription className="text-slate-600">
                   {selectedPersonFilter === 'all' && selectedComercialFilter === 'all'
                     ? "Vista completa de todos los eventos registrados"
                     : "Eventos filtrados según criterios seleccionados"}
                 </CardDescription>
               </div>
             </div>
           </CardHeader>

           <CardContent className="p-6">
             {filteredEventos.length === 0 ? (
               <div className="text-center py-16">
                 <div className="relative mb-8">
                   <div className="w-24 h-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                     <Calendar className="h-12 w-12 text-slate-400" />
                   </div>
                   <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-slate-100/50 to-slate-200/50 rounded-3xl blur-xl mx-auto"></div>
                 </div>
                 <h3 className="text-2xl font-bold text-slate-800 mb-3">
                   {selectedPersonFilter === 'all' ? "Sin eventos registrados" : "Sin eventos para este empleado"}
                 </h3>
                 <p className="text-slate-600 text-lg max-w-md mx-auto mb-6">
                   {selectedPersonFilter === 'all' 
                     ? "Comienza creando tu primer evento empresarial" 
                     : "Este empleado no está asignado a ningún evento actualmente"}
                 </p>
                 {selectedPersonFilter === 'all' && (
                   <Button 
                     onClick={() => setIsDialogOpen(true)}
                     className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-xl hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3"
                   >
                     <Plus className="h-5 w-5 mr-2" />
                     Crear Primer Evento
                   </Button>
                 )}
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredEventos.map((evento, index) => {
                   const { status, variant, icon } = getEventStatus(evento.fecha_evento);
                   const hasSelectedPerson = selectedPersonFilter === 'all' || 
                     evento.personal.some(p => p.id === selectedPersonFilter);
                   
                   return (
                     <div 
                       key={evento.id} 
                       className={`bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border-2 border-slate-200/40 hover:border-selecta-green/40 hover:shadow-2xl transition-all duration-300 group overflow-hidden cursor-pointer transform hover:scale-[1.02] ${
                         hasSelectedPerson && selectedPersonFilter !== 'all' ? 'ring-2 ring-selecta-green/30' : ''
                       }`}
                       onClick={() => nav(`/eventos/${evento.id}`)}
                       style={{
                         animationDelay: `${index * 100}ms`
                       }}
                     >
                       <div className="p-6 h-full flex flex-col">
                         {/* Header del evento */}
                         <div className="flex items-start justify-between mb-4">
                           <div className="flex-1 min-w-0">
                             <h3 className="text-lg font-bold text-slate-800 line-clamp-2 group-hover:text-selecta-green transition-colors mb-2">
                               {evento.nombre_evento}
                             </h3>
                             <div className="flex items-center gap-2 flex-wrap">
                               <Badge className={`${variant} border font-medium shadow-sm`}>
                                 <span className="mr-1">{icon}</span>
                                 {status}
                               </Badge>
                               {evento.estado_liquidacion === 'liquidado' && (
                                 <Badge className={`${getLiquidacionBadge(evento.estado_liquidacion)} border font-medium`}>
                                   <DollarSign className="h-3 w-3 mr-1" />
                                   Liquidado
                                 </Badge>
                               )}
                             </div>
                           </div>
                         </div>

                         {/* Información del evento */}
                         <div className="space-y-3 mb-4 flex-1">
                           <div className="flex items-center text-sm text-slate-600 group/item hover:text-selecta-green transition-colors">
                             <Calendar className="h-4 w-4 mr-3 text-selecta-green group-hover/item:scale-110 transition-transform" />
                             <span className="font-semibold">
                               {format(new Date(evento.fecha_evento), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                             </span>
                           </div>
                           
                           <div className="flex items-center text-sm text-slate-600 group/item hover:text-selecta-green transition-colors">
                             <MapPin className="h-4 w-4 mr-3 text-selecta-green group-hover/item:scale-110 transition-transform" />
                             <span className="line-clamp-1 font-medium">{evento.ubicacion}</span>
                           </div>

                           {evento.comercial_encargado && (
                             <div className="flex items-center text-sm text-slate-600 group/item hover:text-primary transition-colors">
                               <Users className="h-4 w-4 mr-3 text-primary group-hover/item:scale-110 transition-transform" />
                               <span className="line-clamp-1 font-medium">Comercial: {evento.comercial_encargado}</span>
                             </div>
                           )}

                           {evento.descripcion && (
                             <div className="bg-gradient-to-r from-slate-50/80 to-white/80 p-4 rounded-2xl border border-slate-200/40">
                               <p className="text-sm text-slate-600 line-clamp-2 font-medium">
                                 {evento.descripcion}
                               </p>
                             </div>
                           )}

                           {/* Personal asignado si hay filtro */}
                           {selectedPersonFilter !== 'all' && (
                             <div className="bg-gradient-to-r from-selecta-green/5 to-primary/5 p-4 rounded-2xl border border-selecta-green/20">
                               <p className="text-xs font-bold text-selecta-green mb-2 flex items-center">
                                 <Users className="h-3 w-3 mr-1" />
                                 EQUIPO ASIGNADO:
                               </p>
                               <div className="flex flex-wrap gap-1">
                                 {evento.personal.map(p => (
                                   <Badge 
                                     key={p.id} 
                                     className={`text-xs transition-all duration-200 ${
                                       p.id === selectedPersonFilter 
                                         ? 'bg-selecta-green text-white shadow-lg' 
                                         : 'bg-white/80 text-slate-700 hover:bg-slate-100'
                                     }`}
                                   >
                                     {p.nombre_completo}
                                   </Badge>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>

                         {/* Stats del evento */}
                         <div className="flex items-center justify-between mb-4 p-4 bg-gradient-to-r from-slate-50/80 to-slate-100/80 rounded-2xl border border-slate-200/40 group-hover:from-selecta-green/5 group-hover:to-primary/5 transition-all">
                           <div className="flex items-center text-sm text-slate-700">
                             <Users className="h-5 w-5 mr-2 text-selecta-green" />
                             <span className="font-bold">{evento.personal?.length || 0} empleados</span>
                           </div>
                           <div className="text-right">
                             <div className="text-xs text-slate-500 font-medium">Costo Total</div>
                             <div className="text-xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                               ${(evento.costo_total || 0).toLocaleString()}
                             </div>
                           </div>
                         </div>

                         {/* Acciones del evento */}
                         <div className="flex justify-between items-center pt-2" onClick={(e) => e.stopPropagation()}>
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => nav(`/eventos/${evento.id}`)}
                             className="flex items-center space-x-1 hover:bg-blue-100 hover:text-blue-700 rounded-xl transition-all duration-200 hover:scale-105"
                           >
                             <Eye className="h-4 w-4" />
                             <span className="text-xs font-medium">Ver Detalle</span>
                           </Button>

                           <div className="flex space-x-1">
                             {evento.estado_liquidacion !== 'liquidado' && evento.personal.length > 0 && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleLiquidarEvento(evento)}
                                 className="bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200/60 hover:from-emerald-100 hover:to-emerald-200 rounded-xl transition-all duration-200 hover:scale-105"
                               >
                                 <DollarSign className="h-4 w-4" />
                               </Button>
                             )}
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => {
                                 setSelectedEvento(evento);
                                 setIsDialogOpen(true);
                               }}
                               className="hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all duration-200 hover:scale-105"
                             >
                               <Edit className="h-4 w-4" />
                             </Button>
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button 
                                   variant="ghost" 
                                   size="sm"
                                   className="hover:bg-red-50 hover:text-red-700 rounded-xl transition-all duration-200 hover:scale-105"
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent className="bg-white/95 backdrop-blur-2xl border-white/30 shadow-2xl rounded-3xl">
                                 <AlertDialogHeader>
                                   <AlertDialogTitle className="text-2xl font-bold text-slate-800">
                                     ¿Eliminar evento?
                                   </AlertDialogTitle>
                                   <AlertDialogDescription className="text-slate-600 text-base">
                                     Esta acción es irreversible. Se eliminará permanentemente
                                     el evento <span className="font-semibold">"{evento.nombre_evento}"</span> y toda su información asociada.
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel className="rounded-2xl">Cancelar</AlertDialogCancel>
                                   <AlertDialogAction
                                     onClick={() => handleDeleteEvento(evento.id)}
                                     className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-2xl shadow-lg hover:shadow-xl transition-all"
                                   >
                                     Eliminar Evento
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                           </div>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>
             )}
           </CardContent>
         </Card>
       )}

       {/* Footer premium */}
       <div className="text-center pt-8">
         <div className="inline-flex items-center justify-center space-x-4 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/30">
           <div className="flex items-center space-x-2">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
             <span className="text-sm font-medium text-slate-600">Sistema actualizado</span>
           </div>
           <div className="w-px h-4 bg-slate-300"></div>
           <div className="flex items-center space-x-2">
             <Calendar className="h-4 w-4 text-slate-500" />
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

     {/* Dialog de Liquidación */}
     {liquidacionEvento && (
       <LiquidacionDialog
         evento={liquidacionEvento}
         isOpen={isLiquidacionOpen}
         onClose={() => {
           setIsLiquidacionOpen(false);
           setLiquidacionEvento(null);
         }}
         onLiquidationComplete={fetchEventos}
       />
     )}

     {/* Estilos mejorados para el calendario */}
     <style jsx global>{`
       .rbc-calendar { 
         background: rgba(255, 255, 255, 0.9); 
         border-radius: 16px; 
         border: none !important; 
         font-family: inherit; 
         box-shadow: none; 
         backdrop-filter: blur(10px);
       }
       .rbc-header { 
         background: linear-gradient(to right, #f8fafc, #f1f5f9); 
         border: none !important; 
         padding: 16px 12px; 
         font-weight: 700; 
         color: #475569; 
         font-size: 14px; 
         border-radius: 8px 8px 0 0;
       }
       .rbc-month-view { border: none !important; }
       .rbc-date-cell, .rbc-day-bg { 
         border-right: 1px solid #e2e8f0 !important; 
         border-bottom: 1px solid #e2e8f0 !important; 
       }
       .rbc-today { 
         background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(16, 185, 129, 0.1)) !important; 
       }
       .rbc-off-range-bg { background-color: #f8fafc !important; }
       .rbc-toolbar { 
         margin-bottom: 24px; 
         padding: 0 12px; 
         background: rgba(248, 250, 252, 0.8);
         border-radius: 12px;
         padding: 16px;
       }
       .rbc-toolbar button { 
         background: white; 
         border: 1px solid #e2e8f0; 
         color: #475569; 
         padding: 10px 20px; 
         border-radius: 12px; 
         font-weight: 600; 
         margin: 0 3px; 
         transition: all 0.3s;
         box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
       }
       .rbc-toolbar button:hover { 
         background: #f1f5f9; 
         border-color: #cbd5e1; 
         transform: translateY(-1px);
         box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
       }
       .rbc-toolbar button.rbc-active { 
         background: linear-gradient(to right, #10b981, #059669); 
         border-color: #059669; 
         color: white;
         box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
       }
       .rbc-event { 
         background: none !important; 
         border: none !important; 
         cursor: pointer; 
         transition: all 0.2s;
       }
       .rbc-event:hover { 
         transform: translateY(-2px); 
         box-shadow: 0 8px 15px rgba(0, 0, 0, 0.15); 
       }
       .rbc-event-content { padding: 4px 6px; }
       .rbc-toolbar-label { 
         font-weight: 800; 
         font-size: 20px; 
         color: #1e293b;
         text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
       }
       .rbc-btn-group button:first-child { 
         border-top-left-radius: 12px; 
         border-bottom-left-radius: 12px; 
       }
       .rbc-btn-group button:last-child { 
         border-top-right-radius: 12px; 
         border-bottom-right-radius: 12px; 
       }
       .rbc-btn-group button:not(:first-child) { margin-left: -1px; }
       .rbc-date-cell button { 
         color: #475569; 
         font-weight: 600;
         transition: all 0.2s;
       }
       .rbc-date-cell button:hover { 
         color: #10b981;
         transform: scale(1.1);
       }
     `}</style>
   </div>
 );
}