import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { reservasCalendario } from "@/integrations/supabase/apiMenaje";
import { MenajeReservaCal } from "@/types/menaje";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Clock,
  Package,
  Info,
  AlertCircle
} from "lucide-react";
import ReservaDetalleDialog from "./ReservaDetalleDialog";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { es },
});

type CalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: MenajeReservaCal;
};

export default function ReservasCalendar() {
  const qc = useQueryClient();
  const [range, setRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: start, to: end };
  });

  const [selectedReserva, setSelectedReserva] = useState<MenajeReservaCal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fromStr = format(range.from, "yyyy-MM-dd");
  const toStr = format(range.to, "yyyy-MM-dd");

  const { data: reservas, isLoading } = useQuery({
    queryKey: ["bodega-cal", fromStr, toStr],
    queryFn: () => reservasCalendario(fromStr, toStr),
  });

  const events: CalEvent[] = useMemo(() => {
    return (reservas ?? []).map((r) => ({
      id: r.reserva_id,
      title: `${r.nombre_evento} • ${r.items.length} items`,
      start: new Date(r.fecha_inicio),
      end: new Date(r.fecha_fin),
      resource: r,
    }));
  }, [reservas]);

  // Stats
  const stats = useMemo(() => {
    const totalReservas = reservas?.length ?? 0;
    const totalItems = reservas?.reduce((sum, r) => sum + r.items.length, 0) ?? 0;
    const now = new Date();
    const eventosActivos = reservas?.filter(r =>
      new Date(r.fecha_inicio) <= now && new Date(r.fecha_fin) >= now
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

  const onSelectEvent = (e: CalEvent) => {
    setSelectedReserva(e.resource);
    setDialogOpen(true);
  };

  // Color by estado
  const eventStyleGetter = (event: CalEvent) => {
    const estado = event.resource.estado;
    let backgroundColor: string;

    switch (estado) {
      case "confirmado":
        backgroundColor = "#3b82f6"; // blue
        break;
      case "devuelto":
        backgroundColor = "#10b981"; // green
        break;
      default:
        backgroundColor = "#94a3b8"; // slate/gray for borrador
    }

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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-800">{stats.totalReservas}</div>
                <div className="text-sm text-blue-600">Reservas en el periodo</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Clock className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-800">{stats.eventosActivos}</div>
                <div className="text-sm text-emerald-600">Eventos activos hoy</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-800">{stats.totalItems}</div>
                <div className="text-sm text-purple-600">Elementos reservados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legend by estado */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Info className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Leyenda de estados:</span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-slate-400 rounded" />
                <span className="text-xs text-slate-600">Borrador</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded" />
                <span className="text-xs text-slate-600">Confirmado</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-emerald-500 rounded" />
                <span className="text-xs text-slate-600">Devuelto</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-slate-800">
              <CalendarIcon className="h-5 w-5" />
              <span>Calendario de Reservas</span>
            </CardTitle>

            <div className="flex items-center space-x-2">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                {format(range.from, "MMM yyyy", { locale: es })}
              </Badge>
              {isLoading && (
                <div className="flex items-center space-x-2 text-sm text-slate-500">
                  <div className="animate-spin w-4 h-4 border-2 border-slate-200 border-t-selecta-green rounded-full" />
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
              culture="es"
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
                showMore: (total) => `+${total} mas`
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!isLoading && reservas && reservas.length === 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6 text-center">
            <div className="flex flex-col items-center space-y-3">
              <AlertCircle className="h-12 w-12 text-amber-500" />
              <div>
                <h3 className="font-medium text-amber-800">No hay reservas en este periodo</h3>
                <p className="text-sm text-amber-600 mt-1">
                  Selecciona un rango diferente o verifica que existan eventos programados
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reserva detail dialog */}
      {selectedReserva && (
        <ReservaDetalleDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          reservaCal={selectedReserva}
          onUpdated={() => qc.invalidateQueries({ queryKey: ["bodega-cal"] })}
        />
      )}
    </div>
  );
}
