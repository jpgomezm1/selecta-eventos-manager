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
            ? "border-primary bg-primary/5"
            : "border-border hover:border-border/80"
        )}
      >
        {selected && (
          <div className="absolute top-3 right-3 z-10 bg-primary text-primary-foreground rounded-full p-1.5">
            <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
          </div>
        )}

        <CardContent className="p-4 flex flex-col h-full">
          <div className="mb-3">
            <div className="flex items-center space-x-2 mb-2">
              <Package className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              <h4 className="font-semibold text-foreground leading-snug text-sm line-clamp-2 group-hover:text-primary transition-colors">
                {item.nombre}
              </h4>
            </div>
          </div>

          <div className="mb-4 h-6 flex items-center">
            <Badge variant="outline" className="text-xs font-normal">
              {item.categoria}
            </Badge>
          </div>

          <div className="flex-1" />

          <div className="mb-4">
            <div className="flex items-center justify-center p-3 bg-muted/40 rounded-md border border-border">
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <span className="font-semibold text-lg text-primary tabular-nums">
                  {item.precio_alquiler.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="h-20 flex flex-col justify-end">
            {qty > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQtyChange(item.id, Math.max(0, qty - 1))}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>

                  <div className="text-center">
                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        onQtyChange(item.id, isNaN(val) ? 0 : Math.max(0, val));
                      }}
                      className="w-16 text-center font-semibold text-foreground text-sm bg-transparent border border-border rounded-md outline-none focus:ring-1 focus:ring-primary h-8 tabular-nums"
                    />
                    <div className="kicker text-muted-foreground mt-0.5">
                      {qty === 1 ? "unidad" : "unidades"}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQtyChange(item.id, qty + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <div className="text-center py-1.5 rounded-md bg-primary/5 border border-primary/20">
                  <span className="text-sm font-medium text-primary tabular-nums">
                    ${(item.precio_alquiler * qty).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <Button onClick={() => onAdd(item)} className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-2" strokeWidth={1.75} />
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
          "transition-all duration-200 hover:shadow-[var(--shadow-soft)] border-l-2",
          selected
            ? "border-l-primary bg-primary/5"
            : "border-l-transparent hover:border-l-border"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-2">
                <div className="p-2 rounded-md bg-muted/60">
                  <Package className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <h4 className="font-semibold text-foreground line-clamp-1">{item.nombre}</h4>
                {selected && (
                  <Badge variant="default" className="text-xs font-normal shrink-0 tabular-nums">{qty}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="outline" className="text-xs font-normal">{item.categoria}</Badge>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <span className="font-semibold text-primary tabular-nums">{item.precio_alquiler.toLocaleString()}</span>
                {qty > 0 && (
                  <span className="text-sm text-muted-foreground ml-3">
                    · Total ${(item.precio_alquiler * qty).toLocaleString()}
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
                  <input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onQtyChange(item.id, isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-16 text-center font-semibold bg-transparent border border-border rounded-md outline-none focus:ring-1 focus:ring-primary h-8 tabular-nums"
                  />
                  <Button variant="outline" size="sm" onClick={() => onQtyChange(item.id, qty + 1)} className="h-8 w-8 p-0">
                    <Plus className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button onClick={() => onAdd(item)} size="sm">
                  <Plus className="h-4 w-4 mr-1" strokeWidth={1.75} />
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
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Package className="h-5 w-5 text-primary" strokeWidth={1.75} />
                <div>
                  <div className="font-serif text-lg text-foreground">
                    {totalSelected} items de menaje
                  </div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    Total alquiler ${totalCost.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            <Input
              placeholder="Buscar por nombre o categoría..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-11 h-10"
            />
            {q && (
              <Button variant="ghost" size="sm" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategoria === "todos" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategoria("todos")}
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
                >
                  {cat} ({count})
                </Button>
              );
            })}
            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground tabular-nums">
          {filteredData.length} de {data.length} items
        </span>
        {hasActiveFilters && (
          <Badge variant="outline" className="font-normal">
            <Filter className="h-3 w-3 mr-1" strokeWidth={1.75} />
            Filtros activos
          </Badge>
        )}
      </div>

      {filteredData.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center space-y-4">
            <Search className="h-8 w-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">No se encontraron items</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {q ? `No hay items que coincidan con "${q}"` : "Intenta ajustar los filtros"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
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
