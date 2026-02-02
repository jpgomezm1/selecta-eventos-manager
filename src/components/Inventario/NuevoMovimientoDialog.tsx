import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ingredientesConStock, inventarioMovimientoCreate, inventarioMovimientoConfirmar } from "@/integrations/supabase/apiInventario";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import type { Evento, InventarioMovimiento } from "@/types/cotizador";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Tipo = InventarioMovimiento["tipo"];

interface ItemLocal {
  ingrediente_id: string;
  nombre: string;
  cantidad: number;
  costo_unitario: number;
}

export default function NuevoMovimientoDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tipo, setTipo] = useState<Tipo>("compra");
  const [proveedor, setProveedor] = useState("");
  const [eventoId, setEventoId] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<ItemLocal[]>([]);
  const [selIngrediente, setSelIngrediente] = useState("");

  const { data: ingredientes = [] } = useQuery({
    queryKey: ["ingredientes-stock"],
    queryFn: ingredientesConStock,
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ["eventos-list-inventario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos")
        .select("id, nombre_evento, fecha_evento")
        .order("fecha_evento", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Evento[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (confirmar: boolean) => {
      const mov = await inventarioMovimientoCreate(
        {
          tipo,
          fecha: new Date().toISOString().slice(0, 10),
          estado: confirmar ? "borrador" : "borrador",
          evento_id: tipo === "uso" ? eventoId || null : null,
          proveedor: tipo === "compra" ? proveedor || null : null,
          notas: notas || null,
        },
        items.map((i) => ({
          ingrediente_id: i.ingrediente_id,
          cantidad: i.cantidad,
          costo_unitario: tipo === "compra" ? i.costo_unitario : 0,
        }))
      );

      if (confirmar) {
        await inventarioMovimientoConfirmar(mov.id, tipo, items.map((i) => ({
          id: "",
          movimiento_id: mov.id,
          ingrediente_id: i.ingrediente_id,
          cantidad: i.cantidad,
          costo_unitario: i.costo_unitario,
        })));
      }

      return mov;
    },
    onSuccess: (_, confirmar) => {
      qc.invalidateQueries({ queryKey: ["inventario-movimientos"] });
      qc.invalidateQueries({ queryKey: ["ingredientes-stock"] });
      toast({
        title: confirmar ? "Movimiento confirmado" : "Borrador guardado",
        description: "El movimiento se ha registrado correctamente",
      });
      resetAndClose();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetAndClose() {
    setTipo("compra");
    setProveedor("");
    setEventoId("");
    setNotas("");
    setItems([]);
    setSelIngrediente("");
    onOpenChange(false);
  }

  function addItem() {
    if (!selIngrediente) return;
    if (items.some((i) => i.ingrediente_id === selIngrediente)) return;
    const ing = ingredientes.find((i) => i.id === selIngrediente);
    if (!ing) return;
    setItems([...items, {
      ingrediente_id: ing.id,
      nombre: ing.nombre,
      cantidad: 1,
      costo_unitario: ing.costo_por_unidad,
    }]);
    setSelIngrediente("");
  }

  function updateItem(idx: number, field: keyof ItemLocal, value: number) {
    setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  const tipoLabels: Record<Tipo, string> = {
    compra: "Compra",
    uso: "Uso",
    ajuste: "Ajuste",
    devolucion: "Devolución",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Movimiento de Inventario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo de movimiento</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(tipoLabels) as Tipo[]).map((t) => (
                  <SelectItem key={t} value={t}>{tipoLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Proveedor (compra) */}
          {tipo === "compra" && (
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Nombre del proveedor" />
            </div>
          )}

          {/* Evento (uso) */}
          {tipo === "uso" && (
            <div className="space-y-2">
              <Label>Evento (opcional)</Label>
              <Select value={eventoId} onValueChange={setEventoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar evento" />
                </SelectTrigger>
                <SelectContent>
                  {eventos.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nombre_evento}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notas */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas opcionales..." rows={2} />
          </div>

          {/* Items */}
          <div className="space-y-2">
            <Label>Ingredientes</Label>
            <div className="flex gap-2">
              <Select value={selIngrediente} onValueChange={setSelIngrediente}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar ingrediente" />
                </SelectTrigger>
                <SelectContent>
                  {ingredientes
                    .filter((ig) => !items.some((it) => it.ingrediente_id === ig.id))
                    .map((ig) => (
                      <SelectItem key={ig.id} value={ig.id}>{ig.nombre} ({ig.unidad})</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={addItem} disabled={!selIngrediente}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingrediente</TableHead>
                    <TableHead className="w-28">Cantidad</TableHead>
                    {tipo === "compra" && <TableHead className="w-32">Costo unit.</TableHead>}
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={item.ingrediente_id}>
                      <TableCell>{item.nombre}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0.01}
                          step="any"
                          value={item.cantidad}
                          onChange={(e) => updateItem(idx, "cantidad", Number(e.target.value))}
                          className="h-8"
                        />
                      </TableCell>
                      {tipo === "compra" && (
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={item.costo_unitario}
                            onChange={(e) => updateItem(idx, "costo_unitario", Number(e.target.value))}
                            className="h-8"
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeItem(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
          <Button
            variant="secondary"
            disabled={items.length === 0 || createMut.isPending}
            onClick={() => createMut.mutate(false)}
          >
            Guardar borrador
          </Button>
          <Button
            disabled={items.length === 0 || createMut.isPending}
            onClick={() => createMut.mutate(true)}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
