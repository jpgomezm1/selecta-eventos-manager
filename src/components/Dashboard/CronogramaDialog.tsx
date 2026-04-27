import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Copy, RefreshCw, X, Calendar as CalendarIcon, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/lib/dateLocal";

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
  
  // Estados para filtros de fecha
  const [fechaDesde, setFechaDesde] = useState<Date>(new Date());
  const [fechaHasta, setFechaHasta] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date;
  });
  const [presetActivo, setPresetActivo] = useState<string>('proximos-15');
  
  const { toast } = useToast();

  // Trae solo empleados que tienen al menos un evento programado en el rango
  // de fechas actual. Al cambiar el rango la lista se recalcula automáticamente.
  const cargarEmpleadosConEventos = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("eventos")
        .select(`
          evento_personal!inner(
            personal!inner(id, nombre_completo)
          )
        `)
        .gte("fecha_evento", fechaDesde.toISOString().split('T')[0])
        .lte("fecha_evento", fechaHasta.toISOString().split('T')[0]);

      if (error) throw error;

      // Dedupe por id; un empleado con varios eventos aparece una sola vez.
      const map = new Map<string, Empleado>();
      for (const evt of data ?? []) {
        for (const ep of evt.evento_personal ?? []) {
          const p = ep.personal;
          if (p && !map.has(p.id)) {
            map.set(p.id, { id: p.id, nombre_completo: p.nombre_completo });
          }
        }
      }
      const lista = [...map.values()].sort((a, b) =>
        a.nombre_completo.localeCompare(b.nombre_completo)
      );
      setEmpleados(lista);

      // Si el empleado actualmente seleccionado ya no aparece en el rango
      // nuevo, caer al primero disponible (o limpiar si la lista quedó vacía).
      if (lista.length === 0) {
        setEmpleadoSeleccionado("");
        setEventos([]);
        setMensajeCronograma("");
      } else {
        setEmpleadoSeleccionado((prev) =>
          lista.some((e) => e.id === prev) ? prev : lista[0].id
        );
      }
    } catch (error) {
      console.error("Error cargando empleados con eventos:", error);
      toast({
        title: "Error",
        description: (error as Error)?.message ?? "Error al cargar lista de empleados",
        variant: "destructive"
      });
    }
  }, [fechaDesde, fechaHasta, toast]);

  const cargarEventosEmpleado = useCallback(async () => {
    if (!empleadoSeleccionado) return;

    setLoading(true);
    try {
      console.log('Cargando eventos para empleado:', empleadoSeleccionado);
      console.log('Rango de fechas:', fechaDesde.toISOString().split('T')[0], 'a', fechaHasta.toISOString().split('T')[0]);

      // Consulta con filtros de fecha personalizados
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
        .gte("fecha_evento", fechaDesde.toISOString().split('T')[0])
        .lte("fecha_evento", fechaHasta.toISOString().split('T')[0])
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleadoSeleccionado, fechaDesde, fechaHasta, empleados, toast]);

  useEffect(() => {
    if (isOpen) {
      cargarEmpleadosConEventos();
    }
  }, [isOpen, cargarEmpleadosConEventos]);

  useEffect(() => {
    if (empleadoSeleccionado) {
      cargarEventosEmpleado();
    }
  }, [empleadoSeleccionado, fechaDesde, fechaHasta, cargarEventosEmpleado]);

  const generarMensaje = (eventosData: EventoEmpleado[]) => {
    const empleado = empleados.find(e => e.id === empleadoSeleccionado);
    if (!empleado) {
      setMensajeCronograma("Selecciona un empleado para ver su cronograma");
      return;
    }

    const nombreEmpleado = empleado.nombre_completo.split(' ')[0]; // Solo primer nombre
    const fechaDesdeFormateada = format(fechaDesde, "dd/MM", { locale: es });
    const fechaHastaFormateada = format(fechaHasta, "dd/MM", { locale: es });

    if (eventosData.length === 0) {
      const mensaje = `📅 Hola ${nombreEmpleado}!

No tienes eventos programados del ${fechaDesdeFormateada} al ${fechaHastaFormateada}.

¡Disfruta tu tiempo libre! 😊`;
      setMensajeCronograma(mensaje);
      return;
    }

    let mensaje = `📅 Hola ${nombreEmpleado}! Tu cronograma del ${fechaDesdeFormateada} al ${fechaHastaFormateada}:\n\n`;

    let totalHoras = 0;
    let eventosConHorario = 0;

    eventosData.forEach(evento => {
      // Formatear fecha
      const fecha = parseLocalDate(evento.fecha_evento) ?? new Date();
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

  const handlePresetClick = (preset: string) => {
    const hoy = new Date();
    let nuevaFechaDesde = new Date(hoy);
    let nuevaFechaHasta = new Date(hoy);

    switch (preset) {
      case 'esta-semana': {
        const inicioSemana = new Date(hoy);
        inicioSemana.setDate(hoy.getDate() - hoy.getDay() + 1); // Lunes
        const finSemana = new Date(inicioSemana);
        finSemana.setDate(inicioSemana.getDate() + 6); // Domingo
        nuevaFechaDesde = inicioSemana;
        nuevaFechaHasta = finSemana;
        break;
      }
      case 'proximos-7':
        nuevaFechaHasta.setDate(hoy.getDate() + 7);
        break;
      case 'proximos-15':
        nuevaFechaHasta.setDate(hoy.getDate() + 15);
        break;
      case 'este-mes':
        nuevaFechaDesde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        nuevaFechaHasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
        break;
    }

    setFechaDesde(nuevaFechaDesde);
    setFechaHasta(nuevaFechaHasta);
    setPresetActivo(preset);
  };

  const validarFechas = (): string | null => {
    if (fechaHasta <= fechaDesde) {
      return "La fecha 'hasta' debe ser posterior a la fecha 'desde'";
    }
    
    const diffDays = Math.ceil((fechaHasta.getTime() - fechaDesde.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      return "El rango seleccionado es muy amplio (>90 días)";
    }
    
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5" />
            <span>📧 Enviar Cronogramas</span>
          </DialogTitle>
          <DialogDescription>
            Próximos eventos por empleado para WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden">
          {/* Selector de empleado */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm font-medium">Seleccionar empleado:</label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {empleados.length} con eventos en el rango
              </span>
            </div>
            <Select
              value={empleadoSeleccionado}
              onValueChange={setEmpleadoSeleccionado}
              disabled={empleados.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    empleados.length === 0
                      ? "Sin empleados con eventos en este rango"
                      : "Selecciona un empleado"
                  }
                />
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

          {/* Filtros de fecha */}
          <div className="space-y-3">
            <label className="text-sm font-medium block">
              Período de eventos:
            </label>
            
            {/* Date pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Desde:</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fechaDesde && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaDesde ? format(fechaDesde, "dd/MM/yyyy", { locale: es }) : <span>Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaDesde}
                      onSelect={(date) => date && setFechaDesde(date)}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Hasta:</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !fechaHasta && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaHasta ? format(fechaHasta, "dd/MM/yyyy", { locale: es }) : <span>Seleccionar fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fechaHasta}
                      onSelect={(date) => date && setFechaHasta(date)}
                      disabled={(date) => date <= fechaDesde}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Validación de fechas */}
            {validarFechas() && (
              <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                ⚠️ {validarFechas()}
              </div>
            )}

            {/* Presets rápidos */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Presets rápidos:</label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={presetActivo === 'esta-semana' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetClick('esta-semana')}
                >
                  Esta semana
                </Button>
                <Button
                  variant={presetActivo === 'proximos-7' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetClick('proximos-7')}
                >
                  Próximos 7 días
                </Button>
                <Button
                  variant={presetActivo === 'proximos-15' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetClick('proximos-15')}
                >
                  Próximos 15 días
                </Button>
                <Button
                  variant={presetActivo === 'este-mes' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetClick('este-mes')}
                >
                  Este mes
                </Button>
              </div>
            </div>
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
              if (empleadoSeleccionado && !validarFechas()) {
                console.log('Reintentando cargar eventos para:', empleadoSeleccionado);
                cargarEventosEmpleado();
              }
            }}
            disabled={!empleadoSeleccionado || loading || !!validarFechas()}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
          <Button 
            onClick={copiarAlPortapapeles}
            disabled={!mensajeCronograma || loading || !!validarFechas()}
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