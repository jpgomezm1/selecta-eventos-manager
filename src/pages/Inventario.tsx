import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Package, ArrowUpDown } from "lucide-react";
import StockTable from "@/components/Inventario/StockTable";
import MovimientosPanel from "@/components/Inventario/MovimientosPanel";

export default function InventarioPage() {
  const [tab, setTab] = useState("stock");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Inventario de Insumos
        </h1>
        <p className="text-slate-500 mt-1">
          Control de stock y movimientos de ingredientes
        </p>
      </div>

      <Card>
        <CardContent className="p-8">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 p-1">
              <TabsTrigger
                value="stock"
                className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold"
              >
                <Package className="h-4 w-4" />
                <span>Stock</span>
              </TabsTrigger>
              <TabsTrigger
                value="movimientos"
                className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold"
              >
                <ArrowUpDown className="h-4 w-4" />
                <span>Movimientos</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stock" className="mt-8">
              <StockTable />
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
