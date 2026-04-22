import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  Search,
  UserPlus,
  Eye,
  Mail,
  MessageSquare,
  FileText,
  CalendarOff,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal, Personal } from "@/types/database";
import { parseLocalDate, formatLocalDate } from "@/lib/dateLocal";
import { PanelHeader } from "@/components/Layout/PageHeader";
import { cn } from "@/lib/utils";

type EstadoEvento = "sin-personal" | "sin-horarios" | "completo";

const ESTADO_LABEL: Record<EstadoEvento, string> = {
  "sin-personal": "Sin personal",
  "sin-horarios": "Sin horarios",
  completo: "Listo",
};

export function ProximosEventos() {
  const [eventos, setEventos] = useState<EventoConPersonal[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTiempo, setFiltroTiempo] = useState("proximos-7");
  const [filtroEmpleado, setFiltroEmpleado] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<Personal | null>(null);
  const [eventosEmpleado, setEventosEmpleado] = useState<EventoConPersonal[]>([]);
  const [isModalEmpleadoOpen, setIsModalEmpleadoOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const cargarDatos = useCallback(async () => {
    try {
      const { data: personalData } = await supabase
        .from("personal")
        .select("*")
        .order("nombre_completo");

      const hoy = new Date();
      const fechaFin = new Date();

      switch (filtroTiempo) {
        case "proximos-3":
          fechaFin.setDate(hoy.getDate() + 3);
          break;
        case "proximos-7":
          fechaFin.setDate(hoy.getDate() + 7);
          break;
        case "proximos-30":
          fechaFin.setDate(hoy.getDate() + 30);
          break;
        default:
          fechaFin.setFullYear(hoy.getFullYear() + 1);
      }

      const { data: eventosData } = await supabase
        .from("eventos")
        .select(
          `
          *,
          evento_personal(
            *,
            personal(*)
          )
        `
        )
        .gte("fecha_evento", hoy.toISOString().split("T")[0])
        .lte("fecha_evento", fechaFin.toISOString().split("T")[0])
        .order("fecha_evento", { ascending: true });

      const eventosTransformados =
        eventosData?.map((evento) => ({
          ...evento,
          personal:
            evento.evento_personal?.map((ep) => ({
              ...ep.personal,
              ...ep,
              evento_personal_id: ep.id,
            })) || [],
        })) || [];

      setPersonal((personalData as Personal[]) || []);
      setEventos(eventosTransformados as EventoConPersonal[]);
    } catch (error) {
      console.error("Error cargando datos:", error);
      toast({
        title: "Error",
        description: (error as Error)?.message ?? "Error al cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [filtroTiempo, toast]);

  const cargarEventosEmpleado = useCallback(async () => {
    if (!empleadoSeleccionado) return;

    try {
      const fechaFin = new Date();
      fechaFin.setDate(fechaFin.getDate() + 30);

      const { data } = await supabase
        .from("eventos")
        .select(
          `
          *,
          evento_personal!inner(
            *,
            personal(*)
          )
        `
        )
        .eq("evento_personal.personal_id", empleadoSeleccionado.id)
        .gte("fecha_evento", new Date().toISOString().split("T")[0])
        .lte("fecha_evento", fechaFin.toISOString().split("T")[0])
        .order("fecha_evento", { ascending: true });

      const eventosTransformados =
        data?.map((evento) => ({
          ...evento,
          personal:
            evento.evento_personal?.map((ep) => ({
              ...ep.personal,
              ...ep,
              evento_personal_id: ep.id,
            })) || [],
        })) || [];

      setEventosEmpleado(eventosTransformados as EventoConPersonal[]);
    } catch (error) {
      console.error("Error cargando eventos del empleado:", error);
    }
  }, [empleadoSeleccionado]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (empleadoSeleccionado) cargarEventosEmpleado();
  }, [empleadoSeleccionado, cargarEventosEmpleado]);

  const getEstadoEvento = (evento: EventoConPersonal): EstadoEvento => {
    const personalAsignado = evento.personal?.length || 0;
    if (personalAsignado === 0) return "sin-personal";
    const sinHorarios = evento.personal?.filter((p) => !p.hora_inicio || !p.hora_fin).length || 0;
    if (sinHorarios > 0) return "sin-horarios";
    return "completo";
  };

  const eventosFiltrados = eventos.filter((evento) => {
    if (filtroEmpleado !== "todos") {
      const tieneEmpleado = evento.personal?.some((p) => p.id === filtroEmpleado);
      if (!tieneEmpleado) return false;
    }
    if (filtroEstado !== "todos") {
      const estado = getEstadoEvento(evento);
      if (estado !== filtroEstado) return false;
    }
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      const coincide =
        evento.nombre_evento.toLowerCase().includes(termino) ||
        evento.ubicacion.toLowerCase().includes(termino) ||
        evento.personal?.some((p) => p.nombre_completo.toLowerCase().includes(termino));
      if (!coincide) return false;
    }
    return true;
  });

  const generarMensajeWhatsApp = (empleado: Personal) => {
    if (eventosEmpleado.length === 0) return;

    const mensaje =
      `Hola ${empleado.nombre_completo}, tu cronograma para los próximos eventos:\n\n` +
      eventosEmpleado
        .map((evento) => {
          const fecha = formatLocalDate(evento.fecha_evento, "es-CO", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          const personal = evento.personal?.find((p) => p.id === empleado.id);
          const horario =
            personal?.hora_inicio && personal?.hora_fin
              ? `${personal.hora_inicio}-${personal.hora_fin}`
              : "Horario por confirmar";
          return `· ${fecha.charAt(0).toUpperCase() + fecha.slice(1)} — ${evento.nombre_evento} (${evento.ubicacion}) ${horario}`;
        })
        .join("\n") +
      `\n\nTotal eventos: ${eventosEmpleado.length}`;

    navigator.clipboard.writeText(mensaje);
    toast({
      title: "Mensaje copiado",
      description: "Cronograma listo para enviar por WhatsApp",
    });
  };

  const stats = {
    total: eventosFiltrados.length,
    sinPersonal: eventosFiltrados.filter((e) => getEstadoEvento(e) === "sin-personal").length,
    sinHorarios: eventosFiltrados.filter((e) => getEstadoEvento(e) === "sin-horarios").length,
    completos: eventosFiltrados.filter((e) => getEstadoEvento(e) === "completo").length,
  };

  if (loading) {
    return (
      <div className="p-6">
        <PanelHeader kicker="Agenda" title="Próximos eventos" description="Cargando…" />
        <div className="mt-6 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-md bg-muted/70" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PanelHeader
        kicker="Agenda"
        title="Próximos eventos"
        description="Seguimiento de los servicios programados"
      />

      {/* Filtros */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="relative md:col-span-5">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <Input
            placeholder="Buscar evento, ubicación o empleado…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-10 pl-9 text-[13px]"
          />
        </div>
        <div className="md:col-span-3">
          <Select value={filtroTiempo} onValueChange={setFiltroTiempo}>
            <SelectTrigger className="h-10 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proximos-3">Próximos 3 días</SelectItem>
              <SelectItem value="proximos-7">Próximos 7 días</SelectItem>
              <SelectItem value="proximos-30">Próximos 30 días</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger className="h-10 text-[13px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="sin-personal">Sin personal</SelectItem>
              <SelectItem value="sin-horarios">Sin horarios</SelectItem>
              <SelectItem value="completo">Listos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Select value={filtroEmpleado} onValueChange={setFiltroEmpleado}>
            <SelectTrigger className="h-10 text-[13px]">
              <SelectValue placeholder="Empleado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {personal.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtroEmpleado !== "todos" && (
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-[12px] text-primary hover:bg-accent"
            onClick={() => {
              const empleado = personal.find((p) => p.id === filtroEmpleado);
              if (empleado) {
                setEmpleadoSeleccionado(empleado);
                setIsModalEmpleadoOpen(true);
              }
            }}
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
            Ver cronograma completo del empleado
          </Button>
        </div>
      )}

      {/* Eventos */}
      {eventosFiltrados.length === 0 ? (
        <div className="mt-10 flex flex-col items-center py-12 text-center">
          <CalendarOff className="mb-4 h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="font-serif text-[20px] tracking-tight text-foreground">
            {eventos.length === 0 ? "Aún no hay eventos" : "Sin resultados"}
          </p>
          <p className="mt-1 max-w-[40ch] text-[12.5px] text-muted-foreground">
            {eventos.length === 0
              ? "Cuando se programen eventos, aparecerán aquí con su estado y personal asignado."
              : "Ajustar los filtros para encontrar los eventos buscados."}
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-md border border-border">
          <ul className="divide-y divide-border">
            {eventosFiltrados.map((evento) => (
              <EventoRow
                key={evento.id}
                evento={evento}
                estado={getEstadoEvento(evento)}
                onVer={() => navigate(`/eventos/${evento.id}`)}
                onAsignar={() => navigate(`/eventos/${evento.id}`)}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Footer stats */}
      {eventosFiltrados.length > 0 && (
        <div className="mt-6 grid grid-cols-4 gap-6 border-t border-border pt-5">
          <FooterStat label="Total" value={stats.total} />
          <FooterStat label="Sin personal" value={stats.sinPersonal} tone={stats.sinPersonal > 0 ? "destructive" : "neutral"} />
          <FooterStat label="Sin horarios" value={stats.sinHorarios} />
          <FooterStat label="Listos" value={stats.completos} tone="primary" />
        </div>
      )}

      {/* Modal cronograma empleado */}
      <Dialog open={isModalEmpleadoOpen} onOpenChange={setIsModalEmpleadoOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <span className="kicker">Cronograma</span>
            <DialogTitle className="font-serif text-[26px] font-normal tracking-tight">
              {empleadoSeleccionado?.nombre_completo}
            </DialogTitle>
            <DialogDescription>
              {empleadoSeleccionado?.rol} · Próximos 30 días
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {eventosEmpleado.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} />
                <p className="font-serif text-[17px] text-foreground">Sin eventos asignados</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  No hay servicios programados en los próximos 30 días.
                </p>
              </div>
            ) : (
              <>
                <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border">
                  {eventosEmpleado.map((evento) => {
                    const personalData = evento.personal?.find(
                      (p) => p.id === empleadoSeleccionado?.id
                    );
                    const horario =
                      personalData?.hora_inicio && personalData?.hora_fin
                        ? `${personalData.hora_inicio}–${personalData.hora_fin}`
                        : "Por confirmar";

                    return (
                      <li key={evento.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-serif text-[15px] tracking-tight text-foreground">
                            {evento.nombre_evento}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                            <MapPin className="h-3 w-3" strokeWidth={1.75} />
                            <span className="truncate">{evento.ubicacion}</span>
                          </div>
                          <div className="mt-0.5 text-[11.5px] capitalize text-muted-foreground">
                            {formatLocalDate(evento.fecha_evento, "es-CO", {
                              weekday: "long",
                              day: "numeric",
                              month: "long",
                            })}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] tabular-nums text-foreground">
                            <Clock className="h-3 w-3" strokeWidth={1.75} />
                            {horario}
                          </div>
                          {personalData?.horas_trabajadas ? (
                            <div className="mt-1 text-[10.5px] tabular-nums text-muted-foreground">
                              {personalData.horas_trabajadas}h trabajadas
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="grid grid-cols-2 gap-6 border-t border-border pt-4">
                  <FooterStat label="Eventos asignados" value={eventosEmpleado.length} tone="primary" />
                  <FooterStat
                    label="Total horas"
                    value={eventosEmpleado.reduce((sum, ev) => {
                      const pd = ev.personal?.find((p) => p.id === empleadoSeleccionado?.id);
                      return sum + (pd?.horas_trabajadas || 0);
                    }, 0)}
                    tone="primary"
                    suffix="h"
                  />
                </div>

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      toast({
                        title: "Función en desarrollo",
                        description: "El envío por email estará disponible pronto",
                      })
                    }
                  >
                    <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Enviar por email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => empleadoSeleccionado && generarMensajeWhatsApp(empleadoSeleccionado)}
                  >
                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Copiar para WhatsApp
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      toast({
                        title: "Función en desarrollo",
                        description: "La exportación PDF estará disponible pronto",
                      })
                    }
                  >
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Exportar PDF
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventoRow({
  evento,
  estado,
  onVer,
  onAsignar,
}: {
  evento: EventoConPersonal;
  estado: EstadoEvento;
  onVer: () => void;
  onAsignar: () => void;
}) {
  const personalAsignado = evento.personal?.length || 0;
  const dia = formatLocalDate(evento.fecha_evento, "es-CO", {
    day: "2-digit",
    month: "2-digit",
  });
  const weekday = formatLocalDate(evento.fecha_evento, "es-CO", { weekday: "short" });

  const estadoStyles =
    estado === "completo"
      ? "border-primary/30 bg-primary/10 text-primary"
      : estado === "sin-personal"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-[hsl(30_55%_42%/0.3)] bg-[hsl(30_55%_42%/0.1)] text-[hsl(30_55%_30%)]";

  return (
    <li className="group flex items-start gap-5 px-4 py-4 transition-colors hover:bg-muted/40">
      {/* Date cell */}
      <div className="w-14 shrink-0 border-r border-border pr-4 text-right">
        <div className="font-serif text-[22px] leading-none tracking-tight tabular-nums text-foreground">
          {dia}
        </div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          {weekday.replace(".", "")}
        </div>
      </div>

      {/* Event info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-serif text-[17px] tracking-tight text-foreground">
              {evento.nombre_evento}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{evento.ubicacion}</span>
            </div>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]",
              estadoStyles
            )}
          >
            {ESTADO_LABEL[estado]}
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <div className="text-[12px] text-muted-foreground">
            {personalAsignado === 0 ? (
              <span className="text-destructive">Sin personal asignado</span>
            ) : (
              <span>
                <span className="tabular-nums font-medium text-foreground">{personalAsignado}</span>{" "}
                {personalAsignado === 1 ? "empleado" : "empleados"}
                {evento.personal?.slice(0, 2).map((p, i) => (
                  <span key={p.id} className="text-muted-foreground">
                    {i === 0 ? " · " : ", "}
                    {p.nombre_completo?.split(" ")[0]}
                  </span>
                ))}
                {personalAsignado > 2 && (
                  <span className="text-muted-foreground"> +{personalAsignado - 2}</span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {estado === "sin-personal" && (
              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11.5px]" onClick={onAsignar}>
                <UserPlus className="h-3 w-3" strokeWidth={1.75} />
                Asignar
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11.5px]" onClick={onVer}>
              <Eye className="h-3 w-3" strokeWidth={1.75} />
              Ver
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

function FooterStat({
  label,
  value,
  tone = "neutral",
  suffix,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "primary" | "destructive";
  suffix?: string;
}) {
  return (
    <div>
      <div
        className={cn(
          "font-serif text-2xl tracking-tight tabular-nums",
          tone === "primary" && "text-primary",
          tone === "destructive" && value > 0 && "text-destructive",
          tone === "neutral" && "text-foreground"
        )}
      >
        {value}
        {suffix && <span className="text-lg text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
