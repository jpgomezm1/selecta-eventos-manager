import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  History,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  Pencil,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listCotizacionAudit, type AuditEntry } from "@/integrations/supabase/apiAudit";
import { TableSkeleton } from "@/components/ui/skeletons";
import { cn } from "@/lib/utils";

const FIELD_LABEL: Record<string, string> = {
  total: "Total calculado",
  total_override: "Total manual",
  nombre_opcion: "Nombre de opción",
  estado: "Estado",
  is_definitiva: "Marca de definitiva",
  total_cotizado: "Total cabecera",
  numero_invitados: "Número de invitados",
  created: "Versión creada",
};

function formatMoney(n: number | null | undefined): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(Number(n));
}

function describeChange(entry: AuditEntry): { icon: typeof DollarSign; text: string } {
  if (entry.field === "created") {
    const v = entry.new_value as { nombre_opcion?: string; total?: number; total_override?: number | null } | null;
    const monto = v?.total_override != null ? v.total_override : v?.total ?? 0;
    return {
      icon: Sparkles,
      text: `Creó ${v?.nombre_opcion ?? "una opción"} por $${formatMoney(monto)}`,
    };
  }
  if (entry.field === "total_override") {
    const o = entry.old_value as number | null;
    const n = entry.new_value as number | null;
    if (n == null) return { icon: DollarSign, text: `Quitó el total manual (era $${formatMoney(o)})` };
    if (o == null) return { icon: DollarSign, text: `Asignó total manual $${formatMoney(n)}` };
    return { icon: DollarSign, text: `Cambió total manual de $${formatMoney(o)} a $${formatMoney(n)}` };
  }
  if (entry.field === "total" || entry.field === "total_cotizado") {
    const o = entry.old_value as number | null;
    const n = entry.new_value as number | null;
    return {
      icon: DollarSign,
      text: `${FIELD_LABEL[entry.field]} ${formatMoney(o)} → ${formatMoney(n)}`,
    };
  }
  if (entry.field === "estado") {
    return {
      icon: ArrowRight,
      text: `Estado ${String(entry.old_value ?? "—")} → ${String(entry.new_value ?? "—")}`,
    };
  }
  if (entry.field === "is_definitiva") {
    return entry.new_value
      ? { icon: CheckCircle2, text: "Marcó esta versión como definitiva" }
      : { icon: CheckCircle2, text: "Desmarcó la versión como definitiva" };
  }
  if (entry.field === "nombre_opcion") {
    return {
      icon: Pencil,
      text: `Renombró "${String(entry.old_value ?? "—")}" → "${String(entry.new_value ?? "—")}"`,
    };
  }
  if (entry.field === "numero_invitados") {
    return {
      icon: Pencil,
      text: `Invitados ${String(entry.old_value ?? "—")} → ${String(entry.new_value ?? "—")}`,
    };
  }
  // Fallback genérico
  return {
    icon: Pencil,
    text: `${FIELD_LABEL[entry.field] ?? entry.field}: ${String(entry.old_value ?? "—")} → ${String(entry.new_value ?? "—")}`,
  };
}

export function AuditTimeline({ cotizacionId }: { cotizacionId: string }) {
  const query = useQuery({
    queryKey: ["cotizacion-audit", cotizacionId],
    queryFn: () => listCotizacionAudit(cotizacionId),
  });

  const entries = useMemo(() => query.data ?? [], [query.data]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <div>
              <h3 className="font-serif text-[18px] tracking-tight text-foreground">Historial de cambios</h3>
              <p className="text-[12px] text-muted-foreground">
                Quién modificó qué y cuándo. Solo cambios sensibles (totales, estado, definitiva).
              </p>
            </div>
          </div>
          {entries.length > 0 && (
            <Badge variant="outline" className="font-normal tabular-nums">
              {entries.length}
            </Badge>
          )}
        </div>

        {query.isLoading ? (
          <TableSkeleton rows={3} />
        ) : query.isError ? (
          <p className="text-[13px] text-destructive">
            No se pudo cargar el historial: {(query.error as Error).message}
          </p>
        ) : entries.length === 0 ? (
          <p className="text-[13px] italic text-muted-foreground">
            Sin cambios registrados todavía.
          </p>
        ) : (
          <ol className="relative space-y-4 border-l border-border/70 pl-5">
            {entries.map((e) => {
              const { icon: Icon, text } = describeChange(e);
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card">
                    <Icon className="h-2.5 w-2.5 text-primary" strokeWidth={2} />
                  </span>
                  <div className="text-[13px] leading-relaxed text-foreground">{text}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <span className={cn("font-medium", !e.changed_by_email && "italic")}>
                      {e.changed_by_email ?? "Sistema"}
                    </span>
                    <span aria-hidden>·</span>
                    <time dateTime={e.changed_at} title={new Date(e.changed_at).toLocaleString("es-CO")}>
                      {formatDistanceToNow(new Date(e.changed_at), { locale: es, addSuffix: true })}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
