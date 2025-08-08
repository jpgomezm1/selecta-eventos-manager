import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, ClipboardList, Eye, Download, DollarSign, Calendar, CreditCard, TrendingUp, Filter, Receipt, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RegistroPagoConEventos } from "@/types/database";
import { ComprobanteModal } from "./ComprobanteModal";

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

  useEffect(() => {
    fetchRegistrosPagos();
  }, [empleadoId]);

  const fetchRegistrosPagos = async () => {
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
      setRegistros(data as RegistroPagoConEventos[] || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar el registro de pagos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const registrosFiltrados = registros.filter(registro => {
    const matchMetodo = filtroMetodo === "todos" || registro.metodo_pago === filtroMetodo;
    const matchTipo = filtroTipo === "todos" || registro.tipo_liquidacion === filtroTipo;
    const matchFecha = !filtroFecha || registro.fecha_pago.includes(filtroFecha);
    const matchComprobante = !busquedaComprobante || 
      registro.numero_comprobante.toLowerCase().includes(busquedaComprobante.toLowerCase());
    
    return matchMetodo && matchTipo && matchFecha && matchComprobante;
  });

  const totalMesActual = registros
    .filter(r => r.fecha_pago.startsWith(new Date().toISOString().substring(0, 7)))
    .reduce((sum, r) => sum + r.monto_total, 0);

  const totalGeneral = registros.reduce((sum, r) => sum + r.monto_total, 0);

  const getTipoIcon = (tipo: string) => {
    return tipo === 'evento' 
      ? <FileText className="h-4 w-4 text-blue-600" />
      : <ClipboardList className="h-4 w-4 text-green-600" />;
  };

  const getTipoBadge = (tipo: string, cantidadEventos: number) => {
    if (tipo === 'evento') {
      return (
        <Badge className="bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
          <FileText className="h-3 w-3 mr-1" />
          Evento Individual
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200 shadow-sm hover:shadow-md transition-shadow">
          <ClipboardList className="h-3 w-3 mr-1" />
          Liquidación Múltiple ({cantidadEventos})
        </Badge>
      );
    }
  };

  const getMetodoBadge = (metodo: string) => {
    const configs = {
      efectivo: {
        class: "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200",
        icon: <DollarSign className="h-3 w-3 mr-1" />
      },
      transferencia: {
        class: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200",
        icon: <CreditCard className="h-3 w-3 mr-1" />
      },
      nomina: {
        class: "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200",
        icon: <Receipt className="h-3 w-3 mr-1" />
      },
      otro: {
        class: "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-gray-200",
        icon: <FileText className="h-3 w-3 mr-1" />
      }
    };
    
    const config = configs[metodo as keyof typeof configs] || configs.otro;
    
    return (
      <Badge className={`${config.class} shadow-sm hover:shadow-md transition-shadow font-medium`}>
        {config.icon}
        {metodo.charAt(0).toUpperCase() + metodo.slice(1)}
      </Badge>
    );
  };

  const handleVerComprobante = (registro: RegistroPagoConEventos) => {
    setRegistroSeleccionado(registro);
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-selecta-green to-primary rounded-3xl flex items-center justify-center mx-auto shadow-xl animate-pulse">
              <Receipt className="h-8 w-8 text-white" />
            </div>
            <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-3xl blur-xl animate-pulse mx-auto"></div>
          </div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent mb-2">
            Cargando Registro de Pagos
          </h3>
          <p className="text-slate-600">Preparando información de liquidaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Tarjetas de resumen premium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
          <CardHeader className="bg-gradient-to-r from-blue-50/80 to-blue-100/80 border-b border-blue-200/30">
            <div className="flex items-center justify-between">
              <Receipt className="h-8 w-8 text-blue-600" />
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-1">
                {registros.length}
              </div>
              <p className="text-sm font-semibold text-blue-600 mb-1">Pagos Totales</p>
              <p className="text-xs text-slate-500">Registros históricos</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
          <CardHeader className="bg-gradient-to-r from-emerald-50/80 to-emerald-100/80 border-b border-emerald-200/30">
            <div className="flex items-center justify-between">
              <Calendar className="h-8 w-8 text-emerald-600" />
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent mb-1">
                ${totalMesActual.toLocaleString()}
              </div>
              <p className="text-sm font-semibold text-emerald-600 mb-1">Este Mes</p>
              <p className="text-xs text-slate-500">
                {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden group hover:scale-105 transition-transform duration-300">
          <CardHeader className="bg-gradient-to-r from-purple-50/80 to-purple-100/80 border-b border-purple-200/30">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent mb-1">
                ${totalGeneral.toLocaleString()}
              </div>
              <p className="text-sm font-semibold text-purple-600 mb-1">Total Acumulado</p>
              <p className="text-xs text-slate-500">Todos los pagos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de registros premium */}
      <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm border-b border-slate-200/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-selecta-green to-primary rounded-2xl flex items-center justify-center shadow-lg">
                <Receipt className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-800">Registro Oficial de Pagos</CardTitle>
                <CardDescription className="text-slate-600">Constancias y comprobantes de liquidaciones</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Filtros premium */}
          <div className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-slate-200/30">
            <div className="flex items-center space-x-3 mb-4">
              <Filter className="h-5 w-5 text-slate-600" />
              <h4 className="text-lg font-semibold text-slate-800">Filtros de Búsqueda</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="filtro-metodo" className="text-slate-700 font-medium">Método de pago</Label>
                <Select value={filtroMetodo} onValueChange={setFiltroMetodo}>
                  <SelectTrigger className="bg-white/80 border-slate-200/50 rounded-2xl h-11 shadow-sm hover:shadow-md transition-all">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/30 rounded-2xl shadow-2xl">
                    <SelectItem value="todos">Todos los métodos</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="nomina">Nómina</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filtro-tipo" className="text-slate-700 font-medium">Tipo de liquidación</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="bg-white/80 border-slate-200/50 rounded-2xl h-11 shadow-sm hover:shadow-md transition-all">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/30 rounded-2xl shadow-2xl">
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    <SelectItem value="evento">Evento individual</SelectItem>
                    <SelectItem value="multiple">Liquidación múltiple</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filtro-fecha" className="text-slate-700 font-medium">Período (año-mes)</Label>
                <Input
                  id="filtro-fecha"
                  type="month"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                  placeholder="2025-01"
                  className="bg-white/80 border-slate-200/50 rounded-2xl h-11 shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-selecta-green/20"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="busqueda-comprobante" className="text-slate-700 font-medium">Buscar comprobante</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="busqueda-comprobante"
                    placeholder="TXN-20250704-001"
                    value={busquedaComprobante}
                    onChange={(e) => setBusquedaComprobante(e.target.value)}
                    className="bg-white/80 border-slate-200/50 rounded-2xl h-11 pl-10 shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-selecta-green/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {registrosFiltrados.length === 0 ? (
            <div className="text-center py-16">
              <div className="relative mb-8">
                <div className="w-24 h-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                  <Receipt className="h-12 w-12 text-slate-400" />
                </div>
                <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-slate-100/50 to-slate-200/50 rounded-3xl blur-xl mx-auto"></div>
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">
                {registros.length === 0 ? "Sin pagos registrados" : "No se encontraron registros"}
              </h3>
              <p className="text-slate-600 text-lg max-w-md mx-auto">
                {registros.length === 0 
                  ? "Este empleado aún no tiene pagos procesados en el sistema" 
                  : "Intenta ajustar los filtros para encontrar los registros que buscas"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-600 bg-slate-50/80 rounded-full px-4 py-2">
                  Mostrando {registrosFiltrados.length} de {registros.length} registros
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-white/80 border-slate-200/50 rounded-2xl hover:bg-white hover:shadow-md transition-all"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>

              <div className="bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden shadow-lg border border-slate-200/30">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200/40 bg-gradient-to-r from-slate-50/80 to-slate-100/80">
                      <TableHead className="text-slate-800 font-bold py-4">Fecha Pago</TableHead>
                      <TableHead className="text-slate-800 font-bold py-4">Tipo</TableHead>
                      <TableHead className="text-slate-800 font-bold py-4">Monto</TableHead>
                      <TableHead className="text-slate-800 font-bold py-4">Método</TableHead>
                      <TableHead className="text-slate-800 font-bold py-4">Comprobante</TableHead>
                      <TableHead className="text-right text-slate-800 font-bold py-4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrosFiltrados.map((registro, index) => (
                      <TableRow 
                        key={registro.id} 
                        className="border-slate-200/30 hover:bg-gradient-to-r hover:from-selecta-green/5 hover:to-primary/5 transition-all duration-200 group"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center space-x-2">
                            <Calendar className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold text-slate-800">
                              {new Date(registro.fecha_pago).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {getTipoBadge(registro.tipo_liquidacion, registro.eventos.length)}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-4 w-4 text-selecta-green" />
                            <span className="font-bold text-slate-800">
                              ${registro.monto_total.toLocaleString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {getMetodoBadge(registro.metodo_pago)}
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-mono text-sm bg-slate-50/80 rounded-lg px-3 py-1 border border-slate-200/50">
                            {registro.numero_comprobante}
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerComprobante(registro)}
                            className="bg-white/80 border-blue-200/60 text-blue-700 hover:bg-blue-50 hover:border-blue-300 rounded-xl opacity-70 group-hover:opacity-100 transition-all duration-200 hover:scale-105"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalle
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Resumen del filtro */}
              {registrosFiltrados.length > 0 && (
                <div className="bg-gradient-to-r from-selecta-green/10 to-primary/10 backdrop-blur-sm p-6 rounded-2xl border border-selecta-green/20">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-selecta-green to-primary rounded-2xl flex items-center justify-center shadow-lg">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 text-lg">
                          Resumen del período: {registrosFiltrados.length} pagos
                        </span>
                        <p className="text-sm text-slate-600">Liquidaciones procesadas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-600 mb-1">TOTAL PERÍODO</p>
                      <span className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                        ${registrosFiltrados.reduce((sum, r) => sum + r.monto_total, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ComprobanteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        registroPago={registroSeleccionado}
        empleadoNombre={empleadoNombre}
      />
    </div>
  );
}