import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Utensils,
  ChefHat,
  Truck,
  Package,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CotizacionItemsState } from "@/types/cotizador";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionName: string;
  versionTotal: number;
  items?: CotizacionItemsState;
  onConfirm: () => void;
  isPending: boolean;
};

export function ApprovalDialog({
  open,
  onOpenChange,
  versionName,
  versionTotal,
  items,
  onConfirm,
  isPending,
}: Props) {
  const [confirmed, setConfirmed] = useState(false);

  const handleOpenChange = (val: boolean) => {
    if (!val) setConfirmed(false);
    onOpenChange(val);
  };

  const platosCount = items?.platos.length ?? 0;
  const personalCount = items?.personal.length ?? 0;
  const transportesCount = items?.transportes.length ?? 0;
  const menajeCount = (items?.menaje ?? []).length;

  const sections = [
    { icon: Utensils, label: "Platos", count: platosCount, color: "text-orange-600", bg: "bg-orange-50" },
    { icon: ChefHat, label: "Personal", count: personalCount, color: "text-blue-600", bg: "bg-blue-50" },
    { icon: Truck, label: "Transporte", count: transportesCount, color: "text-green-600", bg: "bg-green-50" },
    { icon: Package, label: "Menaje", count: menajeCount, color: "text-purple-600", bg: "bg-purple-50" },
  ].filter((s) => s.count > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-green-100 rounded-xl">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <DialogTitle className="text-lg">Aprobar cotización</DialogTitle>
          </div>
          <DialogDescription>
            Confirma la aprobación de esta opción de cotización.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Version summary */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{versionName}</span>
              <div className="flex items-center gap-1 text-emerald-600 font-bold">
                <DollarSign className="h-4 w-4" />
                {versionTotal.toLocaleString()}
              </div>
            </div>

            {sections.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sections.map((s) => (
                  <Badge
                    key={s.label}
                    variant="outline"
                    className={cn("text-xs font-medium", s.bg, s.color, "border-transparent")}
                  >
                    <s.icon className="h-3 w-3 mr-1" />
                    {s.count} {s.label.toLowerCase()}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Se creará un evento automáticamente a partir de esta opción.
              Las demás opciones quedarán como referencia.
            </p>
          </div>

          {/* Confirmation checkbox */}
          <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-slate-200">
            <Checkbox
              id="confirm-approval"
              checked={confirmed}
              onCheckedChange={(val) => setConfirmed(val === true)}
            />
            <label
              htmlFor="confirm-approval"
              className="text-sm font-medium text-slate-700 cursor-pointer select-none"
            >
              Confirmo que deseo aprobar esta opción
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!confirmed || isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Aprobando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Confirmar Aprobación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
