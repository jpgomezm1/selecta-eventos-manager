import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";

import {
  getPlatosCatalogo,
  getTransporteTarifas,
  getPersonalCostosCatalogo,
  createCotizacionWithVersions,
} from "@/integrations/supabase/apiCotizador";

import type {
  CotizacionWithVersionsDraft,
  CotizacionItemsState,
  PlatoCatalogo,
  PersonalCosto,
  TransporteTarifa,
} from "@/types/cotizador";

import { ResumenCotizacion } from "@/components/Cotizador/ResumenCotizacion";
import BuilderTabs from "@/components/Cotizador/BuilderTabs";

import {
  Calculator,
  Users,
  Calendar,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Save,
  Sparkles,
  DollarSign,
  FileText,
  Copy,
  Settings,
} from "lucide-react";

type FormValues = {
  nombre_cotizacion: string;
  cliente_nombre: string;
  numero_invitados: number;
  fecha_evento_estimada?: string;
  ubicacion_evento?: string;
  comercial_encargado: string;
};

type OpcionState = {
  key: string;
  nombre_opcion: string;
  items: CotizacionItemsState;
};

export default function Cotizador() {
  const nav = useNavigate();
  const { toast } = useToast();

  const { register, handleSubmit, watch, reset } = useForm<FormValues>({
    defaultValues: {
      nombre_cotizacion: "",
      cliente_nombre: "",
      numero_invitados: 50,
      fecha_evento_estimada: "",
      ubicacion_evento: "",
      comercial_encargado: "",
    },
  });

  const invitados = watch("numero_invitados") || 0;
  const nombreCotizacion = watch("nombre_cotizacion");
  const clienteNombre = watch("cliente_nombre");

  // Catálogos
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

  // Opciones de cotización (al menos una)
  const [opciones, setOpciones] = useState<OpcionState[]>([
    {
      key: crypto.randomUUID(),
      nombre_opcion: "Opción A",
      items: { platos: [], personal: [], transportes: [] },
    },
  ]);
  const [activeKey, setActiveKey] = useState(opciones[0].key);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // pestaña interna del builder (platos/personal/transporte)
  const [builderTab, setBuilderTab] = useState<"platos" | "personal" | "transporte">("platos");

  const current = opciones.find((o) => o.key === activeKey)!;

  // Helpers cantidades + totales
  const calcSubtotales = (it: CotizacionItemsState) => {
    const platos = it.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0);
    const personal = it.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0);
    const transportes = it.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0);
    return { platos, personal, transportes, total: platos + personal + transportes };
  };

  const addOpcion = () => {
    const nextIndex = opciones.length + 1;
    const key = crypto.randomUUID();
    const letra = String.fromCharCode(64 + nextIndex);
    setOpciones((prev) => [
      ...prev,
      {
        key,
        nombre_opcion: `Opción ${letra}`,
        items: { platos: [], personal: [], transportes: [] },
      },
    ]);
    setActiveKey(key);
    setBuilderTab("platos");
    toast({
      title: "Nueva opción agregada",
      description: `Se creó la Opción ${letra} lista para personalizar`,
    });
  };

  const duplicateOpcion = (sourceKey: string) => {
    const source = opciones.find((o) => o.key === sourceKey);
    if (!source) return;

    const key = crypto.randomUUID();

    setOpciones((prev) => [
      ...prev,
      {
        key,
        nombre_opcion: `${source.nombre_opcion} - Copia`,
        items: JSON.parse(JSON.stringify(source.items)), // Deep copy
      },
    ]);
    setActiveKey(key);
    setBuilderTab("platos");
    toast({
      title: "Opción duplicada",
      description: `Se creó una copia de "${source.nombre_opcion}"`,
    });
  };

  const startEditingOption = (key: string, currentName: string) => {
    setEditingOption(key);
    setEditingName(currentName);
  };

  const saveOptionName = () => {
    if (editingOption && editingName.trim()) {
      setOpciones((prev) =>
        prev.map((o) => (o.key === editingOption ? { ...o, nombre_opcion: editingName.trim() } : o))
      );
      setEditingOption(null);
      setEditingName("");
      toast({
        title: "Nombre actualizado",
        description: "El nombre de la opción se guardó correctamente",
      });
    }
  };

  const cancelEditingOption = () => {
    setEditingOption(null);
    setEditingName("");
  };

  const removeOpcion = (key: string) => {
    if (opciones.length === 1) {
      toast({
        title: "No se puede eliminar",
        description: "Debe existir al menos una opción de cotización",
        variant: "destructive",
      });
      return;
    }

    const optionName = opciones.find((o) => o.key === key)?.nombre_opcion;
    const idx = opciones.findIndex((o) => o.key === key);
    const newArr = opciones.filter((o) => o.key !== key);
    setOpciones(newArr);
    setActiveKey(newArr[Math.max(0, idx - 1)].key);
    setBuilderTab("platos");

    toast({
      title: "Opción eliminada",
      description: `"${optionName}" fue eliminada correctamente`,
    });
  };

  const mutateAdd = (updater: (it: CotizacionItemsState) => CotizacionItemsState) => {
    setOpciones((prev) => prev.map((o) => (o.key === activeKey ? { ...o, items: updater(o.items) } : o)));
  };

  const addPlato = (plato: PlatoCatalogo) =>
    mutateAdd((it) => {
      const idx = it.platos.findIndex((p) => p.plato_id === plato.id);
      if (idx >= 0) {
        const copy = [...it.platos];
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
        return { ...it, platos: copy };
      }
      return {
        ...it,
        platos: [
          ...it.platos,
          { plato_id: plato.id, nombre: plato.nombre, precio_unitario: Number(plato.precio), cantidad: 1 },
        ],
      };
    });

  const addPersonal = (p: PersonalCosto) =>
    mutateAdd((it) => {
      const idx = it.personal.findIndex((x) => x.personal_costo_id === p.id);
      if (idx >= 0) {
        const copy = [...it.personal];
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
        return { ...it, personal: copy };
      }
      return {
        ...it,
        personal: [
          ...it.personal,
          { personal_costo_id: p.id, rol: p.rol, tarifa_estimada_por_persona: Number(p.tarifa), cantidad: 1 },
        ],
      };
    });

  const addTransporte = (t: TransporteTarifa) =>
    mutateAdd((it) => {
      const idx = it.transportes.findIndex((x) => x.transporte_id === t.id);
      if (idx >= 0) {
        const copy = [...it.transportes];
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
        return { ...it, transportes: copy };
      }
      return {
        ...it,
        transportes: [
          ...it.transportes,
          { transporte_id: t.id, lugar: t.lugar, tarifa_unitaria: Number(t.tarifa), cantidad: 1 },
        ],
      };
    });

  const updateQty = (tipo: keyof CotizacionItemsState, id: string, qty: number) =>
    mutateAdd((it) => {
      if (qty < 1) return it;
      if (tipo === "platos")
        return { ...it, platos: it.platos.map((x) => (x.plato_id === id ? { ...x, cantidad: qty } : x)) };
      if (tipo === "personal")
        return {
          ...it,
          personal: it.personal.map((x) =>
            x.personal_costo_id === id ? { ...x, cantidad: qty } : x
          ),
        };
      return {
        ...it,
        transportes: it.transportes.map((x) =>
          x.transporte_id === id ? { ...x, cantidad: qty } : x
        ),
      };
    });

  const removeItem = (tipo: keyof CotizacionItemsState, id: string) =>
    mutateAdd((it) => {
      if (tipo === "platos") return { ...it, platos: it.platos.filter((x) => x.plato_id !== id) };
      if (tipo === "personal")
        return { ...it, personal: it.personal.filter((x) => x.personal_costo_id !== id) };
      return { ...it, transportes: it.transportes.filter((x) => x.transporte_id !== id) };
    });

  const { mutate: crear, isPending } = useMutation({
    mutationFn: (payload: CotizacionWithVersionsDraft) => createCotizacionWithVersions(payload),
    onSuccess: (res) => {
      toast({
        title: "¡Cotización creada exitosamente!",
        description: `"${nombreCotizacion}" se guardó con todas sus opciones.`,
      });
      reset();
      const newKey = crypto.randomUUID();
      setOpciones([
        { key: newKey, nombre_opcion: "Opción A", items: { platos: [], personal: [], transportes: [] } },
      ]);
      setActiveKey(newKey);
      setBuilderTab("platos");
      nav(`/cotizador/${res.id}`);
    },
    onError: (e: any) => {
      toast({
        title: "Error al crear cotización",
        description: e.message ?? "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (v: FormValues) => {
    if (!v.nombre_cotizacion.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa un nombre para la cotización",
        variant: "destructive",
      });
      return;
    }

    if (!v.comercial_encargado.trim()) {
      toast({
        title: "Comercial requerido",
        description: "Ingresa el nombre del comercial encargado",
        variant: "destructive",
      });
      return;
    }

    const versiones = opciones.map((o, i) => {
      const tot = calcSubtotales(o.items);
      return {
        nombre_opcion: o.nombre_opcion,
        version_index: i + 1,
        total: tot.total,
        estado: "Borrador" as const,
        is_definitiva: i === 0 && opciones.length === 1 ? true : false,
        items: o.items,
      };
    });

    const payload: CotizacionWithVersionsDraft = {
      cotizacion: {
        nombre_cotizacion: v.nombre_cotizacion.trim(),
        cliente_nombre: v.cliente_nombre?.trim() || null,
        numero_invitados: Number(v.numero_invitados),
        fecha_evento_estimada: v.fecha_evento_estimada ? new Date(v.fecha_evento_estimada) : null,
        ubicacion_evento: v.ubicacion_evento?.trim() || null,
        comercial_encargado: v.comercial_encargado.trim(),
        total_cotizado: versiones[0]?.total ?? 0,
        estado: "Borrador",
      },
      versiones,
    };
    crear(payload);
  };

  // Totales de la pestaña activa para el Resumen
  const subt = calcSubtotales(current.items);

  // Progreso visual del formulario
  const formProgress = useMemo(() => {
    let progress = 0;
    if (nombreCotizacion?.trim()) progress += 25;
    if (clienteNombre?.trim()) progress += 25;
    if (invitados > 0) progress += 25;
    if (
      current.items.platos.length > 0 ||
      current.items.personal.length > 0 ||
      current.items.transportes.length > 0
    )
      progress += 25;
    return progress;
  }, [nombreCotizacion, clienteNombre, invitados, current.items]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-gradient-to-r from-purple-100/40 to-pink-100/40 rounded-full blur-2xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-4 mb-6">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-r from-selecta-green via-primary to-selecta-green rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3">
                <Calculator className="h-8 w-8 text-white" />
              </div>
              <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-3xl blur-xl" />
            </div>
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-selecta-green via-primary to-selecta-green bg-clip-text text-transparent leading-tight">
                Nueva Cotización
              </h1>
              <p className="text-slate-600 text-lg font-medium mt-2">
                Crea presupuestos profesionales con múltiples opciones
              </p>
            </div>
          </div>

          {/* Progreso */}
          <div className="max-w-md mx-auto mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-600">Progreso de la cotización</span>
              <span className="text-sm font-bold text-selecta-green">{formProgress}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-selecta-green to-primary rounded-full transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${formProgress}%` }}
              >
                <div className="h-full w-full bg-white/20 animate-pulse rounded-full" />
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
          <div className="xl:col-span-2 space-y-8">
            {/* Datos del evento */}
            <Card className="bg-white/90 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50/80 to-blue-100/80 border-b border-blue-200/30 pb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-500 rounded-2xl shadow-lg">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold text-blue-900">
                      Información del Evento
                    </CardTitle>
                    <p className="text-blue-600 mt-1">Completa los datos básicos de la cotización</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-selecta-green" />
                      <span>Nombre de la Cotización *</span>
                    </label>
                    <Input
                      placeholder="Ej: Boda María & Juan - Diciembre 2024"
                      {...register("nombre_cotizacion")}
                      className="h-12 bg-white border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                      <Users className="h-4 w-4 text-selecta-green" />
                      <span>Cliente</span>
                    </label>
                    <Input
                      placeholder="Nombre del cliente"
                      {...register("cliente_nombre")}
                      className="h-12 bg-white border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                      <Users className="h-4 w-4 text-selecta-green" />
                      <span>Número de Invitados</span>
                    </label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="50"
                      {...register("numero_invitados", { valueAsNumber: true })}
                      className="h-12 bg-white border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-selecta-green" />
                      <span>Fecha Estimada del Evento</span>
                    </label>
                    <Input
                      type="date"
                      {...register("fecha_evento_estimada")}
                      className="h-12 bg-white border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                      <Users className="h-4 w-4 text-selecta-green" />
                      <span>Comercial Encargado *</span>
                    </label>
                    <Input
                      placeholder="Nombre del comercial responsable"
                      {...register("comercial_encargado")}
                      className="h-12 bg-white border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                      <Sparkles className="h-4 w-4 text-selecta-green" />
                      <span>Ubicación del Evento</span>
                    </label>
                    <Input
                      placeholder="Ej: Hacienda Los Robles, Chía"
                      {...register("ubicacion_evento")}
                      className="h-12 bg-white border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Opciones de cotización */}
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
                        Crea diferentes alternativas para tu cliente
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-selecta-green">{opciones.length} opción(es)</div>
                      <div className="text-xs text-selecta-green/70">creada(s)</div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-8">
                <Tabs value={activeKey} onValueChange={(v) => setActiveKey(v)} className="w-full">
                  <div className="flex items-center justify-between mb-6">
                    <TabsList className="flex-1 mr-4 bg-slate-100/80 rounded-2xl p-2 shadow-inner">
                      {opciones.map((o) => (
                        <TabsTrigger
                          key={o.key}
                          value={o.key}
                          className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-selecta-green rounded-xl font-semibold transition-all duration-200 hover:bg-white/50"
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                o.key === activeKey ? "bg-selecta-green animate-pulse" : "bg-slate-400"
                              }`}
                            />
                            <span className="truncate">{o.nombre_opcion}</span>
                          </div>
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addOpcion}
                        className="bg-white hover:bg-selecta-green hover:text-white border-selecta-green text-selecta-green rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Agregar
                      </Button>

                      {opciones.length >= 1 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => duplicateOpcion(activeKey)}
                          className="bg-white hover:bg-blue-500 hover:text-white border-blue-300 text-blue-600 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Duplicar
                        </Button>
                      )}
                    </div>
                  </div>

                  {opciones.map((o) => (
                    <TabsContent key={o.key} value={o.key} className="mt-0 space-y-6">
                      {/* Header de la opción */}
                      <div className="flex items-center justify-between p-6 bg-gradient-to-r from-slate-50/80 to-slate-100/80 rounded-2xl border border-slate-200/50">
                        <div className="flex items-center space-x-4">
                          {editingOption === o.key ? (
                            <div className="flex items-center space-x-2">
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="max-w-xs h-10 rounded-xl"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveOptionName();
                                  if (e.key === "Escape") cancelEditingOption();
                                }}
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={saveOptionName}
                                className="text-green-600 hover:bg-green-50"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditingOption}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <h3 className="text-xl font-bold text-slate-800">{o.nombre_opcion}</h3>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditingOption(o.key, o.nombre_opcion)}
                                className="text-slate-500 hover:text-selecta-green hover:bg-selecta-green/10"
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>

                        <div className="flex items-center space-x-4">
                          {/* Indicador de items */}
                          <div className="flex items-center space-x-4 text-sm">
                            <div className="flex items-center space-x-1 bg-white/70 px-3 py-1 rounded-xl">
                              <div className="w-2 h-2 bg-orange-400 rounded-full" />
                              <span className="text-slate-600 font-medium">{o.items.platos.length} platos</span>
                            </div>
                            <div className="flex items-center space-x-1 bg-white/70 px-3 py-1 rounded-xl">
                              <div className="w-2 h-2 bg-blue-400 rounded-full" />
                              <span className="text-slate-600 font-medium">{o.items.personal.length} personal</span>
                            </div>
                            <div className="flex items-center space-x-1 bg-white/70 px-3 py-1 rounded-xl">
                              <div className="w-2 h-2 bg-green-400 rounded-full" />
                              <span className="text-slate-600 font-medium">
                                {o.items.transportes.length} transportes
                              </span>
                            </div>
                          </div>

                          {opciones.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOpcion(o.key)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <Separator className="opacity-30" />

                      {/* Builder mejorado con tabs internas + búsqueda */}
                      <BuilderTabs
                        value={builderTab}
                        onValueChange={(v) => setBuilderTab(v as any)}
                        platos={platos ?? []}
                        personal={personalCostos ?? []}
                        transportes={transportes ?? []}
                        items={o.items}
                        invitados={invitados}
                        onAddPlato={addPlato}
                        onAddPersonal={addPersonal}
                        onAddTransporte={addTransporte}
                        onQtyChange={updateQty}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Columna del resumen - Sidebar fijo */}
          <div className="xl:col-span-1">
            <div className="sticky top-8">
              <Card className="bg-white/95 backdrop-blur-xl shadow-2xl border-white/40 rounded-3xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-emerald-50/90 to-green-50/90 border-b border-emerald-200/40 pb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold text-emerald-800">
                        {current.nombre_opcion}
                      </CardTitle>
                      <p className="text-emerald-600 text-sm mt-1">Resumen de costos</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0">
                  <ResumenCotizacion
                    invitados={invitados}
                    items={current.items}
                    total={subt.total}
                    subtotales={{
                      platos: subt.platos,
                      personal: subt.personal,
                      transportes: subt.transportes,
                    }}
                    onQtyChange={(tipo, id, qty) => updateQty(tipo, id, qty)}
                    onRemove={(tipo, id) => removeItem(tipo, id)}
                    onGuardar={handleSubmit(onSubmit)}
                    guardando={isPending}
                  />
                </CardContent>
              </Card>

              {/* Información adicional */}
              <div className="mt-6 p-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30">
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center space-x-2 text-slate-600">
                    <div className="w-2 h-2 bg-selecta-green rounded-full animate-pulse" />
                    <span className="text-sm font-medium">Sistema de Cotizaciones</span>
                  </div>

                  {opciones.length > 1 && (
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                      <p className="font-medium">💡 Consejo:</p>
                      <p>Usa múltiples opciones para dar alternativas claras a tu cliente.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botón flotante de guardar (solo mobile) */}
        <div className="xl:hidden fixed bottom-6 right-6 z-50">
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={isPending}
            className="w-16 h-16 bg-gradient-to-r from-selecta-green to-primary hover:from-primary hover:to-selecta-green shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 rounded-full border-0 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
            {isPending ? (
              <div className="animate-spin">
                <Save className="h-6 w-6 relative z-10" />
              </div>
            ) : (
              <Save className="h-6 w-6 relative z-10" />
            )}
          </Button>
        </div>

        {/* Footer informativo */}
        <div className="text-center mt-12 pt-8">
          <div className="inline-flex items-center justify-center space-x-4 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/30">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-slate-600">Cotizador profesional</span>
            </div>
            <div className="w-px h-4 bg-slate-300" />
            <div className="flex items-center space-x-2">
              <Calculator className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-500">
                {opciones.length} opción(es) • {invitados} invitados
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
