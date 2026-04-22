import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import InventarioTable from "@/components/Bodega/InventarioTable";
import ReservasCalendar from "@/components/Bodega/ReservasCalendar";
import MovimientosPanel from "@/components/Bodega/MovimientosPanel";
import { Package, Calendar, ArrowUpDown } from "lucide-react";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function BodegaPage() {
  const [tab, setTab] = useState("inventario");

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Cocina"
        title="Menaje"
        description="Inventario, reservas y movimientos — vajilla, cristalería y utilería que viaja a cada evento."
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 bg-muted/60 p-1">
          <TabsTrigger
            value="inventario"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <Package className="h-3.5 w-3.5" strokeWidth={1.75} />
            Inventario
          </TabsTrigger>
          <TabsTrigger
            value="calendario"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
            Calendario
          </TabsTrigger>
          <TabsTrigger
            value="movimientos"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            Movimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="mt-6">
          <InventarioTable />
        </TabsContent>
        <TabsContent value="calendario" className="mt-6">
          <ReservasCalendar />
        </TabsContent>
        <TabsContent value="movimientos" className="mt-6">
          <MovimientosPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
