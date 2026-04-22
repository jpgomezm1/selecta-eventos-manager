import { useCallback, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import type { PersonalCosto, PersonalAsignacion } from "@/types/cotizador";
import { PersonalAsignacionPopover } from "@/components/Cotizador/PersonalAsignacionPopover";
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
  itemsSeleccionados: { personal_costo_id: string; cantidad: number; asignados?: PersonalAsignacion[] }[];
  onQtyChange: (id: string, qty: number) => void;
  invitados: number;
  viewMode?: "grid" | "list";
  onToggleAsignacion?: (costoId: string, persona: PersonalAsignacion) => void;
};

const ROLES_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  suggestedRatio?: number; // personas por invitado
  category: "servicio" | "cocina" | "entretenimiento" | "tecnico" | "otro";
}> = {
  "Coordinador": {
    icon: Target,
    description: "Coordina y supervisa el evento",
    suggestedRatio: 100,
    category: "servicio"
  },
  "Mesero": {
    icon: Coffee,
    description: "Atiende mesas y sirve alimentos",
    suggestedRatio: 15,
    category: "servicio"
  },
  "Chef": {
    icon: ChefHat,
    description: "Prepara y supervisa la cocina",
    suggestedRatio: 50,
    category: "cocina"
  },
  "Bartender": {
    icon: Coffee,
    description: "Prepara bebidas y cocteles",
    suggestedRatio: 30,
    category: "servicio"
  },
  "Decorador": {
    icon: Palette,
    description: "Diseña y monta decoración",
    category: "otro"
  },
  "Técnico de Sonido": {
    icon: Music,
    description: "Maneja audio y sonido",
    category: "tecnico"
  },
  "Fotógrafo": {
    icon: Camera,
    description: "Captura momentos del evento",
    category: "entretenimiento"
  },
  "Otro": {
    icon: Users,
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
  viewMode = "grid",
  onToggleAsignacion,
}: Props) {
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [showSuggestions, setShowSuggestions] = useState(true);

  const getQty = useCallback(
    (id: string) => itemsSeleccionados.find((x) => x.personal_costo_id === id)?.cantidad ?? 0,
    [itemsSeleccionados]
  );
  const getAsignados = useCallback(
    (id: string) => itemsSeleccionados.find((x) => x.personal_costo_id === id)?.asignados ?? [],
    [itemsSeleccionados]
  );
  const isSelected = useCallback((id: string) => getQty(id) > 0, [getQty]);

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
  }, [data, q, selectedCategory, isSelected]);

  // Estadísticas
  const stats = useMemo(() => {
    const totalSelected = itemsSeleccionados.reduce((sum, item) => sum + item.cantidad, 0);
    const totalCost = itemsSeleccionados.reduce((sum, item) => {
      const person = data.find(p => p.id === item.personal_costo_id);
      return sum + (person ? (Number(person.tarifa) || 0) * item.cantidad : 0);
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
    const tarifa = Number(person.tarifa) || 0;
    const selected = isSelected(person.id);

    return (
      <Card
        key={person.id}
        className={cn(
          "group relative overflow-hidden transition-all duration-300 border",
          selected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-border/80"
        )}
      >
        {/* Badge de sugerido */}
        {suggested && !selected && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="outline" className="text-xs font-normal text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]">
              <Lightbulb className="h-3 w-3 mr-1" strokeWidth={1.75} />
              Sugerido: {suggested}
            </Badge>
          </div>
        )}

        {/* Badge de seleccionado */}
        {selected && (
          <div className="absolute top-3 right-3 z-10 bg-primary text-primary-foreground rounded-full p-1.5">
            <CheckCircle2 className="h-3 w-3" strokeWidth={1.75} />
          </div>
        )}

        <CardHeader className="pb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-md bg-muted/60">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {person.rol}
              </h4>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {config.description}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {/* Precio */}
          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
            <div className="flex items-baseline gap-1">
              <span className="text-xs text-muted-foreground">$</span>
              <span className="font-semibold text-lg text-primary tabular-nums">
                {tarifa.toLocaleString()}
              </span>
            </div>
            <span className="kicker text-muted-foreground">Por persona</span>
          </div>

          {/* Sugerencia */}
          {suggested && (
            <div className="flex items-center space-x-2 p-2 bg-muted/40 rounded-md border border-border">
              <Target className="h-4 w-4 text-[hsl(30_55%_42%)]" strokeWidth={1.75} />
              <span className="text-sm text-muted-foreground">
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
                    onQtyChange(person.id, isNaN(val) ? 0 : Math.max(0, val));
                  }}
                  className="w-16 h-8 text-center text-sm font-medium tabular-nums"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQtyChange(person.id, qty + 1)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button onClick={() => onAdd(person)} className="flex-1">
                <Plus className="h-4 w-4 mr-1" strokeWidth={1.75} />
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
                  for (let i = 1; i < suggested; i++) {
                    setTimeout(() => onAdd(person), i * 100);
                  }
                }}
                className="ml-2 text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)] hover:bg-[hsl(30_55%_42%)]/10"
              >
                <Lightbulb className="h-3 w-3 mr-1" strokeWidth={1.75} />
                +{suggested}
              </Button>
            )}
          </div>

          {/* Costo total si está seleccionado */}
          {qty > 0 && (
            <div className="flex items-center justify-between p-2 bg-primary/5 rounded-md border border-primary/20">
              <span className="kicker text-primary">Total</span>
              <span className="font-semibold text-primary tabular-nums">
                ${(tarifa * qty).toLocaleString()}
              </span>
            </div>
          )}

          {/* Asignación de personal */}
          {qty > 0 && onToggleAsignacion && (
            <div className="space-y-2">
              <PersonalAsignacionPopover
                rol={person.rol}
                asignados={getAsignados(person.id)}
                onToggle={(persona) => onToggleAsignacion(person.id, persona)}
                max={qty}
              />
              {getAsignados(person.id).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {getAsignados(person.id).map((a) => (
                    <Badge key={a.personal_id} variant="secondary" className="text-xs">
                      {a.nombre_completo}
                    </Badge>
                  ))}
                </div>
              )}
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
    const tarifa = Number(person.tarifa) || 0;
    const selected = isSelected(person.id);

    return (
      <Card
        key={person.id}
        className={cn(
          "transition-all duration-200 hover:shadow-[var(--shadow-soft)] border-l-2",
          selected
            ? "border-l-primary bg-primary/5"
            : "border-l-transparent hover:border-l-border"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="p-2 rounded-md bg-muted/60">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-semibold text-foreground">{person.rol}</h4>
                  {selected && (
                    <Badge variant="default" className="text-xs font-normal tabular-nums">
                      {qty} seleccionado{qty > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {suggested && !selected && (
                    <Badge variant="outline" className="text-xs font-normal text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]">
                      Sugerido: {suggested}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{config.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="flex items-baseline gap-1 justify-end">
                  <span className="text-xs text-muted-foreground">$</span>
                  <span className="font-semibold text-lg text-primary tabular-nums">
                    {tarifa.toLocaleString()}
                  </span>
                </div>
                {qty > 0 && (
                  <div className="text-sm text-muted-foreground tabular-nums">
                    Total ${(tarifa * qty).toLocaleString()}
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
                    <Input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        onQtyChange(person.id, isNaN(val) ? 1 : Math.max(1, val));
                      }}
                      className="w-16 h-8 text-center text-sm font-medium tabular-nums"
                    />
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
                  <Button onClick={() => onAdd(person)}>
                    <Plus className="h-4 w-4 mr-1" strokeWidth={1.75} />
                    Añadir
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Asignación de personal en vista lista */}
          {qty > 0 && onToggleAsignacion && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
              <PersonalAsignacionPopover
                rol={person.rol}
                asignados={getAsignados(person.id)}
                onToggle={(persona) => onToggleAsignacion(person.id, persona)}
                max={qty}
              />
              {getAsignados(person.id).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {getAsignados(person.id).map((a) => (
                    <Badge key={a.personal_id} variant="outline" className="text-xs font-normal">
                      {a.nombre_completo}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-primary" strokeWidth={1.75} />
              <div>
                <h3 className="font-serif text-lg text-foreground">Personal para el evento</h3>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {stats.totalSelected} personas · ${stats.totalCost.toLocaleString()} total
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
                  showSuggestions && "text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]"
                )}
              >
                <Lightbulb className="h-4 w-4 mr-1" strokeWidth={1.75} />
                {showSuggestions ? "Ocultar" : "Mostrar"} sugerencias
              </Button>
            )}
          </div>

          {/* Estadísticas por categoría */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {stats.byCategory.map((category) => {
              const Icon = category.icon;
              return (
                <div key={category.key} className="text-center p-3 bg-muted/40 rounded-md border border-border">
                  <div className="flex items-center justify-center mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                  </div>
                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    {category.selected}/{category.total}
                  </div>
                  <div className="kicker text-muted-foreground">{category.label}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sugerencias inteligentes */}
      {showSuggestions && invitados > 0 && Object.keys(suggestions).length > 0 && (
        <Card className="bg-muted/30 border-border">
          <CardContent className="p-5">
            <div className="flex items-center space-x-3 mb-4">
              <Calculator className="h-5 w-5 text-[hsl(30_55%_42%)]" strokeWidth={1.75} />
              <div>
                <h4 className="font-serif text-base text-foreground">Sugerencias para {invitados} invitados</h4>
                <p className="text-muted-foreground text-sm">Recomendaciones basadas en mejores prácticas</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(suggestions).map(([rol, cantidad]) => {
                const person = data.find(p => p.rol === rol);
                const config = ROLES_CONFIG[rol];
                const current = getQty(person?.id || "");
                const Icon = config?.icon || Users;

                if (!person) return null;

                return (
                  <div key={rol} className="flex items-center justify-between p-3 bg-card rounded-md border border-border">
                    <div className="flex items-center space-x-3">
                      <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      <div>
                        <div className="font-medium text-foreground">{rol}</div>
                        <div className="kicker text-muted-foreground">Sugerido {cantidad}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {current > 0 && (
                        <Badge variant="outline" className={cn(
                          "text-xs font-normal tabular-nums",
                          current >= cantidad
                            ? "text-primary border-primary/40"
                            : "text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]"
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
                          className="h-6 px-2 text-xs"
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              <Input
                placeholder="Buscar personal..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="grid grid-cols-6">
                {CATEGORIES.map(({ key, label, icon: Icon }) => (
                  <TabsTrigger key={key} value={key} className="text-xs">
                    <Icon className="h-3 w-3 mr-1" strokeWidth={1.75} />
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
            <Eye className="h-8 w-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">No se encontró personal</h3>
              <p className="text-sm text-muted-foreground">Intenta ajustar los filtros de búsqueda</p>
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