import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UtensilsCrossed, Leaf } from "lucide-react";
import PlatosTable from "@/components/Recetario/PlatosTable";
import IngredientesTable from "@/components/Recetario/IngredientesTable";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function RecetarioPage() {
  const [tab, setTab] = useState("platos");

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Cocina"
        title="Recetario"
        description="Platos, ingredientes y costos — el recetario que alimenta las cotizaciones."
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/60 p-1">
          <TabsTrigger
            value="platos"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <UtensilsCrossed className="h-3.5 w-3.5" strokeWidth={1.75} />
            Platos
          </TabsTrigger>
          <TabsTrigger
            value="ingredientes"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <Leaf className="h-3.5 w-3.5" strokeWidth={1.75} />
            Ingredientes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="platos" className="mt-6">
          <PlatosTable />
        </TabsContent>
        <TabsContent value="ingredientes" className="mt-6">
          <IngredientesTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
