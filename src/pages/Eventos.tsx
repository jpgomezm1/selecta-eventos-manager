import { useState, useEffect, useMemo } from "react";
import { Calendar, MapPin, Users, DollarSign, Grid3X3, CalendarDays, Search, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as BigCalendar, momentLocalizer, Views } from 'react-big-calendar';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { LiquidacionDialog } from "@/components/Forms/LiquidacionDialog";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal, Personal, PersonalAsignado } from "@/types/database";
import { fetchChecklistDataBatch } from "@/integrations/supabase/apiEventoChecklist";
import { computeChecklist } from "@/lib/eventoChecklist";
import type { ChecklistResult } from "@/lib/eventoChecklist";
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from "react-router-dom";

import moment from 'moment';
import 'moment/locale/es';
moment.locale('es');
const localizer = momentLocalizer(moment);

const ITEMS_PER_PAGE = 9;

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
  const [liquidacionEvento, setLiquidacionEvento] = useState<EventoConPersonal | null>(null);
  const [isLiquidacionOpen, setIsLiquidacionOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [checklistMap, setChecklistMap] = useState<Record<string, ChecklistResult>>({});
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

      // Fetch checklist data for all events
      const ids = eventosConPersonal.map((e) => e.id);
      if (ids.length > 0) {
        try {
          const batch = await fetchChecklistDataBatch(ids);
          const map: Record<string, ChecklistResult> = {};
          for (const id of ids) {
            if (batch[id]) {
              map[id] = computeChecklist(batch[id]);
            }
          }
          setChecklistMap(map);
        } catch {
          // fail silently for checklist
        }
      }
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

  const handleLiquidarEvento = async (evento: EventoConPersonal) => {
    const personalSinHoras = evento.personal.filter(p => !p.horas_trabajadas || p.horas_trabajadas <= 0);
    if (personalSinHoras.length > 0) {
      toast({
        title: "Información faltante",
        description: `${personalSinHoras.length} empleado(s) no tienen horas definidas.`,
        variant: "destructive",
      });
      return;
    }
    setLiquidacionEvento(evento);
    setIsLiquidacionOpen(true);
  };

  const getEventStatus = (fechaEvento: string) => {
    const eventDate = new Date(fechaEvento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    if (eventDate < today) return { status: "Pasado", variant: "bg-slate-100 text-slate-600" };
    if (eventDate.getTime() === today.getTime()) return { status: "Hoy", variant: "bg-blue-100 text-blue-700" };
    return { status: "Próximo", variant: "bg-emerald-100 text-emerald-700" };
  };

  // Filtrar eventos
  const filteredEventos = eventos.filter(evento => {
    const matchesSearch = searchTerm === '' ||
      evento.nombre_evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evento.ubicacion?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPersonal = selectedPersonFilter === 'all' ||
      evento.personal.some(p => p.id === selectedPersonFilter);
    return matchesSearch && matchesPersonal;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedPersonFilter]);

  const totalPages = Math.ceil(filteredEventos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedEventos = filteredEventos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const calendarEvents: CalendarEvent[] = filteredEventos.map(evento => ({
    id: evento.id,
    title: evento.nombre_evento,
    start: new Date(evento.fecha_evento),
    end: new Date(evento.fecha_evento),
    resource: evento
  }));

  const eventStyleGetter = (event: CalendarEvent) => {
    const { status } = getEventStatus(event.resource.fecha_evento);
    const isLiquidado = event.resource.estado_liquidacion === 'liquidado';
    let backgroundColor = '#f1f5f9';
    let borderColor = '#cbd5e1';
    if (status === 'Hoy') { backgroundColor = '#dbeafe'; borderColor = '#3b82f6'; }
    else if (status === 'Próximo') { backgroundColor = '#d1fae5'; borderColor = '#10b981'; }
    if (isLiquidado) { backgroundColor = '#ecfdf5'; borderColor = '#059669'; }
    return {
      style: {
        backgroundColor,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: '4px',
        color: '#374151',
        fontSize: '12px',
        padding: '2px 6px',
      }
    };
  };

  const getIncompleteHints = (eventoId: string): string[] => {
    const cl = checklistMap[eventoId];
    if (!cl) return [];
    return cl.items.filter((i) => !i.completed).map((i) => i.label).slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-selecta-green rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Cargando eventos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Eventos</h1>
          <p className="text-slate-500 mt-1">
            {eventos.length} eventos registrados
          </p>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <Card>
        <div className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar evento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Select value={selectedPersonFilter} onValueChange={setSelectedPersonFilter}>
                <SelectTrigger className="w-full sm:w-52 h-9">
                  <SelectValue placeholder="Filtrar por empleado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los empleados</SelectItem>
                  {personal.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.nombre_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className={`h-8 ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Tarjetas
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={`h-8 ${viewMode === 'calendar' ? 'bg-white shadow-sm' : ''}`}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Calendario
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Content */}
      {viewMode === 'calendar' ? (
        <Card className="p-4">
          <div style={{ height: '600px' }}>
            <BigCalendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
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
                showMore: (total) => `+ ${total} más`
              }}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={(event) => nav(`/eventos/${event.resource.id}`)}
              popup
            />
          </div>
        </Card>
      ) : (
        <div>
          {filteredEventos.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-slate-900 font-medium">
                  {eventos.length === 0 ? "No hay eventos registrados" : "Sin resultados"}
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  {eventos.length === 0
                    ? "Los eventos se crean al aprobar una cotización"
                    : "Intenta con otros criterios de búsqueda"
                  }
                </p>
              </div>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedEventos.map((evento) => {
                  const { status, variant } = getEventStatus(evento.fecha_evento);
                  const cl = checklistMap[evento.id];
                  const hints = getIncompleteHints(evento.id);

                  return (
                    <Card
                      key={evento.id}
                      className="hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => nav(`/eventos/${evento.id}`)}
                    >
                      <div className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-slate-900 truncate group-hover:text-selecta-green transition-colors">
                              {evento.nombre_evento}
                            </h3>
                            <p className="text-sm text-slate-500 mt-0.5">
                              {format(new Date(evento.fecha_evento), "EEE, d MMM yyyy", { locale: es })}
                            </p>
                          </div>
                          <div className="flex gap-1.5 ml-2">
                            <Badge variant="secondary" className={variant}>{status}</Badge>
                            {evento.estado_liquidacion === 'liquidado' && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700">Liquidado</Badge>
                            )}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center text-sm text-slate-600">
                            <MapPin className="h-4 w-4 mr-2 text-slate-400" />
                            <span className="truncate">{evento.ubicacion || 'Sin ubicación'}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center text-slate-600">
                              <Users className="h-4 w-4 mr-2 text-slate-400" />
                              <span>{evento.personal?.length || 0} empleados</span>
                            </div>
                            <span className="font-medium text-slate-900">
                              ${(evento.costo_total || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        {cl && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-slate-500">{cl.completedCount}/{cl.totalCount} tareas</span>
                              <span className="font-medium text-slate-700">{cl.percent}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div
                                className="bg-emerald-500 h-1.5 rounded-full transition-all"
                                style={{ width: `${cl.percent}%` }}
                              />
                            </div>
                            {hints.length > 0 && (
                              <p className="text-xs text-slate-400 mt-1 truncate">
                                Falta: {hints.join(", ")}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => nav(`/eventos/${evento.id}`)}
                            className="h-8 text-slate-600"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>

                          <div className="flex items-center gap-1">
                            {evento.estado_liquidacion !== 'liquidado' && evento.personal.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLiquidarEvento(evento)}
                                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-slate-500">
                    {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredEventos.length)} de {filteredEventos.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(page => {
                        if (totalPages <= 5) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                        return false;
                      })
                      .map((page, index, array) => (
                        <span key={page} className="flex items-center">
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-1 text-slate-400">...</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={`h-8 w-8 p-0 ${
                              currentPage === page ? "bg-selecta-green hover:bg-selecta-green/90" : ""
                            }`}
                          >
                            {page}
                          </Button>
                        </span>
                      ))
                    }
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Liquidación Dialog */}
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

      {/* Calendar Styles */}
      <style>{`
        .rbc-calendar { font-family: inherit; }
        .rbc-header { padding: 8px; font-weight: 500; color: #64748b; font-size: 13px; }
        .rbc-toolbar { margin-bottom: 16px; }
        .rbc-toolbar button { color: #475569; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; font-size: 13px; }
        .rbc-toolbar button:hover { background: #f1f5f9; }
        .rbc-toolbar button.rbc-active { background: #10b981; border-color: #10b981; color: white; }
        .rbc-today { background: #f0fdf4 !important; }
        .rbc-event { cursor: pointer; }
        .rbc-toolbar-label { font-weight: 600; font-size: 16px; color: #1e293b; }
      `}</style>
    </div>
  );
}
