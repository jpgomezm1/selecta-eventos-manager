import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { XCircle, AlertTriangle } from "lucide-react";
import { MOTIVOS_RECHAZO } from "@/types/cotizador";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotizacionName: string;
  onConfirm: (motivo: string, notas: string) => void;
  isPending: boolean;
};

export function RechazoDialog({
  open,
  onOpenChange,
  cotizacionName,
  onConfirm,
  isPending,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [notas, setNotas] = useState("");

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setMotivo("");
      setNotas("");
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <XCircle className="h-5 w-5 text-destructive" strokeWidth={1.75} />
            <DialogTitle className="text-lg">Rechazar cotización</DialogTitle>
          </div>
          <DialogDescription>
            Registra el motivo de rechazo para <span className="font-semibold">{cotizacionName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Motivo de rechazo</label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un motivo..." />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_RECHAZO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Notas adicionales (opcional)</label>
            <Textarea
              placeholder="Detalles sobre el rechazo..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-md border border-border">
            <AlertTriangle className="h-4 w-4 text-[hsl(30_55%_42%)] mt-0.5 flex-shrink-0" strokeWidth={1.75} />
            <p className="text-sm text-muted-foreground">
              La cotización se puede reabrir después si es necesario.
            </p>
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
            variant="destructive"
            onClick={() => onConfirm(motivo, notas)}
            disabled={!motivo || isPending}
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 rounded-full bg-destructive-foreground/30 animate-pulse mr-2" />
                Rechazando...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-1.5" />
                Confirmar Rechazo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
