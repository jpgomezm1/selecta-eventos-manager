import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
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

  const estadoBadge = (estado: string) => {
    const map: Record<string, string> = {
      borrador: "bg-slate-100 text-slate-700",
      programado: "bg-blue-50 text-blue-700",
      finalizado: "bg-emerald-50 text-emerald-700",
    };
    return (
      <Badge variant="secondary" className={map[estado] ?? map.borrador}>
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  if (!orden) return null;

  return (
    <Card>
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-slate-600" />
            <h2 className="font-semibold text-slate-900">Logística y Transporte</h2>
          </div>
          {estadoBadge(orden.estado)}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Pickup */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-blue-600" />
            <h3 className="font-medium text-slate-900">Punto de Recogida</h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Nombre del lugar</label>
              <Input
                placeholder="Ej: Bodega principal"
                value={orden.pickup_nombre ?? ""}
                onChange={(e) => onChange({ pickup_nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Dirección</label>
              <Input
                placeholder="Dirección completa"
                value={orden.pickup_direccion ?? ""}
                onChange={(e) => onChange({ pickup_direccion: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Descripción de la carga</label>
              <Textarea
                placeholder="Ej: menaje, decoración, equipos"
                value={orden.descripcion_carga ?? ""}
                onChange={(e) => onChange({ descripcion_carga: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-emerald-600" />
            <h3 className="font-medium text-slate-900">Destino y Horarios</h3>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Dirección del evento</label>
              <Input
                placeholder="Dirección completa del evento"
                value={orden.destino_direccion ?? ""}
                onChange={(e) => onChange({ destino_direccion: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Hora descarga</label>
                <Input
                  type="time"
                  value={orden.hora_descarga ?? ""}
                  onChange={(e) => onChange({ hora_descarga: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 mb-1 block">Hora recogida</label>
                <Input
                  type="time"
                  value={orden.hora_recogida ?? ""}
                  onChange={(e) => onChange({ hora_recogida: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-purple-600" />
            <h3 className="font-medium text-slate-900">Contacto y Vehículo</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Nombre contacto</label>
              <Input
                placeholder="Responsable del transporte"
                value={orden.contacto_nombre ?? ""}
                onChange={(e) => onChange({ contacto_nombre: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 mb-1 block">Teléfono</label>
              <Input
                placeholder="Número de contacto"
                value={orden.contacto_telefono ?? ""}
                onChange={(e) => onChange({ contacto_telefono: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Vehículo</label>
            <Input
              placeholder="Tipo, placa, características"
              value={orden.vehiculo ?? ""}
              onChange={(e) => onChange({ vehiculo: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Notas</label>
            <Textarea
              placeholder="Instrucciones especiales"
              value={orden.notas ?? ""}
              onChange={(e) => onChange({ notas: e.target.value })}
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="bg-slate-50 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Estado:</span>
              {estadoBadge(orden.estado)}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onEstado("borrador")} disabled={orden.estado === "borrador"}>
                <FileText className="h-3.5 w-3.5 mr-1" /> Borrador
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEstado("programado")} disabled={orden.estado === "programado"}>
                <Clock className="h-3.5 w-3.5 mr-1" /> Programar
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEstado("finalizado")} disabled={orden.estado === "finalizado"}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Finalizar
              </Button>
              <Button onClick={onSave} disabled={saving} size="sm">
                {saving ? "Guardando..." : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1" /> Guardar Orden
                  </>
                )}
              </Button>
            </div>
          </div>

          {(!orden.pickup_nombre || !orden.destino_direccion || !orden.contacto_nombre) && (
            <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">Información incompleta</p>
                <p className="text-xs text-orange-700">Complete los campos para una mejor coordinación.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
