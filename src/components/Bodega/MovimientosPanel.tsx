import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { movimientosList, movimientoCreate, movimientoUpdate, movimientoUpsertItems, movimientoConfirmar, movimientoDelete } from "@/integrations/supabase/apiMenaje";
import { MenajeMovimiento, MenajeMovimientoItem } from "@/types/menaje";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MovimientoDialog from "./MovimientoDialog";
import { useToast } from "@/hooks/use-toast";

export default function MovimientosPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["movimientos"], queryFn: movimientosList });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(MenajeMovimiento & { items: MenajeMovimientoItem[] }) | null>(null);

  const handleNew = (tipo: "salida" | "ingreso") => {
    setEditing({
      id: "",
      tipo,
      fecha: new Date().toISOString().slice(0, 10),
      estado: "borrador",
      evento_id: null,
      reserva_id: null,
      notas: "",
      items: [],
    } as any);
    setOpen(true);
  };

  const handleSave = async (mov: MenajeMovimiento, items: Array<{ menaje_id: string; cantidad: number; merma?: number }>) => {
    try {
      let id = mov.id;
      if (!id) {
        const created = await movimientoCreate(
          {
            tipo: mov.tipo,
            fecha: mov.fecha,
            estado: mov.estado,
            evento_id: mov.evento_id ?? null,
            reserva_id: mov.reserva_id ?? null,
            notas: mov.notas ?? null,
          },
          items
        );
        id = created.id;
      } else {
        await movimientoUpdate(id, {
          tipo: mov.tipo,
          fecha: mov.fecha,
          estado: mov.estado,
          evento_id: mov.evento_id ?? null,
          reserva_id: mov.reserva_id ?? null,
          notas: mov.notas ?? null,
        });
        await movimientoUpsertItems(id, items);
      }

      toast({ title: "Movimiento guardado" });
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const confirmMut = useMutation({
    mutationFn: (id: string) => movimientoConfirmar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => movimientoDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["movimientos"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={() => handleNew("salida")}>Nueva salida</Button>
        <Button variant="outline" onClick={() => handleNew("ingreso")}>Nuevo ingreso</Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center">Cargando…</TableCell></TableRow>
            ) : (data ?? []).map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.fecha}</TableCell>
                <TableCell className="capitalize">{m.tipo}</TableCell>
                <TableCell className="capitalize">{m.estado}</TableCell>
                <TableCell>{m.items.map((i) => `${i.menaje?.nombre ?? ""} x${i.cantidad}`).join(", ") || "—"}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(m as any); setOpen(true); }}>Editar</Button>
                  {m.estado !== "confirmado" && (
                    <Button size="sm" onClick={() => confirmMut.mutate(m.id)}>Confirmar</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(m.id)}>Eliminar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editing && (
        <MovimientoDialog
          open={open}
          onOpenChange={setOpen}
          movimiento={editing as any}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
