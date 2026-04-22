import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  personalCostosList,
  personalCostosCreate,
  personalCostosUpdate,
  personalCostosDelete,
} from "@/integrations/supabase/apiCatalogos";
import type { PersonalCosto, ModalidadCobroCotizador } from "@/types/cotizador";
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
import { Plus, Search, Users, Trash2, Filter, Edit3, Save, X } from "lucide-react";
import { KPI } from "@/components/Layout/PageHeader";

const ROLES: PersonalCosto["rol"][] = [
  "Coordinador",
  "Mesero",
  "Chef",
  "Bartender",
  "Decorador",
  "Técnico de Sonido",
  "Fotógrafo",
  "Otro",
];

const MODALIDADES: { value: ModalidadCobroCotizador; label: string }[] = [
  { value: "por_hora", label: "Por Hora" },
  { value: "jornada_9h", label: "Jornada 9h" },
  { value: "jornada_10h", label: "Jornada 10h" },
  { value: "jornada_hasta_10h", label: "Jornada hasta 10h" },
  { value: "jornada_nocturna", label: "Jornada Nocturna" },
  { value: "por_evento", label: "Por Evento" },
];

const modalidadLabel = (v: string) => MODALIDADES.find((m) => m.value === v)?.label ?? v;
const fmt = (n: number) => `$ ${n.toLocaleString("es-CO")}`;

export default function PersonalCostosTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["catalogos", "personal-costos"],
    queryFn: personalCostosList,
  });

  const [newItem, setNewItem] = useState({
    rol: ROLES[0] as string,
    modalidad_cobro: MODALIDADES[0].value as string,
    tarifa: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterModalidad, setFilterModalidad] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<PersonalCosto>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filteredData = (data ?? []).filter((item) => {
    const matchesSearch = item.rol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesModalidad = !filterModalidad || item.modalidad_cobro === filterModalidad;
    return matchesSearch && matchesModalidad;
  });

  const totalRegistros = data?.length ?? 0;
  const rolesUnicos = new Set((data ?? []).map((d) => d.rol)).size;
  const tarifaPromedio =
    totalRegistros > 0
      ? Math.round((data ?? []).reduce((s, d) => s + d.tarifa, 0) / totalRegistros)
      : 0;

  const createMut = useMutation({
    mutationFn: () =>
      personalCostosCreate({
        rol: newItem.rol as PersonalCosto["rol"],
        modalidad_cobro: newItem.modalidad_cobro as ModalidadCobroCotizador,
        tarifa: newItem.tarifa,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "personal-costos"] });
      setNewItem({ rol: ROLES[0], modalidad_cobro: MODALIDADES[0].value, tarifa: 0 });
      setIsCreateOpen(false);
      toast({ title: "Costo creado", description: "El costo de personal se agregó correctamente." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PersonalCosto> }) =>
      personalCostosUpdate(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "personal-costos"] });
      setEditingId(null);
      setEditDraft({});
      toast({ title: "Actualizado", description: "Los cambios se guardaron correctamente." });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => personalCostosDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "personal-costos"] });
      toast({ title: "Eliminado", description: "El costo se eliminó correctamente." });
    },
    onError: (e) => {
      const msg = e.message?.includes("violates foreign key")
        ? "No se puede eliminar: este registro está en uso en cotizaciones existentes."
        : e.message;
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const startEdit = (item: PersonalCosto) => {
    setEditingId(item.id);
    setEditDraft({ rol: item.rol, modalidad_cobro: item.modalidad_cobro, tarifa: item.tarifa });
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
        <KPI kicker="Total registros" value={totalRegistros} />
        <KPI kicker="Roles configurados" value={rolesUnicos} />
        <KPI kicker="Tarifa promedio" value={fmt(tarifaPromedio)} tone="primary" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por rol…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterModalidad}
              onChange={(e) => setFilterModalidad(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            >
              <option value="">Todas las modalidades</option>
              {MODALIDADES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {filteredData.length} registros
          </span>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo costo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Nuevo costo de personal</DialogTitle>
                <DialogDescription>
                  Define la tarifa para un rol y modalidad específica — usada por el cotizador.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Rol</label>
                  <select
                    value={newItem.rol}
                    onChange={(e) => setNewItem((p) => ({ ...p, rol: e.target.value }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="kicker text-muted-foreground">Modalidad de cobro</label>
                  <select
                    value={newItem.modalidad_cobro}
                    onChange={(e) => setNewItem((p) => ({ ...p, modalidad_cobro: e.target.value }))}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {MODALIDADES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
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
                  disabled={createMut.isPending || !newItem.tarifa}
                >
                  {createMut.isPending ? "Agregando…" : "Agregar costo"}
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
                <TableHead className="kicker text-muted-foreground">Rol</TableHead>
                <TableHead className="kicker text-muted-foreground">Modalidad</TableHead>
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
                      <span className="text-sm text-muted-foreground">Cargando costos…</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Users className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                      <div>
                        <h3 className="font-serif text-lg text-foreground">No hay costos</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {searchTerm || filterModalidad
                            ? "No se encontraron resultados con los filtros aplicados."
                            : "Comienza agregando costos de personal."}
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
                          <select
                            value={editDraft.rol ?? ""}
                            onChange={(e) =>
                              setEditDraft((p) => ({ ...p, rol: e.target.value as PersonalCosto["rol"] }))
                            }
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            autoFocus
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <Users className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                            <span className="text-foreground">{item.rol}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <select
                            value={editDraft.modalidad_cobro ?? ""}
                            onChange={(e) =>
                              setEditDraft((p) => ({
                                ...p,
                                modalidad_cobro: e.target.value as ModalidadCobroCotizador,
                              }))
                            }
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          >
                            {MODALIDADES.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-border bg-muted/40 font-normal text-muted-foreground"
                          >
                            {modalidadLabel(item.modalidad_cobro)}
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
                                  if (
                                    window.confirm(
                                      `¿Eliminar el costo de "${item.rol}" (${modalidadLabel(item.modalidad_cobro)})?`
                                    )
                                  ) {
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
