import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { MenajeCatalogo } from "@/types/menaje";
import {
  Package,
  Plus,
  Minus,
  Search,
  X,
  DollarSign,
  CheckCircle2,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  data: MenajeCatalogo[];
  onAdd: (m: MenajeCatalogo) => void;
  itemsSeleccionados: { menaje_id: string; cantidad: number }[];
  onQtyChange: (id: string, qty: number) => void;
  viewMode?: "grid" | "list";
};

export function MenajeSelector({
  data,
  onAdd,
  itemsSeleccionados,
  onQtyChange,
  viewMode = "grid"
}: Props) {
  const [q, setQ] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("todos");

  const getQty = (id: string) => itemsSeleccionados.find((x) => x.menaje_id === id)?.cantidad ?? 0;
  const isSelected = (id: string) => getQty(id) > 0;

  const categories = useMemo(() => {
    return [...new Set(data.map(m => m.categoria))].filter(Boolean).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    let filtered = data;
    if (q.trim()) {
      const query = q.toLowerCase().trim();
      filtered = filtered.filter(m =>
        m.nombre.toLowerCase().includes(query) ||
        m.categoria.toLowerCase().includes(query)
      );
    }
    if (selectedCategoria !== "todos") {
      filtered = filtered.filter(m => m.categoria === selectedCategoria);
    }
    return filtered;
  }, [data, q, selectedCategoria]);

  const totalSelected = itemsSeleccionados.reduce((sum, item) => sum + item.cantidad, 0);
  const totalCost = itemsSeleccionados.reduce((sum, item) => {
    const menaje = data.find(m => m.id === item.menaje_id);
    return sum + (menaje ? menaje.precio_alquiler * item.cantidad : 0);
  }, 0);

  const hasActiveFilters = q || selectedCategoria !== "todos";

  const clearFilters = () => {
    setQ("");
    setSelectedCategoria("todos");
  };

  const renderCard = (item: MenajeCatalogo) => {
    const qty = getQty(item.id);
    const selected = isSelected(item.id);

    return (
      <Card
        key={item.id}
        className={cn(
          "relative transition-all duration-200 group h-full flex flex-col",
          selected
            ? "border-2 border-purple-500 bg-purple-50/50"
            : "border border-slate-200 hover:border-purple-300"
        )}
      >
        {selected && (
          <div className="absolute top-3 right-3 z-10 bg-purple-600 text-white rounded-full p-1.5 shadow-lg">
            <CheckCircle2 className="h-3 w-3" />
          </div>
        )}

        <CardContent className="p-4 flex flex-col h-full">
          <div className="mb-3">
            <div className="flex items-center space-x-2 mb-2">
              <Package className="h-5 w-5 text-purple-600" />
              <h4 className="font-semibold text-slate-800 leading-snug text-sm line-clamp-2 group-hover:text-purple-600 transition-colors">
                {item.nombre}
              </h4>
            </div>
          </div>

          <div className="mb-4 h-6 flex items-center">
            <Badge className="text-xs font-medium bg-purple-100 text-purple-700 border-purple-200">
              {item.categoria}
            </Badge>
          </div>

          <div className="flex-1" />

          <div className="mb-4">
            <div className="flex items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-purple-600" />
                <span className="font-bold text-lg text-purple-600">
                  {item.precio_alquiler.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="h-20 flex flex-col justify-end">
            {qty > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-purple-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQtyChange(item.id, Math.max(0, qty - 1))}
                    className="h-8 w-8 p-0 border-purple-300 hover:bg-purple-600 hover:text-white"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>

                  <div className="text-center">
                    <span className="font-semibold text-purple-600 text-sm">{qty}</span>
                    <div className="text-xs text-purple-500">
                      {qty === 1 ? "unidad" : "unidades"}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQtyChange(item.id, qty + 1)}
                    className="h-8 w-8 p-0 border-purple-300 hover:bg-purple-600 hover:text-white"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <div className="text-center py-1 bg-purple-100 rounded-lg border border-purple-200">
                  <span className="text-sm font-medium text-purple-600">
                    ${(item.precio_alquiler * qty).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => onAdd(item)}
                className="w-full bg-slate-800 hover:bg-purple-600 transition-colors"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderRow = (item: MenajeCatalogo) => {
    const qty = getQty(item.id);
    const selected = isSelected(item.id);

    return (
      <Card
        key={item.id}
        className={cn(
          "transition-all duration-200 hover:shadow-md border-l-4",
          selected
            ? "border-l-purple-500 bg-purple-50/50"
            : "border-l-transparent hover:border-l-purple-300"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <h4 className="font-semibold text-slate-800 line-clamp-1">{item.nombre}</h4>
                {selected && (
                  <Badge className="bg-purple-600 text-white text-xs shrink-0">{qty}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Badge className="text-xs font-medium bg-purple-100 text-purple-700">{item.categoria}</Badge>
              </div>
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-purple-600" />
                <span className="font-bold text-lg text-purple-600">{item.precio_alquiler.toLocaleString()}</span>
                {qty > 0 && (
                  <span className="text-sm text-slate-500 ml-3">
                    Total: ${(item.precio_alquiler * qty).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {qty > 0 ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => onQtyChange(item.id, Math.max(0, qty - 1))} className="h-8 w-8 p-0">
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-semibold">{qty}</span>
                  <Button variant="outline" size="sm" onClick={() => onQtyChange(item.id, qty + 1)} className="h-8 w-8 p-0">
                    <Plus className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button onClick={() => onAdd(item)} className="bg-slate-800 hover:bg-purple-600 transition-colors" size="sm">
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
    <div className="space-y-6">
      {totalSelected > 0 && (
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <div className="font-bold text-xl text-purple-800">
                    {totalSelected} items de menaje
                  </div>
                  <div className="text-purple-700 font-medium">
                    Total alquiler: ${totalCost.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md border-slate-200">
        <CardContent className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Buscar por nombre o categoría..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-12 h-12 text-base bg-slate-50 border-slate-300 focus:bg-white focus:border-purple-500 focus:ring-purple-500/20 rounded-xl"
            />
            {q && (
              <Button variant="ghost" size="sm" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategoria === "todos" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategoria("todos")}
              className={cn("rounded-lg", selectedCategoria === "todos" && "bg-purple-600 hover:bg-purple-700")}
            >
              Todos ({data.length})
            </Button>
            {categories.map(cat => {
              const count = data.filter(m => m.categoria === cat).length;
              return (
                <Button
                  key={cat}
                  variant={selectedCategoria === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategoria(cat)}
                  className={cn("rounded-lg", selectedCategoria === cat && "bg-purple-600 hover:bg-purple-700")}
                >
                  {cat} ({count})
                </Button>
              );
            })}
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-lg border-red-200 text-red-600 hover:bg-red-50">
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-slate-600 font-medium">
          Mostrando {filteredData.length} de {data.length} items
        </span>
        {hasActiveFilters && (
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
            <Filter className="h-3 w-3 mr-1" />
            Filtros activos
          </Badge>
        )}
      </div>

      {filteredData.length === 0 ? (
        <Card className="py-16 shadow-md">
          <CardContent className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 text-xl mb-3">No se encontraron items</h3>
              <p className="text-slate-500 mb-6">
                {q ? `No hay items que coincidan con "${q}"` : "Intenta ajustar los filtros"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="rounded-xl">
                  <X className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "space-y-4"
        )}>
          {filteredData.map(item =>
            viewMode === "grid" ? renderCard(item) : renderRow(item)
          )}
        </div>
      )}
    </div>
  );
}
