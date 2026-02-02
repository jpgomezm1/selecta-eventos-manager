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
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ArrowLeft, Users, Truck, UtensilsCrossed, FileText, ShoppingCart, DollarSign, ClipboardList } from "lucide-react";
import PersonalPanel from "@/components/Eventos/PersonalPanel";
import MenajePanel from "@/components/Eventos/MenajePanel";
import TransportePanel from "@/components/Eventos/TransportePanel";
import OrdenCompraPanel from "@/components/Eventos/OrdenCompraPanel";
import EventoChecklist from "@/components/Eventos/EventoChecklist";
import CierreEventoPanel from "@/components/Eventos/CierreEventoPanel";

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
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-selecta-green rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Cargando evento...</p>
        </div>
      </div>
    );
  }

  if (hasError || !head || !req) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <FileText className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-slate-900 font-medium">Error al cargar evento</p>
        <p className="text-slate-500 text-sm mt-1 mb-4">No se pudo obtener la información del evento</p>
        <Button onClick={() => navigate("/eventos")} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Eventos
        </Button>
      </div>
    );
  }

  const totalRequerimiento =
    req.platos.reduce((a, x) => a + x.subtotal, 0) +
    req.personal.reduce((a, x) => a + x.subtotal, 0) +
    req.transportes.reduce((a, x) => a + x.subtotal, 0) +
    (req.menaje ?? []).reduce((a, x) => a + x.subtotal, 0);

  const getEventStatus = (fechaEvento: string) => {
    const eventDate = new Date(fechaEvento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);
    if (eventDate < today) return { status: "Pasado", className: "bg-slate-100 text-slate-700" };
    if (eventDate.getTime() === today.getTime()) return { status: "Hoy", className: "bg-blue-50 text-blue-700" };
    return { status: "Próximo", className: "bg-emerald-50 text-emerald-700" };
  };

  const eventStatus = getEventStatus(head.fecha_evento);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/eventos")} className="h-8 w-8 p-0 mt-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">{head.nombre_evento}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>
                      {new Date(head.fecha_evento).toLocaleDateString('es-CO', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{head.ubicacion || "Sin ubicación"}</span>
                  </div>
                  {head.comercial_encargado && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span>{head.comercial_encargado}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Badge variant="secondary" className={eventStatus.className}>{eventStatus.status}</Badge>
                  <Badge variant="secondary" className={head.estado_liquidacion === "liquidado" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"}>
                    {head.estado_liquidacion === "liquidado" ? "Liquidado" : "Pendiente"}
                  </Badge>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-500">Presupuesto Estimado</p>
                <p className="text-2xl font-semibold text-slate-900">${totalRequerimiento.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      {checklist && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-5 w-5 text-slate-600" />
            <h2 className="font-semibold text-slate-900">Progreso del Evento</h2>
          </div>
          <EventoChecklist checklist={checklist} onItemClick={(tab) => setActiveTab(tab)} />
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="requerimientos" className="flex-1 min-w-[120px] text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Requerimientos
          </TabsTrigger>
          <TabsTrigger value="personal" className="flex-1 min-w-[100px] text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5 mr-1.5" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="menaje" className="flex-1 min-w-[90px] text-xs sm:text-sm">
            <UtensilsCrossed className="h-3.5 w-3.5 mr-1.5" />
            Menaje
          </TabsTrigger>
          <TabsTrigger value="compras" className="flex-1 min-w-[90px] text-xs sm:text-sm">
            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
            Compras
          </TabsTrigger>
          <TabsTrigger value="transporte" className="flex-1 min-w-[100px] text-xs sm:text-sm">
            <Truck className="h-3.5 w-3.5 mr-1.5" />
            Transporte
          </TabsTrigger>
          <TabsTrigger value="financiero" className="flex-1 min-w-[100px] text-xs sm:text-sm">
            <DollarSign className="h-3.5 w-3.5 mr-1.5" />
            Financiero
          </TabsTrigger>
        </TabsList>

        {/* Tab: Requerimientos */}
        <TabsContent value="requerimientos" className="mt-4">
          <Card>
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-600" />
                <h2 className="font-semibold text-slate-900">Requerimiento del Evento</h2>
              </div>
            </div>
            <div className="p-4 space-y-6">
              <SeccionTabla
                titulo="Menú y Platos"
                emptyHint="Este evento no tiene platos definidos en el requerimiento."
                icon={<UtensilsCrossed className="h-4 w-4 text-orange-600" />}
                rows={req.platos.map((p) => ({ nombre: p.nombre, precio: p.precio_unitario, cantidad: p.cantidad, subtotal: p.subtotal }))}
              />
              <SeccionTabla
                titulo="Personal Requerido"
                emptyHint="No se definió personal en la cotización original."
                icon={<Users className="h-4 w-4 text-blue-600" />}
                rows={req.personal.map((p) => ({ nombre: p.rol, precio: p.tarifa_estimada_por_persona, cantidad: p.cantidad, subtotal: p.subtotal }))}
              />
              <SeccionTabla
                titulo="Logística y Transporte"
                emptyHint="No se definió transporte en la cotización original."
                icon={<Truck className="h-4 w-4 text-green-600" />}
                rows={req.transportes.map((t) => ({ nombre: t.lugar, precio: t.tarifa_unitaria, cantidad: t.cantidad, subtotal: t.subtotal }))}
              />
              <SeccionTabla
                titulo="Menaje"
                emptyHint="No se definió menaje en la cotización original."
                icon={<UtensilsCrossed className="h-4 w-4 text-purple-600" />}
                rows={(req.menaje ?? []).map((m) => ({ nombre: m.nombre, precio: m.precio_alquiler, cantidad: m.cantidad, subtotal: m.subtotal }))}
              />
              <div className="flex justify-end pt-4 border-t border-slate-200">
                <div className="bg-emerald-50 rounded-lg p-4 text-right">
                  <p className="text-xs text-emerald-600 mb-1">Total Estimado</p>
                  <p className="text-2xl font-semibold text-emerald-700">${totalRequerimiento.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tab: Personal */}
        <TabsContent value="personal" className="mt-4">
          <PersonalPanel
            eventoId={head.id}
            fechaEvento={head.fecha_evento}
            estadoLiquidacion={head.estado_liquidacion}
          />
        </TabsContent>

        {/* Tab: Menaje */}
        <TabsContent value="menaje" className="mt-4">
          <MenajePanel eventoId={head.id} fechaEvento={head.fecha_evento} />
        </TabsContent>

        {/* Tab: Compras */}
        <TabsContent value="compras" className="mt-4">
          <Card>
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-slate-600" />
                <h2 className="font-semibold text-slate-900">Orden de Compra</h2>
              </div>
            </div>
            <div className="p-4">
              <OrdenCompraPanel eventoId={head.id} onChanged={() => refetchChecklist()} />
            </div>
          </Card>
        </TabsContent>

        {/* Tab: Transporte */}
        <TabsContent value="transporte" className="mt-4">
          <TransportePanel eventoId={head.id} />
        </TabsContent>

        {/* Tab: Financiero */}
        <TabsContent value="financiero" className="mt-4">
          <Card>
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-slate-600" />
                <h2 className="font-semibold text-slate-900">Cierre Financiero</h2>
              </div>
            </div>
            <div className="p-4">
              <CierreEventoPanel
                eventoId={head.id}
                totalRequerimiento={totalRequerimiento}
                estadoLiquidacion={head.estado_liquidacion}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =======================
 *   SUB-COMPONENTES
 *  ======================= */

function SeccionTabla({
  titulo,
  rows,
  emptyHint,
  icon,
}: {
  titulo: string;
  emptyHint: string;
  icon: React.ReactNode;
  rows: Array<{ nombre: string; precio: number; cantidad: number; subtotal: number }>;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-medium text-slate-900">{titulo}</h3>
        <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs">{rows.length}</Badge>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-lg">
          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">{icon}</div>
          <p className="text-sm text-slate-500">{emptyHint}</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="font-medium">Item</TableHead>
                <TableHead className="text-right font-medium">Precio Unit.</TableHead>
                <TableHead className="text-center font-medium">Cant.</TableHead>
                <TableHead className="text-right font-medium">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-slate-900">{r.nombre}</TableCell>
                  <TableCell className="text-right text-slate-600">${r.precio.toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">{r.cantidad}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">${r.subtotal.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
