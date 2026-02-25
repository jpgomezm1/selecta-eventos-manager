import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  inventarioMovimientosList,
  inventarioMovimientoConfirmar,
  inventarioMovimientoDelete,
  inventarioMovimientoDeleteConReversa,
} from "@/integrations/supabase/apiInventario";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, ChevronDown, ChevronLeft, ChevronRight, Check, Trash2, Camera, Receipt } from "lucide-react";
import NuevoMovimientoDialog from "./NuevoMovimientoDialog";
import FacturaIngresoDialog from "./FacturaIngresoDialog";
import { getFacturaSignedUrl } from "@/services/facturaStorage";
import type { InventarioMovimiento } from "@/types/cotizador";

const PAGE_SIZE = 15;

const tipoBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  compra: { label: "Compra", variant: "default" },
  uso: { label: "Uso", variant: "secondary" },
  ajuste: { label: "Ajuste", variant: "outline" },
  devolucion: { label: "Devolución", variant: "destructive" },
};

const estadoBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  borrador: { label: "Borrador", variant: "outline" },
  confirmado: { label: "Confirmado", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

export default function MovimientosPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: movimientos = [], isLoading } = useQuery({
    queryKey: ["inventario-movimientos"],
    queryFn: inventarioMovimientosList,
  });

  const confirmarMut = useMutation({
    mutationFn: (mov: (typeof movimientos)[0]) =>
      inventarioMovimientoConfirmar(mov.id, mov.tipo, mov.items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventario-movimientos"] });
      qc.invalidateQueries({ queryKey: ["ingredientes-stock"] });
      toast({ title: "Movimiento confirmado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (mov: (typeof movimientos)[0]) => {
      if (mov.estado === "confirmado") {
        return inventarioMovimientoDeleteConReversa(mov.id, mov.tipo, mov.items);
      }
      return inventarioMovimientoDelete(mov.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventario-movimientos"] });
      qc.invalidateQueries({ queryKey: ["ingredientes-stock"] });
      toast({ title: "Movimiento eliminado" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  async function openFactura(path: string) {
    try {
      const url = await getFacturaSignedUrl(path);
      window.open(url, "_blank");
    } catch {
      toast({ title: "Error", description: "No se pudo abrir la factura", variant: "destructive" });
    }
  }

  const totalPages = Math.max(1, Math.ceil(movimientos.length / PAGE_SIZE));
  const paginated = movimientos.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setFacturaDialogOpen(true)}
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
        >
          <Camera className="h-4 w-4 mr-2" /> Registrar Ingreso
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nuevo movimiento
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Proveedor / Evento</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right"># Items</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  No hay movimientos registrados
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((mov) => {
                const tb = tipoBadge[mov.tipo] ?? tipoBadge.compra;
                const eb = estadoBadge[mov.estado] ?? estadoBadge.borrador;
                const isExpanded = expanded === mov.id;

                return (
                  <Collapsible key={mov.id} open={isExpanded} onOpenChange={(o) => setExpanded(o ? mov.id : null)} asChild>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow className="cursor-pointer hover:bg-slate-50">
                          <TableCell>
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </TableCell>
                          <TableCell>{mov.fecha}</TableCell>
                          <TableCell><Badge variant={tb.variant}>{tb.label}</Badge></TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5">
                              {mov.proveedor || (mov.evento_id ? "Evento vinculado" : "—")}
                              {(mov as any).factura_url && (
                                <button
                                  className="text-emerald-600 hover:text-emerald-800"
                                  title="Ver factura"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openFactura((mov as any).factura_url);
                                  }}
                                >
                                  <Receipt className="h-4 w-4" />
                                </button>
                              )}
                            </span>
                          </TableCell>
                          <TableCell><Badge variant={eb.variant}>{eb.label}</Badge></TableCell>
                          <TableCell className="text-right">{mov.items.length}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              {mov.estado === "borrador" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600"
                                  onClick={() => confirmarMut.mutate(mov)}
                                  disabled={confirmarMut.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              {mov.estado === "confirmado" ? (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-500"
                                      disabled={deleteMut.isPending}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Eliminar movimiento confirmado</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Se revertirá el stock de {mov.items.length} ingrediente(s) y se eliminará este movimiento. Esta acción no se puede deshacer.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteMut.mutate(mov)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Eliminar y revertir stock
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              ) : mov.estado === "borrador" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500"
                                  onClick={() => deleteMut.mutate(mov)}
                                  disabled={deleteMut.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={7} className="bg-slate-50 p-4">
                            {mov.notas && <p className="text-sm text-slate-500 mb-3">{mov.notas}</p>}
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Ingrediente</TableHead>
                                  <TableHead className="text-right">Cantidad</TableHead>
                                  <TableHead className="text-right">Costo unit.</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {mov.items.map((item) => (
                                  <TableRow key={item.id}>
                                    <TableCell>{item.ingrediente?.nombre ?? item.ingrediente_id}</TableCell>
                                    <TableCell className="text-right">{item.cantidad}</TableCell>
                                    <TableCell className="text-right">
                                      $ {Number(item.costo_unitario).toLocaleString("es-CO")}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, movimientos.length)} de {movimientos.length}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <NuevoMovimientoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <FacturaIngresoDialog open={facturaDialogOpen} onOpenChange={setFacturaDialogOpen} />
    </div>
  );
}
