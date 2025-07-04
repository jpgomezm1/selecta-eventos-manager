import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, ClipboardList, Eye, Download, DollarSign, Calendar, CreditCard } from "lucide-react";
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
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
        <FileText className="h-3 w-3 mr-1" />
        Evento
      </Badge>;
    } else {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <ClipboardList className="h-3 w-3 mr-1" />
        Múltiple ({cantidadEventos})
      </Badge>;
    }
  };

  const getMetodoBadge = (metodo: string) => {
    const colors = {
      efectivo: "bg-orange-50 text-orange-700 border-orange-200",
      transferencia: "bg-blue-50 text-blue-700 border-blue-200",
      nomina: "bg-purple-50 text-purple-700 border-purple-200",
      otro: "bg-gray-50 text-gray-700 border-gray-200"
    };
    
    return (
      <Badge variant="outline" className={colors[metodo as keyof typeof colors] || colors.otro}>
        <CreditCard className="h-3 w-3 mr-1" />
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando registro de pagos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{registros.length}</div>
            <p className="text-xs text-muted-foreground">Registros históricos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Este Mes</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalMesActual.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Acumulado</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${totalGeneral.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Todos los pagos</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Registro de Pagos</CardTitle>
          <CardDescription>Constancia oficial de liquidaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label htmlFor="filtro-metodo">Método de pago</Label>
              <Select value={filtroMetodo} onValueChange={setFiltroMetodo}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="nomina">Nómina</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filtro-tipo">Tipo de liquidación</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="evento">Evento individual</SelectItem>
                  <SelectItem value="multiple">Liquidación múltiple</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="filtro-fecha">Fecha (año-mes)</Label>
              <Input
                id="filtro-fecha"
                type="month"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                placeholder="2025-01"
              />
            </div>

            <div>
              <Label htmlFor="busqueda-comprobante">Buscar comprobante</Label>
              <Input
                id="busqueda-comprobante"
                placeholder="TXN-20250704-001"
                value={busquedaComprobante}
                onChange={(e) => setBusquedaComprobante(e.target.value)}
              />
            </div>
          </div>

          {registrosFiltrados.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {registros.length === 0 
                  ? "No hay pagos registrados" 
                  : "No se encontraron pagos con los filtros seleccionados"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Mostrando {registrosFiltrados.length} de {registros.length} registros
                </p>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha Pago</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Comprobante</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrosFiltrados.map((registro) => (
                      <TableRow key={registro.id}>
                        <TableCell>
                          {new Date(registro.fecha_pago).toLocaleDateString('es-CO')}
                        </TableCell>
                        <TableCell>
                          {getTipoBadge(registro.tipo_liquidacion, registro.eventos.length)}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            ${registro.monto_total.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getMetodoBadge(registro.metodo_pago)}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">
                            {registro.numero_comprobante}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleVerComprobante(registro)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Resumen del filtro */}
              {registrosFiltrados.length > 0 && (
                <div className="bg-muted p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      Resumen del período: {registrosFiltrados.length} pagos
                    </span>
                    <span className="text-lg font-bold">
                      TOTAL: ${registrosFiltrados.reduce((sum, r) => sum + r.monto_total, 0).toLocaleString()}
                    </span>
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