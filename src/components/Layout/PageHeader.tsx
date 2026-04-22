import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type KPITone = "neutral" | "primary" | "warning" | "destructive";

interface KPIProps {
  kicker: string;
  value: ReactNode;
  suffix?: string;
  tone?: KPITone;
  hint?: ReactNode;
}

/** Métrica editorial — Fraunces grande + kicker uppercase. Sin icon-box coloreado. */
export function KPI({ kicker, value, suffix, tone = "neutral", hint }: KPIProps) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
      ? "text-[hsl(30_55%_42%)]"
      : tone === "destructive"
      ? "text-destructive"
      : "text-foreground";

  return (
    <div>
      <div className="kicker mb-1.5">{kicker}</div>
      <div className={cn("font-serif text-[26px] leading-none tracking-[-0.02em] tabular-nums md:text-[30px]", toneClass)}>
        {value}
        {suffix && <span className="ml-1 text-[15px] md:text-[17px] text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

interface PageHeaderProps {
  kicker?: string;
  title: ReactNode;
  /** Texto opcional que aparece en italic Fraunces inline con el título */
  accent?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Meta slot — derecho, útil para métrica/fecha. Se ubica sobre actions si hay. */
  meta?: ReactNode;
  className?: string;
  /** Tamaño del título (h1). Default: lg (44-56px) */
  size?: "lg" | "md";
}

export function PageHeader({
  kicker,
  title,
  accent,
  description,
  actions,
  meta,
  className,
  size = "lg",
}: PageHeaderProps) {
  const titleClass =
    size === "lg"
      ? "text-[38px] leading-[1.04] tracking-[-0.028em] md:text-[48px]"
      : "text-[28px] leading-[1.1] tracking-[-0.02em] md:text-[34px]";

  return (
    <header
      className={cn(
        "animate-rise stagger-1 flex flex-col gap-5 border-b border-border/70 pb-7 md:flex-row md:items-end md:justify-between md:gap-8",
        className
      )}
    >
      <div className="min-w-0 space-y-3">
        {kicker && <span className="kicker">{kicker}</span>}
        <h1 className={cn("font-serif text-foreground", titleClass)}>
          {title}
          {accent && (
            <>
              {" "}
              <span className="italic text-primary">{accent}</span>
            </>
          )}
        </h1>
        {description && (
          <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      {(meta || actions) && (
        <div className="flex flex-col items-start gap-4 md:items-end">
          {meta && <div className="text-right">{meta}</div>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
    </header>
  );
}

/** Sub-header dentro de una card/panel — más pequeño, sin divider */
export function PanelHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: Omit<PageHeaderProps, "size" | "accent" | "meta">) {
  return (
    <div className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {kicker && <span className="kicker">{kicker}</span>}
        <h2 className="font-serif text-[22px] leading-tight tracking-tight text-foreground md:text-[26px]">
          {title}
        </h2>
        {description && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
