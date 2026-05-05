import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPlatoConIngredientes,
  updatePlato,
  createPlato,
  upsertPlatoIngredientes,
  getIngredientesCatalogo,
} from "@/integrations/supabase/apiCotizador";
import type { PlatoCatalogo, PlatoIngrediente } from "@/types/cotizador";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import IngredienteBuscador from "./IngredienteBuscador";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Save, X, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateRecipeFromDescription } from "@/services/anthropic";

const CATEGORIAS = ["Bebida", "Entrada", "Fuerte", "Guarnición", "Pasaboca"];

interface Props {
  platoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PlatoDetailSheet({ platoId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isCreating = platoId === null;

  // Internal ID tracks the plato after creation
  const [internalPlatoId, setInternalPlatoId] = useState<string | null>(platoId);

  useEffect(() => {
    setInternalPlatoId(platoId);
  }, [platoId, open]);

  const effectiveId = internalPlatoId;

  // Plato data
  const { data: platoData, isLoading } = useQuery({
    queryKey: ["plato-detail", effectiveId],
    queryFn: () => getPlatoConIngredientes(effectiveId!),
    enabled: !!effectiveId && open,
  });

  // All ingredientes for combobox
  const { data: allIngredientes = [] } = useQuery({
    queryKey: ["ingredientes-catalogo"],
    queryFn: getIngredientesCatalogo,
  });

  // Editable plato fields
  const [form, setForm] = useState<Partial<PlatoCatalogo>>({});
  const [ingredientes, setIngredientes] = useState<Array<PlatoIngrediente>>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (platoData) {
      setForm({
        nombre: platoData.nombre,
        precio: platoData.precio,
        categoria: platoData.categoria,
        tipo_menu: platoData.tipo_menu,
        porciones_receta: platoData.porciones_receta,
        tiempo_preparacion: platoData.tiempo_preparacion,
        temperatura_coccion: platoData.temperatura_coccion,
        rendimiento: platoData.rendimiento,
        notas: platoData.notas,
        margen_ganancia: platoData.margen_ganancia,
      });
      setIngredientes(platoData.ingredientes ?? []);
    } else if (isCreating && !internalPlatoId) {
      setForm({ nombre: "", precio: 0, categoria: null, tipo_menu: "Menu General", margen_ganancia: null });
      setIngredientes([]);
    }
  }, [platoData, isCreating, internalPlatoId]);

  const createMut = useMutation({
    mutationFn: (data: Omit<PlatoCatalogo, "id" | "created_at" | "ingredientes">) => createPlato(data),
    onSuccess: async (created) => {
      queryClient.invalidateQueries({ queryKey: ["platos-catalogo"] });
      setInternalPlatoId(created.id);
      // Auto-guardar ingredientes pendientes (ej: generados por AI)
      if (ingredientes.length > 0) {
        try {
          await upsertPlatoIngredientes(
            created.id,
            ingredientes.map((i) => ({ ingrediente_id: i.ingrediente_id, cantidad: i.cantidad }))
          );
          queryClient.invalidateQueries({ queryKey: ["plato-detail", created.id] });
          queryClient.invalidateQueries({ queryKey: ["plato-ingredientes-all"] });
          toast({ title: "Plato creado con ingredientes" });
        } catch (err) {
          toast({
            title: "Plato creado",
            description: `No se pudieron guardar los ingredientes: ${err instanceof Error ? err.message : "Error desconocido"}. Guárdalos manualmente.`,
            variant: "destructive",
          });
        }
      } else {
        toast({ title: "Plato creado" });
      }
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: (updates: Partial<Omit<PlatoCatalogo, "id" | "created_at" | "ingredientes">>) =>
      updatePlato(effectiveId!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platos-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["plato-detail", effectiveId] });
      toast({ title: "Plato actualizado" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const upsertIngMut = useMutation({
    mutationFn: (items: Array<{ ingrediente_id: string; cantidad: number }>) =>
      upsertPlatoIngredientes(effectiveId!, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plato-detail", effectiveId] });
      queryClient.invalidateQueries({ queryKey: ["plato-ingredientes-all"] });
      toast({ title: "Ingredientes guardados" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Costo de ingredientes (calculado desde la receta)
  const costoTotal = useMemo(
    () => ingredientes.reduce((sum, i) => sum + i.cantidad * (i.ingrediente?.costo_por_unidad ?? 0), 0),
    [ingredientes]
  );
  const costoPorcion = form.porciones_receta ? costoTotal / form.porciones_receta : 0;

  // Precio de venta = input manual (proveniente del portafolio comercial).
  // Margen bruto sobre costo = métrica derivada (informativa), NO determina precio.
  const precioVenta = form.precio ?? 0;
  const margenBrutoPct =
    costoPorcion > 0 && precioVenta > 0 ? ((precioVenta - costoPorcion) / costoPorcion) * 100 : null;

  const handleSavePlato = () => {
    if (!form.nombre?.trim()) {
      toast({ title: "Nombre requerido", description: "Ingresa el nombre del plato antes de guardar.", variant: "destructive" });
      return;
    }
    const precioFinal = Math.round(form.precio ?? 0);

    if (!effectiveId) {
      createMut.mutate({
        nombre: form.nombre ?? "",
        precio: precioFinal,
        categoria: form.categoria ?? null,
        tipo_menu: form.tipo_menu ?? "Menu General",
        porciones_receta: form.porciones_receta ?? null,
        tiempo_preparacion: form.tiempo_preparacion ?? null,
        temperatura_coccion: form.temperatura_coccion ?? null,
        rendimiento: form.rendimiento ?? null,
        notas: form.notas ?? null,
        margen_ganancia: form.margen_ganancia ?? null,
      });
    } else {
      const { ingredientes: _ingredientes, ...updates } = form as Partial<PlatoCatalogo> & { ingredientes?: unknown };
      updateMut.mutate({ ...updates, precio: precioFinal }, {
        onSuccess: () => {
          // Also save ingredients when updating plato
          upsertIngMut.mutate(
            ingredientes.map((i) => ({ ingrediente_id: i.ingrediente_id, cantidad: i.cantidad }))
          );
        },
      });
    }
  };

  const handleAddIngrediente = (ingredienteId: string, cantidad: number) => {
    const ing = allIngredientes.find((i) => i.id === ingredienteId);
    if (!ing) return;
    setIngredientes([
      ...ingredientes,
      {
        id: `temp-${Date.now()}`,
        plato_id: effectiveId ?? "",
        ingrediente_id: ingredienteId,
        cantidad,
        ingrediente: ing,
      },
    ]);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const result = await generateRecipeFromDescription(aiPrompt, allIngredientes);
      setForm({
        ...form,
        nombre: result.nombre || form.nombre,
        categoria: result.categoria || form.categoria,
        tipo_menu: result.tipo_menu || form.tipo_menu,
        porciones_receta: result.porciones_receta || form.porciones_receta,
        tiempo_preparacion: result.tiempo_preparacion || form.tiempo_preparacion,
        temperatura_coccion: result.temperatura_coccion || form.temperatura_coccion,
        rendimiento: result.rendimiento || form.rendimiento,
        notas: result.notas || form.notas,
      });
      if (result.ingredientes?.length) {
        setIngredientes(
          result.ingredientes
            .filter((ri) => allIngredientes.some((ai) => ai.id === ri.ingrediente_id))
            .map((ri) => ({
              id: `temp-${Date.now()}-${ri.ingrediente_id}`,
              plato_id: effectiveId ?? "",
              ingrediente_id: ri.ingrediente_id,
              cantidad: ri.cantidad,
              ingrediente: allIngredientes.find((ai) => ai.id === ri.ingrediente_id),
            }))
        );
      }
      toast({ title: "Receta generada", description: "Revisa los datos y ajusta lo que necesites." });
    } catch (e) {
      toast({ title: "Error al generar receta", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const removeIngrediente = (ingredienteId: string) => {
    setIngredientes(ingredientes.filter((i) => i.ingrediente_id !== ingredienteId));
  };

  const updateCantidad = (ingredienteId: string, cantidad: number) => {
    setIngredientes(ingredientes.map((i) => i.ingrediente_id === ingredienteId ? { ...i, cantidad } : i));
  };

  const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

  // Ingredientes available for adding (not already in list)
  const availableIngredientes = allIngredientes.filter(
    (i) => !ingredientes.some((pi) => pi.ingrediente_id === i.id)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{!effectiveId ? "Nuevo plato" : platoData?.nombre ?? "Detalle del plato"}</SheetTitle>
        </SheetHeader>

        {effectiveId && isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted/70" />
            <p className="text-sm italic text-muted-foreground">Cargando plato…</p>
          </div>
        ) : (
          <div className="space-y-8 mt-6">
            {/* AI Recipe Generator — only in creation mode */}
            {isCreating && !effectiveId && (
              <section className="p-4 bg-muted/40 rounded-md border border-border space-y-3">
                <h3 className="kicker flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} /> Generar receta con AI
                </h3>
                <Textarea
                  placeholder="Describe el plato que quieres crear... Ej: Un risotto de champiñones con queso parmesano para 10 personas"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  className="bg-card"
                />
                <Button
                  onClick={handleGenerateAI}
                  disabled={aiLoading || !aiPrompt.trim()}
                  size="sm"
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Generando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" strokeWidth={1.75} /> Generar receta
                    </>
                  )}
                </Button>
              </section>
            )}

            {/* Info del plato */}
            <section className="space-y-4">
              <h3 className="kicker">Información del plato</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                  <Input value={form.nombre ?? ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Precio de venta</label>
                  <Input
                    type="number"
                    value={form.precio ?? ""}
                    onChange={(e) => setForm({ ...form, precio: e.target.value ? Number(e.target.value) : 0 })}
                    placeholder="Ej: 43500"
                  />
                  <p className="text-[10px] text-muted-foreground">Precio del portafolio comercial</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                  <Select value={form.categoria ?? ""} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Tipo menú</label>
                  <Select value={form.tipo_menu ?? "Menu General"} onValueChange={(v) => setForm({ ...form, tipo_menu: v as PlatoCatalogo["tipo_menu"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Menu General">Menu General</SelectItem>
                      <SelectItem value="Armalo a tu Gusto">Armalo a tu Gusto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Porciones receta</label>
                  <Input type="number" value={form.porciones_receta ?? ""} onChange={(e) => setForm({ ...form, porciones_receta: Number(e.target.value) || null })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Tiempo preparación</label>
                  <Input value={form.tiempo_preparacion ?? ""} onChange={(e) => setForm({ ...form, tiempo_preparacion: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Temperatura cocción</label>
                  <Input value={form.temperatura_coccion ?? ""} onChange={(e) => setForm({ ...form, temperatura_coccion: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Rendimiento</label>
                  <Input value={form.rendimiento ?? ""} onChange={(e) => setForm({ ...form, rendimiento: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Notas</label>
                  <Textarea value={form.notas ?? ""} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} />
                </div>
              </div>
            </section>

            {/* Ingredientes */}
            <section className="space-y-4">
              <h3 className="kicker">Ingredientes</h3>
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ingrediente</TableHead>
                      <TableHead className="w-24">Cantidad</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="text-right">Costo unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ingredientes.map((pi) => (
                      <TableRow key={pi.ingrediente_id}>
                        <TableCell className="font-medium">{pi.ingrediente?.nombre ?? "—"}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={pi.cantidad}
                            onChange={(e) => updateCantidad(pi.ingrediente_id, Number(e.target.value))}
                            className="h-7 w-20"
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{pi.ingrediente?.unidad ?? ""}</TableCell>
                        <TableCell className="text-right">{fmt(pi.ingrediente?.costo_por_unidad ?? 0)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(pi.cantidad * (pi.ingrediente?.costo_por_unidad ?? 0))}</TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-10 w-10 sm:h-7 sm:w-7 text-muted-foreground hover:text-destructive" onClick={() => removeIngrediente(pi.ingrediente_id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {ingredientes.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">Sin ingredientes</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Add ingrediente */}
              <IngredienteBuscador
                availableIngredientes={availableIngredientes}
                onAdd={handleAddIngrediente}
              />

              {ingredientes.length > 0 && (
                <p className="text-xs text-muted-foreground">Los ingredientes se guardarán al {effectiveId ? "guardar" : "crear"} el plato.</p>
              )}
            </section>

            {/* Resumen costos + margen bruto (informativo) */}
            <section className="p-4 bg-muted/40 rounded-lg border space-y-3">
              <h3 className="kicker">Costos y rentabilidad</h3>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Costo total receta</span>
                <span className="font-semibold">{fmt(costoTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Costo por porción</span>
                <span className="font-semibold">{form.porciones_receta ? fmt(costoPorcion) : "—"}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-sm font-semibold text-foreground">Precio de venta</span>
                <span className="text-lg font-semibold text-primary tabular-nums">{fmt(precioVenta)}</span>
              </div>
              {costoPorcion > 0 && precioVenta > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ganancia bruta por porción</span>
                    <span className="font-semibold">{fmt(precioVenta - costoPorcion)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Margen bruto sobre costo</span>
                    <span className="font-semibold tabular-nums">
                      {margenBrutoPct != null ? `${margenBrutoPct.toFixed(0)}%` : "—"}
                    </span>
                  </div>
                </>
              )}
              <p className="text-[10px] text-muted-foreground">
                El precio de venta se ingresa manualmente arriba (viene del portafolio comercial). El margen bruto es informativo — no incluye costos del evento (personal, transporte, menaje, etc.).
              </p>
            </section>

            {/* Botón principal de guardar/crear */}
            <Button onClick={handleSavePlato} disabled={updateMut.isPending || createMut.isPending || upsertIngMut.isPending} className="w-full">
              <Save className="h-4 w-4 mr-2" /> {effectiveId ? "Guardar todo" : "Crear plato"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
