import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

import {
  getCotizacionDetalle,
  updateVersionCotizacion,
  savePersonalAsignaciones,
  loadPersonalAsignaciones,
  getPlatosCatalogo,
  getTransporteTarifas,
  getPersonalCostosCatalogo,
} from "@/integrations/supabase/apiCotizador";
import { menajeCatalogoList } from "@/integrations/supabase/apiMenaje";

import type {
  CotizacionItemsState,
  PlatoCatalogo,
  PersonalCosto,
  TransporteTarifa,
  PersonalAsignacion,
} from "@/types/cotizador";
import type { MenajeCatalogo } from "@/types/menaje";

import { CotizadorStepper } from "@/components/Cotizador/CotizadorStepper";
import { PlatosSelector } from "@/components/Cotizador/PlatosSelector";
import { PersonalSelector } from "@/components/Cotizador/PersonalSelector";
import { TransporteSelector } from "@/components/Cotizador/TransporteSelector";
import { MenajeSelector } from "@/components/Cotizador/MenajeSelector";
import { ResumenCotizacion } from "@/components/Cotizador/ResumenCotizacion";

import {
  ArrowLeft,
  ArrowRight,
  Utensils,
  Users,
  Truck,
  Package,
  CheckCircle2,
  FileText,
  Pencil,
} from "lucide-react";

export default function VersionEditorWizard() {
  const { id, versionId } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [editingItems, setEditingItems] = useState<CotizacionItemsState>({
    platos: [],
    personal: [],
    transportes: [],
    menaje: [],
  });
  const [versionName, setVersionName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load cotizacion data
  const { data, isLoading, error } = useQuery({
    queryKey: ["cotizacion", id],
    queryFn: () => getCotizacionDetalle(id!),
    enabled: !!id,
  });

  // Load catalogues
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

  // Initialize editing items from version data + asignaciones
  useEffect(() => {
    if (!data || !versionId || initialized) return;
    const version = data.versiones.find((v) => v.id === versionId);
    if (!version) return;

    const init = async () => {
      setVersionName(version.nombre_opcion);
      try {
        const asignaciones = await loadPersonalAsignaciones(versionId);
        const personalWithAsig = version.items.personal.map((p) => ({
          ...p,
          asignados: asignaciones[p.personal_costo_id] ?? [],
        }));
        setEditingItems({ ...version.items, personal: personalWithAsig });
      } catch {
        setEditingItems(version.items);
      }
      setInitialized(true);
    };
    init();
  }, [data, versionId, initialized]);

  const version = data?.versiones.find((v) => v.id === versionId);
  const invitados = data?.cotizacion.numero_invitados ?? 0;

  // Subtotals
  const calcSubtotales = (it: CotizacionItemsState) => {
    const platosTotal = it.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0);
    const personal = it.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0);
    const transportesTotal = it.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0);
    const menaje = (it.menaje ?? []).reduce((a, m) => a + m.precio_alquiler * m.cantidad, 0);
    return {
      platos: platosTotal,
      personal,
      transportes: transportesTotal,
      menaje,
      total: platosTotal + personal + transportesTotal + menaje,
    };
  };

  const subt = calcSubtotales(editingItems);

  // Item mutation helpers
  const mutate = (updater: (it: CotizacionItemsState) => CotizacionItemsState) => {
    setEditingItems((prev) => updater(prev));
  };

  const addPlato = (plato: PlatoCatalogo) =>
    mutate((it) => {
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
    mutate((it) => {
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
          { personal_costo_id: p.id, rol: p.rol, tarifa_estimada_por_persona: Number(p.tarifa) || 0, cantidad: 1 },
        ],
      };
    });

  const addTransporte = (t: TransporteTarifa) =>
    mutate((it) => {
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
    mutate((it) => {
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

  const updateQty = (tipo: keyof CotizacionItemsState, itemId: string, qty: number) =>
    mutate((it) => {
      if (qty <= 0) {
        // Remove item when quantity reaches 0
        if (tipo === "platos") return { ...it, platos: it.platos.filter((x) => x.plato_id !== itemId) };
        if (tipo === "personal") return { ...it, personal: it.personal.filter((x) => x.personal_costo_id !== itemId) };
        if (tipo === "menaje") return { ...it, menaje: (it.menaje ?? []).filter((x) => x.menaje_id !== itemId) };
        return { ...it, transportes: it.transportes.filter((x) => x.transporte_id !== itemId) };
      }
      if (tipo === "platos")
        return { ...it, platos: it.platos.map((x) => (x.plato_id === itemId ? { ...x, cantidad: qty } : x)) };
      if (tipo === "personal")
        return { ...it, personal: it.personal.map((x) => (x.personal_costo_id === itemId ? { ...x, cantidad: qty } : x)) };
      if (tipo === "menaje")
        return { ...it, menaje: (it.menaje ?? []).map((x) => (x.menaje_id === itemId ? { ...x, cantidad: qty } : x)) };
      return { ...it, transportes: it.transportes.map((x) => (x.transporte_id === itemId ? { ...x, cantidad: qty } : x)) };
    });

  const removeItem = (tipo: keyof CotizacionItemsState, itemId: string) =>
    mutate((it) => {
      if (tipo === "platos") return { ...it, platos: it.platos.filter((x) => x.plato_id !== itemId) };
      if (tipo === "personal") return { ...it, personal: it.personal.filter((x) => x.personal_costo_id !== itemId) };
      if (tipo === "menaje") return { ...it, menaje: (it.menaje ?? []).filter((x) => x.menaje_id !== itemId) };
      return { ...it, transportes: it.transportes.filter((x) => x.transporte_id !== itemId) };
    });

  const toggleAsignacion = (costoId: string, persona: PersonalAsignacion) =>
    mutate((it) => ({
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

  // Save mutation
  const { mutate: guardar, isPending: guardando } = useMutation({
    mutationFn: async () => {
      await updateVersionCotizacion(id!, versionId!, editingItems, versionName.trim() || undefined);
      await savePersonalAsignaciones(versionId!, editingItems.personal);
    },
    onSuccess: () => {
      toast({
        title: "Cambios guardados",
        description: "La versión ha sido actualizada exitosamente.",
      });
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
      nav(`/cotizaciones/${id}`);
    },
    onError: (e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Navigation
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const goNext = () => {
    setCurrentStep((s) => Math.min(s + 1, 5));
    scrollToTop();
  };
  const goPrev = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
    scrollToTop();
  };
  const goToStep = (step: number) => {
    setCurrentStep(step);
    scrollToTop();
  };

  // Stepper steps (5 steps, no "Información del Evento")
  const steps = useMemo(
    () => [
      {
        index: 1,
        label: "Menu y Platos",
        icon: Utensils,
        isComplete: editingItems.platos.length > 0,
        isSkippable: true,
        itemCount: editingItems.platos.length,
      },
      {
        index: 2,
        label: "Personal",
        icon: Users,
        isComplete: editingItems.personal.length > 0,
        isSkippable: true,
        itemCount: editingItems.personal.length,
      },
      {
        index: 3,
        label: "Transporte",
        icon: Truck,
        isComplete: editingItems.transportes.length > 0,
        isSkippable: true,
        itemCount: editingItems.transportes.length,
      },
      {
        index: 4,
        label: "Menaje",
        icon: Package,
        isComplete: (editingItems.menaje ?? []).length > 0,
        isSkippable: true,
        itemCount: (editingItems.menaje ?? []).length,
      },
      {
        index: 5,
        label: "Resumen",
        icon: CheckCircle2,
        isComplete: false,
        isSkippable: false,
      },
    ],
    [editingItems]
  );

  // Loading state
  if (isLoading || !initialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 rounded-full bg-muted/70 animate-pulse" />
          <p className="text-sm text-muted-foreground">Cargando versión...</p>
        </div>
      </div>
    );
  }

  if (error || !data || !version) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-4 text-center">
          <FileText className="h-8 w-8 text-destructive" strokeWidth={1.5} />
          <h3 className="text-lg font-semibold text-foreground">Error al cargar</h3>
          <p className="text-sm text-muted-foreground">No se pudo obtener la versión de la cotización</p>
          <Button onClick={() => nav(`/cotizaciones/${id}`)} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a la cotización
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 pb-28">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => nav(`/cotizaciones/${id}`)} size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <div className="flex items-center gap-2">
              {editingName ? (
                <Input
                  autoFocus
                  value={versionName}
                  onChange={(e) => setVersionName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") setEditingName(false);
                  }}
                  className="font-serif text-2xl font-semibold h-10 w-72 border-primary"
                />
              ) : (
                <h1
                  className="font-serif text-2xl font-semibold text-foreground cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
                  onClick={() => setEditingName(true)}
                >
                  {versionName || version.nombre_opcion}
                  <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-primary" strokeWidth={1.75} />
                </h1>
              )}
            </div>
            <p className="text-slate-500 mt-0.5 text-sm">
              {data.cotizacion.nombre_cotizacion} &middot; {invitados} invitados
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <CotizadorStepper steps={steps} currentStep={currentStep} onStepClick={goToStep} />

      <div className="mt-8">
        {/* Step 1: Platos */}
        {currentStep === 1 && (
          <PlatosSelector
            data={platos ?? []}
            onAdd={addPlato}
            itemsSeleccionados={editingItems.platos.map((p) => ({
              plato_id: p.plato_id,
              cantidad: p.cantidad,
            }))}
            onQtyChange={(itemId, qty) => updateQty("platos", itemId, qty)}
          />
        )}

        {/* Step 2: Personal */}
        {currentStep === 2 && (
          <PersonalSelector
            data={personalCostos ?? []}
            onAdd={addPersonal}
            itemsSeleccionados={editingItems.personal.map((p) => ({
              personal_costo_id: p.personal_costo_id,
              cantidad: p.cantidad,
              asignados: p.asignados,
            }))}
            onQtyChange={(itemId, qty) => updateQty("personal", itemId, qty)}
            invitados={invitados}
            onToggleAsignacion={toggleAsignacion}
          />
        )}

        {/* Step 3: Transporte */}
        {currentStep === 3 && (
          <TransporteSelector
            data={transportes ?? []}
            onAdd={addTransporte}
            itemsSeleccionados={editingItems.transportes.map((t) => ({
              transporte_id: t.transporte_id,
              cantidad: t.cantidad,
            }))}
            onQtyChange={(itemId, qty) => updateQty("transportes", itemId, qty)}
          />
        )}

        {/* Step 4: Menaje */}
        {currentStep === 4 && (
          <MenajeSelector
            data={menajeCatalogo ?? []}
            onAdd={addMenaje}
            itemsSeleccionados={(editingItems.menaje ?? []).map((m) => ({
              menaje_id: m.menaje_id,
              cantidad: m.cantidad,
            }))}
            onQtyChange={(itemId, qty) => updateQty("menaje", itemId, qty)}
          />
        )}

        {/* Step 5: Resumen */}
        {currentStep === 5 && (
          <ResumenCotizacion
            invitados={invitados}
            items={editingItems}
            total={subt.total}
            subtotales={{
              platos: subt.platos,
              personal: subt.personal,
              transportes: subt.transportes,
              menaje: subt.menaje,
            }}
            onQtyChange={(tipo, itemId, qty) => updateQty(tipo, itemId, qty)}
            onRemove={(tipo, itemId) => removeItem(tipo, itemId)}
            onGuardar={() => guardar()}
            guardando={guardando}
            fullWidth
          />
        )}
      </div>

      {/* Floating bottom bar (steps 1-4) */}
      {currentStep < 5 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[var(--shadow-elegant)]">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            {/* Left: Back button */}
            <Button
              variant="outline"
              onClick={goPrev}
              disabled={currentStep === 1}
              size="sm"
              className="h-9"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Anterior
            </Button>

            {/* Center: Summary badges + total */}
            <div className="flex items-center space-x-3 overflow-x-auto mx-4">
              <div className="hidden sm:flex items-center space-x-2">
                {editingItems.platos.length > 0 && (
                  <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                    <div className="w-1 h-1 bg-muted-foreground rounded-full mr-1.5" />
                    {editingItems.platos.length} platos
                  </Badge>
                )}
                {editingItems.personal.length > 0 && (
                  <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                    <div className="w-1 h-1 bg-muted-foreground rounded-full mr-1.5" />
                    {editingItems.personal.length} personal
                  </Badge>
                )}
                {editingItems.transportes.length > 0 && (
                  <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                    <div className="w-1 h-1 bg-muted-foreground rounded-full mr-1.5" />
                    {editingItems.transportes.length} transportes
                  </Badge>
                )}
                {(editingItems.menaje ?? []).length > 0 && (
                  <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                    <div className="w-1 h-1 bg-muted-foreground rounded-full mr-1.5" />
                    {(editingItems.menaje ?? []).length} menaje
                  </Badge>
                )}
              </div>
              <span className="text-lg font-semibold text-primary tabular-nums whitespace-nowrap">
                $ {subt.total.toLocaleString()}
              </span>
            </div>

            {/* Right: Skip + Next buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={goNext}
                size="sm"
                className="h-9 text-muted-foreground hover:text-foreground hidden sm:flex"
              >
                Saltar
              </Button>
              <Button onClick={goNext} size="sm" className="h-9">
                Siguiente
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
