import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PersonalCosto } from "@/types/cotizador";

type Props = {
  data: PersonalCosto[];
  onAdd: (p: PersonalCosto) => void;
  itemsSeleccionados: { personal_costo_id: string; cantidad: number }[];
  onQtyChange: (id: string, qty: number) => void;
  invitados: number;
};

const ROLES: PersonalCosto["rol"][] = [
  "Coordinador", "Mesero", "Chef", "Bartender", "Decorador", "Técnico de Sonido", "Fotógrafo", "Otro",
];

export function PersonalSelector({ data, onAdd, itemsSeleccionados, onQtyChange, invitados }: Props) {
  const [q, setQ] = useState("");
  const [rol, setRol] = useState<"Todos" | PersonalCosto["rol"]>("Todos");

  const filtered = useMemo(() => {
    return data
      .filter((p) => (rol === "Todos" ? true : p.rol === rol))
      .filter((p) => p.rol.toLowerCase().includes(q.toLowerCase()));
  }, [data, q, rol]);

  const getQty = (id: string) => itemsSeleccionados.find((x) => x.personal_costo_id === id)?.cantidad ?? 0;

  // Sugerencia (simple) de cantidad de meseros según invitados (1 por cada 20)
  const sugerenciaMeseros = Math.max(1, Math.ceil(invitados / 20));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Input placeholder="Buscar por rol..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-2 overflow-x-auto">
          <Badge
            variant={rol === "Todos" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setRol("Todos")}
          >
            Todos
          </Badge>
          {ROLES.map((r) => (
            <Badge
              key={r}
              variant={rol === r ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setRol(r)}
            >
              {r}
            </Badge>
          ))}
        </div>
      </div>

      {invitados > 0 && (
        <div className="text-xs text-slate-500">
          Tip: con {invitados} invitados, sugiere ~{sugerenciaMeseros} meser{ sugerenciaMeseros>1 ? "os" : "o"}.
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-sm text-slate-500">No hay resultados.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((p) => {
          const qty = getQty(p.id);
          return (
            <Card key={p.id} className="hover:shadow transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.rol}</div>
                  <div className="text-sm text-slate-500">Tarifa estimada: ${Number(p.tarifa).toLocaleString()}</div>
                </div>
                {qty > 0 ? (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => onQtyChange(p.id, Math.max(1, qty - 1))}>-</Button>
                    <div className="w-8 text-center">{qty}</div>
                    <Button variant="outline" size="icon" onClick={() => onQtyChange(p.id, qty + 1)}>+</Button>
                  </div>
                ) : (
                  <Button onClick={() => onAdd(p)}>Añadir</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
