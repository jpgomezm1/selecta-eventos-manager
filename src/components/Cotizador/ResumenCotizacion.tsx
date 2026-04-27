import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Trash2,
  Plus,
  Minus,
  Save,
  Calculator,
  Users,
  Utensils,
  Truck,
  ChefHat,
  Package,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  BarChart3,
  RotateCcw,
} from "lucide-react";
import type { CotizacionItemsState } from "@/types/cotizador";
import { cn } from "@/lib/utils";

type Props = {
  invitados: number;
  items: CotizacionItemsState;
  total: number;
  subtotales: { platos: number; personal: number; transportes: number; menaje: number };
  lugarCosto?: number;
  onQtyChange: (tipo: keyof CotizacionItemsState, id: string, qty: number) => void;
  onRemove: (tipo: keyof CotizacionItemsState, id: string) => void;
  /** Override manual del total. NULL/undefined = usar `total` calculado. */
  totalOverride?: number | null;
  /** Si está presente, el admin puede asignar/quitar el override desde la UI. */
  onTotalOverrideChange?: (value: number | null) => void;
  onGuardar: () => void;
  guardando: boolean;
  fullWidth?: boolean;
};

const SECTION_CONFIG = {
  platos: { icon: Utensils, label: "Platos y menú" },
  personal: { icon: ChefHat, label: "Personal de servicio" },
  transportes: { icon: Truck, label: "Logística y transporte" },
  menaje: { icon: Package, label: "Menaje y alquiler" },
};

type SectionItem = {
  tipo: keyof CotizacionItemsState;
  id: string;
  nombre: string;
  precio: number;
  cantidad: number;
  subtotal: number;
};

export function ResumenCotizacion({
  invitados,
  items,
  total,
  subtotales,
  lugarCosto = 0,
  onQtyChange,
  onRemove,
  totalOverride,
  onTotalOverrideChange,
  onGuardar,
  guardando,
  fullWidth = false,
}: Props) {
  const totalItems = items.platos.length + items.personal.length + items.transportes.length + (items.menaje ?? []).length;
  const totalQuantity = [
    ...items.platos.map(p => p.cantidad),
    ...items.personal.map(p => p.cantidad),
    ...items.transportes.map(t => t.cantidad),
    ...(items.menaje ?? []).map(m => m.cantidad)
  ].reduce((sum, qty) => sum + qty, 0);

  // El total efectivo es el override (si admin lo asignó) o el calculado.
  // La distribución de costos sigue mostrando los porcentajes contra el
  // calculado para que el desglose interno tenga sentido.
  const totalEfectivo = totalOverride != null ? totalOverride : total;
  const totalAjustado = totalOverride != null && totalOverride !== total;
  const canEditTotal = !!onTotalOverrideChange;

  const costPerGuest = invitados > 0 ? totalEfectivo / invitados : 0;
  const hasItems = totalItems > 0;

  const platosPercentage = total > 0 ? (subtotales.platos / total) * 100 : 0;
  const personalPercentage = total > 0 ? (subtotales.personal / total) * 100 : 0;
  const transportesPercentage = total > 0 ? (subtotales.transportes / total) * 100 : 0;
  const menajePercentage = total > 0 ? ((subtotales.menaje ?? 0) / total) * 100 : 0;
  const lugarPercentage = total > 0 ? (lugarCosto / total) * 100 : 0;

  const sections = [
    {
      key: "platos" as const,
      ...SECTION_CONFIG.platos,
      items: items.platos.map(p => ({
        tipo: "platos" as const,
        id: p.plato_id,
        nombre: p.nombre,
        precio: p.precio_unitario,
        cantidad: p.cantidad,
        subtotal: p.cantidad * p.precio_unitario
      })),
      subtotal: subtotales.platos,
      percentage: platosPercentage
    },
    {
      key: "personal" as const,
      ...SECTION_CONFIG.personal,
      items: items.personal.map(p => ({
        tipo: "personal" as const,
        id: p.personal_costo_id,
        nombre: p.rol,
        precio: p.tarifa_estimada_por_persona,
        cantidad: p.cantidad,
        subtotal: p.cantidad * p.tarifa_estimada_por_persona
      })),
      subtotal: subtotales.personal,
      percentage: personalPercentage
    },
    {
      key: "transportes" as const,
      ...SECTION_CONFIG.transportes,
      items: items.transportes.map(t => ({
        tipo: "transportes" as const,
        id: t.transporte_id,
        nombre: t.lugar,
        precio: t.tarifa_unitaria,
        cantidad: t.cantidad,
        subtotal: t.cantidad * t.tarifa_unitaria
      })),
      subtotal: subtotales.transportes,
      percentage: transportesPercentage
    },
    {
      key: "menaje" as const,
      ...SECTION_CONFIG.menaje,
      items: (items.menaje ?? []).map(m => ({
        tipo: "menaje" as const,
        id: m.menaje_id,
        nombre: m.nombre,
        precio: m.precio_alquiler,
        cantidad: m.cantidad,
        subtotal: m.cantidad * m.precio_alquiler
      })),
      subtotal: subtotales.menaje ?? 0,
      percentage: menajePercentage
    }
  ].filter(section => section.items.length > 0);

  const renderItemRow = (item: SectionItem) => (
    <div
      key={`${item.tipo}-${item.id}`}
      className="bg-card rounded-md p-4 border border-border hover:shadow-[var(--shadow-soft)] transition-all duration-200 flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium text-foreground break-words flex-1">
          {item.nombre}
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.tipo, item.id)}
          className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1 text-sm text-muted-foreground tabular-nums">
          <span>${item.precio.toLocaleString()}</span>
          <span>×</span>
          <span>{item.cantidad}</span>
        </div>

        <div className="flex items-center space-x-1 bg-muted/40 rounded-md p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQtyChange(item.tipo, item.id, Math.max(1, item.cantidad - 1))}
            className="h-7 w-7 p-0 hover:bg-card"
          >
            <Minus className="h-3 w-3" />
          </Button>

          <Input
            type="number"
            min={1}
            value={item.cantidad}
            onChange={(e) => onQtyChange(item.tipo, item.id, Math.max(1, Number(e.target.value)))}
            className="w-14 h-7 text-center text-sm border-0 bg-transparent focus:bg-card focus:border focus:border-border tabular-nums"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onQtyChange(item.tipo, item.id, item.cantidad + 1)}
            className="h-7 w-7 p-0 hover:bg-card"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="font-semibold text-right text-primary tabular-nums">
          ${item.subtotal.toLocaleString()}
        </div>
      </div>
    </div>
  );

  return (
    <Card className={cn(!fullWidth && "sticky top-4")}>
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Calculator className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <div>
              <CardTitle className="font-serif text-foreground text-lg">Resumen de cotización</CardTitle>
              <p className="text-muted-foreground text-sm">Detalles y totales</p>
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
          <div className="text-center py-12 space-y-4">
            <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" strokeWidth={1.5} />
            <div>
              <h3 className="font-serif text-lg text-foreground mb-1">Comienza tu cotización</h3>
              <p className="text-muted-foreground text-sm">
                Selecciona elementos desde las pestañas para ver el resumen aquí
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Distribución de costos */}
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
                {lugarCosto > 0 && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-foreground">Lugar del evento</span>
                        <span className="text-muted-foreground tabular-nums">{lugarPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={lugarPercentage} className="h-1.5" />
                    </div>
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      ${lugarCosto.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Elementos por sección */}
            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.key} className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/40">
                    <div className="flex items-center space-x-2">
                      <section.icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
                      <h4 className="font-semibold text-foreground">
                        {section.label}
                      </h4>
                      <Badge variant="outline" className="text-xs font-normal tabular-nums">
                        {section.items.length}
                      </Badge>
                    </div>

                    <div className="font-semibold text-primary tabular-nums">
                      ${section.subtotal.toLocaleString()}
                    </div>
                  </div>

                  <div className={cn(
                    "space-y-2",
                    fullWidth && "grid grid-cols-1 md:grid-cols-2 gap-3 space-y-0"
                  )}>
                    {section.items.map(item => renderItemRow(item))}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Total final */}
            <div className="space-y-4">
              <div className="rounded-md p-6 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="kicker text-muted-foreground">Total de la cotización</div>
                  {totalAjustado && (
                    <Badge
                      variant="outline"
                      className="border-[hsl(30_40%_70%)] bg-[hsl(30_50%_94%)] text-[10px] font-medium uppercase tracking-[0.12em] text-[hsl(30_55%_30%)]"
                    >
                      Total ajustado
                    </Badge>
                  )}
                </div>

                {canEditTotal ? (
                  <div className="mb-2 flex items-baseline gap-2">
                    <span
                      className={cn(
                        "font-serif font-semibold text-primary tabular-nums",
                        fullWidth ? "text-4xl" : "text-3xl"
                      )}
                    >
                      $
                    </span>
                    <TotalInput
                      value={totalEfectivo}
                      sugerido={total}
                      onCommit={(next) => {
                        // Si el admin escribe el mismo valor que el calculado,
                        // limpiamos el override (vuelve al automático).
                        onTotalOverrideChange?.(next === total ? null : next);
                      }}
                      bigText={fullWidth}
                    />
                    {totalAjustado && (
                      <button
                        type="button"
                        onClick={() => onTotalOverrideChange?.(null)}
                        className="ml-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
                        title={`Restaurar al total calculado $${total.toLocaleString()}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span className="line-through tabular-nums">
                          ${total.toLocaleString()}
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={cn(
                      "font-serif font-semibold text-primary tabular-nums mb-2",
                      fullWidth ? "text-4xl" : "text-3xl"
                    )}
                  >
                    ${totalEfectivo.toLocaleString()}
                    {totalAjustado && (
                      <span className="ml-3 text-[12px] font-normal text-muted-foreground">
                        sugerido <span className="line-through">${total.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {totalAjustado ? "Total manual" : "Cálculo en tiempo real"}
                  </span>
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
                      <span className="text-sm text-muted-foreground">
                        Cotización básica — considera agregar más elementos
                      </span>
                    </div>
                  )}

                  {total >= 50000 && total < 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-primary/5 rounded-md border border-primary/20">
                      <CheckCircle2 className="h-4 w-4 text-primary" strokeWidth={1.75} />
                      <span className="text-sm text-foreground">
                        Cotización completa — excelente propuesta
                      </span>
                    </div>
                  )}

                  {total >= 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-primary/10 rounded-md border border-primary/30">
                      <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.75} />
                      <span className="text-sm text-foreground">
                        Cotización premium — propuesta de alto valor
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Botón de guardar */}
        <Button
          className="w-full h-11 font-semibold"
          onClick={onGuardar}
          disabled={guardando || !hasItems}
        >
          {guardando ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
              <span>Guardando...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Save className="h-4 w-4" strokeWidth={1.75} />
              <span>Guardar cotización</span>
            </div>
          )}
        </Button>

      </CardContent>
    </Card>
  );
}

/**
 * Input controlado para el total override. Mantiene su propia copia editable
 * y solo propaga al padre en blur o Enter — evita re-renders mientras el
 * admin está escribiendo (que perderían el foco).
 */
function TotalInput({
  value,
  sugerido,
  onCommit,
  bigText,
}: {
  value: number;
  sugerido: number;
  onCommit: (next: number) => void;
  bigText: boolean;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(draft.replace(/[^\d.]/g, ""));
    if (Number.isFinite(parsed) && parsed >= 0 && parsed !== value) {
      onCommit(parsed);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder={String(sugerido)}
      className={cn(
        "h-auto w-auto min-w-[180px] flex-1 border-0 bg-transparent p-0 font-serif font-semibold tracking-tight text-primary tabular-nums focus-visible:ring-1 focus-visible:ring-primary/40",
        bigText ? "text-4xl" : "text-3xl"
      )}
      aria-label="Total de la cotización"
    />
  );
}
