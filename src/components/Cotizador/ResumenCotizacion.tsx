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
  DollarSign,
  Utensils,
  Truck,
  ChefHat,
  Package,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Eye,
  EyeOff,
  BarChart3
} from "lucide-react";
import type { CotizacionItemsState } from "@/types/cotizador";
import { cn } from "@/lib/utils";

type Props = {
  invitados: number;
  items: CotizacionItemsState;
  total: number;
  subtotales: { platos: number; personal: number; transportes: number; menaje: number };
  onQtyChange: (tipo: keyof CotizacionItemsState, id: string, qty: number) => void;
  onRemove: (tipo: keyof CotizacionItemsState, id: string) => void;
  onGuardar: () => void;
  guardando: boolean;
};

const SECTION_CONFIG = {
  platos: {
    icon: Utensils,
    color: "orange",
    label: "Platos y Menú",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    borderColor: "border-orange-200"
  },
  personal: {
    icon: ChefHat,
    color: "blue", 
    label: "Personal de Servicio",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200"
  },
  transportes: {
    icon: Truck,
    color: "green",
    label: "Logística y Transporte",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200"
  },
  menaje: {
    icon: Package,
    color: "purple",
    label: "Menaje y Alquiler",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200"
  }
};

export function ResumenCotizacion({
  invitados,
  items,
  total,
  subtotales,
  onQtyChange,
  onRemove,
  onGuardar,
  guardando,
}: Props) {
  // Calcular estadísticas
  const totalItems = items.platos.length + items.personal.length + items.transportes.length + (items.menaje ?? []).length;
  const totalQuantity = [
    ...items.platos.map(p => p.cantidad),
    ...items.personal.map(p => p.cantidad),
    ...items.transportes.map(t => t.cantidad),
    ...(items.menaje ?? []).map(m => m.cantidad)
  ].reduce((sum, qty) => sum + qty, 0);

  const costPerGuest = invitados > 0 ? total / invitados : 0;
  const hasItems = totalItems > 0;

  // Calcular porcentajes
  const platosPercentage = total > 0 ? (subtotales.platos / total) * 100 : 0;
  const personalPercentage = total > 0 ? (subtotales.personal / total) * 100 : 0;
  const transportesPercentage = total > 0 ? (subtotales.transportes / total) * 100 : 0;
  const menajePercentage = total > 0 ? ((subtotales.menaje ?? 0) / total) * 100 : 0;

  // Preparar datos por sección
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

  const renderItemRow = (item: any, sectionColor: string) => (
    <div 
      key={`${item.tipo}-${item.id}`}
      className="group relative bg-white rounded-xl p-4 border border-slate-200 hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-slate-800 truncate mb-1">
            {item.nombre}
          </h4>
          <div className="flex items-center space-x-2 text-sm text-slate-600">
            <DollarSign className="h-3 w-3" />
            <span>{item.precio.toLocaleString()}</span>
            <span>×</span>
            <span>{item.cantidad}</span>
          </div>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {/* Controles de cantidad */}
          <div className="flex items-center space-x-1 bg-slate-50 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onQtyChange(item.tipo, item.id, Math.max(1, item.cantidad - 1))}
              className="h-7 w-7 p-0 hover:bg-white"
            >
              <Minus className="h-3 w-3" />
            </Button>
            
            <Input
              type="number"
              min={1}
              value={item.cantidad}
              onChange={(e) => onQtyChange(item.tipo, item.id, Math.max(1, Number(e.target.value)))}
              className="w-14 h-7 text-center text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-slate-300"
            />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onQtyChange(item.tipo, item.id, item.cantidad + 1)}
              className="h-7 w-7 p-0 hover:bg-white"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Subtotal */}
          <div className="text-right min-w-[80px]">
            <div className={cn("font-semibold", `text-${sectionColor}-600`)}>
              ${item.subtotal.toLocaleString()}
            </div>
          </div>

          {/* Botón eliminar */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(item.tipo, item.id)}
            className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="sticky top-4">
      {/* Header mejorado */}
      <CardHeader className="bg-emerald-50 border-b border-emerald-200 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Calculator className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <CardTitle className="text-emerald-800 text-lg">Resumen de Cotización</CardTitle>
              <p className="text-emerald-600 text-sm">Detalles y totales</p>
            </div>
          </div>

          {hasItems && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {totalItems} elementos
            </Badge>
          )}
        </div>

        {/* Estadísticas del evento */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="text-center p-3 bg-white rounded-xl">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="font-semibold text-emerald-800">{invitados}</div>
            <div className="text-xs text-emerald-600">Invitados</div>
          </div>
          
          <div className="text-center p-3 bg-white rounded-xl">
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
          /* Estado vacío mejorado */
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-slate-400" />
            </div>
            <div>
              <h3 className="font-medium text-slate-700 mb-2">¡Comienza tu cotización!</h3>
              <p className="text-slate-500 text-sm">
                Selecciona elementos desde las pestañas para ver el resumen aquí
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Distribución de costos */}
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
                      <Progress 
                        value={section.percentage} 
                        className="h-2"
                      />
                    </div>
                    <span className={cn("text-sm font-semibold", section.textColor)}>
                      ${section.subtotal.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Elementos por sección */}
            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.key} className="space-y-3">
                  <div className={cn(
                    "flex items-center justify-between p-3 rounded-xl border",
                    section.bgColor,
                    section.borderColor
                  )}>
                    <div className="flex items-center space-x-2">
                      <section.icon className={cn("h-5 w-5", section.textColor)} />
                      <h4 className={cn("font-semibold", section.textColor)}>
                        {section.label}
                      </h4>
                      <Badge className={cn(
                        "text-xs",
                        `bg-${section.color}-100 text-${section.color}-700 border-${section.color}-200`
                      )}>
                        {section.items.length}
                      </Badge>
                    </div>
                    
                    <div className={cn("font-bold", section.textColor)}>
                      ${section.subtotal.toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {section.items.map(item => renderItemRow(item, section.color))}
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Total final */}
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                    <span className="text-slate-600 font-medium">Total de la Cotización</span>
                  </div>
                </div>
                
                <div className="text-3xl font-bold text-emerald-600 mb-2">
                  ${total.toLocaleString()}
                </div>
                
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Cálculo en tiempo real</span>
                  <span>
                    {invitados > 0 && `$${costPerGuest.toLocaleString()} por invitado`}
                  </span>
                </div>
              </div>

              {/* Alertas inteligentes */}
              {total > 0 && (
                <div className="space-y-2">
                  {total < 50000 && (
                    <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700 text-sm">
                        Cotización básica - Considera agregar más elementos
                      </span>
                    </div>
                  )}
                  
                  {total >= 50000 && total < 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-blue-700 text-sm">
                        Cotización completa - ¡Excelente propuesta!
                      </span>
                    </div>
                  )}
                  
                  {total >= 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="text-purple-700 text-sm">
                        Cotización premium - Propuesta de alto valor
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* Botón de guardar mejorado */}
        <Button
          className={cn(
            "w-full h-12 font-semibold text-base transition-all duration-200",
            "bg-emerald-600 hover:bg-emerald-700"
          )}
          onClick={onGuardar} 
          disabled={guardando || !hasItems}
        >
          {guardando ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              <span>Guardando...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Guardar Cotización</span>
            </div>
          )}
        </Button>

      </CardContent>
    </Card>
  );
}