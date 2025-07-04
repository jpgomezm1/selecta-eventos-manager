import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, RefreshCw, X, Calendar, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CronogramaDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Empleado {
  id: string;
  nombre_completo: string;
}

interface EventoEmpleado {
  nombre_evento: string;
  ubicacion: string;
  fecha_evento: string;
  hora_inicio?: string;
  hora_fin?: string;
}

export function CronogramaDialog({ isOpen, onClose }: CronogramaDialogProps) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState<string>("");
  const [eventos, setEventos] = useState<EventoEmpleado[]>([]);
  const [loading, setLoading] = useState(false);
  const [mensajeCronograma, setMensajeCronograma] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      cargarEmpleados();
    }
  }, [isOpen]);

  useEffect(() => {
    if (empleadoSeleccionado) {
      cargarEventosEmpleado();
    }
  }, [empleadoSeleccionado]);

  const cargarEmpleados = async () => {
    try {
      const { data, error } = await supabase
        .from("personal")
        .select("id, nombre_completo")
        .order("nombre_completo");

      if (error) throw error;
      setEmpleados(data || []);
      
      // Seleccionar el primer empleado por defecto
      if (data && data.length > 0) {
        setEmpleadoSeleccionado(data[0].id);
      }
    } catch (error) {
      console.error("Error cargando empleados:", error);
      toast({
        title: "Error",
        description: "Error al cargar lista de empleados",
        variant: "destructive"
      });
    }
  };

  const cargarEventosEmpleado = async () => {
    if (!empleadoSeleccionado) return;

    setLoading(true);
    try {
      // Calcular fecha límite (próximos 15 días)
      const hoy = new Date();
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + 15);

      console.log('Cargando eventos para empleado:', empleadoSeleccionado);
      console.log('Rango de fechas:', hoy.toISOString().split('T')[0], 'a', fechaLimite.toISOString().split('T')[0]);

      // Consulta corregida: primero obtener eventos en el rango de fechas
      const { data: eventosData, error: eventosError } = await supabase
        .from("eventos")
        .select(`
          id,
          nombre_evento,
          ubicacion,
          fecha_evento,
          evento_personal!inner(
            hora_inicio,
            hora_fin,
            personal_id
          )
        `)
        .eq("evento_personal.personal_id", empleadoSeleccionado)
        .gte("fecha_evento", hoy.toISOString().split('T')[0])
        .lte("fecha_evento", fechaLimite.toISOString().split('T')[0])
        .order("fecha_evento", { ascending: true });

      if (eventosError) {
        console.error('Error en consulta de eventos:', eventosError);
        throw eventosError;
      }

      console.log('Eventos obtenidos:', eventosData);

      // Transformar datos para el formato esperado
      const eventosTransformados = eventosData?.map(evento => {
        const eventoPersonal = evento.evento_personal?.[0]; // Tomar el primer registro (debería ser único por empleado)
        return {
          nombre_evento: evento.nombre_evento,
          ubicacion: evento.ubicacion,
          fecha_evento: evento.fecha_evento,
          hora_inicio: eventoPersonal?.hora_inicio,
          hora_fin: eventoPersonal?.hora_fin
        };
      }) || [];

      console.log('Eventos transformados:', eventosTransformados);

      setEventos(eventosTransformados);
      generarMensaje(eventosTransformados);
    } catch (error) {
      console.error("Error cargando eventos:", error);
      
      // En lugar de mostrar error, mostrar mensaje amigable
      const empleado = empleados.find(e => e.id === empleadoSeleccionado);
      const nombreEmpleado = empleado?.nombre_completo.split(' ')[0] || 'empleado';
      
      const mensajeError = `⚠️ No se pudieron cargar los eventos en este momento.

Por favor intenta de nuevo en unos segundos.

Si el problema persiste, contacta al administrador.`;

      setMensajeCronograma(mensajeError);
      setEventos([]);
      
      // Mostrar toast informativo en lugar de error
      toast({
        title: "Información",
        description: `No se pudieron cargar los eventos de ${empleado?.nombre_completo || 'este empleado'}. Intenta de nuevo.`,
        variant: "default"
      });
    } finally {
      setLoading(false);
    }
  };

  const generarMensaje = (eventosData: EventoEmpleado[]) => {
    const empleado = empleados.find(e => e.id === empleadoSeleccionado);
    if (!empleado) {
      setMensajeCronograma("Selecciona un empleado para ver su cronograma");
      return;
    }

    const nombreEmpleado = empleado.nombre_completo.split(' ')[0]; // Solo primer nombre

    if (eventosData.length === 0) {
      const mensaje = `📅 Hola ${nombreEmpleado}! 

No tienes eventos programados para los próximos 15 días.

¡Disfruta tu tiempo libre! 😊`;
      setMensajeCronograma(mensaje);
      return;
    }

    let mensaje = `📅 Hola ${nombreEmpleado}! Tu cronograma para los próximos días:\n\n`;

    let totalHoras = 0;
    let eventosConHorario = 0;

    eventosData.forEach(evento => {
      // Formatear fecha
      const fecha = new Date(evento.fecha_evento);
      const fechaFormateada = fecha.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit'
      });

      // Formatear horario
      let horario = "Horario por confirmar";
      if (evento.hora_inicio && evento.hora_fin) {
        const horaInicio = formatearHora(evento.hora_inicio);
        const horaFin = formatearHora(evento.hora_fin);
        horario = `${horaInicio} - ${horaFin}`;

        // Calcular horas trabajadas
        try {
          const inicio = new Date(`2000-01-01T${evento.hora_inicio}`);
          const fin = new Date(`2000-01-01T${evento.hora_fin}`);
          const horasTrabajadas = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
          if (horasTrabajadas > 0) {
            totalHoras += horasTrabajadas;
            eventosConHorario++;
          }
        } catch (error) {
          console.warn('Error calculando horas para evento:', evento.nombre_evento);
        }
      }

      mensaje += `• ${fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1)} - ${evento.nombre_evento}\n`;
      mensaje += `  📍 ${evento.ubicacion} | ⏰ ${horario}\n\n`;
    });

    // Resumen final
    mensaje += `Total eventos: ${eventosData.length}`;
    
    if (totalHoras > 0) {
      mensaje += ` | Total horas: ${Math.round(totalHoras)}h`;
    } else if (eventosConHorario === 0) {
      mensaje += ` | Horas por definir`;
    }
    
    mensaje += `\n\n¡Nos vemos! 👋`;

    setMensajeCronograma(mensaje);
  };

  const formatearHora = (hora: string): string => {
    try {
      const [horas, minutos] = hora.split(':');
      const fecha = new Date();
      fecha.setHours(parseInt(horas), parseInt(minutos));
      
      return fecha.toLocaleTimeString('es-CO', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return hora; // Fallback al formato original
    }
  };

  const copiarAlPortapapeles = async () => {
    try {
      await navigator.clipboard.writeText(mensajeCronograma);
      toast({
        title: "✅ Mensaje copiado",
        description: "El cronograma ha sido copiado al portapapeles. Ya puedes pegarlo en WhatsApp.",
      });
    } catch (error) {
      // Fallback para navegadores que no soportan clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = mensajeCronograma;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      toast({
        title: "✅ Mensaje copiado",
        description: "El cronograma ha sido copiado al portapapeles. Ya puedes pegarlo en WhatsApp.",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>📧 Enviar Cronogramas</span>
          </DialogTitle>
          <DialogDescription>
            Próximos eventos por empleado para WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Selector de empleado */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Seleccionar empleado:
            </label>
            <Select value={empleadoSeleccionado} onValueChange={setEmpleadoSeleccionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un empleado" />
              </SelectTrigger>
              <SelectContent>
                {empleados.map(empleado => (
                  <SelectItem key={empleado.id} value={empleado.id}>
                    {empleado.nombre_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vista previa del mensaje */}
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-4 h-full">
              <div className="h-full overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Cargando cronograma...</span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-4 rounded-lg border">
                    {mensajeCronograma || "Selecciona un empleado para ver su cronograma"}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              if (empleadoSeleccionado) {
                console.log('Reintentando cargar eventos para:', empleadoSeleccionado);
                cargarEventosEmpleado();
              }
            }}
            disabled={!empleadoSeleccionado || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
          <Button 
            onClick={copiarAlPortapapeles}
            disabled={!mensajeCronograma || loading}
            className="bg-green-600 hover:bg-green-700"
          >
            <Copy className="h-4 w-4 mr-2" />
            📋 Copiar Mensaje
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}