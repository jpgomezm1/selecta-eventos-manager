import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, CheckCircle, Clock, Star, Sparkles } from "lucide-react";

interface CotizacionVersion {
  id: string;
  nombre_opcion: string;
  is_definitiva: boolean;
  items: {
    platos: Array<{ nombre: string; precio_unitario: number; cantidad: number }>;
    personal: Array<{ rol: string; tarifa_estimada_por_persona: number; cantidad: number }>;
    transportes: Array<{ lugar: string; tarifa_unitaria: number; cantidad: number }>;
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  versiones: CotizacionVersion[];
  cotizacionName: string;
  onDownload: (selectedVersions: string[]) => void;
  isGenerating: boolean;
}

export default function CotizacionPDFModal({
  isOpen,
  onClose,
  versiones,
  cotizacionName,
  onDownload,
  isGenerating
}: Props) {
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);

  const toggleVersion = (versionId: string) => {
    setSelectedVersions(prev =>
      prev.includes(versionId)
        ? prev.filter(id => id !== versionId)
        : [...prev, versionId]
    );
  };

  const selectAll = () => {
    setSelectedVersions(versiones.map(v => v.id));
  };

  const clearAll = () => {
    setSelectedVersions([]);
  };

  const handleDownload = () => {
    if (selectedVersions.length > 0) {
      onDownload(selectedVersions);
    }
  };

  const calculateTotal = (version: CotizacionVersion) => {
    return (
      version.items.platos.reduce((sum, p) => sum + (p.precio_unitario * p.cantidad), 0) +
      version.items.personal.reduce((sum, p) => sum + (p.tarifa_estimada_por_persona * p.cantidad), 0) +
      version.items.transportes.reduce((sum, t) => sum + (t.tarifa_unitaria * t.cantidad), 0)
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader className="space-y-4 pb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Generar Propuesta Selecta
              </DialogTitle>
              <p className="text-slate-600 font-medium">{cotizacionName}</p>
            </div>
          </div>

          {/* Controles de selección */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="rounded-xl"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Seleccionar todas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                className="rounded-xl"
              >
                Limpiar selección
              </Button>
            </div>
            <div className="text-sm text-slate-600 font-medium">
              {selectedVersions.length} de {versiones.length} opciones seleccionadas
            </div>
          </div>
        </DialogHeader>

        {/* Lista de versiones */}
        <div className="flex-1 overflow-y-auto space-y-4 max-h-[50vh] pr-2">
          {versiones.map((version) => {
            const isSelected = selectedVersions.includes(version.id);
            const total = calculateTotal(version);

            return (
              <Card
                key={version.id}
                className={`transition-all duration-300 cursor-pointer hover:shadow-lg ${
                  isSelected
                    ? 'ring-2 ring-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                    : 'hover:shadow-md border-slate-200'
                }`}
                onClick={() => toggleVersion(version.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleVersion(version.id)}
                        className="scale-125"
                      />

                      <div className="flex items-center space-x-3">
                        {version.is_definitiva ? (
                          <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-md">
                            <Star className="h-5 w-5 text-white" />
                          </div>
                        ) : (
                          <div className="p-2 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl shadow-md">
                            <Clock className="h-5 w-5 text-white" />
                          </div>
                        )}

                        <div>
                          <h3 className="text-lg font-bold text-slate-800">
                            {version.nombre_opcion}
                          </h3>
                          {version.is_definitiva && (
                            <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-none">
                              <Sparkles className="h-3 w-3 mr-1" />
                              Definitiva
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-emerald-600 bg-clip-text text-transparent">
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: 'COP',
                          minimumFractionDigits: 0
                        }).format(total)}
                      </div>
                      <p className="text-sm text-slate-600">Total de la opción</p>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  {/* Estadísticas de la versión */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-orange-50 rounded-xl border border-orange-200">
                      <div className="font-bold text-orange-800">{version.items.platos.length}</div>
                      <div className="text-xs text-orange-600">Platos</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-200">
                      <div className="font-bold text-blue-800">{version.items.personal.length}</div>
                      <div className="text-xs text-blue-600">Personal</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl border border-green-200">
                      <div className="font-bold text-green-800">{version.items.transportes.length}</div>
                      <div className="text-xs text-green-600">Transportes</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer con botones */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-xl px-6"
          >
            Cancelar
          </Button>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-slate-600">
              Total de opciones seleccionadas: <span className="font-bold text-slate-800">{selectedVersions.length}</span>
            </div>

            <Button
              onClick={handleDownload}
              disabled={selectedVersions.length === 0 || isGenerating}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-8 py-2 shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full mr-2" />
                  Generando PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generar Propuesta
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}