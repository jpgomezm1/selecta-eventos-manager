import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TransporteTarifasTab from "@/components/Catalogos/TransporteTarifasTab";
import PersonalCostosTab from "@/components/Catalogos/PersonalCostosTab";
import LugaresCatalogoTab from "@/components/Catalogos/LugaresCatalogoTab";
import { Card, CardContent } from "@/components/ui/card";
import { Truck, Users, MapPin } from "lucide-react";

export default function CatalogosPage() {
  const [tab, setTab] = useState("transporte");

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Catálogos</h1>
        <p className="text-slate-500 mt-1">
          Administración de tarifas y catálogos
        </p>
      </div>

      {/* Contenido principal */}
      <Card>
        <CardContent className="p-8">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 p-1">
              <TabsTrigger
                value="transporte"
                className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold"
              >
                <Truck className="h-4 w-4" />
                <span>Transporte</span>
              </TabsTrigger>

              <TabsTrigger
                value="personal"
                className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold"
              >
                <Users className="h-4 w-4" />
                <span>Personal</span>
              </TabsTrigger>

              <TabsTrigger
                value="lugares"
                className="flex items-center space-x-2 data-[state=active]:shadow-sm font-semibold"
              >
                <MapPin className="h-4 w-4" />
                <span>Lugares</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="transporte" className="mt-8">
              <TransporteTarifasTab />
            </TabsContent>

            <TabsContent value="personal" className="mt-8">
              <PersonalCostosTab />
            </TabsContent>

            <TabsContent value="lugares" className="mt-8">
              <LugaresCatalogoTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
