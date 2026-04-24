import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ingredientesConStock,
  inventarioMovimientoCreate,
  inventarioMovimientoConfirmar,
  inventarioMovimientoUpdateFacturaUrl,
} from "@/integrations/supabase/apiInventario";
import { scanInvoice, type InvoiceExtractedItem, type InvoiceExtraction } from "@/services/invoiceScanner";
import { uploadFactura } from "@/services/facturaStorage";
import { convertirAUnidadBase } from "@/integrations/supabase/apiCotizador";

const PESO = new Set(["gr", "kg", "lb", "oz"]);
const VOLUMEN = new Set(["ml", "lt"]);

function sonUnidadesCompatibles(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return true;
  if (PESO.has(x) && PESO.has(y)) return true;
  if (VOLUMEN.has(x) && VOLUMEN.has(y)) return true;
  return false;
}
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, Loader2, Trash2, Plus, FileText, AlertTriangle, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

type Step = "upload" | "processing" | "review";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const confianzaConfig: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "bg-primary/10 text-primary border-primary/30" },
  media: { label: "Media", color: "bg-[hsl(30_55%_42%)]/10 text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]" },
  baja: { label: "Baja", color: "bg-[hsl(30_55%_42%)]/15 text-[hsl(30_55%_35%)] border-[hsl(30_40%_65%)]" },
  sin_match: { label: "Sin match", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

interface ReviewItem extends InvoiceExtractedItem {
  _key: number;
}

export default function FacturaIngresoDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Review state
  const [proveedor, setProveedor] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [fecha, setFecha] = useState("");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [notas, setNotas] = useState("");
  const [nextKey, setNextKey] = useState(0);

  const { data: ingredientes = [] } = useQuery({
    queryKey: ["ingredientes-stock"],
    queryFn: ingredientesConStock,
  });

  // --- File handling ---
  const handleFile = useCallback((f: File) => {
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast({ title: "Formato no soportado", description: "Usa JPG, PNG, WebP o PDF", variant: "destructive" });
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      toast({ title: "Archivo muy grande", description: "El tamaño máximo es 10MB", variant: "destructive" });
      return;
    }
    setFile(f);
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // --- AI Scan ---
  const scanMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("No file");
      return scanInvoice(file, ingredientes);
    },
    onSuccess: (result: InvoiceExtraction) => {
      setProveedor(result.proveedor || "");
      setNumeroFactura(result.numero_factura || "");
      setFecha(result.fecha || new Date().toISOString().slice(0, 10));
      setNotas(result.notas || "");
      let key = 0;
      setItems(
        result.items.map((item) => ({ ...item, _key: key++ }))
      );
      setNextKey(key);
      setStep("review");
    },
    onError: (err) => {
      toast({ title: "Error al escanear", description: err.message, variant: "destructive" });
      setStep("upload");
    },
  });

  function startScan() {
    setStep("processing");
    scanMut.mutate();
  }

  // --- Item editing ---
  function updateItem(key: number, updates: Partial<ReviewItem>) {
    setItems((prev) =>
      prev.map((it) => (it._key === key ? { ...it, ...updates } : it))
    );
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((it) => it._key !== key));
  }

  function addManualItem() {
    setItems((prev) => [
      ...prev,
      {
        _key: nextKey,
        nombre_factura: "",
        cantidad: 1,
        unidad: "",
        costo_unitario: 0,
        costo_total: 0,
        ingrediente_id: null,
        nombre_catalogo: null,
        confianza: "sin_match",
      },
    ]);
    setNextKey((k) => k + 1);
  }

  function handleIngredienteChange(key: number, ingredienteId: string) {
    if (ingredienteId === "__none__") {
      updateItem(key, {
        ingrediente_id: null,
        nombre_catalogo: null,
        confianza: "sin_match",
      });
      return;
    }
    const ing = ingredientes.find((i) => i.id === ingredienteId);
    if (ing) {
      updateItem(key, {
        ingrediente_id: ing.id,
        nombre_catalogo: ing.nombre,
        confianza: "alta",
      });
    }
  }

  // --- Save ---
  const saveMut = useMutation({
    mutationFn: async (confirmar: boolean) => {
      const validItems = items.filter((it) => it.ingrediente_id);
      if (validItems.length === 0) throw new Error("No hay items asignados a ingredientes del catálogo");

      // Validar que las unidades de la factura sean convertibles a las unidades
      // base del catálogo. Sin esto convertirAUnidadBase silenciosamente devuelve
      // la cantidad sin convertir e inyecta stock en la unidad equivocada.
      const incompatibles = validItems.filter((it) => {
        const matchedIng = ingredientes.find((i) => i.id === it.ingrediente_id);
        if (!matchedIng || !it.unidad) return false;
        return !sonUnidadesCompatibles(it.unidad, matchedIng.unidad);
      });
      if (incompatibles.length > 0) {
        const detalle = incompatibles
          .map((it) => {
            const m = ingredientes.find((i) => i.id === it.ingrediente_id);
            return `${it.nombre_factura || m?.nombre}: ${it.unidad} → ${m?.unidad}`;
          })
          .join("; ");
        throw new Error(
          `Unidades incompatibles (${incompatibles.length}): ${detalle}. Cambiá la unidad de la factura o el ingrediente asignado.`
        );
      }

      // Convert quantities from invoice units to catalog base units
      const convertedItems = validItems.map((it) => {
        const matchedIng = ingredientes.find((i) => i.id === it.ingrediente_id);
        const cantConv = matchedIng && it.unidad
          ? convertirAUnidadBase(it.cantidad, it.unidad.toLowerCase(), matchedIng.unidad.toLowerCase())
          : it.cantidad;
        const costoConv = cantConv !== it.cantidad && cantConv > 0
          ? (it.cantidad * it.costo_unitario) / cantConv
          : it.costo_unitario;
        return {
          ingrediente_id: it.ingrediente_id!,
          cantidad: cantConv,
          costo_unitario: costoConv,
        };
      });

      const mov = await inventarioMovimientoCreate(
        {
          tipo: "compra",
          fecha: fecha || new Date().toISOString().slice(0, 10),
          estado: "borrador",
          evento_id: null,
          proveedor: proveedor || null,
          notas: [
            numeroFactura ? `Factura: ${numeroFactura}` : "",
            notas || "",
          ].filter(Boolean).join(" | ") || null,
          factura_url: null,
        },
        convertedItems
      );

      // Upload invoice file. Es no-bloqueante (el movimiento ya existe)
      // pero el usuario debe saber que quedó sin adjunto.
      if (file) {
        try {
          const path = await uploadFactura(file, mov.id);
          await inventarioMovimientoUpdateFacturaUrl(mov.id, path);
        } catch (err) {
          toast({
            title: "Movimiento creado, pero la factura no se subió",
            description: err?.message ?? "Podés reintentar la subida desde el detalle del movimiento.",
            variant: "destructive",
          });
        }
      }

      if (confirmar) {
        await inventarioMovimientoConfirmar(mov.id);
      }

      return { mov, confirmar };
    },
    onSuccess: (_, confirmar) => {
      qc.invalidateQueries({ queryKey: ["inventario-movimientos"] });
      qc.invalidateQueries({ queryKey: ["ingredientes-stock"] });
      toast({
        title: confirmar ? "Ingreso confirmado" : "Borrador guardado",
        description: "El movimiento de compra se registró correctamente",
      });
      resetAndClose();
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  function resetAndClose() {
    setStep("upload");
    setFile(null);
    setPreviewUrl(null);
    setProveedor("");
    setNumeroFactura("");
    setFecha("");
    setItems([]);
    setNotas("");
    setNextKey(0);
    onOpenChange(false);
  }

  const validCount = items.filter((it) => it.ingrediente_id).length;
  const sinMatchCount = items.filter((it) => !it.ingrediente_id).length;
  const totalCalculado = items
    .filter((it) => it.ingrediente_id)
    .reduce((sum, it) => sum + it.cantidad * it.costo_unitario, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "Registrar Ingreso con Factura"}
            {step === "processing" && "Analizando Factura..."}
            {step === "review" && "Revisar y Confirmar Ingreso"}
          </DialogTitle>
        </DialogHeader>

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className="border border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <div className="space-y-3">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="mx-auto max-h-48 rounded-md object-contain" />
                  ) : (
                    <FileText className="mx-auto h-14 w-14 text-primary" strokeWidth={1.5} />
                  )}
                  <p className="text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreviewUrl(null);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" /> Quitar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="mx-auto h-11 w-11 text-muted-foreground" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Arrastra la foto o PDF de la factura aquí
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG, WebP o PDF — Máximo 10MB
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleInputChange}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button disabled={!file} onClick={startScan}>
                <Upload className="h-4 w-4 mr-2" strokeWidth={1.75} /> Escanear factura
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center py-12 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" strokeWidth={1.5} />
            <p className="text-base font-medium text-foreground">Analizando factura con IA...</p>
            <p className="text-sm text-muted-foreground">Esto puede tomar unos segundos</p>
            {previewUrl && (
              <img src={previewUrl} alt="Preview" className="mt-4 max-h-32 rounded-md object-contain opacity-60" />
            )}
          </div>
        )}

        {/* STEP 3: Review */}
        {step === "review" && (
          <div className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Proveedor</Label>
                <Input
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Proveedor"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">N° Factura</Label>
                <Input
                  value={numeroFactura}
                  onChange={(e) => setNumeroFactura(e.target.value)}
                  placeholder="Número"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            </div>

            {/* Warnings */}
            {sinMatchCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border border-border rounded-md text-sm text-[hsl(30_55%_42%)]">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={1.75} />
                {sinMatchCount} item(s) sin asignar — no se guardarán hasta asignarles un ingrediente
              </div>
            )}

            {/* Items table */}
            {items.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Item Factura</TableHead>
                      <TableHead className="min-w-[180px]">Match Catálogo</TableHead>
                      <TableHead className="w-[90px]">Confianza</TableHead>
                      <TableHead className="w-[90px]">Cantidad</TableHead>
                      <TableHead className="w-[70px]">Unidad</TableHead>
                      <TableHead className="w-[110px]">Costo Unit.</TableHead>
                      <TableHead className="w-[100px] text-right">Subtotal</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const conf = confianzaConfig[item.confianza] || confianzaConfig.sin_match;
                      const matchedIng = item.ingrediente_id
                        ? ingredientes.find((i) => i.id === item.ingrediente_id)
                        : null;

                      return (
                        <TableRow key={item._key}>
                          <TableCell className="text-sm">{item.nombre_factura || "—"}</TableCell>
                          <TableCell>
                            <Select
                              value={item.ingrediente_id || "__none__"}
                              onValueChange={(v) => handleIngredienteChange(item._key, v)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Sin asignar" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Sin asignar</SelectItem>
                                {ingredientes.map((ig) => (
                                  <SelectItem key={ig.id} value={ig.id}>
                                    {ig.nombre} ({ig.unidad})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${conf.color}`}>
                              {conf.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0.01}
                              step="any"
                              value={item.cantidad}
                              onChange={(e) => updateItem(item._key, { cantidad: Number(e.target.value) || 0 })}
                              className="h-8 text-xs"
                            />
                            {matchedIng && item.unidad && item.unidad.toLowerCase() !== matchedIng.unidad.toLowerCase() && (
                              <p className="text-[10px] text-primary mt-0.5">
                                {item.cantidad} {item.unidad} &rarr;{" "}
                                {convertirAUnidadBase(item.cantidad, item.unidad.toLowerCase(), matchedIng.unidad.toLowerCase()).toLocaleString("es-CO")}{" "}
                                {matchedIng.unidad}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {item.unidad || "—"}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={item.costo_unitario}
                              onChange={(e) => updateItem(item._key, { costo_unitario: Number(e.target.value) || 0 })}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            $ {(item.cantidad * item.costo_unitario).toLocaleString("es-CO")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeItem(item._key)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-sm">
                No se detectaron items. Agrega manualmente.
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={addManualItem}>
                <Plus className="h-4 w-4 mr-1" /> Agregar Item
              </Button>
              <div className="text-right">
                <p className="text-xs text-slate-400">{validCount} item(s) asignados</p>
                <p className="text-sm font-semibold">
                  Total: $ {totalCalculado.toLocaleString("es-CO")}
                </p>
              </div>
            </div>

            {notas && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-md p-2">
                <span className="font-medium">Notas IA:</span> {notas}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={resetAndClose}>Cancelar</Button>
              <Button
                variant="outline"
                onClick={() => { setStep("upload"); setItems([]); }}
              >
                Volver a escanear
              </Button>
              <Button
                variant="secondary"
                disabled={validCount === 0 || saveMut.isPending}
                onClick={() => saveMut.mutate(false)}
              >
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar Borrador
              </Button>
              <Button
                disabled={validCount === 0 || saveMut.isPending}
                onClick={() => saveMut.mutate(true)}
              >
                {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar y actualizar stock
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
