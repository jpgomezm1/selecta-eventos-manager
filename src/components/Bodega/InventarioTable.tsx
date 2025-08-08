import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { menajeCatalogoList, menajeCatalogoCreate, menajeCatalogoUpdate, menajeCatalogoDelete } from "@/integrations/supabase/apiMenaje";
import { MenajeCatalogo } from "@/types/menaje";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function InventarioTable() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["menaje-catalogo"], queryFn: menajeCatalogoList });

  const [newItem, setNewItem] = useState<Partial<MenajeCatalogo>>({
    nombre: "",
    categoria: "",
    unidad: "unidad",
    stock_total: 0,
    activo: true,
  });

  const createMut = useMutation({
    mutationFn: () => menajeCatalogoCreate(newItem as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menaje-catalogo"] });
      setNewItem({ nombre: "", categoria: "", unidad: "unidad", stock_total: 0, activo: true });
      toast({ title: "Creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateField = (id: string, patch: Partial<MenajeCatalogo>) =>
    menajeCatalogoUpdate(id, patch).then(() => qc.invalidateQueries({ queryKey: ["menaje-catalogo"] }));

  const delMut = useMutation({
    mutationFn: (id: string) => menajeCatalogoDelete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menaje-catalogo"] }),
  });

  return (
    <div className="space-y-4">
      {/* Crear */}
      <div className="flex flex-wrap gap-2 items-end">
        <Input placeholder="Nombre" className="w-48" value={newItem.nombre ?? ""} onChange={(e) => setNewItem((p) => ({ ...p, nombre: e.target.value }))} />
        <Input placeholder="Categoría" className="w-40" value={newItem.categoria ?? ""} onChange={(e) => setNewItem((p) => ({ ...p, categoria: e.target.value }))} />
        <Input placeholder="Unidad" className="w-28" value={newItem.unidad ?? "unidad"} onChange={(e) => setNewItem((p) => ({ ...p, unidad: e.target.value }))} />
        <Input type="number" placeholder="Stock total" className="w-32" value={newItem.stock_total ?? 0} onChange={(e) => setNewItem((p) => ({ ...p, stock_total: Number(e.target.value) }))} />
        <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !newItem.nombre || !newItem.categoria}>Añadir</Button>
      </div>

      {/* Tabla */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Stock total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6">Cargando…</TableCell></TableRow>
            ) : (data ?? []).map((it) => (
              <TableRow key={it.id}>
                <TableCell>
                  <Input value={it.nombre} onChange={(e) => updateField(it.id, { nombre: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input value={it.categoria} onChange={(e) => updateField(it.id, { categoria: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input value={it.unidad} onChange={(e) => updateField(it.id, { unidad: e.target.value })} />
                </TableCell>
                <TableCell className="text-right">
                  <Input className="w-24 text-right" type="number" value={it.stock_total} onChange={(e) => updateField(it.id, { stock_total: Number(e.target.value) })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" onClick={() => delMut.mutate(it.id)}>Eliminar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
