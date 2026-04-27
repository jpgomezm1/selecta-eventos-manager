import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Info, CheckCircle, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseLocalDate } from "@/lib/dateLocal";
import { PanelHeader } from "@/components/Layout/PageHeader";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type Severidad = "urgente" | "atencion" | "informacion";

interface Alerta {
  id: string;
  tipo: Severidad;
  mensaje: string;
  accion?: string;
  eventoId?: string;
  personalId?: string;
}

const SEV_ORDER: Severidad[] = ["urgente", "atencion", "informacion"];
const SEV_LABEL: Record<Severidad, string> = {
  urgente: "Urgente",
  atencion: "Atención",
  informacion: "Informativo",
};

export function AlertasPanel() {
  const { roles } = useAuth();
  const canSeeOpsAlerts = roles.includes("admin") || roles.includes("operaciones");
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!canSeeOpsAlerts) {
      setAlertas([]);
      setLoading(false);
      return;
    }
    generarAlertas();
  }, [canSeeOpsAlerts]);

  const generarAlertas = async () => {
    try {
      const alertasGeneradas: Alerta[] = [];

      const { data: eventosProximos } = await supabase
        .from("eventos")
        .select(
          `
          *,
          evento_personal(
            personal_id,
            hora_inicio,
            hora_fin,
            personal(nombre_completo, rol)
          )
        `
        )
        .gte("fecha_evento", new Date().toISOString().split("T")[0])
        .order("fecha_evento", { ascending: true });

      const { data: pagosPendientes } = await supabase
        .from("evento_personal")
        .select(
          `
          *,
          personal(nombre_completo),
          eventos(nombre_evento, fecha_evento)
        `
        )
        .eq("estado_pago", "pendiente");

      if (eventosProximos) {
        for (const evento of eventosProximos) {
          const fechaEvento = parseLocalDate(evento.fecha_evento) ?? new Date();
          const hoy = new Date();
          const diasRestantes = Math.ceil(
            (fechaEvento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (diasRestantes <= 2 && evento.evento_personal.length === 0) {
            alertasGeneradas.push({
              id: `urgente-sin-personal-${evento.id}`,
              tipo: "urgente",
              mensaje: `${evento.nombre_evento} ${
                diasRestantes === 0 ? "es hoy" : diasRestantes === 1 ? "es mañana" : "en 2 días"
              } y no tiene personal asignado`,
              accion: "asignar-personal",
              eventoId: evento.id,
            });
          }

          const personalEventos = evento.evento_personal;
          for (const pe of personalEventos) {
            const { data: conflictos } = await supabase
              .from("evento_personal")
              .select(`*, evento(nombre_evento, fecha_evento)`)
              .eq("personal_id", pe.personal_id)
              .eq("evento.fecha_evento", evento.fecha_evento)
              .neq("evento_id", evento.id);

            if (conflictos && conflictos.length > 0) {
              alertasGeneradas.push({
                id: `conflicto-${pe.personal_id}-${evento.id}`,
                tipo: "urgente",
                mensaje: `${pe.personal.nombre_completo} tiene múltiples eventos el ${fechaEvento.toLocaleDateString("es-CO")}`,
                accion: "resolver-conflicto",
                personalId: pe.personal_id,
              });
            }
          }

          if (diasRestantes <= 7 && diasRestantes > 2 && evento.evento_personal.length === 0) {
            alertasGeneradas.push({
              id: `atencion-sin-personal-${evento.id}`,
              tipo: "atencion",
              mensaje: `${evento.nombre_evento} en ${diasRestantes} días sin personal asignado`,
              accion: "asignar-personal",
              eventoId: evento.id,
            });
          }

          const sinHorarios = evento.evento_personal.filter(
            (ep) => !ep.hora_inicio || !ep.hora_fin
          );
          if (sinHorarios.length > 0 && diasRestantes <= 5) {
            alertasGeneradas.push({
              id: `sin-horarios-${evento.id}`,
              tipo: "atencion",
              mensaje: `${evento.nombre_evento} sin horarios para ${sinHorarios.length} empleado(s)`,
              accion: "definir-horarios",
              eventoId: evento.id,
            });
          }
        }
      }

      if (pagosPendientes) {
        const pagosVencidos = pagosPendientes.filter((pago) => {
          const fechaEvento = parseLocalDate(pago.eventos?.fecha_evento ?? null) ?? new Date();
          const diasVencido = Math.floor(
            (new Date().getTime() - fechaEvento.getTime()) / (1000 * 60 * 60 * 24)
          );
          return diasVencido > 30;
        });

        if (pagosVencidos.length > 0) {
          alertasGeneradas.push({
            id: "pagos-vencidos",
            tipo: "atencion",
            mensaje: `${pagosVencidos.length} empleado(s) con pagos pendientes > 30 días`,
            accion: "procesar-pagos",
          });
        }
      }

      alertasGeneradas.push({
        id: "recordatorio-revision",
        tipo: "informacion",
        mensaje: "Recordatorio: revisar eventos de la próxima semana",
        accion: "revisar-eventos",
      });

      setAlertas(alertasGeneradas);
    } catch (error) {
      console.error("Error generando alertas:", error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoVisto = (alertaId: string) => {
    setAlertas((prev) => prev.filter((a) => a.id !== alertaId));
    toast({ title: "Alerta marcada como vista" });
  };

  const marcarTodas = () => {
    setAlertas([]);
    toast({ title: "Panel de alertas limpiado" });
  };

  const grupos: Record<Severidad, Alerta[]> = {
    urgente: alertas.filter((a) => a.tipo === "urgente"),
    atencion: alertas.filter((a) => a.tipo === "atencion"),
    informacion: alertas.filter((a) => a.tipo === "informacion"),
  };

  if (loading) {
    return (
      <div className="p-6">
        <PanelHeader kicker="Alertas" title="Pendientes" description="Cargando…" />
        <div className="mt-6 space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-muted/70" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PanelHeader
        kicker="Alertas"
        title="Pendientes"
        description={
          alertas.length === 0 ? "Todo en orden" : `${alertas.length} requieren atención`
        }
        actions={
          alertas.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={marcarTodas}
              className="h-8 gap-1.5 px-2.5 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <CheckCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
              Marcar todas
            </Button>
          ) : undefined
        }
      />

      <div className="mt-6">
        {alertas.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {SEV_ORDER.map((sev) => {
              const items = grupos[sev];
              if (items.length === 0) return null;
              return (
                <section key={sev} className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="kicker">{SEV_LABEL[sev]}</span>
                    <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
                    {items.map((alerta) => (
                      <AlertaRow
                        key={alerta.id}
                        alerta={alerta}
                        onDismiss={() => marcarComoVisto(alerta.id)}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function AlertaRow({ alerta, onDismiss }: { alerta: Alerta; onDismiss: () => void }) {
  const Icon = alerta.tipo === "urgente" ? AlertTriangle : alerta.tipo === "atencion" ? Clock : Info;
  const iconClass =
    alerta.tipo === "urgente"
      ? "text-destructive"
      : alerta.tipo === "atencion"
      ? "text-[hsl(30_55%_42%)]"
      : "text-muted-foreground";

  return (
    <li className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      <Icon className={cn("mt-0.5 h-[15px] w-[15px] shrink-0", iconClass)} strokeWidth={1.75} />
      <p className="flex-1 text-[13px] leading-relaxed text-foreground">{alerta.mensaje}</p>
      <button
        onClick={onDismiss}
        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"
        aria-label="Descartar"
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <ShieldCheck className="mb-3 h-8 w-8 text-primary" strokeWidth={1.5} />
      <p className="font-serif text-[17px] tracking-tight text-foreground">Todo en orden</p>
      <p className="mt-1 max-w-[22ch] text-[12px] text-muted-foreground">
        Sin alertas pendientes en este momento.
      </p>
    </div>
  );
}
