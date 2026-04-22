import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Users,
  Mail,
  AlertTriangle,
  DollarSign,
  CheckSquare,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PanelHeader } from "@/components/Layout/PageHeader";
import { CronogramaDialog } from "./CronogramaDialog";

type SmartAction = {
  tone: "urgent" | "warning" | "ok";
  label: string;
  description: string;
  icon: typeof AlertTriangle;
  onClick: () => void;
};

export function AccionesRapidas() {
  const [stats, setStats] = useState({
    eventosSinPersonal: 0,
    pagosPendientes: 0,
    conflictos: 0,
    totalEventosProximos: 0,
  });
  const [isCronogramaDialogOpen, setIsCronogramaDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    try {
      const { data: eventosSinPersonal } = await supabase
        .from("eventos")
        .select(`id, evento_personal(id)`)
        .gte("fecha_evento", new Date().toISOString().split("T")[0])
        .lte(
          "fecha_evento",
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
        );

      const eventosVacios = eventosSinPersonal?.filter((e) => e.evento_personal.length === 0).length || 0;

      const { data: pagosPendientes } = await supabase
        .from("evento_personal")
        .select("id")
        .eq("estado_pago", "pendiente");

      const { data: eventosProximos } = await supabase
        .from("eventos")
        .select("id")
        .gte("fecha_evento", new Date().toISOString().split("T")[0]);

      setStats({
        eventosSinPersonal: eventosVacios,
        pagosPendientes: pagosPendientes?.length || 0,
        conflictos: 0,
        totalEventosProximos: eventosProximos?.length || 0,
      });
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    }
  };

  const getSmartAction = (): SmartAction => {
    if (stats.eventosSinPersonal > 0) {
      return {
        tone: "urgent",
        label: "Asignar personal",
        description: `${stats.eventosSinPersonal} evento${stats.eventosSinPersonal > 1 ? "s" : ""} sin cobertura`,
        icon: AlertTriangle,
        onClick: () => navigate("/eventos"),
      };
    }
    if (stats.pagosPendientes > 0) {
      return {
        tone: "warning",
        label: "Liquidar pagos",
        description: `${stats.pagosPendientes} pendiente${stats.pagosPendientes > 1 ? "s" : ""}`,
        icon: DollarSign,
        onClick: () => navigate("/personal"),
      };
    }
    return {
      tone: "ok",
      label: "Todo en orden",
      description: "Sin pendientes inmediatos",
      icon: CheckSquare,
      onClick: () => navigate("/eventos"),
    };
  };

  const smart = getSmartAction();
  const SmartIcon = smart.icon;

  const smartStyles =
    smart.tone === "urgent"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : smart.tone === "warning"
      ? "bg-[hsl(30_55%_42%)] text-white hover:bg-[hsl(30_55%_38%)]"
      : "bg-primary text-primary-foreground hover:bg-primary/90";

  const quickActions = [
    {
      label: "Crear evento",
      description: "Programar un nuevo servicio",
      icon: Plus,
      onClick: () => navigate("/eventos"),
    },
    {
      label: "Agregar empleado",
      description: "Registrar nuevo personal",
      icon: Users,
      onClick: () => navigate("/personal"),
    },
    {
      label: "Enviar cronogramas",
      description: "Notificar horarios al equipo",
      icon: Mail,
      onClick: () => setIsCronogramaDialogOpen(true),
    },
  ];

  return (
    <div className="p-6">
      <PanelHeader kicker="Atajos" title="Acciones rápidas" description="Herramientas del día" />

      <div className="mt-6 space-y-6">
        {/* Smart action — contextual */}
        <button
          onClick={smart.onClick}
          className={`group flex w-full items-center gap-4 rounded-md px-4 py-3.5 text-left transition-colors ${smartStyles}`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/15">
            <SmartIcon className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <span className="flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] opacity-75">
              {smart.tone === "urgent" ? "Urgente" : smart.tone === "warning" ? "Revisar" : "Estado"}
            </span>
            <span className="block font-serif text-[17px] leading-tight tracking-tight">
              {smart.label}
            </span>
            <span className="block text-[12px] opacity-80">{smart.description}</span>
          </span>
          <ArrowUpRight className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>

        {/* Quick actions list */}
        <div className="space-y-px overflow-hidden rounded-md border border-border">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className={`group flex w-full items-center gap-4 bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent ${
                  idx > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-foreground">{action.label}</span>
                  <span className="block text-[11.5px] text-muted-foreground">{action.description}</span>
                </span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
              </button>
            );
          })}
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-4 border-t border-border pt-5">
          <StatItem label="Eventos próximos" value={stats.totalEventosProximos} tone="neutral" />
          <StatItem label="Sin personal" value={stats.eventosSinPersonal} tone={stats.eventosSinPersonal > 0 ? "destructive" : "neutral"} />
        </div>
      </div>

      <CronogramaDialog isOpen={isCronogramaDialogOpen} onClose={() => setIsCronogramaDialogOpen(false)} />
    </div>
  );
}

function StatItem({ label, value, tone }: { label: string; value: number; tone: "neutral" | "destructive" }) {
  return (
    <div>
      <div
        className={`font-serif text-3xl tracking-tight tabular-nums ${
          tone === "destructive" && value > 0 ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
