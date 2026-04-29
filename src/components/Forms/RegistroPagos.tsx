import { useState, useEffect, useCallback, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, ClipboardList, Eye, Download, Calendar, CreditCard, Filter, Receipt, Search, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RegistroPagoConEventos } from "@/types/database";
import { ComprobanteModal } from "./ComprobanteModal";
import { KPI, PanelHeader } from "@/components/Layout/PageHeader";
import { formatLocalDate } from "@/lib/dateLocal";

interface RegistroPagosProps {
  empleadoId: string;
  empleadoNombre: string;
}

export function RegistroPagos({ empleadoId, empleadoNombre }: RegistroPagosProps) {
  const [registros, setRegistros] = useState<RegistroPagoConEventos[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroMetodo, setFiltroMetodo] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroFecha, setFiltroFecha] = useState<string>("");
  const [busquedaComprobante, setBusquedaComprobante] = useState<string>("");
  const [registroSeleccionado, setRegistroSeleccionado] = useState<RegistroPagoConEventos | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  const fetchRegistrosPagos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("registro_pagos")
        .select(`
          *,
          eventos:registro_pago_eventos(
            *,
            evento:eventos(*)
          )
        `)
        .eq("empleado_id", empleadoId)
        .order("fecha_pago", { ascending: false });

      if (error) throw error;
      setRegistros((data as RegistroPagoConEventos[]) || []);
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error)?.message ?? "Error al cargar el registro de pagos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [empleadoId, toast]);

  useEffect(() => {
    fetchRegistrosPagos();
  }, [fetchRegistrosPagos]);

  const registrosFiltrados = useMemo(
    () =>
      registros.filter((registro) => {
        const matchMetodo = filtroMetodo === "todos" || registro.metodo_pago === filtroMetodo;
        const matchTipo = filtroTipo === "todos" || registro.tipo_liquidacion === filtroTipo;
        const matchFecha = !filtroFecha || registro.fecha_pago.includes(filtroFecha);
        const matchComprobante =
          !busquedaComprobante ||
          registro.numero_comprobante.toLowerCase().includes(busquedaComprobante.toLowerCase());
        return matchMetodo && matchTipo && matchFecha && matchComprobante;
      }),
    [registros, filtroMetodo, filtroTipo, filtroFecha, busquedaComprobante]
  );

  const totalMesActual = useMemo(
    () =>
      registros
        .filter((r) => r.fecha_pago.startsWith(new Date().toISOString().substring(0, 7)))
        .reduce((sum, r) => sum + r.monto_total, 0),
    [registros]
  );

  const totalGeneral = useMemo(
    () => registros.reduce((sum, r) => sum + r.monto_total, 0),
    [registros]
  );

  const totalFiltrado = useMemo(
    () => registrosFiltrados.reduce((sum, r) => sum + r.monto_total, 0),
    [registrosFiltrados]
  );

  const getTipoBadge = (tipo: string, cantidadEventos: number) => {
    if (tipo === "evento") {
      return (
        <Badge variant="outline" className="font-normal">
          <FileText className="h-3 w-3 mr-1" strokeWidth={1.75} />
          Evento individual
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="font-normal border-primary/25 bg-primary/10 text-primary">
        <ClipboardList className="h-3 w-3 mr-1" strokeWidth={1.75} />
        Liquidación múltiple ({cantidadEventos})
      </Badge>
    );
  };

  const getMetodoBadge = (metodo: string) => {
    const icons: Record<string, React.ReactNode> = {
      efectivo: <DollarSign className="h-3 w-3 mr-1" strokeWidth={1.75} />,
      transferencia: <CreditCard className="h-3 w-3 mr-1" strokeWidth={1.75} />,
      nomina: <Receipt className="h-3 w-3 mr-1" strokeWidth={1.75} />,
    };
    return (
      <Badge variant="outline" className="font-normal capitalize">
        {icons[metodo] ?? <FileText className="h-3 w-3 mr-1" strokeWidth={1.75} />}
        {metodo}
      </Badge>
    );
  };

  const handleVerComprobante = (registro: RegistroPagoConEventos) => {
    setRegistroSeleccionado(registro);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted/70" />
        <p className="text-sm italic text-muted-foreground">Cargando registro de pagos…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* KPIs editoriales */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-6 md:grid-cols-3">
        <KPI kicker="Pagos totales" value={registros.length} hint="Registros históricos" />
        <KPI
          kicker="Este mes"
          value={`$${totalMesActual.toLocaleString("es-CO")}`}
          tone="primary"
          hint={new Date().toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
        />
        <KPI
          kicker="Total acumulado"
          value={`$${totalGeneral.toLocaleString("es-CO")}`}
          hint="Todos los pagos"
        />
      </div>

      {/* Header de la sección */}
      <PanelHeader
        kicker="Liquidaciones"
        title="Registro oficial de pagos"
        description="Constancias y comprobantes de las liquidaciones procesadas."
      />

      {/* Filtros */}
      <div className="space-y-4 rounded-md border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          <span className="kicker text-muted-foreground">Filtros</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filtro-metodo" className="kicker text-muted-foreground">
              Método de pago
            </Label>
            <Select value={filtroMetodo} onValueChange={setFiltroMetodo}>
              <SelectTrigger id="filtro-metodo" className="h-10 text-[13px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los métodos</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="nomina">Nómina</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-tipo" className="kicker text-muted-foreground">
              Tipo de liquidación
            </Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger id="filtro-tipo" className="h-10 text-[13px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="evento">Evento individual</SelectItem>
                <SelectItem value="multiple">Liquidación múltiple</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filtro-fecha" className="kicker text-muted-foreground">
              Período (año-mes)
            </Label>
            <Input
              id="filtro-fecha"
              type="month"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              placeholder="2026-01"
              className="h-10 text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="busqueda-comprobante" className="kicker text-muted-foreground">
              Buscar comprobante
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
              />
              <Input
                id="busqueda-comprobante"
                placeholder="TXN-20260101-001"
                value={busquedaComprobante}
                onChange={(e) => setBusquedaComprobante(e.target.value)}
                className="h-10 pl-9 text-[13px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Empty state */}
      {registrosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center rounded-md border border-dashed border-border py-16 text-center">
          <Receipt className="mb-4 h-10 w-10 text-muted-foreground/60" strokeWidth={1.5} />
          <p className="font-serif text-[20px] tracking-tight text-foreground">
            {registros.length === 0 ? "Sin pagos registrados" : "Sin resultados"}
          </p>
          <p className="mt-1 max-w-[44ch] text-[12.5px] text-muted-foreground">
            {registros.length === 0
              ? `Aún no hay liquidaciones procesadas para ${empleadoNombre}.`
              : "Ajustar los filtros o la búsqueda."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col items-start justify-between gap-3 lg:flex-row lg:items-center">
            <p className="font-mono text-xs tabular-nums text-muted-foreground">
              {registrosFiltrados.length} de {registros.length} registros
            </p>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]">
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              Exportar PDF
            </Button>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/40 hover:bg-muted/40">
                    <TableHead className="kicker text-muted-foreground">Fecha</TableHead>
                    <TableHead className="kicker text-muted-foreground">Tipo</TableHead>
                    <TableHead className="kicker text-right text-muted-foreground">Monto</TableHead>
                    <TableHead className="kicker text-muted-foreground">Método</TableHead>
                    <TableHead className="kicker text-muted-foreground">Comprobante</TableHead>
                    <TableHead className="kicker text-right text-muted-foreground">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrosFiltrados.map((registro) => (
                    <TableRow key={registro.id} className="border-border transition-colors hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.75} />
                          <span className="font-mono text-[13px] tabular-nums text-foreground/85">
                            {formatLocalDate(registro.fecha_pago, "es-CO", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getTipoBadge(registro.tipo_liquidacion, registro.eventos.length)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
                          ${registro.monto_total.toLocaleString("es-CO")}
                        </span>
                      </TableCell>
                      <TableCell>{getMetodoBadge(registro.metodo_pago)}</TableCell>
                      <TableCell>
                        <span className="rounded border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11.5px] text-foreground/80">
                          {registro.numero_comprobante}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVerComprobante(registro)}
                          className="h-8 gap-1 text-[11.5px] text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Resumen del período (sólo si hay filtros activos) */}
          {registrosFiltrados.length > 0 && (
            <div className="flex flex-col items-start justify-between gap-4 rounded-md border border-border bg-card p-5 sm:flex-row sm:items-center">
              <div>
                <span className="kicker text-muted-foreground">Resumen del período</span>
                <p className="mt-1 text-[13px] text-foreground/85">
                  {registrosFiltrados.length} pagos procesados.
                </p>
              </div>
              <div className="text-right">
                <span className="kicker text-muted-foreground">Total período</span>
                <div className="mt-1 font-serif text-[26px] leading-none tracking-[-0.02em] tabular-nums text-primary">
                  ${totalFiltrado.toLocaleString("es-CO")}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ComprobanteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        registroPago={registroSeleccionado}
        empleadoNombre={empleadoNombre}
      />
    </div>
  );
}
