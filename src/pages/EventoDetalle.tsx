import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { getEventoRequerimiento } from "@/integrations/supabase/apiCotizador";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ArrowLeft, Receipt, Users, Truck, UtensilsCrossed, DollarSign, FileText, Sparkles, TrendingUp, CheckCircle, Clock } from "lucide-react";
import PersonalPanel from "@/components/Eventos/PersonalPanel";
import MenajePanel from "@/components/Eventos/MenajePanel";
import TransportePanel from "@/components/Eventos/TransportePanel";

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

  // Extraer información de la cotización si existe
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

  const { data: head, isLoading: loadingHead, error: errorHead } = useQuery({
    queryKey: ["evento-head", id],
    queryFn: () => getEventoHead(id!),
    enabled: !!id,
  });

  const {
    data: req,
    isLoading: loadingReq,
    error: errorReq,
  } = useQuery({
    queryKey: ["evento-requerimiento", id],
    queryFn: () => getEventoRequerimiento(id!),
    enabled: !!id,
  });

  const isLoading = loadingHead || loadingReq;
  const hasError = errorHead || errorReq;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        
        <div className="relative z-10 container mx-auto px-4 py-8">
          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-selecta-green to-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl animate-bounce">
                <Calendar className="h-10 w-10 text-white animate-pulse" />
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent mb-3">
                Cargando Evento
              </h3>
              <p className="text-slate-600 text-lg">Obteniendo detalles del evento...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (hasError || !head || !req) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-red-100/20 to-orange-100/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 container mx-auto px-4 py-8">
          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                <FileText className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-red-600 mb-3">Error al cargar evento</h3>
              <p className="text-slate-600 mb-6">No se pudo obtener la información del evento solicitado</p>
              <Link to="/eventos">
                <Button className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-xl transition-all duration-300 rounded-2xl">
                  Volver a Eventos
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const totalRequerimiento =
    req.platos.reduce((a, x) => a + x.subtotal, 0) +
    req.personal.reduce((a, x) => a + x.subtotal, 0) +
    req.transportes.reduce((a, x) => a + x.subtotal, 0);

  const getEventStatus = (fechaEvento: string) => {
    const eventDate = new Date(fechaEvento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate < today) return { status: "Pasado", variant: "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200", icon: <Clock className="h-3 w-3 mr-1" /> };
    if (eventDate.getTime() === today.getTime()) return { status: "Hoy", variant: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200 animate-pulse", icon: <Sparkles className="h-3 w-3 mr-1" /> };
    return { status: "Próximo", variant: "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200", icon: <TrendingUp className="h-3 w-3 mr-1" /> };
  };

  const eventStatus = getEventStatus(head.fecha_evento);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-gradient-to-r from-purple-100/40 to-pink-100/40 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 space-y-8 max-w-7xl">
        {/* Header premium */}
        <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1">
            <Link to="/eventos">
              <Button 
                variant="ghost" 
                size="icon" 
                className="bg-white/70 backdrop-blur-sm shadow-lg border-white/30 rounded-2xl hover:bg-white/90 hover:scale-110 transition-all duration-200"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            
            <div className="flex-1">
              <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent mb-3">
                {head.nombre_evento}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-sm border border-white/30">
                  <Calendar className="h-5 w-5 text-selecta-green" />
                  <span className="font-semibold text-slate-700">
                    {new Date(head.fecha_evento).toLocaleDateString('es-CO', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-sm border border-white/30">
                  <MapPin className="h-5 w-5 text-selecta-green" />
                  <span className="font-semibold text-slate-700">{head.ubicacion || "Sin ubicación"}</span>
                </div>

                {head.comercial_encargado && (
                  <div className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-sm border border-white/30">
                    <Users className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-slate-700">Comercial: {head.comercial_encargado}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge className={`${eventStatus.variant} border font-semibold px-3 py-1 shadow-sm`}>
                  {eventStatus.icon}
                  {eventStatus.status}
                </Badge>
                
                <Badge className={head.estado_liquidacion === "liquidado" 
                  ? "bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200 shadow-sm font-semibold px-3 py-1"
                  : "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200 shadow-sm font-semibold px-3 py-1"
                }>
                  {head.estado_liquidacion === "liquidado" ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Liquidado
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3 mr-1" />
                      Pendiente
                    </>
                  )}
                </Badge>

                {head.cotizacion_version_id && (
                  <Badge className="bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200 shadow-sm font-semibold px-3 py-1">
                    <Receipt className="h-3 w-3 mr-1" />
                    Con Cotización
                  </Badge>
                )}
              </div>

              {head.descripcion && (
                <div className="mt-4 p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/30 shadow-sm">
                  <p className="text-slate-700 leading-relaxed">{head.descripcion}</p>
                </div>
              )}
            </div>
          </div>

          {/* Stats rápidas */}
          <div className="flex items-center space-x-4">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/30 shadow-lg text-center">
              <div className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                ${totalRequerimiento.toLocaleString()}
              </div>
              <div className="text-xs text-slate-600 font-semibold">Presupuesto Estimado</div>
            </div>
          </div>
        </div>

        {/* Sección REQUERIMIENTO */}
        <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm border-b border-slate-200/30">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-800">Requerimiento del Evento</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            {/* PLATOS */}
            <SeccionTabla
              titulo="Menú y Platos"
              emptyHint="Este evento no tiene platos definidos en el requerimiento."
              icon={<UtensilsCrossed className="h-5 w-5 text-orange-600" />}
              rows={req.platos.map((p) => ({
                nombre: p.nombre,
                precio: p.precio_unitario,
                cantidad: p.cantidad,
                subtotal: p.subtotal,
              }))}
            />

            <Separator className="my-6" />

            {/* PERSONAL */}
            <SeccionTabla
              titulo="Personal Requerido"
              emptyHint="No se definió personal en la cotización original."
              icon={<Users className="h-5 w-5 text-blue-600" />}
              rows={req.personal.map((p) => ({
                nombre: p.rol,
                precio: p.tarifa_estimada_por_persona,
                cantidad: p.cantidad,
                subtotal: p.subtotal,
              }))}
            />

            <Separator className="my-6" />

            {/* TRANSPORTE */}
            <SeccionTabla
              titulo="Logística y Transporte"
              emptyHint="No se definió transporte en la cotización original."
              icon={<Truck className="h-5 w-5 text-green-600" />}
              rows={req.transportes.map((t) => ({
                nombre: t.lugar,
                precio: t.tarifa_unitaria,
                cantidad: t.cantidad,
                subtotal: t.subtotal,
              }))}
            />

            {/* Total premium */}
            <div className="flex justify-end pt-6">
              <Card className="bg-gradient-to-r from-emerald-50/80 to-green-50/80 backdrop-blur-sm border-emerald-200/60 rounded-2xl shadow-lg">
                <CardContent className="p-6 text-right">
                  <div className="text-sm text-emerald-700 font-semibold mb-1">Total Estimado (Requerimiento)</div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                    ${totalRequerimiento.toLocaleString()}
                  </div>
                  <div className="text-xs text-emerald-600 mt-1">Basado en cotización original</div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* PANELES DE GESTIÓN - Layout horizontal en una sola fila */}
        <div className="space-y-6">
          {/* Panel Personal - Ocupa todo el ancho */}
          <PersonalPanel
            eventoId={head.id}
            fechaEvento={head.fecha_evento}
            estadoLiquidacion={head.estado_liquidacion}
          />

          {/* Panel Menaje - Ocupa todo el ancho */}
          <MenajePanel
            eventoId={head.id}
            fechaEvento={head.fecha_evento}
          />

          {/* Layout para Transporte + Info origen en dos columnas solo en pantallas grandes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel Transporte - Ocupa 2 columnas */}
            <div className="lg:col-span-2">
              <TransportePanel eventoId={head.id} />
            </div>

            {/* Información de origen - Ocupa 1 columna */}
            <div className="lg:col-span-1">
              {head.cotizacion_version_id && (
                <Card className="bg-gradient-to-r from-purple-50/80 to-purple-100/80 backdrop-blur-sm border-purple-200/60 rounded-3xl shadow-lg h-fit">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Receipt className="h-4 w-4 text-white" />
                      </div>
                      <h4 className="font-bold text-purple-800">Información de Origen</h4>
                    </div>
                    <p className="text-sm text-purple-700 leading-relaxed mb-3">
                      Este evento fue generado desde una cotización aprobada
                    </p>
                    <div className="p-3 bg-white/60 rounded-xl border border-purple-200/50">
                      <code className="text-sm font-mono text-purple-800 break-all">{head.cotizacion_version_id}</code>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Footer informativo */}
        <div className="text-center pt-8">
          <div className="inline-flex items-center justify-center space-x-4 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/30">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-600">Gestión integral de eventos</span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-500">
                Actualizado: {new Date().toLocaleTimeString('es-CO', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** =======================
 *   SUB-COMPONENTES UI MEJORADOS
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
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        {icon}
        <h3 className="text-lg font-bold text-slate-800">{titulo}</h3>
        <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-semibold">
          {rows.length} items
        </Badge>
      </div>
      
      {rows.length === 0 ? (
        <Card className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm border-slate-200/60 rounded-2xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-4">
              {icon}
            </div>
            <p className="text-sm text-slate-500 font-medium">{emptyHint}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-slate-50/80 to-slate-100/80 border-b border-slate-200/60">
                <TableHead className="font-bold text-slate-800">Item</TableHead>
                <TableHead className="text-right font-bold text-slate-800">Precio Unit.</TableHead>
                <TableHead className="text-center font-bold text-slate-800">Cant.</TableHead>
                <TableHead className="text-right font-bold text-slate-800">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} className="hover:bg-gradient-to-r hover:from-slate-50/50 hover:to-slate-100/50 transition-all duration-200">
                  <TableCell className="font-semibold text-slate-800">{r.nombre}</TableCell>
                  <TableCell className="text-right text-slate-700 font-medium">
                    <div className="flex items-center justify-end space-x-1">
                      <DollarSign className="h-3 w-3 text-selecta-green" />
                      <span>{r.precio.toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold">
                      {r.cantidad}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="bg-gradient-to-r from-emerald-50 to-green-50 px-3 py-1 rounded-xl border border-emerald-200/60">
                      <span className="font-bold text-emerald-700">${r.subtotal.toLocaleString()}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}