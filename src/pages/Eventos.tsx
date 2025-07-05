import { useState, useEffect } from "react";
import { Plus, Calendar, MapPin, Edit, Trash2, Users, DollarSign, Grid3X3, CalendarDays, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EventoForm } from "@/components/Forms/EventoForm";
import { LiquidacionDialog } from "@/components/Forms/LiquidacionDialog";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal, Personal, PersonalAsignado } from "@/types/database";
import 'react-big-calendar/lib/css/react-big-calendar.css';

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
  const [eventos, setEventos] = useState<EventoConPersonal[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvento, setSelectedEvento] = useState<EventoConPersonal | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [liquidacionEvento, setLiquidacionEvento] = useState<EventoConPersonal | null>(null);
  const [isLiquidacionOpen, setIsLiquidacionOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
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
        
        return {
          ...evento,
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

    if (eventDate < today) return { status: "Pasado", variant: "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 border-slate-200/60" };
    if (eventDate.getTime() === today.getTime()) return { status: "Hoy", variant: "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-200/60" };
    return { status: "Próximo", variant: "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border-emerald-200/60" };
  };

  const getLiquidacionBadge = (estado: string) => {
    if (estado === 'liquidado') {
      return "bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-200/60";
    }
    return "bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-200/60";
  };

  // Filtrar eventos según el personal seleccionado
  const filteredEventos = selectedPersonFilter === 'all' 
    ? eventos 
    : eventos.filter(evento => 
        evento.personal.some(p => p.id === selectedPersonFilter)
      );

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
    const { status } = getEventStatus(event.resource.fecha_evento);
    const isLiquidado = event.resource.estado_liquidacion === 'liquidado';
    
    return (
      <div className="text-xs p-1">
        <div className="font-semibold truncate">{event.title}</div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs opacity-75">
            {event.resource.personal.length} personas
          </span>
          <div className="flex space-x-1">
            {status === 'Hoy' && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
            {status === 'Próximo' && <div className="w-2 h-2 bg-green-500 rounded-full"></div>}
            {isLiquidado && <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>}
          </div>
        </div>
      </div>
    );
  };

  // Estilos personalizados para el calendario
  const calendarStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    border: 'none',
    fontFamily: 'inherit',
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const { status } = getEventStatus(event.resource.fecha_evento);
    const isLiquidado = event.resource.estado_liquidacion === 'liquidado';
    
    let backgroundColor = '#e2e8f0'; // default gray
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
        borderRadius: '8px',
        color: '#374151',
        fontSize: '12px',
        padding: '4px',
      }
    };
  };

  const totalEventos = eventos.length;

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-selecta-green/3 to-primary/3 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-slate-100/50 to-selecta-green/5 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-selecta-green to-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl animate-pulse">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-selecta-green mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Cargando eventos...</p>
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
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                  Gestión de Eventos
                </h1>
                <p className="text-slate-600 text-lg font-medium mt-1">
                  Planificación y administración de eventos
                </p>
              </div>
            </div>
            
            <div className="w-32 h-1 bg-gradient-to-r from-selecta-green to-primary rounded-full mx-auto lg:mx-0 mb-2"></div>
            
            <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-slate-200/60">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-700">{totalEventos} eventos registrados</span>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-lg hover:scale-105 transition-all duration-200 rounded-xl px-6 py-3 shadow-md">
                <Plus className="h-5 w-5 mr-2" />
                Crear Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                  {selectedEvento ? "Editar Evento" : "Crear Evento"}
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  {selectedEvento 
                    ? "Modifica los datos del evento" 
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

        {/* Controles de vista y filtros */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-4 shadow-lg border border-white/20">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Toggle de vista */}
            <div className="flex items-center space-x-2 bg-slate-100/80 rounded-xl p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={`rounded-lg ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Vista Grid
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={`rounded-lg ${viewMode === 'calendar' ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Vista Calendario
              </Button>
            </div>

            {/* Filtro por personal */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Filtrar por empleado:</span>
              </div>
              <Select value={selectedPersonFilter} onValueChange={setSelectedPersonFilter}>
                <SelectTrigger className="w-48 bg-white/80 border-slate-200/60 rounded-xl">
                  <SelectValue placeholder="Todos los empleados" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl">
                  <SelectItem value="all">Todos los empleados</SelectItem>
                  {personal.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
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
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Contenido principal */}
        {viewMode === 'calendar' ? (
          /* Vista de Calendario */
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-slate-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-selecta-green to-primary rounded-xl flex items-center justify-center">
                      <CalendarDays className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Calendario de Eventos</h3>
                      <p className="text-sm text-slate-600">
                        {selectedPersonFilter === 'all' 
                          ? `Mostrando ${filteredEventos.length} eventos` 
                          : `Eventos de ${personal.find(p => p.id === selectedPersonFilter)?.nombre_completo} (${filteredEventos.length})`
                        }
                      </p>
                    </div>
                  </div>
                  
                  {/* Leyenda */}
                  <div className="flex items-center space-x-4 text-xs">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-blue-200 border-l-4 border-blue-500 rounded"></div>
                      <span>Hoy</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-200 border-l-4 border-green-500 rounded"></div>
                      <span>Próximo</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-emerald-200 border-l-4 border-emerald-500 rounded"></div>
                      <span>Liquidado</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="calendar-container" style={{ height: '600px' }}>
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
                      setSelectedEvento(event.resource);
                      setIsDialogOpen(true);
                    }}
                    popup
                    step={60}
                    showMultiDayTimes
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Vista Grid Original */
          <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
            <div className="bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-slate-200/60">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-selecta-green to-primary rounded-xl flex items-center justify-center">
                    <Grid3X3 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Lista de Eventos ({filteredEventos.length})</h3>
                    <p className="text-sm text-slate-600">
                      {selectedPersonFilter === 'all' 
                        ? "Todos los eventos registrados" 
                        : `Eventos de ${personal.find(p => p.id === selectedPersonFilter)?.nombre_completo}`
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {filteredEventos.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Calendar className="h-10 w-10 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                      {selectedPersonFilter === 'all' ? "No hay eventos registrados" : "No hay eventos para este empleado"}
                    </h3>
                    <p className="text-slate-600 max-w-sm mx-auto mb-4">
                      {selectedPersonFilter === 'all' 
                        ? "Comienza creando tu primer evento" 
                        : "Este empleado no está asignado a ningún evento"
                      }
                    </p>
                    {selectedPersonFilter === 'all' && (
                      <Button 
                        onClick={() => setIsDialogOpen(true)}
                        className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-lg hover:scale-105 transition-all duration-200 rounded-xl"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Crear Primer Evento
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEventos.map((evento) => {
                      const { status, variant } = getEventStatus(evento.fecha_evento);
                      const hasSelectedPerson = selectedPersonFilter === 'all' || 
                        evento.personal.some(p => p.id === selectedPersonFilter);
                      
                      return (
                        <div 
                          key={evento.id} 
                          className={`bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border-2 border-slate-200/40 hover:border-selecta-green/30 hover:shadow-xl transition-all duration-300 group overflow-hidden ${
                            hasSelectedPerson && selectedPersonFilter !== 'all' ? 'ring-2 ring-selecta-green/20' : ''
                          }`}
                        >
                          <div className="p-6 h-full">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h3 className="text-lg font-bold text-slate-800 line-clamp-2 group-hover:text-selecta-green transition-colors">
                                  {evento.nombre_evento}
                                </h3>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge className={`${variant} border font-medium`}>
                                    {status}
                                  </Badge>
                                  {evento.estado_liquidacion === 'liquidado' && (
                                    <Badge className={`${getLiquidacionBadge(evento.estado_liquidacion)} border font-medium`}>
                                      Liquidado
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 mb-4">
                              <div className="flex items-center text-sm text-slate-600">
                                <Calendar className="h-4 w-4 mr-2 text-selecta-green" />
                                <span className="font-medium">
                                  {format(new Date(evento.fecha_evento), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                                </span>
                              </div>
                              
                              <div className="flex items-center text-sm text-slate-600">
                                <MapPin className="h-4 w-4 mr-2 text-selecta-green" />
                                <span className="line-clamp-1 font-medium">{evento.ubicacion}</span>
                              </div>

                              {evento.descripcion && (
                                <p className="text-sm text-slate-600 line-clamp-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200/40">
                                  {evento.descripcion}
                                </p>
                              )}

                              {/* Mostrar personal si hay filtro */}
                              {selectedPersonFilter !== 'all' && (
                                <div className="bg-selecta-green/5 p-3 rounded-xl border border-selecta-green/20">
                                  <p className="text-xs font-medium text-selecta-green mb-1">Personal asignado:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {evento.personal.map(p => (
                                      <Badge 
                                        key={p.id} 
                                        className={`text-xs ${p.id === selectedPersonFilter ? 'bg-selecta-green text-white' : 'bg-slate-100 text-slate-700'}`}
                                      >
                                        {p.nombre_completo}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-slate-50 to-slate-100/80 rounded-xl border border-slate-200/40">
                              <div className="flex items-center text-sm text-slate-700">
                                <Users className="h-4 w-4 mr-1 text-selecta-green" />
                                <span className="font-medium">{evento.personal?.length || 0} personas</span>
                              </div>
                              <div className="font-bold text-lg bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                                ${(evento.costo_total || 0).toLocaleString()}
                              </div>
                            </div>

                            <div className="flex justify-end space-x-2">
                            {evento.estado_liquidacion !== 'liquidado' && evento.personal.length > 0 && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleLiquidarEvento(evento)}
                                 className="bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200/60 hover:from-emerald-100 hover:to-emerald-200 rounded-lg"
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
                               className="hover:bg-blue-50 hover:text-blue-700 rounded-lg"
                             >
                               <Edit className="h-4 w-4" />
                             </Button>
                             <AlertDialog>
                               <AlertDialogTrigger asChild>
                                 <Button 
                                   variant="ghost" 
                                   size="sm"
                                   className="hover:bg-red-50 hover:text-red-700 rounded-lg"
                                 >
                                   <Trash2 className="h-4 w-4" />
                                 </Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
                                 <AlertDialogHeader>
                                   <AlertDialogTitle className="text-xl font-bold text-slate-800">
                                     ¿Eliminar evento?
                                   </AlertDialogTitle>
                                   <AlertDialogDescription className="text-slate-600">
                                     Esta acción no se puede deshacer. Se eliminará permanentemente
                                     el evento "{evento.nombre_evento}".
                                   </AlertDialogDescription>
                                 </AlertDialogHeader>
                                 <AlertDialogFooter>
                                   <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                   <AlertDialogAction
                                     onClick={() => handleDeleteEvento(evento.id)}
                                     className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl"
                                   >
                                     Eliminar
                                   </AlertDialogAction>
                                 </AlertDialogFooter>
                               </AlertDialogContent>
                             </AlertDialog>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}
             </div>
           </div>
         </div>
       )}

       {/* Footer decorativo sutil */}
       <div className="text-center pt-8">
         <div className="inline-flex items-center space-x-2 text-sm text-slate-400">
           <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
           <span>Última actualización: {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
           <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
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

     {/* Estilos CSS adicionales para el calendario */}
     <style jsx global>{`
       .rbc-calendar {
         background: white;
         border-radius: 12px;
         border: none !important;
         font-family: inherit;
         box-shadow: none;
       }
       
       .rbc-header {
         background: linear-gradient(to right, #f8fafc, #f1f5f9);
         border: none !important;
         padding: 12px 8px;
         font-weight: 600;
         color: #475569;
         font-size: 14px;
       }
       
       .rbc-month-view {
         border: none !important;
       }
       
       .rbc-date-cell {
         border-right: 1px solid #e2e8f0 !important;
         border-bottom: 1px solid #e2e8f0 !important;
       }
       
       .rbc-day-bg {
         border-right: 1px solid #e2e8f0 !important;
         border-bottom: 1px solid #e2e8f0 !important;
       }
       
       .rbc-today {
         background-color: rgba(16, 185, 129, 0.05) !important;
       }
       
       .rbc-off-range-bg {
         background-color: #f8fafc !important;
       }
       
       .rbc-toolbar {
         margin-bottom: 20px;
         padding: 0 8px;
       }
       
       .rbc-toolbar button {
         background: white;
         border: 1px solid #e2e8f0;
         color: #475569;
         padding: 8px 16px;
         border-radius: 8px;
         font-weight: 500;
         margin: 0 2px;
         transition: all 0.2s;
       }
       
       .rbc-toolbar button:hover {
         background: #f1f5f9;
         border-color: #cbd5e1;
       }
       
       .rbc-toolbar button.rbc-active {
         background: linear-gradient(to right, #10b981, #059669);
         border-color: #059669;
         color: white;
       }
       
       .rbc-event {
         background: none !important;
         border: none !important;
         box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
         cursor: pointer;
         transition: all 0.2s;
       }
       
       .rbc-event:hover {
         transform: translateY(-1px);
         box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
       }
       
       .rbc-event-content {
         padding: 2px 4px;
       }
       
       .rbc-toolbar-label {
         font-weight: 700;
         font-size: 18px;
         color: #1e293b;
       }
       
       .rbc-btn-group button:first-child {
         border-top-left-radius: 8px;
         border-bottom-left-radius: 8px;
       }
       
       .rbc-btn-group button:last-child {
         border-top-right-radius: 8px;
         border-bottom-right-radius: 8px;
       }
       
       .rbc-btn-group button:not(:first-child) {
         margin-left: -1px;
       }
     `}</style>
   </div>
 );
}