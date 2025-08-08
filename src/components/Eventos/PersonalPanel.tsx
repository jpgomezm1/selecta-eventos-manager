import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Plus, Trash2 } from "lucide-react";
import { LiquidacionDialog } from "@/components/Forms/LiquidacionDialog";
import type { Personal, PersonalAsignado, EventoConPersonal } from "@/types/database";

type Props = {
  eventoId: string;
  fechaEvento: string;
  estadoLiquidacion: "pendiente" | "liquidado";
};

export default function PersonalPanel({ eventoId, fechaEvento, estadoLiquidacion }: Props) {
  const { toast } = useToast();
  const [catalogo, setCatalogo] = useState<Personal[]>([]);
  const [asignados, setAsignados] = useState<PersonalAsignado[]>([]);
  const [selectToAdd, setSelectToAdd] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [liquidacionEvento, setLiquidacionEvento] = useState<EventoConPersonal | null>(null);
  const [isLiquidacionOpen, setIsLiquidacionOpen] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // catálogo personal
      const { data: pers, error: e1 } = await supabase
        .from("personal")
        .select("*")
        .order("nombre_completo");
      if (e1) throw e1;

      // asignaciones
      const { data: evPers, error: e2 } = await supabase
        .from("evento_personal")
        .select(`
          id,
          hora_inicio,
          hora_fin,
          horas_trabajadas,
          pago_calculado,
          estado_pago,
          fecha_pago,
          metodo_pago,
          notas_pago,
          personal (*)
        `)
        .eq("evento_id", eventoId);
      if (e2) throw e2;

      const list: PersonalAsignado[] = (evPers || []).map((ep: any) => ({
        ...ep.personal,
        hora_inicio: ep.hora_inicio,
        hora_fin: ep.hora_fin,
        horas_trabajadas: ep.horas_trabajadas,
        pago_calculado: ep.pago_calculado,
        estado_pago: ep.estado_pago,
        fecha_pago: ep.fecha_pago,
        metodo_pago: ep.metodo_pago,
        notas_pago: ep.notas_pago,
        evento_personal_id: ep.id,
      }));

      setCatalogo((pers || []) as Personal[]);
      setAsignados(list);
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo cargar personal.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const noAsignadosCatalog = useMemo(
    () => catalogo.filter(p => !asignados.some(a => a.id === p.id)),
    [catalogo, asignados]
  );

  const totalCalculado = useMemo(
    () => asignados.reduce((acc, p) => acc + (Number(p.pago_calculado) || 0), 0),
    [asignados]
  );

  const handleAdd = async () => {
    if (!selectToAdd) return;
    try {
      const persona = catalogo.find(p => p.id === selectToAdd);
      if (!persona) return;

      const { error } = await supabase.from("evento_personal").insert({
        evento_id: eventoId,
        personal_id: persona.id,
        estado_pago: "pendiente",
      });
      if (error) throw error;

      setSelectToAdd("");
      await fetchData();
      toast({ title: "Personal asignado", description: `${persona.nombre_completo} agregado al evento.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo asignar.", variant: "destructive" });
    }
  };

  const handleRemove = async (evento_personal_id: string) => {
    try {
      const { error } = await supabase
        .from("evento_personal")
        .delete()
        .eq("id", evento_personal_id);
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo eliminar.", variant: "destructive" });
    }
  };

  const handleUpdateRow = (id: string, patch: Partial<PersonalAsignado>) => {
    setAsignados(prev => prev.map(p => (p.evento_personal_id === id ? { ...p, ...patch } : p)));
  };

  const handleSaveRow = async (row: PersonalAsignado) => {
    try {
      const { error } = await supabase
        .from("evento_personal")
        .update({
          hora_inicio: row.hora_inicio || null,
          hora_fin: row.hora_fin || null,
          horas_trabajadas: row.horas_trabajadas != null ? Number(row.horas_trabajadas) : null,
          pago_calculado: row.pago_calculado != null ? Number(row.pago_calculado) : null,
          estado_pago: row.estado_pago || "pendiente",
          fecha_pago: row.fecha_pago || null,
          metodo_pago: row.metodo_pago || null,
          notas_pago: row.notas_pago || null,
        })
        .eq("id", row.evento_personal_id);
      if (error) throw error;

      toast({ title: "Guardado", description: `${row.nombre_completo}: cambios aplicados.` });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message ?? "No se pudo guardar.", variant: "destructive" });
    }
  };

  const handleLiquidar = () => {
    // Validaciones similares a tu vista anterior
    const sinHoras = asignados.filter(p => !p.horas_trabajadas || p.horas_trabajadas <= 0);
    if (sinHoras.length > 0) {
      toast({
        title: "Información faltante",
        description: `${sinHoras.length} empleado(s) no tienen horas de trabajo definidas.`,
        variant: "destructive",
      });
      return;
    }
    const evento: EventoConPersonal = {
      id: eventoId,
      nombre_evento: "",
      ubicacion: "",
      fecha_evento: fechaEvento,
      descripcion: null,
      estado_liquidacion: estadoLiquidacion,
      personal: asignados,
      costo_total: totalCalculado,
    } as any;
    setLiquidacionEvento(evento);
    setIsLiquidacionOpen(true);
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle>Personal</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Asignar nuevo */}
        <div className="flex gap-2">
          <Select value={selectToAdd} onValueChange={setSelectToAdd}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona personal para asignar" />
            </SelectTrigger>
            <SelectContent>
              {noAsignadosCatalog.length === 0 ? (
                <div className="px-3 py-2 text-sm text-slate-500">Sin candidatos disponibles</div>
              ) : (
                noAsignadosCatalog.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre_completo} — {p.rol}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={!selectToAdd}>
            <Plus className="h-4 w-4 mr-1" /> Añadir
          </Button>
        </div>

        {/* Tabla de asignados */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-center">Inicio</TableHead>
                <TableHead className="text-center">Fin</TableHead>
                <TableHead className="text-center">Horas</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-center">Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : asignados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                    Sin personal asignado a este evento
                  </TableCell>
                </TableRow>
              ) : (
                asignados.map((p) => (
                  <TableRow key={p.evento_personal_id}>
                    <TableCell className="font-medium">{p.nombre_completo}</TableCell>
                    <TableCell>{p.rol}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        className="w-28"
                        value={p.hora_inicio ?? ""}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { hora_inicio: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="time"
                        className="w-28"
                        value={p.hora_fin ?? ""}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { hora_fin: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min={0}
                        step={0.5}
                        className="w-24 text-center"
                        value={p.horas_trabajadas ?? 0}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { horas_trabajadas: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        className="w-28 text-right"
                        value={p.pago_calculado ?? 0}
                        onChange={(e) => handleUpdateRow(p.evento_personal_id!, { pago_calculado: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={p.estado_pago ?? "pendiente"}
                        onValueChange={(v) => handleUpdateRow(p.evento_personal_id!, { estado_pago: v as any })}
                      >
                        <SelectTrigger className="w-32 mx-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">pendiente</SelectItem>
                          <SelectItem value="pagado">pagado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleSaveRow(p)}>
                          Guardar
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleRemove(p.evento_personal_id!)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* totales + liquidación */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {asignados.length} empleado(s) asignado(s)
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500">Total calculado</div>
              <div className="text-lg font-bold">${totalCalculado.toLocaleString()}</div>
            </div>
            <Button
              variant="default"
              onClick={handleLiquidar}
              disabled={estadoLiquidacion === "liquidado" || asignados.length === 0}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              {estadoLiquidacion === "liquidado" ? "Evento liquidado" : "Liquidar evento"}
            </Button>
          </div>
        </div>

        {/* Dialog de liquidación (reutiliza tu componente) */}
        {liquidacionEvento && (
          <LiquidacionDialog
            evento={liquidacionEvento}
            isOpen={isLiquidacionOpen}
            onClose={() => {
              setIsLiquidacionOpen(false);
              setLiquidacionEvento(null);
            }}
            onLiquidationComplete={() => fetchData()}
          />
        )}
      </CardContent>
    </Card>
  );
}
