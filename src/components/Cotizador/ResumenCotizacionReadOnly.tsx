import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  DollarSign,
  Sparkles,
  Calculator,
  TrendingUp,
  BarChart3,
  Utensils,
  ChefHat,
  Truck,
  Package,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CotizacionItemsState } from "@/types/cotizador";

const SECTION_CONFIG = {
  platos: {
    icon: Utensils,
    color: "orange",
    label: "Platos y Menú",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200",
  },
  personal: {
    icon: ChefHat,
    color: "blue",
    label: "Personal de Servicio",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
  },
  transportes: {
    icon: Truck,
    color: "green",
    label: "Logística y Transporte",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
  menaje: {
    icon: Package,
    color: "purple",
    label: "Menaje y Alquiler",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
  },
};

type Props = {
  invitados: number;
  items: CotizacionItemsState;
  total: number;
  subtotales: { platos: number; personal: number; transportes: number; menaje: number };
  versionName: string;
};

export function ResumenCotizacionReadOnly({
  invitados,
  items,
  total,
  subtotales,
  versionName,
}: Props) {
  const totalItems =
    items.platos.length +
    items.personal.length +
    items.transportes.length +
    (items.menaje ?? []).length;
  const totalQuantity = [
    ...items.platos.map((p) => p.cantidad),
    ...items.personal.map((p) => p.cantidad),
    ...items.transportes.map((t) => t.cantidad),
    ...(items.menaje ?? []).map((m) => m.cantidad),
  ].reduce((sum, qty) => sum + qty, 0);

  const costPerGuest = invitados > 0 ? total / invitados : 0;
  const hasItems = totalItems > 0;

  // Los % representan distribución dentro de los items (platos/personal/transportes/menaje).
  // Usar `total` como denominador los deja sub-100% porque `total` incluye el costo del lugar,
  // que no es una categoría de item. Denominador: suma de items solamente.
  const itemsTotal =
    subtotales.platos + subtotales.personal + subtotales.transportes + (subtotales.menaje ?? 0);
  const platosPercentage = itemsTotal > 0 ? (subtotales.platos / itemsTotal) * 100 : 0;
  const personalPercentage = itemsTotal > 0 ? (subtotales.personal / itemsTotal) * 100 : 0;
  const transportesPercentage = itemsTotal > 0 ? (subtotales.transportes / itemsTotal) * 100 : 0;
  const menajePercentage = itemsTotal > 0 ? ((subtotales.menaje ?? 0) / itemsTotal) * 100 : 0;

  const sections = [
    {
      key: "platos" as const,
      ...SECTION_CONFIG.platos,
      items: items.platos.map((p) => ({
        id: p.plato_id,
        nombre: p.nombre,
        precio: p.precio_unitario,
        cantidad: p.cantidad,
        subtotal: p.cantidad * p.precio_unitario,
      })),
      subtotal: subtotales.platos,
      percentage: platosPercentage,
    },
    {
      key: "personal" as const,
      ...SECTION_CONFIG.personal,
      items: items.personal.map((p) => ({
        id: p.personal_costo_id,
        nombre: p.rol,
        precio: p.tarifa_estimada_por_persona,
        cantidad: p.cantidad,
        subtotal: p.cantidad * p.tarifa_estimada_por_persona,
      })),
      subtotal: subtotales.personal,
      percentage: personalPercentage,
    },
    {
      key: "transportes" as const,
      ...SECTION_CONFIG.transportes,
      items: items.transportes.map((t) => ({
        id: t.transporte_id,
        nombre: t.lugar,
        precio: t.tarifa_unitaria,
        cantidad: t.cantidad,
        subtotal: t.cantidad * t.tarifa_unitaria,
      })),
      subtotal: subtotales.transportes,
      percentage: transportesPercentage,
    },
    {
      key: "menaje" as const,
      ...SECTION_CONFIG.menaje,
      items: (items.menaje ?? []).map((m) => ({
        id: m.menaje_id,
        nombre: m.nombre,
        precio: m.precio_alquiler,
        cantidad: m.cantidad,
        subtotal: m.cantidad * m.precio_alquiler,
      })),
      subtotal: subtotales.menaje ?? 0,
      percentage: menajePercentage,
    },
  ].filter((section) => section.items.length > 0);

  return (
    <Card className="shadow-xl border-slate-200 overflow-hidden">
      <CardHeader className="bg-emerald-50 border-b border-emerald-200 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500 rounded-xl">
              <Calculator className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-emerald-800 text-lg">{versionName}</CardTitle>
              <p className="text-emerald-600 text-sm">Resumen de cotización</p>
            </div>
          </div>
          {hasItems && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {totalItems} elementos
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="text-center p-3 bg-white/60 rounded-xl">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="font-semibold text-emerald-800">{invitados}</div>
            <div className="text-xs text-emerald-600">Invitados</div>
          </div>
          <div className="text-center p-3 bg-white/60 rounded-xl">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="font-semibold text-emerald-800">
              ${costPerGuest.toLocaleString()}
            </div>
            <div className="text-xs text-emerald-600">Por invitado</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {!hasItems ? (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <h3 className="font-medium text-slate-700 mb-2">Versión sin elementos</h3>
              <p className="text-slate-500 text-sm">
                Esta versión aún no tiene elementos asignados
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Distribución de Costos
                </h4>
                <span className="text-sm text-slate-600">{totalQuantity} items</span>
              </div>
              <div className="space-y-2">
                {sections.map((section) => (
                  <div key={section.key} className="flex items-center gap-3">
                    <section.icon className={cn("h-4 w-4", section.textColor)} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-slate-700">{section.label}</span>
                        <span className="text-slate-600">{section.percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={section.percentage} className="h-2" />
                    </div>
                    <span className={cn("text-sm font-semibold", section.textColor)}>
                      ${section.subtotal.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.key} className="space-y-3">
                  <div
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border",
                      section.bgColor,
                      section.borderColor
                    )}
                  >
                    <div className="flex items-center space-x-2">
                      <section.icon className={cn("h-5 w-5", section.textColor)} />
                      <h4 className={cn("font-semibold", section.textColor)}>
                        {section.label}
                      </h4>
                      <Badge
                        className={cn(
                          "text-xs",
                          `bg-${section.color}-100 text-${section.color}-700 border-${section.color}-200`
                        )}
                      >
                        {section.items.length}
                      </Badge>
                    </div>
                    <div className={cn("font-bold", section.textColor)}>
                      ${section.subtotal.toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white rounded-xl p-4 border border-slate-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-slate-800 truncate mb-1">
                              {item.nombre}
                            </h4>
                            <div className="flex items-center space-x-2 text-sm text-slate-600">
                              <DollarSign className="h-3 w-3" />
                              <span>{item.precio.toLocaleString()}</span>
                              <span>&times;</span>
                              <span>{item.cantidad}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={cn("font-semibold", section.textColor)}>
                              ${item.subtotal.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                    <span className="text-slate-600 font-medium">
                      Total de la Cotización
                    </span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-emerald-600 mb-2">
                  ${total.toLocaleString()}
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Cotización aprobada</span>
                  <span>
                    {invitados > 0 && `$${costPerGuest.toLocaleString()} por invitado`}
                  </span>
                </div>
              </div>

              {total > 0 && (
                <div className="space-y-2">
                  {total < 50000 && (
                    <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700 text-sm">Cotización básica</span>
                    </div>
                  )}
                  {total >= 50000 && total < 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-blue-700 text-sm">Cotización completa</span>
                    </div>
                  )}
                  {total >= 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="text-purple-700 text-sm">Cotización premium</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
