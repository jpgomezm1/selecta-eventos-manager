import { ProximosEventos } from "@/components/Dashboard/ProximosEventos";
import { AlertasPanel } from "@/components/Dashboard/AlertasPanel";
import { AccionesRapidas } from "@/components/Dashboard/AccionesRapidas";

export default function Dashboard() {
  return (
    <div className="min-h-screen relative">
      {/* Background decorativo sutil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-selecta-green/3 to-primary/3 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-slate-100/50 to-selecta-green/5 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>
      </div>

      <div className="relative z-10 space-y-8">
        {/* Header mejorado */}
        <div className="text-center lg:text-left">
          <div className="inline-flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">📊</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                Dashboard Operativo
              </h1>
              <p className="text-slate-600 text-lg font-medium mt-1">
                Gestión diaria de eventos y personal
              </p>
            </div>
          </div>
          
          {/* Línea decorativa */}
          <div className="w-32 h-1 bg-gradient-to-r from-selecta-green to-primary rounded-full mx-auto lg:mx-0 mb-2"></div>
          
          {/* Indicador de estado */}
          <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-slate-200/60">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-slate-700">Sistema operativo</span>
          </div>
        </div>

        {/* Grid mejorado con mejor spacing y efectos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Próximos Eventos - Columna principal con efecto glassmorphism */}
          <div className="lg:col-span-2">
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
                <ProximosEventos />
              </div>
            </div>
          </div>

          {/* Sidebar con Alertas y Acciones - Efectos mejorados */}
          <div className="space-y-8">
            {/* Alertas Panel con efecto glassmorphism */}
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
                <AlertasPanel />
              </div>
            </div>

            {/* Acciones Rápidas con efecto glassmorphism */}
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
                <AccionesRapidas />
              </div>
            </div>
          </div>
        </div>

        {/* Footer decorativo sutil */}
        <div className="text-center pt-8">
          <div className="inline-flex items-center space-x-2 text-sm text-slate-400">
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <span>Última actualización: {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}