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
import { useState, useMemo } from "react";
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
  Sparkles, 
  TrendingUp, 
  Clock, 
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
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["cotizaciones"],
    queryFn: listCotizaciones,
  });

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
        class: "bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-700 border-yellow-200",
        icon: <Clock className="h-3 w-3 mr-1" />,
        label: "Pendiente"
      },
      "Cotización Aprobada": {
        class: "bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200",
        icon: <CheckCircle className="h-3 w-3 mr-1" />,
        label: "Aprobada"
      },
      "Rechazada": {
        class: "bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-red-200",
        icon: <AlertTriangle className="h-3 w-3 mr-1" />,
        label: "Rechazada"
      },
      "Enviada": {
        class: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200",
        icon: <FileText className="h-3 w-3 mr-1" />,
        label: "Enviada"
      }
    };
    
    const config = configs[estado as keyof typeof configs] || configs["Pendiente por Aprobación"];
    return (
      <Badge className={`${config.class} shadow-sm font-semibold border`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

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
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-selecta-green to-primary rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl animate-bounce">
                <Calculator className="h-12 w-12 text-white animate-pulse" />
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent mb-3">
                Cargando Cotizaciones
              </h3>
              <p className="text-slate-600 text-lg">Obteniendo lista de cotizaciones...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-red-100/20 to-orange-100/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 container mx-auto px-4 py-8">
          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl">
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-red-500 to-orange-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <AlertTriangle className="h-12 w-12 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-red-600 mb-3">Error al cargar cotizaciones</h3>
              <p className="text-slate-600 text-lg mb-6">No se pudieron obtener las cotizaciones</p>
              <Button 
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-xl transition-all duration-300 rounded-2xl px-6 py-3"
              >
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Elementos decorativos de fondo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 right-1/4 w-32 h-32 bg-gradient-to-r from-purple-100/40 to-pink-100/40 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 space-y-8">
        {/* Header premium */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start space-x-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-selecta-green via-primary to-selecta-green rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <Calculator className="h-8 w-8 text-white" />
                </div>
                <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-3xl blur-xl"></div>
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-selecta-green via-primary to-selecta-green bg-clip-text text-transparent leading-tight">
                  Cotizaciones
                </h1>
                <p className="text-slate-600 text-lg font-medium mt-2 max-w-md">
                  Gestión completa de cotizaciones y presupuestos
                </p>
              </div>
            </div>
            
            {/* Línea decorativa animada */}
            <div className="flex items-center justify-center lg:justify-start space-x-2 mb-4">
              <div className="w-16 h-1 bg-gradient-to-r from-selecta-green to-primary rounded-full"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <div className="w-8 h-1 bg-gradient-to-r from-primary to-selecta-green rounded-full"></div>
            </div>
            
            {/* Stats mejoradas */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg border border-white/30 hover:shadow-xl transition-shadow">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-slate-700">{stats.total} cotizaciones</span>
                </div>
              </div>
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg border border-white/30 hover:shadow-xl transition-shadow">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-3 h-3 text-selecta-green" />
                  <span className="text-sm font-bold text-slate-700">${stats.totalValue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Botón Nueva Cotización */}
          <Button 
            onClick={() => nav("/cotizador/nueva")}
            className="group bg-gradient-to-r from-selecta-green to-primary hover:from-primary hover:to-selecta-green shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-8 py-4 border-0 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Plus className="h-5 w-5 mr-3 relative z-10" />
            <span className="font-bold relative z-10">Nueva Cotización</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-blue-50/80 to-blue-100/80 border-b border-blue-200/30 pb-3">
              <div className="flex items-center justify-between">
                <Calculator className="h-6 w-6 text-blue-600" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
                <p className="text-xs text-blue-600 font-medium">Total</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-slate-50/80 to-slate-100/80 border-b border-slate-200/30 pb-3">
              <div className="flex items-center justify-between">
                <FileText className="h-6 w-6 text-slate-600" />
                <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-slate-600">{stats.pendiente}</div>
                <p className="text-xs text-slate-600 font-medium">Pendientes</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-green-50/80 to-green-100/80 border-b border-green-200/30 pb-3">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats.aprobado}</div>
                <p className="text-xs text-green-600 font-medium">Aprobadas</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
            <CardHeader className="bg-gradient-to-r from-emerald-50/80 to-emerald-100/80 border-b border-emerald-200/30 pb-3">
              <div className="flex items-center justify-between">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-xl font-bold text-emerald-600">${(stats.totalValue / 1000000).toFixed(1)}M</div>
                <p className="text-xs text-emerald-600 font-medium">Valor Total</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros y búsqueda premium */}
        <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
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
                    className="pl-10 bg-white/90 border-slate-200/50 rounded-2xl h-12 shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
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
                  <SelectTrigger className="w-40 bg-white/90 border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl shadow-2xl">
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
                  <SelectTrigger className="w-48 bg-white/90 border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl shadow-2xl">
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
                  <SelectTrigger className="w-48 bg-white/90 border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl shadow-2xl">
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
              <div className="mt-4 p-3 bg-gradient-to-r from-blue-50/60 to-blue-100/60 rounded-2xl border border-blue-200/40">
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
                    className="text-blue-700 hover:text-blue-800 hover:bg-blue-100 rounded-xl"
                  >
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grid de cotizaciones premium */}
        {filteredAndSortedData.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl">
            <CardContent className="p-16 text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl">
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
                  className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-xl hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Crear Primera Cotización
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAndSortedData.map((c, index) => (
              <Card 
                key={c.id} 
                className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border-2 border-slate-200/40 hover:border-selecta-green/40 hover:shadow-2xl transition-all duration-300 group overflow-hidden cursor-pointer transform hover:scale-[1.02]"
                onClick={() => nav(`/cotizador/${c.id}`)}
                style={{
                  animationDelay: `${index * 100}ms`
                }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <CardTitle className="text-lg font-bold text-slate-800 line-clamp-2 group-hover:text-selecta-green transition-colors flex-1 min-w-0">
                      {c.nombre_cotizacion}
                    </CardTitle>
                    {getStatusBadge(c.estado)}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Información del cliente */}
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-slate-600 group/item hover:text-selecta-green transition-colors">
                      <Users className="h-4 w-4 mr-3 text-selecta-green group-hover/item:scale-110 transition-transform" />
                      <span className="font-semibold">Cliente: {c.cliente_nombre || "Sin especificar"}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-slate-600 group/item hover:text-selecta-green transition-colors">
                      <Users className="h-4 w-4 mr-3 text-selecta-green group-hover/item:scale-110 transition-transform" />
                      <span className="font-semibold">Invitados: {c.numero_invitados}</span>
                    </div>

                    {c.created_at && (
                      <div className="flex items-center text-sm text-slate-600 group/item hover:text-selecta-green transition-colors">
                        <Calendar className="h-4 w-4 mr-3 text-selecta-green group-hover/item:scale-110 transition-transform" />
                        <span className="font-semibold">
                          {new Date(c.created_at).toLocaleDateString('es-CO')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total destacado */}
                  <div className="p-4 bg-gradient-to-r from-emerald-50/80 to-green-50/80 rounded-2xl border border-emerald-200/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <DollarSign className="h-5 w-5 text-emerald-600" />
                        <span className="text-sm font-semibold text-emerald-700">Total Cotizado:</span>
                      </div>
                      <div className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                        ${c.total_cotizado.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Botones de acción */}
                  <div className="pt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      onClick={() => nav(`/cotizador/${c.id}`)}
                      className="w-full bg-white hover:bg-slate-50 border-slate-200 hover:border-selecta-green/40 rounded-2xl transition-all duration-200 hover:shadow-md group/btn"
                    >
                      <Eye className="h-4 w-4 mr-2 group-hover/btn:text-selecta-green transition-colors" />
                      <span className="font-semibold">Abrir Cotización</span>
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleOpenPDFModal(c.id)}
                      disabled={downloadingPdf === c.id}
                      className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200 hover:border-blue-300 text-blue-700 hover:text-blue-800 rounded-2xl transition-all duration-200 hover:shadow-md group/btn"
                    >
                      {downloadingPdf === c.id ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-blue-300 border-t-blue-700 rounded-full mr-2" />
                          <span className="font-semibold">Generando PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2 group-hover/btn:text-blue-600 transition-colors" />
                          <span className="font-semibold">Propuesta Selecta</span>
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Footer informativo */}
        <div className="text-center pt-8">
          <div className="inline-flex items-center justify-center space-x-4 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/30">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-600">Sistema de cotizaciones</span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <div className="flex items-center space-x-2">
              <Calculator className="h-4 w-4 text-slate-500" />
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