import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { UtensilsCrossed, Leaf } from "lucide-react";
import PlatosTable from "@/components/Recetario/PlatosTable";
import IngredientesTable from "@/components/Recetario/IngredientesTable";

export default function RecetarioPage() {
  const [tab, setTab] = useState("platos");

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Recetario</h1>
        <p className="text-slate-500 mt-1">
          Gestión de platos, ingredientes y costos de recetas
        </p>
      </div>

      <Card>
        <CardContent className="p-8">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 p-1">
              <TabsTrigger value="platos" className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold">
                <UtensilsCrossed className="h-4 w-4" />
                <span>Platos</span>
              </TabsTrigger>
              <TabsTrigger value="ingredientes" className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold">
                <Leaf className="h-4 w-4" />
                <span>Ingredientes</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="platos" className="mt-8">
              <PlatosTable />
            </TabsContent>

            <TabsContent value="ingredientes" className="mt-8">
              <IngredientesTable />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
