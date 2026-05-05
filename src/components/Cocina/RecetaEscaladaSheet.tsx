import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Thermometer, FileText, Package } from "lucide-react";
import { getRecetaEscalada } from "@/integrations/supabase/apiCocina";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platoId: string | null;
  cantidad: number;
  nombre: string;
}

export default function RecetaEscaladaSheet({ open, onOpenChange, platoId, cantidad, nombre }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["receta-escalada", platoId, cantidad],
    queryFn: () => getRecetaEscalada(platoId!, cantidad),
    enabled: !!platoId && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="font-serif text-[24px] leading-tight">{nombre}</SheetTitle>
          <p className="text-[12px] text-muted-foreground">
            Receta escalada a <span className="font-medium text-foreground">{cantidad}</span> porciones
            {data?.porciones_receta ? (
              <span className="text-muted-foreground/80"> (receta base: {data.porciones_receta})</span>
            ) : null}
          </p>
        </SheetHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted/70" />
            <p className="text-sm italic text-muted-foreground">Cargando receta…</p>
          </div>
        ) : error ? (
          <p className="mt-8 text-center text-[13px] text-destructive">
            No se pudo cargar la receta: {(error as Error).message}
          </p>
        ) : data ? (
          <div className="mt-6 space-y-6">
            {/* Metadata grid */}
            <section className="grid grid-cols-2 gap-3 rounded-md border border-border/70 bg-muted/30 p-4">
              <Meta icon={<Clock className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Tiempo prep" value={data.tiempo_preparacion} />
              <Meta icon={<Thermometer className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Temperatura" value={data.temperatura_coccion} />
              <Meta icon={<Package className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Rendimiento" value={data.rendimiento} />
              <Meta icon={<FileText className="h-3.5 w-3.5" strokeWidth={1.75} />} label="Notas" value={data.notas} multiline />
            </section>

            {/* Ingredientes escalados */}
            <section className="space-y-3">
              <h3 className="kicker">Ingredientes para {cantidad} porciones</h3>
              {data.ingredientes.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-[12.5px] italic text-muted-foreground">
                  Este plato no tiene ingredientes cargados en el recetario.
                </p>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingrediente</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Unidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ingredientes.map((ing) => (
                        <TableRow key={ing.ingrediente_id}>
                          <TableCell className="font-medium">{ing.nombre}</TableCell>
                          <TableCell className="text-right tabular-nums">{ing.cantidad_total}</TableCell>
                          <TableCell className="text-muted-foreground">{ing.unidad}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Meta({
  icon,
  label,
  value,
  multiline,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  multiline?: boolean;
}) {
  return (
    <div className={multiline ? "col-span-2 space-y-1" : "space-y-1"}>
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`text-[13px] text-foreground ${value ? "" : "italic text-muted-foreground"}`}>
        {value ?? "—"}
      </div>
    </div>
  );
}
