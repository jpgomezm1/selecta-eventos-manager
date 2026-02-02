import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Save, X, Download } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { procesarFilaExcel, type PersonalExcelProcesado } from "@/lib/mapeoExcelPersonal";
import { getModalidadCobroLabel } from "@/lib/calcularPagoPersonal";

interface CargaMasivaPersonalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CargaMasivaPersonal({ isOpen, onClose, onSuccess }: CargaMasivaPersonalProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [datosPreview, setDatosPreview] = useState<PersonalExcelProcesado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleArchivoSeleccionado = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar que sea un archivo Excel
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast({
        title: "Archivo inválido",
        description: "Por favor selecciona un archivo Excel (.xlsx o .xls)",
        variant: "destructive",
      });
      return;
    }

    setArchivo(file);
    setCargando(true);

    try {
      // Leer el archivo
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convertir a JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Procesar cada fila
      const datosProcesados: PersonalExcelProcesado[] = [];

      jsonData.forEach((fila: any, index: number) => {
        const resultado = procesarFilaExcel(fila, index + 2); // +2 porque Excel empieza en 1 y hay header
        if (resultado) {
          datosProcesados.push(resultado);
        }
      });

      setDatosPreview(datosProcesados);

      // Mostrar resumen
      const validos = datosProcesados.filter(d => !d.errores || d.errores.length === 0).length;
      const invalidos = datosProcesados.length - validos;

      toast({
        title: "Archivo procesado",
        description: `${validos} registros válidos, ${invalidos} con errores`,
      });

    } catch (error) {
      console.error("Error al procesar archivo:", error);
      toast({
        title: "Error",
        description: "No se pudo procesar el archivo Excel",
        variant: "destructive",
      });
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarTodos = async () => {
    // Filtrar solo los válidos
    const datosValidos = datosPreview.filter(d => !d.errores || d.errores.length === 0);

    if (datosValidos.length === 0) {
      toast({
        title: "No hay datos válidos",
        description: "Corrige los errores antes de guardar",
        variant: "destructive",
      });
      return;
    }

    setGuardando(true);

    try {
      let exitosos = 0;
      let fallidos = 0;
      const erroresDetalle: string[] = [];

      // Insertar uno por uno (para manejar duplicados)
      for (const dato of datosValidos) {
        try {
          const { error } = await supabase
            .from("personal")
            .insert({
              nombre_completo: dato.nombre_completo,
              numero_cedula: dato.numero_cedula,
              rol: dato.rol,
              tarifa: dato.tarifa,
              modalidad_cobro: dato.modalidad_cobro,
              tarifa_hora_extra: null,
            });

          if (error) {
            if (error.code === "23505") {
              // Cédula duplicada
              erroresDetalle.push(`Fila ${dato.fila_excel}: Cédula ${dato.numero_cedula} ya existe`);
            } else {
              erroresDetalle.push(`Fila ${dato.fila_excel}: ${error.message}`);
            }
            fallidos++;
          } else {
            exitosos++;
          }
        } catch (err) {
          console.error("Error insertando:", err);
          fallidos++;
        }
      }

      // Mostrar resultado
      if (exitosos > 0) {
        toast({
          title: "✅ Carga completada",
          description: `${exitosos} registros guardados exitosamente${fallidos > 0 ? `, ${fallidos} fallaron` : ''}`,
        });

        if (erroresDetalle.length > 0 && erroresDetalle.length <= 5) {
          // Mostrar errores si son pocos
          console.log("Errores detallados:", erroresDetalle);
        }

        onSuccess();
        handleCerrar();
      } else {
        toast({
          title: "Error al guardar",
          description: "No se pudo guardar ningún registro",
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error("Error guardando datos:", error);
      toast({
        title: "Error",
        description: "Error al guardar los datos en la base de datos",
        variant: "destructive",
      });
    } finally {
      setGuardando(false);
    }
  };

  const handleCerrar = () => {
    setArchivo(null);
    setDatosPreview([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const descargarPlantilla = () => {
    // Crear datos de ejemplo
    const plantilla = [
      {
        ID: 1,
        NOMBRE: "Juan Pérez García",
        CEDULA: "12345678",
        ROL: "MESERO",
        "PRESTA SERVICIOS POR": "HORA",
        VALOR: "$ 23.000"
      },
      {
        ID: 2,
        NOMBRE: "María López Sánchez",
        CEDULA: "87654321",
        ROL: "COCINA",
        "PRESTA SERVICIOS POR": "JORNADA 10 HORAS",
        VALOR: "$ 180.000"
      },
      {
        ID: 3,
        NOMBRE: "Carlos Rodríguez Martínez",
        CEDULA: "11223344",
        ROL: "COORDINACION EN HORARIO NO LABORAL",
        "PRESTA SERVICIOS POR": "POR EVENTO",
        VALOR: "$ 250.000"
      }
    ];

    // Crear workbook
    const ws = XLSX.utils.json_to_sheet(plantilla);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");

    // Descargar
    XLSX.writeFile(wb, "plantilla_personal.xlsx");

    toast({
      title: "Plantilla descargada",
      description: "Usa este archivo como ejemplo para tu carga masiva",
    });
  };

  const datosValidos = datosPreview.filter(d => !d.errores || d.errores.length === 0);
  const datosInvalidos = datosPreview.filter(d => d.errores && d.errores.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleCerrar}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-2xl">
            <FileSpreadsheet className="h-6 w-6 text-selecta-green" />
            <span>Carga Masiva de Personal</span>
          </DialogTitle>
          <DialogDescription>
            Sube un archivo Excel (.xlsx) con los datos del personal. Máximo 200 registros por archivo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-6">
          {/* Botón de descarga de plantilla */}
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">¿Primera vez?</h3>
                  <p className="text-sm text-slate-600 mb-3">
                    Descarga la plantilla de ejemplo para ver el formato correcto
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={descargarPlantilla}
                  className="border-blue-300 hover:bg-blue-100"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Plantilla
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Zona de carga */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Selecciona el archivo Excel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-selecta-green transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleArchivoSeleccionado}
                  className="hidden"
                  id="excel-upload"
                />
                <label
                  htmlFor="excel-upload"
                  className="cursor-pointer flex flex-col items-center space-y-3"
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Upload className="h-7 w-7 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-800">
                      {archivo ? archivo.name : 'Haz clic para seleccionar archivo'}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      o arrastra y suelta aquí
                    </p>
                  </div>
                </label>
              </div>

              {cargando && (
                <div className="mt-4 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-selecta-green"></div>
                  <p className="text-sm text-slate-600 mt-2">Procesando archivo...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Preview de datos */}
          {datosPreview.length > 0 && (
            <>
              {/* Resumen */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">2. Revisa los datos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="text-3xl font-bold text-slate-800">{datosPreview.length}</div>
                      <div className="text-sm text-slate-600">Total registros</div>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                      <div className="text-3xl font-bold text-green-700">{datosValidos.length}</div>
                      <div className="text-sm text-green-700">Válidos</div>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                      <div className="text-3xl font-bold text-red-700">{datosInvalidos.length}</div>
                      <div className="text-sm text-red-700">Con errores</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabla de preview */}
              <Card>
                <CardContent className="pt-6">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Fila</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Cédula</TableHead>
                          <TableHead>Rol</TableHead>
                          <TableHead>Modalidad</TableHead>
                          <TableHead className="text-right">Tarifa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {datosPreview.map((dato, index) => {
                          const tieneErrores = dato.errores && dato.errores.length > 0;
                          return (
                            <TableRow key={index} className={tieneErrores ? 'bg-red-50' : 'bg-green-50/30'}>
                              <TableCell className="font-mono text-xs">{dato.fila_excel}</TableCell>
                              <TableCell>
                                {tieneErrores ? (
                                  <Badge variant="destructive" className="gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Error
                                  </Badge>
                                ) : (
                                  <Badge className="bg-green-600 gap-1">
                                    <CheckCircle2 className="h-3 w-3" />
                                    OK
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">
                                {dato.nombre_completo}
                                {tieneErrores && (
                                  <div className="text-xs text-red-600 mt-1">
                                    {dato.errores?.map((err, i) => (
                                      <div key={i}>• {err}</div>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-mono">{dato.numero_cedula}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{dato.rol}</Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs">{getModalidadCobroLabel(dato.modalidad_cobro)}</span>
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                ${dato.tarifa.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Advertencias */}
              {datosInvalidos.length > 0 && (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-amber-900">Atención</h4>
                        <p className="text-sm text-amber-800 mt-1">
                          Hay {datosInvalidos.length} registro(s) con errores que no se guardarán.
                          Solo se guardarán los {datosValidos.length} registros válidos.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Botones de acción */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleCerrar}
            disabled={guardando}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>

          {datosPreview.length > 0 && datosValidos.length > 0 && (
            <Button
              onClick={handleGuardarTodos}
              disabled={guardando}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {guardando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar {datosValidos.length} registros
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}