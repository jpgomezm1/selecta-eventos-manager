import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import type { PersonalCosto } from "@/types/cotizador";
import { 
  Users, 
  Plus, 
  Minus, 
  ChefHat, 
  Camera, 
  Music, 
  Palette, 
  Coffee,
  Star,
  Search,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Calculator,
  DollarSign,
  Target,
  Lightbulb,
  Eye,
  Grid,
  List
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  data: PersonalCosto[];
  onAdd: (p: PersonalCosto) => void;
  itemsSeleccionados: { personal_costo_id: string; cantidad: number }[];
  onQtyChange: (id: string, qty: number) => void;
  invitados: number;
  viewMode?: "grid" | "list";
};

const ROLES_CONFIG: Record<string, { 
  icon: any; 
  color: string; 
  description: string;
  suggestedRatio?: number; // personas por invitado
  category: "servicio" | "cocina" | "entretenimiento" | "tecnico" | "otro";
}> = {
  "Coordinador": { 
    icon: Target, 
    color: "purple", 
    description: "Coordina y supervisa el evento",
    suggestedRatio: 100, // 1 por cada 100 invitados
    category: "servicio"
  },
  "Mesero": { 
    icon: Coffee, 
    color: "blue", 
    description: "Atiende mesas y sirve alimentos",
    suggestedRatio: 15, // 1 por cada 15 invitados
    category: "servicio"
  },
  "Chef": { 
    icon: ChefHat, 
    color: "orange", 
    description: "Prepara y supervisa la cocina",
    suggestedRatio: 50, // 1 por cada 50 invitados
    category: "cocina"
  },
  "Bartender": { 
    icon: Coffee, 
    color: "green", 
    description: "Prepara bebidas y cocteles",
    suggestedRatio: 30, // 1 por cada 30 invitados
    category: "servicio"
  },
  "Decorador": { 
    icon: Palette, 
    color: "pink", 
    description: "Diseña y monta decoración",
    category: "otro"
  },
  "Técnico de Sonido": { 
    icon: Music, 
    color: "indigo", 
    description: "Maneja audio y sonido",
    category: "tecnico"
  },
  "Fotógrafo": { 
    icon: Camera, 
    color: "slate", 
    description: "Captura momentos del evento",
    category: "entretenimiento"
  },
  "Otro": { 
    icon: Users, 
    color: "gray", 
    description: "Personal especializado",
    category: "otro"
  },
};

const CATEGORIES = [
  { key: "todos", label: "Todos", icon: Users },
  { key: "servicio", label: "Servicio", icon: Coffee },
  { key: "cocina", label: "Cocina", icon: ChefHat },
  { key: "entretenimiento", label: "Entretenimiento", icon: Camera },
  { key: "tecnico", label: "Técnico", icon: Music },
  { key: "otro", label: "Otros", icon: Target },
] as const;

export function PersonalSelector({ 
  data, 
  onAdd, 
  itemsSeleccionados, 
  onQtyChange, 
  invitados,
  viewMode = "grid" 
}: Props) {
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [showSuggestions, setShowSuggestions] = useState(true);

  const getQty = (id: string) => itemsSeleccionados.find((x) => x.personal_costo_id === id)?.cantidad ?? 0;
  const isSelected = (id: string) => getQty(id) > 0;

  // Calcular sugerencias inteligentes
  const suggestions = useMemo(() => {
    if (invitados === 0) return {};
    
    const suggestions: Record<string, number> = {};
    Object.entries(ROLES_CONFIG).forEach(([rol, config]) => {
      if (config.suggestedRatio) {
        suggestions[rol] = Math.max(1, Math.ceil(invitados / config.suggestedRatio));
      }
    });
    return suggestions;
  }, [invitados]);

  // Filtrar datos
  const filtered = useMemo(() => {
    return data
      .filter((p) => {
        if (selectedCategory === "todos") return true;
        const config = ROLES_CONFIG[p.rol];
        return config?.category === selectedCategory;
      })
      .filter((p) => 
        p.rol.toLowerCase().includes(q.toLowerCase()) ||
        ROLES_CONFIG[p.rol]?.description.toLowerCase().includes(q.toLowerCase())
      )
      .sort((a, b) => {
        // Ordenar por: seleccionados primero, luego por rol
        const aSelected = isSelected(a.id);
        const bSelected = isSelected(b.id);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        return a.rol.localeCompare(b.rol);
      });
  }, [data, q, selectedCategory]);

  // Estadísticas
  const stats = useMemo(() => {
    const totalSelected = itemsSeleccionados.reduce((sum, item) => sum + item.cantidad, 0);
    const totalCost = itemsSeleccionados.reduce((sum, item) => {
      const person = data.find(p => p.id === item.personal_costo_id);
      return sum + (person ? Number(person.tarifa) * item.cantidad : 0);
    }, 0);
    
    const byCategory = CATEGORIES.slice(1).map(category => {
      const categoryData = data.filter(p => ROLES_CONFIG[p.rol]?.category === category.key);
      const selectedInCategory = itemsSeleccionados.filter(item => {
        const person = data.find(p => p.id === item.personal_costo_id);
        return person && ROLES_CONFIG[person.rol]?.category === category.key;
      }).reduce((sum, item) => sum + item.cantidad, 0);
      
      return {
        ...category,
        total: categoryData.length,
        selected: selectedInCategory
      };
    });

    return { totalSelected, totalCost, byCategory };
  }, [itemsSeleccionados, data]);

  const renderPersonCard = (person: PersonalCosto) => {
    const config = ROLES_CONFIG[person.rol] || ROLES_CONFIG["Otro"];
    const qty = getQty(person.id);
    const suggested = suggestions[person.rol];
    const Icon = config.icon;
    const tarifa = Number(person.tarifa);
    const selected = isSelected(person.id);

    return (
      <Card 
        key={person.id} 
        className={cn(
          "group relative overflow-hidden transition-all duration-300 hover:shadow-lg border-2",
          selected 
            ? "border-selecta-green bg-selecta-green/5 shadow-md" 
            : "border-slate-200 hover:border-slate-300"
        )}
      >
        {/* Badge de sugerido */}
        {suggested && !selected && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
              <Lightbulb className="h-3 w-3 mr-1" />
              Sugerido: {suggested}
            </Badge>
          </div>
        )}

        {/* Badge de seleccionado */}
        {selected && (
          <div className="absolute top-3 right-3 z-10 bg-selecta-green text-white rounded-full p-1.5 shadow-lg">
            <CheckCircle2 className="h-3 w-3" />
          </div>
        )}

        <CardHeader className="pb-3">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "p-3 rounded-xl shadow-sm",
              `bg-${config.color}-100`
            )}>
              <Icon className={cn("h-5 w-5", `text-${config.color}-600`)} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-800 truncate group-hover:text-selecta-green transition-colors">
                {person.rol}
              </h4>
              <p className="text-sm text-slate-600 line-clamp-1">
                {config.description}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Precio */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center space-x-1">
              <DollarSign className="h-4 w-4 text-selecta-green" />
              <span className="font-bold text-lg text-selecta-green">
                {tarifa.toLocaleString()}
              </span>
            </div>
            <span className="text-xs text-slate-500">por persona</span>
          </div>

          {/* Sugerencia */}
          {suggested && (
            <div className="flex items-center space-x-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
              <Target className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-700">
                Sugerido: {suggested} para {invitados} invitados
              </span>
            </div>
          )}

          {/* Controles */}
          <div className="flex items-center justify-between pt-2">
            {qty > 0 ? (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onQtyChange(person.id, Math.max(0, qty - 1))}
                  className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex items-center space-x-2 px-3 py-1 bg-selecta-green/10 rounded-lg">
                  <span className="font-semibold text-selecta-green">{qty}</span>
                  <span className="text-xs text-selecta-green">personas</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => onQtyChange(person.id, qty + 1)}
                  className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-200"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => onAdd(person)}
                className="flex-1 bg-slate-800 hover:bg-selecta-green transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                Añadir
              </Button>
            )}

            {/* Botón sugerencia rápida */}
            {suggested && !selected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onAdd(person);
                  // Añadir cantidad sugerida
                  for (let i = 1; i < suggested; i++) {
                    setTimeout(() => onAdd(person), i * 100);
                  }
                }}
                className="ml-2 border-amber-300 text-amber-600 hover:bg-amber-50"
              >
                <Lightbulb className="h-3 w-3 mr-1" />
                +{suggested}
              </Button>
            )}
          </div>

          {/* Costo total si está seleccionado */}
          {qty > 0 && (
            <div className="flex items-center justify-between p-2 bg-selecta-green/10 rounded-lg">
              <span className="text-sm font-medium text-selecta-green">Total:</span>
              <span className="font-bold text-selecta-green">
                ${(tarifa * qty).toLocaleString()}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPersonRow = (person: PersonalCosto) => {
    const config = ROLES_CONFIG[person.rol] || ROLES_CONFIG["Otro"];
    const qty = getQty(person.id);
    const suggested = suggestions[person.rol];
    const Icon = config.icon;
    const tarifa = Number(person.tarifa);
    const selected = isSelected(person.id);

    return (
      <Card 
        key={person.id}
        className={cn(
          "transition-all duration-200 hover:shadow-md border-l-4",
          selected 
            ? "border-l-selecta-green bg-selecta-green/5" 
            : "border-l-transparent hover:border-l-slate-300"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className={cn(
                "p-2 rounded-lg",
                `bg-${config.color}-100`
              )}>
                <Icon className={cn("h-5 w-5", `text-${config.color}-600`)} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-semibold text-slate-800">{person.rol}</h4>
                  {selected && (
                    <Badge className="bg-selecta-green text-white text-xs">
                      {qty} seleccionado{qty > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {suggested && !selected && (
                    <Badge className="bg-amber-100 text-amber-700 text-xs">
                      Sugerido: {suggested}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600 truncate">{config.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="flex items-center space-x-1">
                  <DollarSign className="h-4 w-4 text-selecta-green" />
                  <span className="font-bold text-lg text-selecta-green">
                    {tarifa.toLocaleString()}
                  </span>
                </div>
                {qty > 0 && (
                  <div className="text-sm text-slate-500">
                    Total: ${(tarifa * qty).toLocaleString()}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                {qty > 0 ? (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onQtyChange(person.id, Math.max(0, qty - 1))}
                      className="h-8 w-8 p-0"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-semibold">{qty}</span>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => onQtyChange(person.id, qty + 1)}
                      className="h-8 w-8 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => onAdd(person)}
                    className="bg-slate-800 hover:bg-selecta-green"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500 rounded-2xl shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-blue-900">Personal para el Evento</h3>
                <p className="text-blue-700">
                  {stats.totalSelected} personas seleccionadas • ${stats.totalCost.toLocaleString()} total
                </p>
              </div>
            </div>

            {invitados > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSuggestions(!showSuggestions)}
                className={cn(
                  "transition-all",
                  showSuggestions && "bg-amber-100 border-amber-300 text-amber-700"
                )}
              >
                <Lightbulb className="h-4 w-4 mr-1" />
                {showSuggestions ? "Ocultar" : "Mostrar"} sugerencias
              </Button>
            )}
          </div>

          {/* Estadísticas por categoría */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stats.byCategory.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.key} className="text-center p-3 bg-white/60 rounded-xl">
                  <div className="flex items-center justify-center mb-2">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-sm font-semibold text-blue-900">
                    {category.selected}/{category.total}
                  </div>
                  <div className="text-xs text-blue-600">{category.label}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sugerencias inteligentes */}
      {showSuggestions && invitados > 0 && Object.keys(suggestions).length > 0 && (
        <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-amber-500 rounded-xl">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-amber-900">Sugerencias para {invitados} invitados</h4>
                <p className="text-amber-700 text-sm">Recomendaciones basadas en mejores prácticas</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(suggestions).map(([rol, cantidad]) => {
                const person = data.find(p => p.rol === rol);
                const config = ROLES_CONFIG[rol];
                const current = getQty(person?.id || "");
                const Icon = config?.icon || Users;
                
                if (!person) return null;

                return (
                  <div key={rol} className="flex items-center justify-between p-3 bg-white rounded-xl border border-amber-200">
                    <div className="flex items-center space-x-3">
                      <Icon className="h-4 w-4 text-amber-600" />
                      <div>
                        <div className="font-medium text-amber-900">{rol}</div>
                        <div className="text-xs text-amber-600">Sugerido: {cantidad}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {current > 0 && (
                        <Badge className={cn(
                          "text-xs",
                          current >= cantidad 
                            ? "bg-green-100 text-green-700" 
                            : "bg-orange-100 text-orange-700"
                        )}>
                          {current}/{cantidad}
                        </Badge>
                      )}
                      
                      {current < cantidad && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const needed = cantidad - current;
                            for (let i = 0; i < needed; i++) {
                              setTimeout(() => onAdd(person), i * 100);
                            }
                          }}
                          className="h-6 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                        >
                          +{cantidad - current}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar personal..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="grid grid-cols-6 bg-slate-100">
                {CATEGORIES.map(({ key, label, icon: Icon }) => (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    <Icon className="h-3 w-3 mr-1" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Lista de personal */}
      {filtered.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
              <Eye className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No se encontró personal</h3>
              <p className="text-slate-500">Intenta ajustar los filtros de búsqueda</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className={cn(
          viewMode === "grid" 
            ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            : "space-y-3"
        )}>
          {filtered.map(person => 
            viewMode === "grid" ? renderPersonCard(person) : renderPersonRow(person)
          )}
        </div>
      )}
    </div>
  );
}