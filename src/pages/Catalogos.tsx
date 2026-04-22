import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TransporteTarifasTab from "@/components/Catalogos/TransporteTarifasTab";
import PersonalCostosTab from "@/components/Catalogos/PersonalCostosTab";
import LugaresCatalogoTab from "@/components/Catalogos/LugaresCatalogoTab";
import { Truck, Users, MapPin } from "lucide-react";
import { PageHeader } from "@/components/Layout/PageHeader";

export default function CatalogosPage() {
  const [tab, setTab] = useState("transporte");

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Ajustes"
        title="Catálogos"
        description="Tarifas maestras de transporte, personal y lugares — la base económica de toda cotización."
      />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3 bg-muted/60 p-1">
          <TabsTrigger
            value="transporte"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <Truck className="h-3.5 w-3.5" strokeWidth={1.75} />
            Transporte
          </TabsTrigger>
          <TabsTrigger
            value="personal"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
            Personal
          </TabsTrigger>
          <TabsTrigger
            value="lugares"
            className="flex items-center gap-2 text-[12.5px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-soft"
          >
            <MapPin className="h-3.5 w-3.5" strokeWidth={1.75} />
            Lugares
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transporte" className="mt-6">
          <TransporteTarifasTab />
        </TabsContent>
        <TabsContent value="personal" className="mt-6">
          <PersonalCostosTab />
        </TabsContent>
        <TabsContent value="lugares" className="mt-6">
          <LugaresCatalogoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
