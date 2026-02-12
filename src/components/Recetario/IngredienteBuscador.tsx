import { useState, useRef } from "react";
import type { IngredienteCatalogo } from "@/types/cotizador";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Plus } from "lucide-react";

const MAX_VISIBLE = 8;

interface Props {
  availableIngredientes: IngredienteCatalogo[];
  onAdd: (ingredienteId: string, cantidad: number) => void;
}

const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

export default function IngredienteBuscador({ availableIngredientes, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const searchRef = useRef<HTMLInputElement>(null);
  const cantidadRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? availableIngredientes.filter((i) =>
        i.nombre.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const selectedIng = selectedId
    ? availableIngredientes.find((i) => i.id === selectedId)
    : null;

  const subtotal = selectedIng
    ? Number(cantidad || 0) * selectedIng.costo_por_unidad
    : 0;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setCantidad("1");
    // Focus quantity input after React renders it
    setTimeout(() => cantidadRef.current?.focus(), 0);
  };

  const handleAdd = () => {
    if (!selectedId || !cantidad || Number(cantidad) <= 0) return;
    onAdd(selectedId, Number(cantidad));
    setSelectedId(null);
    setCantidad("1");
    setQuery("");
    searchRef.current?.focus();
  };

  const handleClear = () => {
    setQuery("");
    setSelectedId(null);
    searchRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-slate-500">Agregar ingrediente</label>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
          placeholder="Buscar ingrediente..."
          className="pl-8 pr-8 h-9"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results list */}
      {query.trim() && (
        <div className="border rounded-md bg-white">
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-slate-400 text-center">
              {availableIngredientes.length === 0
                ? "Todos los ingredientes ya fueron agregados"
                : "No se encontraron ingredientes"}
            </div>
          ) : (
            <>
              <div className="max-h-[320px] overflow-y-auto divide-y">
                {filtered.slice(0, MAX_VISIBLE).map((ing) => {
                  const isSelected = selectedId === ing.id;
                  return (
                    <div key={ing.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(ing.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                      >
                        <span className="font-medium text-slate-800 truncate">{ing.nombre}</span>
                        <span className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
                          <span>{ing.unidad}</span>
                          <span className="font-medium text-slate-700">{fmt(ing.costo_por_unidad)}/{ing.unidad}</span>
                        </span>
                      </button>

                      {/* Inline quantity input when selected */}
                      {isSelected && (
                        <div className="px-3 pb-2 flex items-center gap-2 bg-blue-50">
                          <Input
                            ref={cantidadRef}
                            type="number"
                            min={0}
                            step="any"
                            value={cantidad}
                            onChange={(e) => setCantidad(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAdd();
                              }
                            }}
                            className="h-7 w-24 text-sm"
                            placeholder="Cantidad"
                          />
                          <span className="text-xs text-slate-500">{ing.unidad}</span>
                          {Number(cantidad || 0) > 0 && (
                            <span className="text-xs font-medium text-slate-700 ml-auto">
                              = {fmt(subtotal)}
                            </span>
                          )}
                          <Button
                            size="icon"
                            variant="default"
                            className="h-7 w-7 shrink-0"
                            onClick={handleAdd}
                            disabled={!cantidad || Number(cantidad) <= 0}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {filtered.length > MAX_VISIBLE && (
                <div className="px-3 py-1.5 text-xs text-slate-400 border-t text-center">
                  Mostrando {MAX_VISIBLE} de {filtered.length}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
