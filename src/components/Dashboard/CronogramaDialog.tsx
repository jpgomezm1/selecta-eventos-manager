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
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + 15);

      const { data, error } = await supabase
        .from("evento_personal")
        .select(`
          hora_inicio,
          hora_fin,
          evento:eventos(
            nombre_evento,
            ubicacion,
            fecha_evento
          )
        `)
        .eq("personal_id", empleadoSeleccionado)
        .gte("evento.fecha_evento", new Date().toISOString().split('T')[0])
        .lte("evento.fecha_evento", fechaLimite.toISOString().split('T')[0])
        .order("evento.fecha_evento", { ascending: true });

      if (error) throw error;

      // Transformar datos
      const eventosTransformados = data?.map(item => ({
        nombre_evento: item.evento.nombre_evento,
        ubicacion: item.evento.ubicacion,
        fecha_evento: item.evento.fecha_evento,
        hora_inicio: item.hora_inicio,
        hora_fin: item.hora_fin
      })) || [];

      setEventos(eventosTransformados);
      generarMensaje(eventosTransformados);
    } catch (error) {
      console.error("Error cargando eventos:", error);
      toast({
        title: "Error",
        description: "Error al cargar eventos del empleado",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generarMensaje = (eventosData: EventoEmpleado[]) => {
    const empleado = empleados.find(e => e.id === empleadoSeleccionado);
    if (!empleado) return;

    const nombreEmpleado = empleado.nombre_completo.split(' ')[0]; // Solo primer nombre

    if (eventosData.length === 0) {
      const mensaje = `📅 Hola ${nombreEmpleado}! 

No tienes eventos programados para los próximos días. 

¡Disfruta tu tiempo libre! 😊`;
      setMensajeCronograma(mensaje);
      return;
    }

    let mensaje = `📅 Hola ${nombreEmpleado}! Tu cronograma para los próximos días:\n\n`;

    let totalHoras = 0;

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
        const inicio = new Date(`2000-01-01T${evento.hora_inicio}`);
        const fin = new Date(`2000-01-01T${evento.hora_fin}`);
        const horasTrabajadas = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
        totalHoras += horasTrabajadas;
      }

      mensaje += `• ${fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1)} - ${evento.nombre_evento}\n`;
      mensaje += `  📍 ${evento.ubicacion} | ⏰ ${horario}\n\n`;
    });

    mensaje += `Total eventos: ${eventosData.length}`;
    if (totalHoras > 0) {
      mensaje += ` | Total horas: ${totalHoras.toFixed(0)}h`;
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
            onClick={() => empleadoSeleccionado && cargarEventosEmpleado()}
            disabled={!empleadoSeleccionado || loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
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