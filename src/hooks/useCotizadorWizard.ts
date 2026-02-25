import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import type {
  CotizacionItemsState,
  PlatoCatalogo,
  PersonalCosto,
  TransporteTarifa,
  PersonalAsignacion,
  LugarOption,
} from "@/types/cotizador";
import type { MenajeCatalogo } from "@/types/menaje";
import type { Cliente } from "@/integrations/supabase/apiClientes";

export type OpcionState = {
  key: string;
  nombre_opcion: string;
  items: CotizacionItemsState;
};

export function useCotizadorWizard() {
  const { toast } = useToast();

  // Wizard step
  const [currentStep, setCurrentStep] = useState(1);

  // Cliente selector state
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  // Lugares state
  const [lugares, setLugares] = useState<LugarOption[]>([
    { nombre: "", es_seleccionado: true },
  ]);

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
  const calcSubtotales = useCallback((it: CotizacionItemsState) => {
    const platos = it.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0);
    const personal = it.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0);
    const transportes = it.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0);
    const menaje = (it.menaje ?? []).reduce((a, m) => a + m.precio_alquiler * m.cantidad, 0);
    return { platos, personal, transportes, menaje, total: platos + personal + transportes + menaje };
  }, []);

  const addOpcion = useCallback(() => {
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
  }, [opciones.length, toast]);

  const duplicateOpcion = useCallback((sourceKey: string) => {
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
  }, [opciones, toast]);

  const startEditingOption = useCallback((key: string, currentName: string) => {
    setEditingOption(key);
    setEditingName(currentName);
  }, []);

  const saveOptionName = useCallback(() => {
    if (editingOption && editingName.trim()) {
      setOpciones((prev) =>
        prev.map((o) => (o.key === editingOption ? { ...o, nombre_opcion: editingName.trim() } : o))
      );
      setEditingOption(null);
      setEditingName("");
    }
  }, [editingOption, editingName]);

  const cancelEditingOption = useCallback(() => {
    setEditingOption(null);
    setEditingName("");
  }, []);

  const removeOpcion = useCallback((key: string) => {
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
  }, [opciones, toast]);

  const mutateAdd = useCallback(
    (updater: (it: CotizacionItemsState) => CotizacionItemsState) => {
      setOpciones((prev) =>
        prev.map((o) => (o.key === activeKey ? { ...o, items: updater(o.items) } : o))
      );
    },
    [activeKey]
  );

  const addPlato = useCallback(
    (plato: PlatoCatalogo) =>
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
      }),
    [mutateAdd]
  );

  const addPersonal = useCallback(
    (p: PersonalCosto) =>
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
      }),
    [mutateAdd]
  );

  const addTransporte = useCallback(
    (t: TransporteTarifa) =>
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
      }),
    [mutateAdd]
  );

  const addMenaje = useCallback(
    (m: MenajeCatalogo) =>
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
      }),
    [mutateAdd]
  );

  const updateQty = useCallback(
    (tipo: keyof CotizacionItemsState, id: string, qty: number) =>
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
      }),
    [mutateAdd]
  );

  const removeItem = useCallback(
    (tipo: keyof CotizacionItemsState, id: string) =>
      mutateAdd((it) => {
        if (tipo === "platos") return { ...it, platos: it.platos.filter((x) => x.plato_id !== id) };
        if (tipo === "personal")
          return { ...it, personal: it.personal.filter((x) => x.personal_costo_id !== id) };
        if (tipo === "menaje")
          return { ...it, menaje: (it.menaje ?? []).filter((x) => x.menaje_id !== id) };
        return { ...it, transportes: it.transportes.filter((x) => x.transporte_id !== id) };
      }),
    [mutateAdd]
  );

  const toggleAsignacion = useCallback(
    (costoId: string, persona: PersonalAsignacion) =>
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
      })),
    [mutateAdd]
  );

  // Navigation
  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, 5));
  }, []);

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  // Reset everything
  const resetWizard = useCallback(() => {
    const newKey = crypto.randomUUID();
    setOpciones([
      { key: newKey, nombre_opcion: "Opción A", items: { platos: [], personal: [], transportes: [], menaje: [] } },
    ]);
    setActiveKey(newKey);
    setCurrentStep(1);
    setSelectedCliente(null);
    setLugares([{ nombre: "", es_seleccionado: true }]);
  }, []);

  const subt = calcSubtotales(current.items);

  return {
    currentStep,
    setCurrentStep,
    selectedCliente,
    setSelectedCliente,
    lugares,
    setLugares,
    opciones,
    setOpciones,
    activeKey,
    setActiveKey,
    editingOption,
    editingName,
    setEditingName,
    current,
    calcSubtotales,
    addOpcion,
    duplicateOpcion,
    startEditingOption,
    saveOptionName,
    cancelEditingOption,
    removeOpcion,
    addPlato,
    addPersonal,
    addTransporte,
    addMenaje,
    updateQty,
    removeItem,
    toggleAsignacion,
    goNext,
    goPrev,
    goToStep,
    resetWizard,
    subt,
  };
}
