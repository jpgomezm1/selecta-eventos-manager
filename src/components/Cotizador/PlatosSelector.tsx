import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlatoCatalogo } from "@/types/cotizador";
import { 
  Utensils, 
  Plus, 
  Minus, 
  Search, 
  X, 
  DollarSign,
  ChevronDown,
  Filter,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  data: PlatoCatalogo[];
  onAdd: (p: PlatoCatalogo) => void;
  itemsSeleccionados: { plato_id: string; cantidad: number }[];
  onQtyChange: (id: string, qty: number) => void;
  viewMode?: "grid" | "list";
};

export function PlatosSelector({ 
  data, 
  onAdd, 
  itemsSeleccionados, 
  onQtyChange,
  viewMode = "grid" 
}: Props) {
  const [q, setQ] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<string>("todos");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todas");
  const [sortBy, setSortBy] = useState<string>("nombre");

  const getQty = (id: string) => itemsSeleccionados.find((x) => x.plato_id === id)?.cantidad ?? 0;
  const isSelected = (id: string) => getQty(id) > 0;

  // Extraer opciones únicas
  const options = useMemo(() => {
    const tipos = [...new Set(data.map(p => p.tipo_menu))].filter(Boolean).sort();
    const categorias = [...new Set(data.map(p => p.categoria))].filter(Boolean).sort();
    return { tipos, categorias };
  }, [data]);

  // Filtrado simple y eficiente
  const filteredData = useMemo(() => {
    let filtered = data;

    // Filtro por búsqueda
    if (q.trim()) {
      const query = q.toLowerCase().trim();
      filtered = filtered.filter(p => 
        p.nombre.toLowerCase().includes(query) ||
        p.categoria?.toLowerCase().includes(query)
      );
    }

    // Filtro por tipo de menú
    if (selectedTipo !== "todos") {
      filtered = filtered.filter(p => p.tipo_menu === selectedTipo);
    }

    // Filtro por categoría
    if (selectedCategoria !== "todas") {
      filtered = filtered.filter(p => p.categoria === selectedCategoria);
    }

    // Ordenamiento
    filtered.sort((a, b) => {
      if (sortBy === "precio") {
        return Number(a.precio) - Number(b.precio);
      }
      if (sortBy === "precio-desc") {
        return Number(b.precio) - Number(a.precio);
      }
      if (sortBy === "seleccionados") {
        return getQty(b.id) - getQty(a.id);
      }
      return a.nombre.localeCompare(b.nombre);
    });

    return filtered;
  }, [data, q, selectedTipo, selectedCategoria, sortBy, getQty]);

  const totalSelected = itemsSeleccionados.reduce((sum, item) => sum + item.cantidad, 0);
  const totalCost = itemsSeleccionados.reduce((sum, item) => {
    const plato = data.find(p => p.id === item.plato_id);
    return sum + (plato ? Number(plato.precio) * item.cantidad : 0);
  }, 0);

  const clearFilters = () => {
    setQ("");
    setSelectedTipo("todos");
    setSelectedCategoria("todas");
    setSortBy("nombre");
  };

  const hasActiveFilters = q || selectedTipo !== "todos" || selectedCategoria !== "todas";

  const renderPlatoCard = (plato: PlatoCatalogo) => {
    const qty = getQty(plato.id);
    const precio = Number(plato.precio);
    const selected = isSelected(plato.id);

    return (
      <Card 
        key={plato.id} 
        className={cn(
          "relative transition-all duration-200 hover:shadow-md border h-full",
          selected 
            ? "border-selecta-green bg-selecta-green/5" 
            : "border-slate-200 hover:border-slate-300"
        )}
      >
        {selected && (
          <div className="absolute top-3 right-3 z-10 bg-selecta-green text-white rounded-full p-1">
            <CheckCircle2 className="h-3 w-3" />
          </div>
        )}

        <CardContent className="p-4 h-full flex flex-col">
          {/* Título - altura fija */}
          <div className="mb-3">
            <h4 className="font-medium text-slate-800 leading-tight text-sm min-h-[2.5rem] flex items-start">
              <span className="line-clamp-2">
                {plato.nombre}
              </span>
            </h4>
          </div>
          
          {/* Badges - uno debajo del otro con altura fija */}
          <div className="space-y-2 mb-4 min-h-[3.5rem] flex flex-col justify-start">
            <Badge 
              variant="outline" 
              className="text-xs bg-slate-50 w-fit max-w-full truncate"
              title={plato.categoria}
            >
              {plato.categoria}
            </Badge>
            
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs w-fit max-w-full truncate",
                plato.tipo_menu === "Menu General" 
                  ? "bg-blue-100 text-blue-700" 
                  : "bg-purple-100 text-purple-700"
              )}
              title={plato.tipo_menu}
            >
              {plato.tipo_menu === "Menu General" ? "General" : "Personalizable"}
            </Badge>
          </div>

          {/* Precio */}
          <div className="flex items-center space-x-1 py-2 mb-4">
            <DollarSign className="h-4 w-4 text-selecta-green" />
            <span className="font-bold text-lg text-selecta-green">
              {precio.toLocaleString()}
            </span>
          </div>

          {/* Controles - se empujan al final */}
          <div className="mt-auto">
            {qty > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onQtyChange(plato.id, Math.max(0, qty - 1))}
                    className="h-8 w-8 p-0 shrink-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  
                  <div className="text-center px-2 min-w-0">
                    <span className="font-medium text-selecta-green text-sm block truncate">
                      {qty} {qty === 1 ? 'plato' : 'platos'}
                    </span>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onQtyChange(plato.id, qty + 1)}
                    className="h-8 w-8 p-0 shrink-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="text-center p-2 bg-selecta-green/10 rounded-lg">
                  <span className="text-sm font-medium text-selecta-green">
                    Total: ${(precio * qty).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => onAdd(plato)}
                className="w-full bg-slate-800 hover:bg-selecta-green transition-colors"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Añadir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderPlatoRow = (plato: PlatoCatalogo) => {
    const qty = getQty(plato.id);
    const precio = Number(plato.precio);
    const selected = isSelected(plato.id);

    return (
      <Card 
        key={plato.id}
        className={cn(
          "transition-all duration-200 hover:shadow-sm border-l-4",
          selected 
            ? "border-l-selecta-green bg-selecta-green/5" 
            : "border-l-transparent hover:border-l-slate-300"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h4 className="font-medium text-slate-800 flex-1 line-clamp-2 leading-tight">
                  {plato.nombre}
                </h4>
                
                {selected && (
                  <Badge className="bg-selecta-green text-white text-xs shrink-0 ml-2">
                    {qty}
                  </Badge>
                )}
              </div>
              
              {/* Badges en columna para modo lista también */}
              <div className="space-y-2 mb-3">
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="outline" 
                    className="text-xs max-w-[200px] truncate"
                    title={plato.categoria}
                  >
                    {plato.categoria}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "text-xs max-w-[200px] truncate",
                      plato.tipo_menu === "Menu General" 
                        ? "bg-blue-100 text-blue-700" 
                        : "bg-purple-100 text-purple-700"
                    )}
                    title={plato.tipo_menu}
                  >
                    {plato.tipo_menu === "Menu General" ? "General" : "Personalizable"}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-selecta-green" />
                <span className="font-bold text-selecta-green">
                  {precio.toLocaleString()}
                </span>
                {qty > 0 && (
                  <span className="text-sm text-slate-500 ml-2">
                    • Total: ${(precio * qty).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {qty > 0 ? (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onQtyChange(plato.id, Math.max(0, qty - 1))}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{qty}</span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onQtyChange(plato.id, qty + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => onAdd(plato)}
                  className="bg-slate-800 hover:bg-selecta-green"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header con resumen */}
      {totalSelected > 0 && (
        <Card className="bg-selecta-green/5 border-selecta-green/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-selecta-green/10 rounded-lg">
                  <Utensils className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-selecta-green">
                    {totalSelected} platos seleccionados
                  </div>
                  <div className="text-sm text-selecta-green/70">
                    Total: ${totalCost.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controles principales */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar platos por nombre o categoría..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-10"
            />
            {q && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Filtros en línea */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Tabs value={selectedTipo} onValueChange={setSelectedTipo} className="flex-1">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="todos" className="text-xs">
                  Todos ({data.length})
                </TabsTrigger>
                {options.tipos.map((tipo) => {
                  const count = data.filter(p => p.tipo_menu === tipo).length;
                  return (
                    <TabsTrigger key={tipo} value={tipo} className="text-xs">
                      {tipo === "Menu General" ? "General" : "Personalizable"} ({count})
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="flex gap-2">
              <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">
                    Todas las categorías
                  </SelectItem>
                  {options.categorias.map((categoria) => (
                    <SelectItem key={categoria} value={categoria}>
                      {categoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nombre">Nombre</SelectItem>
                  <SelectItem value="precio">Precio ↑</SelectItem>
                  <SelectItem value="precio-desc">Precio ↓</SelectItem>
                  <SelectItem value="seleccionados">Seleccionados</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensaje de sugerencia inicial */}
      {totalSelected === 0 && !hasActiveFilters && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 text-center">
            <div className="space-y-2">
              <div className="text-amber-800 font-medium">
                ¡Comienza a armar tu menú!
              </div>
              <div className="text-amber-600 text-sm">
                Selecciona platos para crear una propuesta completa para tus clientes
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información de resultados */}
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Mostrando {filteredData.length} de {data.length} platos
        </span>
        
        {hasActiveFilters && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700">
            <Filter className="h-3 w-3 mr-1" />
            Filtros activos
          </Badge>
        )}
      </div>

      {/* Lista de platos */}
      {filteredData.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
              <Search className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <h3 className="font-medium text-slate-700 mb-2">No se encontraron platos</h3>
              <p className="text-slate-500 text-sm mb-4">
                {q ? `No hay platos que coincidan con "${q}"` : "Intenta ajustar los filtros"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            : "space-y-3"
        )}>
          {filteredData.map(plato => 
            viewMode === "grid" ? renderPlatoCard(plato) : renderPlatoRow(plato)
          )}
        </div>
      )}
    </div>
  );
}