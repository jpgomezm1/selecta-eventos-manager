import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, AlertTriangle, Save, Download, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  getIngredientesCatalogo,
  bulkUpsertCostosProveedor,
} from "@/integrations/supabase/apiCotizador";
import {
  procesarFilaCosto,
  marcarDuplicados,
  construirIndiceIngredientes,
  type CostoExcelProcesado,
} from "@/lib/mapeoExcelCostos";

interface CargaMasivaCostosProps {
  isOpen: boolean;
  onClose: () => void;
}

const fmt = (n: number) =>
  `$ ${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })}`;

export function CargaMasivaCostos({ isOpen, onClose }: CargaMasivaCostosProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [filas, setFilas] = useState<CostoExcelProcesado[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: ingredientes = [] } = useQuery({
    queryKey: ["ingredientes-catalogo"],
    queryFn: getIngredientesCatalogo,
    enabled: isOpen,
  });

  const validas = filas.filter((f) => f.errores.length === 0);
  const invalidas = filas.filter((f) => f.errores.length > 0);

  const handleArchivo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        title: "Archivo inválido",
        description: "Selecciona un archivo Excel (.xlsx o .xls)",
        variant: "destructive",
      });
      return;
    }

    if (ingredientes.length === 0) {
      toast({
        title: "Catálogo no cargado",
        description: "Espera a que termine de cargar el recetario e intenta de nuevo.",
        variant: "destructive",
      });
      return;
    }

    setArchivo(file);
    setProcesando(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      const indice = construirIndiceIngredientes(ingredientes);
      // +2: la fila 1 del Excel es el encabezado y el índice arranca en 0.
      const procesadas = json.map((fila, i) => procesarFilaCosto(fila, i + 2, indice));
      marcarDuplicados(procesadas);
      setFilas(procesadas);

      const ok = procesadas.filter((f) => f.errores.length === 0).length;
      toast({
        title: "Archivo procesado",
        description: `${ok} de ${procesadas.length} filas listas para aplicar`,
        variant: ok === 0 ? "destructive" : undefined,
      });
    } catch (error) {
      toast({
        title: "Error leyendo el archivo",
        description: (error as Error)?.message ?? "No se pudo procesar el Excel",
        variant: "destructive",
      });
    } finally {
      setProcesando(false);
    }
  };

  const handleGuardar = async () => {
    if (validas.length === 0) return;
    setGuardando(true);
    try {
      const { creados, actualizados } = await bulkUpsertCostosProveedor(
        validas.map((f) => ({
          ingrediente_id: f.ingrediente_id!,
          proveedor: f.proveedor,
          presentacion_cantidad: f.presentacion_cantidad,
          presentacion_unidad: f.presentacion_unidad,
          precio_presentacion: f.precio_presentacion,
          costo_por_unidad_base: f.costo_por_unidad_base,
        }))
      );

      // El costeo de los platos se deriva del costo de los ingredientes, así
      // que hay que invalidar también el recetario y no solo el catálogo.
      queryClient.invalidateQueries({ queryKey: ["ingredientes-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["platos-catalogo"] });

      toast({
        title: "Costos actualizados",
        description: `${actualizados} proveedores actualizados · ${creados} creados`,
      });
      handleCerrar();
    } catch (error) {
      toast({
        title: "No se aplicó ningún cambio",
        description:
          (error as Error)?.message ??
          "La carga se ejecuta completa o no se ejecuta. Corrige el archivo e intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  const handleCerrar = () => {
    setArchivo(null);
    setFilas([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const descargarPlantilla = () => {
    // Los ejemplos usan ingredientes reales del catálogo cuando existen, para
    // que el archivo de muestra no falle al reimportarlo tal cual.
    const muestra = ingredientes.slice(0, 3);
    const plantilla =
      muestra.length > 0
        ? muestra.map((ing) => ({
            INGREDIENTE: ing.nombre,
            PROVEEDOR: ing.proveedor || "Nombre del proveedor",
            PRESENTACION: 1,
            UNIDAD: ing.unidad,
            PRECIO: "$ 0",
          }))
        : [
            {
              INGREDIENTE: "Arroz",
              PROVEEDOR: "Cooperativa Colanta",
              PRESENTACION: 25,
              UNIDAD: "kg",
              PRECIO: "$ 120.000",
            },
          ];

    const ws = XLSX.utils.json_to_sheet(plantilla);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Costos");
    XLSX.writeFile(wb, "plantilla_costos_insumos.xlsx");

    toast({ title: "Plantilla descargada" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <span>Actualizar costos de insumos</span>
          </DialogTitle>
          <DialogDescription>
            Sube el Excel con los precios de tus proveedores. Solo actualiza ingredientes que ya
            existen en el recetario — no crea nuevos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          <Card className="bg-muted/40">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold mb-1">Formato del archivo</h3>
                  <p className="text-sm text-muted-foreground">
                    Columnas: <strong>INGREDIENTE · PROVEEDOR · PRESENTACION · UNIDAD · PRECIO</strong>.
                    La presentación es cómo compras (un bulto de 25 kg a $120.000), no cómo cocinas.
                  </p>
                </div>
                <Button variant="outline" onClick={descargarPlantilla} className="shrink-0">
                  <Download className="h-4 w-4 mr-2" />
                  Descargar plantilla
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Selecciona el archivo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleArchivo}
                  className="hidden"
                  id="excel-costos-upload"
                />
                <label
                  htmlFor="excel-costos-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center">
                    <Upload className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-semibold">
                    {archivo ? archivo.name : "Haz clic para seleccionar archivo"}
                  </p>
                </label>
              </div>

              {procesando && (
                <div className="mt-4 flex flex-col items-center gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-muted/70" />
                  <p className="text-sm italic text-muted-foreground">Procesando archivo…</p>
                </div>
              )}
            </CardContent>
          </Card>

          {filas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-3">
                  2. Revisa los cambios
                  <Badge variant="secondary">{validas.length} listas</Badge>
                  {invalidas.length > 0 && (
                    <Badge variant="destructive">{invalidas.length} con problemas</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[320px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Fila</TableHead>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Presentación</TableHead>
                        <TableHead className="text-right">Costo por unidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filas.map((f) => {
                        const conError = f.errores.length > 0;
                        return (
                          <TableRow key={f.fila_excel} className={conError ? "bg-destructive/5" : ""}>
                            <TableCell className="text-muted-foreground">{f.fila_excel}</TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {f.ingrediente_nombre ?? (f.nombre_excel || "—")}
                              </div>
                              {conError && (
                                <div className="text-xs text-destructive flex items-start gap-1 mt-1">
                                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                                  <span>{f.errores.join(" · ")}</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{f.proveedor || "—"}</TableCell>
                            <TableCell className="text-sm">
                              {f.presentacion_cantidad > 0
                                ? `${f.presentacion_cantidad} ${f.presentacion_unidad} · ${fmt(f.precio_presentacion)}`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {conError ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <div className="flex items-center justify-end gap-2 text-sm">
                                  <span className="text-muted-foreground line-through">
                                    {fmt(f.costo_anterior ?? 0)}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="font-semibold">
                                    {fmt(f.costo_por_unidad_base)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    /{f.unidad_base}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>

                {invalidas.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Las filas con problemas se ignoran. Se aplican solo las {validas.length} válidas.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={validas.length === 0 || guardando}>
            <Save className="h-4 w-4 mr-2" />
            {guardando ? "Aplicando…" : `Aplicar ${validas.length} costos`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
