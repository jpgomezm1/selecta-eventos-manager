import { cn } from "@/lib/utils";

/** Loader editorial centrado para una página entera. */
export function PageSkeleton({ label }: { label?: string } = {}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <div className="h-10 w-10 animate-pulse rounded-full bg-muted/70" />
      <div className="h-3 w-40 animate-pulse rounded bg-muted/70" />
      {label && <p className="mt-1 text-[12px] text-muted-foreground">{label}</p>}
    </div>
  );
}

/** Skeleton de filas para tablas — unifica el patrón legacy spinner-verde. */
export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md border border-border/60 bg-card px-4 py-3"
        >
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted/70" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted/70" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Pequeño skeleton inline (chip/badge) cuando hay un valor cargando. */
export function InlineSkeleton({ className }: { className?: string }) {
  return <span className={cn("inline-block h-3 w-16 animate-pulse rounded bg-muted/70 align-middle", className)} />;
}
