import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { reservasCalendario } from "@/integrations/supabase/apiMenaje";
import { MenajeReservaCal } from "@/types/menaje";
import { Calendar as BigCalendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import ReservaDetalleDialog from "./ReservaDetalleDialog";
import { KPI } from "@/components/Layout/PageHeader";

const localizer = dateFnsLocalizer({
  format,
  parse,
  // startOfWeek debe respetar la fecha que recibe (NO usar new Date());
  // si no, el grid del calendario muestra los eventos en columna equivocada.
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
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

  const onRangeChange = (r) => {
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

  // Color by estado — paleta olive editorial
  const eventStyleGetter = (event: CalEvent) => {
    const estado = event.resource.estado;
    let backgroundColor: string;

    switch (estado) {
      case "confirmado":
        backgroundColor = "hsl(82 28% 28%)"; // primary olive
        break;
      case "devuelto":
        backgroundColor = "hsl(82 18% 50%)"; // sage muted
        break;
      default:
        backgroundColor = "hsl(30 20% 55%)"; // warm neutral for borrador
    }

    return {
      style: {
        backgroundColor,
        borderRadius: "6px",
        opacity: 0.95,
        color: "white",
        border: "0px",
        display: "block",
        fontSize: "12px",
        padding: "2px 8px",
      },
    };
  };

  return (
    <div className="space-y-6">
      {/* KPIs editoriales */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-y border-border py-6 md:grid-cols-3">
        <KPI kicker="Reservas en el periodo" value={stats.totalReservas} />
        <KPI
          kicker="Eventos activos hoy"
          value={stats.eventosActivos}
          tone={stats.eventosActivos > 0 ? "primary" : "neutral"}
        />
        <KPI kicker="Elementos reservados" value={stats.totalItems} />
      </div>

      {/* Leyenda inline */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px]">
        <span className="kicker text-muted-foreground">Estados</span>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-[hsl(30_20%_55%)]" />
          <span className="text-muted-foreground">Borrador</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-primary" />
          <span className="text-muted-foreground">Confirmado</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-[hsl(82_18%_50%)]" />
          <span className="text-muted-foreground">Devuelto</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="font-mono tabular-nums text-muted-foreground">
            {format(range.from, "MMM yyyy", { locale: es })}
          </span>
          {isLoading && <span className="text-muted-foreground">Cargando…</span>}
        </div>
      </div>

      {/* Calendario */}
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
                showMore: (total) => `+${total} mas`,
              }}
            />
        </div>
      </Card>

      {/* Empty state */}
      {!isLoading && reservas && reservas.length === 0 && (
        <Card className="border-dashed">
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle
              className="h-10 w-10 text-muted-foreground/50"
              strokeWidth={1.25}
            />
            <div>
              <h3 className="font-serif text-lg text-foreground">
                No hay reservas en este periodo
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Selecciona un rango diferente o verifica que existan eventos programados.
              </p>
            </div>
          </div>
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
