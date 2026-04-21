import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Impact = {
  trabajosTotal: number;
  trabajosPendientes: number;
  pagosRegistrados: number;
};

type Props = {
  person: { id: string; nombre_completo: string };
  onDeleted: () => void;
};

export function EliminarPersonalDialog({ person, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const loadImpact = async () => {
    setLoading(true);
    setImpact(null);
    try {
      const [pendQ, totalQ, pagosQ] = await Promise.all([
        supabase
          .from("evento_personal")
          .select("id", { count: "exact", head: true })
          .eq("personal_id", person.id)
          .eq("estado_pago", "pendiente"),
        supabase
          .from("evento_personal")
          .select("id", { count: "exact", head: true })
          .eq("personal_id", person.id),
        supabase
          .from("registro_pagos")
          .select("id", { count: "exact", head: true })
          .eq("empleado_id", person.id),
      ]);
      setImpact({
        trabajosTotal: totalQ.count ?? 0,
        trabajosPendientes: pendQ.count ?? 0,
        pagosRegistrados: pagosQ.count ?? 0,
      });
    } catch (err) {
      console.error("Error cargando impacto del borrado:", err);
      setImpact({ trabajosTotal: 0, trabajosPendientes: 0, pagosRegistrados: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) loadImpact();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("personal").delete().eq("id", person.id);
      if (error) throw error;
      toast({
        title: "Personal eliminado",
        description: `${person.nombre_completo} fue eliminado del sistema.`,
      });
      setOpen(false);
      onDeleted();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "No se pudo eliminar el empleado.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const tienePendientes = (impact?.trabajosPendientes ?? 0) > 0;
  const tieneHistoria = (impact?.trabajosTotal ?? 0) > 0 || (impact?.pagosRegistrados ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Trash2 className="h-4 w-4 text-slate-500" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Se eliminará permanentemente a{" "}
                <span className="font-medium text-slate-900">{person.nombre_completo}</span>{" "}
                del sistema. Esta acción no se puede deshacer.
              </p>

              {loading && (
                <p className="text-sm text-slate-500">Revisando historia del empleado…</p>
              )}

              {!loading && impact && tienePendientes && (
                <div className="border-l-4 border-red-500 bg-red-50 p-3 rounded text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold text-red-900">
                        {impact.trabajosPendientes} trabajo(s) pendiente(s) de pago
                      </p>
                      <p className="text-red-800">
                        Al eliminar, se perderá la información de esos trabajos pendientes.
                        Se recomienda liquidarlos antes.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!loading && impact && tieneHistoria && (
                <div className="bg-slate-50 border border-slate-200 rounded p-3 text-sm space-y-1 text-slate-700">
                  <p className="font-medium text-slate-900">Historia que se borra:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>
                      {impact.trabajosTotal} trabajo(s) en eventos
                      {impact.trabajosPendientes > 0
                        ? ` (${impact.trabajosPendientes} pendientes)`
                        : ""}
                    </li>
                    <li>{impact.pagosRegistrados} pago(s) registrado(s)</li>
                  </ul>
                </div>
              )}

              {!loading && impact && !tieneHistoria && (
                <p className="text-sm text-emerald-700">
                  Este empleado no tiene trabajos ni pagos registrados.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={loading || deleting}
            className={
              tienePendientes
                ? "bg-red-600 hover:bg-red-700"
                : "bg-red-600 hover:bg-red-700"
            }
          >
            {deleting ? "Eliminando…" : tienePendientes ? "Eliminar igualmente" : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
