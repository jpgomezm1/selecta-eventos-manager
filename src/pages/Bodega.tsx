import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import InventarioTable from "@/components/Bodega/InventarioTable";
import ReservasCalendar from "@/components/Bodega/ReservasCalendar";
import MovimientosPanel from "@/components/Bodega/MovimientosPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  Calendar, 
  ArrowUpDown, 
  Warehouse,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";

export default function BodegaPage() {
  const [tab, setTab] = useState("inventario");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-blue-100/20 to-indigo-200/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-emerald-100/30 to-blue-100/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-gradient-to-r from-purple-100/40 to-pink-100/40 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3">
                <Warehouse className="h-8 w-8 text-white" />
              </div>
              <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 rounded-3xl blur-xl" />
            </div>
            
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent leading-tight">
                Gestión de Bodega
              </h1>
              <p className="text-slate-600 text-lg font-medium mt-2">
                Control de inventario, reservas y movimientos de menaje
              </p>
            </div>
          </div>

          {/* Línea decorativa */}
          <div className="flex items-center justify-center space-x-2">
            <div className="w-16 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" />
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <div className="w-8 h-1 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full" />
          </div>
        </div>

        {/* Contenido principal */}
        <Card className="bg-white/90 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-200/30 pb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500 rounded-2xl shadow-lg">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold text-blue-900">
                  Sistema de Inventario
                </CardTitle>
                <p className="text-blue-600 mt-1">Administra tu menaje y equipamiento de eventos</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-100/80 rounded-2xl p-2 shadow-inner">
                <TabsTrigger 
                  value="inventario"
                  className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-blue-600 rounded-xl font-semibold transition-all duration-200 hover:bg-white/50"
                >
                  <Package className="h-4 w-4" />
                  <span>Inventario</span>
                </TabsTrigger>

                <TabsTrigger 
                  value="calendario"
                  className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-blue-600 rounded-xl font-semibold transition-all duration-200 hover:bg-white/50"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Calendario</span>
                </TabsTrigger>

                <TabsTrigger 
                  value="movimientos"
                  className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-blue-600 rounded-xl font-semibold transition-all duration-200 hover:bg-white/50"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  <span>Movimientos</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="inventario" className="mt-8">
                <div className="space-y-6">
                  {/* Header de sección */}
                  <div className="flex items-center justify-between p-6 bg-gradient-to-r from-orange-50/80 to-amber-50/80 rounded-2xl border border-orange-200/50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-orange-500 rounded-xl">
                        <Package className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-orange-800">Catálogo de Inventario</h3>
                        <p className="text-orange-600 text-sm">Gestiona todos los elementos de tu bodega</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1 bg-white/70 px-3 py-1 rounded-xl">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-slate-600 font-medium">Disponible</span>
                      </div>
                      <div className="flex items-center space-x-1 bg-white/70 px-3 py-1 rounded-xl">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="text-slate-600 font-medium">Stock bajo</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/30">
                    <InventarioTable />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="calendario" className="mt-8">
                <div className="space-y-6">
                  {/* Header de sección */}
                  <div className="flex items-center justify-between p-6 bg-gradient-to-r from-emerald-50/80 to-green-50/80 rounded-2xl border border-emerald-200/50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-emerald-500 rounded-xl">
                        <Calendar className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-emerald-800">Calendario de Reservas</h3>
                        <p className="text-emerald-600 text-sm">Visualiza la disponibilidad de tu menaje</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1 bg-white/70 px-3 py-1 rounded-xl">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span className="text-slate-600 font-medium">Reservado</span>
                      </div>
                      <div className="flex items-center space-x-1 bg-white/70 px-3 py-1 rounded-xl">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span className="text-slate-600 font-medium">Disponible</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/30 overflow-hidden">
                    <ReservasCalendar />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="movimientos" className="mt-8">
                <div className="space-y-6">
                  {/* Header de sección */}
                  <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50/80 to-violet-50/80 rounded-2xl border border-purple-200/50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-500 rounded-xl">
                        <ArrowUpDown className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-purple-800">Control de Movimientos</h3>
                        <p className="text-purple-600 text-sm">Registra entradas y salidas de inventario</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1 bg-white/70 px-3 py-1 rounded-xl">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span className="text-slate-600 font-medium">Ingresos</span>
                      </div>
                      <div className="flex items-center space-x-1 bg-white/70 px-3 py-1 rounded-xl">
                        <div className="w-2 h-2 bg-red-400 rounded-full" />
                        <span className="text-slate-600 font-medium">Salidas</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-white/30">
                    <MovimientosPanel />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer informativo */}
        <div className="text-center mt-12 pt-8">
          <div className="inline-flex items-center justify-center space-x-4 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/30">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-slate-600">Sistema de Bodega</span>
            </div>
            <div className="w-px h-4 bg-slate-300" />
            <div className="flex items-center space-x-2">
              <Warehouse className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-500">Control total de inventario</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}