import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  Users, 
  Calendar, 
  DollarSign, 
  AlertTriangle, 
  Mail, 
  MessageSquare, 
  FileText, 
  CheckSquare,
  BarChart3,
  Clock,
  Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export function AccionesRapidas() {
  const [stats, setStats] = useState({
    eventosSinPersonal: 0,
    pagosPendientes: 0,
    conflictos: 0,
    totalEventosProximos: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    cargarEstadisticas();
  }, []);

  const cargarEstadisticas = async () => {
    try {
      // Eventos próximos sin personal
      const { data: eventosSinPersonal } = await supabase
        .from("eventos")
        .select(`
          id,
          evento_personal(id)
        `)
        .gte("fecha_evento", new Date().toISOString().split('T')[0])
        .lte("fecha_evento", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      const eventosVacios = eventosSinPersonal?.filter(e => e.evento_personal.length === 0).length || 0;

      // Pagos pendientes
      const { data: pagosPendientes } = await supabase
        .from("evento_personal")
        .select("id")
        .eq("estado_pago", "pendiente");

      // Total eventos próximos
      const { data: eventosProximos } = await supabase
        .from("eventos")
        .select("id")
        .gte("fecha_evento", new Date().toISOString().split('T')[0]);

      setStats({
        eventosSinPersonal: eventosVacios,
        pagosPendientes: pagosPendientes?.length || 0,
        conflictos: 0, // Se calculará más adelante
        totalEventosProximos: eventosProximos?.length || 0
      });
    } catch (error) {
      console.error("Error cargando estadísticas:", error);
    }
  };

  const getBotonInteligente = () => {
    if (stats.eventosSinPersonal > 0) {
      return (
        <Button 
          className="w-full bg-red-600 hover:bg-red-700 text-white"
          onClick={() => navigate('/eventos')}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          🚨 Asignar Personal Urgente ({stats.eventosSinPersonal})
        </Button>
      );
    }

    if (stats.pagosPendientes > 0) {
      return (
        <Button 
          className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          onClick={() => navigate('/personal')}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          💰 Liquidar Pagos ({stats.pagosPendientes} pendientes)
        </Button>
      );
    }

    return (
      <Button 
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        onClick={() => navigate('/eventos')}
      >
        <CheckSquare className="h-4 w-4 mr-2" />
        ✅ Todo bajo control - Ver eventos
      </Button>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <CheckSquare className="h-5 w-5" />
          <span>Acciones Rápidas</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Botón inteligente contextual */}
        <div>
          {getBotonInteligente()}
        </div>

        {/* Gestión de Eventos */}
        <div>
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
            Gestión de Eventos
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => navigate('/eventos')}
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs">Crear Evento</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => navigate('/eventos')}
            >
              <Users className="h-4 w-4" />
              <span className="text-xs">Asignar Personal</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => navigate('/eventos')}
            >
              <Calendar className="h-4 w-4" />
              <span className="text-xs">Ver Calendario</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1 relative"
              onClick={() => navigate('/eventos')}
            >
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs">Resolver Conflictos</span>
              {stats.conflictos > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs bg-red-500">
                  {stats.conflictos}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* Gestión de Personal */}
        <div>
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
            Gestión de Personal
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => navigate('/personal')}
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs">Agregar Empleado</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => navigate('/personal')}
            >
              <Eye className="h-4 w-4" />
              <span className="text-xs">Ver Disponibilidad</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1 relative"
              onClick={() => navigate('/personal')}
            >
              <DollarSign className="h-4 w-4" />
              <span className="text-xs">Procesar Pagos</span>
              {stats.pagosPendientes > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs bg-orange-500">
                  {stats.pagosPendientes}
                </Badge>
              )}
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => navigate('/personal')}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs">Reportes</span>
            </Button>
          </div>
        </div>

        {/* Comunicación */}
        <div>
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
            Comunicación
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => {
                // TODO: Implementar envío de cronogramas
                alert("Función de envío por email próximamente");
              }}
            >
              <Mail className="h-4 w-4" />
              <span className="text-xs">Enviar Cronogramas</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => {
                // TODO: Implementar notificaciones WhatsApp
                alert("Función de WhatsApp próximamente");
              }}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs">Notificar Empleados</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => {
                // TODO: Implementar generación de reportes
                alert("Generación de reportes próximamente");
              }}
            >
              <FileText className="h-4 w-4" />
              <span className="text-xs">Generar Reportes</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-auto py-3 flex flex-col items-center space-y-1"
              onClick={() => {
                // TODO: Implementar lista de verificación
                alert("Lista de verificación próximamente");
              }}
            >
              <CheckSquare className="h-4 w-4" />
              <span className="text-xs">Lista Verificación</span>
            </Button>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-primary">{stats.totalEventosProximos}</div>
              <div className="text-xs text-muted-foreground">Eventos próximos</div>
            </div>
            <div>
              <div className="text-lg font-bold text-secondary">{stats.eventosSinPersonal}</div>
              <div className="text-xs text-muted-foreground">Sin personal</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}