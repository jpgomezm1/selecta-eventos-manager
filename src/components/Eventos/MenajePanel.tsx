import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UtensilsCrossed, Plus, AlertTriangle, CheckCircle, Package, Clock, Save } from "lucide-react";
import {
  menajeDisponiblePorRango,
  getOrCreateReservaForEvento,
  readReserva,
  saveReservaItems,
  setReservaEstado,
} from "@/integrations/supabase/apiMenaje";
import type { MenajeDisponible, MenajeReserva } from "@/types/menaje";

type Props = {
  eventoId: string;
  fechaEvento: string; // YYYY-MM-DD
};

export default function MenajePanel({ eventoId, fechaEvento }: Props) {
  const { toast } = useToast();
  const [disponibles, setDisponibles] = useState<MenajeDisponible[]>([]);
  const [reserva, setReserva] = useState<MenajeReserva | null>(null);
  const [items, setItems] = useState<Array<{ menaje_id: string; nombre: string; unidad: string; cantidad: number }>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cargar disponibilidad + reserva
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const r = await getOrCreateReservaForEvento(eventoId, fechaEvento);
        setReserva(r);

        const disp = await menajeDisponiblePorRango(r.fecha_inicio, r.fecha_fin);
        setDisponibles(disp);

        // cargar items de reserva existente
        const rf = await readReserva(r.id);
        const mapped = rf.items.map((it: any) => ({
          menaje_id: it.menaje_id,
          nombre: it.menaje?.nombre ?? "",
          unidad: it.menaje?.unidad ?? "unidad",
          cantidad: it.cantidad,
        }));
        setItems(mapped);
      } catch (err: any) {
        toast({ title: "Error", description: err.message ?? "No se pudo cargar menaje.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventoId, fechaEvento, toast]);

  const catalogForSelect = useMemo(() => {
    const taken = new Set(items.map((i) => i.menaje_id));
    return disponibles.filter((d) => !taken.has(d.id));
  }, [disponibles, items]);

  const disponibilidadById = useMemo(() => {
    const m = new Map<string, MenajeDisponible>();
    disponibles.forEach((d) => m.set(d.id, d));
    return m;
  }, [disponibles]);

  const handleAddItem = (menaje_id: string) => {
    const ref = disponibilidadById.get(menaje_id);
    if (!ref) return;
    setItems((prev) => [...prev, { menaje_id, nombre: ref.nombre, unidad: ref.unidad, cantidad: 1 }]);
  };

  const handleQty = (menaje_id: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.menaje_id === menaje_id ? { ...i, cantidad: Math.max(0, qty) } : i)));
  };

  const handleRemove = (menaje_id: string) => {
    setItems((prev) => prev.filter((i) => i.menaje_id !== menaje_id));
  };

  const overbookWarnings = items.filter((i) => {
    const ref = disponibilidadById.get(i.menaje_id);
    if (!ref) return false;
    return i.cantidad > ref.disponible + (getOriginalQty(i.menaje_id) ?? 0);
  });

  function getOriginalQty(menaje_id: string) {
    const rec = (reserva as any)?._baseline_items as Array<{ menaje_id: string; cantidad: number }> | undefined;
    if (!rec) return 0;
    return rec.find((x) => x.menaje_id === menaje_id)?.cantidad ?? 0;
  }

  const handleSave = async () => {
    if (!reserva) return;
    if (overbookWarnings.length > 0) {
      toast({
        title: "Sin disponibilidad",
        description: "Hay items que superan la disponibilidad para la fecha del evento.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      await saveReservaItems(
        reserva.id,
        items.filter((i) => i.cantidad > 0).map((i) => ({ menaje_id: i.menaje_id, cantidad: i.cantidad }))
      );
      toast({ title: "Reserva guardada", description: "El menaje quedó bloqueado para la fecha del evento." });
      const disp = await menajeDisponiblePorRango(reserva.fecha_inicio, reserva.fecha_fin);
      setDisponibles(disp);
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo guardar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEstado = async (estado: MenajeReserva["estado"]) => {
    if (!reserva) return;
    try {
      await setReservaEstado(reserva.id, estado);
      setReserva({ ...reserva, estado });
      toast({ title: "Estado actualizado", description: `Reserva en estado "${estado}".` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo actualizar.", variant: "destructive" });
    }
  };

  const getEstadoBadge = (estado: string) => {
    const configs = {
      borrador: { class: "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200", icon: <Clock className="h-3 w-3 mr-1" /> },
      confirmado: { class: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200", icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      devuelto: { class: "bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200", icon: <Package className="h-3 w-3 mr-1" /> }
    };
    
    const config = configs[estado as keyof typeof configs] || configs.borrador;
    return (
      <Badge className={`${config.class} shadow-sm font-semibold`}>
        {config.icon}
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
  };

  return (
    <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-orange-50/50 to-orange-100/50 backdrop-blur-sm border-b border-slate-200/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800">Gestión de Menaje</CardTitle>
          </div>
          {reserva && getEstadoBadge(reserva.estado)}
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Selector para añadir item premium */}
        <Card className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm border-slate-200/40 rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Select onValueChange={(v) => handleAddItem(v)}>
                <SelectTrigger className="flex-1 bg-white/90 border-slate-200/50 rounded-xl h-12 shadow-sm hover:shadow-md transition-all">
                  <SelectValue placeholder={loading ? "Cargando inventario..." : "Selecciona menaje para reservar"} />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl shadow-2xl">
                  {catalogForSelect.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      Sin items disponibles para esta fecha
                    </div>
                  ) : (
                    catalogForSelect.map((d) => (
                      <SelectItem key={d.id} value={d.id} className="rounded-xl">
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <div className="font-semibold">{d.nombre}</div>
                            <div className="text-xs text-slate-500">
                              Disponible: {d.disponible} de {d.stock_total} {d.unidad}
                            </div>
                          </div>
                          <Badge className={`ml-2 ${
                            d.disponible > 0 
                              ? "bg-green-50 text-green-700 border-green-200" 
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {d.disponible > 0 ? "Disponible" : "Agotado"}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                disabled 
                className="bg-white hover:bg-slate-50 border-slate-200 rounded-xl px-6 text-slate-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Añadir
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabla de reserva premium */}
        <Card className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-slate-50/80 to-slate-100/80 border-b border-slate-200/60">
                <TableHead className="font-bold text-slate-800">Item</TableHead>
                <TableHead className="font-bold text-slate-800">Unidad</TableHead>
               <TableHead className="text-center font-bold text-slate-800">Disponible</TableHead>
               <TableHead className="text-center font-bold text-slate-800">Cantidad</TableHead>
               <TableHead className="text-right font-bold text-slate-800">Acciones</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {items.length === 0 ? (
               <TableRow>
                 <TableCell colSpan={5} className="py-16 text-center">
                   <div className="w-20 h-20 bg-gradient-to-r from-orange-100 to-orange-200 rounded-3xl flex items-center justify-center mx-auto mb-4">
                     <UtensilsCrossed className="h-10 w-10 text-orange-400" />
                   </div>
                   <h3 className="text-lg font-bold text-slate-800 mb-2">Sin menaje reservado</h3>
                   <p className="text-sm text-slate-500">Comienza agregando items necesarios para el evento</p>
                 </TableCell>
               </TableRow>
             ) : (
               items.map((i, index) => {
                 const ref = disponibilidadById.get(i.menaje_id);
                 const disp = ref ? ref.disponible + (getOriginalQty(i.menaje_id) ?? 0) : 0;
                 const over = i.cantidad > disp;
                 return (
                   <TableRow 
                     key={i.menaje_id} 
                     className="hover:bg-gradient-to-r hover:from-slate-50/50 hover:to-slate-100/50 transition-all duration-200"
                     style={{ animationDelay: `${index * 100}ms` }}
                   >
                     <TableCell>
                       <div className="flex items-center space-x-3">
                         <div className="w-10 h-10 bg-gradient-to-r from-orange-100 to-orange-200 rounded-xl flex items-center justify-center shadow-sm">
                           <UtensilsCrossed className="h-5 w-5 text-orange-600" />
                         </div>
                         <span className="font-semibold text-slate-800">{i.nombre}</span>
                       </div>
                     </TableCell>
                     
                     <TableCell>
                       <Badge className="bg-slate-50 text-slate-700 border-slate-200 font-semibold">
                         {i.unidad}
                       </Badge>
                     </TableCell>
                     
                     <TableCell className="text-center">
                       {ref ? (
                         <div className="space-y-1">
                           <div className={`font-bold ${disp > 0 ? "text-green-700" : "text-red-700"}`}>
                             {disp}
                           </div>
                           <div className="text-xs text-slate-500">
                             ({ref.reservado} en otras reservas)
                           </div>
                         </div>
                       ) : (
                         <span className="text-slate-400">—</span>
                       )}
                     </TableCell>
                     
                     <TableCell className="text-center">
                       <div className="space-y-2">
                         <Input
                           type="number"
                           min={0}
                           className={`w-24 text-center mx-auto shadow-sm hover:shadow-md transition-all rounded-xl ${
                             over 
                               ? "border-red-300 bg-red-50 focus:ring-red-200 focus:border-red-400" 
                               : "bg-white/80 border-slate-200/50 focus:ring-selecta-green/20 focus:border-selecta-green"
                           }`}
                           value={i.cantidad}
                           onChange={(e) => handleQty(i.menaje_id, Number(e.target.value))}
                         />
                         {over && (
                           <div className="flex items-center justify-center space-x-1">
                             <AlertTriangle className="h-3 w-3 text-red-600" />
                             <span className="text-xs text-red-600 font-medium">Sin stock</span>
                           </div>
                         )}
                       </div>
                     </TableCell>
                     
                     <TableCell className="text-right">
                       <Button 
                         variant="ghost" 
                         size="sm" 
                         onClick={() => handleRemove(i.menaje_id)}
                         className="hover:bg-red-50 hover:text-red-700 rounded-xl transition-all duration-200 hover:scale-105"
                       >
                         Quitar
                       </Button>
                     </TableCell>
                   </TableRow>
                 );
               })
             )}
           </TableBody>
         </Table>
       </Card>

       {/* Estado y acciones premium */}
       <Card className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm border-slate-200/60 rounded-2xl shadow-lg">
         <CardContent className="p-6">
           <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
             <div className="flex items-center space-x-6">
               <div className="text-center">
                 <div className="text-2xl font-bold text-slate-700">{items.length}</div>
                 <div className="text-sm text-slate-600 font-semibold">Items Reservados</div>
               </div>
               
               <div className="w-px h-12 bg-slate-200"></div>
               
               <div className="flex items-center space-x-3">
                 <span className="text-sm font-semibold text-slate-700">Estado:</span>
                 {reserva && getEstadoBadge(reserva.estado)}
               </div>
             </div>
             
             <div className="flex flex-wrap items-center gap-3">
               <Button 
                 variant="outline" 
                 onClick={() => handleEstado("borrador")} 
                 disabled={!reserva || reserva.estado === "borrador"}
                 className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-200 hover:scale-105"
               >
                 <Clock className="h-4 w-4 mr-2" />
                 Borrador
               </Button>
               
               <Button 
                 variant="outline" 
                 onClick={() => handleEstado("confirmado")} 
                 disabled={!reserva || reserva.estado === "confirmado"}
                 className="bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-300 rounded-xl transition-all duration-200 hover:scale-105"
               >
                 <CheckCircle className="h-4 w-4 mr-2" />
                 Confirmar
               </Button>
               
               <Button 
                 variant="outline" 
                 onClick={() => handleEstado("devuelto")} 
                 disabled={!reserva || reserva.estado === "devuelto"}
                 className="bg-white hover:bg-green-50 border-slate-200 hover:border-green-300 rounded-xl transition-all duration-200 hover:scale-105"
               >
                 <Package className="h-4 w-4 mr-2" />
                 Devuelto
               </Button>
               
               <Button 
                 onClick={handleSave} 
                 disabled={saving || !reserva}
                 className="group bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-6 relative overflow-hidden"
               >
                 {saving ? (
                   <div className="flex items-center space-x-2">
                     <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     <span className="font-semibold">Guardando...</span>
                   </div>
                 ) : (
                   <div className="flex items-center space-x-2 relative z-10">
                     <Save className="h-4 w-4" />
                     <span className="font-semibold">Guardar Reserva</span>
                   </div>
                 )}
                 <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
               </Button>
             </div>
           </div>

           {/* Advertencias */}
           {overbookWarnings.length > 0 && (
             <div className="mt-4 p-4 bg-red-50/80 rounded-2xl border border-red-200/60">
               <div className="flex items-center space-x-3">
                 <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                 <div>
                   <p className="text-sm font-semibold text-red-800">Inventario insuficiente</p>
                   <p className="text-xs text-red-700">
                     {overbookWarnings.length} item(s) superan la disponibilidad. Ajuste las cantidades para continuar.
                   </p>
                 </div>
               </div>
             </div>
           )}
         </CardContent>
       </Card>
     </CardContent>
   </Card>
 );
}