import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCotizacionDetalle, addVersionToCotizacion, setVersionDefinitiva } from "@/integrations/supabase/apiCotizador";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ResumenCotizacion } from "@/components/Cotizador/ResumenCotizacion";

export default function CotizacionEditorPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [active, setActive] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cotizacion", id],
    queryFn: () => getCotizacionDetalle(id!),
    enabled: !!id,
  });

  const { mutate: marcarDef } = useMutation({
    mutationFn: (version_id: string) => setVersionDefinitiva(id!, version_id),
    onSuccess: () => {
      toast({ title: "Versión definitiva marcada" });
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { mutate: agregarVersion, isPending: creandoVersion } = useMutation({
    mutationFn: async () => {
      // agrega versión vacía (duplica índice)
      const nextIndex = (data?.versiones?.length ?? 0) + 1;
      return addVersionToCotizacion(id!, {
        nombre_opcion: `Opción ${String.fromCharCode(64 + nextIndex)}`,
        version_index: nextIndex,
        total: 0,
        estado: "Borrador",
        items: { platos: [], personal: [], transportes: [] },
      });
    },
    onSuccess: () => {
      toast({ title: "Versión añadida" });
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-10 text-center">Cargando…</CardContent></Card>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-10 text-center text-red-600">Error cargando.</CardContent></Card>
      </div>
    );
  }

  const { cotizacion, versiones } = data;
  const activeId = active ?? versiones[0]?.id;
  const current = versiones.find((v) => v.id === activeId) ?? versiones[0];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold truncate">{cotizacion.nombre_cotizacion}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => agregarVersion()} disabled={creandoVersion}>
            {creandoVersion ? "Creando…" : "Añadir opción"}
          </Button>
          {current && (
            <Button onClick={() => marcarDef(current.id)} disabled={current.is_definitiva}>
              {current.is_definitiva ? "Definitiva" : "Marcar definitiva"}
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle>Opciones</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeId ?? ""} onValueChange={setActive}>
            <TabsList className="flex overflow-x-auto gap-2">
              {versiones.map((v) => (
                <TabsTrigger key={v.id} value={v.id} className="whitespace-nowrap">
                  {v.nombre_opcion} {v.is_definitiva ? "✅" : ""}
                </TabsTrigger>
              ))}
            </TabsList>

            {versiones.map((v) => (
              <TabsContent key={v.id} value={v.id} className="mt-6">
                <ResumenCotizacion
                  invitados={cotizacion.numero_invitados}
                  items={v.items}
                  total={Number(v.total)}
                  subtotales={{
                    platos: v.items.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0),
                    personal: v.items.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0),
                    transportes: v.items.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0),
                  }}
                  // Nota: este editor muestra, pero para editar cantidades necesitaremos endpoints de update por versión (siguiente iteración).
                  onQtyChange={() => {}}
                  onRemove={() => {}}
                  onGuardar={() => {}}
                  guardando={false}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
