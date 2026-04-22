import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Users, ShoppingCart, UtensilsCrossed, CheckCircle, Clock, Building2 } from "lucide-react";

type Props = {
  eventoId: string;
  totalRequerimiento: number;
  estadoLiquidacion: string;
  costoLugar?: number;
};

interface CierreData {
  costoPersonal: number;
  costoCompras: number;
  costoMenaje: number;
  menajeDevuelto: boolean;
  personalLiquidado: boolean;
}

export default function CierreEventoPanel({ eventoId, totalRequerimiento, estadoLiquidacion, costoLugar = 0 }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<CierreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: personal }, { data: orden }, { data: reserva }, { data: reqMenaje }] = await Promise.all([
          supabase
            .from("evento_personal")
            .select("pago_calculado")
            .eq("evento_id", eventoId),
          supabase
            .from("evento_orden_compra")
            .select("total_estimado, estado")
            .eq("evento_id", eventoId)
            .neq("estado", "cancelada")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("menaje_reservas")
            .select("estado")
            .eq("evento_id", eventoId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("evento_requerimiento_menaje")
            .select("subtotal")
            .eq("evento_id", eventoId),
        ]);

        const costoPersonal = (personal ?? []).reduce((a: number, r) => a + (Number(r.pago_calculado) || 0), 0);
        const costoCompras = orden ? Number(orden.total_estimado) : 0;
        const costoMenaje = (reqMenaje ?? []).reduce((a: number, r) => a + (Number(r.subtotal) || 0), 0);

        setData({
          costoPersonal,
          costoCompras,
          costoMenaje,
          menajeDevuelto: reserva?.estado === "devuelto",
          personalLiquidado: estadoLiquidacion === "liquidado",
        });
      } catch (err) {
        toast({
          title: "Error al cargar cierre",
          description: err?.message ?? "No se pudieron obtener los costos del evento.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventoId, estadoLiquidacion, toast]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  const costoReal = data.costoPersonal + data.costoCompras + data.costoMenaje + costoLugar;
  const diferencia = totalRequerimiento - costoReal;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="kicker text-muted-foreground mb-1">Presupuesto cotizado</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">${totalRequerimiento.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="kicker text-muted-foreground mb-1">Costo real</p>
          <p className="text-xl font-semibold text-foreground tabular-nums">${costoReal.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="kicker text-muted-foreground mb-1">Diferencia</p>
          <p className={`text-xl font-semibold tabular-nums ${diferencia >= 0 ? "text-primary" : "text-destructive"}`}>
            {diferencia >= 0 ? "+" : ""}${diferencia.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Breakdown */}
      <Card className="p-4">
        <h4 className="kicker text-muted-foreground mb-3">Desglose de costos</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              <span>Personal (pagos)</span>
            </div>
            <span className="text-sm font-medium tabular-nums">${data.costoPersonal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              <span>Compras (orden)</span>
            </div>
            <span className="text-sm font-medium tabular-nums">${data.costoCompras.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <UtensilsCrossed className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              <span>Menaje (alquiler)</span>
            </div>
            <span className="text-sm font-medium tabular-nums">${data.costoMenaje.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              <span>Salón / Lugar</span>
            </div>
            <span className="text-sm font-medium tabular-nums">${costoLugar.toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {/* Closure status */}
      <Card className="p-4">
        <h4 className="kicker text-muted-foreground mb-3">Estado de cierre</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Menaje devuelto</span>
            {data.menajeDevuelto ? (
              <Badge variant="default" className="font-normal">
                <CheckCircle className="h-3 w-3 mr-1" />
                Devuelto
              </Badge>
            ) : (
              <Badge variant="outline" className="font-normal text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]">
                <Clock className="h-3 w-3 mr-1" />
                Pendiente
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Personal liquidado</span>
            {data.personalLiquidado ? (
              <Badge variant="default" className="font-normal">
                <CheckCircle className="h-3 w-3 mr-1" />
                Liquidado
              </Badge>
            ) : (
              <Badge variant="outline" className="font-normal text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]">
                <Clock className="h-3 w-3 mr-1" />
                Pendiente
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
