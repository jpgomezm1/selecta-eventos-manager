import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reservasCalendario, menajeDisponiblePorRango } from "@/integrations/supabase/apiMenaje";
import { MenajeReservaCal, MenajeDisponible } from "@/types/menaje";
import { Calendar as BigCalendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "moment/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

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
    // Vista rápida de disponibilidad ese día
    try {
      const d = moment(e.start).format("YYYY-MM-DD");
      const list: MenajeDisponible[] = await menajeDisponiblePorRango(d, d);
      const comprometidos = list.filter((x) => x.reservado > 0).slice(0, 10);
      const msg = comprometidos.length
        ? comprometidos.map((x) => `• ${x.nombre}: ${x.reservado} (disp. ${x.disponible})`).join("\n")
        : "Sin compromisos relevantes";
      toast({ title: e.resource.nombre_evento, description: msg });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="p-2">
      <div className="h-[600px] bg-white rounded-xl overflow-hidden">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
          defaultView={Views.MONTH}
          onRangeChange={onRangeChange}
          onSelectEvent={onSelectEvent}
          popup
        />
      </div>
      {isLoading && <div className="p-4 text-sm text-slate-500">Cargando reservas…</div>}
    </Card>
  );
}
