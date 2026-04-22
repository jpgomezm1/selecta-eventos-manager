import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getEventoRequerimiento } from "@/integrations/supabase/apiCotizador";
import { fetchChecklistData } from "@/integrations/supabase/apiEventoChecklist";
import { computeChecklist } from "@/lib/eventoChecklist";
import {
  Calendar,
  MapPin,
  ArrowLeft,
  Users,
  Truck,
  UtensilsCrossed,
  FileText,
  ShoppingCart,
  DollarSign,
  Building2,
} from "lucide-react";
import { parseLocalDate, formatLocalDate } from "@/lib/dateLocal";
import PersonalPanel from "@/components/Eventos/PersonalPanel";
import MenajePanel from "@/components/Eventos/MenajePanel";
import TransportePanel from "@/components/Eventos/TransportePanel";
import OrdenCompraPanel from "@/components/Eventos/OrdenCompraPanel";
import EventoChecklist from "@/components/Eventos/EventoChecklist";
import CierreEventoPanel from "@/components/Eventos/CierreEventoPanel";
import { cn } from "@/lib/utils";

type EventoHead = {
  id: string;
  nombre_evento: string;
  ubicacion: string;
  fecha_evento: string;
  descripcion: string | null;
  estado_liquidacion: "pendiente" | "liquidado";
  cotizacion_version_id: string | null;
  comercial_encargado?: string | null;
};

async function getEventoHead(id: string): Promise<EventoHead> {
  const { data, error } = await supabase
    .from("eventos")
    .select(`
      *,
      cotizacion_versiones (
        cotizaciones (
          ubicacion_evento,
          comercial_encargado
        )
      )
    `)
    .eq("id", id)
    .single();

  if (error) throw error;

  const cotizacionInfo = data.cotizacion_versiones?.cotizaciones;
  const ubicacionEvento = cotizacionInfo?.ubicacion_evento || data.ubicacion;
  const comercialEncargado = cotizacionInfo?.comercial_encargado;

  return {
    ...data,
    ubicacion: ubicacionEvento,
    comercial_encargado: comercialEncargado,
  } as EventoHead;
}

export default function EventoDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("requerimientos");

  const { data: head, isLoading: loadingHead, error: errorHead } = useQuery({
    queryKey: ["evento-head", id],
    queryFn: () => getEventoHead(id!),
    enabled: !!id,
  });

  const { data: req, isLoading: loadingReq, error: errorReq } = useQuery({
    queryKey: ["evento-requerimiento", id],
    queryFn: () => getEventoRequerimiento(id!),
    enabled: !!id,
  });

  const { data: checklistData, refetch: refetchChecklist } = useQuery({
    queryKey: ["evento-checklist", id],
    queryFn: () => fetchChecklistData(id!),
    enabled: !!id,
  });

  const checklist = checklistData ? computeChecklist(checklistData) : null;

  const isLoading = loadingHead || loadingReq;
  const hasError = errorHead || errorReq;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm italic text-muted-foreground">Cargando evento…</p>
        </div>
      </div>
    );
  }

  if (hasError || !head || !req) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <FileText className="mb-3 h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} />
        <p className="font-serif text-[18px] text-foreground">No se pudo cargar el evento</p>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Probablemente haya sido eliminado o no se tenga acceso.
        </p>
        <Button onClick={() => navigate("/eventos")} variant="outline" size="sm" className="mt-4 gap-2">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Volver a Eventos
        </Button>
      </div>
    );
  }

  const totalRequerimiento = req.totalCotizacion;
  const eventStatus = getEventStatus(head.fecha_evento);

  return (
    <div className="space-y-7">
      {/* Back navigation */}
      <div className="-mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/eventos")}
          className="-ml-2 h-7 gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Eventos
        </Button>
      </div>

      {/* Header editorial */}
      <header className="animate-rise stagger-1 flex flex-col gap-6 border-b border-border/70 pb-7 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-3">
          <span className="kicker">Evento</span>
          <h1 className="font-serif text-[36px] leading-[1.05] tracking-[-0.028em] text-foreground md:text-[46px]">
            {head.nombre_evento}
          </h1>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="capitalize tabular-nums">
                {formatLocalDate(head.fecha_evento, "es-CO", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{head.ubicacion || "Sin ubicación"}</span>
            </span>
            {head.comercial_encargado && (
              <>
                <span className="h-3 w-px bg-border" />
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
                  <span>{head.comercial_encargado}</span>
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusPill tone={eventStatus.tone}>{eventStatus.label}</StatusPill>
            <StatusPill tone={head.estado_liquidacion === "liquidado" ? "primary" : "warning"}>
              {head.estado_liquidacion === "liquidado" ? "Liquidado" : "Pendiente de liquidar"}
            </StatusPill>
          </div>
        </div>

        <div className="text-right">
          <div className="kicker mb-2">Presupuesto estimado</div>
          <div className="font-serif text-[34px] leading-none tracking-[-0.025em] tabular-nums text-foreground md:text-[42px]">
            ${totalRequerimiento.toLocaleString()}
          </div>
        </div>
      </header>

      {/* Checklist */}
      {checklist && (
        <section className="animate-rise stagger-2 rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <span className="kicker">Progreso del evento</span>
          </div>
          <EventoChecklist checklist={checklist} onItemClick={(tab) => setActiveTab(tab)} />
        </section>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-rise stagger-3">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-muted/60 p-1">
          <EditorialTab value="requerimientos" icon={FileText} label="Requerimientos" />
          <EditorialTab value="personal" icon={Users} label="Personal" />
          <EditorialTab value="menaje" icon={UtensilsCrossed} label="Menaje" />
          <EditorialTab value="compras" icon={ShoppingCart} label="Compras" />
          <EditorialTab value="transporte" icon={Truck} label="Transporte" />
          <EditorialTab value="financiero" icon={DollarSign} label="Financiero" />
        </TabsList>

        {/* Tab: Requerimientos */}
        <TabsContent value="requerimientos" className="mt-5">
          <Card className="overflow-hidden border-border shadow-soft">
            <div className="border-b border-border px-5 py-4">
              <span className="kicker">Requerimiento original</span>
              <h2 className="mt-1 font-serif text-[18px] tracking-tight text-foreground">
                Plan cotizado para este evento
              </h2>
            </div>
            <div className="space-y-7 p-5">
              <SeccionTabla
                titulo="Menú y platos"
                emptyHint="Este evento no tiene platos en el requerimiento original."
                icon={UtensilsCrossed}
                rows={req.platos.map((p) => ({ nombre: p.nombre, precio: p.precio_unitario, cantidad: p.cantidad, subtotal: p.subtotal }))}
              />
              <SeccionTabla
                titulo="Personal requerido"
                emptyHint="No se definió personal en la cotización."
                icon={Users}
                rows={req.personal.map((p) => ({ nombre: p.rol, precio: p.tarifa_estimada_por_persona, cantidad: p.cantidad, subtotal: p.subtotal }))}
              />
              <SeccionTabla
                titulo="Logística y transporte"
                emptyHint="No se definió transporte en la cotización."
                icon={Truck}
                rows={req.transportes.map((t) => ({ nombre: t.lugar, precio: t.tarifa_unitaria, cantidad: t.cantidad, subtotal: t.subtotal }))}
              />
              <SeccionTabla
                titulo="Menaje"
                emptyHint="No se definió menaje en la cotización."
                icon={UtensilsCrossed}
                rows={(req.menaje ?? []).map((m) => ({ nombre: m.nombre, precio: m.precio_alquiler, cantidad: m.cantidad, subtotal: m.subtotal }))}
              />
              <SeccionTabla
                titulo="Salón / lugar"
                emptyHint="No se seleccionó un lugar en la cotización."
                icon={Building2}
                rows={req.lugar
                  ? [{
                      nombre: [req.lugar.nombre, req.lugar.ciudad].filter(Boolean).join(", "),
                      precio: req.lugar.precio,
                      cantidad: 1,
                      subtotal: req.lugar.precio,
                    }]
                  : []}
              />

              <div className="flex items-baseline justify-between border-t border-border pt-5">
                <span className="kicker">Total estimado</span>
                <span className="font-serif text-[28px] leading-none tracking-tight tabular-nums text-primary">
                  ${totalRequerimiento.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="personal" className="mt-5">
          <PersonalPanel
            eventoId={head.id}
            fechaEvento={head.fecha_evento}
            estadoLiquidacion={head.estado_liquidacion}
            nombreEvento={head.nombre_evento}
            ubicacion={head.ubicacion}
            onChanged={() => refetchChecklist()}
          />
        </TabsContent>

        <TabsContent value="menaje" className="mt-5">
          <MenajePanel
            eventoId={head.id}
            fechaEvento={head.fecha_evento}
            eventoInfo={{
              nombre_evento: head.nombre_evento,
              fecha_evento: head.fecha_evento,
              ubicacion: head.ubicacion,
              comercial_encargado: head.comercial_encargado,
            }}
            onChanged={() => refetchChecklist()}
          />
        </TabsContent>

        <TabsContent value="compras" className="mt-5">
          <Card className="overflow-hidden border-border shadow-soft">
            <div className="border-b border-border px-5 py-4">
              <span className="kicker">Compras</span>
              <h2 className="mt-1 font-serif text-[18px] tracking-tight text-foreground">
                Orden de compra del evento
              </h2>
            </div>
            <div className="p-5">
              <OrdenCompraPanel
                eventoId={head.id}
                eventoInfo={{
                  nombre_evento: head.nombre_evento,
                  fecha_evento: head.fecha_evento,
                  ubicacion: head.ubicacion,
                  comercial_encargado: head.comercial_encargado,
                }}
                onChanged={() => refetchChecklist()}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="transporte" className="mt-5">
          <TransportePanel eventoId={head.id} onChanged={() => refetchChecklist()} />
        </TabsContent>

        <TabsContent value="financiero" className="mt-5">
          <Card className="overflow-hidden border-border shadow-soft">
            <div className="border-b border-border px-5 py-4">
              <span className="kicker">Cierre</span>
              <h2 className="mt-1 font-serif text-[18px] tracking-tight text-foreground">
                Cierre financiero del evento
              </h2>
            </div>
            <div className="p-5">
              <CierreEventoPanel
                eventoId={head.id}
                totalRequerimiento={totalRequerimiento}
                estadoLiquidacion={head.estado_liquidacion}
                costoLugar={req.lugar?.precio ?? 0}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============= helpers ============= */

function getEventStatus(fechaEvento: string): { label: string; tone: PillTone } {
  const eventDate = parseLocalDate(fechaEvento);
  if (!eventDate) return { label: "Sin fecha", tone: "neutral" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);
  if (eventDate < today) return { label: "Pasado", tone: "neutral" };
  if (eventDate.getTime() === today.getTime()) return { label: "Hoy", tone: "warning" };
  return { label: "Próximo", tone: "primary" };
}

type PillTone = "neutral" | "primary" | "warning" | "destructive";

function StatusPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const classes: Record<PillTone, string> = {
    neutral: "border-border bg-muted/60 text-muted-foreground",
    primary: "border-primary/30 bg-primary/10 text-primary",
    warning: "border-[hsl(30_55%_42%/0.3)] bg-[hsl(30_55%_42%/0.1)] text-[hsl(30_55%_30%)]",
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
  };
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]", classes[tone])}>
      {children}
    </span>
  );
}

function EditorialTab({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className="flex min-w-[110px] flex-1 items-center gap-1.5 text-[12px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </TabsTrigger>
  );
}

/* =======================
 *   SUB-COMPONENTES
 * ======================= */

function SeccionTabla({
  titulo,
  rows,
  emptyHint,
  icon: Icon,
}: {
  titulo: string;
  emptyHint: string;
  icon: typeof FileText;
  rows: Array<{ nombre: string; precio: number; cantidad: number; subtotal: number }>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          <h3 className="font-serif text-[16px] tracking-tight text-foreground">{titulo}</h3>
        </div>
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {rows.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-[12.5px] italic text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Item
                </TableHead>
                <TableHead className="text-right text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Precio unit.
                </TableHead>
                <TableHead className="text-center text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Cant.
                </TableHead>
                <TableHead className="text-right text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Subtotal
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} className="border-border">
                  <TableCell className="text-[13px] text-foreground">{r.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    ${r.precio.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center tabular-nums text-foreground">
                    {r.cantidad}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    ${r.subtotal.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
