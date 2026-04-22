import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Truck, Search, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAllTransporteOrdenes } from "@/integrations/supabase/apiTransporte";
import { parseLocalDate } from "@/lib/dateLocal";
import { PageHeader, KPI } from "@/components/Layout/PageHeader";
import { cn } from "@/lib/utils";

type Estado = "borrador" | "programado" | "finalizado" | "cancelado";

const estadoConfig: Record<Estado, { label: string; class: string }> = {
  borrador: {
    label: "Borrador",
    class: "border-border bg-muted/60 text-muted-foreground",
  },
  programado: {
    label: "Programado",
    class: "border-primary/30 bg-primary/10 text-primary",
  },
  finalizado: {
    label: "Finalizado",
    class: "border-border bg-card text-foreground",
  },
  cancelado: {
    label: "Cancelado",
    class: "border-destructive/30 bg-destructive/10 text-destructive",
  },
};

function formatTimeRange(inicio: string | null, fin: string | null) {
  if (!inicio && !fin) return "—";
  const fmt = (t: string | null) => (t ? t.slice(0, 5) : "");
  if (inicio && fin) return `${fmt(inicio)}–${fmt(fin)}`;
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
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm italic text-muted-foreground">Cargando órdenes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Recursos"
        title="Transporte"
        description="Órdenes de traslado de todos los eventos — recepción, recogida y destino."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-6 md:grid-cols-4">
        <KPI kicker="Total" value={stats.total} />
        <KPI kicker="Programadas" value={stats.programadas} tone="primary" />
        <KPI kicker="Borradores" value={stats.borradores} />
        <KPI kicker="Finalizadas" value={stats.finalizadas} tone="primary" />
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <Input
            placeholder="Buscar por evento, destino o contacto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9 text-[13px]"
          />
        </div>
        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
          <SelectTrigger className="h-10 w-full text-[13px] sm:w-56">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            <SelectItem value="borrador">Borradores</SelectItem>
            <SelectItem value="programado">Programadas</SelectItem>
            <SelectItem value="finalizado">Finalizadas</SelectItem>
            <SelectItem value="cancelado">Canceladas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla / empty */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-border bg-card py-16 text-center">
          <Truck className="mb-4 h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="font-serif text-[20px] tracking-tight text-foreground">
            {ordenes.length === 0 ? "Aún no hay órdenes de transporte" : "Sin resultados"}
          </p>
          <p className="mt-1 max-w-[40ch] text-[12.5px] text-muted-foreground">
            {ordenes.length === 0
              ? "Las órdenes se crean desde el detalle de cada evento."
              : "Ajustar los filtros o la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <Th>Evento</Th>
                  <Th>Fecha</Th>
                  <Th>Estado</Th>
                  <Th>Recepción</Th>
                  <Th>Recogida</Th>
                  <Th>Destino</Th>
                  <Th>Contacto</Th>
                  <Th className="text-right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const cfg = estadoConfig[(o.estado as Estado) ?? "borrador"];
                  return (
                    <tr
                      key={o.id}
                      className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/40"
                    >
                      <td className="max-w-[220px] truncate px-4 py-3 font-serif text-[14px] tracking-tight text-foreground">
                        {o.nombre_evento}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {o.fecha_evento
                          ? format(parseLocalDate(o.fecha_evento) ?? new Date(), "d MMM yyyy", { locale: es })
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]",
                            cfg.class
                          )}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {formatTimeRange(o.hora_recepcion_inicio, o.hora_recepcion_fin)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">
                        {formatTimeRange(o.hora_recogida_inicio, o.hora_recogida_fin)}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                        {o.destino_direccion || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {o.contacto_nombre || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => nav(`/eventos/${o.evento_id}`)}
                          className="h-7 gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Ver evento
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
        className
      )}
    >
      {children}
    </th>
  );
}
