import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Truck, MapPin, Clock, User, Phone, FileText, Save, CheckCircle, AlertTriangle } from "lucide-react";
import { getOrCreateTransporteOrden, saveTransporteOrden, setTransporteOrdenEstado } from "@/integrations/supabase/apiTransporte";
import type { TransporteOrden } from "@/types/transporte";

type Props = {
  eventoId: string;
};

export default function TransportePanel({ eventoId }: Props) {
  const { toast } = useToast();
  const [orden, setOrden] = useState<TransporteOrden | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const o = await getOrCreateTransporteOrden(eventoId);
        setOrden(o);
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventoId, toast]);

  const onChange = (patch: Partial<TransporteOrden>) => {
    if (!orden) return;
    setOrden({ ...orden, ...patch });
  };

  const onSave = async () => {
    if (!orden) return;
    setSaving(true);
    try {
      const saved = await saveTransporteOrden(orden);
      setOrden(saved);
      toast({ title: "Orden de transporte guardada" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const onEstado = async (estado: TransporteOrden["estado"]) => {
    if (!orden?.id) return;
    try {
      const updated = await setTransporteOrdenEstado(orden.id, estado);
      setOrden(updated);
      toast({ title: "Estado actualizado", description: `Orden ${estado}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getEstadoBadge = (estado: string) => {
    const configs = {
      borrador: { class: "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200", icon: <FileText className="h-3 w-3 mr-1" /> },
      programado: { class: "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200", icon: <Clock className="h-3 w-3 mr-1" /> },
      finalizado: { class: "bg-gradient-to-r from-green-50 to-green-100 text-green-700 border-green-200", icon: <CheckCircle className="h-3 w-3 mr-1" /> }
    };
    
    const config = configs[estado as keyof typeof configs] || configs.borrador;
    return (
      <Badge className={`${config.class} shadow-sm font-semibold`}>
        {config.icon}
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl animate-pulse">
            <Truck className="h-8 w-8 text-white" />
          </div>
          <p className="text-slate-600 font-medium">Cargando orden de transporte...</p>
        </CardContent>
      </Card>
    );
  }

  if (!orden) return null;

  return (
    <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-green-50/50 to-green-100/50 backdrop-blur-sm border-b border-slate-200/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800">Logística y Transporte</CardTitle>
          </div>
          {getEstadoBadge(orden.estado)}
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-8">
        {/* Información de Recogida */}
        <Card className="bg-gradient-to-r from-blue-50/80 to-blue-100/80 backdrop-blur-sm border-blue-200/60 rounded-2xl shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-bold text-blue-800">Punto de Recogida</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="group">
              <label className="text-sm font-semibold text-blue-700 mb-2 block">Nombre del lugar</label>
              <Input
                placeholder="Ej: Bodega principal / Proveedor ABC"
                value={orden.pickup_nombre ?? ""}
                onChange={(e) => onChange({ pickup_nombre: e.target.value })}
                className="bg-white/90 border-blue-200/50 rounded-xl h-12 focus:ring-2 focus:ring-blue-300/20 focus:border-blue-400 shadow-sm hover:shadow-md transition-all group-hover:border-blue-300"
              />
            </div>
            <div className="group">
              <label className="text-sm font-semibold text-blue-700 mb-2 block">Dirección de recogida</label>
              <Input
                placeholder="Dirección completa de la bodega o proveedor"
                value={orden.pickup_direccion ?? ""}
                onChange={(e) => onChange({ pickup_direccion: e.target.value })}
                className="bg-white/90 border-blue-200/50 rounded-xl h-12 focus:ring-2 focus:ring-blue-300/20 focus:border-blue-400 shadow-sm hover:shadow-md transition-all group-hover:border-blue-300"
              />
            </div>
            <div className="group">
              <label className="text-sm font-semibold text-blue-700 mb-2 block">Descripción de la carga</label>
              <Textarea
                placeholder="Ej: menaje, decoración, equipos de sonido, mobiliario, etc."
                value={orden.descripcion_carga ?? ""}
                onChange={(e) => onChange({ descripcion_carga: e.target.value })}
                rows={3}
                className="bg-white/90 border-blue-200/50 rounded-xl focus:ring-2 focus:ring-blue-300/20 focus:border-blue-400 shadow-sm hover:shadow-md transition-all group-hover:border-blue-300 resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Información del Destino */}
        <Card className="bg-gradient-to-r from-green-50/80 to-green-100/80 backdrop-blur-sm border-green-200/60 rounded-2xl shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-bold text-green-800">Destino y Horarios</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="group">
              <label className="text-sm font-semibold text-green-700 mb-2 block">Dirección del evento</label>
              <Input
                placeholder="Dirección completa del lugar del evento"
                value={orden.destino_direccion ?? ""}
                onChange={(e) => onChange({ destino_direccion: e.target.value })}
                className="bg-white/90 border-green-200/50 rounded-xl h-12 focus:ring-2 focus:ring-green-300/20 focus:border-green-400 shadow-sm hover:shadow-md transition-all group-hover:border-green-300"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="group">
                <label className="text-sm font-semibold text-green-700 mb-2 block flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>Hora de descarga</span>
                </label>
                <Input
                  type="time"
                  value={orden.hora_descarga ?? ""}
                  onChange={(e) => onChange({ hora_descarga: e.target.value })}
                  className="bg-white/90 border-green-200/50 rounded-xl h-12 focus:ring-2 focus:ring-green-300/20 focus:border-green-400 shadow-sm hover:shadow-md transition-all group-hover:border-green-300"
                />
              </div>
              <div className="group">
                <label className="text-sm font-semibold text-green-700 mb-2 block flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>Hora de recogida</span>
                </label>
                <Input
                  type="time"
                  value={orden.hora_recogida ?? ""}
                  onChange={(e) => onChange({ hora_recogida: e.target.value })}
                  className="bg-white/90 border-green-200/50 rounded-xl h-12 focus:ring-2 focus:ring-green-300/20 focus:border-green-400 shadow-sm hover:shadow-md transition-all group-hover:border-green-300"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información de Contacto y Vehículo */}
        <Card className="bg-gradient-to-r from-purple-50/80 to-purple-100/80 backdrop-blur-sm border-purple-200/60 rounded-2xl shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-purple-600" />
              <h3 className="text-lg font-bold text-purple-800">Contacto y Vehículo</h3>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="group">
                <label className="text-sm font-semibold text-purple-700 mb-2 block flex items-center space-x-1">
                  <User className="h-4 w-4" />
                  <span>Nombre del contacto</span>
                </label>
                <Input
                  placeholder="Nombre del responsable del transporte"
                  value={orden.contacto_nombre ?? ""}
                  onChange={(e) => onChange({ contacto_nombre: e.target.value })}
                  className="bg-white/90 border-purple-200/50 rounded-xl h-12 focus:ring-2 focus:ring-purple-300/20 focus:border-purple-400 shadow-sm hover:shadow-md transition-all group-hover:border-purple-300"
                />
              </div>
              <div className="group">
                <label className="text-sm font-semibold text-purple-700 mb-2 block flex items-center space-x-1">
                  <Phone className="h-4 w-4" />
                  <span>Teléfono</span>
                </label>
                <Input
                  placeholder="Número de contacto"
                  value={orden.contacto_telefono ?? ""}
                  onChange={(e) => onChange({ contacto_telefono: e.target.value })}
                  className="bg-white/90 border-purple-200/50 rounded-xl h-12 focus:ring-2 focus:ring-purple-300/20 focus:border-purple-400 shadow-sm hover:shadow-md transition-all group-hover:border-purple-300"
                />
              </div>
            </div>
            <div className="group">
              <label className="text-sm font-semibold text-purple-700 mb-2 block flex items-center space-x-1">
                <Truck className="h-4 w-4" />
                <span>Información del vehículo</span>
              </label>
              <Input
                placeholder="Tipo de vehículo, placa o características específicas"
                value={orden.vehiculo ?? ""}
                onChange={(e) => onChange({ vehiculo: e.target.value })}
                className="bg-white/90 border-purple-200/50 rounded-xl h-12 focus:ring-2 focus:ring-purple-300/20 focus:border-purple-400 shadow-sm hover:shadow-md transition-all group-hover:border-purple-300"
              />
            </div>
            <div className="group">
              <label className="text-sm font-semibold text-purple-700 mb-2 block flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span>Notas adicionales</span>
              </label>
              <Textarea
                placeholder="Instrucciones especiales, restricciones, horarios preferenciales, etc."
                value={orden.notas ?? ""}
                onChange={(e) => onChange({ notas: e.target.value })}
                rows={3}
                className="bg-white/90 border-purple-200/50 rounded-xl focus:ring-2 focus:ring-purple-300/20 focus:border-purple-400 shadow-sm hover:shadow-md transition-all group-hover:border-purple-300 resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Controles de estado y guardado */}
        <Card className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm border-slate-200/60 rounded-2xl shadow-lg">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className="text-sm text-slate-600 font-semibold">Estado Actual</div>
                  <div className="mt-1">{getEstadoBadge(orden.estado)}</div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => onEstado("borrador")} 
                  disabled={orden.estado === "borrador"}
                  className="bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Borrador
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => onEstado("programado")} 
                  disabled={orden.estado === "programado"}
                  className="bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-300 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Programar
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => onEstado("finalizado")} 
                  disabled={orden.estado === "finalizado"}
                  className="bg-white hover:bg-green-50 border-slate-200 hover:border-green-300 rounded-xl transition-all duration-200 hover:scale-105"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Finalizar
                </Button>
                
                <Button 
                  onClick={onSave} 
                  disabled={saving}
                  className="group bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-6 relative overflow-hidden"
                >
                  {saving ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="font-semibold">Guardando...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 relative z-10">
                      <Save className="h-4 w-4" />
                      <span className="font-semibold">Guardar Orden</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </Button>
              </div>
            </div>

            {/* Información de completitud */}
            {(!orden.pickup_nombre || !orden.destino_direccion || !orden.contacto_nombre) && (
              <div className="mt-4 p-4 bg-orange-50/80 rounded-2xl border border-orange-200/60">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-orange-800">Información incompleta</p>
                    <p className="text-xs text-orange-700">
                      Complete los campos obligatorios para una mejor coordinación del transporte.
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