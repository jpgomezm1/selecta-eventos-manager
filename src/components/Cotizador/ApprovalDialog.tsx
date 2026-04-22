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
} from "lucide-react";
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
    { icon: Utensils, label: "platos", count: platosCount },
    { icon: ChefHat, label: "personal", count: personalCount },
    { icon: Truck, label: "transporte", count: transportesCount },
    { icon: Package, label: "menaje", count: menajeCount },
  ].filter((s) => s.count > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <DialogTitle className="font-serif text-lg">Aprobar cotización</DialogTitle>
          </div>
          <DialogDescription>
            Confirma la aprobación de esta opción de cotización.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Version summary */}
          <div className="p-4 bg-muted/40 rounded-md border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-serif text-lg text-foreground">{versionName}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <span className="font-semibold text-primary tabular-nums">
                  {versionTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {sections.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sections.map((s) => (
                  <Badge
                    key={s.label}
                    variant="outline"
                    className="text-xs font-normal tabular-nums"
                  >
                    <s.icon className="h-3 w-3 mr-1" strokeWidth={1.75} />
                    {s.count} {s.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-md border border-border">
            <AlertTriangle className="h-4 w-4 text-[hsl(30_55%_42%)] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
            <p className="text-sm text-muted-foreground">
              Se creará un evento automáticamente a partir de esta opción.
              Las demás opciones quedarán como referencia.
            </p>
          </div>

          {/* Confirmation checkbox */}
          <div className="flex items-center space-x-3 p-3 bg-card rounded-md border border-border">
            <Checkbox
              id="confirm-approval"
              checked={confirmed}
              onCheckedChange={(val) => setConfirmed(val === true)}
            />
            <label
              htmlFor="confirm-approval"
              className="text-sm font-medium text-foreground cursor-pointer select-none"
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
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 rounded-full bg-primary-foreground/30 animate-pulse mr-2" />
                Aprobando...
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-1.5" strokeWidth={1.75} />
                Confirmar aprobación
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
