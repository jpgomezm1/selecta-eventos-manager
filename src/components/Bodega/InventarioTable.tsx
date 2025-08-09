import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { menajeCatalogoList, menajeCatalogoCreate, menajeCatalogoUpdate, menajeCatalogoDelete } from "@/integrations/supabase/apiMenaje";
import { MenajeCatalogo } from "@/types/menaje";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  Search, 
  Package, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2,
  TrendingUp,
  Filter,
  Edit3,
  Save,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

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

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

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
    mutationFn: () => menajeCatalogoCreate(newItem as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menaje-catalogo"] });
      setNewItem({ nombre: "", categoria: "", unidad: "unidad", stock_total: 0, activo: true });
      toast({ 
        title: "¡Elemento creado!",
        description: "El nuevo elemento se agregó al inventario correctamente."
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateField = (id: string, patch: Partial<MenajeCatalogo>) =>
    menajeCatalogoUpdate(id, patch).then(() => {
      qc.invalidateQueries({ queryKey: ["menaje-catalogo"] });
      setEditingId(null);
      toast({ title: "Actualizado", description: "Los cambios se guardaron correctamente." });
    });

  const delMut = useMutation({
    mutationFn: (id: string) => menajeCatalogoDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menaje-catalogo"] });
      toast({ 
        title: "Elemento eliminado",
        description: "El elemento se removió del inventario."
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { color: "red", label: "Agotado", icon: X };
    if (stock < 10) return { color: "amber", label: "Stock bajo", icon: AlertTriangle };
    return { color: "green", label: "Disponible", icon: CheckCircle2 };
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500 rounded-xl">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-800">{totalItems}</div>
                <div className="text-sm text-blue-600">Total de elementos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-amber-50 to-orange-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-800">{lowStockItems}</div>
                <div className="text-sm text-amber-600">Stock bajo</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-emerald-50 to-green-100 border-emerald-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500 rounded-xl">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-800">{totalValue}</div>
                <div className="text-sm text-emerald-600">Unidades totales</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulario de creación */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-2 text-slate-800">
            <Plus className="h-5 w-5" />
            <span>Agregar Nuevo Elemento</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <Input 
                placeholder="Ej: Platos hondos" 
                value={newItem.nombre ?? ""} 
                onChange={(e) => setNewItem((p) => ({ ...p, nombre: e.target.value }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Categoría</label>
              <Input 
                placeholder="Ej: Vajilla" 
                value={newItem.categoria ?? ""} 
                onChange={(e) => setNewItem((p) => ({ ...p, categoria: e.target.value }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Unidad</label>
              <Input 
                placeholder="unidad" 
                value={newItem.unidad ?? "unidad"} 
                onChange={(e) => setNewItem((p) => ({ ...p, unidad: e.target.value }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Stock inicial</label>
              <Input 
                type="number" 
                min="0"
                placeholder="0" 
                value={newItem.stock_total ?? 0} 
                onChange={(e) => setNewItem((p) => ({ ...p, stock_total: Number(e.target.value) }))}
                className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <Button 
              onClick={() => createMut.mutate()} 
              disabled={createMut.isPending || !newItem.nombre || !newItem.categoria}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
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

      {/* Filtros y búsqueda */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-50 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-slate-500" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500/20"
              >
                <option value="">Todas las categorías</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <Badge className="bg-blue-100 text-blue-700 border-blue-200">
              {filteredData.length} elementos
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-slate-200">
                <TableHead className="font-semibold text-slate-700">Elemento</TableHead>
                <TableHead className="font-semibold text-slate-700">Categoría</TableHead>
                <TableHead className="font-semibold text-slate-700">Unidad</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Stock</TableHead>
                <TableHead className="font-semibold text-slate-700 text-center">Estado</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="animate-spin w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full" />
                      <span className="text-slate-500">Cargando inventario...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <Package className="h-12 w-12 text-slate-300" />
                      <div>
                        <h3 className="font-medium text-slate-700">No hay elementos</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {searchTerm || filterCategory ? "No se encontraron resultados con los filtros aplicados" : "Comienza agregando elementos a tu inventario"}
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
                    <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-medium">
                        {isEditing ? (
                          <Input 
                            value={item.nombre} 
                            onChange={(e) => updateField(item.id, { nombre: e.target.value })}
                            className="w-full"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center space-x-2">
                            <Package className="h-4 w-4 text-slate-400" />
                            <span>{item.nombre}</span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <Input 
                            value={item.categoria} 
                            onChange={(e) => updateField(item.id, { categoria: e.target.value })}
                          />
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700 border-slate-200">
                            {item.categoria}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell>
                        {isEditing ? (
                          <Input 
                            value={item.unidad} 
                            onChange={(e) => updateField(item.id, { unidad: e.target.value })}
                            className="w-24"
                          />
                        ) : (
                          <span className="text-slate-600">{item.unidad}</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input 
                            type="number" 
                            min="0"
                            value={item.stock_total} 
                            onChange={(e) => updateField(item.id, { stock_total: Number(e.target.value) })}
                            className="w-20 text-center"
                          />
                        ) : (
                          <span className={cn(
                            "font-semibold",
                            status.color === "red" && "text-red-600",
                            status.color === "amber" && "text-amber-600",
                            status.color === "green" && "text-green-600"
                          )}>
                            {item.stock_total}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge className={cn(
                          "flex items-center space-x-1 w-fit mx-auto",
                          status.color === "red" && "bg-red-100 text-red-700 border-red-200",
                          status.color === "amber" && "bg-amber-100 text-amber-700 border-amber-200",
                          status.color === "green" && "bg-green-100 text-green-700 border-green-200"
                        )}>
                          <StatusIcon className="h-3 w-3" />
                          <span>{status.label}</span>
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                         {isEditing ? (
                           <>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => setEditingId(null)}
                               className="text-green-600 hover:bg-green-50"
                             >
                               <Save className="h-4 w-4" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => setEditingId(null)}
                               className="text-slate-500 hover:bg-slate-50"
                             >
                               <X className="h-4 w-4" />
                             </Button>
                           </>
                         ) : (
                           <>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => setEditingId(item.id)}
                               className="text-blue-600 hover:bg-blue-50"
                             >
                               <Edit3 className="h-4 w-4" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => delMut.mutate(item.id)}
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