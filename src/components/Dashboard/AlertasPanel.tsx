import { useState, useEffect } from "react";
import { AlertTriangle, Clock, Info, CheckCircle, X, Shield, Zap, Bell } from "lucide-react";
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
      case 'urgente': return <Zap className="h-4 w-4 text-red-600" />;
      case 'atencion': return <Clock className="h-4 w-4 text-orange-600" />;
      case 'informacion': return <Info className="h-4 w-4 text-blue-600" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getAlertaConfig = (tipo: string) => {
    switch (tipo) {
      case 'urgente': 
        return {
          badge: "🔴 URGENTE",
          bgColor: "bg-gradient-to-r from-red-50/80 to-red-100/80",
          borderColor: "border-red-200/60",
          textColor: "text-red-800",
          badgeColor: "bg-red-100/80 text-red-800 border-red-200/60"
        };
      case 'atencion': 
        return {
          badge: "🟡 ATENCIÓN",
          bgColor: "bg-gradient-to-r from-orange-50/80 to-orange-100/80",
          borderColor: "border-orange-200/60",
          textColor: "text-orange-800",
          badgeColor: "bg-orange-100/80 text-orange-800 border-orange-200/60"
        };
      case 'informacion': 
        return {
          badge: "🔵 INFORMACIÓN",
          bgColor: "bg-gradient-to-r from-blue-50/80 to-blue-100/80",
          borderColor: "border-blue-200/60",
          textColor: "text-blue-800",
          badgeColor: "bg-blue-100/80 text-blue-800 border-blue-200/60"
        };
      default: 
        return {
          badge: "INFO",
          bgColor: "bg-slate-50/80",
          borderColor: "border-slate-200/60",
          textColor: "text-slate-800",
          badgeColor: "bg-slate-100/80 text-slate-800 border-slate-200/60"
        };
    }
  };

  const alertasUrgentes = alertas.filter(a => a.tipo === 'urgente');
  const alertasAtencion = alertas.filter(a => a.tipo === 'atencion');
  const alertasInformacion = alertas.filter(a => a.tipo === 'informacion');

  if (loading) {
    return (
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="pb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl flex items-center justify-center animate-pulse">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="h-6 bg-slate-200 rounded-lg w-40 animate-pulse"></div>
              <div className="h-4 bg-slate-100 rounded w-28 mt-2 animate-pulse"></div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-16 bg-slate-100 rounded-xl animate-pulse"></div>
            <div className="h-16 bg-slate-100 rounded-xl animate-pulse"></div>
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
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Bell className="h-6 w-6 text-white" />
              </div>
              {alertas.length > 0 && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-xs text-white font-bold">{alertas.length}</span>
                </div>
              )}
            </div>
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                Alertas y Notificaciones
              </CardTitle>
              <p className="text-slate-600 font-medium">Centro de monitoreo y seguimiento</p>
            </div>
          </div>
          
          {alertas.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={marcarTodasComoVistas}
              className="bg-white/80 backdrop-blur-sm border-slate-200/60 hover:bg-white hover:shadow-md transition-all duration-200"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Marcar todas
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {alertas.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Todo bajo control</h3>
            <p className="text-slate-600 max-w-sm mx-auto mb-4">
              No hay alertas pendientes en este momento. El sistema está funcionando correctamente.
            </p>
            <div className="inline-flex items-center space-x-2 bg-green-50/80 rounded-full px-4 py-2 border border-green-200/60">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-700">Sistema estable</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Alertas Urgentes */}
            {alertasUrgentes.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-red-800">Alertas Urgentes</h3>
                    <p className="text-sm text-red-600">Requieren atención inmediata</p>
                  </div>
                  <Badge className="bg-red-100/80 text-red-800 border-red-200/60 font-bold">
                    {alertasUrgentes.length}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {alertasUrgentes.map((alerta) => {
                    const config = getAlertaConfig(alerta.tipo);
                    return (
                      <div 
                        key={alerta.id} 
                        className={`${config.bgColor} backdrop-blur-sm border ${config.borderColor} rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="mt-1">
                              {getAlertaIcon(alerta.tipo)}
                            </div>
                            <div className="flex-1">
                              <p className={`font-semibold ${config.textColor} leading-relaxed`}>
                                {alerta.mensaje}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => marcarComoVisto(alerta.id)}
                            className="ml-3 hover:bg-white/60 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Alertas Atención */}
            {alertasAtencion.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-md">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-orange-800">Requieren Atención</h3>
                    <p className="text-sm text-orange-600">Revisar en las próximas horas</p>
                  </div>
                  <Badge className="bg-orange-100/80 text-orange-800 border-orange-200/60 font-bold">
                    {alertasAtencion.length}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {alertasAtencion.map((alerta) => {
                    const config = getAlertaConfig(alerta.tipo);
                    return (
                      <div 
                        key={alerta.id} 
                        className={`${config.bgColor} backdrop-blur-sm border ${config.borderColor} rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="mt-1">
                              {getAlertaIcon(alerta.tipo)}
                            </div>
                            <div className="flex-1">
                              <p className={`font-medium ${config.textColor} leading-relaxed`}>
                                {alerta.mensaje}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => marcarComoVisto(alerta.id)}
                            className="ml-3 hover:bg-white/60 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Alertas Información */}
            {alertasInformacion.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                    <Info className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-800">Información General</h3>
                    <p className="text-sm text-blue-600">Recordatorios y sugerencias</p>
                  </div>
                  <Badge className="bg-blue-100/80 text-blue-800 border-blue-200/60 font-bold">
                    {alertasInformacion.length}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {alertasInformacion.map((alerta) => {
                    const config = getAlertaConfig(alerta.tipo);
                    return (
                      <div 
                        key={alerta.id} 
                        className={`${config.bgColor} backdrop-blur-sm border ${config.borderColor} rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="mt-1">
                              {getAlertaIcon(alerta.tipo)}
                            </div>
                            <div className="flex-1">
                              <p className={`font-medium ${config.textColor} leading-relaxed`}>
                                {alerta.mensaje}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => marcarComoVisto(alerta.id)}
                            className="ml-3 hover:bg-white/60 rounded-lg"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}