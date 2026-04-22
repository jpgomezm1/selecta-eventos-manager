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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Users, Trash2, Filter, Edit3, Save, X, TrendingUp, Briefcase } from "lucide-react";

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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-800">{totalRegistros}</div>
                <div className="text-sm text-blue-600">Total registros</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Briefcase className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-800">{rolesUnicos}</div>
                <div className="text-sm text-emerald-600">Roles configurados</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-800">{fmt(tarifaPromedio)}</div>
                <div className="text-sm text-amber-600">Tarifa promedio</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create form */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-2 text-slate-800">
            <Plus className="h-5 w-5" />
            <span>Agregar Costo de Personal</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Rol</label>
              <select
                value={newItem.rol}
                onChange={(e) => setNewItem((p) => ({ ...p, rol: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500/20"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Modalidad de Cobro</label>
              <select
                value={newItem.modalidad_cobro}
                onChange={(e) => setNewItem((p) => ({ ...p, modalidad_cobro: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500/20"
              >
                {MODALIDADES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tarifa ($)</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={newItem.tarifa || ""}
                onChange={(e) => setNewItem((p) => ({ ...p, tarifa: Number(e.target.value) }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !newItem.tarifa}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMut.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  <span>Agregando...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Agregar</span>
                </div>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search & filter */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por rol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={filterModalidad}
                onChange={(e) => setFilterModalidad(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500/20"
              >
                <option value="">Todas las modalidades</option>
                {MODALIDADES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
              {filteredData.length} registros
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-slate-200">
                <TableHead className="font-semibold text-slate-700">Rol</TableHead>
                <TableHead className="font-semibold text-slate-700">Modalidad</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Tarifa ($)</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="animate-spin w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full" />
                      <span className="text-slate-500">Cargando costos...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <Users className="h-12 w-12 text-slate-300" />
                      <div>
                        <h3 className="font-medium text-slate-700">No hay costos</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {searchTerm || filterModalidad
                            ? "No se encontraron resultados con los filtros aplicados"
                            : "Comienza agregando costos de personal"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-medium">
                        {isEditing ? (
                          <select
                            value={editDraft.rol ?? ""}
                            onChange={(e) =>
                              setEditDraft((p) => ({ ...p, rol: e.target.value as PersonalCosto["rol"] }))
                            }
                            className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm"
                            autoFocus
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Users className="h-4 w-4 text-slate-400" />
                            <span>{item.rol}</span>
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
                            className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm"
                          >
                            {MODALIDADES.map((m) => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-200">
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
                          <span className="text-slate-600 font-medium">{fmt(item.tarifa)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {isEditing ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => saveEdit(item.id)} className="text-green-600 hover:bg-green-50">
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-slate-500 hover:bg-slate-50">
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => startEdit(item)} className="text-blue-600 hover:bg-blue-50">
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (window.confirm(`¿Eliminar el costo de "${item.rol}" (${modalidadLabel(item.modalidad_cobro)})?`)) {
                                    delMut.mutate(item.id);
                                  }
                                }}
                                className="text-red-600 hover:bg-red-50"
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
