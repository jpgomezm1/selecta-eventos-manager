import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, AlertTriangle, Info } from "lucide-react";
import {
  getDatosRentabilidad,
  createCostoEvento,
  deleteCostoEvento,
  setImprevistoPct,
} from "@/integrations/supabase/apiRentabilidad";
import { getAllPlatoIngredientes } from "@/integrations/supabase/apiCotizador";
import {
  calcularRentabilidad,
  construirCostoPorPlato,
  CATEGORIAS_COSTO,
  ESTADOS_PAGO,
  UMBRAL_MARGEN_VERDE,
  UMBRAL_MARGEN_AMARILLO,
  type EstadoPagoCosto,
} from "@/lib/rentabilidadEvento";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Props = { eventoId: string };

const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

const SEMAFORO_STYLE = {
  verde: "border-primary/30 bg-primary/10 text-primary",
  amarillo: "border-warning/40 bg-warning/10 text-warning",
  rojo: "border-destructive/30 bg-destructive/10 text-destructive",
  "sin-datos": "border-border bg-muted/40 text-muted-foreground",
} as const;

const SEMAFORO_TEXTO = {
  verde: `Margen saludable (≥ ${UMBRAL_MARGEN_VERDE}%)`,
  amarillo: `Aceptable — hay espacio para optimizar costos (≥ ${UMBRAL_MARGEN_AMARILLO}%)`,
  rojo: `Margen bajo (< ${UMBRAL_MARGEN_AMARILLO}%) — revisar antes de confirmar`,
  "sin-datos": "Faltan costos para calcular el margen",
} as const;

const FILA_VACIA = {
  categoria: CATEGORIAS_COSTO[0] as string,
  descripcion: "",
  proveedor: "",
  monto: "",
  estado_pago: "pendiente" as EstadoPagoCosto,
};

export default function RentabilidadPanel({ eventoId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [nuevo, setNuevo] = useState({ ...FILA_VACIA });
  const [pctInput, setPctInput] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["rentabilidad-evento", eventoId],
    queryFn: () => getDatosRentabilidad(eventoId),
    retry: false,
  });

  const { data: platoIngredientes = [] } = useQuery({
    queryKey: ["plato-ingredientes-all"],
    queryFn: getAllPlatoIngredientes,
  });

  const rent = useMemo(() => {
    if (!data) return null;
    return calcularRentabilidad({
      platos: data.platos,
      personal: data.personal,
      menaje: data.menaje,
      transporte: data.transporte,
      costoPorPlato: construirCostoPorPlato(platoIngredientes),
      pagosPersonal: data.pagosPersonal,
      costosManuales: data.costosManuales,
      imprevistoPct: data.imprevistoPct,
    });
  }, [data, platoIngredientes]);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["rentabilidad-evento", eventoId] });

  const crearMut = useMutation({
    mutationFn: createCostoEvento,
    onSuccess: () => {
      invalidar();
      setNuevo({ ...FILA_VACIA });
      toast({ title: "Costo agregado" });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const borrarMut = useMutation({
    mutationFn: deleteCostoEvento,
    onSuccess: () => {
      invalidar();
      toast({ title: "Costo eliminado" });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pctMut = useMutation({
    mutationFn: (pct: number) => setImprevistoPct(eventoId, pct),
    onSuccess: () => {
      invalidar();
      setPctInput(null);
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10">
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted/70" />
        <p className="text-sm italic text-muted-foreground">Calculando rentabilidad…</p>
      </div>
    );
  }

  // Sin las migraciones de rentabilidad corridas, la consulta falla. Lo decimos
  // en vez de dejar el panel girando: el resto del tab Financiero sí funciona.
  if (error || !rent || !data) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div>
          <span className="font-medium">No se pudo calcular la rentabilidad.</span>{" "}
          <span className="text-muted-foreground">
            {(error as Error)?.message ?? "No hay datos disponibles para este evento."}
          </span>
        </div>
      </div>
    );
  }

  const guardarCosto = () => {
    const monto = Number(nuevo.monto.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(monto) || monto <= 0) {
      toast({ title: "Monto inválido", description: "Debe ser mayor a 0", variant: "destructive" });
      return;
    }
    crearMut.mutate({
      evento_id: eventoId,
      categoria: nuevo.categoria,
      descripcion: nuevo.descripcion.trim() || null,
      proveedor: nuevo.proveedor.trim() || null,
      monto,
      estado_pago: nuevo.estado_pago,
    });
  };

  return (
    <div className="space-y-8">
      {/* Resultado */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <div className="kicker mb-2">Ingreso cotizado</div>
          <div className="font-serif text-[28px] leading-none tabular-nums">
            {fmt(rent.ingresos.total)}
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="kicker mb-2">Costo total</div>
          <div className="font-serif text-[28px] leading-none tabular-nums">
            {fmt(rent.costos.total)}
          </div>
        </div>
        <div className={cn("rounded-lg border p-4", SEMAFORO_STYLE[rent.semaforo])}>
          <div className="kicker mb-2">Margen bruto</div>
          <div className="font-serif text-[28px] leading-none tabular-nums">
            {rent.margen === null ? "—" : `${rent.margen.toFixed(1)}%`}
          </div>
          <div className="mt-2 text-[11.5px] leading-snug">{SEMAFORO_TEXTO[rent.semaforo]}</div>
        </div>
      </div>

      <div className="flex items-baseline justify-between border-y border-border py-3">
        <span className="kicker">Utilidad bruta</span>
        <span
          className={cn(
            "font-serif text-[22px] tabular-nums",
            rent.utilidad >= 0 ? "text-foreground" : "text-destructive"
          )}
        >
          {fmt(rent.utilidad)}
        </span>
      </div>

      {rent.costoAlimentosIncompleto && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
          <div>
            <span className="font-medium">El margen no es confiable todavía.</span>{" "}
            <span className="text-muted-foreground">
              Este evento tiene platos, pero sus ingredientes no tienen costo cargado — el costo de
              alimentos está contando $0. Actualiza los costos de insumos en Recetario → Ingredientes.
            </span>
          </div>
        </div>
      )}

      {/* Desglose */}
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="kicker mb-3">Ingresos</h3>
          <dl className="space-y-2 text-sm">
            {[
              ["Menú y platos", rent.ingresos.platos],
              ["Personal", rent.ingresos.personal],
              ["Menaje", rent.ingresos.menaje],
              ["Transporte", rent.ingresos.transporte],
            ].map(([label, valor]) => (
              <div key={label as string} className="flex justify-between border-b border-border pb-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="tabular-nums">{fmt(valor as number)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <h3 className="kicker mb-3">Costos</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">
                Alimentos <span className="text-xs">· del recetario</span>
              </dt>
              <dd className="tabular-nums">{fmt(rent.costos.alimentos)}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">
                Personal <span className="text-xs">· liquidación</span>
              </dt>
              <dd className="tabular-nums">{fmt(rent.costos.personal)}</dd>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <dt className="text-muted-foreground">Costos registrados</dt>
              <dd className="tabular-nums">{fmt(rent.costos.manuales)}</dd>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-2">
              <dt className="flex items-center gap-2 text-muted-foreground">
                Imprevistos
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-7 w-16 text-xs"
                  value={pctInput ?? String(data.imprevistoPct)}
                  onChange={(e) => setPctInput(e.target.value)}
                  onBlur={() => {
                    if (pctInput === null) return;
                    const pct = Number(pctInput);
                    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
                      setPctInput(null);
                      return;
                    }
                    if (pct !== data.imprevistoPct) pctMut.mutate(pct);
                    else setPctInput(null);
                  }}
                />
                <span className="text-xs">%</span>
              </dt>
              <dd className="tabular-nums">{fmt(rent.costos.imprevistos)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Costos manuales */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="kicker">Costos del evento</h3>
          <span className="text-xs text-muted-foreground">
            <Info className="mr-1 inline h-3 w-3" />
            alimentos y personal se calculan solos — acá va lo demás
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Pago</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.costosManuales.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.categoria}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.descripcion ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{c.proveedor ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(c.monto)}</TableCell>
                  <TableCell>
                    <Badge variant={c.estado_pago === "pagado" ? "secondary" : "outline"}>
                      {ESTADOS_PAGO.find((e) => e.value === c.estado_pago)?.label ?? c.estado_pago}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => borrarMut.mutate(c.id)}
                      disabled={borrarMut.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {/* Fila de captura */}
              <TableRow className="bg-muted/30">
                <TableCell>
                  <Select
                    value={nuevo.categoria}
                    onValueChange={(v) => setNuevo((p) => ({ ...p, categoria: v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_COSTO.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    className="h-9"
                    placeholder="Detalle"
                    value={nuevo.descripcion}
                    onChange={(e) => setNuevo((p) => ({ ...p, descripcion: e.target.value }))}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-9"
                    placeholder="Proveedor"
                    value={nuevo.proveedor}
                    onChange={(e) => setNuevo((p) => ({ ...p, proveedor: e.target.value }))}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="h-9 text-right"
                    placeholder="$ 0"
                    value={nuevo.monto}
                    onChange={(e) => setNuevo((p) => ({ ...p, monto: e.target.value }))}
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={nuevo.estado_pago}
                    onValueChange={(v) =>
                      setNuevo((p) => ({ ...p, estado_pago: v as EstadoPagoCosto }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESTADOS_PAGO.map((e) => (
                        <SelectItem key={e.value} value={e.value}>
                          {e.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    onClick={guardarCosto}
                    disabled={crearMut.isPending}
                    title="Agregar costo"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
