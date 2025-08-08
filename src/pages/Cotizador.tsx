import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate } from "react-router-dom";

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

import { PlatosSelector } from "@/components/Cotizador/PlatosSelector";
import { PersonalSelector } from "@/components/Cotizador/PersonalSelector";
import { TransporteSelector } from "@/components/Cotizador/TransporteSelector";
import { ResumenCotizacion } from "@/components/Cotizador/ResumenCotizacion";

type FormValues = {
  nombre_cotizacion: string;
  cliente_nombre: string;
  numero_invitados: number;
  fecha_evento_estimada?: string;
};

type OpcionState = {
  key: string;
  nombre_opcion: string;
  items: CotizacionItemsState;
};

export default function CotizadorNuevaPage() {
  const nav = useNavigate();
  const { toast } = useToast();

  const { register, handleSubmit, watch, reset } = useForm<FormValues>({
    defaultValues: {
      nombre_cotizacion: "",
      cliente_nombre: "",
      numero_invitados: 50,
      fecha_evento_estimada: "",
    },
  });

  const invitados = watch("numero_invitados") || 0;

  // Catálogos
  const { data: platos } = useQuery({ queryKey: ["platosCatalogo"], queryFn: getPlatosCatalogo });
  const { data: transportes } = useQuery({ queryKey: ["transporteTarifas"], queryFn: getTransporteTarifas });
  const { data: personalCostos } = useQuery({ queryKey: ["personalCostosCatalogo"], queryFn: getPersonalCostosCatalogo });

  // Opciones de cotización (al menos una)
  const [opciones, setOpciones] = useState<OpcionState[]>([
    { key: crypto.randomUUID(), nombre_opcion: "Opción A", items: { platos: [], personal: [], transportes: [] } },
  ]);
  const [activeKey, setActiveKey] = useState(opciones[0].key);

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
    setOpciones((prev) => [...prev, { key, nombre_opcion: `Opción ${String.fromCharCode(64 + nextIndex)}`, items: { platos: [], personal: [], transportes: [] } }]);
    setActiveKey(key);
  };

  const renameOpcion = (key: string, nombre: string) => {
    setOpciones((prev) => prev.map((o) => (o.key === key ? { ...o, nombre_opcion: nombre } : o)));
  };

  const removeOpcion = (key: string) => {
    if (opciones.length === 1) return;
    const idx = opciones.findIndex((o) => o.key === key);
    const newArr = opciones.filter((o) => o.key !== key);
    setOpciones(newArr);
    setActiveKey(newArr[Math.max(0, idx - 1)].key);
  };

  const mutateAdd = (updater: (it: CotizacionItemsState) => CotizacionItemsState) => {
    setOpciones((prev) =>
      prev.map((o) => (o.key === activeKey ? { ...o, items: updater(o.items) } : o))
    );
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
        platos: [...it.platos, { plato_id: plato.id, nombre: plato.nombre, precio_unitario: Number(plato.precio), cantidad: 1 }],
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
        personal: [...it.personal, { personal_costo_id: p.id, rol: p.rol, tarifa_estimada_por_persona: Number(p.tarifa), cantidad: 1 }],
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
        transportes: [...it.transportes, { transporte_id: t.id, lugar: t.lugar, tarifa_unitaria: Number(t.tarifa), cantidad: 1 }],
      };
    });

  const updateQty = (tipo: keyof CotizacionItemsState, id: string, qty: number) =>
    mutateAdd((it) => {
      if (qty < 1) return it;
      if (tipo === "platos") return { ...it, platos: it.platos.map((x) => (x.plato_id === id ? { ...x, cantidad: qty } : x)) };
      if (tipo === "personal") return { ...it, personal: it.personal.map((x) => (x.personal_costo_id === id ? { ...x, cantidad: qty } : x)) };
      return { ...it, transportes: it.transportes.map((x) => (x.transporte_id === id ? { ...x, cantidad: qty } : x)) };
    });

  const removeItem = (tipo: keyof CotizacionItemsState, id: string) =>
    mutateAdd((it) => {
      if (tipo === "platos") return { ...it, platos: it.platos.filter((x) => x.plato_id !== id) };
      if (tipo === "personal") return { ...it, personal: it.personal.filter((x) => x.personal_costo_id !== id) };
      return { ...it, transportes: it.transportes.filter((x) => x.transporte_id !== id) };
    });

  const { mutate: crear, isPending } = useMutation({
    mutationFn: (payload: CotizacionWithVersionsDraft) => createCotizacionWithVersions(payload),
    onSuccess: (res) => {
      toast({ title: "Cotización creada", description: "Se guardó con sus opciones." });
      reset();
      setOpciones([{ key: crypto.randomUUID(), nombre_opcion: "Opción A", items: { platos: [], personal: [], transportes: [] } }]);
      setActiveKey(opciones[0].key);
      nav(`/cotizador/${res.id}`);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message ?? "No se pudo crear.", variant: "destructive" });
    },
  });

  const onSubmit = (v: FormValues) => {
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
        nombre_cotizacion: v.nombre_cotizacion,
        cliente_nombre: v.cliente_nombre || null,
        numero_invitados: Number(v.numero_invitados),
        fecha_evento_estimada: v.fecha_evento_estimada ? new Date(v.fecha_evento_estimada) : null,
        total_cotizado: versiones[0]?.total ?? 0,
        estado: "Borrador",
      },
      versiones,
    };
    crear(payload);
  };

  // Totales de la pestaña activa para el Resumen
  const subt = calcSubtotales(current.items);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-2 lg:p-6">
      <div className="lg:col-span-2 space-y-6">
        <Card className="shadow-soft">
          <CardHeader><CardTitle>Datos del evento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input placeholder="Nombre de la cotización" {...register("nombre_cotizacion")} />
              <Input placeholder="Cliente" {...register("cliente_nombre")} />
              <Input type="number" min={1} placeholder="Invitados" {...register("numero_invitados", { valueAsNumber: true })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input type="date" {...register("fecha_evento_estimada")} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle>Opciones de cotización</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeKey} onValueChange={setActiveKey} className="w-full">
              <TabsList className="flex overflow-x-auto gap-2">
                {opciones.map((o, idx) => (
                  <TabsTrigger key={o.key} value={o.key} className="whitespace-nowrap">
                    {o.nombre_opcion}
                  </TabsTrigger>
                ))}
                <Button variant="outline" size="sm" className="ml-2" onClick={addOpcion}>+ Opción</Button>
              </TabsList>

              {opciones.map((o) => (
                <TabsContent key={o.key} value={o.key} className="mt-6 space-y-4">
                  <div className="flex gap-2 items-center">
                    <Input
                      className="max-w-xs"
                      value={o.nombre_opcion}
                      onChange={(e) => renameOpcion(o.key, e.target.value)}
                    />
                    {opciones.length > 1 && (
                      <Button variant="ghost" onClick={() => removeOpcion(o.key)}>Eliminar</Button>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-8">
                    <PlatosSelector
                      data={platos ?? []}
                      onAdd={addPlato}
                      itemsSeleccionados={o.items.platos}
                      onQtyChange={(id, qty) => updateQty("platos", id, qty)}
                    />

                    <Separator />

                    <PersonalSelector
                      data={personalCostos ?? []}
                      onAdd={addPersonal}
                      itemsSeleccionados={o.items.personal}
                      onQtyChange={(id, qty) => updateQty("personal", id, qty)}
                      invitados={invitados}
                    />

                    <Separator />

                    <TransporteSelector
                      data={transportes ?? []}
                      onAdd={addTransporte}
                      itemsSeleccionados={o.items.transportes}
                      onQtyChange={(id, qty) => updateQty("transportes", id, qty)}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <ResumenCotizacion
          invitados={invitados}
          items={current.items}
          total={subt.total}
          subtotales={{ platos: subt.platos, personal: subt.personal, transportes: subt.transportes }}
          onQtyChange={(tipo, id, qty) => updateQty(tipo, id, qty)}
          onRemove={(tipo, id) => removeItem(tipo, id)}
          onGuardar={handleSubmit(onSubmit)}
          guardando={isPending}
        />
      </div>
    </div>
  );
}
