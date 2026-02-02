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
  FileText,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  X,
  ArrowUpDown,
  Download
} from "lucide-react";

export default function CotizacionesListPage() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterComercial, setFilterComercial] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("fecha_desc");
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedCotizacion, setSelectedCotizacion] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ["cotizaciones"],
    queryFn: listCotizaciones,
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterComercial, sortBy]);

  // Obtener lista de comerciales únicos
  const comerciales = useMemo(() => {
    if (!data) return [];
    return [...new Set(data
      .map(c => c.comercial_encargado)
      .filter(Boolean)
    )].sort();
  }, [data]);

  // Filtros y ordenamiento
  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];

    let filtered = data.filter(c => {
      const matchesSearch = c.nombre_cotizacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (c.cliente_nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || c.estado === filterStatus;
      const matchesComercial = filterComercial === 'all' || c.comercial_encargado === filterComercial;

      return matchesSearch && matchesStatus && matchesComercial;
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
  }, [data, searchTerm, filterStatus, filterComercial, sortBy]);

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
      console.error('Error loading cotización:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información de la cotización.",
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
      console.error('Error generating PDF:', error);
      toast({
        title: "Error al generar PDF",
        description: "No se pudo generar la propuesta. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setDownloadingPdf(null);
    }
  };

  const getStatusBadge = (estado: string) => {
    const configs = {
      "Pendiente por Aprobación": {
        class: "bg-yellow-50 text-yellow-700 border-yellow-200",
        label: "Pendiente"
      },
      "Cotización Aprobada": {
        class: "bg-green-50 text-green-700 border-green-200",
        label: "Aprobada"
      },
      "Rechazada": {
        class: "bg-red-50 text-red-700 border-red-200",
        label: "Rechazada"
      },
      "Enviada": {
        class: "bg-blue-50 text-blue-700 border-blue-200",
        label: "Enviada"
      }
    };

    const config = configs[estado as keyof typeof configs] || configs["Pendiente por Aprobación"];
    return (
      <Badge className={`${config.class} font-semibold border`}>
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
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cotizaciones</h1>
          <p className="text-slate-500 mt-1">Gestión de cotizaciones y presupuestos</p>
        </div>
        <Button onClick={() => nav("/cotizador/nueva")}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Cotización
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Calculator className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-semibold text-slate-900">{stats.total}</div>
                <p className="text-sm text-slate-500">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-slate-600" />
              <div>
                <div className="text-2xl font-semibold text-slate-900">{stats.pendiente}</div>
                <p className="text-sm text-slate-500">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-semibold text-slate-900">{stats.aprobado}</div>
                <p className="text-sm text-slate-500">Aprobadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <div>
                <div className="text-xl font-semibold text-slate-900">${(stats.totalValue / 1000000).toFixed(1)}M</div>
                <p className="text-sm text-slate-500">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y búsqueda */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Búsqueda */}
            <div className="flex items-center space-x-3 flex-1 lg:max-w-md">
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
            <div className="flex items-center space-x-4">
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
          {(searchTerm || filterStatus !== 'all') && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200/40">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-blue-800">
                  {filteredAndSortedData.length} cotización(es) encontrada(s)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setFilterStatus("all");
                  }}
                  className="text-blue-700 hover:text-blue-800 hover:bg-blue-100"
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid de cotizaciones */}
      {filteredAndSortedData.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-8">
              <Calculator className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">
              {searchTerm || filterStatus !== 'all' ? "Sin resultados" : "Sin cotizaciones"}
            </h3>
            <p className="text-slate-600 text-lg max-w-md mx-auto mb-8">
              {searchTerm || filterStatus !== 'all'
                ? "No se encontraron cotizaciones que coincidan con los filtros aplicados"
                : "Comienza creando tu primera cotización para gestionar presupuestos"
              }
            </p>
            {!searchTerm && filterStatus === 'all' && (
              <Button
                onClick={() => nav("/cotizador/nueva")}
              >
                <Plus className="h-5 w-5 mr-2" />
                Crear Primera Cotización
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {paginatedData.map((c) => (
              <Card
                key={c.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => nav(`/cotizador/${c.id}`)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 line-clamp-2 flex-1 min-w-0">
                      {c.nombre_cotizacion}
                    </CardTitle>
                    {getStatusBadge(c.estado)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Información del cliente */}
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-slate-600">
                      <Users className="h-4 w-4 mr-3 text-selecta-green" />
                      <span className="font-semibold">Cliente: {c.cliente_nombre || "Sin especificar"}</span>
                    </div>

                    <div className="flex items-center text-sm text-slate-600">
                      <Users className="h-4 w-4 mr-3 text-selecta-green" />
                      <span className="font-semibold">Invitados: {c.numero_invitados}</span>
                    </div>

                    {c.created_at && (
                      <div className="flex items-center text-sm text-slate-600">
                        <Calendar className="h-4 w-4 mr-3 text-selecta-green" />
                        <span className="font-semibold">
                          {new Date(c.created_at).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total destacado */}
                  <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700">Total Cotizado:</span>
                      </div>
                      <div className="text-xl font-bold text-emerald-600">
                        ${c.total_cotizado.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="pt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      onClick={() => nav(`/cotizador/${c.id}`)}
                      className="w-full"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      <span className="font-semibold">Abrir Cotización</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleOpenPDFModal(c.id)}
                      disabled={downloadingPdf === c.id}
                      className="w-full bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-300 text-blue-700 hover:text-blue-800"
                    >
                      {downloadingPdf === c.id ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full mr-2" />
                          <span className="font-semibold">Generando PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          <span className="font-semibold">Propuesta Selecta</span>
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
