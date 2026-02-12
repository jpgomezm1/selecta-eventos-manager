import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

import {
  getPlatosCatalogo,
  getTransporteTarifas,
  getPersonalCostosCatalogo,
  createCotizacionWithVersions,
  savePersonalAsignaciones,
} from "@/integrations/supabase/apiCotizador";
import { menajeCatalogoList } from "@/integrations/supabase/apiMenaje";

import type {
  CotizacionWithVersionsDraft,
  CotizacionItemsState,
  PlatoCatalogo,
  PersonalCosto,
  TransporteTarifa,
  PersonalAsignacion,
} from "@/types/cotizador";
import type { MenajeCatalogo } from "@/types/menaje";

import { ResumenCotizacion } from "@/components/Cotizador/ResumenCotizacion";
import { CotizadorStepper } from "@/components/Cotizador/CotizadorStepper";
import { PlatosSelector } from "@/components/Cotizador/PlatosSelector";
import { PersonalSelector } from "@/components/Cotizador/PersonalSelector";
import { TransporteSelector } from "@/components/Cotizador/TransporteSelector";
import { MenajeSelector } from "@/components/Cotizador/MenajeSelector";

import {
  Users,
  Calendar,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Copy,
  Phone,
  Mail,
  Clock,
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Utensils,
  Truck,
  CheckCircle2,
  Eye,
} from "lucide-react";

type FormValues = {
  nombre_cotizacion: string;
  cliente_nombre: string;
  numero_invitados: number;
  fecha_evento_estimada?: string;
  ubicacion_evento?: string;
  comercial_encargado: string;
  contacto_telefono?: string;
  contacto_correo?: string;
  hora_inicio?: string;
  hora_fin?: string;
  hora_montaje_inicio?: string;
  hora_montaje_fin?: string;
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
      contacto_telefono: "",
      contacto_correo: "",
      hora_inicio: "",
      hora_fin: "",
      hora_montaje_inicio: "",
      hora_montaje_fin: "",
    },
  });

  const invitados = watch("numero_invitados") || 0;
  const nombreCotizacion = watch("nombre_cotizacion");

  // Wizard step
  const [currentStep, setCurrentStep] = useState(1);

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
  const { data: menajeCatalogo } = useQuery({
    queryKey: ["menaje-catalogo"],
    queryFn: menajeCatalogoList,
  });

  // Opciones de cotización (al menos una)
  const [opciones, setOpciones] = useState<OpcionState[]>([
    {
      key: crypto.randomUUID(),
      nombre_opcion: "Opción A",
      items: { platos: [], personal: [], transportes: [], menaje: [] },
    },
  ]);
  const [activeKey, setActiveKey] = useState(opciones[0].key);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const current = opciones.find((o) => o.key === activeKey)!;

  // Helpers cantidades + totales
  const calcSubtotales = (it: CotizacionItemsState) => {
    const platos = it.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0);
    const personal = it.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0);
    const transportes = it.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0);
    const menaje = (it.menaje ?? []).reduce((a, m) => a + m.precio_alquiler * m.cantidad, 0);
    return { platos, personal, transportes, menaje, total: platos + personal + transportes + menaje };
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
        items: { platos: [], personal: [], transportes: [], menaje: [] },
      },
    ]);
    setActiveKey(key);
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
        items: JSON.parse(JSON.stringify(source.items)),
      },
    ]);
    setActiveKey(key);
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

  const addMenaje = (m: MenajeCatalogo) =>
    mutateAdd((it) => {
      const menaje = it.menaje ?? [];
      const idx = menaje.findIndex((x) => x.menaje_id === m.id);
      if (idx >= 0) {
        const copy = [...menaje];
        copy[idx] = { ...copy[idx], cantidad: copy[idx].cantidad + 1 };
        return { ...it, menaje: copy };
      }
      return {
        ...it,
        menaje: [
          ...menaje,
          { menaje_id: m.id, nombre: m.nombre, precio_alquiler: Number(m.precio_alquiler), cantidad: 1 },
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
      if (tipo === "menaje")
        return {
          ...it,
          menaje: (it.menaje ?? []).map((x) =>
            x.menaje_id === id ? { ...x, cantidad: qty } : x
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
      if (tipo === "menaje")
        return { ...it, menaje: (it.menaje ?? []).filter((x) => x.menaje_id !== id) };
      return { ...it, transportes: it.transportes.filter((x) => x.transporte_id !== id) };
    });

  const toggleAsignacion = (costoId: string, persona: PersonalAsignacion) =>
    mutateAdd((it) => ({
      ...it,
      personal: it.personal.map((p) => {
        if (p.personal_costo_id !== costoId) return p;
        const current = p.asignados ?? [];
        const exists = current.some((a) => a.personal_id === persona.personal_id);
        return {
          ...p,
          asignados: exists
            ? current.filter((a) => a.personal_id !== persona.personal_id)
            : [...current, persona],
        };
      }),
    }));

  const { mutate: crear, isPending } = useMutation({
    mutationFn: async (payload: CotizacionWithVersionsDraft) => {
      const res = await createCotizacionWithVersions(payload);
      const { getCotizacionDetalle } = await import("@/integrations/supabase/apiCotizador");
      const detail = await getCotizacionDetalle(res.id);
      for (let i = 0; i < detail.versiones.length; i++) {
        const personalItems = opciones[i]?.items.personal ?? [];
        const hasAsignados = personalItems.some((p) => (p.asignados?.length ?? 0) > 0);
        if (hasAsignados) {
          await savePersonalAsignaciones(detail.versiones[i].id, personalItems);
        }
      }
      return res;
    },
    onSuccess: (res) => {
      toast({
        title: "¡Cotización creada exitosamente!",
        description: `"${nombreCotizacion}" se guardó con todas sus opciones.`,
      });
      reset();
      const newKey = crypto.randomUUID();
      setOpciones([
        { key: newKey, nombre_opcion: "Opción A", items: { platos: [], personal: [], transportes: [], menaje: [] } },
      ]);
      setActiveKey(newKey);
      setCurrentStep(1);
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
        estado: "Pendiente por Aprobación" as const,
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
        estado: "Pendiente por Aprobación",
        contacto_telefono: v.contacto_telefono?.trim() || null,
        contacto_correo: v.contacto_correo?.trim() || null,
        hora_inicio: v.hora_inicio || null,
        hora_fin: v.hora_fin || null,
        hora_montaje_inicio: v.hora_montaje_inicio || null,
        hora_montaje_fin: v.hora_montaje_fin || null,
      },
      versiones,
    };
    crear(payload);
  };

  // Totales de la pestaña activa para el Resumen
  const subt = calcSubtotales(current.items);

  // Stepper steps definition
  const steps = useMemo(
    () => [
      {
        index: 1,
        label: "Información del Evento",
        icon: ClipboardList,
        isComplete: !!nombreCotizacion?.trim() && !!watch("comercial_encargado")?.trim(),
        isSkippable: false,
      },
      {
        index: 2,
        label: "Menú y Platos",
        icon: Utensils,
        isComplete: current.items.platos.length > 0,
        isSkippable: true,
      },
      {
        index: 3,
        label: "Personal",
        icon: Users,
        isComplete: current.items.personal.length > 0,
        isSkippable: true,
      },
      {
        index: 4,
        label: "Logística",
        icon: Truck,
        isComplete: current.items.transportes.length > 0 || (current.items.menaje ?? []).length > 0,
        isSkippable: true,
      },
      {
        index: 5,
        label: "Resumen",
        icon: CheckCircle2,
        isComplete: false,
        isSkippable: false,
      },
    ],
    [nombreCotizacion, watch("comercial_encargado"), current.items]
  );

  // Navigation
  const goNext = () => {
    if (currentStep === 1) {
      const nombre = watch("nombre_cotizacion");
      const comercial = watch("comercial_encargado");
      if (!nombre?.trim() || !comercial?.trim()) {
        toast({
          title: "Campos requeridos",
          description: "Completa el nombre de la cotización y el comercial encargado antes de continuar",
          variant: "destructive",
        });
        return;
      }
    }
    setCurrentStep((s) => Math.min(s + 1, 5));
  };
  const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 1));
  const goToStep = (step: number) => setCurrentStep(step);

  // Option tabs renderer (reusable across steps 2-5)
  const renderOptionTabs = () => (
    <div className="mb-6">
      <Tabs value={activeKey} onValueChange={(v) => setActiveKey(v)} className="w-full">
        <div className="flex items-center justify-between">
          <TabsList className="flex-1 mr-4 bg-slate-100 rounded-lg p-1">
            {opciones.map((o) => (
              <TabsTrigger
                key={o.key}
                value={o.key}
                className="flex-1 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-selecta-green rounded-md font-semibold transition-all duration-200"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      o.key === activeKey ? "bg-selecta-green" : "bg-slate-400"
                    }`}
                  />
                  <span className="truncate">{o.nombre_opcion}</span>
                </div>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={addOpcion}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Agregar</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => duplicateOpcion(activeKey)}>
              <Copy className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Duplicar</span>
            </Button>
          </div>
        </div>
      </Tabs>

      {/* Option header with name editing and delete */}
      <div className="flex items-center justify-between mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center space-x-3">
          {editingOption === current.key ? (
            <div className="flex items-center space-x-2">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="max-w-xs h-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveOptionName();
                  if (e.key === "Escape") cancelEditingOption();
                }}
                autoFocus
              />
              <Button variant="ghost" size="sm" onClick={saveOptionName} className="text-green-600 hover:bg-green-50">
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={cancelEditingOption} className="text-red-600 hover:bg-red-50">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold text-slate-800">{current.nombre_opcion}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEditingOption(current.key, current.nombre_opcion)}
                className="text-slate-500 hover:text-selecta-green"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-3 text-sm">
            <Badge variant="outline" className="bg-white">
              <div className="w-2 h-2 bg-orange-400 rounded-full mr-1.5" />
              {current.items.platos.length} platos
            </Badge>
            <Badge variant="outline" className="bg-white">
              <div className="w-2 h-2 bg-blue-400 rounded-full mr-1.5" />
              {current.items.personal.length} personal
            </Badge>
            <Badge variant="outline" className="bg-white">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-1.5" />
              {current.items.transportes.length} transportes
            </Badge>
            <Badge variant="outline" className="bg-white">
              <div className="w-2 h-2 bg-purple-400 rounded-full mr-1.5" />
              {(current.items.menaje ?? []).length} menaje
            </Badge>
          </div>

          {opciones.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeOpcion(current.key)}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 pb-28">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Nueva Cotización</h1>
        <p className="text-slate-500 mt-1">Crea presupuestos profesionales paso a paso</p>
      </div>

      {/* Stepper */}
      <CotizadorStepper steps={steps} currentStep={currentStep} onStepClick={goToStep} />

      <div className="mt-8">
        {/* ─── Step 1: Información del Evento ─── */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Información del Evento
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Nombre de la Cotización *
                  </label>
                  <Input
                    placeholder="Ej: Boda María & Juan - Diciembre 2024"
                    {...register("nombre_cotizacion")}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>Cliente</span>
                  </label>
                  <Input
                    placeholder="Nombre del cliente"
                    {...register("cliente_nombre")}
                    className="h-12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>Número de Invitados</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="50"
                    {...register("numero_invitados", { valueAsNumber: true })}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>Fecha Estimada del Evento</span>
                  </label>
                  <Input
                    type="date"
                    {...register("fecha_evento_estimada")}
                    className="h-12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Comercial Encargado *
                  </label>
                  <Input
                    placeholder="Nombre del comercial responsable"
                    {...register("comercial_encargado")}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Ubicación del Evento
                  </label>
                  <Input
                    placeholder="Ej: Hacienda Los Robles, Chía"
                    {...register("ubicacion_evento")}
                    className="h-12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>Teléfono de Contacto</span>
                  </label>
                  <Input
                    type="tel"
                    placeholder="Ej: 300 123 4567"
                    {...register("contacto_telefono")}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>Correo Electrónico</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="Ej: cliente@correo.com"
                    {...register("contacto_correo")}
                    className="h-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>Horarios del Evento (opcional)</span>
                </label>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Hora inicio</label>
                    <Input type="time" {...register("hora_inicio")} className="h-12" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Hora fin</label>
                    <Input type="time" {...register("hora_fin")} className="h-12" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span>Horarios de Montaje (opcional)</span>
                </label>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Hora inicio montaje</label>
                    <Input type="time" {...register("hora_montaje_inicio")} className="h-12" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-500">Hora fin montaje</label>
                    <Input type="time" {...register("hora_montaje_fin")} className="h-12" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Step 2: Menú y Platos ─── */}
        {currentStep === 2 && (
          <div>
            {renderOptionTabs()}
            <PlatosSelector
              data={platos ?? []}
              onAdd={addPlato}
              itemsSeleccionados={current.items.platos.map((p) => ({
                plato_id: p.plato_id,
                cantidad: p.cantidad,
              }))}
              onQtyChange={(id, qty) => updateQty("platos", id, qty)}
            />
          </div>
        )}

        {/* ─── Step 3: Personal de Servicio ─── */}
        {currentStep === 3 && (
          <div>
            {renderOptionTabs()}
            <PersonalSelector
              data={personalCostos ?? []}
              onAdd={addPersonal}
              itemsSeleccionados={current.items.personal.map((p) => ({
                personal_costo_id: p.personal_costo_id,
                cantidad: p.cantidad,
                asignados: p.asignados,
              }))}
              onQtyChange={(id, qty) => updateQty("personal", id, qty)}
              invitados={invitados}
              onToggleAsignacion={toggleAsignacion}
            />
          </div>
        )}

        {/* ─── Step 4: Logística (Transporte + Menaje) ─── */}
        {currentStep === 4 && (
          <div>
            {renderOptionTabs()}
            <Tabs defaultValue="transporte" className="w-full">
              <TabsList className="mb-4 bg-slate-100 rounded-lg p-1">
                <TabsTrigger value="transporte" className="rounded-md">
                  <Truck className="h-4 w-4 mr-2" />
                  Transporte
                  {current.items.transportes.length > 0 && (
                    <Badge className="ml-2 bg-green-100 text-green-700 text-xs">
                      {current.items.transportes.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="menaje" className="rounded-md">
                  Menaje
                  {(current.items.menaje ?? []).length > 0 && (
                    <Badge className="ml-2 bg-purple-100 text-purple-700 text-xs">
                      {(current.items.menaje ?? []).length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="transporte">
                <TransporteSelector
                  data={transportes ?? []}
                  onAdd={addTransporte}
                  itemsSeleccionados={current.items.transportes.map((t) => ({
                    transporte_id: t.transporte_id,
                    cantidad: t.cantidad,
                  }))}
                  onQtyChange={(id, qty) => updateQty("transportes", id, qty)}
                />
              </TabsContent>
              <TabsContent value="menaje">
                <MenajeSelector
                  data={menajeCatalogo ?? []}
                  onAdd={addMenaje}
                  itemsSeleccionados={(current.items.menaje ?? []).map((m) => ({
                    menaje_id: m.menaje_id,
                    cantidad: m.cantidad,
                  }))}
                  onQtyChange={(id, qty) => updateQty("menaje", id, qty)}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* ─── Step 5: Resumen y Guardado ─── */}
        {currentStep === 5 && (
          <div>
            {renderOptionTabs()}
            <ResumenCotizacion
              invitados={invitados}
              items={current.items}
              total={subt.total}
              subtotales={{
                platos: subt.platos,
                personal: subt.personal,
                transportes: subt.transportes,
                menaje: subt.menaje,
              }}
              onQtyChange={(tipo, id, qty) => updateQty(tipo, id, qty)}
              onRemove={(tipo, id) => removeItem(tipo, id)}
              onGuardar={handleSubmit(onSubmit)}
              guardando={isPending}
              fullWidth
            />
          </div>
        )}

        {/* ─── Navigation buttons ─── */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={currentStep === 1}
            className="h-11"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Anterior
          </Button>

          {currentStep < 5 ? (
            <Button onClick={goNext} className="h-11 bg-selecta-green hover:bg-selecta-green/90">
              Siguiente
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* ─── Floating mini-summary bar (steps 1-4) ─── */}
      {currentStep < 5 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-x-auto">
              <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                {current.nombre_opcion}
              </span>
              <div className="hidden sm:flex items-center space-x-2">
                {current.items.platos.length > 0 && (
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mr-1" />
                    {current.items.platos.length} platos
                  </Badge>
                )}
                {current.items.personal.length > 0 && (
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1" />
                    {current.items.personal.length} personal
                  </Badge>
                )}
                {current.items.transportes.length > 0 && (
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1" />
                    {current.items.transportes.length} transportes
                  </Badge>
                )}
                {(current.items.menaje ?? []).length > 0 && (
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mr-1" />
                    {(current.items.menaje ?? []).length} menaje
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-lg font-bold text-emerald-600 whitespace-nowrap">
                $ {subt.total.toLocaleString()}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentStep(5)}
                className="whitespace-nowrap"
              >
                <Eye className="h-4 w-4 mr-1" />
                Ver Resumen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
