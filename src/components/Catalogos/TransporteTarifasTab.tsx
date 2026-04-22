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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Truck, Trash2, Filter, Edit3, Save, X, MapPin, TrendingUp } from "lucide-react";

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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-800">{totalTarifas}</div>
                <div className="text-sm text-blue-600">Total tarifas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <MapPin className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-800">{destinosUnicos}</div>
                <div className="text-sm text-emerald-600">Destinos únicos</div>
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
            <span>Agregar Tarifa de Transporte</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Lugar / Destino</label>
              <Input
                placeholder="Ej: Cali - Bogotá"
                value={newItem.lugar}
                onChange={(e) => setNewItem((p) => ({ ...p, lugar: e.target.value }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Tipo de Evento</label>
              <select
                value={newItem.tipo_evento}
                onChange={(e) => setNewItem((p) => ({ ...p, tipo_evento: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500/20"
              >
                {TIPOS_EVENTO.map((t) => (
                  <option key={t} value={t}>{t}</option>
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
              disabled={createMut.isPending || !newItem.lugar || !newItem.tarifa}
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
                placeholder="Buscar por lugar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500/20"
              >
                <option value="">Todos los tipos</option>
                {TIPOS_EVENTO.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
              {filteredData.length} tarifas
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
                <TableHead className="font-semibold text-slate-700">Lugar</TableHead>
                <TableHead className="font-semibold text-slate-700">Tipo Evento</TableHead>
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
                      <span className="text-slate-500">Cargando tarifas...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <Truck className="h-12 w-12 text-slate-300" />
                      <div>
                        <h3 className="font-medium text-slate-700">No hay tarifas</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {searchTerm || filterTipo
                            ? "No se encontraron resultados con los filtros aplicados"
                            : "Comienza agregando tarifas de transporte"}
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
                            value={editDraft.lugar ?? ""}
                            onChange={(e) => setEditDraft((p) => ({ ...p, lugar: e.target.value }))}
                            className="w-full"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center space-x-2">
                            <MapPin className="h-4 w-4 text-slate-400" />
                            <span>{item.lugar}</span>
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
                            className="w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-sm"
                          >
                            {TIPOS_EVENTO.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-200">
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
                                  if (window.confirm(`¿Eliminar la tarifa "${item.lugar}" (${item.tipo_evento})?`)) {
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
