import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Info, CheckCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Alerta {
  id: string;
  tipo: 'urgente' | 'atencion' | 'informacion';
  mensaje: string;
  accion?: string;
  eventoId?: string;
  personalId?: string;
}

export function AlertasPanel() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    generarAlertas();
  }, []);

  const generarAlertas = async () => {
    try {
      const alertasGeneradas: Alerta[] = [];
      
      // Obtener eventos próximos con personal
      const { data: eventosProximos } = await supabase
        .from("eventos")
        .select(`
          *,
          evento_personal(
            personal_id,
            personal(nombre_completo, rol)
          )
        `)
        .gte("fecha_evento", new Date().toISOString().split('T')[0])
        .order("fecha_evento", { ascending: true });

      // Obtener pagos pendientes
      const { data: pagosPendientes } = await supabase
        .from("evento_personal")
        .select(`
          *,
          personal(nombre_completo),
          evento(nombre_evento, fecha_evento)
        `)
        .eq("estado_pago", "pendiente");

      if (eventosProximos) {
        for (const evento of eventosProximos) {
          const fechaEvento = new Date(evento.fecha_evento);
          const hoy = new Date();
          const diasRestantes = Math.ceil((fechaEvento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
          
          // Alertas URGENTES
          if (diasRestantes <= 2 && evento.evento_personal.length === 0) {
            alertasGeneradas.push({
              id: `urgente-sin-personal-${evento.id}`,
              tipo: 'urgente',
              mensaje: `Evento "${evento.nombre_evento}" ${diasRestantes === 0 ? 'HOY' : diasRestantes === 1 ? 'MAÑANA' : 'en 2 días'} sin personal asignado`,
              accion: 'asignar-personal',
              eventoId: evento.id
            });
          }

          // Verificar conflictos de horarios
          const personalEventos = evento.evento_personal;
          for (const pe of personalEventos) {
            const { data: conflictos } = await supabase
              .from("evento_personal")
              .select(`
                *,
                evento(nombre_evento, fecha_evento)
              `)
              .eq("personal_id", pe.personal_id)
              .eq("evento.fecha_evento", evento.fecha_evento)
              .neq("evento_id", evento.id);

            if (conflictos && conflictos.length > 0) {
              alertasGeneradas.push({
                id: `conflicto-${pe.personal_id}-${evento.id}`,
                tipo: 'urgente', 
                mensaje: `${pe.personal.nombre_completo} tiene conflicto: múltiples eventos el ${fechaEvento.toLocaleDateString('es-CO')}`,
                accion: 'resolver-conflicto',
                personalId: pe.personal_id
              });
            }
          }

          // Alertas ATENCIÓN
          if (diasRestantes <= 7 && diasRestantes > 2 && evento.evento_personal.length === 0) {
            alertasGeneradas.push({
              id: `atencion-sin-personal-${evento.id}`,
              tipo: 'atencion',
              mensaje: `Evento "${evento.nombre_evento}" en ${diasRestantes} días sin personal asignado`,
              accion: 'asignar-personal',
              eventoId: evento.id
            });
          }

          // Eventos sin horarios definidos
          const sinHorarios = evento.evento_personal.filter((ep: any) => !ep.hora_inicio || !ep.hora_fin);
          if (sinHorarios.length > 0 && diasRestantes <= 5) {
            alertasGeneradas.push({
              id: `sin-horarios-${evento.id}`,
              tipo: 'atencion',
              mensaje: `Evento "${evento.nombre_evento}" sin horarios definidos para ${sinHorarios.length} empleado(s)`,
              accion: 'definir-horarios',
              eventoId: evento.id
            });
          }
        }
      }

      // Alertas de pagos pendientes > 30 días
      if (pagosPendientes) {
        const pagosVencidos = pagosPendientes.filter((pago: any) => {
          const fechaEvento = new Date(pago.evento.fecha_evento);
          const hoy = new Date();
          const diasVencido = Math.floor((hoy.getTime() - fechaEvento.getTime()) / (1000 * 60 * 60 * 24));
          return diasVencido > 30;
        });

        if (pagosVencidos.length > 0) {
          alertasGeneradas.push({
            id: 'pagos-vencidos',
            tipo: 'atencion',
            mensaje: `${pagosVencidos.length} empleado(s) con pagos pendientes > 30 días`,
            accion: 'procesar-pagos'
          });
        }
      }

      // Alerta informativa
      alertasGeneradas.push({
        id: 'recordatorio-revision',
        tipo: 'informacion',
        mensaje: 'Recordatorio: Revisar eventos de la próxima semana',
        accion: 'revisar-eventos'
      });

      setAlertas(alertasGeneradas);
    } catch (error) {
      console.error("Error generando alertas:", error);
    } finally {
      setLoading(false);
    }
  };

  const marcarComoVisto = (alertaId: string) => {
    setAlertas(prev => prev.filter(alerta => alerta.id !== alertaId));
    toast({
      title: "Alerta marcada como vista",
      description: "La alerta ha sido removida del panel"
    });
  };

  const marcarTodasComoVistas = () => {
    setAlertas([]);
    toast({
      title: "Todas las alertas marcadas como vistas",
      description: "El panel de alertas ha sido limpiado"
    });
  };

  const getAlertaIcon = (tipo: string) => {
    switch (tipo) {
      case 'urgente': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'atencion': return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'informacion': return <Info className="h-4 w-4 text-blue-600" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getAlertaBadge = (tipo: string) => {
    switch (tipo) {
      case 'urgente': return <Badge className="bg-red-100 text-red-800 border-red-200">🔴 URGENTE</Badge>;
      case 'atencion': return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">🟡 ATENCIÓN</Badge>;
      case 'informacion': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">🔵 INFORMACIÓN</Badge>;
      default: return null;
    }
  };

  const alertasUrgentes = alertas.filter(a => a.tipo === 'urgente');
  const alertasAtencion = alertas.filter(a => a.tipo === 'atencion');
  const alertasInformacion = alertas.filter(a => a.tipo === 'informacion');

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5" />
            <span>Alertas y Notificaciones</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
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
            <AlertTriangle className="h-5 w-5" />
            <span>🚨 Alertas y Notificaciones</span>
          </CardTitle>
          {alertas.length > 0 && (
            <Button variant="outline" size="sm" onClick={marcarTodasComoVistas}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar todas como vistas
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alertas.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-muted-foreground">No hay alertas pendientes</p>
            <p className="text-sm text-muted-foreground mt-2">¡Todo está bajo control!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Alertas Urgentes */}
            {alertasUrgentes.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <Badge className="bg-red-100 text-red-800 border-red-200">
                    🔴 URGENTE ({alertasUrgentes.length})
                  </Badge>
                </div>
                <div className="space-y-2">
                  {alertasUrgentes.map((alerta) => (
                    <div key={alerta.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getAlertaIcon(alerta.tipo)}
                        <span className="text-sm font-medium">{alerta.mensaje}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => marcarComoVisto(alerta.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alertas Atención */}
            {alertasAtencion.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    🟡 ATENCIÓN ({alertasAtencion.length})
                  </Badge>
                </div>
                <div className="space-y-2">
                  {alertasAtencion.map((alerta) => (
                    <div key={alerta.id} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getAlertaIcon(alerta.tipo)}
                        <span className="text-sm">{alerta.mensaje}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => marcarComoVisto(alerta.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alertas Información */}
            {alertasInformacion.length > 0 && (
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    🔵 INFORMACIÓN ({alertasInformacion.length})
                  </Badge>
                </div>
                <div className="space-y-2">
                  {alertasInformacion.map((alerta) => (
                    <div key={alerta.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getAlertaIcon(alerta.tipo)}
                        <span className="text-sm">{alerta.mensaje}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => marcarComoVisto(alerta.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}