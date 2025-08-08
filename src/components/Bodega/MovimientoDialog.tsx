import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { MenajeMovimiento } from "@/types/menaje";
import { menajeCatalogoList } from "@/integrations/supabase/apiMenaje";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  movimiento: MenajeMovimiento & { items: Array<{ menaje_id: string; cantidad: number; merma?: number }> };
  onSave: (mov: MenajeMovimiento, items: Array<{ menaje_id: string; cantidad: number; merma?: number }>) => void;
};

export default function MovimientoDialog({ open, onOpenChange, movimiento, onSave }: Props) {
  const [mov, setMov] = useState(movimiento);
  const [items, setItems] = useState(movimiento.items ?? []);
  const { data: catalogo } = useQuery({ queryKey: ["menaje-catalogo"], queryFn: menajeCatalogoList });

  useEffect(() => {
    setMov(movimiento);
    setItems(movimiento.items ?? []);
  }, [movimiento]);

  const catalogForSelect = useMemo(() => {
    const taken = new Set(items.map((i) => i.menaje_id));
    return (catalogo ?? []).filter((c) => !taken.has(c.id));
  }, [catalogo, items]);

  const addItem = (id: string) => {
    setItems((prev) => [...prev, { menaje_id: id, cantidad: 1, merma: 0 }]);
  };

  const updateItem = (id: string, patch: Partial<{ cantidad: number; merma: number }>) =>
    setItems((prev) => prev.map((i) => (i.menaje_id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.menaje_id !== id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mov.id ? "Editar movimiento" : "Nuevo movimiento"} — {mov.tipo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Fecha</label>
              <Input type="date" value={mov.fecha} onChange={(e) => setMov({ ...mov, fecha: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Estado</label>
              <Select value={mov.estado} onValueChange={(v) => setMov({ ...mov, estado: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="borrador">borrador</SelectItem>
                  <SelectItem value="confirmado">confirmado</SelectItem>
                  <SelectItem value="cancelado">cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500">Notas</label>
            <Input value={mov.notas ?? ""} onChange={(e) => setMov({ ...mov, notas: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <Select onValueChange={(v) => addItem(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Añadir ítem de menaje" />
              </SelectTrigger>
              <SelectContent>
                {(catalogForSelect ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre} · stock {c.stock_total} {c.unidad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled>+ Añadir</Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">Cantidad</TableHead>
                  <TableHead className="text-center">Merma</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-slate-500">Sin ítems</TableCell>
                  </TableRow>
                ) : (
                  items.map((i) => {
                    const c = catalogo?.find((x) => x.id === i.menaje_id);
                    return (
                      <TableRow key={i.menaje_id}>
                        <TableCell className="font-medium">{c?.nombre ?? i.menaje_id}</TableCell>
                        <TableCell className="text-center">
                          <Input className="w-24 text-center" type="number" min={0} value={i.cantidad} onChange={(e) => updateItem(i.menaje_id, { cantidad: Number(e.target.value) })} />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input className="w-24 text-center" type="number" min={0} value={i.merma ?? 0} onChange={(e) => updateItem(i.menaje_id, { merma: Number(e.target.value) })} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => removeItem(i.menaje_id)}>Quitar</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => onSave(mov, items)}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
