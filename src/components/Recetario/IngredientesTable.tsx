import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getIngredientesCatalogo,
  createIngrediente,
  updateIngrediente,
  deleteIngrediente,
  getProveedoresByIngrediente,
  createProveedor,
  deleteProveedor,
  setProveedorPrincipal,
  convertirAUnidadBase,
} from "@/integrations/supabase/apiCotizador";
import type { IngredienteCatalogo, IngredienteProveedor } from "@/types/cotizador";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, ChevronLeft, Star, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const UNIDADES_BASE = ["gr", "ml", "und"];
const UNIDADES_PRESENTACION = ["gr", "kg", "ml", "lt", "und"];

export default function IngredientesTable() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<IngredienteCatalogo>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Form para nuevo ingrediente (solo nombre + unidad)
  const [newNombre, setNewNombre] = useState("");
  const [newUnidad, setNewUnidad] = useState("gr");

  const { data: ingredientes = [], isLoading } = useQuery({
    queryKey: ["ingredientes-catalogo"],
    queryFn: getIngredientesCatalogo,
  });

  const createMut = useMutation({
    mutationFn: createIngrediente,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredientes-catalogo"] });
      toast({ title: "Ingrediente creado" });
      setNewNombre("");
      setNewUnidad("gr");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<IngredienteCatalogo, "id" | "created_at">> }) =>
      updateIngrediente(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredientes-catalogo"] });
      setEditingId(null);
      toast({ title: "Ingrediente actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteIngrediente,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingredientes-catalogo"] });
      toast({ title: "Ingrediente eliminado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = ingredientes.filter(
    (i) => i.nombre.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleCreate = () => {
    if (!newNombre.trim()) return;
    createMut.mutate({
      nombre: newNombre.trim(),
      unidad: newUnidad,
      costo_por_unidad: 0,
      proveedor: null,
    });
  };

  const startEdit = (ing: IngredienteCatalogo) => {
    setEditingId(ing.id);
    setEditValues({ nombre: ing.nombre, unidad: ing.unidad });
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMut.mutate({ id: editingId, updates: editValues });
  };

  const fmt = (n: number) => `$ ${n.toLocaleString("es-CO")}`;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por nombre..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="pl-10"
        />
      </div>

      {/* Form agregar */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-slate-50 rounded-lg border">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Nombre</label>
          <Input value={newNombre} onChange={(e) => setNewNombre(e.target.value)} placeholder="Nombre" className="w-48" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-500">Unidad base</label>
          <Select value={newUnidad} onValueChange={setNewUnidad}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIDADES_BASE.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleCreate} disabled={createMut.isPending || !newNombre.trim()} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Agregar
        </Button>
      </div>

      {/* Tabla */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Costo / Unidad</TableHead>
              <TableHead className="w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((ing) => (
              <Fragment key={ing.id}>
                <TableRow>
                  {editingId === ing.id ? (
                    <>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleExpand(ing.id)}>
                          {expandedId === ing.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Input value={editValues.nombre ?? ""} onChange={(e) => setEditValues({ ...editValues, nombre: e.target.value })} className="h-8" />
                      </TableCell>
                      <TableCell>
                        <Select value={editValues.unidad ?? "gr"} onValueChange={(v) => setEditValues({ ...editValues, unidad: v })}>
                          <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                          <SelectContent>{UNIDADES_BASE.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right text-slate-400">{fmt(ing.costo_por_unidad)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="h-4 w-4 text-green-600" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-4 w-4 text-slate-400" /></Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleExpand(ing.id)}>
                          {expandedId === ing.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{ing.nombre}</TableCell>
                      <TableCell>{ing.unidad}</TableCell>
                      <TableCell className="text-right">
                        <CostoCelda ingrediente={ing} />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(ing)}><Pencil className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar ingrediente</AlertDialogTitle>
                                <AlertDialogDescription>¿Estás seguro de eliminar "{ing.nombre}"? Esta acción no se puede deshacer.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMut.mutate(ing.id)} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
                {expandedId === ing.id && (
                  <TableRow>
                    <TableCell colSpan={5} className="bg-slate-50 p-0">
                      <ProveedoresSubtable ingrediente={ing} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-slate-400 py-8">No se encontraron ingredientes</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{filtered.length} ingredientes</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600">{page + 1} / {totalPages}</span>
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Subcomponent: shows cost + cheapest supplier indicator */
function CostoCelda({ ingrediente }: { ingrediente: IngredienteCatalogo }) {
  const { data: proveedores = [] } = useQuery({
    queryKey: ["ingrediente-proveedores", ingrediente.id],
    queryFn: () => getProveedoresByIngrediente(ingrediente.id),
  });

  const fmt = (n: number) => `$ ${n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  if (proveedores.length === 0) {
    return <span className="text-slate-400">{fmt(ingrediente.costo_por_unidad)}</span>;
  }

  const cheapest = proveedores.reduce((min, p) => p.costo_por_unidad_base < min.costo_por_unidad_base ? p : min, proveedores[0]);
  const principal = proveedores.find((p) => p.es_principal);
  const principalIsNotCheapest = principal && cheapest && principal.id !== cheapest.id;

  return (
    <div className="space-y-1">
      <div>{fmt(ingrediente.costo_por_unidad)}</div>
      {principalIsNotCheapest && (
        <div className="flex items-center justify-end gap-1">
          <TrendingDown className="h-3 w-3 text-green-600" />
          <span className="text-[11px] text-green-600 font-medium">
            {cheapest.proveedor}: {fmt(cheapest.costo_por_unidad_base)}
          </span>
        </div>
      )}
      {proveedores.length > 1 && !principalIsNotCheapest && (
        <div className="text-[11px] text-slate-400">Mejor precio activo</div>
      )}
    </div>
  );
}

/** Subcomponent: proveedores for a single ingrediente */
function ProveedoresSubtable({ ingrediente }: { ingrediente: IngredienteCatalogo }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [newProv, setNewProv] = useState("");
  const [newCantidad, setNewCantidad] = useState("");
  const [newUnidadPres, setNewUnidadPres] = useState("kg");
  const [newPrecio, setNewPrecio] = useState("");

  const { data: proveedores = [], isLoading } = useQuery({
    queryKey: ["ingrediente-proveedores", ingrediente.id],
    queryFn: () => getProveedoresByIngrediente(ingrediente.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["ingrediente-proveedores", ingrediente.id] });
    queryClient.invalidateQueries({ queryKey: ["ingredientes-catalogo"] });
    queryClient.invalidateQueries({ queryKey: ["plato-ingredientes-all"] });
  };

  const createMut = useMutation({
    mutationFn: createProveedor,
    onSuccess: () => {
      invalidate();
      toast({ title: "Proveedor agregado" });
      setNewProv("");
      setNewCantidad("");
      setNewPrecio("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: deleteProveedor,
    onSuccess: () => { invalidate(); toast({ title: "Proveedor eliminado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const principalMut = useMutation({
    mutationFn: (provId: string) => setProveedorPrincipal(ingrediente.id, provId),
    onSuccess: () => { invalidate(); toast({ title: "Proveedor principal actualizado" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleAdd = () => {
    if (!newProv.trim() || !newCantidad || !newPrecio) return;
    const cantNum = Number(newCantidad);
    const precioNum = Number(newPrecio);
    const cantEnBase = convertirAUnidadBase(cantNum, newUnidadPres, ingrediente.unidad);
    const costoBase = precioNum / cantEnBase;

    createMut.mutate({
      ingrediente_id: ingrediente.id,
      proveedor: newProv.trim(),
      presentacion_cantidad: cantNum,
      presentacion_unidad: newUnidadPres,
      precio_presentacion: precioNum,
      costo_por_unidad_base: costoBase,
      es_principal: proveedores.length === 0, // first one is principal by default
    });
  };

  const fmt = (n: number) => `$ ${n.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Proveedores de {ingrediente.nombre}</p>

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : (
        <>
          {proveedores.length > 0 && (() => {
            const cheapestId = proveedores.reduce((min, p) => p.costo_por_unidad_base < min.costo_por_unidad_base ? p : min, proveedores[0]).id;
            return (
            <div className="rounded border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Presentación</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-right">Costo/{ingrediente.unidad}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {proveedores.map((p) => (
                    <TableRow key={p.id} className={p.id === cheapestId && proveedores.length > 1 ? "bg-green-50" : ""}>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => principalMut.mutate(p.id)}
                          title="Marcar como principal"
                        >
                          <Star className={`h-4 w-4 ${p.es_principal ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{p.proveedor}</TableCell>
                      <TableCell>{p.presentacion_cantidad} {p.presentacion_unidad}</TableCell>
                      <TableCell className="text-right">{fmt(p.precio_presentacion)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{fmt(p.costo_por_unidad_base)}</span>
                        {p.id === cheapestId && proveedores.length > 1 && (
                          <Badge variant="outline" className="ml-2 text-[10px] border-green-300 text-green-700 bg-green-50">
                            <TrendingDown className="h-3 w-3 mr-0.5" /> Más barato
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteMut.mutate(p.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            );
          })()}

          {/* Add proveedor form */}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Proveedor</label>
              <Input value={newProv} onChange={(e) => setNewProv(e.target.value)} placeholder="Nombre" className="w-36 h-8" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Cantidad</label>
              <Input type="number" value={newCantidad} onChange={(e) => setNewCantidad(e.target.value)} placeholder="1" className="w-20 h-8" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Unidad</label>
              <Select value={newUnidadPres} onValueChange={setNewUnidadPres}>
                <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES_PRESENTACION.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500">Precio</label>
              <Input type="number" value={newPrecio} onChange={(e) => setNewPrecio(e.target.value)} placeholder="20000" className="w-28 h-8" />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={createMut.isPending || !newProv.trim() || !newCantidad || !newPrecio} className="h-8">
              <Plus className="h-3 w-3 mr-1" /> Agregar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
