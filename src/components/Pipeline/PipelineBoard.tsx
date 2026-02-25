import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Send, Trophy, XCircle } from "lucide-react";
import { PipelineCard } from "./PipelineCard";
import type { Cotizacion } from "@/types/cotizador";

const COLUMNS = [
  { key: "Pendiente por Aprobación", label: "Pendiente", color: "border-t-yellow-500", icon: Clock, badgeCls: "bg-yellow-100 text-yellow-800" },
  { key: "Enviada", label: "Enviada", color: "border-t-blue-500", icon: Send, badgeCls: "bg-blue-100 text-blue-800" },
  { key: "Cotización Aprobada", label: "Ganada", color: "border-t-green-500", icon: Trophy, badgeCls: "bg-green-100 text-green-800" },
  { key: "Rechazada", label: "Perdida", color: "border-t-red-500", icon: XCircle, badgeCls: "bg-red-100 text-red-800" },
] as const;

type Props = {
  cotizaciones: Cotizacion[];
  onMarcarEnviada: (id: string) => void;
  onRechazar: (id: string, nombre: string) => void;
  onReabrir: (id: string) => void;
  onNavigateToEditor: (id: string) => void;
};

export function PipelineBoard({ cotizaciones, onMarcarEnviada, onRechazar, onReabrir, onNavigateToEditor }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, Cotizacion[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const c of cotizaciones) {
      const list = map.get(c.estado);
      if (list) list.push(c);
    }
    // Sort each column by updated_at desc
    for (const [, list] of map) {
      list.sort((a, b) => new Date(b.updated_at || b.created_at || "").getTime() - new Date(a.updated_at || a.created_at || "").getTime());
    }
    return map;
  }, [cotizaciones]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const items = grouped.get(col.key) || [];
        return (
          <Card key={col.key} className={`border-t-4 ${col.color}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <col.icon className="h-4 w-4 text-slate-500" />
                  <CardTitle className="text-sm font-semibold">{col.label}</CardTitle>
                </div>
                <Badge className={`${col.badgeCls} text-xs font-bold`}>{items.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">Sin cotizaciones</p>
                ) : (
                  items.map((c) => (
                    <PipelineCard
                      key={c.id}
                      cotizacion={c}
                      onMarcarEnviada={c.estado === "Pendiente por Aprobación" ? () => onMarcarEnviada(c.id) : undefined}
                      onRechazar={c.estado === "Pendiente por Aprobación" || c.estado === "Enviada" ? () => onRechazar(c.id, c.nombre_cotizacion) : undefined}
                      onReabrir={c.estado === "Rechazada" ? () => onReabrir(c.id) : undefined}
                      onAbrir={() => onNavigateToEditor(c.id)}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
