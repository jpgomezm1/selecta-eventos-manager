import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import InventarioTable from "@/components/Bodega/InventarioTable";
import ReservasCalendar from "@/components/Bodega/ReservasCalendar";
import MovimientosPanel from "@/components/Bodega/MovimientosPanel";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Calendar, ArrowUpDown } from "lucide-react";

export default function BodegaPage() {
  const [tab, setTab] = useState("inventario");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Gestión de Menaje
        </h1>
        <p className="text-slate-500 mt-1">
          Control de inventario, reservas y movimientos de menaje
        </p>
      </div>

      {/* Contenido principal */}
      <Card>
        <CardContent className="p-8">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 p-1">
              <TabsTrigger
                value="inventario"
                className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold"
              >
                <Package className="h-4 w-4" />
                <span>Inventario</span>
              </TabsTrigger>

              <TabsTrigger
                value="calendario"
                className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold"
              >
                <Calendar className="h-4 w-4" />
                <span>Calendario</span>
              </TabsTrigger>

              <TabsTrigger
                value="movimientos"
                className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold"
              >
                <ArrowUpDown className="h-4 w-4" />
                <span>Movimientos</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inventario" className="mt-8">
              <InventarioTable />
            </TabsContent>

            <TabsContent value="calendario" className="mt-8">
              <ReservasCalendar />
            </TabsContent>

            <TabsContent value="movimientos" className="mt-8">
              <MovimientosPanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
