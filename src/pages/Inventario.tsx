import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, ArrowUpDown } from "lucide-react";
import StockTable from "@/components/Inventario/StockTable";
import MovimientosPanel from "@/components/Inventario/MovimientosPanel";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function InventarioPage() {
  const [tab, setTab] = useState("stock");

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Cocina"
        title="Inventario"
        accent="de insumos"
        description="Stock y movimientos de ingredientes — ingresos por factura, salidas por evento, mermas."
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/60 p-1">
          <TabsTrigger
            value="stock"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <Package className="h-3.5 w-3.5" strokeWidth={1.75} />
            Stock
          </TabsTrigger>
          <TabsTrigger
            value="movimientos"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            Movimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-6">
          <StockTable />
        </TabsContent>
        <TabsContent value="movimientos" className="mt-6">
          <MovimientosPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
