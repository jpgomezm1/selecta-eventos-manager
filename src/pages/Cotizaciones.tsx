import { useQuery } from "@tanstack/react-query";
import { listCotizaciones, getCotizacionDetalle } from "@/integrations/supabase/apiCotizador";
import { generateSelectaPremiumPDF } from "@/lib/selecta-premium-pdf";
import { useToast } from "@/components/ui/use-toast";
import CotizacionPDFModal from "@/components/CotizacionPDFModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import {
  Calculator,
  Plus,
  Search,
  Filter,
  Users,
  DollarSign,
  Calendar,
  Eye,
  AlertTriangle,
  X,
  ArrowUpDown,
  Download,
  Building2,
  Layers,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, KPI } from "@/components/Layout/PageHeader";

export default function CotizacionesListPage() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterComercial, setFilterComercial] = useState<string>("all");
  const [filterCliente, setFilterCliente] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("fecha_desc");
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedCotizacion, setSelectedCotizacion] = useState<Awaited<ReturnType<typeof getCotizacionDetalle>> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ["cotizaciones"],
    queryFn: listCotizaciones,
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterComercial, filterCliente, sortBy]);

  // Obtener lista de comerciales únicos
  const comerciales = useMemo(() => {
    if (!data) return [];
    return [...new Set(data
      .map(c => c.comercial_encargado)
      .filter(Boolean)
    )].sort();
  }, [data]);

  // Obtener lista de clientes únicos
  const clientes = useMemo(() => {
    if (!data) return [];
    const names = data.map(c => c.cliente?.nombre || c.cliente_nombre).filter(Boolean);
    return [...new Set(names)].sort() as string[];
  }, [data]);

  // Filtros y ordenamiento
  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    const filtered = data.filter(c => {
      const clienteName = c.cliente?.nombre || c.cliente_nombre || '';
      const clienteEmpresa = c.cliente?.empresa || '';
      const term = searchTerm.toLowerCase();
      const matchesSearch = c.nombre_cotizacion.toLowerCase().includes(term) ||
                           clienteName.toLowerCase().includes(term) ||
                           clienteEmpresa.toLowerCase().includes(term);
      const matchesStatus = filterStatus === 'all' || c.estado === filterStatus;
      const matchesComercial = filterComercial === 'all' || c.comercial_encargado === filterComercial;
      const matchesCliente = filterCliente === 'all' || clienteName === filterCliente;

      return matchesSearch && matchesStatus && matchesComercial && matchesCliente;
    });

    // Ordenamiento
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'fecha_desc':
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
        case 'fecha_asc':
          return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime();
        case 'total_desc':
          return b.total_cotizado - a.total_cotizado;
        case 'total_asc':
          return a.total_cotizado - b.total_cotizado;
        case 'nombre':
          return a.nombre_cotizacion.localeCompare(b.nombre_cotizacion);
        default:
          return 0;
      }
    });

    return filtered;
  }, [data, searchTerm, filterStatus, filterComercial, filterCliente, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredAndSortedData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Estadísticas
  const stats = useMemo(() => {
    if (!data) return { total: 0, pendiente: 0, aprobado: 0, rechazado: 0, totalValue: 0 };

    return {
      total: data.length,
      pendiente: data.filter(c => c.estado === 'Pendiente por Aprobación').length,
      aprobado: data.filter(c => c.estado === 'Cotización Aprobada').length,
      rechazado: data.filter(c => c.estado === 'Rechazada').length,
      totalValue: data.reduce((sum, c) => sum + c.total_cotizado, 0)
    };
  }, [data]);

  // Función para abrir modal de selección de PDF
  const handleOpenPDFModal = async (cotizacionId: string) => {
    try {
      const detalle = await getCotizacionDetalle(cotizacionId);
      setSelectedCotizacion(detalle);
      setPdfModalOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error?.message ?? "No se pudo cargar la información de la cotización.",
        variant: "destructive"
      });
    }
  };

  // Función para generar PDF con opciones seleccionadas
  const handleGeneratePDF = async (selectedVersions: string[]) => {
    if (!selectedCotizacion) return;

    try {
      setDownloadingPdf(selectedCotizacion.cotizacion.id);

      toast({
        title: "Generando PDF Premium...",
        description: "Creando tu propuesta con el mejor diseño."
      });

      await generateSelectaPremiumPDF(selectedCotizacion, selectedVersions);

      toast({
        title: "¡PDF Premium generado!",
        description: "Tu propuesta elegante está lista para enviar al cliente."
      });

      setPdfModalOpen(false);
      setSelectedCotizacion(null);
    } catch (error) {
      toast({
        title: "Error al generar PDF",
        description: error?.message ?? "No se pudo generar la propuesta. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setDownloadingPdf(null);
    }
  };

  const getStatusBadge = (estado: string) => {
    const configs = {
      "Pendiente por Aprobación": {
        class: "border-[hsl(30_55%_42%)]/30 bg-[hsl(30_55%_42%)]/10 text-[hsl(30_55%_42%)]",
        label: "Pendiente",
      },
      "Cotización Aprobada": {
        class: "border-primary/25 bg-primary/10 text-primary",
        label: "Aprobada",
      },
      Rechazada: {
        class: "border-destructive/30 bg-destructive/10 text-destructive",
        label: "Rechazada",
      },
      Enviada: {
        class: "border-border bg-muted/40 text-foreground/80",
        label: "Enviada",
      },
    };

    const config = configs[estado as keyof typeof configs] || configs["Pendiente por Aprobación"];
    return (
      <Badge variant="outline" className={`${config.class} font-normal`}>
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-selecta-green rounded-full animate-spin" />
          <p className="text-slate-500">Cargando cotizaciones...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800">Error al cargar cotizaciones</h3>
          <p className="text-slate-500">No se pudieron obtener las cotizaciones</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Operación"
        title="Cotizaciones"
        description="Propuestas y presupuestos — del brief inicial a la aprobación del cliente."
        actions={
          <Button onClick={() => nav("/cotizaciones/nueva")} className="gap-2">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Nueva cotización
          </Button>
        }
      />

      {/* KPI editorial */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-6 md:grid-cols-4">
        <KPI kicker="Total" value={stats.total} />
        <KPI kicker="Pendientes" value={stats.pendiente} tone={stats.pendiente > 0 ? "warning" : "neutral"} />
        <KPI kicker="Aprobadas" value={stats.aprobado} tone="primary" />
        <KPI
          kicker="Valor total"
          value={`$${(stats.totalValue / 1000000).toFixed(1)}`}
          suffix="M"
          tone="primary"
        />
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Búsqueda */}
            <div className="flex items-center w-full lg:max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Buscar cotizaciones o clientes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-100 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-700">Estado:</span>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="Pendiente por Aprobación">Pendientes</SelectItem>
                  <SelectItem value="Cotización Aprobada">Aprobadas</SelectItem>
                  <SelectItem value="Rechazada">Rechazadas</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-700">Cliente:</span>
              </div>
              <Select value={filterCliente} onValueChange={setFilterCliente}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente} value={cliente}>
                      {cliente}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-700">Comercial:</span>
              </div>
              <Select value={filterComercial} onValueChange={setFilterComercial}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los comerciales</SelectItem>
                  {comerciales.map((comercial) => (
                    <SelectItem key={comercial} value={comercial}>
                      {comercial}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center space-x-2">
                <ArrowUpDown className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-700">Ordenar:</span>
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fecha_desc">Más recientes</SelectItem>
                  <SelectItem value="fecha_asc">Más antiguos</SelectItem>
                  <SelectItem value="total_desc">Mayor valor</SelectItem>
                  <SelectItem value="total_asc">Menor valor</SelectItem>
                  <SelectItem value="nombre">Por nombre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Resultados de filtros */}
          {(searchTerm || filterStatus !== "all" || filterCliente !== "all") && (
            <div className="mt-4 flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {filteredAndSortedData.length}
                </span>{" "}
                cotización(es) encontrada(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setFilterStatus("all");
                  setFilterCliente("all");
                }}
                className="h-8 text-muted-foreground hover:text-foreground"
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid de cotizaciones */}
      {filteredAndSortedData.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="px-4 py-16 text-center">
            <Calculator
              className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40"
              strokeWidth={1.25}
            />
            <h3 className="font-serif text-lg text-foreground">
              {searchTerm || filterStatus !== "all" ? "Sin resultados" : "Sin cotizaciones"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {searchTerm || filterStatus !== "all"
                ? "No se encontraron cotizaciones que coincidan con los filtros aplicados."
                : "Comienza creando tu primera cotización para gestionar presupuestos."}
            </p>
            {!searchTerm && filterStatus === "all" && (
              <Button onClick={() => nav("/cotizaciones/nueva")} className="mt-6">
                <Plus className="mr-2 h-4 w-4" />
                Crear primera cotización
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {paginatedData.map((c) => {
              const clienteName = c.cliente?.nombre || c.cliente_nombre || "Sin especificar";
              const clienteTipo = c.cliente?.tipo;
              const contactoNombre = c.contacto?.nombre;

              return (
                <Card
                  key={c.id}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => nav(`/cotizaciones/${c.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="line-clamp-2 min-w-0 flex-1 font-serif text-[17px] font-medium text-foreground">
                        {c.nombre_cotizacion}
                      </CardTitle>
                      {getStatusBadge(c.estado)}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Información del cliente */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {clienteTipo === "empresa" ? (
                          <Building2 className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                        )}
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-foreground/85">{clienteName}</span>
                          {clienteTipo && (
                            <Badge
                              variant="outline"
                              className="border-border bg-muted/40 text-xs font-normal text-muted-foreground"
                            >
                              {clienteTipo === "empresa" ? "Empresa" : "Persona"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {contactoNombre && (
                        <div className="ml-7 text-xs text-muted-foreground">
                          Contacto: <span className="text-foreground/75">{contactoNombre}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Layers className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                        <span className="text-foreground/85">
                          <span className="font-mono tabular-nums">{c.numero_invitados}</span> invitados
                        </span>
                      </div>

                      {c.created_at && (
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                          <span className="font-mono text-sm tabular-nums text-foreground/85">
                            {new Date(c.created_at).toLocaleDateString("es-CO")}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Total */}
                    <div className="flex items-baseline justify-between border-t border-border/60 pt-3">
                      <span className="kicker text-muted-foreground">Total cotizado</span>
                      <span className="font-mono text-[15px] font-semibold tabular-nums text-foreground">
                        ${c.total_cotizado.toLocaleString()}
                      </span>
                    </div>

                    {/* Botones de acción */}
                    <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        onClick={() => nav(`/cotizaciones/${c.id}`)}
                        className="w-full"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Abrir cotización
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={() => handleOpenPDFModal(c.id)}
                        disabled={downloadingPdf === c.id}
                        className="w-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {downloadingPdf === c.id ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                            Generando PDF…
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Propuesta Selecta
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-slate-600">Página {currentPage} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal para selección de opciones PDF */}
      {selectedCotizacion && (
        <CotizacionPDFModal
          isOpen={pdfModalOpen}
          onClose={() => {
            setPdfModalOpen(false);
            setSelectedCotizacion(null);
          }}
          versiones={selectedCotizacion.versiones}
          cotizacionName={selectedCotizacion.cotizacion.nombre_cotizacion}
          onDownload={handleGeneratePDF}
          isGenerating={downloadingPdf === selectedCotizacion.cotizacion.id}
        />
      )}
    </div>
  );
}
