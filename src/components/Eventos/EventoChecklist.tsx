import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { ChecklistResult } from "@/lib/eventoChecklist";

type Props = {
  checklist: ChecklistResult;
  onItemClick?: (tab: string) => void;
};

export default function EventoChecklist({ checklist, onItemClick }: Props) {
  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] text-foreground/75">
          {checklist.completedCount} de {checklist.totalCount} tareas completadas
        </span>
        <span className="font-mono text-[13px] font-semibold tabular-nums text-primary">
          {checklist.percent}%
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted/70">
        <div
          className="h-full rounded-full bg-primary/80 transition-all duration-500"
          style={{ width: `${checklist.percent}%` }}
        />
      </div>

      {/* Items */}
      <div className="mt-4 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {checklist.items.map((item) => (
          <button
            key={item.key}
            onClick={() => !item.completed && item.tab && onItemClick?.(item.tab)}
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
              item.completed
                ? "text-muted-foreground"
                : "cursor-pointer text-foreground/80 hover:bg-muted/50"
            }`}
          >
            {item.completed ? (
              <CheckCircle2 className="h-[15px] w-[15px] flex-shrink-0 text-primary/70" strokeWidth={1.75} />
            ) : (
              <Circle className="h-[15px] w-[15px] flex-shrink-0 text-muted-foreground/40" strokeWidth={1.75} />
            )}
            <span className={item.completed ? "line-through decoration-muted-foreground/40" : ""}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
