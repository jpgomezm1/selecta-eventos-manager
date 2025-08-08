import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PlatoCatalogo } from "@/types/cotizador";

type Props = {
  data: PlatoCatalogo[];
  onAdd: (p: PlatoCatalogo) => void;
  itemsSeleccionados: { plato_id: string; cantidad: number }[];
  onQtyChange: (id: string, qty: number) => void;
};

export function PlatosSelector({ data, onAdd, itemsSeleccionados, onQtyChange }: Props) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<"Todos" | "Menu General" | "Armalo a tu Gusto">("Todos");

  const filtered = useMemo(() => {
    return data
      .filter((p) => (tipo === "Todos" ? true : p.tipo_menu === tipo))
      .filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase()));
  }, [data, q, tipo]);

  const getQty = (id: string) => itemsSeleccionados.find((x) => x.plato_id === id)?.cantidad ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Input placeholder="Buscar plato..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-2">
          {(["Todos", "Menu General", "Armalo a tu Gusto"] as const).map((t) => (
            <Badge
              key={t}
              variant={t === tipo ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setTipo(t)}
            >
              {t}
            </Badge>
          ))}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="text-sm text-slate-500">No hay platos que coincidan.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((p) => {
          const qty = getQty(p.id);
          return (
            <Card key={p.id} className="hover:shadow transition-shadow">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.nombre}</div>
                  <div className="text-sm text-slate-500">${Number(p.precio).toLocaleString()}</div>
                  <div className="mt-1">
                    <Badge variant="outline">{p.tipo_menu}</Badge>
                    {p.categoria ? <Badge className="ml-2" variant="secondary">{p.categoria}</Badge> : null}
                  </div>
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
