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
  FileText
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
        const personal = evento.personal?.find(p => p.personal_id === empleado.id);
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
      <Card>
        <CardHeader>
          <CardTitle>Próximos Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Próximos Eventos</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Exportar lista
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Select value={filtroTiempo} onValueChange={(value) => {
            setFiltroTiempo(value);
            cargarDatos();
          }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="proximos-3">Próximos 3 días</SelectItem>
              <SelectItem value="proximos-7">Próximos 7 días</SelectItem>
              <SelectItem value="proximos-30">Próximos 30 días</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroEmpleado} onValueChange={setFiltroEmpleado}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por empleado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los empleados</SelectItem>
              {personal.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre_completo} - {p.rol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtroEstado} onValueChange={setFiltroEstado}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="sin-personal">Solo sin personal</SelectItem>
              <SelectItem value="sin-horarios">Solo sin horarios</SelectItem>
              <SelectItem value="completo">Solo completos</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar eventos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Mostrar eventos filtrados por empleado individual */}
        {filtroEmpleado !== "todos" && (
          <div className="mb-4">
            <Button
              onClick={() => {
                const empleado = personal.find(p => p.id === filtroEmpleado);
                if (empleado) {
                  setEmpleadoSeleccionado(empleado);
                  setIsModalEmpleadoOpen(true);
                }
              }}
              className="mb-4"
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver cronograma detallado del empleado
            </Button>
          </div>
        )}

        {/* Tabla de eventos */}
        {eventosFiltrados.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {eventos.length === 0 
                ? "No hay eventos próximos" 
                : "No se encontraron eventos con los filtros seleccionados"
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Personal</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventosFiltrados.map((evento) => {
                  const estado = getEstadoEvento(evento);
                  const personalAsignado = evento.personal?.length || 0;
                  
                  return (
                    <TableRow key={evento.id}>
                      <TableCell>
                        <div className="font-medium">
                          {new Date(evento.fecha_evento).toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit'
                          })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(evento.fecha_evento).toLocaleDateString('es-CO', {
                            weekday: 'long'
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{evento.nombre_evento}</div>
                        {evento.descripcion && (
                          <div className="text-sm text-muted-foreground">
                            {evento.descripcion.length > 50 
                              ? evento.descripcion.substring(0, 50) + '...'
                              : evento.descripcion
                            }
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{evento.ubicacion}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {personalAsignado > 0 ? (
                            <>
                              <div className="text-sm font-medium">
                                {personalAsignado} asignado{personalAsignado > 1 ? 's' : ''}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {evento.personal?.slice(0, 2).map((p) => (
                                  <Badge key={p.personal_id} variant="outline" className="text-xs">
                                    👤 {p.nombre_completo?.split(' ')[0]}
                                  </Badge>
                                ))}
                                {personalAsignado > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{personalAsignado - 2} más
                                  </Badge>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              ❌ Sin personal asignado
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={estado.color}>
                          {estado.icono} {estado.texto}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {estado.tipo === 'sin-personal' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/eventos`)}
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
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            Definir horarios
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/eventos`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Estadísticas del filtro */}
        {eventosFiltrados.length > 0 && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                <strong>Total eventos:</strong> {eventosFiltrados.length}
              </span>
              <span>
                <strong>Sin personal:</strong> {eventosFiltrados.filter(e => getEstadoEvento(e).tipo === 'sin-personal').length}
              </span>
              <span>
                <strong>Sin horarios:</strong> {eventosFiltrados.filter(e => getEstadoEvento(e).tipo === 'sin-horarios').length}
              </span>
              <span>
                <strong>Completos:</strong> {eventosFiltrados.filter(e => getEstadoEvento(e).tipo === 'completo').length}
              </span>
            </div>
          </div>
        )}

        {/* Modal de cronograma del empleado */}
        <Dialog open={isModalEmpleadoOpen} onOpenChange={setIsModalEmpleadoOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Eventos de {empleadoSeleccionado?.nombre_completo} - {empleadoSeleccionado?.rol}
              </DialogTitle>
              <DialogDescription>
                Cronograma de próximos 30 días
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {eventosEmpleado.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay eventos asignados en los próximos 30 días</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {eventosEmpleado.map((evento) => {
                      const personalData = evento.personal?.find(p => p.id === empleadoSeleccionado?.id);
                      const horario = personalData?.hora_inicio && personalData?.hora_fin 
                        ? `${personalData.hora_inicio}-${personalData.hora_fin}` 
                        : 'Horario por confirmar';
                      
                      return (
                        <div key={evento.id} className="border rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{evento.nombre_evento}</div>
                              <div className="text-sm text-muted-foreground">{evento.ubicacion}</div>
                              <div className="text-sm">
                                {new Date(evento.fecha_evento).toLocaleDateString('es-CO', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long'
                                })}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{horario}</div>
                              {personalData?.horas_trabajadas && (
                                <div className="text-xs text-muted-foreground">
                                  {personalData.horas_trabajadas}h
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm space-y-1">
                      <div>
                        <strong>Total eventos asignados:</strong> {eventosEmpleado.length}
                      </div>
                      <div>
                        <strong>Total horas:</strong> {
                          eventosEmpleado.reduce((sum, evento) => {
                            const personalData = evento.personal?.find(p => p.id === empleadoSeleccionado?.id);
                            return sum + (personalData?.horas_trabajadas || 0);
                          }, 0)
                        }h
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        // TODO: Implementar envío por email
                        toast({
                          title: "Función en desarrollo",
                          description: "El envío por email estará disponible pronto"
                        });
                      }}
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
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Copiar para WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        // TODO: Implementar exportación PDF
                        toast({
                          title: "Función en desarrollo", 
                          description: "La exportación PDF estará disponible pronto"
                        });
                      }}
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