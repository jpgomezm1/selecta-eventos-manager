import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StepDef = {
  index: number;
  label: string;
  icon: LucideIcon;
  isComplete: boolean;
  isSkippable: boolean;
  itemCount?: number;
};

type Props = {
  steps: StepDef[];
  currentStep: number;
  onStepClick: (step: number) => void;
};

export function CotizadorStepper({ steps, currentStep, onStepClick }: Props) {
  const currentStepDef = steps.find((s) => s.index === currentStep);

  return (
    <nav className="w-full space-y-2">
      {/* Desktop stepper */}
      <ol className="flex items-start justify-between">
        {steps.map((step, idx) => {
          const isActive = step.index === currentStep;
          const isCompleted = step.isComplete;
          const Icon = step.icon;
          const isLast = idx === steps.length - 1;

          return (
            <li key={step.index} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => onStepClick(step.index)}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
              >
                {/* Circle */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border",
                    isCompleted
                      ? "bg-primary border-primary text-primary-foreground"
                      : isActive
                        ? "border-primary bg-card text-primary scale-105"
                        : "border-border bg-muted/40 text-muted-foreground group-hover:border-border/80"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 animate-in zoom-in-50 duration-200" strokeWidth={1.75} />
                  ) : (
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  )}
                </div>

                {/* Label - hidden on mobile */}
                <div className="hidden sm:flex flex-col items-center gap-0.5">
                  <span
                    className={cn(
                      "text-xs font-medium text-center max-w-[100px] leading-tight",
                      isCompleted
                        ? "text-primary"
                        : isActive
                          ? "text-foreground"
                          : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>

                  {/* Optional badge / item count */}
                  {step.isSkippable && !isCompleted && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Opcional</span>
                  )}
                  {isCompleted && step.itemCount != null && step.itemCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal bg-primary/5 text-primary border-primary/30">
                      {step.itemCount} items
                    </Badge>
                  )}
                </div>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 flex items-center px-2 mt-5">
                  <div
                    className={cn(
                      "h-px w-full transition-colors duration-300",
                      isCompleted ? "bg-primary" : "bg-border"
                    )}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile step indicator */}
      {currentStepDef && (
        <div className="sm:hidden text-center">
          <p className="text-sm font-medium text-muted-foreground">
            Paso {currentStepDef.index} de {steps.length}
            <span className="text-muted-foreground/50 mx-1.5">·</span>
            <span className="text-foreground font-semibold">{currentStepDef.label}</span>
          </p>
        </div>
      )}
    </nav>
  );
}
