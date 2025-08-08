import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TransporteTarifa } from "@/types/cotizador";

type Props = {
  data: TransporteTarifa[];
  onAdd: (t: TransporteTarifa) => void;
  itemsSeleccionados: { transporte_id: string; cantidad: number }[];
  onQtyChange: (id: string, qty: number) => void;
};

const TIPOS = ["Eventos Grandes", "Eventos Pequeños", "Selecta To Go", "Eventos Noche"] as const;

export function TransporteSelector({ data, onAdd, itemsSeleccionados, onQtyChange }: Props) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"Todos" | (typeof TIPOS)[number]>("Todos");

  const filtered = useMemo(() => {
    return data
      .filter((t) => (tipo === "Todos" ? true : t.tipo_evento === tipo))
      .filter((t) => `${t.lugar} ${t.tipo_evento}`.toLowerCase().includes(q.toLowerCase()));
  }, [data, q, tipo]);

  const getQty = (id: string) => itemsSeleccionados.find((x) => x.transporte_id === id)?.cantidad ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Input placeholder="Buscar por lugar o tipo..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-2 overflow-x-auto">
          <Badge
            variant={tipo === "Todos" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setTipo("Todos")}
          >
            Todos
          </Badge>
          {TIPOS.map((t) => (
            <Badge
              key={t}
              variant={tipo === t ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setTipo(t)}
            >
              {t}
            </Badge>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-sm text-slate-500">No hay resultados.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((t) => {
          const qty = getQty(t.id);
          return (
            <Card key={t.id} className="hover:shadow transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.lugar}</div>
                  <div className="text-sm text-slate-500">{t.tipo_evento}</div>
                  <div className="text-sm text-slate-500">${Number(t.tarifa).toLocaleString()}</div>
                </div>
                {qty > 0 ? (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => onQtyChange(t.id, Math.max(1, qty - 1))}>-</Button>
                    <div className="w-8 text-center">{qty}</div>
                    <Button variant="outline" size="icon" onClick={() => onQtyChange(t.id, qty + 1)}>+</Button>
                  </div>
                ) : (
                  <Button onClick={() => onAdd(t)}>Añadir</Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
