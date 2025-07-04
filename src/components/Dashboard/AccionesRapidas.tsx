import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  Users, 
  Mail, 
  AlertTriangle, 
  DollarSign, 
  CheckSquare,
  Zap,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CronogramaDialog } from "./CronogramaDialog";

export function AccionesRapidas() {
  const [stats, setStats] = useState({
    eventosSinPersonal: 0,
    pagosPendientes: 0,
    conflictos: 0,
    totalEventosProximos: 0
  });
  const [isCronogramaDialogOpen, setIsCronogramaDialogOpen] = useState(false);
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
          className="w-full h-14 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
          onClick={() => navigate('/eventos')}
        >
          <div className="flex items-center justify-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">🚨 URGENTE</div>
              <div className="text-xs opacity-90">Asignar Personal ({stats.eventosSinPersonal})</div>
            </div>
          </div>
        </Button>
      );
    }

    if (stats.pagosPendientes > 0) {
      return (
        <Button 
          className="w-full h-14 bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
          onClick={() => navigate('/personal')}
        >
          <div className="flex items-center justify-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold">💰 PAGOS</div>
              <div className="text-xs opacity-90">Liquidar ({stats.pagosPendientes} pendientes)</div>
            </div>
          </div>
        </Button>
      );
    }

    return (
      <Button 
        className="w-full h-14 bg-gradient-primary hover:bg-gradient-primary/90 text-white font-bold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
        onClick={() => navigate('/eventos')}
      >
        <div className="flex items-center justify-center space-x-3">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold">✅ TODO BIEN</div>
            <div className="text-xs opacity-90">Sistema bajo control</div>
          </div>
        </div>
      </Button>
    );
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-r from-selecta-green to-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
              Acciones Rápidas
            </CardTitle>
            <p className="text-slate-600 font-medium">Herramientas esenciales de gestión</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {/* Botón inteligente contextual */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/60 shadow-sm">
          {getBotonInteligente()}
        </div>

        {/* Acciones Principales */}
        <div>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-selecta-green/20 rounded-xl flex items-center justify-center">
              <Activity className="h-4 w-4 text-selecta-green" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Acciones Principales</h3>
              <p className="text-xs text-slate-600">Funciones más utilizadas del sistema</p>
            </div>
          </div>

          {/* Grid de 3 botones principales */}
          <div className="grid grid-cols-1 gap-4">
            {/* Crear Evento */}
            <Button 
              variant="outline" 
              className="h-16 flex items-center justify-start space-x-4 bg-white/80 backdrop-blur-sm border-slate-200/60 hover:bg-blue-50/80 hover:border-blue-200/60 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] px-6"
              onClick={() => navigate('/eventos')}
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <Plus className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-slate-800">Crear Evento</div>
                <div className="text-sm text-slate-600">Programar un nuevo evento</div>
              </div>
            </Button>

            {/* Agregar Empleado */}
            <Button 
              variant="outline" 
              className="h-16 flex items-center justify-start space-x-4 bg-white/80 backdrop-blur-sm border-slate-200/60 hover:bg-emerald-50/80 hover:border-emerald-200/60 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] px-6"
              onClick={() => navigate('/personal')}
            >
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-slate-800">Agregar Empleado</div>
                <div className="text-sm text-slate-600">Registrar nuevo personal</div>
              </div>
            </Button>

            {/* Enviar Cronogramas */}
            <Button 
              variant="outline" 
              className="h-16 flex items-center justify-start space-x-4 bg-white/80 backdrop-blur-sm border-slate-200/60 hover:bg-violet-50/80 hover:border-violet-200/60 hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02] px-6"
              onClick={() => setIsCronogramaDialogOpen(true)}
            >
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                <Mail className="h-6 w-6 text-violet-600" />
              </div>
              <div className="text-left flex-1">
                <div className="font-bold text-slate-800">Enviar Cronogramas</div>
                <div className="text-sm text-slate-600">Notificar horarios al personal</div>
              </div>
            </Button>
          </div>
        </div>

        {/* Estadísticas rápidas */}
        <div className="bg-gradient-to-r from-selecta-green/10 to-primary/10 backdrop-blur-sm rounded-2xl p-6 border border-selecta-green/20">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-selecta-green/20 rounded-xl flex items-center justify-center">
              <Activity className="h-4 w-4 text-selecta-green" />
            </div>
            <h3 className="font-bold text-slate-800">Resumen del Sistema</h3>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-selecta-green">{stats.totalEventosProximos}</div>
              <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">Eventos próximos</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.eventosSinPersonal}</div>
              <div className="text-xs font-medium text-slate-600 uppercase tracking-wide">Sin personal</div>
            </div>
          </div>
        </div>

        {/* Dialog de Cronogramas */}
        <CronogramaDialog
          isOpen={isCronogramaDialogOpen}
          onClose={() => setIsCronogramaDialogOpen(false)}
        />
      </CardContent>
    </Card>
  );
}