import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { getEventoRequerimiento } from "@/integrations/supabase/apiCotizador";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ArrowLeft } from "lucide-react";
import PersonalPanel from "@/components/Eventos/PersonalPanel";

type EventoHead = {
  id: string;
  nombre_evento: string;
  ubicacion: string;
  fecha_evento: string;
  descripcion: string | null;
  estado_liquidacion: "pendiente" | "liquidado";
  cotizacion_version_id: string | null;
};

async function getEventoHead(id: string): Promise<EventoHead> {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as EventoHead;
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
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-center">Cargando…</CardContent>
        </Card>
      </div>
    );
  }

  if (hasError || !head || !req) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-center text-red-600">
            Error cargando evento.
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRequerimiento =
    req.platos.reduce((a, x) => a + x.subtotal, 0) +
    req.personal.reduce((a, x) => a + x.subtotal, 0) +
    req.transportes.reduce((a, x) => a + x.subtotal, 0);

  return (
    <div className="p-3 md:p-6 space-y-4">
      {/* Header / breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/eventos">
            <Button variant="ghost" size="icon" className="mr-1">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">{head.nombre_evento}</h1>
            <div className="flex flex-wrap items-center gap-3 text-slate-600 text-sm mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(head.fecha_evento).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {head.ubicacion || "-"}
              </span>
              <Badge variant={head.estado_liquidacion === "liquidado" ? "default" : "outline"}>
                {head.estado_liquidacion}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Layout de dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: REQUERIMIENTO */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle>Requerimiento del evento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* PLATOS */}
              <SeccionTabla
                titulo="Platos"
                emptyHint="Este evento no tiene platos en el requerimiento."
                rows={req.platos.map((p) => ({
                  nombre: p.nombre || "(plato)",
                  precio: p.precio_unitario,
                  cantidad: p.cantidad,
                  subtotal: p.subtotal,
                }))}
              />

              <Separator />

              {/* PERSONAL (requerido, no asignaciones) */}
              <SeccionTabla
                titulo="Personal requerido"
                emptyHint="No se definió personal en la cotización."
                rows={req.personal.map((p) => ({
                  nombre: p.rol || "(rol)",
                  precio: p.tarifa_estimada_por_persona,
                  cantidad: p.cantidad,
                  subtotal: p.subtotal,
                }))}
              />

              <Separator />

              {/* TRANSPORTE */}
              <SeccionTabla
                titulo="Transporte"
                emptyHint="No se definió transporte en la cotización."
                rows={req.transportes.map((t) => ({
                  nombre: t.lugar || "(lugar)",
                  precio: t.tarifa_unitaria,
                  cantidad: t.cantidad,
                  subtotal: t.subtotal,
                }))}
              />

              {/* Total */}
              <div className="flex justify-end pt-2">
                <div className="text-right">
                  <div className="text-sm text-slate-500">Total estimado (requerimiento)</div>
                  <div className="text-2xl font-bold">${totalRequerimiento.toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha: PERSONAL (operación, 100% funcional) */}
        <div className="lg:col-span-1 space-y-6">
          <PersonalPanel eventoId={head.id} fechaEvento={head.fecha_evento} estadoLiquidacion={head.estado_liquidacion} />
          {head.cotizacion_version_id && (
            <Card>
              <CardContent className="p-4 text-sm text-slate-600">
                Origen: cotización aprobada{" "}
                <code className="text-slate-800">{head.cotizacion_version_id}</code>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/** =======================
 *   SUB-COMPONENTES UI
 *  ======================= */

function SeccionTabla({
  titulo,
  rows,
  emptyHint,
}: {
  titulo: string;
  emptyHint: string;
  rows: Array<{ nombre: string; precio: number; cantidad: number; subtotal: number }>;
}) {
  return (
    <div className="space-y-3">
      <div className="font-semibold">{titulo}</div>
      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">{emptyHint}</CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-center">Cant.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.nombre}</TableCell>
                <TableCell className="text-right">${r.precio.toLocaleString()}</TableCell>
                <TableCell className="text-center">{r.cantidad}</TableCell>
                <TableCell className="text-right">${r.subtotal.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
