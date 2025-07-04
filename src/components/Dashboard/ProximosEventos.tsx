import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Calendar, 
  MapPin, 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Search,
  Filter,
  Download,
  UserPlus,
  Eye,
  Mail,
  MessageSquare,
  FileText,
  MoreHorizontal,
  Star,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal, Personal } from "@/types/database";

export function ProximosEventos() {
  const [eventos, setEventos] = useState<EventoConPersonal[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTiempo, setFiltroTiempo] = useState("proximos-7");
  const [filtroEmpleado, setFiltroEmpleado] = useState("todos");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<Personal | null>(null);
  const [eventosEmpleado, setEventosEmpleado] = useState<EventoConPersonal[]>([]);
  const [isModalEmpleadoOpen, setIsModalEmpleadoOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (empleadoSeleccionado) {
      cargarEventosEmpleado();
    }
  }, [empleadoSeleccionado]);

  const cargarDatos = async () => {
    try {
      // Cargar personal
      const { data: personalData } = await supabase
        .from("personal")
        .select("*")
        .order("nombre_completo");

      // Obtener rango de fechas según filtro
      const hoy = new Date();
      let fechaFin = new Date();
      
      switch (filtroTiempo) {
        case "proximos-3":
          fechaFin.setDate(hoy.getDate() + 3);
          break;
        case "proximos-7":
          fechaFin.setDate(hoy.getDate() + 7);
          break;
        case "proximos-30":
          fechaFin.setDate(hoy.getDate() + 30);
          break;
        default:
          fechaFin.setFullYear(hoy.getFullYear() + 1);
      }

      // Cargar eventos con personal
      const { data: eventosData } = await supabase
        .from("eventos")
        .select(`
          *,
          evento_personal(
            *,
            personal(*)
          )
        `)
        .gte("fecha_evento", hoy.toISOString().split('T')[0])
        .lte("fecha_evento", fechaFin.toISOString().split('T')[0])
        .order("fecha_evento", { ascending: true });

      // Transformar datos para que coincidan con EventoConPersonal
      const eventosTransformados = eventosData?.map(evento => ({
        ...evento,
        personal: evento.evento_personal?.map((ep: any) => ({
          ...ep.personal,
          ...ep,
          evento_personal_id: ep.id
        })) || []
      })) || [];

      setPersonal(personalData as Personal[] || []);
      setEventos(eventosTransformados as EventoConPersonal[]);
    } catch (error) {
      console.error("Error cargando datos:", error);
      toast({
        title: "Error",
        description: "Error al cargar los datos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const cargarEventosEmpleado = async () => {
    if (!empleadoSeleccionado) return;

    try {
      const fechaFin = new Date();
      fechaFin.setDate(fechaFin.getDate() + 30);

      const { data } = await supabase
        .from("eventos")
        .select(`
          *,
          evento_personal!inner(
            *,
            personal(*)
          )
        `)
        .eq("evento_personal.personal_id", empleadoSeleccionado.id)
        .gte("fecha_evento", new Date().toISOString().split('T')[0])
        .lte("fecha_evento", fechaFin.toISOString().split('T')[0])
        .order("fecha_evento", { ascending: true });

      const eventosTransformados = data?.map(evento => ({
        ...evento,
        personal: evento.evento_personal?.map((ep: any) => ({
          ...ep.personal,
          ...ep,
          evento_personal_id: ep.id
        })) || []
      })) || [];

      setEventosEmpleado(eventosTransformados as EventoConPersonal[]);
    } catch (error) {
      console.error("Error cargando eventos del empleado:", error);
    }
  };

  const getEstadoEvento = (evento: EventoConPersonal) => {
    const personalAsignado = evento.personal?.length || 0;
    
    if (personalAsignado === 0) {
      return { tipo: 'sin-personal', texto: 'Sin personal', icono: '🚨', color: 'bg-red-100 text-red-800 border-red-200' };
    }
    
    // Verificar si faltan horarios
    const sinHorarios = evento.personal?.filter(p => !p.hora_inicio || !p.hora_fin).length || 0;
    if (sinHorarios > 0) {
      return { tipo: 'sin-horarios', texto: 'Sin horarios', icono: '🕐', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    }
    
    // TODO: Aquí se podría verificar si está completo según requerimientos
    return { tipo: 'completo', texto: 'Completo', icono: '✅', color: 'bg-green-100 text-green-800 border-green-200' };
  };

  const eventosFiltrados = eventos.filter(evento => {
    // Filtro por empleado
    if (filtroEmpleado !== "todos") {
      const tieneEmpleado = evento.personal?.some(p => p.id === filtroEmpleado);
      if (!tieneEmpleado) return false;
    }

    // Filtro por estado
    if (filtroEstado !== "todos") {
      const estado = getEstadoEvento(evento);
      if (estado.tipo !== filtroEstado) return false;
    }

    // Filtro por búsqueda  
    if (busqueda) {
      const termino = busqueda.toLowerCase();
      const coincide = evento.nombre_evento.toLowerCase().includes(termino) ||
                     evento.ubicacion.toLowerCase().includes(termino) ||
                     evento.personal?.some(p => p.nombre_completo.toLowerCase().includes(termino));
      if (!coincide) return false;
    }

    return true;
  });

  const generarMensajeWhatsApp = (empleado: Personal) => {
    if (eventosEmpleado.length === 0) return;

    const mensaje = `📅 Hola ${empleado.nombre_completo}! Tu cronograma para los próximos eventos:\n\n` +
      eventosEmpleado.map((evento, index) => {
        const fecha = new Date(evento.fecha_evento).toLocaleDateString('es-CO', { 
          weekday: 'long', day: 'numeric', month: 'long' 
        });
        const personal = evento.personal?.find(p => p.id === empleado.id);
        const horario = personal?.hora_inicio && personal?.hora_fin 
          ? `${personal.hora_inicio}-${personal.hora_fin}` 
          : 'Horario por confirmar';
        
        return `• ${fecha.charAt(0).toUpperCase() + fecha.slice(1)} - ${evento.nombre_evento} (${evento.ubicacion}) ${horario}`;
      }).join('\n') +
      `\n\nTotal eventos: ${eventosEmpleado.length}\n¡Nos vemos!`;

    navigator.clipboard.writeText(mensaje);
    toast({
      title: "Mensaje copiado",
      description: "El cronograma ha sido copiado al portapapeles para enviar por WhatsApp"
    });
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center animate-pulse">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="h-7 bg-slate-200 rounded-lg w-48 animate-pulse"></div>
              <div className="h-4 bg-slate-100 rounded w-32 mt-2 animate-pulse"></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-12 bg-slate-100 rounded-xl animate-pulse"></div>
            <div className="h-32 bg-slate-100 rounded-xl animate-pulse"></div>
            <div className="h-32 bg-slate-100 rounded-xl animate-pulse"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                Próximos Eventos
              </CardTitle>
              <p className="text-slate-600 font-medium">Gestión y seguimiento de eventos programados</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline" 
              size="sm"
              className="bg-white/80 backdrop-blur-sm border-slate-200/60 hover:bg-white hover:shadow-md transition-all duration-200"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button 
              size="sm"
              className="bg-gradient-primary hover:bg-gradient-primary/90 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Analizar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filtros mejorados */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Período</label>
              <Select value={filtroTiempo} onValueChange={(value) => {
                setFiltroTiempo(value);
                cargarDatos();
              }}>
                <SelectTrigger className="bg-white border-slate-200/60 focus:border-selecta-green/50 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-slate-200/60">
                  <SelectItem value="proximos-3">Próximos 3 días</SelectItem>
                  <SelectItem value="proximos-7">Próximos 7 días</SelectItem>
                  <SelectItem value="proximos-30">Próximos 30 días</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Empleado</label>
              <Select value={filtroEmpleado} onValueChange={setFiltroEmpleado}>
                <SelectTrigger className="bg-white border-slate-200/60 focus:border-selecta-green/50 h-11">
                  <SelectValue placeholder="Todos los empleados" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-slate-200/60">
                  <SelectItem value="todos">Todos los empleados</SelectItem>
                  {personal.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre_completo} - {p.rol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Estado</label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="bg-white border-slate-200/60 focus:border-selecta-green/50 h-11">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-slate-200/60">
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  <SelectItem value="sin-personal">Solo sin personal</SelectItem>
                  <SelectItem value="sin-horarios">Solo sin horarios</SelectItem>
                  <SelectItem value="completo">Solo completos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Buscar eventos..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10 bg-white border-slate-200/60 focus:border-selecta-green/50 h-11"
                />
              </div>
            </div>
          </div>

          {/* Mostrar botón de cronograma detallado si hay empleado filtrado */}
          {filtroEmpleado !== "todos" && (
            <div className="mt-4 pt-4 border-t border-slate-200/60">
              <Button
                onClick={() => {
                  const empleado = personal.find(p => p.id === filtroEmpleado);
                  if (empleado) {
                    setEmpleadoSeleccionado(empleado);
                    setIsModalEmpleadoOpen(true);
                  }
                }}
                variant="outline"
                className="bg-blue-50/80 hover:bg-blue-100/80 border-blue-200/60 text-blue-700"
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver cronograma detallado del empleado
              </Button>
            </div>
          )}
        </div>

        {/* Contenido principal */}
        {eventosFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-800 mb-2">
              {eventos.length === 0 ? "No hay eventos próximos" : "No se encontraron eventos"}
            </h3>
            <p className="text-slate-600 max-w-sm mx-auto">
              {eventos.length === 0 
                ? "Cuando tengas eventos programados, aparecerán aquí para su gestión." 
                : "Intenta ajustar los filtros para encontrar los eventos que buscas."
              }
            </p>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200/60 bg-slate-50/50">
                    <TableHead className="font-semibold text-slate-700">Fecha</TableHead>
                    <TableHead className="font-semibold text-slate-700">Evento</TableHead>
                    <TableHead className="font-semibold text-slate-700">Ubicación</TableHead>
                    <TableHead className="font-semibold text-slate-700">Personal</TableHead>
                    <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventosFiltrados.map((evento) => {
                    const estado = getEstadoEvento(evento);
                    const personalAsignado = evento.personal?.length || 0;
                    
                    return (
                      <TableRow key={evento.id} className="border-slate-200/40 hover:bg-slate-50/30 transition-colors">
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-800">
                              {new Date(evento.fecha_evento).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit'
                              })}
                            </div>
                            <div className="text-sm text-slate-500 capitalize">
                              {new Date(evento.fecha_evento).toLocaleDateString('es-CO', {
                                weekday: 'long'
                              })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-800 max-w-48 truncate">
                              {evento.nombre_evento}
                            </div>
                            {evento.descripcion && (
                              <div className="text-sm text-slate-500 max-w-48 truncate">
                                {evento.descripcion}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-700 max-w-32 truncate">{evento.ubicacion}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {personalAsignado > 0 ? (
                              <>
                                <div className="text-sm font-semibold text-slate-800">
                                  {personalAsignado} asignado{personalAsignado > 1 ? 's' : ''}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {evento.personal?.slice(0, 2).map((p) => (
                                    <Badge key={p.id} variant="outline" className="text-xs bg-blue-50/80 border-blue-200/60 text-blue-700">
                                      👤 {p.nombre_completo?.split(' ')[0]}
                                    </Badge>
                                  ))}
                                  {personalAsignado > 2 && (
                                    <Badge variant="outline" className="text-xs bg-slate-50/80 border-slate-200/60 text-slate-600">
                                      +{personalAsignado - 2} más
                                    </Badge>
                                  )}
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-red-600 font-medium">
                                ❌ Sin personal asignado
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${estado.color} border font-medium`}>
                            {estado.icono} {estado.texto}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {estado.tipo === 'sin-personal' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/eventos`)}
                                className="bg-red-50/80 hover:bg-red-100/80 border-red-200/60 text-red-700"
                              >
                                <UserPlus className="h-4 w-4 mr-1" />
                                Asignar
                              </Button>
                            )}
                            {estado.tipo === 'sin-horarios' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/eventos`)}
                                className="bg-orange-50/80 hover:bg-orange-100/80 border-orange-200/60 text-orange-700"
                              >
                                <Clock className="h-4 w-4 mr-1" />
                                Horarios
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/eventos`)}
                              className="hover:bg-slate-100/80"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Estadísticas del filtro mejoradas */}
        {eventosFiltrados.length > 0 && (
          <div className="bg-gradient-to-r from-slate-50/80 to-blue-50/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-selecta-green">{eventosFiltrados.length}</div>
                <div className="text-sm font-medium text-slate-600">Total eventos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {eventosFiltrados.filter(e => getEstadoEvento(e).tipo === 'sin-personal').length}
                </div>
                <div className="text-sm font-medium text-slate-600">Sin personal</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {eventosFiltrados.filter(e => getEstadoEvento(e).tipo === 'sin-horarios').length}
                </div>
                <div className="text-sm font-medium text-slate-600">Sin horarios</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {eventosFiltrados.filter(e => getEstadoEvento(e).tipo === 'completo').length}
                </div>
                <div className="text-sm font-medium text-slate-600">Completos</div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de cronograma del empleado mejorado */}
        <Dialog open={isModalEmpleadoOpen} onOpenChange={setIsModalEmpleadoOpen}>
          <DialogContent className="sm:max-w-2xl bg-white/95 backdrop-blur-xl border-slate-200/60">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                Cronograma de {empleadoSeleccionado?.nombre_completo}
              </DialogTitle>
              <DialogDescription className="text-slate-600">
                {empleadoSeleccionado?.rol} • Próximos 30 días
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {eventosEmpleado.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-2">Sin eventos asignados</h3>
                  <p className="text-slate-600">No hay eventos programados en los próximos 30 días</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {eventosEmpleado.map((evento) => {
                      const personalData = evento.personal?.find(p => p.id === empleadoSeleccionado?.id);
                      const horario = personalData?.hora_inicio && personalData?.hora_fin 
                        ? `${personalData.hora_inicio}-${personalData.hora_fin}` 
                        : 'Horario por confirmar';
                      
                      return (
                        <div key={evento.id} className="bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-xl p-4 hover:shadow-md transition-all duration-200">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="font-semibold text-slate-800">{evento.nombre_evento}</div>
                              <div className="text-sm text-slate-600 flex items-center space-x-1">
                                <MapPin className="h-3 w-3" />
                                <span>{evento.ubicacion}</span>
                              </div>
                              <div className="text-sm font-medium text-slate-700 capitalize">
                                {new Date(evento.fecha_evento).toLocaleDateString('es-CO', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long'
                                })}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="bg-blue-50/80 border-blue-200/60 text-blue-700">
                                {horario}
                              </Badge>
                              {personalData?.horas_trabajadas && (
                                <div className="text-xs text-slate-500 mt-1">
                                  {personalData.horas_trabajadas}h trabajadas
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-gradient-to-r from-selecta-green/10 to-primary/10 rounded-xl p-4 border border-selecta-green/20">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-xl font-bold text-selecta-green">{eventosEmpleado.length}</div>
                        <div className="text-sm font-medium text-slate-600">Eventos asignados</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-primary">
                          {eventosEmpleado.reduce((sum, evento) => {
                            const personalData = evento.personal?.find(p => p.id === empleadoSeleccionado?.id);
                            return sum + (personalData?.horas_trabajadas || 0);
                          }, 0)}h
                        </div>
                        <div className="text-sm font-medium text-slate-600">Total horas</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: "Función en desarrollo",
                          description: "El envío por email estará disponible pronto"
                        });
                      }}
                      className="bg-blue-50/80 hover:bg-blue-100/80 border-blue-200/60 text-blue-700"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar por email
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (empleadoSeleccionado) {
                          generarMensajeWhatsApp(empleadoSeleccionado);
                       }
                     }}
                     className="bg-green-50/80 hover:bg-green-100/80 border-green-200/60 text-green-700"
                   >
                     <MessageSquare className="h-4 w-4 mr-2" />
                     Copiar para WhatsApp
                   </Button>
                   <Button
                     variant="outline"
                     onClick={() => {
                       toast({
                         title: "Función en desarrollo", 
                         description: "La exportación PDF estará disponible pronto"
                       });
                     }}
                     className="bg-orange-50/80 hover:bg-orange-100/80 border-orange-200/60 text-orange-700"
                   >
                     <FileText className="h-4 w-4 mr-2" />
                     Exportar PDF
                   </Button>
                 </div>
               </>
             )}
           </div>
         </DialogContent>
       </Dialog>
     </CardContent>
   </Card>
 );
}