import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Users, ShoppingCart, UtensilsCrossed, CheckCircle, Clock } from "lucide-react";

type Props = {
  eventoId: string;
  totalRequerimiento: number;
  estadoLiquidacion: string;
};

interface CierreData {
  costoPersonal: number;
  costoCompras: number;
  costoMenaje: number;
  menajeDevuelto: boolean;
  personalLiquidado: boolean;
}

export default function CierreEventoPanel({ eventoId, totalRequerimiento, estadoLiquidacion }: Props) {
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

        const costoPersonal = (personal ?? []).reduce((a: number, r: any) => a + (Number(r.pago_calculado) || 0), 0);
        const costoCompras = orden ? Number(orden.total_estimado) : 0;
        const costoMenaje = (reqMenaje ?? []).reduce((a: number, r: any) => a + (Number(r.subtotal) || 0), 0);

        setData({
          costoPersonal,
          costoCompras,
          costoMenaje,
          menajeDevuelto: reserva?.estado === "devuelto",
          personalLiquidado: estadoLiquidacion === "liquidado",
        });
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [eventoId, estadoLiquidacion]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
      </div>
    );
  }

  const costoReal = data.costoPersonal + data.costoCompras + data.costoMenaje;
  const diferencia = totalRequerimiento - costoReal;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500 mb-1">Presupuesto Cotizado</p>
          <p className="text-xl font-semibold text-slate-900">${totalRequerimiento.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 mb-1">Costo Real</p>
          <p className="text-xl font-semibold text-slate-900">${costoReal.toLocaleString()}</p>
        </Card>
        <Card className={`p-4 ${diferencia >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
          <p className="text-xs text-slate-500 mb-1">Diferencia</p>
          <p className={`text-xl font-semibold ${diferencia >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {diferencia >= 0 ? "+" : ""}${diferencia.toLocaleString()}
          </p>
        </Card>
      </div>

      {/* Breakdown */}
      <Card className="p-4">
        <h4 className="text-sm font-medium text-slate-900 mb-3">Desglose de Costos</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users className="h-4 w-4 text-blue-500" />
              <span>Personal (pagos)</span>
            </div>
            <span className="text-sm font-medium text-slate-900">${data.costoPersonal.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShoppingCart className="h-4 w-4 text-orange-500" />
              <span>Compras (orden)</span>
            </div>
            <span className="text-sm font-medium text-slate-900">${data.costoCompras.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <UtensilsCrossed className="h-4 w-4 text-purple-500" />
              <span>Menaje (alquiler)</span>
            </div>
            <span className="text-sm font-medium text-slate-900">${data.costoMenaje.toLocaleString()}</span>
          </div>
        </div>
      </Card>

      {/* Closure status */}
      <Card className="p-4">
        <h4 className="text-sm font-medium text-slate-900 mb-3">Estado de Cierre</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Menaje devuelto</span>
            {data.menajeDevuelto ? (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Devuelto
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-orange-50 text-orange-700">
                <Clock className="h-3 w-3 mr-1" />
                Pendiente
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Personal liquidado</span>
            {data.personalLiquidado ? (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                <CheckCircle className="h-3 w-3 mr-1" />
                Liquidado
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-orange-50 text-orange-700">
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
