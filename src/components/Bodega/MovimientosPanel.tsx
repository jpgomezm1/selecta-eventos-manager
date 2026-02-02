import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { movimientosList, movimientoCreate, movimientoUpdate, movimientoUpsertItems, movimientoConfirmar, movimientoDelete } from "@/integrations/supabase/apiMenaje";
import { MenajeMovimiento, MenajeMovimientoItem } from "@/types/menaje";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MovimientoDialog from "./MovimientoDialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Edit3, 
  Trash2, 
  Check, 
  Clock, 
  X,
  Filter,
  Calendar,
  Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";

export default function MovimientosPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["movimientos"], queryFn: movimientosList });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(MenajeMovimiento & { items: MenajeMovimientoItem[] }) | null>(null);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterEstado, setFilterEstado] = useState("");

  // Filtrar movimientos
  const filteredData = (data ?? []).filter(mov => {
    const matchesTipo = !filterTipo || mov.tipo === filterTipo;
    const matchesEstado = !filterEstado || mov.estado === filterEstado;
    return matchesTipo && matchesEstado;
  });

  // Estadísticas
  const stats = {
    total: data?.length ?? 0,
    ingresos: data?.filter(m => m.tipo === 'ingreso').length ?? 0,
    salidas: data?.filter(m => m.tipo === 'salida').length ?? 0,
    pendientes: data?.filter(m => m.estado === 'borrador').length ?? 0
  };

  const handleNew = (tipo: "salida" | "ingreso") => {
    setEditing({
      id: "",
      tipo,
      fecha: new Date().toISOString().slice(0, 10),
      estado: "borrador",
      evento_id: null,
      reserva_id: null,
      notas: "",
      items: [],
    } as any);
    setOpen(true);
  };

  const handleEdit = (movimiento: any) => {
    setEditing(movimiento);
    setOpen(true);
  };

  const handleSave = async (mov: MenajeMovimiento, items: Array<{ menaje_id: string; cantidad: number; merma?: number }>) => {
    try {
      let id = mov.id;
      if (!id) {
        const created = await movimientoCreate(
          {
            tipo: mov.tipo,
            fecha: mov.fecha,
            estado: mov.estado,
            evento_id: mov.evento_id ?? null,
            reserva_id: mov.reserva_id ?? null,
            notas: mov.notas ?? null,
          },
          items
        );
        id = created.id;
      } else {
        await movimientoUpdate(id, {
          tipo: mov.tipo,
          fecha: mov.fecha,
          estado: mov.estado,
          evento_id: mov.evento_id ?? null,
          reserva_id: mov.reserva_id ?? null,
          notas: mov.notas ?? null,
        });
        await movimientoUpsertItems(id, items);
      }

      toast({ 
        title: "¡Movimiento guardado!",
        description: `El ${mov.tipo} se registró correctamente en el sistema.`
      });
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["movimientos"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const confirmMut = useMutation({
    mutationFn: (id: string) => movimientoConfirmar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      toast({
        title: "Movimiento confirmado",
        description: "El stock se ha actualizado correctamente."
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => movimientoDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      toast({
        title: "Movimiento eliminado",
        description: "El registro se removió del sistema."
      });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "confirmado":
        return { color: "green", icon: Check, label: "Confirmado" };
      case "borrador":
        return { color: "amber", icon: Clock, label: "Borrador" };
      case "cancelado":
        return { color: "red", icon: X, label: "Cancelado" };
      default:
        return { color: "gray", icon: Clock, label: estado };
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "ingreso":
        return { color: "green", icon: ArrowUp, label: "Ingreso" };
      case "salida":
        return { color: "red", icon: ArrowDown, label: "Salida" };
      default:
        return { color: "gray", icon: ArrowUpDown, label: tipo };
    }
  };

  return (
    <div className="space-y-6">
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ArrowUpDown className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-800">{stats.total}</div>
                <div className="text-sm text-blue-600">Total movimientos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ArrowUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-800">{stats.ingresos}</div>
                <div className="text-sm text-green-600">Ingresos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ArrowDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-800">{stats.salidas}</div>
                <div className="text-sm text-red-600">Salidas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-800">{stats.pendientes}</div>
                <div className="text-sm text-amber-600">Pendientes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controles */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Botones de acción */}
            <div className="flex gap-3">
              <Button 
                onClick={() => handleNew("salida")}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Nueva Salida
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => handleNew("ingreso")}
                className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Nuevo Ingreso
              </Button>
            </div>

            {/* Filtros */}
            <div className="flex items-center space-x-3">
              <Filter className="h-4 w-4 text-slate-500" />
              
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500/20"
              >
                <option value="">Todos los tipos</option>
                <option value="ingreso">Ingresos</option>
                <option value="salida">Salidas</option>
              </select>

              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-blue-500 focus:ring-blue-500/20"
              >
                <option value="">Todos los estados</option>
                <option value="borrador">Borrador</option>
                <option value="confirmado">Confirmado</option>
                <option value="cancelado">Cancelado</option>
              </select>

              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                {filteredData.length} registros
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de movimientos */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
          <CardTitle className="flex items-center space-x-2 text-slate-800">
            <ArrowUpDown className="h-5 w-5" />
            <span>Historial de Movimientos</span>
          </CardTitle>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-slate-200">
                <TableHead className="font-semibold text-slate-700">Fecha</TableHead>
                <TableHead className="font-semibold text-slate-700">Tipo</TableHead>
                <TableHead className="font-semibold text-slate-700">Estado</TableHead>
                <TableHead className="font-semibold text-slate-700">Elementos</TableHead>
                <TableHead className="font-semibold text-slate-700">Notas</TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="animate-spin w-8 h-8 border-2 border-slate-200 border-t-selecta-green rounded-full" />
                      <span className="text-slate-500">Cargando movimientos...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <Package className="h-12 w-12 text-slate-300" />
                      <div>
                        <h3 className="font-medium text-slate-700">No hay movimientos</h3>
                        <p className="text-sm text-slate-500 mt-1">
                          Comienza registrando entradas y salidas de inventario
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((m) => {
                  const estadoBadge = getEstadoBadge(m.estado);
                  const tipoBadge = getTipoBadge(m.tipo);
                  const EstadoIcon = estadoBadge.icon;
                  const TipoIcon = tipoBadge.icon;

                  return (
                    <TableRow key={m.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="font-medium">
                            {moment(m.fecha).format("DD/MM/YYYY")}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge className={cn(
                          "flex items-center space-x-1 w-fit",
                          tipoBadge.color === "green" && "bg-green-100 text-green-700 border-green-200",
                          tipoBadge.color === "red" && "bg-red-100 text-red-700 border-red-200"
                        )}>
                          <TipoIcon className="h-3 w-3" />
                          <span className="capitalize">{tipoBadge.label}</span>
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge className={cn(
                          "flex items-center space-x-1 w-fit",
                          estadoBadge.color === "green" && "bg-green-100 text-green-700 border-green-200",
                          estadoBadge.color === "amber" && "bg-amber-100 text-amber-700 border-amber-200",
                         estadoBadge.color === "red" && "bg-red-100 text-red-700 border-red-200"
                       )}>
                         <EstadoIcon className="h-3 w-3" />
                         <span className="capitalize">{estadoBadge.label}</span>
                       </Badge>
                     </TableCell>

                     <TableCell>
                       <div className="max-w-xs">
                         {m.items.length > 0 ? (
                           <div className="space-y-1">
                             {m.items.slice(0, 2).map((item, idx) => (
                               <div key={idx} className="text-sm text-slate-600">
                                 <span className="font-medium">
                                   {item.menaje?.nombre ?? 'Elemento desconocido'}
                                 </span>
                                 <span className="text-slate-400 ml-1">
                                   x{item.cantidad}
                                 </span>
                               </div>
                             ))}
                             {m.items.length > 2 && (
                               <div className="text-xs text-slate-500">
                                 +{m.items.length - 2} más...
                               </div>
                             )}
                           </div>
                         ) : (
                           <span className="text-slate-400 text-sm">Sin elementos</span>
                         )}
                       </div>
                     </TableCell>

                     <TableCell>
                       <div className="max-w-xs">
                         {m.notas ? (
                           <span className="text-sm text-slate-600 truncate block">
                             {m.notas}
                           </span>
                         ) : (
                           <span className="text-slate-400 text-sm">—</span>
                         )}
                       </div>
                     </TableCell>

                     <TableCell className="text-right">
                       <div className="flex items-center justify-end space-x-2">
                         <Button
                           size="sm"
                           variant="ghost"
                           onClick={() => handleEdit(m)}
                           className="text-blue-600 hover:bg-blue-50"
                         >
                           <Edit3 className="h-4 w-4" />
                         </Button>

                         {m.estado !== "confirmado" && (
                           <Button
                             size="sm"
                             onClick={() => confirmMut.mutate(m.id)}
                             disabled={confirmMut.isPending}
                             className="bg-green-500 hover:bg-green-600 text-white text-xs px-3"
                           >
                             {confirmMut.isPending ? (
                               <div className="animate-spin w-3 h-3 border border-white/30 border-t-white rounded-full" />
                             ) : (
                               <Check className="h-3 w-3" />
                             )}
                           </Button>
                         )}

                         <Button
                           size="sm"
                           variant="ghost"
                           onClick={() => deleteMut.mutate(m.id)}
                           disabled={deleteMut.isPending}
                           className="text-red-600 hover:bg-red-50"
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
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

     {/* Dialog de movimiento */}
     {editing && (
       <MovimientoDialog
         open={open}
         onOpenChange={setOpen}
         movimiento={editing as any}
         onSave={handleSave}
       />
     )}
   </div>
 );
}