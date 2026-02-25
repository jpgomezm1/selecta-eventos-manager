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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MapPin, Trash2, Filter, Edit3, Save, X, TrendingUp, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
      toast({ title: "Lugar creado", description: "El lugar se agregó al catálogo correctamente." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => lugaresCatalogoDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogos", "lugares"] });
      toast({ title: "Eliminado", description: "El lugar se eliminó correctamente." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-800">{totalLugares}</div>
                <div className="text-sm text-blue-600">Total lugares</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-800">{activos}</div>
                <div className="text-sm text-emerald-600">Activos</div>
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
                <div className="text-2xl font-bold text-amber-800">{fmt(precioPromedio)}</div>
                <div className="text-sm text-amber-600">Precio ref. promedio</div>
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
            <span>Agregar Lugar</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nombre *</label>
              <Input
                placeholder="Ej: Club Colombia"
                value={newItem.nombre}
                onChange={(e) => setNewItem((p) => ({ ...p, nombre: e.target.value }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Dirección</label>
              <Input
                placeholder="Cra 1 # 2-3"
                value={newItem.direccion}
                onChange={(e) => setNewItem((p) => ({ ...p, direccion: e.target.value }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Ciudad</label>
              <Input
                placeholder="Cali"
                value={newItem.ciudad}
                onChange={(e) => setNewItem((p) => ({ ...p, ciudad: e.target.value }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Capacidad</label>
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
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Precio Ref. ($)</label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={newItem.precio_referencia || ""}
                onChange={(e) => setNewItem((p) => ({ ...p, precio_referencia: Number(e.target.value) }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <Button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending || !newItem.nombre}
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
                placeholder="Buscar por nombre o ciudad..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={filterCiudad}
                onChange={(e) => setFilterCiudad(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500/20"
              >
                <option value="">Todas las ciudades</option>
                {ciudades.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
              {filteredData.length} lugares
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
                <TableHead className="font-semibold text-slate-700">Nombre</TableHead>
                <TableHead className="font-semibold text-slate-700">Ciudad</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Capacidad</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Precio Ref. ($)</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Estado</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="animate-spin w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full" />
                      <span className="text-slate-500">Cargando lugares...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <MapPin className="h-12 w-12 text-slate-300" />
                      <div>
                        <h3 className="font-medium text-slate-700">No hay lugares</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {searchTerm || filterCiudad
                            ? "No se encontraron resultados con los filtros aplicados"
                            : "Comienza agregando lugares al catálogo"}
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
                          <Input
                            value={editDraft.nombre ?? ""}
                            onChange={(e) => setEditDraft((p) => ({ ...p, nombre: e.target.value }))}
                            className="w-full"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span>{item.nombre}</span>
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
                          <span className="text-slate-600">{item.ciudad ?? "-"}</span>
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
                          <span className="text-slate-600">
                            {item.capacidad_estimada ? item.capacidad_estimada.toLocaleString() : "-"}
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
                          <span className="text-slate-600 font-medium">{fmt(item.precio_referencia)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={cn(
                            "cursor-pointer",
                            item.activo
                              ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
                              : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                          )}
                          onClick={() => toggleActivo(item)}
                        >
                          {item.activo ? "Activo" : "Inactivo"}
                        </Badge>
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
                              <Button variant="ghost" size="sm" onClick={() => delMut.mutate(item.id)} className="text-red-600 hover:bg-red-50">
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
