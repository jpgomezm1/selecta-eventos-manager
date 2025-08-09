import { useMemo, useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PlatosSelector } from "@/components/Cotizador/PlatosSelector";
import { PersonalSelector } from "@/components/Cotizador/PersonalSelector";
import { TransporteSelector } from "@/components/Cotizador/TransporteSelector";
import type { CotizacionItemsState, PersonalCosto, PlatoCatalogo, TransporteTarifa } from "@/types/cotizador";
import { 
  Utensils, 
  Users, 
  Truck, 
  Search, 
  Filter, 
  X, 
  ChevronDown,
  Sparkles,
  ShoppingCart,
  Target,
  Zap,
  Eye,
  EyeOff,
  SortAsc,
  SortDesc,
  Grid,
  List,
  RotateCcw
} from "lucide-react";
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

type SortOption = "nombre" | "precio" | "categoria" | "seleccionados";
type ViewMode = "grid" | "list";

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
  const [sortBy, setSortBy] = useState<SortOption>("nombre");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Resetear filtros cuando cambia la tab
  useEffect(() => {
    setQ("");
    setSelectedCategories([]);
    setShowOnlySelected(false);
  }, [value]);

  // Atajo de teclado "/" para enfocar búsqueda
  const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "/") {
      e.preventDefault();
      const el = document.getElementById("builder-search") as HTMLInputElement | null;
      el?.focus();
    }
    if (e.key === "Escape") {
      clearAllFilters();
    }
  };

  const clearAllFilters = () => {
    setQ("");
    setSelectedCategories([]);
    setShowOnlySelected(false);
    setSortBy("nombre");
    setSortOrder("asc");
  };

  const counters = useMemo(
    () => ({
      platos: items.platos.length,
      personal: items.personal.length,
      transportes: items.transportes.length,
      total: items.platos.length + items.personal.length + items.transportes.length,
    }),
    [items]
  );

  // Función de filtrado mejorada
  const getFilteredData = useMemo(() => {
    const qnorm = q.trim().toLowerCase();
    
    const filterAndSort = <T extends { [k: string]: any }>(
      arr: T[], 
      searchFields: (x: T) => string[],
      categoryField?: (x: T) => string,
      selectedItems?: Array<{ id: string; cantidad: number }>
    ) => {
      let filtered = arr;

      // Filtro por búsqueda
      if (qnorm) {
        filtered = filtered.filter((x) => 
          searchFields(x).some((s) => s?.toLowerCase().includes(qnorm))
        );
      }

      // Filtro por categorías seleccionadas
      if (selectedCategories.length > 0 && categoryField) {
        filtered = filtered.filter((x) => 
          selectedCategories.includes(categoryField(x))
        );
      }

      // Filtro solo seleccionados
      if (showOnlySelected && selectedItems) {
        filtered = filtered.filter((x) => 
          selectedItems.some(item => item.id === String(x.id))
        );
      }

      // Ordenamiento
      filtered.sort((a, b) => {
        let aVal: any, bVal: any;
        
        switch (sortBy) {
          case "nombre":
            aVal = a.nombre || "";
            bVal = b.nombre || "";
            break;
          case "precio":
            aVal = Number(a.precio || a.tarifa || a.tarifa_estimada_por_persona || 0);
            bVal = Number(b.precio || b.tarifa || b.tarifa_estimada_por_persona || 0);
            break;
          case "categoria":
            aVal = a.categoria || a.rol || a.lugar || "";
            bVal = b.categoria || b.rol || b.lugar || "";
            break;
          case "seleccionados":
            const aSelected = selectedItems?.find(item => item.id === String(a.id))?.cantidad || 0;
            const bSelected = selectedItems?.find(item => item.id === String(b.id))?.cantidad || 0;
            aVal = aSelected;
            bVal = bSelected;
            break;
          default:
            aVal = a.nombre || "";
            bVal = b.nombre || "";
        }

        if (typeof aVal === "string") {
          return sortOrder === "asc" 
            ? aVal.localeCompare(bVal) 
            : bVal.localeCompare(aVal);
        }
        
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      });

      return filtered;
    };

    return {
      platos: filterAndSort(
        platos, 
        (x) => [x.nombre, x.categoria, x.tipo_menu],
        (x) => x.categoria,
        items.platos.map(p => ({ id: p.plato_id, cantidad: p.cantidad }))
      ),
      personal: filterAndSort(
        personal, 
        (x) => [x.rol],
        (x) => x.rol,
        items.personal.map(p => ({ id: p.personal_costo_id, cantidad: p.cantidad }))
      ),
      transportes: filterAndSort(
        transportes, 
        (x) => [x.lugar, x.tipo_evento],
        (x) => x.lugar,
        items.transportes.map(t => ({ id: t.transporte_id, cantidad: t.cantidad }))
      ),
    };
  }, [q, platos, personal, transportes, items, sortBy, sortOrder, selectedCategories, showOnlySelected]);

  // Obtener categorías únicas para la tab actual
  const availableCategories = useMemo(() => {
    switch (value) {
      case "platos":
        return [...new Set(platos.map(p => p.categoria))].filter(Boolean).sort();
      case "personal":
        return [...new Set(personal.map(p => p.rol))].filter(Boolean).sort();
      case "transporte":
        return [...new Set(transportes.map(t => t.lugar))].filter(Boolean).sort();
      default:
        return [];
    }
  }, [value, platos, personal, transportes]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleSort = (newSortBy: SortOption) => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("asc");
    }
  };

  const activeFiltersCount = [
    q.trim() ? 1 : 0,
    selectedCategories.length,
    showOnlySelected ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  const currentData = getFilteredData[value as keyof typeof getFilteredData] || [];
  const currentItemCount = currentData.length;
  const totalItemCount = value === "platos" ? platos.length : 
                         value === "personal" ? personal.length : 
                         transportes.length;

  return (
    <div className="relative space-y-6" onKeyDown={onKeyDown}>
      {/* Header principal mejorado */}
      <Card className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-slate-200 overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Header con estadísticas */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-selecta-green to-primary rounded-2xl shadow-lg">
                  <ShoppingCart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Constructor de Cotización</h2>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-slate-600">
                      {counters.total} elementos seleccionados
                    </span>
                    <div className="w-px h-4 bg-slate-300" />
                    <span className="text-sm text-slate-600">
                      {invitados} invitados
                    </span>
                    {activeFiltersCount > 0 && (
                      <>
                        <div className="w-px h-4 bg-slate-300" />
                        <Badge variant="secondary" className="bg-selecta-green/10 text-selecta-green">
                          {activeFiltersCount} filtro(s) activo(s)
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "transition-all duration-200",
                    showFilters && "bg-selecta-green text-white border-selecta-green"
                  )}
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filtros
                  {activeFiltersCount > 0 && (
                    <Badge className="ml-2 bg-white text-selecta-green text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>

                {activeFiltersCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="text-red-600 hover:bg-red-50 hover:border-red-200"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Limpiar
                  </Button>
                )}
              </div>
            </div>

            {/* Tabs principales */}
            <Tabs value={value} onValueChange={onValueChange} className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-slate-100 p-1 rounded-2xl shadow-inner">
                <TabsTrigger 
                  value="platos" 
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      value === "platos" ? "bg-orange-100" : "bg-transparent"
                    )}>
                      <Utensils className={cn(
                        "h-4 w-4",
                        value === "platos" ? "text-orange-600" : "text-slate-500"
                      )} />
                    </div>
                    <span className="font-medium">Platos</span>
                    <Badge 
                      className={cn(
                        "text-xs",
                        counters.platos > 0 
                          ? "bg-orange-100 text-orange-700 border-orange-200" 
                          : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {counters.platos}
                    </Badge>
                  </div>
                </TabsTrigger>

                <TabsTrigger 
                  value="personal" 
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      value === "personal" ? "bg-blue-100" : "bg-transparent"
                    )}>
                      <Users className={cn(
                        "h-4 w-4",
                        value === "personal" ? "text-blue-600" : "text-slate-500"
                      )} />
                    </div>
                    <span className="font-medium">Personal</span>
                    <Badge 
                      className={cn(
                        "text-xs",
                        counters.personal > 0 
                          ? "bg-blue-100 text-blue-700 border-blue-200" 
                          : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {counters.personal}
                    </Badge>
                  </div>
                </TabsTrigger>

                <TabsTrigger 
                  value="transporte" 
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all duration-200"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      value === "transporte" ? "bg-green-100" : "bg-transparent"
                    )}>
                      <Truck className={cn(
                        "h-4 w-4",
                        value === "transporte" ? "text-green-600" : "text-slate-500"
                      )} />
                    </div>
                    <span className="font-medium">Transporte</span>
                    <Badge 
                      className={cn(
                        "text-xs",
                        counters.transportes > 0 
                          ? "bg-green-100 text-green-700 border-green-200" 
                          : "bg-slate-200 text-slate-600"
                      )}
                    >
                      {counters.transportes}
                    </Badge>
                  </div>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Barra de búsqueda y controles */}
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="builder-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={`Buscar en ${value}... (atajo: /)`}
                  className="pl-10 bg-white border-slate-300 focus:border-selecta-green focus:ring-selecta-green/20 rounded-xl"
                />
                {q && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQ("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-slate-100"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {/* Ordenamiento */}
                <div className="flex bg-slate-100 rounded-xl p-1">
                  {[
                    { key: "nombre", label: "Nombre", icon: SortAsc },
                    { key: "precio", label: "Precio", icon: SortAsc },
                    { key: "seleccionados", label: "Seleccionados", icon: Target },
                  ].map(({ key, label, icon: Icon }) => (
                    <Button
                      key={key}
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleSort(key as SortOption)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-xs transition-all",
                        sortBy === key && "bg-white shadow-sm"
                      )}
                    >
                      <Icon className={cn(
                        "h-3 w-3 mr-1",
                        sortBy === key && sortOrder === "desc" && "rotate-180"
                      )} />
                      {label}
                    </Button>
                  ))}
                </div>

                {/* Vista */}
                <div className="flex bg-slate-100 rounded-xl p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "px-3 py-1 rounded-lg transition-all",
                      viewMode === "grid" && "bg-white shadow-sm"
                    )}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "px-3 py-1 rounded-lg transition-all",
                      viewMode === "list" && "bg-white shadow-sm"
                    )}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                {/* Solo seleccionados */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOnlySelected(!showOnlySelected)}
                  className={cn(
                    "transition-all",
                    showOnlySelected && "bg-selecta-green text-white border-selecta-green"
                  )}
                >
                  {showOnlySelected ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <span className="ml-1 hidden sm:inline">Solo seleccionados</span>
                </Button>
              </div>
            </div>

            {/* Panel de filtros expandible */}
            {showFilters && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-selecta-green" />
                    Filtros Avanzados
                  </h3>
                  <span className="text-sm text-slate-600">
                    {currentItemCount} de {totalItemCount} elementos
                  </span>
                </div>

                {/* Filtro por categorías */}
                {availableCategories.length > 0 && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700">
                      Filtrar por {value === "platos" ? "categoría" : value === "personal" ? "rol" : "lugar"}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableCategories.map((category) => (
                        <Button
                          key={category}
                          variant="outline"
                          size="sm"
                          onClick={() => toggleCategory(category)}
                          className={cn(
                            "transition-all duration-200",
                            selectedCategories.includes(category)
                              ? "bg-selecta-green text-white border-selecta-green"
                              : "hover:border-selecta-green hover:text-selecta-green"
                          )}
                        >
                          {category}
                          {selectedCategories.includes(category) && (
                            <X className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contenido de las tabs */}
      <div className="space-y-6">
        <Tabs value={value}>
          <TabsContent value="platos" className="mt-0">
            <PlatosSelector
              data={getFilteredData.platos}
              onAdd={onAddPlato}
              itemsSeleccionados={items.platos}
              onQtyChange={(id, qty) => onQtyChange("platos", id, qty)}
              viewMode={viewMode}
            />
          </TabsContent>

          <TabsContent value="personal" className="mt-0">
            <PersonalSelector
              data={getFilteredData.personal}
              onAdd={onAddPersonal}
              itemsSeleccionados={items.personal}
              onQtyChange={(id, qty) => onQtyChange("personal", id, qty)}
              invitados={invitados}
              viewMode={viewMode}
            />
          </TabsContent>

          <TabsContent value="transporte" className="mt-0">
            <TransporteSelector
              data={getFilteredData.transportes}
              onAdd={onAddTransporte}
              itemsSeleccionados={items.transportes}
              onQtyChange={(id, qty) => onQtyChange("transportes", id, qty)}
              viewMode={viewMode}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dock flotante móvil mejorado */}
      <div className="lg:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-30">
        <Card className="bg-white/95 backdrop-blur-md shadow-2xl border-white/40 rounded-2xl overflow-hidden">
          <CardContent className="p-2">
            <div className="flex gap-1">
              {([
                { key: "platos", icon: Utensils, color: "orange", count: counters.platos },
                { key: "personal", icon: Users, color: "blue", count: counters.personal },
                { key: "transporte", icon: Truck, color: "green", count: counters.transportes },
              ] as const).map(({ key, icon: Icon, color, count }) => (
                <button
                  key={key}
                  onClick={() => onValueChange?.(key)}
                  className={cn(
                    "relative px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all duration-200",
                    value === key 
                      ? `bg-${color}-500 text-white shadow-lg` 
                      : "hover:bg-slate-100 text-slate-600"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="capitalize font-medium">{key}</span>
                  {count > 0 && (
                    <Badge 
                      className={cn(
                        "text-xs h-5 w-5 p-0 flex items-center justify-center",
                        value === key 
                          ? "bg-white text-slate-800" 
                          : `bg-${color}-100 text-${color}-700`
                      )}
                    >
                      {count}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Indicador de progreso del filtro */}
      {activeFiltersCount > 0 && (
        <div className="fixed top-4 right-4 z-40 lg:hidden">
          <Card className="bg-selecta-green text-white shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {activeFiltersCount} filtro(s)
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}