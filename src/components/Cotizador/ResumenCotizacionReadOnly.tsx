import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Users,
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
  platos: { icon: Utensils, label: "Platos y menú" },
  personal: { icon: ChefHat, label: "Personal de servicio" },
  transportes: { icon: Truck, label: "Logística y transporte" },
  menaje: { icon: Package, label: "Menaje y alquiler" },
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
    <Card className="overflow-hidden">
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calculator className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <div>
              <CardTitle className="font-serif text-lg text-foreground">{versionName}</CardTitle>
              <p className="text-muted-foreground text-sm">Resumen de cotización</p>
            </div>
          </div>
          {hasItems && (
            <Badge variant="outline" className="font-normal tabular-nums">
              {totalItems} elementos
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="text-center p-3 bg-muted/40 rounded-md border border-border">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="font-semibold text-foreground tabular-nums">{invitados}</div>
            <div className="kicker text-muted-foreground">Invitados</div>
          </div>
          <div className="text-center p-3 bg-muted/40 rounded-md border border-border">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="font-semibold text-foreground tabular-nums">
              ${costPerGuest.toLocaleString()}
            </div>
            <div className="kicker text-muted-foreground">Por invitado</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {!hasItems ? (
          <div className="text-center py-12 space-y-3">
            <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">Versión sin elementos</h3>
              <p className="text-sm text-muted-foreground">
                Esta versión aún no tiene elementos asignados
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                  Distribución de costos
                </h4>
                <span className="text-sm text-muted-foreground tabular-nums">{totalQuantity} items</span>
              </div>
              <div className="space-y-2">
                {sections.map((section) => (
                  <div key={section.key} className="flex items-center gap-3">
                    <section.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-foreground">{section.label}</span>
                        <span className="text-muted-foreground tabular-nums">{section.percentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={section.percentage} className="h-1.5" />
                    </div>
                    <span className="text-sm font-semibold text-primary tabular-nums">
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
                  <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/40">
                    <div className="flex items-center space-x-2">
                      <section.icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
                      <h4 className="font-semibold text-foreground">{section.label}</h4>
                      <Badge variant="outline" className="text-xs font-normal tabular-nums">
                        {section.items.length}
                      </Badge>
                    </div>
                    <div className="font-semibold text-primary tabular-nums">
                      ${section.subtotal.toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <div
                        key={item.id}
                        className="bg-card rounded-md p-4 border border-border"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate mb-1">
                              {item.nombre}
                            </h4>
                            <div className="flex items-baseline gap-1 text-sm text-muted-foreground tabular-nums">
                              <span>${item.precio.toLocaleString()}</span>
                              <span>×</span>
                              <span>{item.cantidad}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-primary tabular-nums">
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
              <div className="rounded-md p-6 border border-border">
                <div className="kicker text-muted-foreground mb-2">Total de la cotización</div>
                <div className={cn(
                  "font-serif text-3xl font-semibold text-primary tabular-nums mb-2"
                )}>
                  ${total.toLocaleString()}
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Cotización aprobada</span>
                  <span className="tabular-nums">
                    {invitados > 0 && `$${costPerGuest.toLocaleString()} por invitado`}
                  </span>
                </div>
              </div>

              {total > 0 && (
                <div className="space-y-2">
                  {total < 50000 && (
                    <div className="flex items-center space-x-2 p-3 bg-muted/40 rounded-md border border-border">
                      <AlertCircle className="h-4 w-4 text-[hsl(30_55%_42%)]" strokeWidth={1.75} />
                      <span className="text-sm text-muted-foreground">Cotización básica</span>
                    </div>
                  )}
                  {total >= 50000 && total < 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-primary/5 rounded-md border border-primary/20">
                      <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.75} />
                      <span className="text-sm text-foreground">Cotización completa</span>
                    </div>
                  )}
                  {total >= 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-primary/10 rounded-md border border-primary/30">
                      <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.75} />
                      <span className="text-sm text-foreground">Cotización premium</span>
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
