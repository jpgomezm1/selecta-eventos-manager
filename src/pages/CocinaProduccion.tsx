import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, addWeeks, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, LayoutList, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/Layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getProduccionPorRango } from "@/integrations/supabase/apiCocina";
import EventoProduccionCard from "@/components/Cocina/EventoProduccionCard";
import PlatosConsolidadosTable from "@/components/Cocina/PlatosConsolidadosTable";
import RecetaEscaladaSheet from "@/components/Cocina/RecetaEscaladaSheet";

type Rango = "dia" | "semana";
type Vista = "por_evento" | "consolidado";

interface SheetState {
  open: boolean;
  platoId: string | null;
  cantidad: number;
  nombre: string;
}

export default function CocinaProduccionPage() {
  const [rango, setRango] = useState<Rango>("dia");
  const [vista, setVista] = useState<Vista>("por_evento");
  const [fecha, setFecha] = useState<Date>(() => new Date());
  const [sheet, setSheet] = useState<SheetState>({ open: false, platoId: null, cantidad: 0, nombre: "" });

  const { fechaInicio, fechaFin, label } = useMemo(() => {
    if (rango === "dia") {
      const ymd = format(fecha, "yyyy-MM-dd");
      const hoy = isSameDay(fecha, new Date());
      const lbl = hoy
        ? `Hoy · ${format(fecha, "EEEE d 'de' MMMM", { locale: es })}`
        : format(fecha, "EEEE d 'de' MMMM", { locale: es });
      return { fechaInicio: ymd, fechaFin: ymd, label: lbl };
    }
    const ini = startOfWeek(fecha, { weekStartsOn: 1 });
    const fin = endOfWeek(fecha, { weekStartsOn: 1 });
    return {
      fechaInicio: format(ini, "yyyy-MM-dd"),
      fechaFin: format(fin, "yyyy-MM-dd"),
      label: `Semana del ${format(ini, "d MMM", { locale: es })} al ${format(fin, "d MMM", { locale: es })}`,
    };
  }, [fecha, rango]);

  const { data: eventos, isLoading, error } = useQuery({
    queryKey: ["cocina-produccion", fechaInicio, fechaFin],
    queryFn: () => getProduccionPorRango(fechaInicio, fechaFin),
  });

  const handlePrev = () => setFecha((d) => (rango === "dia" ? addDays(d, -1) : addWeeks(d, -1)));
  const handleNext = () => setFecha((d) => (rango === "dia" ? addDays(d, 1) : addWeeks(d, 1)));
  const handleHoy = () => setFecha(new Date());

  const totalEventos = eventos?.length ?? 0;
  const totalPlatos = useMemo(
    () => (eventos ?? []).reduce((sum, ev) => sum + ev.platos.reduce((s, p) => s + p.cantidad, 0), 0),
    [eventos]
  );

  const openPlato = (platoId: string, cantidad: number, nombre: string) =>
    setSheet({ open: true, platoId, cantidad, nombre });
  const closeSheet = (open: boolean) => setSheet((s) => ({ ...s, open }));

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Cocina"
        title="Producción"
        description="Platos a preparar para los próximos eventos. Seleccioná día o semana para ver qué hay que cocinar."
        actions={
          <ToggleGroup
            type="single"
            value={vista}
            onValueChange={(v) => v && setVista(v as Vista)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="por_evento" aria-label="Vista por evento">
              <LayoutList className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
              Por evento
            </ToggleGroupItem>
            <ToggleGroupItem value="consolidado" aria-label="Vista consolidada">
              <ListChecks className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
              Consolidado
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      {/* Toolbar: rango + navegación */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ToggleGroup
          type="single"
          value={rango}
          onValueChange={(v) => v && setRango(v as Rango)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="dia">Día</ToggleGroupItem>
          <ToggleGroupItem value="semana">Semana</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handlePrev} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <div className="min-w-[220px] text-center text-[13px] font-medium capitalize text-foreground">
            {label}
          </div>
          <Button variant="ghost" size="sm" onClick={handleNext} aria-label="Siguiente">
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <Button variant="outline" size="sm" onClick={handleHoy}>
            Hoy
          </Button>
        </div>
      </div>

      {/* Resumen */}
      {!isLoading && !error && totalEventos > 0 && (
        <div className="flex gap-8 border-y border-border/70 py-4">
          <div>
            <div className="kicker">Eventos</div>
            <div className="font-serif text-[24px] tabular-nums">{totalEventos}</div>
          </div>
          <div>
            <div className="kicker">Platos a preparar</div>
            <div className="font-serif text-[24px] tabular-nums">{totalPlatos}</div>
          </div>
        </div>
      )}

      {/* Cuerpo */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted/70" />
          <p className="text-sm italic text-muted-foreground">Cargando producción…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-8 text-center">
          <p className="text-[13px] text-destructive">
            No se pudo cargar la producción: {(error as Error).message}
          </p>
        </div>
      ) : !eventos || eventos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="font-serif text-[20px] text-foreground">Sin eventos en este rango</p>
          <p className="mt-2 text-[13px] italic text-muted-foreground">
            {rango === "dia" ? "No hay eventos para esta fecha." : "No hay eventos en esta semana."}
          </p>
        </div>
      ) : vista === "por_evento" ? (
        <div className="grid gap-5 md:grid-cols-2">
          {eventos.map((ev) => (
            <EventoProduccionCard key={ev.id} evento={ev} onOpenPlato={openPlato} />
          ))}
        </div>
      ) : (
        <PlatosConsolidadosTable eventos={eventos} onOpenPlato={openPlato} />
      )}

      <RecetaEscaladaSheet
        open={sheet.open}
        onOpenChange={closeSheet}
        platoId={sheet.platoId}
        cantidad={sheet.cantidad}
        nombre={sheet.nombre}
      />
    </div>
  );
}
