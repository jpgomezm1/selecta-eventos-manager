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
  onChanged?: () => void;
};

export default function TransportePanel({ eventoId, onChanged }: Props) {
  const { toast } = useToast();
  const [orden, setOrden] = useState<TransporteOrden | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const o = await getOrCreateTransporteOrden(eventoId);
        setOrden(o);
      } catch (err) {
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

  const validarRangos = (o: TransporteOrden): string | null => {
    if (o.hora_recepcion_inicio && o.hora_recepcion_fin && o.hora_recepcion_inicio > o.hora_recepcion_fin) {
      return "La ventana de recepción tiene hora de fin anterior al inicio.";
    }
    if (o.hora_recogida_inicio && o.hora_recogida_fin && o.hora_recogida_inicio > o.hora_recogida_fin) {
      return "La ventana de recogida tiene hora de fin anterior al inicio.";
    }
    return null;
  };

  const validarCompletos = (o: TransporteOrden): string | null => {
    if (!o.pickup_nombre || !o.destino_direccion || !o.contacto_nombre) {
      return "Complete nombre de recogida, dirección del evento y contacto antes de programar o finalizar.";
    }
    return null;
  };

  const onSave = async (): Promise<TransporteOrden | null> => {
    if (!orden) return null;
    const errorRango = validarRangos(orden);
    if (errorRango) {
      toast({ title: "Horario inválido", description: errorRango, variant: "destructive" });
      return null;
    }
    setSaving(true);
    try {
      const saved = await saveTransporteOrden(orden);
      setOrden(saved);
      toast({ title: "Orden de transporte guardada" });
      onChanged?.();
      return saved;
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const onEstado = async (estado: TransporteOrden["estado"]) => {
    if (!orden?.id) return;
    if (estado === "cancelado") {
      try {
        const updated = await setTransporteOrdenEstado(orden.id, estado);
        setOrden(updated);
        onChanged?.();
        toast({ title: "Orden cancelada" });
      } catch (err) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
      return;
    }
    if (estado === "programado" || estado === "finalizado") {
      const errorCompletos = validarCompletos(orden);
      if (errorCompletos) {
        toast({ title: "Información incompleta", description: errorCompletos, variant: "destructive" });
        return;
      }
      const errorRango = validarRangos(orden);
      if (errorRango) {
        toast({ title: "Horario inválido", description: errorRango, variant: "destructive" });
        return;
      }
    }
    try {
      const saved = await saveTransporteOrden(orden);
      const updated = await setTransporteOrdenEstado(saved.id!, estado);
      setOrden(updated);
      onChanged?.();
      toast({ title: "Estado actualizado", description: `Orden ${estado}` });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCancelarClick = () => {
    if (!orden) return;
    if (window.confirm("¿Cancelar esta orden de transporte? Se puede revertir cambiando el estado a borrador.")) {
      onEstado("cancelado");
    }
  };

  const estadoBadge = (estado: string) => {
    const variantMap: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      borrador: "outline",
      programado: "secondary",
      finalizado: "default",
      cancelado: "destructive",
    };
    return (
      <Badge variant={variantMap[estado] ?? "outline"} className="font-normal">
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
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            <h2 className="font-semibold text-foreground">Logística y transporte</h2>
          </div>
          {estadoBadge(orden.estado)}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Pickup */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <h3 className="font-medium text-foreground">Punto de recogida</h3>
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

        {/* Destination + Time ranges */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <h3 className="font-medium text-foreground">Destino y horarios</h3>
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

            {/* Ventana de recepción */}
            <div>
              <label className="text-sm text-slate-600 mb-1 block flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Ventana de recepción
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <span className="text-xs text-slate-400">Desde</span>
                  <Input
                    type="time"
                    value={orden.hora_recepcion_inicio ?? ""}
                    onChange={(e) => onChange({ hora_recepcion_inicio: e.target.value })}
                  />
                </div>
                <span className="text-slate-400 mt-4">—</span>
                <div className="flex-1">
                  <span className="text-xs text-slate-400">Hasta</span>
                  <Input
                    type="time"
                    value={orden.hora_recepcion_fin ?? ""}
                    onChange={(e) => onChange({ hora_recepcion_fin: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Ventana de recogida */}
            <div>
              <label className="text-sm text-slate-600 mb-1 block flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Ventana de recogida
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <span className="text-xs text-slate-400">Desde</span>
                  <Input
                    type="time"
                    value={orden.hora_recogida_inicio ?? ""}
                    onChange={(e) => onChange({ hora_recogida_inicio: e.target.value })}
                  />
                </div>
                <span className="text-slate-400 mt-4">—</span>
                <div className="flex-1">
                  <span className="text-xs text-slate-400">Hasta</span>
                  <Input
                    type="time"
                    value={orden.hora_recogida_fin ?? ""}
                    onChange={(e) => onChange({ hora_recogida_fin: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <h3 className="font-medium text-foreground">Contacto y vehículo</h3>
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
              {(orden.estado === "borrador" || orden.estado === "programado") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelarClick}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>

          {(!orden.pickup_nombre || !orden.destino_direccion || !orden.contacto_nombre) && (
            <div className="mt-3 p-3 bg-muted/40 rounded-md border border-border flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-[hsl(30_55%_42%)] flex-shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-medium text-foreground">Información incompleta</p>
                <p className="text-xs text-muted-foreground">Complete los campos para una mejor coordinación.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
