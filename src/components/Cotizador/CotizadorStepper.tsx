import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepDef = {
  index: number;
  label: string;
  icon: LucideIcon;
  isComplete: boolean;
  isSkippable: boolean;
};

type Props = {
  steps: StepDef[];
  currentStep: number;
  onStepClick: (step: number) => void;
};

export function CotizadorStepper({ steps, currentStep, onStepClick }: Props) {
  return (
    <nav className="w-full">
      <ol className="flex items-center justify-between">
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
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                {/* Circle */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 border-2",
                    isCompleted
                      ? "bg-selecta-green border-selecta-green text-white"
                      : isActive
                        ? "border-selecta-green bg-white text-selecta-green"
                        : "border-slate-200 bg-slate-100 text-slate-400 group-hover:border-slate-300"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>

                {/* Label - hidden on mobile */}
                <span
                  className={cn(
                    "text-xs font-medium text-center hidden sm:block max-w-[100px] leading-tight",
                    isCompleted
                      ? "text-selecta-green"
                      : isActive
                        ? "text-slate-900 font-bold"
                        : "text-slate-400"
                  )}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2 mt-[-1.25rem] sm:mt-[-2.5rem] transition-colors duration-200",
                    isCompleted ? "bg-selecta-green" : "bg-slate-200"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
