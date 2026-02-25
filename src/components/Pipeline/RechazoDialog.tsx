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
            <div className="p-2 bg-red-100 rounded-xl">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <DialogTitle className="text-lg">Rechazar cotización</DialogTitle>
          </div>
          <DialogDescription>
            Registra el motivo de rechazo para <span className="font-semibold">{cotizacionName}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Motivo de rechazo</label>
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
            <label className="text-sm font-medium text-slate-700">Notas adicionales (opcional)</label>
            <Textarea
              placeholder="Detalles sobre el rechazo..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
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
            onClick={() => onConfirm(motivo, notas)}
            disabled={!motivo || isPending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
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
