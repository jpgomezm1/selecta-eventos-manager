import { MapPin, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { parseLocalDate } from "@/lib/dateLocal";
import type { EventoProduccion } from "@/integrations/supabase/apiCocina";
import PlatoExpandibleRow from "./PlatoExpandibleRow";

interface Props {
  evento: EventoProduccion;
  onOpenPlato: (platoId: string, cantidad: number, nombre: string) => void;
}

export default function EventoProduccionCard({ evento, onOpenPlato }: Props) {
  const fecha = parseLocalDate(evento.fecha_evento);
  const fechaLabel = fecha ? format(fecha, "EEEE d 'de' MMMM", { locale: es }) : evento.fecha_evento;
  const totalPlatos = evento.platos.reduce((sum, p) => sum + p.cantidad, 0);

  return (
    <article className="rounded-lg border border-border bg-card shadow-soft">
      <header className="flex flex-col gap-2 border-b border-border/70 px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <h3 className="font-serif text-[20px] leading-tight text-foreground">{evento.nombre_evento}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="capitalize">{fechaLabel}</span>
            </span>
            {evento.ubicacion && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
                {evento.ubicacion}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="kicker">A preparar</div>
          <div className="font-serif text-[22px] tabular-nums text-foreground">{totalPlatos}</div>
        </div>
      </header>

      <div className="space-y-1.5 p-3">
        {evento.platos.length === 0 ? (
          <p className="px-2 py-3 text-center text-[12.5px] italic text-muted-foreground">
            Sin platos asignados a este evento.
          </p>
        ) : (
          evento.platos.map((p) => (
            <PlatoExpandibleRow
              key={p.req_id}
              nombre={p.nombre}
              cantidad={p.cantidad}
              tiempoPreparacion={p.tiempo_preparacion}
              onOpen={() => onOpenPlato(p.plato_id, p.cantidad, p.nombre)}
            />
          ))
        )}
      </div>
    </article>
  );
}
