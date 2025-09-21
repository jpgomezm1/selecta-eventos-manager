import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCotizacionDetalle, addVersionToCotizacion, setVersionDefinitiva, updateVersionCotizacion, deleteVersionCotizacion } from "@/integrations/supabase/apiCotizador";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  Plus, 
  Check, 
  FileText, 
  Calendar, 
  Users, 
  DollarSign,
  Sparkles,
  Settings,
  CheckCircle,
  Clock,
  Edit,
  Calculator,
  TrendingUp,
  BarChart3,
  Utensils,
  ChefHat,
  Truck,
  AlertCircle,
  CheckCircle2,
  Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CotizacionItemsState } from "@/types/cotizador";
import BuilderTabs from "@/components/Cotizador/BuilderTabs";
import {
  getPlatosCatalogo,
  getTransporteTarifas,
  getPersonalCostosCatalogo,
} from "@/integrations/supabase/apiCotizador";

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
  }
};

// Componente simplificado para mostrar resumen read-only
function ResumenCotizacionReadOnly({ 
  invitados, 
  items, 
  total, 
  subtotales,
  versionName 
}: {
  invitados: number;
  items: CotizacionItemsState;
  total: number;
  subtotales: { platos: number; personal: number; transportes: number };
  versionName: string;
}) {
  const totalItems = items.platos.length + items.personal.length + items.transportes.length;
  const totalQuantity = [
    ...items.platos.map(p => p.cantidad),
    ...items.personal.map(p => p.cantidad), 
    ...items.transportes.map(t => t.cantidad)
  ].reduce((sum, qty) => sum + qty, 0);

  const costPerGuest = invitados > 0 ? total / invitados : 0;
  const hasItems = totalItems > 0;

  // Calcular porcentajes
  const platosPercentage = total > 0 ? (subtotales.platos / total) * 100 : 0;
  const personalPercentage = total > 0 ? (subtotales.personal / total) * 100 : 0;
  const transportesPercentage = total > 0 ? (subtotales.transportes / total) * 100 : 0;

  // Preparar datos por sección
  const sections = [
    {
      key: "platos" as const,
      ...SECTION_CONFIG.platos,
      items: items.platos.map(p => ({
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
        id: t.transporte_id,
        nombre: t.lugar,
        precio: t.tarifa_unitaria,
        cantidad: t.cantidad,
        subtotal: t.cantidad * t.tarifa_unitaria
      })),
      subtotal: subtotales.transportes,
      percentage: transportesPercentage
    }
  ].filter(section => section.items.length > 0);

  return (
    <Card className="shadow-xl border-slate-200 overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-50 border-b border-emerald-200 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500 rounded-xl shadow-lg">
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

        {/* Estadísticas del evento */}
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
          /* Estado vacío */
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
                    {section.items.map(item => (
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
                              <span>×</span>
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

            {/* Total final */}
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                    <span className="text-slate-600 font-medium">Total de la Cotización</span>
                  </div>
                  
                  {total > 100000 && (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Premium
                    </Badge>
                  )}
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

              {/* Alertas inteligentes */}
              {total > 0 && (
                <div className="space-y-2">
                  {total < 50000 && (
                    <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700 text-sm">
                        Cotización básica
                      </span>
                    </div>
                  )}
                  
                  {total >= 50000 && total < 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      <span className="text-blue-700 text-sm">
                        Cotización completa
                      </span>
                    </div>
                  )}
                  
                  {total >= 150000 && (
                    <div className="flex items-center space-x-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="text-purple-700 text-sm">
                        Cotización premium
                      </span>
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

export default function CotizacionEditorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [active, setActive] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<CotizacionItemsState>({ platos: [], personal: [], transportes: [] });

  const { data, isLoading, error } = useQuery({
    queryKey: ["cotizacion", id],
    queryFn: () => getCotizacionDetalle(id!),
    enabled: !!id,
  });

  // Catálogos para el builder
  const { data: platos } = useQuery({
    queryKey: ["platosCatalogo"],
    queryFn: getPlatosCatalogo,
  });
  const { data: transportes } = useQuery({
    queryKey: ["transporteTarifas"],
    queryFn: getTransporteTarifas,
  });
  const { data: personalCostos } = useQuery({
    queryKey: ["personalCostosCatalogo"],
    queryFn: getPersonalCostosCatalogo,
  });

  const { mutate: marcarDef } = useMutation({
    mutationFn: (version_id: string) => setVersionDefinitiva(id!, version_id),
    onSuccess: async () => {
      toast({ 
        title: "¡Versión marcada como definitiva!",
        description: "La versión seleccionada ahora es la oficial para el cliente."
      });
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });

      // buscar evento creado para esta versión y navegar
      const { data: ev } = await supabase
        .from("eventos")
        .select("id")
        .eq("cotizacion_version_id", active!)
        .maybeSingle();

      if (ev?.id) nav(`/eventos/${ev.id}`);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Función para entrar/salir del modo edición
  const toggleEditMode = (versionId: string, versionItems?: CotizacionItemsState) => {
    if (editingVersion === versionId) {
      // Salir del modo edición
      setEditingVersion(null);
      setEditingItems({ platos: [], personal: [], transportes: [] });
    } else {
      // Entrar al modo edición
      setEditingVersion(versionId);
      if (versionItems) {
        setEditingItems(versionItems);
      }
    }
  };

  // Funciones para agregar items durante la edición
  const addPlatoToEdit = (plato: any) => {
    const existingIndex = editingItems.platos.findIndex(p => p.plato_id === plato.id);
    if (existingIndex >= 0) {
      const updated = [...editingItems.platos];
      updated[existingIndex].cantidad += 1;
      setEditingItems(prev => ({ ...prev, platos: updated }));
    } else {
      setEditingItems(prev => ({
        ...prev,
        platos: [...prev.platos, {
          plato_id: plato.id,
          nombre: plato.nombre,
          precio_unitario: plato.precio,
          cantidad: 1
        }]
      }));
    }
  };

  const addPersonalToEdit = (personal: any) => {
    const existingIndex = editingItems.personal.findIndex(p => p.personal_costo_id === personal.id);
    if (existingIndex >= 0) {
      const updated = [...editingItems.personal];
      updated[existingIndex].cantidad += 1;
      setEditingItems(prev => ({ ...prev, personal: updated }));
    } else {
      setEditingItems(prev => ({
        ...prev,
        personal: [...prev.personal, {
          personal_costo_id: personal.id,
          rol: personal.rol,
          tarifa_estimada_por_persona: personal.tarifa,
          cantidad: 1
        }]
      }));
    }
  };

  const addTransporteToEdit = (transporte: any) => {
    const existingIndex = editingItems.transportes.findIndex(t => t.transporte_id === transporte.id);
    if (existingIndex >= 0) {
      const updated = [...editingItems.transportes];
      updated[existingIndex].cantidad += 1;
      setEditingItems(prev => ({ ...prev, transportes: updated }));
    } else {
      setEditingItems(prev => ({
        ...prev,
        transportes: [...prev.transportes, {
          transporte_id: transporte.id,
          lugar: transporte.lugar,
          tarifa_unitaria: transporte.tarifa,
          cantidad: 1
        }]
      }));
    }
  };

  const updateQtyInEdit = (tipo: keyof CotizacionItemsState, id: string, qty: number) => {
    if (qty <= 0) {
      // Remover item si cantidad es 0
      setEditingItems(prev => ({
        ...prev,
        [tipo]: prev[tipo].filter((item: any) => {
          const itemId = tipo === 'platos' ? item.plato_id :
                        tipo === 'personal' ? item.personal_costo_id :
                        item.transporte_id;
          return itemId !== id;
        })
      }));
    } else {
      // Actualizar cantidad
      setEditingItems(prev => ({
        ...prev,
        [tipo]: prev[tipo].map((item: any) => {
          const itemId = tipo === 'platos' ? item.plato_id :
                        tipo === 'personal' ? item.personal_costo_id :
                        item.transporte_id;
          return itemId === id ? { ...item, cantidad: qty } : item;
        })
      }));
    }
  };

  // Función para confirmar y eliminar versión
  const confirmarEliminarVersion = (versionId: string, versionName: string) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar la "${versionName}"? Esta acción no se puede deshacer.`)) {
      eliminarVersion(versionId);
    }
  };

  const { mutate: agregarVersion, isPending: creandoVersion } = useMutation({
    mutationFn: async () => {
      const nextIndex = (data?.versiones?.length ?? 0) + 1;
      return addVersionToCotizacion(id!, {
        nombre_opcion: `Opción ${String.fromCharCode(64 + nextIndex)}`,
        version_index: nextIndex,
        total: 0,
        estado: "Pendiente por Aprobación",
        items: { platos: [], personal: [], transportes: [] },
      });
    },
    onSuccess: (result) => {
      toast({
        title: "¡Nueva opción creada!",
        description: "Se agregó una nueva versión lista para personalizar."
      });
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
      // Activar automáticamente el modo edición para la nueva versión
      setEditingVersion(result.id);
      setEditingItems({ platos: [], personal: [], transportes: [] });
      setActive(result.id);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { mutate: guardarCambios, isPending: guardandoCambios } = useMutation({
    mutationFn: (versionId: string) => updateVersionCotizacion(id!, versionId, editingItems),
    onSuccess: () => {
      toast({
        title: "¡Cambios guardados!",
        description: "La versión ha sido actualizada exitosamente."
      });
      setEditingVersion(null);
      setEditingItems({ platos: [], personal: [], transportes: [] });
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { mutate: eliminarVersion, isPending: eliminandoVersion } = useMutation({
    mutationFn: (versionId: string) => deleteVersionCotizacion(versionId),
    onSuccess: () => {
      toast({
        title: "¡Versión eliminada!",
        description: "La opción ha sido eliminada exitosamente."
      });
      // Salir del modo edición si estaba editando la versión eliminada
      if (editingVersion) {
        setEditingVersion(null);
        setEditingItems({ platos: [], personal: [], transportes: [] });
      }
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
        {/* Background decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4 py-8">
          <Card className="bg-white/90 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
            <CardContent className="p-16 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-r from-selecta-green to-primary rounded-3xl flex items-center justify-center shadow-2xl animate-pulse">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-slate-800">Cargando cotización...</h3>
                  <p className="text-slate-500">Preparando todas las opciones para ti</p>
                </div>
                <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-selecta-green to-primary rounded-full animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-red-100/20 to-red-200/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10 container mx-auto px-4 py-8">
          <Card className="bg-white/90 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
            <CardContent className="p-16 text-center">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-r from-red-400 to-red-500 rounded-3xl flex items-center justify-center shadow-2xl">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-red-600">Error al cargar</h3>
                  <p className="text-slate-500">No se pudo obtener la información de la cotización</p>
                </div>
                <Button 
                  onClick={() => nav('/cotizador')}
                  className="bg-gradient-to-r from-selecta-green to-primary hover:from-primary hover:to-selecta-green text-white rounded-2xl px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver al cotizador
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const { cotizacion, versiones } = data;
  const activeId = active ?? versiones[0]?.id;
  const current = versiones.find((v) => v.id === activeId) ?? versiones[0];

  // Calcular estadísticas
  const totalVersiones = versiones.length;
  const versionesDefinitivas = versiones.filter(v => v.is_definitiva).length;
  const totalCotizado = Math.max(...versiones.map(v => Number(v.total)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-gradient-to-r from-purple-100/40 to-pink-100/40 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header mejorado */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <Button
              variant="ghost"
              onClick={() => nav('/cotizador')}
              className="absolute left-0 top-0 text-slate-600 hover:text-selecta-green hover:bg-selecta-green/10 rounded-2xl"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Volver
            </Button>
            
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-r from-selecta-green via-primary to-selecta-green rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3">
                <Edit className="h-8 w-8 text-white" />
              </div>
              <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-3xl blur-xl" />
            </div>
            
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-selecta-green via-primary to-selecta-green bg-clip-text text-transparent leading-tight">
                {cotizacion.nombre_cotizacion}
              </h1>
              <div className="flex items-center justify-center space-x-6 mt-3 text-slate-600">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-selecta-green" />
                  <span className="font-medium">{cotizacion.numero_invitados} invitados</span>
                </div>
                {cotizacion.cliente_nombre && (
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-selecta-green" />
                    <span className="font-medium">{cotizacion.cliente_nombre}</span>
                  </div>
                )}
                {cotizacion.fecha_evento_estimada && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-selecta-green" />
                    <span className="font-medium">
                      {new Date(cotizacion.fecha_evento_estimada).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="max-w-4xl mx-auto mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <Settings className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{totalVersiones}</div>
                    <div className="text-sm text-slate-600">Opciones creadas</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-xl">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">{versionesDefinitivas}</div>
                    <div className="text-sm text-slate-600">Versión definitiva</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-lg border border-white/30">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-emerald-100 rounded-xl">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-800">
                      ${totalCotizado.toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-600">Mayor cotización</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Línea decorativa */}
          <div className="flex items-center justify-center space-x-2">
            <div className="w-16 h-1 bg-gradient-to-r from-selecta-green to-primary rounded-full" />
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <div className="w-8 h-1 bg-gradient-to-r from-primary to-selecta-green rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Columna principal */}
          <div className="xl:col-span-2">
            <Card className="bg-white/90 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-selecta-green/10 to-primary/10 border-b border-selecta-green/20 pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-selecta-green rounded-2xl shadow-lg">
                      <Settings className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold text-selecta-green">
                        Opciones de Cotización
                      </CardTitle>
                      <p className="text-selecta-green/70 mt-1">
                        Gestiona las diferentes alternativas para tu cliente
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Button
                      onClick={() => agregarVersion()}
                      disabled={creandoVersion}
                      className="bg-gradient-to-r from-selecta-green to-primary hover:from-primary hover:to-selecta-green text-white rounded-2xl px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      {creandoVersion ? (
                        <div className="flex items-center space-x-2">
                          <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                          <span>Creando...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Plus className="h-4 w-4" />
                          <span>Añadir opción</span>
                        </div>
                      )}
                    </Button>
                    </div>
               </div>
             </CardHeader>

             <CardContent className="p-8">
               <Tabs value={activeId ?? ""} onValueChange={setActive} className="w-full">
                 <TabsList className="flex overflow-x-auto gap-2 bg-slate-100/80 rounded-2xl p-2 shadow-inner mb-6">
                   {versiones.map((v) => (
                     <TabsTrigger 
                       key={v.id} 
                       value={v.id} 
                       className="flex items-center space-x-2 whitespace-nowrap data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-selecta-green rounded-xl font-semibold transition-all duration-200 hover:bg-white/50 px-6 py-3"
                     >
                       <div className="flex items-center space-x-2">
                         {v.is_definitiva ? (
                           <CheckCircle className="h-4 w-4 text-green-500" />
                         ) : (
                           <Clock className="h-4 w-4 text-orange-500" />
                         )}
                         <span>{v.nombre_opcion}</span>
                         {v.is_definitiva && (
                           <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                             Definitiva
                           </div>
                         )}
                       </div>
                     </TabsTrigger>
                   ))}
                 </TabsList>

                 {versiones.map((v) => (
                   <TabsContent key={v.id} value={v.id} className="mt-0 space-y-6">
                     {/* Header de la versión - Layout mejorado */}
                     <div className="p-6 bg-gradient-to-r from-slate-50/80 to-slate-100/80 rounded-2xl border border-slate-200/50 space-y-4">
                       {/* Primera fila: Título y estado */}
                       <div className="flex items-center justify-between">
                         <div className="flex items-center space-x-3">
                           {v.is_definitiva ? (
                             <div className="p-2 bg-green-100 rounded-xl">
                               <CheckCircle className="h-5 w-5 text-green-600" />
                             </div>
                           ) : (
                             <div className="p-2 bg-orange-100 rounded-xl">
                               <Clock className="h-5 w-5 text-orange-600" />
                             </div>
                           )}
                           <div>
                             <h3 className="text-xl font-bold text-slate-800">{v.nombre_opcion}</h3>
                             <p className="text-sm text-slate-600">
                               {v.is_definitiva ? "Versión aprobada por el cliente" : "En proceso de revisión"}
                             </p>
                           </div>
                         </div>

                         {/* Total de la versión */}
                         <div className="text-right">
                           <div className="text-2xl font-bold text-selecta-green">
                             {new Intl.NumberFormat('es-CO', {
                               style: 'currency',
                               currency: 'COP',
                               minimumFractionDigits: 0
                             }).format(
                               v.items.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0) +
                               v.items.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0) +
                               v.items.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0)
                             )}
                           </div>
                           <p className="text-sm text-slate-600">Total de la opción</p>
                         </div>
                       </div>

                       {/* Segunda fila: Estadísticas y botones de acción */}
                       <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
                         {/* Estadísticas de la versión */}
                         <div className="flex items-center space-x-4 text-sm">
                           <div className="flex items-center space-x-1 bg-white/70 px-3 py-2 rounded-xl shadow-sm">
                             <div className="w-2 h-2 bg-orange-400 rounded-full" />
                             <span className="text-slate-600 font-medium">{v.items.platos.length} platos</span>
                           </div>
                           <div className="flex items-center space-x-1 bg-white/70 px-3 py-2 rounded-xl shadow-sm">
                             <div className="w-2 h-2 bg-blue-400 rounded-full" />
                             <span className="text-slate-600 font-medium">{v.items.personal.length} personal</span>
                           </div>
                           <div className="flex items-center space-x-1 bg-white/70 px-3 py-2 rounded-xl shadow-sm">
                             <div className="w-2 h-2 bg-green-400 rounded-full" />
                             <span className="text-slate-600 font-medium">{v.items.transportes.length} transportes</span>
                           </div>
                         </div>

                         {/* Botones de acción */}
                         {!v.is_definitiva && (
                           <div className="flex items-center space-x-2">
                             <Button
                               onClick={() => toggleEditMode(v.id, v.items)}
                               variant={editingVersion === v.id ? "outline" : "default"}
                               size="sm"
                               className="rounded-xl px-3 py-2 shadow-lg hover:shadow-xl transition-all duration-300"
                             >
                               <Edit className="h-4 w-4 mr-2" />
                               {editingVersion === v.id ? "Ver resumen" : "Editar"}
                             </Button>

                             {/* Botón eliminar solo si hay más de una versión */}
                             {data?.versiones && data.versiones.length > 1 && (
                               <Button
                                 onClick={() => confirmarEliminarVersion(v.id, v.nombre_opcion)}
                                 variant="outline"
                                 size="sm"
                                 disabled={eliminandoVersion}
                                 className="rounded-xl px-3 py-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 shadow-lg hover:shadow-xl transition-all duration-300"
                               >
                                 {eliminandoVersion ? (
                                   <div className="animate-spin w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full mr-2" />
                                 ) : (
                                   <Trash2 className="h-4 w-4 mr-2" />
                                 )}
                                 {eliminandoVersion ? "Eliminando..." : "Eliminar"}
                               </Button>
                             )}

                             <Button
                               onClick={() => marcarDef(v.id)}
                               size="sm"
                               className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl px-3 py-2 shadow-lg hover:shadow-xl transition-all duration-300"
                             >
                               <Check className="h-4 w-4 mr-2" />
                               Marcar definitiva
                             </Button>
                           </div>
                         )}
                       </div>
                     </div>

                     {/* Contenido de la versión - Condicional entre edición y resumen */}
                     <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-white/30 overflow-hidden">
                       {editingVersion === v.id ? (
                         <div className="p-6">
                           {/* Builder para editar */}
                           <BuilderTabs
                             invitados={cotizacion.numero_invitados}
                             items={editingItems}
                             platos={platos || []}
                             personal={personalCostos || []}
                             transportes={transportes || []}
                             onAddPlato={addPlatoToEdit}
                             onAddPersonal={addPersonalToEdit}
                             onAddTransporte={addTransporteToEdit}
                             onQtyChange={updateQtyInEdit}
                           />

                           {/* Botones de acción para guardar/cancelar */}
                           <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-slate-200">
                             <Button
                               variant="outline"
                               onClick={() => toggleEditMode(v.id)}
                               className="rounded-2xl px-6 py-2"
                             >
                               Cancelar
                             </Button>
                             <Button
                               onClick={() => guardarCambios(v.id)}
                               disabled={guardandoCambios}
                               className="bg-gradient-to-r from-selecta-green to-primary text-white rounded-2xl px-6 py-2"
                             >
                               {guardandoCambios ? (
                                 <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2" />
                               ) : (
                                 <CheckCircle className="h-4 w-4 mr-2" />
                               )}
                               {guardandoCambios ? "Guardando..." : "Guardar cambios"}
                             </Button>
                           </div>
                         </div>
                       ) : (
                         <ResumenCotizacionReadOnly
                           invitados={cotizacion.numero_invitados}
                           items={v.items}
                           total={Number(v.total)}
                           subtotales={{
                             platos: v.items.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0),
                             personal: v.items.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0),
                             transportes: v.items.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0),
                           }}
                           versionName={v.nombre_opcion}
                         />
                       )}
                     </div>
                   </TabsContent>
                 ))}
               </Tabs>
             </CardContent>
           </Card>
         </div>

         {/* Sidebar con información adicional */}
         <div className="xl:col-span-1">
           <div className="sticky top-8 space-y-6">
             {/* Estado general */}
             <Card className="bg-white/95 backdrop-blur-xl shadow-2xl border-white/40 rounded-3xl overflow-hidden">
               <CardHeader className="bg-gradient-to-r from-emerald-50/90 to-green-50/90 border-b border-emerald-200/40 pb-6">
                 <div className="flex items-center space-x-3">
                   <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg">
                     <Sparkles className="h-6 w-6 text-white" />
                   </div>
                   <div>
                     <CardTitle className="text-xl font-bold text-emerald-800">
                       Estado del Proyecto
                     </CardTitle>
                     <p className="text-emerald-600 text-sm mt-1">Resumen general</p>
                   </div>
                 </div>
               </CardHeader>

               <CardContent className="p-6 space-y-4">
                 <div className="space-y-3">
                   <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                     <span className="text-slate-600 font-medium">Estado:</span>
                     <span className={`font-bold ${cotizacion.estado === 'Aprobada' ? 'text-green-600' : 'text-orange-600'}`}>
                       {cotizacion.estado}
                     </span>
                   </div>

                   <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                     <span className="text-slate-600 font-medium">Total opciones:</span>
                     <span className="font-bold text-slate-800">{totalVersiones}</span>
                   </div>

                   <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                     <span className="text-slate-600 font-medium">Rango de precios:</span>
                     <div className="text-right">
                       <div className="font-bold text-slate-800">
                         ${Math.min(...versiones.map(v => Number(v.total))).toLocaleString()}
                       </div>
                       <div className="text-xs text-slate-500">
                         - ${Math.max(...versiones.map(v => Number(v.total))).toLocaleString()}
                       </div>
                     </div>
                   </div>
                 </div>
               </CardContent>
             </Card>

             {/* Resumen de la versión activa */}
             {current && (
               <Card className="bg-white/95 backdrop-blur-xl shadow-2xl border-white/40 rounded-3xl overflow-hidden">
                 <CardHeader className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 border-b border-blue-200/40 pb-6">
                   <div className="flex items-center space-x-3">
                     <div className="p-3 bg-blue-500 rounded-2xl shadow-lg">
                       <BarChart3 className="h-6 w-6 text-white" />
                     </div>
                     <div>
                       <CardTitle className="text-xl font-bold text-blue-800">
                         {current.nombre_opcion}
                       </CardTitle>
                       <p className="text-blue-600 text-sm mt-1">Estadísticas de versión</p>
                     </div>
                   </div>
                 </CardHeader>

                 <CardContent className="p-6 space-y-4">
                   <div className="grid grid-cols-2 gap-3">
                     <div className="text-center p-3 bg-orange-50 rounded-xl border border-orange-200">
                       <Utensils className="h-4 w-4 text-orange-600 mx-auto mb-1" />
                       <div className="font-semibold text-orange-800">{current.items.platos.length}</div>
                       <div className="text-xs text-orange-600">Platos</div>
                     </div>

                     <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-200">
                       <ChefHat className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                       <div className="font-semibold text-blue-800">{current.items.personal.length}</div>
                       <div className="text-xs text-blue-600">Personal</div>
                     </div>

                     <div className="text-center p-3 bg-green-50 rounded-xl border border-green-200">
                       <Truck className="h-4 w-4 text-green-600 mx-auto mb-1" />
                       <div className="font-semibold text-green-800">{current.items.transportes.length}</div>
                       <div className="text-xs text-green-600">Transportes</div>
                     </div>

                     <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                       <DollarSign className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                       <div className="font-semibold text-emerald-800">
                         ${Number(current.total).toLocaleString()}
                       </div>
                       <div className="text-xs text-emerald-600">Total</div>
                     </div>
                   </div>

                   {current.is_definitiva && (
                     <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                       <div className="flex items-center space-x-2">
                         <CheckCircle className="h-4 w-4 text-green-600" />
                         <span className="text-green-700 text-sm font-medium">
                           Versión definitiva aprobada
                         </span>
                       </div>
                     </div>
                   )}
                 </CardContent>
               </Card>
             )}

             {/* Consejos */}
             <div className="p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30">
               <div className="text-center space-y-3">
                 <div className="flex items-center justify-center space-x-2 text-slate-600 mb-4">
                   <div className="w-2 h-2 bg-selecta-green rounded-full animate-pulse" />
                   <span className="text-sm font-medium">Sistema de Cotizaciones</span>
                 </div>

                 <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-4 space-y-2">
                   <p className="font-medium text-slate-700">💡 Consejos:</p>
                   <ul className="text-left space-y-1">
                     <li>• Marca como definitiva la opción que apruebe el cliente</li>
                     <li>• Puedes crear múltiples opciones para comparar</li>
                     <li>• La versión definitiva se convertirá en evento</li>
                     <li>• Revisa los detalles de cada versión antes de enviar</li>
                   </ul>
                 </div>
               </div>
             </div>
           </div>
         </div>
       </div>

       {/* Footer informativo */}
       <div className="text-center mt-12 pt-8">
         <div className="inline-flex items-center justify-center space-x-4 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/30">
           <div className="flex items-center space-x-2">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
             <span className="text-sm font-medium text-slate-600">Editor de cotizaciones</span>
           </div>
           <div className="w-px h-4 bg-slate-300" />
           <div className="flex items-center space-x-2">
             <Edit className="h-4 w-4 text-slate-500" />
             <span className="text-sm text-slate-500">
               {totalVersiones} opción(es) • {cotizacion.numero_invitados} invitados
             </span>
           </div>
         </div>
       </div>
     </div>
   </div>
 );
}