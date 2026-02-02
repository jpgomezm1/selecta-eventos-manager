import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, DollarSign, Clock, CheckCircle, AlertCircle, Eye, Download, BarChart3, User, CreditCard, TrendingUp, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Personal, EventoPersonal, Evento } from "@/types/database";
import { RegistroPagos } from "@/components/Forms/RegistroPagos";
import { getModalidadCobroLabel } from "@/lib/calcularPagoPersonal";

interface TrabajoConEvento extends EventoPersonal {
  evento: Evento;
}

interface FormularioPago {
  fecha_pago: string;
  metodo_pago: 'efectivo' | 'transferencia' | 'nomina' | 'otro';
  notas_pago: string;
}

const ITEMS_PER_PAGE = 10;

export default function PersonalDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [personal, setPersonal] = useState<Personal | null>(null);
  const [trabajos, setTrabajos] = useState<TrabajoConEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [formularioPago, setFormularioPago] = useState<FormularioPago>({
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'efectivo',
    notas_pago: ''
  });
  const [trabajoSeleccionado, setTrabajoSeleccionado] = useState<TrabajoConEvento | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Estados para liquidación múltiple
  const [eventosSeleccionados, setEventosSeleccionados] = useState<Set<string>>(new Set());
  const [isLiquidacionMasivaOpen, setIsLiquidacionMasivaOpen] = useState(false);
  const [isConfirmacionMasivaOpen, setIsConfirmacionMasivaOpen] = useState(false);
  const [formularioLiquidacionMasiva, setFormularioLiquidacionMasiva] = useState<FormularioPago>({
    fecha_pago: new Date().toISOString().split('T')[0],
    metodo_pago: 'transferencia',
    notas_pago: ''
  });

  useEffect(() => {
    if (id) {
      fetchPersonalData();
      fetchTrabajos();
    }
  }, [id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroEstado]);

  const fetchPersonalData = async () => {
    try {
      const { data, error } = await supabase
        .from("personal")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPersonal(data as Personal);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar datos del personal",
        variant: "destructive",
      });
      navigate("/personal");
    }
  };

  const fetchTrabajos = async () => {
    try {
      const { data, error } = await supabase
        .from("evento_personal")
        .select(`
          *,
          evento:eventos(*)
        `)
        .eq("personal_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTrabajos(data as TrabajoConEvento[] || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar historial de trabajos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarPagado = async () => {
    if (!trabajoSeleccionado) return;

    try {
      const { error } = await supabase
        .from("evento_personal")
        .update({
          estado_pago: 'pagado',
          fecha_pago: formularioPago.fecha_pago,
          metodo_pago: formularioPago.metodo_pago,
          notas_pago: formularioPago.notas_pago || null
        })
        .eq("id", trabajoSeleccionado.id);

      if (error) throw error;

      const { data: numeroComprobante } = await supabase.rpc('generate_comprobante_number');

      const { data: registroPago, error: errorRegistro } = await supabase
        .from("registro_pagos")
        .insert({
          empleado_id: id,
          fecha_pago: formularioPago.fecha_pago,
          tipo_liquidacion: 'evento',
          monto_total: trabajoSeleccionado.pago_calculado || 0,
          metodo_pago: formularioPago.metodo_pago,
          notas: formularioPago.notas_pago || null,
          usuario_liquidador: 'Sistema',
          numero_comprobante: numeroComprobante
        })
        .select()
        .single();

      if (errorRegistro) throw errorRegistro;

      const { error: errorRelacion } = await supabase
        .from("registro_pago_eventos")
        .insert({
          registro_pago_id: registroPago.id,
          evento_id: trabajoSeleccionado.evento_id,
          horas_trabajadas: trabajoSeleccionado.horas_trabajadas || 0,
          monto_evento: trabajoSeleccionado.pago_calculado || 0
        });

      if (errorRelacion) throw errorRelacion;

      toast({
        title: "Pago registrado",
        description: "El pago se ha marcado como realizado exitosamente",
      });

      fetchTrabajos();
      setIsDialogOpen(false);
      resetFormulario();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al registrar el pago",
        variant: "destructive",
      });
    }
  };

  const resetFormulario = () => {
    setFormularioPago({
      fecha_pago: new Date().toISOString().split('T')[0],
      metodo_pago: 'efectivo',
      notas_pago: ''
    });
    setTrabajoSeleccionado(null);
  };

  // Funciones para selección múltiple
  const eventosPendientes = trabajos.filter(t => t.estado_pago === 'pendiente');

  const handleSeleccionarEvento = (eventoId: string, seleccionado: boolean) => {
    const nuevaSeleccion = new Set(eventosSeleccionados);
    if (seleccionado) {
      nuevaSeleccion.add(eventoId);
    } else {
      nuevaSeleccion.delete(eventoId);
    }
    setEventosSeleccionados(nuevaSeleccion);
  };

  const handleSeleccionarTodos = (seleccionarTodos: boolean) => {
    if (seleccionarTodos) {
      const todosLosPendientes = new Set(eventosPendientes.map(t => t.id));
      setEventosSeleccionados(todosLosPendientes);
    } else {
      setEventosSeleccionados(new Set());
    }
  };

  const eventosSeleccionadosList = trabajos.filter(t => eventosSeleccionados.has(t.id));
  const totalEventosSeleccionados = eventosSeleccionadosList.length;
  const totalPagoSeleccionado = eventosSeleccionadosList.reduce((sum, t) => sum + (t.pago_calculado || 0), 0);
  const totalHorasSeleccionadas = eventosSeleccionadosList.reduce((sum, t) => sum + (t.horas_trabajadas || 0), 0);

  const handleLiquidacionMasiva = async () => {
    if (eventosSeleccionados.size === 0) return;

    try {
      const { error } = await supabase
        .from("evento_personal")
        .update({
          estado_pago: 'pagado',
          fecha_pago: formularioLiquidacionMasiva.fecha_pago,
          metodo_pago: formularioLiquidacionMasiva.metodo_pago,
          notas_pago: formularioLiquidacionMasiva.notas_pago || null
        })
        .in("id", Array.from(eventosSeleccionados));

      if (error) throw error;

      const eventosIds = new Set(eventosSeleccionadosList.map(t => t.evento_id));

      for (const eventoId of eventosIds) {
        if (eventoId) {
          const { data: todosLosEmpleados } = await supabase
            .from("evento_personal")
            .select("estado_pago")
            .eq("evento_id", eventoId);

          const todosEmpleadosPagados = todosLosEmpleados?.every(emp => emp.estado_pago === 'pagado');

          if (todosEmpleadosPagados) {
            await supabase
              .from("eventos")
              .update({
                estado_liquidacion: 'liquidado',
                fecha_liquidacion: formularioLiquidacionMasiva.fecha_pago
              })
              .eq("id", eventoId);
          }
        }
      }

      toast({
        title: "Liquidación confirmada",
        description: `Se han liquidado ${totalEventosSeleccionados} eventos por un total de $${totalPagoSeleccionado.toLocaleString()}`,
      });

      setEventosSeleccionados(new Set());
      setIsLiquidacionMasivaOpen(false);
      setIsConfirmacionMasivaOpen(false);
      setFormularioLiquidacionMasiva({
        fecha_pago: new Date().toISOString().split('T')[0],
        metodo_pago: 'transferencia',
        notas_pago: ''
      });

      fetchTrabajos();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al procesar la liquidación masiva",
        variant: "destructive",
      });
    }
  };

  const trabajosFiltrados = trabajos.filter(trabajo => {
    if (filtroEstado === "todos") return true;
    return trabajo.estado_pago === filtroEstado;
  });

  // Pagination
  const totalPages = Math.ceil(trabajosFiltrados.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTrabajos = trabajosFiltrados.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const totalPendiente = trabajos
    .filter(t => t.estado_pago === 'pendiente')
    .reduce((sum, t) => sum + (t.pago_calculado || 0), 0);

  const totalPagado = trabajos
    .filter(t => t.estado_pago === 'pagado')
    .reduce((sum, t) => sum + (t.pago_calculado || 0), 0);

  const totalTrabajos = trabajos.length;

  const getEstadoBadge = (estado: string, fechaEvento?: string) => {
    if (estado === 'pagado') {
      return (
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
          Pagado
        </Badge>
      );
    }

    if (fechaEvento) {
      const fechaEventoDate = new Date(fechaEvento);
      const hoy = new Date();
      const diffDias = Math.floor((hoy.getTime() - fechaEventoDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDias > 30) {
        return (
          <Badge variant="secondary" className="bg-red-50 text-red-700">
            Vencido ({diffDias}d)
          </Badge>
        );
      }
    }

    return (
      <Badge variant="secondary" className="bg-orange-50 text-orange-700">
        Pendiente
      </Badge>
    );
  };

  const getRoleBadgeVariant = (rol: string) => {
    const variants: Record<string, string> = {
      "Coordinador": "bg-purple-50 text-purple-700",
      "Chef": "bg-orange-50 text-orange-700",
      "Mesero": "bg-blue-50 text-blue-700",
      "Bartender": "bg-emerald-50 text-emerald-700",
      "Decorador": "bg-pink-50 text-pink-700",
      "Técnico de Sonido": "bg-indigo-50 text-indigo-700",
      "Fotógrafo": "bg-amber-50 text-amber-700",
      "Otro": "bg-slate-100 text-slate-700"
    };
    return variants[rol] || variants["Otro"];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-selecta-green rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (!personal) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <User className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-slate-900 font-medium">Personal no encontrado</p>
        <p className="text-slate-500 text-sm mt-1 mb-4">El empleado solicitado no existe en el sistema</p>
        <Button
          onClick={() => navigate("/personal")}
          variant="outline"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Personal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/personal")}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-selecta-green/10 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-selecta-green">
                {personal.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {personal.nombre_completo}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className={getRoleBadgeVariant(personal.rol)}>
                  {personal.rol}
                </Badge>
                <span className="text-sm text-slate-500">CC: {personal.numero_cedula}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">${Number(personal.tarifa).toLocaleString()}</span>
          <span className="text-slate-400">/</span>
          <span>{getModalidadCobroLabel(personal.modalidad_cobro)}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{totalTrabajos}</p>
              <p className="text-xs text-slate-500">Trabajos totales</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">${totalPendiente.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Pendiente</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">${totalPagado.toLocaleString()}</p>
              <p className="text-xs text-slate-500">Total pagado</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">
                ${totalTrabajos > 0 ? Math.round((totalPagado + totalPendiente) / totalTrabajos).toLocaleString() : '0'}
              </p>
              <p className="text-xs text-slate-500">Promedio/evento</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <Tabs defaultValue="historial">
          <div className="p-4 border-b border-slate-200">
            <TabsList className="grid w-full max-w-md grid-cols-3 h-9">
              <TabsTrigger value="historial" className="text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Historial
              </TabsTrigger>
              <TabsTrigger value="pagos" className="text-xs">
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                Pagos
              </TabsTrigger>
              <TabsTrigger value="estadisticas" className="text-xs">
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                Stats
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab: Historial */}
          <TabsContent value="historial" className="m-0">
            {/* Filtros */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                    <SelectTrigger className="w-48 h-9">
                      <Filter className="h-4 w-4 mr-2 text-slate-400" />
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los estados</SelectItem>
                      <SelectItem value="pendiente">Pendientes</SelectItem>
                      <SelectItem value="pagado">Pagados</SelectItem>
                    </SelectContent>
                  </Select>

                  {eventosPendientes.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="seleccionar-todos"
                        checked={eventosPendientes.length > 0 && eventosPendientes.every(t => eventosSeleccionados.has(t.id))}
                        onCheckedChange={handleSeleccionarTodos}
                      />
                      <Label htmlFor="seleccionar-todos" className="text-sm text-slate-600 cursor-pointer">
                        Seleccionar pendientes ({eventosPendientes.length})
                      </Label>
                    </div>
                  )}
                </div>

                <Button variant="outline" size="sm" className="h-9">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>

            {/* Banner de selección múltiple */}
            {eventosSeleccionados.size > 0 && (
              <div className="p-4 bg-emerald-50 border-b border-emerald-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm">
                    <span className="font-medium text-emerald-800">
                      {totalEventosSeleccionados} eventos seleccionados
                    </span>
                    <span className="text-emerald-600 ml-2">
                      · {totalHorasSeleccionadas}h · ${totalPagoSeleccionado.toLocaleString()}
                    </span>
                  </div>
                  <Button
                    onClick={() => setIsLiquidacionMasivaOpen(true)}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Liquidar Seleccionados
                  </Button>
                </div>
              </div>
            )}

            {/* Tabla o estado vacío */}
            {trabajosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <Calendar className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-slate-900 font-medium">
                  {trabajos.length === 0 ? "Sin trabajos registrados" : "Sin resultados"}
                </p>
                <p className="text-slate-500 text-sm mt-1">
                  {trabajos.length === 0
                    ? "Este empleado aún no tiene eventos asignados"
                    : "Intenta con otros criterios de búsqueda"
                  }
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      {eventosPendientes.length > 0 && (
                        <TableHead className="w-12"></TableHead>
                      )}
                      <TableHead className="font-medium">Fecha</TableHead>
                      <TableHead className="font-medium">Evento</TableHead>
                      <TableHead className="font-medium">Horas</TableHead>
                      <TableHead className="font-medium">Pago</TableHead>
                      <TableHead className="font-medium">Estado</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTrabajos.map((trabajo) => (
                      <TableRow key={trabajo.id} className="group">
                        {eventosPendientes.length > 0 && (
                          <TableCell>
                            {trabajo.estado_pago === 'pendiente' ? (
                              <Checkbox
                                checked={eventosSeleccionados.has(trabajo.id)}
                                onCheckedChange={(checked) => handleSeleccionarEvento(trabajo.id, checked as boolean)}
                              />
                            ) : (
                              <div className="h-4 w-4" />
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-slate-600">
                          {new Date(trabajo.evento.fecha_evento).toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          <button
                            className="font-medium text-slate-900 hover:text-selecta-green transition-colors text-left"
                            onClick={() => navigate(`/eventos`)}
                          >
                            {trabajo.evento.nombre_evento}
                          </button>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {trabajo.horas_trabajadas ? `${trabajo.horas_trabajadas}h` : '-'}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-slate-900">
                            ${Number(trabajo.pago_calculado || 0).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getEstadoBadge(trabajo.estado_pago, trabajo.evento.fecha_evento)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {trabajo.estado_pago === 'pendiente' && !eventosSeleccionados.has(trabajo.id) && (
                              <Dialog open={isDialogOpen && trabajoSeleccionado?.id === trabajo.id} onOpenChange={(open) => {
                                if (!open) {
                                  setIsDialogOpen(false);
                                  resetFormulario();
                                }
                              }}>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setTrabajoSeleccionado(trabajo);
                                      setIsDialogOpen(true);
                                    }}
                                    className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    <span className="text-xs">Pagar</span>
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                  <DialogHeader>
                                    <DialogTitle>Registrar Pago</DialogTitle>
                                    <DialogDescription>
                                      Confirma el pago de este evento
                                    </DialogDescription>
                                  </DialogHeader>

                                  <div className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-lg">
                                      <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                          <p className="text-slate-500">Evento</p>
                                          <p className="font-medium text-slate-900">{trabajo.evento.nombre_evento}</p>
                                        </div>
                                        <div>
                                          <p className="text-slate-500">Horas</p>
                                          <p className="font-medium text-slate-900">{trabajo.horas_trabajadas}h</p>
                                        </div>
                                        <div className="col-span-2">
                                          <p className="text-slate-500">Monto a pagar</p>
                                          <p className="text-lg font-semibold text-emerald-600">${Number(trabajo.pago_calculado || 0).toLocaleString()}</p>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <div className="space-y-1.5">
                                        <Label htmlFor="fecha_pago" className="text-sm">Fecha de pago</Label>
                                        <Input
                                          id="fecha_pago"
                                          type="date"
                                          value={formularioPago.fecha_pago}
                                          onChange={(e) => setFormularioPago(prev => ({
                                            ...prev,
                                            fecha_pago: e.target.value
                                          }))}
                                          className="h-9"
                                        />
                                      </div>

                                      <div className="space-y-1.5">
                                        <Label htmlFor="metodo_pago" className="text-sm">Método de pago</Label>
                                        <Select
                                          value={formularioPago.metodo_pago}
                                          onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') =>
                                            setFormularioPago(prev => ({ ...prev, metodo_pago: value }))
                                          }
                                        >
                                          <SelectTrigger className="h-9">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="efectivo">Efectivo</SelectItem>
                                            <SelectItem value="transferencia">Transferencia</SelectItem>
                                            <SelectItem value="nomina">Nómina</SelectItem>
                                            <SelectItem value="otro">Otro</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>

                                      <div className="space-y-1.5">
                                        <Label htmlFor="notas_pago" className="text-sm">Notas (opcional)</Label>
                                        <Textarea
                                          id="notas_pago"
                                          placeholder="Observaciones..."
                                          value={formularioPago.notas_pago}
                                          onChange={(e) => setFormularioPago(prev => ({
                                            ...prev,
                                            notas_pago: e.target.value
                                          }))}
                                          className="min-h-[80px]"
                                        />
                                      </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setIsDialogOpen(false);
                                          resetFormulario();
                                        }}
                                      >
                                        Cancelar
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={handleMarcarPagado}
                                        className="bg-selecta-green hover:bg-selecta-green/90"
                                      >
                                        Confirmar Pago
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/eventos`)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="h-4 w-4 text-slate-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                    <p className="text-sm text-slate-500">
                      {startIndex + 1}-{Math.min(endIndex, trabajosFiltrados.length)} de {trabajosFiltrados.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          if (totalPages <= 5) return true;
                          if (page === 1 || page === totalPages) return true;
                          if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                          return false;
                        })
                        .map((page, index, array) => (
                          <span key={page} className="flex items-center">
                            {index > 0 && array[index - 1] !== page - 1 && (
                              <span className="px-1 text-slate-400">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "ghost"}
                              size="sm"
                              onClick={() => goToPage(page)}
                              className={`h-8 w-8 p-0 ${
                                currentPage === page ? "bg-selecta-green hover:bg-selecta-green/90" : ""
                              }`}
                            >
                              {page}
                            </Button>
                          </span>
                        ))
                      }

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Tab: Pagos */}
          <TabsContent value="pagos" className="p-4">
            <RegistroPagos empleadoId={id!} empleadoNombre={personal.nombre_completo} />
          </TabsContent>

          {/* Tab: Estadísticas */}
          <TabsContent value="estadisticas" className="p-4">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <p className="text-slate-900 font-medium">Estadísticas Avanzadas</p>
              <p className="text-slate-500 text-sm mt-1 mb-4">Análisis de rendimiento y métricas</p>
              <Badge variant="secondary" className="bg-purple-50 text-purple-700">
                Próximamente
              </Badge>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Dialog: Liquidación Consolidada */}
      <Dialog open={isLiquidacionMasivaOpen} onOpenChange={setIsLiquidacionMasivaOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Liquidación Consolidada</DialogTitle>
            <DialogDescription>
              {personal?.nombre_completo} - {personal?.rol}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lista de eventos */}
            <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
              <div className="p-3 bg-slate-50 border-b border-slate-200 sticky top-0">
                <p className="text-sm font-medium text-slate-700">Eventos Seleccionados</p>
              </div>
              <div className="divide-y divide-slate-100">
                {eventosSeleccionadosList.map((trabajo) => (
                  <div key={trabajo.id} className="flex justify-between items-center px-3 py-2 text-sm">
                    <div>
                      <span className="text-slate-600">{new Date(trabajo.evento.fecha_evento).toLocaleDateString('es-CO')}</span>
                      <span className="ml-2 text-slate-900">{trabajo.evento.nombre_evento}</span>
                    </div>
                    <span className="font-medium text-slate-900">${(trabajo.pago_calculado || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-emerald-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm text-slate-700">
                <span>Total de eventos:</span>
                <span className="font-medium">{totalEventosSeleccionados}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-700">
                <span>Total horas:</span>
                <span className="font-medium">{totalHorasSeleccionadas.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-emerald-700 pt-2 border-t border-emerald-100">
                <span>Total a pagar:</span>
                <span>${totalPagoSeleccionado.toLocaleString()}</span>
              </div>
            </div>

            {/* Formulario */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">Método de pago</Label>
                  <Select
                    value={formularioLiquidacionMasiva.metodo_pago}
                    onValueChange={(value: 'efectivo' | 'transferencia' | 'nomina' | 'otro') =>
                      setFormularioLiquidacionMasiva(prev => ({ ...prev, metodo_pago: value }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="nomina">Nómina</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Fecha de pago</Label>
                  <Input
                    type="date"
                    value={formularioLiquidacionMasiva.fecha_pago}
                    onChange={(e) => setFormularioLiquidacionMasiva(prev => ({
                      ...prev,
                      fecha_pago: e.target.value
                    }))}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Notas (opcional)</Label>
                <Textarea
                  placeholder={`Liquidación de ${totalEventosSeleccionados} eventos`}
                  value={formularioLiquidacionMasiva.notas_pago}
                  onChange={(e) => setFormularioLiquidacionMasiva(prev => ({
                    ...prev,
                    notas_pago: e.target.value
                  }))}
                  className="min-h-[60px]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsLiquidacionMasivaOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                size="sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
              <Button
                size="sm"
                onClick={() => setIsConfirmacionMasivaOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Confirmar Liquidación
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmación */}
      <Dialog open={isConfirmacionMasivaOpen} onOpenChange={setIsConfirmacionMasivaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Confirmar Liquidación
            </DialogTitle>
            <DialogDescription>
              ¿Confirmas el pago para {personal?.nombre_completo}?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-orange-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Eventos:</span>
                <span className="font-medium text-slate-900">{totalEventosSeleccionados}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total:</span>
                <span className="font-medium text-slate-900">${totalPagoSeleccionado.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Método:</span>
                <span className="font-medium text-slate-900 capitalize">{formularioLiquidacionMasiva.metodo_pago}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              Esta acción no se puede deshacer
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmacionMasivaOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleLiquidacionMasiva}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Pago
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
