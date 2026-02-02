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
        <span className="text-sm font-medium text-slate-700">
          {checklist.completedCount} de {checklist.totalCount} tareas completadas
        </span>
        <span className="text-sm font-semibold text-emerald-700">{checklist.percent}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div
          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${checklist.percent}%` }}
        />
      </div>

      {/* Items */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-3">
        {checklist.items.map((item) => (
          <button
            key={item.key}
            onClick={() => !item.completed && item.tab && onItemClick?.(item.tab)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
              item.completed
                ? "text-emerald-700 bg-emerald-50/50"
                : "text-slate-600 hover:bg-slate-50 cursor-pointer"
            }`}
          >
            {item.completed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />
            )}
            <span className={item.completed ? "line-through opacity-70" : ""}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
