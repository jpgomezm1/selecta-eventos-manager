import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Truck, Search, Eye, Clock, CheckCircle, FileText, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAllTransporteOrdenes } from "@/integrations/supabase/apiTransporte";
import { parseLocalDate } from "@/lib/dateLocal";

const estadoConfig: Record<string, { label: string; class: string }> = {
  borrador: { label: "Borrador", class: "bg-slate-100 text-slate-700" },
  programado: { label: "Programado", class: "bg-blue-50 text-blue-700" },
  finalizado: { label: "Finalizado", class: "bg-emerald-50 text-emerald-700" },
  cancelado: { label: "Cancelado", class: "bg-red-50 text-red-700" },
};

function formatTimeRange(inicio: string | null, fin: string | null) {
  if (!inicio && !fin) return "—";
  const fmt = (t: string | null) => (t ? t.slice(0, 5) : "");
  if (inicio && fin) return `${fmt(inicio)} – ${fmt(fin)}`;
  return fmt(inicio) || fmt(fin);
}

export default function TransportePage() {
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");

  const { data: ordenes = [], isLoading } = useQuery({
    queryKey: ["transporte-ordenes"],
    queryFn: listAllTransporteOrdenes,
  });

  const stats = useMemo(() => {
    const total = ordenes.length;
    const programadas = ordenes.filter((o) => o.estado === "programado").length;
    const borradores = ordenes.filter((o) => o.estado === "borrador").length;
    const finalizadas = ordenes.filter((o) => o.estado === "finalizado").length;
    return { total, programadas, borradores, finalizadas };
  }, [ordenes]);

  const filtered = useMemo(() => {
    return ordenes.filter((o) => {
      const matchSearch =
        search === "" ||
        o.nombre_evento.toLowerCase().includes(search.toLowerCase()) ||
        (o.destino_direccion ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (o.contacto_nombre ?? "").toLowerCase().includes(search.toLowerCase());
      const matchEstado = estadoFilter === "todos" || o.estado === estadoFilter;
      return matchSearch && matchEstado;
    });
  }, [ordenes, search, estadoFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-selecta-green rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Cargando órdenes de transporte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Truck className="h-6 w-6 text-slate-700" />
          <h1 className="text-2xl font-semibold text-slate-900">Transporte</h1>
        </div>
        <p className="text-slate-500 mt-1">
          Todas las órdenes de transporte de todos los eventos
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Total</p>
          <p className="text-2xl font-semibold text-slate-900">{stats.total}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-blue-600">Programadas</p>
          <p className="text-2xl font-semibold text-blue-700">{stats.programadas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Borradores</p>
          <p className="text-2xl font-semibold text-slate-700">{stats.borradores}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-emerald-600">Finalizadas</p>
          <p className="text-2xl font-semibold text-emerald-700">{stats.finalizadas}</p>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por evento, destino o contacto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-full sm:w-48 h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
                <SelectItem value="programado">Programado</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Truck className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-slate-900 font-medium">
              {ordenes.length === 0 ? "No hay órdenes de transporte" : "Sin resultados"}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {ordenes.length === 0
                ? "Las órdenes se crean desde el detalle de cada evento"
                : "Intenta con otros criterios de búsqueda"}
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Evento</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Estado</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Recepción</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Recogida</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Destino</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Contacto</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const cfg = estadoConfig[o.estado] ?? estadoConfig.borrador;
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-[200px] truncate">
                        {o.nombre_evento}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {o.fecha_evento
                          ? format(parseLocalDate(o.fecha_evento) ?? new Date(), "d MMM yyyy", { locale: es })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={cfg.class}>
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatTimeRange(o.hora_recepcion_inicio, o.hora_recepcion_fin)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {formatTimeRange(o.hora_recogida_inicio, o.hora_recogida_fin)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">
                        {o.destino_direccion || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {o.contacto_nombre || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => nav(`/eventos/${o.evento_id}`)}
                          className="h-8 text-slate-600"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver evento
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
