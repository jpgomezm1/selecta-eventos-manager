import { useCallback, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TransporteTarifa } from "@/types/cotizador";
import {
  Truck,
  Plus,
  Minus,
  Search,
  X,
  CheckCircle2,
  MapPin,
  Star,
  Zap,
  Moon,
  Users,
  Filter
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  data: TransporteTarifa[];
  onAdd: (t: TransporteTarifa) => void;
  itemsSeleccionados: { transporte_id: string; cantidad: number }[];
  onQtyChange: (id: string, qty: number) => void;
  viewMode?: "grid" | "list";
};

const TIPOS_CONFIG = {
  "Eventos Grandes": {
    icon: Users,
    description: "Para eventos con gran cantidad de asistentes",
    badge: "Grande"
  },
  "Eventos Pequeños": {
    icon: Star,
    description: "Ideal para reuniones íntimas",
    badge: "Pequeño"
  },
  "Selecta To Go": {
    icon: Zap,
    description: "Servicio express y delivery",
    badge: "Express"
  },
  "Eventos Noche": {
    icon: Moon,
    description: "Especializado en eventos nocturnos",
    badge: "Nocturno"
  }
} as const;

export function TransporteSelector({
  data,
  onAdd,
  itemsSeleccionados,
  onQtyChange,
  viewMode = "grid"
}: Props) {
  const [q, setQ] = useState("");
  const [selectedTipo, setSelectedTipo] = useState<string>("todos");
  const [selectedLugar, setSelectedLugar] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<string>("lugar");

  const getQty = useCallback(
    (id: string) => itemsSeleccionados.find((x) => x.transporte_id === id)?.cantidad ?? 0,
    [itemsSeleccionados]
  );
  const isSelected = useCallback((id: string) => getQty(id) > 0, [getQty]);

  const options = useMemo(() => {
    const tipos = [...new Set(data.map(t => t.tipo_evento))].filter(Boolean).sort();
    const lugares = [...new Set(data.map(t => t.lugar))].filter(Boolean).sort();
    return { tipos, lugares };
  }, [data]);

  const filteredData = useMemo(() => {
    let filtered = data;

    if (q.trim()) {
      const query = q.toLowerCase().trim();
      filtered = filtered.filter(t =>
        t.lugar.toLowerCase().includes(query) ||
        t.tipo_evento.toLowerCase().includes(query)
      );
    }

    if (selectedTipo !== "todos") {
      filtered = filtered.filter(t => t.tipo_evento === selectedTipo);
    }

    if (selectedLugar !== "todos") {
      filtered = filtered.filter(t => t.lugar === selectedLugar);
    }

    filtered.sort((a, b) => {
      if (sortBy === "precio") {
        return Number(a.tarifa) - Number(b.tarifa);
      }
      if (sortBy === "precio-desc") {
        return Number(b.tarifa) - Number(a.tarifa);
      }
      if (sortBy === "seleccionados") {
        return getQty(b.id) - getQty(a.id);
      }
      if (sortBy === "tipo") {
        return a.tipo_evento.localeCompare(b.tipo_evento);
      }
      return a.lugar.localeCompare(b.lugar);
    });

    return filtered;
  }, [data, q, selectedTipo, selectedLugar, sortBy, getQty]);

  const totalSelected = itemsSeleccionados.reduce((sum, item) => sum + item.cantidad, 0);
  const totalCost = itemsSeleccionados.reduce((sum, item) => {
    const transporte = data.find(t => t.id === item.transporte_id);
    return sum + (transporte ? Number(transporte.tarifa) * item.cantidad : 0);
  }, 0);

  const clearFilters = () => {
    setQ("");
    setSelectedTipo("todos");
    setSelectedLugar("todos");
    setSortBy("lugar");
  };

  const hasActiveFilters = q || selectedTipo !== "todos" || selectedLugar !== "todos";

  const statsByTipo = useMemo(() => {
    return options.tipos.map(tipo => {
      const tipoData = data.filter(t => t.tipo_evento === tipo);
      const selectedInTipo = itemsSeleccionados.filter(item => {
        const transporte = data.find(t => t.id === item.transporte_id);
        return transporte?.tipo_evento === tipo;
      }).reduce((sum, item) => sum + item.cantidad, 0);

      return { tipo, total: tipoData.length, selected: selectedInTipo };
    });
  }, [data, itemsSeleccionados, options.tipos]);

  const renderTransporteCard = (transporte: TransporteTarifa) => {
    const qty = getQty(transporte.id);
    const tarifa = Number(transporte.tarifa);
    const selected = isSelected(transporte.id);
    const tipoConfig = TIPOS_CONFIG[transporte.tipo_evento as keyof typeof TIPOS_CONFIG];
    const Icon = tipoConfig?.icon || Truck;

    return (
      <Card
        key={transporte.id}
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
              <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
              <h4 className="font-semibold text-foreground leading-snug text-sm h-10 line-clamp-2 group-hover:text-primary transition-colors">
                {transporte.lugar}
              </h4>
            </div>
          </div>

          <div className="mb-4 h-6 flex items-center">
            <Badge variant="outline" className="text-xs font-normal">
              {tipoConfig?.badge || transporte.tipo_evento}
            </Badge>
          </div>

          {tipoConfig?.description && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {tipoConfig.description}
              </p>
            </div>
          )}

          <div className="flex-1" />

          <div className="mb-4">
            <div className="flex items-center justify-center p-3 bg-muted/40 rounded-md border border-border">
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <span className="font-semibold text-lg text-primary tabular-nums">
                  {tarifa.toLocaleString()}
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
                    onClick={() => onQtyChange(transporte.id, Math.max(0, qty - 1))}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>

                  <Input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onQtyChange(transporte.id, isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-16 h-8 text-center text-sm font-medium tabular-nums"
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQtyChange(transporte.id, qty + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                <div className="text-center py-1.5 rounded-md bg-primary/5 border border-primary/20">
                  <span className="text-sm font-medium text-primary tabular-nums">
                    ${(tarifa * qty).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <Button onClick={() => onAdd(transporte)} className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-2" strokeWidth={1.75} />
                Añadir servicio
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTransporteRow = (transporte: TransporteTarifa) => {
    const qty = getQty(transporte.id);
    const tarifa = Number(transporte.tarifa);
    const selected = isSelected(transporte.id);
    const tipoConfig = TIPOS_CONFIG[transporte.tipo_evento as keyof typeof TIPOS_CONFIG];
    const Icon = tipoConfig?.icon || Truck;

    return (
      <Card
        key={transporte.id}
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
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-md bg-muted/60">
                    <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  <h4 className="font-semibold text-foreground line-clamp-1 flex-1">
                    {transporte.lugar}
                  </h4>
                </div>

                {selected && (
                  <Badge variant="default" className="text-xs font-normal shrink-0 tabular-nums">
                    {qty}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 mb-3">
                <Badge variant="outline" className="text-xs font-normal">
                  {tipoConfig?.badge || transporte.tipo_evento}
                </Badge>

                {tipoConfig?.description && (
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {tipoConfig.description}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <span className="font-semibold text-primary tabular-nums">
                  {tarifa.toLocaleString()}
                </span>
                {qty > 0 && (
                  <span className="text-sm text-muted-foreground ml-3">
                    · Total ${(tarifa * qty).toLocaleString()}
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
                    onClick={() => onQtyChange(transporte.id, Math.max(0, qty - 1))}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <Input
                    type="number"
                    min={0}
                    value={qty}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      onQtyChange(transporte.id, isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    className="w-16 h-8 text-center text-sm font-medium tabular-nums"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onQtyChange(transporte.id, qty + 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button onClick={() => onAdd(transporte)} size="sm">
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
      {/* Header con resumen */}
      {totalSelected > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Truck className="h-5 w-5 text-primary" strokeWidth={1.75} />
                <div>
                  <div className="font-serif text-lg text-foreground">
                    {totalSelected} servicios de transporte
                  </div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    Total logística ${totalCost.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="kicker text-muted-foreground">Estado logístico</div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-normal",
                    totalSelected >= 2
                      ? "text-primary border-primary/40"
                      : "text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]"
                  )}
                >
                  {totalSelected >= 2 ? "Completo" : "Básico"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {statsByTipo.map((stat) => {
                const config = TIPOS_CONFIG[stat.tipo as keyof typeof TIPOS_CONFIG];
                const Icon = config?.icon || Truck;

                return (
                  <div key={stat.tipo} className="text-center p-3 bg-muted/40 rounded-md border border-border">
                    <div className="flex items-center justify-center mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    </div>
                    <div className="text-sm font-semibold text-foreground tabular-nums">
                      {stat.selected}/{stat.total}
                    </div>
                    <div className="kicker text-muted-foreground truncate">
                      {config?.badge || stat.tipo}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controles principales */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            <Input
              placeholder="Buscar por lugar o tipo de evento..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-11 h-10"
            />
            {q && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Tabs value={selectedTipo} onValueChange={setSelectedTipo}>
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="todos" className="text-xs">
                    <Truck className="h-3 w-3 mr-1" strokeWidth={1.75} />
                    Todos ({data.length})
                  </TabsTrigger>
                  {options.tipos.map((tipo) => {
                    const count = data.filter(t => t.tipo_evento === tipo).length;
                    const config = TIPOS_CONFIG[tipo as keyof typeof TIPOS_CONFIG];
                    const Icon = config?.icon || Truck;

                    return (
                      <TabsTrigger key={tipo} value={tipo} className="text-xs">
                        <Icon className="h-3 w-3 mr-1" strokeWidth={1.75} />
                        {config?.badge || tipo} ({count})
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            <div className="flex gap-2">
              <Select value={selectedLugar} onValueChange={setSelectedLugar}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Lugar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los lugares</SelectItem>
                  {options.lugares.map((lugar) => (
                    <SelectItem key={lugar} value={lugar}>
                      {lugar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lugar">Lugar A–Z</SelectItem>
                  <SelectItem value="tipo">Tipo</SelectItem>
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

      {/* Mensaje inicial */}
      {totalSelected === 0 && !hasActiveFilters && (
        <Card className="bg-muted/40 border-border">
          <CardContent className="p-5 text-center">
            <div className="space-y-1">
              <div className="flex items-center justify-center space-x-2">
                <MapPin className="h-4 w-4 text-primary" strokeWidth={1.75} />
                <div className="font-serif text-base text-foreground">
                  Organiza la logística del evento
                </div>
              </div>
              <div className="text-muted-foreground text-sm">
                Selecciona servicios de transporte para completar la propuesta
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información de resultados */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground tabular-nums">
          {filteredData.length} de {data.length} servicios
        </span>

        {hasActiveFilters && (
          <Badge variant="outline" className="font-normal">
            <Filter className="h-3 w-3 mr-1" strokeWidth={1.75} />
            Filtros activos
          </Badge>
        )}
      </div>

      {/* Lista de transportes */}
      {filteredData.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center space-y-4">
            <Search className="h-8 w-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">No se encontraron servicios</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {q ? `No hay servicios que coincidan con "${q}"` : "Intenta ajustar los filtros"}
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
          {filteredData.map(transporte =>
            viewMode === "grid" ? renderTransporteCard(transporte) : renderTransporteRow(transporte)
          )}
        </div>
      )}
    </div>
  );
}
