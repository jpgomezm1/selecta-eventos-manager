import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { menajeCatalogoList, menajeCatalogoCreate, menajeCatalogoUpdate, menajeCatalogoDelete } from "@/integrations/supabase/apiMenaje";
import { MenajeCatalogo } from "@/types/menaje";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Package,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Edit3,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KPI } from "@/components/Layout/PageHeader";

export default function InventarioTable() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["menaje-catalogo"], queryFn: menajeCatalogoList });

  const [newItem, setNewItem] = useState<Partial<MenajeCatalogo>>({
    nombre: "",
    categoria: "",
    unidad: "unidad",
    stock_total: 0,
    precio_alquiler: 0,
    activo: true,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<MenajeCatalogo>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filtrar datos
  const filteredData = (data ?? []).filter(item => {
    const matchesSearch = item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || item.categoria === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Categorías únicas para filtro
  const categories = [...new Set((data ?? []).map(item => item.categoria))].filter(Boolean);

  // Estadísticas
  const totalItems = data?.length ?? 0;
  const lowStockItems = (data ?? []).filter(item => item.stock_total < 10).length;
  const totalValue = (data ?? []).reduce((sum, item) => sum + item.stock_total, 0);

  const createMut = useMutation({
    mutationFn: () => menajeCatalogoCreate(newItem as Omit<MenajeCatalogo, "id" | "created_at">),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menaje-catalogo"] });
      setNewItem({ nombre: "", categoria: "", unidad: "unidad", stock_total: 0, precio_alquiler: 0, activo: true });
      setIsCreateOpen(false);
      toast({
        title: "Elemento creado",
        description: "El nuevo elemento se agregó al inventario correctamente.",
      });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEditing = (item: MenajeCatalogo) => {
    setEditingId(item.id);
    setEditValues({
      nombre: item.nombre,
      categoria: item.categoria,
      unidad: item.unidad,
      stock_total: item.stock_total,
      precio_alquiler: item.precio_alquiler,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<MenajeCatalogo> }) =>
      menajeCatalogoUpdate(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menaje-catalogo"] });
      setEditingId(null);
      setEditValues({});
      toast({ title: "Actualizado", description: "Los cambios se guardaron correctamente." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveEditing = (id: string) => {
    updateMut.mutate({ id, patch: editValues });
  };

  const delMut = useMutation({
    mutationFn: (id: string) => menajeCatalogoDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menaje-catalogo"] });
      toast({
        title: "Elemento eliminado",
        description: "El elemento se removió del inventario."
      });
    },
    onError: (e) => {
      const msg = e.message?.includes("violates foreign key")
        ? "No se puede eliminar: este elemento está en uso en reservas o movimientos existentes."
        : e.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { color: "red", label: "Agotado", icon: X };
    if (stock < 10) return { color: "amber", label: "Stock bajo", icon: AlertTriangle };
    return { color: "green", label: "Disponible", icon: CheckCircle2 };
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-y border-border py-6 md:grid-cols-3">
        <KPI kicker="Total de elementos" value={totalItems} />
        <KPI
          kicker="Stock bajo"
          value={lowStockItems}
          tone={lowStockItems > 0 ? "warning" : "neutral"}
        />
        <KPI kicker="Unidades totales" value={totalValue} tone="primary" />
      </div>

      {/* Toolbar: búsqueda + filtro + acción */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o categoría…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            >
              <option value="">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {filteredData.length} elementos
          </span>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo elemento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Nuevo elemento de menaje</DialogTitle>
                <DialogDescription>
                  Define el catálogo base. El stock se actualiza después desde movimientos.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="kicker text-muted-foreground">Nombre</label>
                  <Input
                    placeholder="Ej: Platos hondos"
                    value={newItem.nombre ?? ""}
                    onChange={(e) => setNewItem((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Categoría</label>
                  <Input
                    placeholder="Ej: Vajilla"
                    value={newItem.categoria ?? ""}
                    onChange={(e) => setNewItem((p) => ({ ...p, categoria: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Unidad</label>
                  <Input
                    placeholder="unidad"
                    value={newItem.unidad ?? "unidad"}
                    onChange={(e) => setNewItem((p) => ({ ...p, unidad: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Stock inicial</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newItem.stock_total ?? 0}
                    onChange={(e) => setNewItem((p) => ({ ...p, stock_total: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Precio alquiler</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newItem.precio_alquiler ?? 0}
                    onChange={(e) =>
                      setNewItem((p) => ({ ...p, precio_alquiler: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending || !newItem.nombre || !newItem.categoria}
                >
                  {createMut.isPending ? "Agregando…" : "Agregar elemento"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabla */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="kicker text-muted-foreground">Elemento</TableHead>
                <TableHead className="kicker text-muted-foreground">Categoría</TableHead>
                <TableHead className="kicker text-muted-foreground">Unidad</TableHead>
                <TableHead className="kicker text-center text-muted-foreground">Stock</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Precio alquiler</TableHead>
                <TableHead className="kicker text-center text-muted-foreground">Estado</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                      <span className="text-sm text-muted-foreground">Cargando inventario…</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Package className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                      <div>
                        <h3 className="font-serif text-lg text-foreground">No hay elementos</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {searchTerm || filterCategory
                            ? "No se encontraron resultados con los filtros aplicados."
                            : "Comienza agregando elementos al catálogo."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => {
                  const status = getStockStatus(item.stock_total);
                  const StatusIcon = status.icon;
                  const isEditing = editingId === item.id;

                  return (
                    <TableRow key={item.id} className="border-border transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {isEditing ? (
                          <Input
                            value={editValues.nombre ?? ""}
                            onChange={(e) => setEditValues((v) => ({ ...v, nombre: e.target.value }))}
                            className="w-full"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <Package className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                            <span className="text-foreground">{item.nombre}</span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editValues.categoria ?? ""}
                            onChange={(e) => setEditValues((v) => ({ ...v, categoria: e.target.value }))}
                          />
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-border bg-muted/40 font-normal text-muted-foreground"
                          >
                            {item.categoria}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editValues.unidad ?? ""}
                            onChange={(e) => setEditValues((v) => ({ ...v, unidad: e.target.value }))}
                            className="w-24"
                          />
                        ) : (
                          <span className="text-muted-foreground">{item.unidad}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            value={editValues.stock_total ?? 0}
                            onChange={(e) => setEditValues((v) => ({ ...v, stock_total: Number(e.target.value) }))}
                            className="w-20 text-center"
                          />
                        ) : (
                          <span
                            className={cn(
                              "font-mono text-sm font-semibold tabular-nums",
                              status.color === "red" && "text-destructive",
                              status.color === "amber" && "text-[hsl(30_55%_42%)]",
                              status.color === "green" && "text-foreground"
                            )}
                          >
                            {item.stock_total}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            value={editValues.precio_alquiler ?? 0}
                            onChange={(e) =>
                              setEditValues((v) => ({ ...v, precio_alquiler: Number(e.target.value) }))
                            }
                            className="w-24 text-right"
                          />
                        ) : (
                          <span className="font-mono text-sm tabular-nums text-foreground/80">
                            ${item.precio_alquiler.toLocaleString()}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "mx-auto inline-flex w-fit items-center gap-1 font-normal",
                            status.color === "red" && "border-destructive/30 bg-destructive/10 text-destructive",
                            status.color === "amber" &&
                              "border-[hsl(30_55%_42%)]/30 bg-[hsl(30_55%_42%)]/10 text-[hsl(30_55%_42%)]",
                            status.color === "green" && "border-primary/25 bg-primary/10 text-primary"
                          )}
                        >
                          <StatusIcon className="h-3 w-3" strokeWidth={2} />
                          <span>{status.label}</span>
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveEditing(item.id)}
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                                aria-label="Guardar"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditing}
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
                                aria-label="Cancelar"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditing(item)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label="Editar"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`¿Eliminar "${item.nombre}" del inventario?`)) {
                                    delMut.mutate(item.id);
                                  }
                                }}
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
   </div>
 );
}