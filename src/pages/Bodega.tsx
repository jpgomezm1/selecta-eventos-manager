import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import InventarioTable from "@/components/Bodega/InventarioTable";
import ReservasCalendar from "@/components/Bodega/ReservasCalendar";
import MovimientosPanel from "@/components/Bodega/MovimientosPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BodegaPage() {
  const [tab, setTab] = useState("inventario");

  return (
    <div className="p-3 md:p-6 space-y-4">
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle>Bodega / Menaje</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList>
              <TabsTrigger value="inventario">Inventario</TabsTrigger>
              <TabsTrigger value="calendario">Calendario</TabsTrigger>
              <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
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
        </CardContent>
      </Card>
    </div>
  );
}
