import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { PlatosSelector } from "@/components/Cotizador/PlatosSelector";
import { PersonalSelector } from "@/components/Cotizador/PersonalSelector";
import { TransporteSelector } from "@/components/Cotizador/TransporteSelector";
import type { CotizacionItemsState, PersonalCosto, PlatoCatalogo, TransporteTarifa } from "@/types/cotizador";
import { Utensils, Users, Truck, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value?: string;
  onValueChange?: (v: string) => void;
  platos: PlatoCatalogo[];
  personal: PersonalCosto[];
  transportes: TransporteTarifa[];
  items: CotizacionItemsState;
  invitados: number;

  onAddPlato: (p: PlatoCatalogo) => void;
  onAddPersonal: (p: PersonalCosto) => void;
  onAddTransporte: (t: TransporteTarifa) => void;

  onQtyChange: (tipo: keyof CotizacionItemsState, id: string, qty: number) => void;
};

export default function BuilderTabs({
  value = "platos",
  onValueChange,
  platos,
  personal,
  transportes,
  items,
  invitados,
  onAddPlato,
  onAddPersonal,
  onAddTransporte,
  onQtyChange,
}: Props) {
  const [q, setQ] = useState("");

  // atajo de teclado "/" para enfocar búsqueda
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "/") {
      e.preventDefault();
      const el = document.getElementById("builder-search") as HTMLInputElement | null;
      el?.focus();
    }
  };

  const counters = useMemo(
    () => ({
      platos: items.platos.length,
      personal: items.personal.length,
      transportes: items.transportes.length,
    }),
    [items]
  );

  const qnorm = q.trim().toLowerCase();
  const filterBy = <T extends { [k: string]: any }>(arr: T[], pick: (x: T) => string[]) =>
    !qnorm ? arr : arr.filter((x) => pick(x).some((s) => s?.toLowerCase().includes(qnorm)));

  const platosF = filterBy(platos, (x) => [x.nombre, x.categoria, x.tipo_menu]);
  const personalF = filterBy(personal, (x) => [x.rol]);
  const transportesF = filterBy(transportes, (x) => [x.lugar, x.tipo_evento]);

  return (
    <div className="relative" onKeyDown={onKeyDown}>
      {/* Barra sticky con tabs y búsqueda */}
      <div className="sticky top-0 z-20 bg-white/85 backdrop-blur-md border-b border-slate-200/60 rounded-t-2xl">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 p-3">
          <Tabs value={value} onValueChange={onValueChange} className="w-full">
            <TabsList className="w-full grid grid-cols-3 rounded-xl">
              <TabsTrigger value="platos" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
                <div className="inline-flex items-center gap-2">
                  <Utensils className="h-4 w-4" />
                  Platos
                  <span className={cn("text-xs px-1.5 py-0.5 rounded bg-slate-200", counters.platos && "bg-emerald-100 text-emerald-700")}>
                    {counters.platos}
                  </span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="personal" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
                <div className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Personal
                  <span className={cn("text-xs px-1.5 py-0.5 rounded bg-slate-200", counters.personal && "bg-blue-100 text-blue-700")}>
                    {counters.personal}
                  </span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="transporte" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow">
                <div className="inline-flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Transporte
                  <span className={cn("text-xs px-1.5 py-0.5 rounded bg-slate-200", counters.transportes && "bg-green-100 text-green-700")}>
                    {counters.transportes}
                  </span>
                </div>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              id="builder-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (atajo: /)"
              className="pl-9 w-full xl:w-72 rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <Tabs value={value}>
          <TabsContent value="platos" className="mt-0">
            <PlatosSelector
              data={platosF}
              onAdd={onAddPlato}
              itemsSeleccionados={items.platos}
              onQtyChange={(id, qty) => onQtyChange("platos", id, qty)}
            />
          </TabsContent>

          <TabsContent value="personal" className="mt-0">
            <PersonalSelector
              data={personalF}
              onAdd={onAddPersonal}
              itemsSeleccionados={items.personal}
              onQtyChange={(id, qty) => onQtyChange("personal", id, qty)}
              invitados={invitados}
            />
          </TabsContent>

          <TabsContent value="transporte" className="mt-0">
            <TransporteSelector
              data={transportesF}
              onAdd={onAddTransporte}
              itemsSeleccionados={items.transportes}
              onQtyChange={(id, qty) => onQtyChange("transportes", id, qty)}
            />
          </TabsContent>
        </Tabs>

        <Separator className="opacity-30" />

        {/* Dock en mobile para cambiar rápido de categoría */}
        <div className="xl:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-white/90 backdrop-blur-md shadow-lg border border-slate-200 rounded-full px-2 py-1 flex gap-1">
            {([
              { key: "platos", icon: <Utensils className="h-4 w-4" /> },
              { key: "personal", icon: <Users className="h-4 w-4" /> },
              { key: "transporte", icon: <Truck className="h-4 w-4" /> },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => onValueChange?.(t.key)}
                className={cn(
                  "px-3 py-1 rounded-full text-sm flex items-center gap-1",
                  value === t.key ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                )}
              >
                {t.icon}
                <span className="capitalize hidden xs:inline">{t.key}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
