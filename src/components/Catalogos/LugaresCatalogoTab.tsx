import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  lugaresCatalogoList,
  lugaresCatalogoCreate,
  lugaresCatalogoUpdate,
  lugaresCatalogoDelete,
} from "@/integrations/supabase/apiCatalogos";
import type { LugarCatalogo } from "@/types/cotizador";
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
import { Plus, Search, MapPin, Trash2, Filter, Edit3, Save, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KPI } from "@/components/Layout/PageHeader";

const fmt = (n: number) => `$ ${n.toLocaleString("es-CO")}`;

export default function LugaresCatalogoTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["catalogos", "lugares"],
    queryFn: lugaresCatalogoList,
  });

  const [newItem, setNewItem] = useState({
    nombre: "",
    direccion: "",
    ciudad: "",
    capacidad_estimada: null as number | null,
    precio_referencia: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCiudad, setFilterCiudad] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<LugarCatalogo>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredData = (data ?? []).filter((item) => {
    const matchesSearch =
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.ciudad ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCiudad = !filterCiudad || item.ciudad === filterCiudad;
    return matchesSearch && matchesCiudad;
  });

  const ciudades = [...new Set((data ?? []).map((d) => d.ciudad).filter(Boolean))] as string[];

  const totalLugares = data?.length ?? 0;
  const activos = (data ?? []).filter((d) => d.activo).length;
  const precioPromedio =
    totalLugares > 0
      ? Math.round((data ?? []).reduce((s, d) => s + d.precio_referencia, 0) / totalLugares)
      : 0;

  const createMut = useMutation({
    mutationFn: () =>
      lugaresCatalogoCreate({
        nombre: newItem.nombre,
        direccion: newItem.direccion || null,
        ciudad: newItem.ciudad || null,
        capacidad_estimada: newItem.capacidad_estimada,
        precio_referencia: newItem.precio_referencia,
        notas: null,
        activo: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "lugares"] });
      setNewItem({ nombre: "", direccion: "", ciudad: "", capacidad_estimada: null, precio_referencia: 0 });
      setIsCreateOpen(false);
      toast({ title: "Lugar creado", description: "El lugar se agregó al catálogo correctamente." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LugarCatalogo> }) =>
      lugaresCatalogoUpdate(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "lugares"] });
      setEditingId(null);
      setEditDraft({});
      toast({ title: "Actualizado", description: "Los cambios se guardaron correctamente." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => lugaresCatalogoDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "lugares"] });
      toast({ title: "Eliminado", description: "El lugar se eliminó correctamente." });
    },
    onError: (e) => {
      const msg = e.message?.includes("violates foreign key")
        ? "No se puede eliminar: este lugar está en uso en cotizaciones o eventos existentes."
        : e.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const toggleActivo = (item: LugarCatalogo) => {
    updateMut.mutate({ id: item.id, patch: { activo: !item.activo } });
  };

  const startEdit = (item: LugarCatalogo) => {
    setEditingId(item.id);
    setEditDraft({
      nombre: item.nombre,
      direccion: item.direccion,
      ciudad: item.ciudad,
      capacidad_estimada: item.capacidad_estimada,
      precio_referencia: item.precio_referencia,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = (id: string) => {
    updateMut.mutate({ id, patch: editDraft });
  };

  return (
    <div className="space-y-6">
      {/* KPIs editoriales */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 border-y border-border py-6 md:grid-cols-3">
        <KPI kicker="Total lugares" value={totalLugares} />
        <KPI kicker="Activos" value={activos} tone="primary" />
        <KPI kicker="Precio ref. promedio" value={fmt(precioPromedio)} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o ciudad…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterCiudad}
              onChange={(e) => setFilterCiudad(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            >
              <option value="">Todas las ciudades</option>
              {ciudades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {filteredData.length} lugares
          </span>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo lugar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Nuevo lugar</DialogTitle>
                <DialogDescription>
                  Catálogo de sitios conocidos — precio referencia, capacidad y datos de acceso.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 gap-4 py-2 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="kicker text-muted-foreground">Nombre *</label>
                  <Input
                    placeholder="Ej: Club Colombia"
                    value={newItem.nombre}
                    onChange={(e) => setNewItem((p) => ({ ...p, nombre: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="kicker text-muted-foreground">Dirección</label>
                  <Input
                    placeholder="Cra 1 # 2-3"
                    value={newItem.direccion}
                    onChange={(e) => setNewItem((p) => ({ ...p, direccion: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Ciudad</label>
                  <Input
                    placeholder="Cali"
                    value={newItem.ciudad}
                    onChange={(e) => setNewItem((p) => ({ ...p, ciudad: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Capacidad</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newItem.capacidad_estimada ?? ""}
                    onChange={(e) =>
                      setNewItem((p) => ({
                        ...p,
                        capacidad_estimada: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="kicker text-muted-foreground">Precio ref. ($)</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newItem.precio_referencia || ""}
                    onChange={(e) => setNewItem((p) => ({ ...p, precio_referencia: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending || !newItem.nombre}
                >
                  {createMut.isPending ? "Agregando…" : "Agregar lugar"}
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
                <TableHead className="kicker text-muted-foreground">Nombre</TableHead>
                <TableHead className="kicker text-muted-foreground">Ciudad</TableHead>
                <TableHead className="kicker text-center text-muted-foreground">Capacidad</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Precio ref.</TableHead>
                <TableHead className="kicker text-center text-muted-foreground">Estado</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                      <span className="text-sm text-muted-foreground">Cargando lugares…</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <MapPin className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                      <div>
                        <h3 className="font-serif text-lg text-foreground">No hay lugares</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {searchTerm || filterCiudad
                            ? "No se encontraron resultados con los filtros aplicados."
                            : "Comienza agregando lugares al catálogo."}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <TableRow key={item.id} className="border-border transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {isEditing ? (
                          <Input
                            value={editDraft.nombre ?? ""}
                            onChange={(e) => setEditDraft((p) => ({ ...p, nombre: e.target.value }))}
                            className="w-full"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <MapPin className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                            <span className="text-foreground">{item.nombre}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editDraft.ciudad ?? ""}
                            onChange={(e) => setEditDraft((p) => ({ ...p, ciudad: e.target.value }))}
                            className="w-full"
                          />
                        ) : (
                          <span className="text-muted-foreground">{item.ciudad ?? "—"}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            value={editDraft.capacidad_estimada ?? ""}
                            onChange={(e) =>
                              setEditDraft((p) => ({
                                ...p,
                                capacidad_estimada: e.target.value ? Number(e.target.value) : null,
                              }))
                            }
                            className="w-24 text-center"
                          />
                        ) : (
                          <span className="font-mono text-sm tabular-nums text-muted-foreground">
                            {item.capacidad_estimada ? item.capacidad_estimada.toLocaleString() : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            value={editDraft.precio_referencia ?? 0}
                            onChange={(e) =>
                              setEditDraft((p) => ({ ...p, precio_referencia: Number(e.target.value) }))
                            }
                            className="w-32 text-right"
                          />
                        ) : (
                          <span className="font-mono text-sm tabular-nums text-foreground/85">
                            {fmt(item.precio_referencia)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            "cursor-pointer font-normal transition-colors",
                            item.activo
                              ? "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
                              : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                          )}
                          onClick={() => toggleActivo(item)}
                        >
                          {item.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => saveEdit(item.id)}
                                className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                                aria-label="Guardar"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEdit}
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
                                onClick={() => startEdit(item)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-label="Editar"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const where = item.ciudad ? ` (${item.ciudad})` : "";
                                  if (window.confirm(`¿Eliminar el lugar "${item.nombre}"${where}?`)) {
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
