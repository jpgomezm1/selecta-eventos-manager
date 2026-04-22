import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  transporteTarifasList,
  transporteTarifasCreate,
  transporteTarifasUpdate,
  transporteTarifasDelete,
} from "@/integrations/supabase/apiCatalogos";
import type { TransporteTarifa } from "@/types/cotizador";
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
import { Plus, Search, Truck, Trash2, Filter, Edit3, Save, X, MapPin } from "lucide-react";
import { KPI } from "@/components/Layout/PageHeader";

const TIPOS_EVENTO = [
  "Eventos Grandes",
  "Eventos Pequeños",
  "Selecta To Go",
  "Eventos Noche",
] as const;

const fmt = (n: number) => `$ ${n.toLocaleString("es-CO")}`;

export default function TransporteTarifasTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["catalogos", "transporte-tarifas"],
    queryFn: transporteTarifasList,
  });

  const [newItem, setNewItem] = useState({ lugar: "", tipo_evento: TIPOS_EVENTO[0] as string, tarifa: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<TransporteTarifa>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredData = (data ?? []).filter((item) => {
    const matchesSearch = item.lugar.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTipo = !filterTipo || item.tipo_evento === filterTipo;
    return matchesSearch && matchesTipo;
  });

  const totalTarifas = data?.length ?? 0;
  const destinosUnicos = new Set((data ?? []).map((d) => d.lugar)).size;
  const tarifaPromedio =
    totalTarifas > 0
      ? Math.round((data ?? []).reduce((s, d) => s + d.tarifa, 0) / totalTarifas)
      : 0;

  const createMut = useMutation({
    mutationFn: () =>
      transporteTarifasCreate({
        lugar: newItem.lugar,
        tipo_evento: newItem.tipo_evento as TransporteTarifa["tipo_evento"],
        tarifa: newItem.tarifa,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "transporte-tarifas"] });
      setNewItem({ lugar: "", tipo_evento: TIPOS_EVENTO[0], tarifa: 0 });
      setIsCreateOpen(false);
      toast({ title: "Tarifa creada", description: "La tarifa de transporte se agregó correctamente." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<TransporteTarifa> }) =>
      transporteTarifasUpdate(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "transporte-tarifas"] });
      setEditingId(null);
      setEditDraft({});
      toast({ title: "Actualizado", description: "Los cambios se guardaron correctamente." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => transporteTarifasDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "transporte-tarifas"] });
      toast({ title: "Eliminada", description: "La tarifa se eliminó correctamente." });
    },
    onError: (e) => {
      const msg = e.message?.includes("violates foreign key")
        ? "No se puede eliminar: este registro está en uso en cotizaciones existentes."
        : e.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const startEdit = (item: TransporteTarifa) => {
    setEditingId(item.id);
    setEditDraft({ lugar: item.lugar, tipo_evento: item.tipo_evento, tarifa: item.tarifa });
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
        <KPI kicker="Total tarifas" value={totalTarifas} />
        <KPI kicker="Destinos únicos" value={destinosUnicos} />
        <KPI kicker="Tarifa promedio" value={fmt(tarifaPromedio)} tone="primary" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por lugar…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            >
              <option value="">Todos los tipos</option>
              {TIPOS_EVENTO.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {filteredData.length} tarifas
          </span>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nueva tarifa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Nueva tarifa de transporte</DialogTitle>
                <DialogDescription>
                  Tarifa base para un destino y tipo de evento — usada por el cotizador.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Lugar / destino</label>
                  <Input
                    placeholder="Ej: Cali - Bogotá"
                    value={newItem.lugar}
                    onChange={(e) => setNewItem((p) => ({ ...p, lugar: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Tipo de evento</label>
                  <select
                    value={newItem.tipo_evento}
                    onChange={(e) => setNewItem((p) => ({ ...p, tipo_evento: e.target.value }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {TIPOS_EVENTO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Tarifa ($)</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newItem.tarifa || ""}
                    onChange={(e) => setNewItem((p) => ({ ...p, tarifa: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending || !newItem.lugar || !newItem.tarifa}
                >
                  {createMut.isPending ? "Agregando…" : "Agregar tarifa"}
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
                <TableHead className="kicker text-muted-foreground">Lugar</TableHead>
                <TableHead className="kicker text-muted-foreground">Tipo evento</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Tarifa</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                      <span className="text-sm text-muted-foreground">Cargando tarifas…</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Truck className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                      <div>
                        <h3 className="font-serif text-lg text-foreground">No hay tarifas</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {searchTerm || filterTipo
                            ? "No se encontraron resultados con los filtros aplicados."
                            : "Comienza agregando tarifas de transporte."}
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
                            value={editDraft.lugar ?? ""}
                            onChange={(e) => setEditDraft((p) => ({ ...p, lugar: e.target.value }))}
                            className="w-full"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <MapPin className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                            <span className="text-foreground">{item.lugar}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <select
                            value={editDraft.tipo_evento ?? ""}
                            onChange={(e) =>
                              setEditDraft((p) => ({
                                ...p,
                                tipo_evento: e.target.value as TransporteTarifa["tipo_evento"],
                              }))
                            }
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            {TIPOS_EVENTO.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-border bg-muted/40 font-normal text-muted-foreground"
                          >
                            {item.tipo_evento}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            value={editDraft.tarifa ?? 0}
                            onChange={(e) => setEditDraft((p) => ({ ...p, tarifa: Number(e.target.value) }))}
                            className="w-32 text-right"
                          />
                        ) : (
                          <span className="font-mono text-sm tabular-nums text-foreground/85">
                            {fmt(item.tarifa)}
                          </span>
                        )}
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
                                  if (window.confirm(`¿Eliminar la tarifa "${item.lugar}" (${item.tipo_evento})?`)) {
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
