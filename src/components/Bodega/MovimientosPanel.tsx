import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { movimientosList, movimientoCreate, movimientoUpdate, movimientoUpsertItems, movimientoConfirmar, movimientoDelete } from "@/integrations/supabase/apiMenaje";
import { MenajeMovimiento, MenajeMovimientoItem } from "@/types/menaje";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import MovimientoDialog from "./MovimientoDialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit3,
  Trash2,
  Check,
  Clock,
  X,
  Filter,
  Calendar,
  Package,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import moment from "moment";
import { KPI } from "@/components/Layout/PageHeader";

type DiscrepancyInfo = {
  totalMerma: number;
  totalFaltante: number;
  hasFaltante: boolean;
};

export default function MovimientosPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["movimientos"], queryFn: movimientosList });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<(MenajeMovimiento & { items: MenajeMovimientoItem[] }) | null>(null);
  const [filterTipo, setFilterTipo] = useState("");
  const [filterEstado, setFilterEstado] = useState("");

  // Compute discrepancy info for ingresos by cross-referencing with their matching salida
  const discrepancyMap = useMemo(() => {
    const map = new Map<string, DiscrepancyInfo>();
    if (!data) return map;

    // Build a lookup of salidas by evento_id+reserva_id. Puede haber más de
    // una salida confirmada por reserva (despachos parciales), así que
    // concatenamos todas las items en vez de pisar la última con la anterior.
    const salidaMap = new Map<string, MenajeMovimientoItem[]>();
    for (const m of data) {
      if (m.tipo === "salida" && m.estado === "confirmado" && m.evento_id) {
        const key = `${m.evento_id}|${m.reserva_id ?? ""}`;
        const existing = salidaMap.get(key) ?? [];
        salidaMap.set(key, [...existing, ...m.items]);
      }
    }

    // For each ingreso, compute discrepancy against its matching salida
    for (const m of data) {
      if (m.tipo !== "ingreso" || !m.evento_id) continue;

      const key = `${m.evento_id}|${m.reserva_id ?? ""}`;
      const salidaItems = salidaMap.get(key);
      if (!salidaItems) continue;

      // Build dispatched quantities map
      const despachado = new Map<string, number>();
      for (const si of salidaItems) {
        despachado.set(si.menaje_id, (despachado.get(si.menaje_id) || 0) + si.cantidad);
      }

      let totalMerma = 0;
      let totalFaltante = 0;

      // Sum merma from ingreso items
      for (const ii of m.items) {
        totalMerma += ii.merma || 0;
        const desp = despachado.get(ii.menaje_id) || 0;
        const faltante = Math.max(0, desp - ii.cantidad - (ii.merma || 0));
        totalFaltante += faltante;
      }

      // Items that were dispatched but not returned at all
      for (const [menajeId, cantDesp] of despachado) {
        if (!m.items.some((ii) => ii.menaje_id === menajeId)) {
          totalFaltante += cantDesp;
        }
      }

      map.set(m.id, { totalMerma, totalFaltante, hasFaltante: totalFaltante > 0 });
    }

    return map;
  }, [data]);

  // Filtrar movimientos
  const filteredData = (data ?? []).filter(mov => {
    const matchesTipo = !filterTipo || mov.tipo === filterTipo;
    const matchesEstado = !filterEstado || mov.estado === filterEstado;
    return matchesTipo && matchesEstado;
  });

  // Estadísticas
  const stats = {
    total: data?.length ?? 0,
    ingresos: data?.filter(m => m.tipo === 'ingreso').length ?? 0,
    salidas: data?.filter(m => m.tipo === 'salida').length ?? 0,
    pendientes: data?.filter(m => m.estado === 'borrador').length ?? 0
  };

  const handleNew = (tipo: "salida" | "ingreso") => {
    setEditing({
      id: "",
      tipo,
      fecha: new Date().toISOString().slice(0, 10),
      estado: "borrador",
      evento_id: null,
      reserva_id: null,
      notas: "",
      items: [],
    });
    setOpen(true);
  };

  const handleEdit = (movimiento: MenajeMovimiento & { items: MenajeMovimientoItem[] }) => {
    setEditing(movimiento);
    setOpen(true);
  };

  const handleSave = async (mov: MenajeMovimiento, items: Array<{ menaje_id: string; cantidad: number; merma?: number; nota?: string }>) => {
    try {
      let id = mov.id;
      if (!id) {
        const created = await movimientoCreate(
          {
            tipo: mov.tipo,
            fecha: mov.fecha,
            estado: mov.estado,
            evento_id: mov.evento_id ?? null,
            reserva_id: mov.reserva_id ?? null,
            notas: mov.notas ?? null,
          },
          items
        );
        id = created.id;
      } else {
        await movimientoUpdate(id, {
          tipo: mov.tipo,
          fecha: mov.fecha,
          estado: mov.estado,
          evento_id: mov.evento_id ?? null,
          reserva_id: mov.reserva_id ?? null,
          notas: mov.notas ?? null,
        });
        await movimientoUpsertItems(id, items);
      }

      toast({
        title: "¡Movimiento guardado!",
        description: `El ${mov.tipo} se registró correctamente en el sistema.`
      });
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["salidas-confirmadas"] });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const confirmMut = useMutation({
    mutationFn: (id: string) => movimientoConfirmar(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["salidas-confirmadas"] });
      toast({
        title: "Movimiento confirmado",
        description: "El stock se ha actualizado correctamente."
      });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => movimientoDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      qc.invalidateQueries({ queryKey: ["salidas-confirmadas"] });
      toast({
        title: "Movimiento eliminado",
        description: "El registro se removió del sistema."
      });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case "confirmado":
        return { color: "green", icon: Check, label: "Confirmado" };
      case "borrador":
        return { color: "amber", icon: Clock, label: "Borrador" };
      case "cancelado":
        return { color: "red", icon: X, label: "Cancelado" };
      default:
        return { color: "gray", icon: Clock, label: estado };
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "ingreso":
        return { color: "green", icon: ArrowUp, label: "Ingreso" };
      case "salida":
        return { color: "red", icon: ArrowDown, label: "Salida" };
      default:
        return { color: "gray", icon: ArrowUpDown, label: tipo };
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs editoriales */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-border py-6 md:grid-cols-4">
        <KPI kicker="Total movimientos" value={stats.total} />
        <KPI kicker="Ingresos" value={stats.ingresos} tone="primary" />
        <KPI kicker="Salidas" value={stats.salidas} />
        <KPI
          kicker="Pendientes"
          value={stats.pendientes}
          tone={stats.pendientes > 0 ? "warning" : "neutral"}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <Button onClick={() => handleNew("salida")} className="gap-2">
            <ArrowDown className="h-4 w-4" />
            Nueva salida
          </Button>
          <Button variant="outline" onClick={() => handleNew("ingreso")} className="gap-2">
            <ArrowUp className="h-4 w-4" />
            Nuevo ingreso
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos los tipos</option>
            <option value="ingreso">Ingresos</option>
            <option value="salida">Salidas</option>
          </select>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos los estados</option>
            <option value="borrador">Borrador</option>
            <option value="confirmado">Confirmado</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {filteredData.length} registros
          </span>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="kicker text-muted-foreground">Fecha</TableHead>
                <TableHead className="kicker text-muted-foreground">Tipo</TableHead>
                <TableHead className="kicker text-muted-foreground">Estado</TableHead>
                <TableHead className="kicker text-muted-foreground">Evento</TableHead>
                <TableHead className="kicker text-muted-foreground">Elementos</TableHead>
                <TableHead className="kicker text-muted-foreground">Resultado</TableHead>
                <TableHead className="kicker text-muted-foreground">Notas</TableHead>
                <TableHead className="kicker text-right text-muted-foreground">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
                      <span className="text-sm text-muted-foreground">Cargando movimientos…</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Package className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                      <div>
                        <h3 className="font-serif text-lg text-foreground">No hay movimientos</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Comienza registrando entradas y salidas de inventario.
                        </p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((m) => {
                  const estadoBadge = getEstadoBadge(m.estado);
                  const tipoBadge = getTipoBadge(m.tipo);
                  const EstadoIcon = estadoBadge.icon;
                  const TipoIcon = tipoBadge.icon;
                  const disc = discrepancyMap.get(m.id);

                  return (
                    <TableRow key={m.id} className="border-border transition-colors hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                          <span className="font-mono text-sm tabular-nums text-foreground/85">
                            {moment(m.fecha).format("DD/MM/YYYY")}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "inline-flex w-fit items-center gap-1 font-normal",
                            tipoBadge.color === "green" && "border-primary/25 bg-primary/10 text-primary",
                            tipoBadge.color === "red" &&
                              "border-border bg-muted/40 text-muted-foreground"
                          )}
                        >
                          <TipoIcon className="h-3 w-3" />
                          <span className="capitalize">{tipoBadge.label}</span>
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "inline-flex w-fit items-center gap-1 font-normal",
                            estadoBadge.color === "green" && "border-primary/25 bg-primary/10 text-primary",
                            estadoBadge.color === "amber" &&
                              "border-[hsl(30_55%_42%)]/30 bg-[hsl(30_55%_42%)]/10 text-[hsl(30_55%_42%)]",
                            estadoBadge.color === "red" &&
                              "border-destructive/30 bg-destructive/10 text-destructive"
                          )}
                        >
                          <EstadoIcon className="h-3 w-3" />
                          <span className="capitalize">{estadoBadge.label}</span>
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {(m as { nombre_evento?: string }).nombre_evento ? (
                          <span className="text-sm text-foreground/85">
                            {(m as { nombre_evento?: string }).nombre_evento}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground/60">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="max-w-xs">
                          {m.items.length > 0 ? (
                            <div className="space-y-0.5">
                              {m.items.slice(0, 2).map((item, idx) => (
                                <div key={idx} className="text-sm text-foreground/80">
                                  <span>{item.menaje?.nombre ?? "Elemento desconocido"}</span>
                                  <span className="ml-1 font-mono text-muted-foreground tabular-nums">
                                    ×{item.cantidad}
                                  </span>
                                </div>
                              ))}
                              {m.items.length > 2 && (
                                <div className="text-xs text-muted-foreground">
                                  +{m.items.length - 2} más…
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground/60">Sin elementos</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        {m.tipo === "ingreso" && disc ? (
                          <div className="flex flex-col gap-1">
                            {disc.hasFaltante && (
                              <Badge
                                variant="outline"
                                className="inline-flex w-fit items-center gap-1 border-destructive/30 bg-destructive/10 text-xs font-normal text-destructive"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                <span>Faltante: {disc.totalFaltante}</span>
                              </Badge>
                            )}
                            {disc.totalMerma > 0 && (
                              <Badge
                                variant="outline"
                                className="inline-flex w-fit items-center gap-1 border-[hsl(30_55%_42%)]/30 bg-[hsl(30_55%_42%)]/10 text-xs font-normal text-[hsl(30_55%_42%)]"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                <span>Merma: {disc.totalMerma}</span>
                              </Badge>
                            )}
                            {!disc.hasFaltante && disc.totalMerma === 0 && (
                              <Badge
                                variant="outline"
                                className="inline-flex w-fit items-center gap-1 border-primary/25 bg-primary/10 text-xs font-normal text-primary"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                <span>Completo</span>
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground/60">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="max-w-xs">
                          {m.notas ? (
                            <span className="block truncate text-sm text-muted-foreground">
                              {m.notas}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground/60">—</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(m)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Editar"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>

                          {m.estado !== "confirmado" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Confirmar este ${m.tipo} aplica el cambio de stock y no se puede revertir fácilmente. ¿Continuar?`
                                  )
                                ) {
                                  confirmMut.mutate(m.id);
                                }
                              }}
                              disabled={confirmMut.isPending}
                              className="h-8 gap-1 px-2 text-xs"
                              aria-label="Confirmar"
                            >
                              {confirmMut.isPending ? (
                                <div className="h-3 w-3 animate-spin rounded-full border border-primary-foreground/30 border-t-primary-foreground" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              <span>Confirmar</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const etiqueta = m.tipo === "ingreso" ? "ingreso" : "salida";
                              const fecha = moment(m.fecha).format("DD/MM/YYYY");
                              if (window.confirm(`¿Eliminar este movimiento de ${etiqueta} del ${fecha}?`)) {
                                deleteMut.mutate(m.id);
                              }
                            }}
                            disabled={deleteMut.isPending}
                            className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Dialog de movimiento */}
      {editing && (
        <MovimientoDialog
          open={open}
          onOpenChange={setOpen}
          movimiento={editing}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
