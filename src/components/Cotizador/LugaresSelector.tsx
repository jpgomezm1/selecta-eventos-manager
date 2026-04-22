import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { MapPin, Plus, Trash2, CheckCircle2, Circle, ChevronsUpDown, Check, PenLine, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { lugaresCatalogoList } from "@/integrations/supabase/apiCatalogos";
import type { LugarOption, LugarCatalogo } from "@/types/cotizador";

interface Props {
  lugares: LugarOption[];
  onChange: (lugares: LugarOption[]) => void;
  readOnly?: boolean;
}

export function LugaresSelector({ lugares, onChange, readOnly = false }: Props) {
  const [openPopoverIdx, setOpenPopoverIdx] = useState<number | null>(null);

  const { data: catalogo = [] } = useQuery({
    queryKey: ["lugares-catalogo"],
    queryFn: lugaresCatalogoList,
  });

  const activeCatalogo = catalogo.filter((l) => l.activo);

  const handleFieldChange = (index: number, field: keyof LugarOption, value) => {
    const updated = lugares.map((l, i) =>
      i === index ? { ...l, [field]: value } : l
    );
    onChange(updated);
  };

  const handleSelect = (index: number) => {
    if (readOnly) return;
    const updated = lugares.map((l, i) => ({
      ...l,
      es_seleccionado: i === index,
    }));
    onChange(updated);
  };

  const handleSelectFromCatalog = (index: number, lugar: LugarCatalogo) => {
    const updated = lugares.map((l, i) =>
      i === index
        ? {
            ...l,
            nombre: lugar.nombre,
            direccion: lugar.direccion,
            ciudad: lugar.ciudad,
            capacidad_estimada: lugar.capacidad_estimada,
            precio_referencia: lugar.precio_referencia || 0,
            notas: lugar.notas,
          }
        : l
    );
    onChange(updated);
    setOpenPopoverIdx(null);
  };

  const handleAdd = () => {
    onChange([
      ...lugares,
      { nombre: "", es_seleccionado: false },
    ]);
  };

  const handleAddCustom = () => {
    onChange([
      ...lugares,
      { nombre: "", es_seleccionado: false },
    ]);
  };

  const handleRemove = (index: number) => {
    const updated = lugares.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((l) => l.es_seleccionado)) {
      updated[0].es_seleccionado = true;
    }
    onChange(updated);
  };

  if (readOnly) {
    return (
      <div className="space-y-2">
        {lugares.map((lugar, idx) => (
          <div
            key={idx}
            className={cn(
              "flex items-center gap-3 p-3 rounded-md border",
              lugar.es_seleccionado
                ? "bg-primary/5 border-primary/30"
                : "bg-muted/40 border-border"
            )}
          >
            {lugar.es_seleccionado ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" strokeWidth={1.75} />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-foreground flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                {lugar.nombre}
                {lugar.es_seleccionado && (
                  <Badge variant="outline" className="text-xs font-normal text-primary border-primary/40">Seleccionado</Badge>
                )}
              </div>
              {(lugar.direccion || lugar.ciudad) && (
                <div className="text-xs text-muted-foreground mt-0.5 ml-5">
                  {[lugar.direccion, lugar.ciudad].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
            {(lugar.precio_referencia ?? 0) > 0 && (
              <span className="text-sm font-semibold text-primary shrink-0 tabular-nums">
                ${lugar.precio_referencia!.toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lugares.map((lugar, idx) => (
        <Card
          key={idx}
          className={cn(
            "transition-all",
            lugar.es_seleccionado
              ? "border-primary/40 bg-primary/[0.03]"
              : "border-border"
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Radio-like selector */}
              <button
                type="button"
                onClick={() => handleSelect(idx)}
                className="mt-2 shrink-0"
                title="Seleccionar esta ubicación"
              >
                {lugar.es_seleccionado ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" strokeWidth={1.75} />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/50 hover:text-muted-foreground" strokeWidth={1.75} />
                )}
              </button>

              <div className="flex-1 space-y-3">
                {/* Nombre: combobox que busca en catálogo o permite texto libre */}
                <div className="flex items-center gap-2">
                  <Popover
                    open={openPopoverIdx === idx}
                    onOpenChange={(open) => setOpenPopoverIdx(open ? idx : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openPopoverIdx === idx}
                        className="h-10 flex-1 justify-between font-normal"
                      >
                        {lugar.nombre ? (
                          <span className="truncate">{lugar.nombre}</span>
                        ) : (
                          <span className="text-muted-foreground">Buscar en catálogo o escribir...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar lugar..." />
                        <CommandList>
                          <CommandEmpty>
                            <div className="text-center py-2">
                              <p className="text-sm text-muted-foreground mb-2">No se encontraron lugares en el catálogo</p>
                              <p className="text-xs text-muted-foreground/70">Escribe el nombre manualmente abajo</p>
                            </div>
                          </CommandEmpty>
                          {activeCatalogo.length > 0 && (
                            <CommandGroup heading="Catálogo de lugares">
                              {activeCatalogo.map((cat) => (
                                <CommandItem
                                  key={cat.id}
                                  value={`${cat.nombre} ${cat.ciudad || ""} ${cat.direccion || ""}`}
                                  onSelect={() => handleSelectFromCatalog(idx, cat)}
                                  className="cursor-pointer"
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 text-primary",
                                      lugar.nombre === cat.nombre ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
                                      <span className="font-medium text-sm text-foreground">{cat.nombre}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground ml-5.5">
                                      {[cat.direccion, cat.ciudad].filter(Boolean).join(", ")}
                                      {cat.capacidad_estimada && (
                                        <span className="ml-2 text-muted-foreground/70 tabular-nums">
                                          ({cat.capacidad_estimada} personas)
                                        </span>
                                      )}
                                      {cat.precio_referencia > 0 && (
                                        <span className="ml-2 text-primary font-medium tabular-nums">
                                          ${cat.precio_referencia.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {lugar.es_seleccionado && (
                    <Badge variant="outline" className="shrink-0 font-normal text-primary border-primary/40">
                      Principal
                    </Badge>
                  )}
                </div>

                {/* Input manual para nombre (siempre visible para editar o escribir custom) */}
                <Input
                  placeholder="Nombre del lugar (edita o escribe uno personalizado)"
                  value={lugar.nombre}
                  onChange={(e) => handleFieldChange(idx, "nombre", e.target.value)}
                  className="h-9 text-sm"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    placeholder="Dirección"
                    value={lugar.direccion || ""}
                    onChange={(e) => handleFieldChange(idx, "direccion", e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="Ciudad"
                    value={lugar.ciudad || ""}
                    onChange={(e) => handleFieldChange(idx, "ciudad", e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    type="number"
                    placeholder="Capacidad estimada"
                    value={lugar.capacidad_estimada || ""}
                    onChange={(e) => handleFieldChange(idx, "capacidad_estimada", e.target.value ? Number(e.target.value) : null)}
                    className="h-9 text-sm"
                  />
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                    <Input
                      type="number"
                      placeholder="Precio lugar"
                      value={lugar.precio_referencia || ""}
                      onChange={(e) => handleFieldChange(idx, "precio_referencia", e.target.value ? Number(e.target.value) : 0)}
                      className="h-9 text-sm pl-8 tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Remove button */}
              {lugares.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemove(idx)}
                  className="mt-1 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Botones para agregar */}
      <div className="flex gap-2">
        {activeCatalogo.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="flex-1 border-dashed"
          >
            <MapPin className="h-4 w-4 mr-2" strokeWidth={1.75} />
            Agregar desde catálogo
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddCustom}
          className="flex-1 border-dashed"
        >
          <PenLine className="h-4 w-4 mr-2" strokeWidth={1.75} />
          Agregar lugar personalizado
        </Button>
      </div>
    </div>
  );
}
