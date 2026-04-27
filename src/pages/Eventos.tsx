import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, MapPin, Users, DollarSign, Grid3X3, CalendarDays, Search, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { LiquidacionDialog } from "@/components/Forms/LiquidacionDialog";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal, PersonalAsignado } from "@/types/database";
import { fetchChecklistDataBatch } from "@/integrations/supabase/apiEventoChecklist";
import { computeChecklist } from "@/lib/eventoChecklist";
import type { ChecklistResult } from "@/lib/eventoChecklist";
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useNavigate } from "react-router-dom";
import { parseLocalDate } from "@/lib/dateLocal";
import { PageHeader } from "@/components/Layout/PageHeader";
import { requiereRegistroHoras } from "@/lib/calcularPagoPersonal";
import { PageSkeleton } from "@/components/ui/skeletons";

const localizer = dateFnsLocalizer({
  format,
  parse,
  // startOfWeek debe respetar la fecha que recibe (NO usar new Date());
  // si no, el grid del calendario muestra los eventos en columna equivocada.
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { es },
});

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
  const [loading, setLoading] = useState(true);
  const [liquidacionEvento, setLiquidacionEvento] = useState<EventoConPersonal | null>(null);
  const [isLiquidacionOpen, setIsLiquidacionOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'calendar'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<'all' | 'proximo' | 'hoy' | 'pasado_pendiente' | 'pasado_liquidado'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [checklistMap, setChecklistMap] = useState<Record<string, ChecklistResult>>({});
  const { toast } = useToast();

  const fetchEventos = useCallback(async () => {
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
              comercial_encargado,
              total_cotizado
            )
          )
        `)
        .order("fecha_evento", { ascending: false });

      if (error) throw error;

      const eventosConPersonal: EventoConPersonal[] = (data || []).map((evento) => {
        const personalAsignado: PersonalAsignado[] = (evento.evento_personal?.map((ep) => ({
          ...ep.personal,
          hora_inicio: ep.hora_inicio,
          hora_fin: ep.hora_fin,
          horas_trabajadas: ep.horas_trabajadas,
          pago_calculado: ep.pago_calculado,
          estado_pago: ep.estado_pago ?? "pendiente",
          fecha_pago: ep.fecha_pago,
          metodo_pago: ep.metodo_pago,
          notas_pago: ep.notas_pago,
          evento_personal_id: ep.id,
        })) || []) as PersonalAsignado[];
        const cotizacionInfo = evento.cotizacion_versiones?.cotizaciones;
        const ubicacionEvento = cotizacionInfo?.ubicacion_evento || evento.ubicacion;
        const comercialEncargado = cotizacionInfo?.comercial_encargado;
        // Total cotizado al cliente — el "tamaño" del evento. Lo operativo
        // (costo a Selecta del personal asignado) vive en el detalle, no acá.
        const totalCotizado = Number(cotizacionInfo?.total_cotizado ?? 0);

        return {
          ...evento,
          ubicacion: ubicacionEvento,
          comercial_encargado: comercialEncargado,
          estado_liquidacion: (evento.estado_liquidacion as 'pendiente' | 'liquidado') || 'pendiente',
          personal: personalAsignado,
          costo_total: totalCotizado,
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
        } catch (err) {
          toast({
            title: "Progreso no disponible",
            description: err?.message ?? "No se pudo cargar el checklist de los eventos.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error)?.message ?? "Error al cargar los eventos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  const handleLiquidarEvento = async (evento: EventoConPersonal) => {
    const personalSinHoras = evento.personal.filter(p =>
      requiereRegistroHoras(p.modalidad_cobro) && (!p.horas_trabajadas || p.horas_trabajadas <= 0)
    );
    if (personalSinHoras.length > 0) {
      toast({
        title: "Información faltante",
        description: `${personalSinHoras.length} empleado(s) con cobro por hora no tienen horas definidas.`,
        variant: "destructive",
      });
      return;
    }
    setLiquidacionEvento(evento);
    setIsLiquidacionOpen(true);
  };

  const getEventStatus = (fechaEvento: string) => {
    const eventDate = parseLocalDate(fechaEvento);
    if (!eventDate)
      return {
        status: "Sin fecha",
        variant: "border-border bg-muted/40 text-muted-foreground",
      };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    if (eventDate < today)
      return {
        status: "Pasado",
        variant: "border-border bg-muted/40 text-muted-foreground",
      };
    if (eventDate.getTime() === today.getTime())
      return {
        status: "Hoy",
        variant: "border-primary/30 bg-primary/10 text-primary",
      };
    return {
      status: "Próximo",
      variant: "border-primary/25 bg-primary/10 text-primary",
    };
  };

  // Filtrar eventos
  const filteredEventos = eventos.filter(evento => {
    const matchesSearch = searchTerm === '' ||
      evento.nombre_evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
      evento.ubicacion?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesEstado = true;
    if (estadoFilter !== 'all') {
      const { status } = getEventStatus(evento.fecha_evento);
      const liquidado = evento.estado_liquidacion === 'liquidado';
      switch (estadoFilter) {
        case 'proximo':
          matchesEstado = status === 'Próximo';
          break;
        case 'hoy':
          matchesEstado = status === 'Hoy';
          break;
        case 'pasado_pendiente':
          matchesEstado = status === 'Pasado' && !liquidado;
          break;
        case 'pasado_liquidado':
          matchesEstado = status === 'Pasado' && liquidado;
          break;
      }
    }

    return matchesSearch && matchesEstado;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, estadoFilter]);

  const totalPages = Math.ceil(filteredEventos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedEventos = filteredEventos.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const calendarEvents: CalendarEvent[] = filteredEventos
    .map(evento => {
      const date = parseLocalDate(evento.fecha_evento);
      if (!date) return null;
      return {
        id: evento.id,
        title: evento.nombre_evento,
        start: date,
        end: date,
        resource: evento,
      };
    })
    .filter((e): e is CalendarEvent => e !== null);

  const eventStyleGetter = (event: CalendarEvent) => {
    const { status } = getEventStatus(event.resource.fecha_evento);
    const isLiquidado = event.resource.estado_liquidacion === "liquidado";

    // Default: pasado sin liquidar (muted warm)
    let backgroundColor = "hsl(38 14% 90%)";
    let borderColor = "hsl(30 20% 55%)";
    let textColor = "hsl(30 15% 30%)";

    if (status === "Hoy" || status === "Próximo") {
      backgroundColor = "hsl(82 28% 28%)"; // primary olive
      borderColor = "hsl(82 28% 22%)";
      textColor = "hsl(42 30% 96%)"; // paper
    }
    if (isLiquidado) {
      backgroundColor = "hsl(82 18% 50%)"; // sage muted
      borderColor = "hsl(82 18% 40%)";
      textColor = "hsl(42 30% 96%)";
    }

    return {
      style: {
        backgroundColor,
        borderLeft: `3px solid ${borderColor}`,
        borderRadius: "6px",
        color: textColor,
        fontSize: "12px",
        padding: "2px 6px",
      },
    };
  };

  const getIncompleteHints = (eventoId: string): string[] => {
    const cl = checklistMap[eventoId];
    if (!cl) return [];
    return cl.items.filter((i) => !i.completed).map((i) => i.label).slice(0, 2);
  };

  if (loading) {
    return (
      <PageSkeleton label="Cargando eventos..." />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Operación"
        title="Eventos"
        description={`${eventos.length} ${eventos.length === 1 ? "evento registrado" : "eventos registrados"} · agenda operativa del catering`}
      />

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
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 whitespace-nowrap">Estado:</span>
                <Select value={estadoFilter} onValueChange={(v) => setEstadoFilter(v as typeof estadoFilter)}>
                  <SelectTrigger className="w-full sm:w-56 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="proximo">Próximos</SelectItem>
                    <SelectItem value="hoy">Hoy</SelectItem>
                    <SelectItem value="pasado_pendiente">Pasados · pendientes de liquidar</SelectItem>
                    <SelectItem value="pasado_liquidado">Pasados · liquidados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={`h-8 ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm hover:bg-white' : 'text-slate-600 hover:bg-slate-200'}`}
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Tarjetas
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={`h-8 ${viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-sm hover:bg-white' : 'text-slate-600 hover:bg-slate-200'}`}
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
        <Card className="overflow-hidden">
          <div className="h-[620px] overflow-hidden bg-background">
            <style>{`
              .rbc-calendar {
                font-family: inherit;
              }
              .rbc-header {
                background: hsl(var(--muted) / 0.4);
                border-bottom: 1px solid hsl(var(--border));
                color: hsl(var(--muted-foreground));
                font-weight: 600;
                font-size: 11px;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                padding: 12px 8px;
              }
              .rbc-month-view, .rbc-time-view {
                border-color: hsl(var(--border));
              }
              .rbc-day-bg + .rbc-day-bg,
              .rbc-month-row + .rbc-month-row,
              .rbc-time-header-content,
              .rbc-time-content > * + * > * {
                border-color: hsl(var(--border));
              }
              .rbc-today {
                background-color: hsl(var(--primary) / 0.06);
              }
              .rbc-off-range-bg {
                background-color: hsl(var(--muted) / 0.3);
              }
              .rbc-off-range {
                color: hsl(var(--muted-foreground) / 0.5);
              }
              .rbc-event {
                font-size: 12px;
                font-weight: 500;
              }
              .rbc-event:hover {
                opacity: 0.85;
                cursor: pointer;
              }
              .rbc-date-cell {
                padding: 8px;
                color: hsl(var(--foreground));
              }
              .rbc-button-link {
                color: hsl(var(--foreground));
              }
              .rbc-show-more {
                color: hsl(var(--primary));
                font-weight: 500;
              }
              .rbc-toolbar button {
                color: hsl(var(--foreground));
                border-color: hsl(var(--border));
                border-radius: 6px;
              }
              .rbc-toolbar button:hover,
              .rbc-toolbar button:focus {
                background-color: hsl(var(--muted) / 0.5);
                border-color: hsl(var(--border));
              }
              .rbc-toolbar button.rbc-active,
              .rbc-toolbar button.rbc-active:hover {
                background-color: hsl(var(--primary));
                border-color: hsl(var(--primary));
                color: hsl(var(--primary-foreground));
              }
              .rbc-toolbar-label {
                font-family: var(--font-serif, serif);
                font-size: 17px;
                color: hsl(var(--foreground));
              }
            `}</style>
            <BigCalendar
              localizer={localizer}
              culture="es"
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
                showMore: (total) => `+ ${total} más`,
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
            <Card className="border-dashed">
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <Calendar
                  className="mb-3 h-10 w-10 text-muted-foreground/40"
                  strokeWidth={1.25}
                />
                <h3 className="font-serif text-lg text-foreground">
                  {eventos.length === 0 ? "No hay eventos registrados" : "Sin resultados"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {eventos.length === 0
                    ? "Los eventos se crean al aprobar una cotización."
                    : "Intenta con otros criterios de búsqueda."}
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
                        <div className="mb-3 flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-serif text-[17px] font-medium text-foreground transition-colors group-hover:text-primary">
                              {evento.nombre_evento}
                            </h3>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {(() => {
                                const d = parseLocalDate(evento.fecha_evento);
                                return d ? format(d, "EEE, d MMM yyyy", { locale: es }) : "Sin fecha";
                              })()}
                            </p>
                          </div>
                          <div className="ml-2 flex gap-1.5">
                            <Badge variant="outline" className={`font-normal ${variant}`}>
                              {status}
                            </Badge>
                            {evento.estado_liquidacion === "liquidado" && (
                              <Badge
                                variant="outline"
                                className="border-border bg-muted/40 font-normal text-muted-foreground"
                              >
                                Liquidado
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Info */}
                        <div className="mb-3 space-y-2">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <MapPin className="mr-2 h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                            <span className="truncate">{evento.ubicacion || "Sin ubicación"}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center text-muted-foreground">
                              <Users className="mr-2 h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                              <span>{evento.personal?.length || 0} empleados</span>
                            </div>
                            <div className="text-right">
                              <div className="kicker text-muted-foreground">Cotizado</div>
                              <div className="font-mono text-sm font-medium tabular-nums text-foreground">
                                ${(evento.costo_total || 0).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Progress bar */}
                        {cl && (
                          <div className="mb-3">
                            <div className="mb-1 flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">
                                {cl.completedCount}/{cl.totalCount} tareas
                              </span>
                              <span className="font-mono font-semibold tabular-nums text-foreground/80">
                                {cl.percent}%
                              </span>
                            </div>
                            <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted/70">
                              <div
                                className="h-full rounded-full bg-primary/80 transition-all"
                                style={{ width: `${cl.percent}%` }}
                              />
                            </div>
                            {hints.length > 0 && (
                              <p className="mt-1.5 truncate text-[11px] text-muted-foreground/70">
                                Falta: {hints.join(", ")}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div
                          className="flex items-center justify-between border-t border-border/60 pt-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => nav(`/eventos/${evento.id}`)}
                            className="h-8 text-muted-foreground hover:text-foreground"
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            Ver
                          </Button>

                          <div className="flex items-center gap-1">
                            {evento.estado_liquidacion !== "liquidado" && evento.personal.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleLiquidarEvento(evento)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                aria-label="Liquidar evento"
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
                <div className="mt-4 flex items-center justify-between">
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredEventos.length)} de{" "}
                    {filteredEventos.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 5) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                        return false;
                      })
                      .map((page, index, array) => (
                        <span key={page} className="flex items-center">
                          {index > 0 && array[index - 1] !== page - 1 && (
                            <span className="px-1 text-muted-foreground/60">…</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="h-8 w-8 p-0 font-mono tabular-nums"
                          >
                            {page}
                          </Button>
                        </span>
                      ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
