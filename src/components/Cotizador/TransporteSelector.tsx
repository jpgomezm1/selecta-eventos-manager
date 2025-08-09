import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TransporteTarifa } from "@/types/cotizador";
import { 
  Truck, 
  Plus, 
  Minus, 
  Search, 
  X, 
  DollarSign,
  CheckCircle2,
  MapPin,
  Calendar,
  Clock,
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
    color: "blue",
    description: "Para eventos con gran cantidad de asistentes",
    badge: "Grande"
  },
  "Eventos Pequeños": {
    icon: Star,
    color: "green", 
    description: "Ideal para reuniones íntimas",
    badge: "Pequeño"
  },
  "Selecta To Go": {
    icon: Zap,
    color: "orange",
    description: "Servicio express y delivery",
    badge: "Express"
  },
  "Eventos Noche": {
    icon: Moon,
    color: "purple",
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

  const getQty = (id: string) => itemsSeleccionados.find((x) => x.transporte_id === id)?.cantidad ?? 0;
  const isSelected = (id: string) => getQty(id) > 0;

  // Extraer opciones únicas
  const options = useMemo(() => {
    const tipos = [...new Set(data.map(t => t.tipo_evento))].filter(Boolean).sort();
    const lugares = [...new Set(data.map(t => t.lugar))].filter(Boolean).sort();
    return { tipos, lugares };
  }, [data]);

  // Filtrado y ordenamiento
  const filteredData = useMemo(() => {
    let filtered = data;

    // Filtro por búsqueda
    if (q.trim()) {
      const query = q.toLowerCase().trim();
      filtered = filtered.filter(t => 
        t.lugar.toLowerCase().includes(query) ||
        t.tipo_evento.toLowerCase().includes(query)
      );
    }

    // Filtro por tipo de evento
    if (selectedTipo !== "todos") {
      filtered = filtered.filter(t => t.tipo_evento === selectedTipo);
    }

    // Filtro por lugar
    if (selectedLugar !== "todos") {
      filtered = filtered.filter(t => t.lugar === selectedLugar);
    }

    // Ordenamiento
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

  // Estadísticas por tipo
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
          "relative transition-all duration-200 hover:shadow-lg group",
          "h-full flex flex-col",
          selected 
            ? "border-2 border-selecta-green bg-gradient-to-br from-selecta-green/5 to-selecta-green/10 shadow-md" 
            : "border border-slate-200 hover:border-selecta-green/30"
        )}
      >
        {/* Badge de seleccionado */}
        {selected && (
          <div className="absolute top-3 right-3 z-10 bg-selecta-green text-white rounded-full p-1.5 shadow-lg">
            <CheckCircle2 className="h-3 w-3" />
          </div>
        )}

        <CardContent className="p-4 flex flex-col h-full">
          {/* Header - Lugar con altura fija */}
          <div className="mb-3">
            <div className="flex items-center space-x-2 mb-2">
              <Icon className={cn("h-5 w-5", `text-${tipoConfig?.color || 'blue'}-600`)} />
              <h4 className="font-semibold text-slate-800 leading-snug text-sm h-10 line-clamp-2 group-hover:text-selecta-green transition-colors">
                {transporte.lugar}
              </h4>
            </div>
          </div>

          {/* Badge de tipo - Línea fija */}
          <div className="mb-4 h-6 flex items-center">
            <Badge 
              className={cn(
                "text-xs font-medium",
                `bg-${tipoConfig?.color || 'blue'}-100 text-${tipoConfig?.color || 'blue'}-700 border-${tipoConfig?.color || 'blue'}-200`
              )}
            >
              {tipoConfig?.badge || transporte.tipo_evento}
            </Badge>
          </div>

          {/* Descripción */}
          {tipoConfig?.description && (
            <div className="mb-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {tipoConfig.description}
              </p>
            </div>
          )}

          {/* Spacer para empujar el contenido inferior */}
          <div className="flex-1" />

          {/* Precio - Siempre en la misma posición */}
          <div className="mb-4">
            <div className="flex items-center justify-center p-3 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-selecta-green" />
                <span className="font-bold text-lg text-selecta-green">
                  {tarifa.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Controles - Altura fija */}
          <div className="h-20 flex flex-col justify-end">
            {qty > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-selecta-green/20">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onQtyChange(transporte.id, Math.max(0, qty - 1))}
                    className="h-8 w-8 p-0 border-selecta-green/30 hover:bg-selecta-green hover:text-white"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  
                  <div className="text-center">
                    <span className="font-semibold text-selecta-green text-sm">
                      {qty}
                    </span>
                    <div className="text-xs text-selecta-green/70">
                      {qty === 1 ? 'servicio' : 'servicios'}
                    </div>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onQtyChange(transporte.id, qty + 1)}
                    className="h-8 w-8 p-0 border-selecta-green/30 hover:bg-selecta-green hover:text-white"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="text-center py-1 bg-selecta-green/10 rounded-lg border border-selecta-green/20">
                  <span className="text-sm font-medium text-selecta-green">
                    ${(tarifa * qty).toLocaleString()}
                  </span>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => onAdd(transporte)}
                className="w-full bg-slate-800 hover:bg-selecta-green transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir Servicio
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
          "transition-all duration-200 hover:shadow-md border-l-4",
          selected 
            ? "border-l-selecta-green bg-selecta-green/5" 
            : "border-l-transparent hover:border-l-selecta-green/50"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    `bg-${tipoConfig?.color || 'blue'}-100`
                  )}>
                    <Icon className={cn("h-5 w-5", `text-${tipoConfig?.color || 'blue'}-600`)} />
                  </div>
                  <h4 className="font-semibold text-slate-800 line-clamp-1 flex-1">
                    {transporte.lugar}
                  </h4>
                </div>
                
                {selected && (
                  <Badge className="bg-selecta-green text-white text-xs shrink-0">
                    {qty}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-3 mb-3">
                <Badge 
                  className={cn(
                    "text-xs font-medium",
                    `bg-${tipoConfig?.color || 'blue'}-100 text-${tipoConfig?.color || 'blue'}-700`
                  )}
                >
                  {tipoConfig?.badge || transporte.tipo_evento}
                </Badge>
                
                {tipoConfig?.description && (
                  <span className="text-xs text-slate-500 line-clamp-1">
                    {tipoConfig.description}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4 text-selecta-green" />
                <span className="font-bold text-lg text-selecta-green">
                  {tarifa.toLocaleString()}
                </span>
                {qty > 0 && (
                  <span className="text-sm text-slate-500 ml-3">
                    • Total: ${(tarifa * qty).toLocaleString()}
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
                  <span className="w-8 text-center font-semibold">{qty}</span>
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
                <Button
                  onClick={() => onAdd(transporte)}
                  className="bg-slate-800 hover:bg-selecta-green transition-colors"
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
    <div className="space-y-6">
      {/* Header con resumen */}
      {totalSelected > 0 && (
        <Card className="bg-gradient-to-r from-green-50 via-emerald-50 to-green-50 border-green-200 shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-500 rounded-2xl shadow-lg">
                  <Truck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-xl text-green-800">
                    {totalSelected} servicios de transporte
                  </div>
                  <div className="text-green-700 font-medium">
                    Total logística: ${totalCost.toLocaleString()}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-green-700">Estado logístico</div>
                <Badge 
                  className={cn(
                    "text-xs font-medium",
                    totalSelected >= 2 
                      ? "bg-green-100 text-green-700 border-green-200" 
                      : "bg-amber-100 text-amber-700 border-amber-200"
                  )}
                >
                  {totalSelected >= 2 ? "Completo" : "Básico"}
                </Badge>
              </div>
            </div>

            {/* Estadísticas por tipo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {statsByTipo.map((stat) => {
                const config = TIPOS_CONFIG[stat.tipo as keyof typeof TIPOS_CONFIG];
                const Icon = config?.icon || Truck;
                
                return (
                  <div key={stat.tipo} className="text-center p-3 bg-white/60 rounded-xl">
                    <div className="flex items-center justify-center mb-2">
                      <Icon className={cn("h-4 w-4", `text-${config?.color || 'blue'}-600`)} />
                    </div>
                    <div className="text-sm font-semibold text-green-800">
                      {stat.selected}/{stat.total}
                    </div>
                    <div className="text-xs text-green-600 truncate">
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
      <Card className="shadow-md border-slate-200">
        <CardContent className="p-6 space-y-4">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Buscar por lugar o tipo de evento..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-12 h-12 text-base bg-slate-50 border-slate-300 focus:bg-white focus:border-selecta-green focus:ring-selecta-green/20 rounded-xl"
            />
            {q && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-200 rounded-lg"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Filtros */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Tabs value={selectedTipo} onValueChange={setSelectedTipo}>
                <TabsList className="grid grid-cols-5 w-full bg-slate-100 p-1 rounded-xl">
                  <TabsTrigger 
                    value="todos" 
                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs"
                  >
                    <Truck className="h-4 w-4 mr-1" />
                    Todos ({data.length})
                  </TabsTrigger>
                  {options.tipos.map((tipo) => {
                    const count = data.filter(t => t.tipo_evento === tipo).length;
                    const config = TIPOS_CONFIG[tipo as keyof typeof TIPOS_CONFIG];
                    const Icon = config?.icon || Truck;
                    
                    return (
                      <TabsTrigger 
                        key={tipo} 
                        value={tipo} 
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-medium text-xs"
                      >
                        <Icon className="h-3 w-3 mr-1" />
                        {config?.badge || tipo} ({count})
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </div>

            <div className="flex gap-3">
              <Select value={selectedLugar} onValueChange={setSelectedLugar}>
                <SelectTrigger className="w-48 h-10 rounded-xl border-slate-300">
                  <SelectValue placeholder="Lugar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">
                    Todos los lugares
                  </SelectItem>
                  {options.lugares.map((lugar) => (
                    <SelectItem key={lugar} value={lugar}>
                      {lugar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-36 h-10 rounded-xl border-slate-300">
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lugar">Lugar A-Z</SelectItem>
                  <SelectItem value="tipo">Tipo</SelectItem>
                  <SelectItem value="precio">Precio menor</SelectItem>
                  <SelectItem value="precio-desc">Precio mayor</SelectItem>
                  <SelectItem value="seleccionados">Seleccionados</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearFilters}
                  className="h-10 px-4 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mensaje inicial */}
      {totalSelected === 0 && !hasActiveFilters && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md">
          <CardContent className="p-6 text-center">
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2">
                <MapPin className="h-6 w-6 text-blue-600" />
                <div className="text-blue-800 font-semibold text-lg">
                  ¡Organiza la logística perfecta!
                </div>
              </div>
              <div className="text-blue-700">
                Selecciona servicios de transporte para completar tu propuesta de evento
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información de resultados */}
      <div className="flex items-center justify-between">
        <span className="text-slate-600 font-medium">
          Mostrando {filteredData.length} de {data.length} servicios
        </span>
        
        {hasActiveFilters && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
            <Filter className="h-3 w-3 mr-1" />
            Filtros activos
          </Badge>
        )}
      </div>

      {/* Lista de transportes */}
      {filteredData.length === 0 ? (
        <Card className="py-16 shadow-md">
          <CardContent className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700 text-xl mb-3">No se encontraron servicios</h3>
              <p className="text-slate-500 mb-6">
                {q ? `No hay servicios que coincidan con "${q}"` : "Intenta ajustar los filtros de búsqueda"}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters} className="rounded-xl">
                  <X className="h-4 w-4 mr-2" />
                  Limpiar todos los filtros
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