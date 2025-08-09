import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Search, 
  Plus, 
  Filter, 
  Grid, 
  List, 
  Eye, 
  DollarSign,
  ChevronDown,
  Check,
  Sparkles,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";

type CatalogoSelectorProps<T> = {
  titulo: string;
  items: T[];
  itemKey: keyof T;
  renderTitle: (item: T) => string;
  renderBadge?: (item: T) => string | undefined;
  renderPrice: (item: T) => number;
  renderDescription?: (item: T) => string | undefined;
  renderImage?: (item: T) => string | undefined;
  getCategoryKey?: (item: T) => string;
  getCategoryLabel?: (category: string) => string;
  getSearchableText?: (item: T) => string[];
  onAdd: (item: T) => void;
  selectedItems?: Array<{ id: string; cantidad: number }>;
  emptyStateMessage?: string;
  showPriceRange?: boolean;
};

export function CatalogoSelector<T extends Record<string, any>>({
  titulo,
  items,
  itemKey,
  renderTitle,
  renderBadge,
  renderPrice,
  renderDescription,
  renderImage,
  getCategoryKey,
  getCategoryLabel,
  getSearchableText,
  onAdd,
  selectedItems = [],
  emptyStateMessage = "No hay elementos disponibles",
  showPriceRange = true,
}: CatalogoSelectorProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Extraer categorías únicas
  const categories = useMemo(() => {
    if (!getCategoryKey) return [];
    const categorySet = new Set(items.map(getCategoryKey));
    return Array.from(categorySet).sort();
  }, [items, getCategoryKey]);

  // Calcular rango de precios
  const priceRangeData = useMemo(() => {
    if (!items.length) return { min: 0, max: 0 };
    const prices = items.map(renderPrice);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [items, renderPrice]);

  // Filtrar items
  const filteredItems = useMemo(() => {
    let filtered = items;

    // Filtro por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((item) => {
        const searchableFields = getSearchableText 
          ? getSearchableText(item)
          : [renderTitle(item), renderBadge?.(item) || ""];
        
        return searchableFields.some(field => 
          field?.toLowerCase().includes(query)
        );
      });
    }

    // Filtro por categoría
    if (selectedCategory !== "all" && getCategoryKey) {
      filtered = filtered.filter(item => getCategoryKey(item) === selectedCategory);
    }

    // Filtro por rango de precio
    if (priceRange) {
      filtered = filtered.filter(item => {
        const price = renderPrice(item);
        return price >= priceRange.min && price <= priceRange.max;
      });
    }

    return filtered;
  }, [items, searchQuery, selectedCategory, priceRange, getCategoryKey, getSearchableText, renderTitle, renderBadge, renderPrice]);

  // Verificar si un item está seleccionado
  const isItemSelected = (item: T) => {
    const id = String(item[itemKey]);
    return selectedItems.some(selected => selected.id === id);
  };

  // Obtener cantidad seleccionada
  const getSelectedQuantity = (item: T) => {
    const id = String(item[itemKey]);
    return selectedItems.find(selected => selected.id === id)?.cantidad || 0;
  };

  const renderItemCard = (item: T) => {
    const id = String(item[itemKey]);
    const title = renderTitle(item);
    const price = renderPrice(item);
    const badge = renderBadge?.(item);
    const description = renderDescription?.(item);
    const image = renderImage?.(item);
    const isSelected = isItemSelected(item);
    const quantity = getSelectedQuantity(item);

    return (
      <Card 
        key={id} 
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-lg border-2",
          isSelected 
            ? "border-selecta-green bg-selecta-green/5 shadow-md" 
            : "border-slate-200 hover:border-slate-300"
        )}
      >
        {/* Badge de seleccionado */}
        {isSelected && (
          <div className="absolute top-3 right-3 z-10 bg-selecta-green text-white rounded-full p-1.5 shadow-lg">
            <Check className="h-3 w-3" />
          </div>
        )}

        {/* Imagen si está disponible */}
        {image && (
          <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden relative">
            <img 
              src={image} 
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
        )}

        <CardContent className="p-4 space-y-3">
          {/* Header con título y badge */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-slate-800 leading-tight line-clamp-2 group-hover:text-selecta-green transition-colors">
                {title}
              </h4>
              {quantity > 0 && (
                <Badge variant="secondary" className="bg-selecta-green text-white shrink-0">
                  {quantity}
                </Badge>
              )}
            </div>

            {badge && (
              <Badge variant="outline" className="text-xs">
                {badge}
              </Badge>
            )}
          </div>

          {/* Descripción */}
          {description && (
            <p className="text-sm text-slate-600 line-clamp-2">
              {description}
            </p>
          )}

          {/* Precio y botón */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4 text-selecta-green" />
              <span className="font-bold text-lg text-selecta-green">
                {price.toLocaleString()}
              </span>
            </div>

            <Button
              size="sm"
              onClick={() => onAdd(item)}
              className={cn(
                "transition-all duration-200",
                isSelected
                  ? "bg-selecta-green hover:bg-selecta-green/90"
                  : "bg-slate-800 hover:bg-selecta-green"
              )}
            >
              <Plus className="h-4 w-4 mr-1" />
              {isSelected ? "Agregar más" : "Añadir"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderItemRow = (item: T) => {
    const id = String(item[itemKey]);
    const title = renderTitle(item);
    const price = renderPrice(item);
    const badge = renderBadge?.(item);
    const description = renderDescription?.(item);
    const isSelected = isItemSelected(item);
    const quantity = getSelectedQuantity(item);

    return (
      <Card 
        key={id}
        className={cn(
          "transition-all duration-200 hover:shadow-md border-l-4",
          isSelected 
            ? "border-l-selecta-green bg-selecta-green/5" 
            : "border-l-transparent hover:border-l-slate-300"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h4 className="font-semibold text-slate-800 truncate">{title}</h4>
                {badge && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {badge}
                  </Badge>
                )}
                {quantity > 0 && (
                  <Badge className="bg-selecta-green text-white shrink-0">
                    {quantity}
                  </Badge>
                )}
              </div>
              {description && (
                <p className="text-sm text-slate-600 line-clamp-1">{description}</p>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="flex items-center space-x-1">
                  <DollarSign className="h-4 w-4 text-selecta-green" />
                  <span className="font-bold text-lg text-selecta-green">
                    {price.toLocaleString()}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => onAdd(item)}
                className={cn(
                  "transition-all duration-200",
                  isSelected
                    ? "bg-selecta-green hover:bg-selecta-green/90"
                    : "bg-slate-800 hover:bg-selecta-green"
                )}
              >
                <Plus className="h-4 w-4 mr-1" />
                {isSelected ? "+" : "Añadir"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-selecta-green rounded-xl">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-slate-800">{titulo}</CardTitle>
                <p className="text-sm text-slate-600 mt-1">
                  {filteredItems.length} de {items.length} elementos
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "transition-all",
                  showFilters && "bg-selecta-green text-white"
                )}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtros
              </Button>

              <div className="flex bg-slate-200 rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "px-3 py-1 rounded-md transition-all",
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
                    "px-3 py-1 rounded-md transition-all",
                    viewMode === "list" && "bg-white shadow-sm"
                  )}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Barra de búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder={`Buscar en ${titulo.toLowerCase()}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-slate-300 focus:border-selecta-green focus:ring-selecta-green/20"
            />
          </div>

          {/* Panel de filtros expandible */}
          {showFilters && (
            <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-4">
              {/* Filtro por categorías */}
              {categories.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Categoría</label>
                  <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                    <TabsList className="grid w-full grid-cols-auto bg-slate-100">
                      <TabsTrigger value="all" className="text-xs">
                        Todas ({items.length})
                      </TabsTrigger>
                      {categories.map((category) => {
                        const count = items.filter(item => getCategoryKey?.(item) === category).length;
                        return (
                          <TabsTrigger key={category} value={category} className="text-xs">
                            {getCategoryLabel?.(category) || category} ({count})
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {/* Filtro por rango de precio */}
              {showPriceRange && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Rango de precio</label>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={priceRange?.min || ""}
                      onChange={(e) => {
                        const min = parseInt(e.target.value) || priceRangeData.min;
                        setPriceRange(prev => ({ ...prev, min, max: prev?.max || priceRangeData.max }));
                      }}
                      className="w-24"
                    />
                    <span className="text-slate-500">-</span>
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={priceRange?.max || ""}
                      onChange={(e) => {
                        const max = parseInt(e.target.value) || priceRangeData.max;
                        setPriceRange(prev => ({ ...prev, max, min: prev?.min || priceRangeData.min }));
                      }}
                      className="w-24"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPriceRange(null)}
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contenido principal */}
      {filteredItems.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
              <Eye className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No se encontraron elementos</h3>
              <p className="text-slate-500">{emptyStateMessage}</p>
            </div>
            {(searchQuery || selectedCategory !== "all" || priceRange) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("all");
                  setPriceRange(null);
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-3"
        )}>
          {filteredItems.map(item => 
            viewMode === "grid" ? renderItemCard(item) : renderItemRow(item)
          )}
        </div>
      )}
    </div>
  );
}