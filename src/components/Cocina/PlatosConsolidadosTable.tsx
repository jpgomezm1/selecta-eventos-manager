import { useMemo } from "react";
import type { EventoProduccion } from "@/integrations/supabase/apiCocina";
import PlatoExpandibleRow from "./PlatoExpandibleRow";

interface Props {
  eventos: EventoProduccion[];
  onOpenPlato: (platoId: string, cantidad: number, nombre: string) => void;
}

interface PlatoConsolidado {
  plato_id: string;
  nombre: string;
  cantidad_total: number;
  tiempo_preparacion: string | null;
  eventos_count: number;
}

export default function PlatosConsolidadosTable({ eventos, onOpenPlato }: Props) {
  const consolidados = useMemo<PlatoConsolidado[]>(() => {
    const acc = new Map<string, PlatoConsolidado>();
    for (const evento of eventos) {
      for (const p of evento.platos) {
        const existing = acc.get(p.plato_id);
        if (existing) {
          existing.cantidad_total += p.cantidad;
          existing.eventos_count += 1;
        } else {
          acc.set(p.plato_id, {
            plato_id: p.plato_id,
            nombre: p.nombre,
            cantidad_total: p.cantidad,
            tiempo_preparacion: p.tiempo_preparacion,
            eventos_count: 1,
          });
        }
      }
    }
    return Array.from(acc.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [eventos]);

  if (consolidados.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-[13px] italic text-muted-foreground">
          No hay platos en el rango seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card p-3 shadow-soft">
      {consolidados.map((p) => (
        <PlatoExpandibleRow
          key={p.plato_id}
          nombre={p.nombre}
          cantidad={p.cantidad_total}
          tiempoPreparacion={p.tiempo_preparacion}
          meta={p.eventos_count > 1 ? `${p.eventos_count} eventos` : undefined}
          onOpen={() => onOpenPlato(p.plato_id, p.cantidad_total, p.nombre)}
        />
      ))}
    </div>
  );
}
