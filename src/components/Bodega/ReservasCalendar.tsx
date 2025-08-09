import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reservasCalendario, menajeDisponiblePorRango } from "@/integrations/supabase/apiMenaje";
import { MenajeReservaCal, MenajeDisponible } from "@/types/menaje";
import { Calendar as BigCalendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "moment/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Package, 
  Users, 
  Info,
  TrendingUp,
  AlertCircle
} from "lucide-react";

moment.locale("es");
const localizer = momentLocalizer(moment);

type CalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: MenajeReservaCal;
};

export default function ReservasCalendar() {
  const { toast } = useToast();
  const [range, setRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: start, to: end };
  });

  const fromStr = moment(range.from).format("YYYY-MM-DD");
  const toStr = moment(range.to).format("YYYY-MM-DD");

  const { data: reservas, isLoading } = useQuery({
    queryKey: ["bodega-cal", fromStr, toStr],
    queryFn: () => reservasCalendario(fromStr, toStr),
  });

  const events: CalEvent[] = useMemo(() => {
    return (reservas ?? []).map((r) => ({
      id: r.reserva_id,
      title: `${r.nombre_evento} • ${r.items.length} ítems`,
      start: new Date(r.fecha_inicio),
      end: new Date(r.fecha_fin),
      resource: r,
    }));
  }, [reservas]);

  // Estadísticas del período
  const stats = useMemo(() => {
    const totalReservas = reservas?.length ?? 0;
    const totalItems = reservas?.reduce((sum, r) => sum + r.items.length, 0) ?? 0;
    const eventosActivos = reservas?.filter(r => 
      moment(r.fecha_inicio).isSameOrBefore(moment()) && 
      moment(r.fecha_fin).isSameOrAfter(moment())
    ).length ?? 0;

    return { totalReservas, totalItems, eventosActivos };
  }, [reservas]);

  const onRangeChange = (r: any) => {
    if (Array.isArray(r)) {
      const from = r[0];
      const to = r[r.length - 1];
      setRange({ from, to });
    } else if (r.start && r.end) {
      setRange({ from: r.start, to: r.end });
    }
  };

  const onSelectEvent = async (e: CalEvent) => {
    try {
      const d = moment(e.start).format("YYYY-MM-DD");
      const list: MenajeDisponible[] = await menajeDisponiblePorRango(d, d);
      const comprometidos = list.filter((x) => x.reservado > 0).slice(0, 10);
      
      if (comprometidos.length > 0) {
        const msg = comprometidos.map((x) => `• ${x.nombre}: ${x.reservado} reservado (${x.disponible} disponible)`).join("\n");
        toast({ 
          title: `📅 ${e.resource.nombre_evento}`,
          description: `Elementos comprometidos:\n${msg}`
        });
      } else {
        toast({ 
          title: `📅 ${e.resource.nombre_evento}`,
          description: "Este evento no tiene compromisos relevantes de inventario."
        });
      }
    } catch (err: any) {
      toast({ 
        title: "Error al consultar disponibilidad", 
        description: err.message, 
        variant: "destructive" 
      });
    }
  };

  // Estilo personalizado para eventos
  const eventStyleGetter = (event: CalEvent) => {
    const itemCount = event.resource.items.length;
    let backgroundColor = '#3174ad';
    
    if (itemCount > 10) backgroundColor = '#f59e0b'; // Amber para muchos items
    if (itemCount > 20) backgroundColor = '#ef4444'; // Red para crítico
    
    return {
      style: {
        backgroundColor,
        borderRadius: '8px',
        opacity: 0.9,
        color: 'white',
        border: '0px',
        display: 'block',
        fontSize: '12px',
        padding: '2px 8px'
      }
    };
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas del período */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-xl">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-800">{stats.totalReservas}</div>
                <div className="text-sm text-blue-600">Reservas en el período</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-emerald-50 to-green-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500 rounded-xl">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-800">{stats.eventosActivos}</div>
                <div className="text-sm text-emerald-600">Eventos activos hoy</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-violet-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500 rounded-xl">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-800">{stats.totalItems}</div>
                <div className="text-sm text-purple-600">Elementos reservados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leyenda de colores */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Info className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Leyenda de eventos:</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded" />
                <span className="text-xs text-slate-600">1-10 elementos</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-amber-500 rounded" />
                <span className="text-xs text-slate-600">11-20 elementos</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded" />
                <span className="text-xs text-slate-600">20+ elementos</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendario */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-slate-800">
              <CalendarIcon className="h-5 w-5" />
              <span>Calendario de Reservas</span>
            </CardTitle>

            <div className="flex items-center space-x-2">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                {moment(range.from).format("MMM YYYY")}
              </Badge>
              {isLoading && (
                <div className="flex items-center space-x-2 text-sm text-slate-500">
                  <div className="animate-spin w-4 h-4 border-2 border-slate-300 border-t-slate-500 rounded-full" />
                  <span>Cargando...</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="h-[600px] bg-white overflow-hidden">
            <style>{`
              .rbc-calendar {
                font-family: inherit;
              }
              .rbc-header {
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
                color: #475569;
                font-weight: 600;
                padding: 12px 8px;
              }
              .rbc-today {
                background-color: #f0f9ff;
              }
              .rbc-off-range-bg {
                background-color: #f8fafc;
              }
              .rbc-event {
                font-size: 12px;
                font-weight: 500;
              }
              .rbc-event:hover {
                opacity: 0.8;
                cursor: pointer;
              }
              .rbc-date-cell {
                padding: 8px;
              }
              .rbc-button-link {
                color: #475569;
              }
              .rbc-show-more {
                color: #3b82f6;
                font-weight: 500;
              }
            `}</style>
            
            <BigCalendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
              defaultView={Views.MONTH}
              onRangeChange={onRangeChange}
              onSelectEvent={onSelectEvent}
              eventPropGetter={eventStyleGetter}
              popup
              popupOffset={{ x: 10, y: 10 }}
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
                noEventsInRange: "No hay eventos en este rango de fechas",
                showMore: (total) => `+${total} más`
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Información adicional */}
      {!isLoading && reservas && reservas.length === 0 && (
        <Card className="bg-gradient-to-r from-amber-50 to-orange-100 border-amber-200">
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center space-y-3">
              <AlertCircle className="h-12 w-12 text-amber-500" />
              <div>
                <h3 className="font-medium text-amber-800">No hay reservas en este período</h3>
                <p className="text-sm text-amber-600 mt-1">
                  Selecciona un rango diferente o verifica que existan eventos programados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}