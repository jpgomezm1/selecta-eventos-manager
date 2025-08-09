import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import { MenajeMovimiento } from "@/types/menaje";
import { menajeCatalogoList } from "@/integrations/supabase/apiMenaje";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Trash2, 
  Calendar, 
  FileText, 
  Package, 
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Save,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  movimiento: MenajeMovimiento & { items: Array<{ menaje_id: string; cantidad: number; merma?: number }> };
  onSave: (mov: MenajeMovimiento, items: Array<{ menaje_id: string; cantidad: number; merma?: number }>) => void;
};

export default function MovimientoDialog({ open, onOpenChange, movimiento, onSave }: Props) {
  const [mov, setMov] = useState(movimiento);
  const [items, setItems] = useState(movimiento.items ?? []);
  const { data: catalogo } = useQuery({ queryKey: ["menaje-catalogo"], queryFn: menajeCatalogoList });

  useEffect(() => {
    setMov(movimiento);
    setItems(movimiento.items ?? []);
  }, [movimiento]);

  const catalogForSelect = useMemo(() => {
    const taken = new Set(items.map((i) => i.menaje_id));
    return (catalogo ?? []).filter((c) => !taken.has(c.id));
  }, [catalogo, items]);

  const addItem = (id: string) => {
    setItems((prev) => [...prev, { menaje_id: id, cantidad: 1, merma: 0 }]);
  };

  const updateItem = (id: string, patch: Partial<{ cantidad: number; merma: number }>) =>
    setItems((prev) => prev.map((i) => (i.menaje_id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.menaje_id !== id));

  const totalItems = items.reduce((sum, item) => sum + item.cantidad, 0);
  const totalMerma = items.reduce((sum, item) => sum + (item.merma || 0), 0);

  const isValid = mov.fecha && items.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <DialogTitle className="flex items-center space-x-3">
            <div className={cn(
              "p-2 rounded-xl",
              mov.tipo === "ingreso" ? "bg-green-500" : "bg-red-500"
            )}>
              {mov.tipo === "ingreso" ? (
                <ArrowUp className="h-5 w-5 text-white" />
              ) : (
                <ArrowDown className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {mov.id ? "Editar" : "Nuevo"} {mov.tipo === "ingreso" ? "Ingreso" : "Salida"}
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                {mov.tipo === "ingreso" ? "Registrar entrada de inventario" : "Registrar salida de inventario"}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 p-1">
          {/* Información general */}
          <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-slate-800">
                <Calendar className="h-4 w-4" />
                <span>Información General</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Fecha</label>
                  <Input 
                    type="date" 
                    value={mov.fecha} 
                    onChange={(e) => setMov({ ...mov, fecha: e.target.value })}
                    className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Estado</label>
                  <Select value={mov.estado} onValueChange={(v) => setMov({ ...mov, estado: v as any })}>
                    <SelectTrigger className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="borrador">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-amber-400 rounded-full" />
                          <span>Borrador</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="confirmado">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full" />
                          <span>Confirmado</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="cancelado">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-400 rounded-full" />
                          <span>Cancelado</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo</label>
                  <div className="p-3 bg-white rounded-lg border border-slate-300">
                    <Badge className={cn(
                      "flex items-center space-x-1 w-fit",
                      mov.tipo === "ingreso" ? "bg-green-100 text-green-700 border-green-200" : "bg-red-100 text-red-700 border-red-200"
                    )}>
                      {mov.tipo === "ingreso" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      <span className="capitalize font-medium">{mov.tipo}</span>
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                  <FileText className="h-4 w-4" />
                  <span>Notas</span>
                </label>
                <Input 
                  placeholder="Descripción opcional del movimiento..."
                  value={mov.notas ?? ""} 
                  onChange={(e) => setMov({ ...mov, notas: e.target.value })}
                  className="bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>
            </CardContent>
          </Card>

          {/* Agregar elementos */}
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2 text-slate-800">
                  <Package className="h-4 w-4" />
                  <span>Elementos del Movimiento</span>
                </CardTitle>
                
                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center space-x-1 bg-blue-50 px-3 py-1 rounded-lg">
                    <span className="text-blue-600 font-medium">{items.length}</span>
                    <span className="text-blue-600">elementos</span>
                  </div>
                  <div className="flex items-center space-x-1 bg-emerald-50 px-3 py-1 rounded-lg">
                    <span className="text-emerald-600 font-medium">{totalItems}</span>
                    <span className="text-emerald-600">unidades</span>
                  </div>
                  {totalMerma > 0 && (
                    <div className="flex items-center space-x-1 bg-amber-50 px-3 py-1 rounded-lg">
                      <span className="text-amber-600 font-medium">{totalMerma}</span>
                      <span className="text-amber-600">merma</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="flex gap-3 mb-6">
                <Select onValueChange={(v) => addItem(v)} disabled={catalogForSelect.length === 0}>
                  <SelectTrigger className="flex-1 bg-slate-50 border-slate-300 focus:border-blue-500 focus:ring-blue-500/20">
                    <SelectValue placeholder={
                      catalogForSelect.length === 0 
                        ? "No hay más elementos disponibles" 
                        : "Seleccionar elemento de menaje..."
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {catalogForSelect.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="py-3">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center space-x-2">
                            <Package className="h-4 w-4 text-slate-400" />
                            <span className="font-medium">{c.nombre}</span>
                          </div>
                          <div className="text-xs text-slate-500 ml-4">
                            Stock: {c.stock_total} {c.unidad}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tabla de elementos */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 border-slate-200">
                      <TableHead className="font-semibold text-slate-700">Elemento</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-center">Cantidad</TableHead>
                      {mov.tipo === "salida" && (
                        <TableHead className="font-semibold text-slate-700 text-center">Merma</TableHead>
                      )}
                      <TableHead className="font-semibold text-slate-700 text-center">Stock Actual</TableHead>
                      <TableHead className="font-semibold text-slate-700 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={mov.tipo === "salida" ? 5 : 4} className="py-12 text-center">
                          <div className="flex flex-col items-center space-y-3">
                            <Package className="h-8 w-8 text-slate-300" />
                            <div>
                              <h3 className="font-medium text-slate-700">Sin elementos</h3>
                              <p className="text-sm text-slate-500 mt-1">
                                Selecciona elementos para incluir en este movimiento
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((i) => {
                        const c = catalogo?.find((x) => x.id === i.menaje_id);
                        const stockInsuficiente = mov.tipo === "salida" && c && (i.cantidad + (i.merma || 0)) > c.stock_total;
                        
                        return (
                          <TableRow key={i.menaje_id} className="hover:bg-slate-50">
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Package className="h-4 w-4 text-slate-400" />
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {c?.nombre ?? "Elemento desconocido"}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {c?.categoria} • {c?.unidad}
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="text-center">
                              <Input 
                                className="w-20 text-center" 
                                type="number" 
                                min={0} 
                                value={i.cantidad} 
                                onChange={(e) => updateItem(i.menaje_id, { cantidad: Number(e.target.value) })}
                              />
                            </TableCell>

                            {mov.tipo === "salida" && (
                              <TableCell className="text-center">
                                <Input 
                                  className="w-20 text-center" 
                                  type="number" 
                                  min={0} 
                                  value={i.merma ?? 0} 
                                  onChange={(e) => updateItem(i.menaje_id, { merma: Number(e.target.value) })}
                                />
                              </TableCell>
                            )}

                            <TableCell className="text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <span className={cn(
                                  "font-medium",
                                  stockInsuficiente ? "text-red-600" : "text-slate-700"
                                )}>
                                  {c?.stock_total ?? 0}
                                </span>
                                {stockInsuficiente && (
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(i.menaje_id)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Alertas */}
              {mov.tipo === "salida" && items.some(i => {
                const c = catalogo?.find(x => x.id === i.menaje_id);
                return c && (i.cantidad + (i.merma || 0)) > c.stock_total;
              }) && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-red-700 text-sm font-medium">
                      Algunos elementos exceden el stock disponible
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer con botones */}
        <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            {!isValid && "Complete la fecha y agregue al menos un elemento"}
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            
            <Button 
              onClick={() => onSave(mov, items)}
              disabled={!isValid}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Save className="h-4 w-4 mr-2" />
              Guardar Movimiento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}