import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import type { CotizacionItemsState } from "@/types/cotizador";

type Props = {
  invitados: number;
  items: CotizacionItemsState;
  total: number;
  subtotales: { platos: number; personal: number; transportes: number };
  onQtyChange: (tipo: keyof CotizacionItemsState, id: string, qty: number) => void;
  onRemove: (tipo: keyof CotizacionItemsState, id: string) => void;
  onGuardar: () => void;
  guardando: boolean;
};

export function ResumenCotizacion({
  invitados,
  items,
  total,
  subtotales,
  onQtyChange,
  onRemove,
  onGuardar,
  guardando,
}: Props) {
  const rows = [
    ...items.platos.map((p) => ({
      tipo: "platos" as const,
      id: p.plato_id,
      nombre: p.nombre,
      precio: p.precio_unitario,
      cantidad: p.cantidad,
      subtotal: p.cantidad * p.precio_unitario,
      group: "Platos",
    })),
    ...items.personal.map((p) => ({
      tipo: "personal" as const,
      id: p.personal_costo_id,
      nombre: p.rol,
      precio: p.tarifa_estimada_por_persona,
      cantidad: p.cantidad,
      subtotal: p.cantidad * p.tarifa_estimada_por_persona,
      group: "Personal",
    })),
    ...items.transportes.map((t) => ({
      tipo: "transportes" as const,
      id: t.transporte_id,
      nombre: `Transporte • ${t.lugar}`,
      precio: t.tarifa_unitaria,
      cantidad: t.cantidad,
      subtotal: t.cantidad * t.tarifa_unitaria,
      group: "Transporte",
    })),
  ];

  const hasItems = rows.length > 0;

  // Simple grouping in-place
  const grouped = [
    { label: "Platos", rows: rows.filter((r) => r.group === "Platos"), subtotal: subtotales.platos },
    { label: "Personal", rows: rows.filter((r) => r.group === "Personal"), subtotal: subtotales.personal },
    { label: "Transporte", rows: rows.filter((r) => r.group === "Transporte"), subtotal: subtotales.transportes },
  ].filter((g) => g.rows.length > 0);

  return (
    <Card className="sticky top-4 shadow-soft">
      <CardHeader>
        <CardTitle>Resumen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-slate-600">
          Invitados: <span className="font-semibold text-slate-800">{invitados}</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-center">Cant.</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasItems ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-6">
                  Agrega items desde las pestañas de la izquierda.
                </TableCell>
              </TableRow>
            ) : (
              grouped.flatMap((g) => [
                <TableRow key={`group-${g.label}`} className="bg-slate-50/60">
                  <TableCell colSpan={5} className="font-semibold">{g.label}</TableCell>
                </TableRow>,
                ...g.rows.map((r) => (
                  <TableRow key={`${r.tipo}-${r.id}`}>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-right">${r.precio.toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => onQtyChange(r.tipo, r.id, Math.max(1, r.cantidad - 1))}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          className="w-16 text-center"
                          value={r.cantidad}
                          onChange={(e) => onQtyChange(r.tipo, r.id, Math.max(1, Number(e.target.value)))}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => onQtyChange(r.tipo, r.id, r.cantidad + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">${r.subtotal.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onRemove(r.tipo, r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )),
                <TableRow key={`subtotal-${g.label}`}>
                  <TableCell colSpan={3} className="text-right font-medium">Subtotal {g.label}</TableCell>
                  <TableCell className="text-right font-semibold">${g.subtotal.toLocaleString()}</TableCell>
                  <TableCell />
                </TableRow>,
              ])
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-slate-500">* Cálculo en tiempo real</div>
          <div className="text-right">
            <div className="text-slate-500 text-sm">Total</div>
            <div className="text-2xl font-bold">${total.toLocaleString()}</div>
          </div>
        </div>

        <Button className="w-full" onClick={onGuardar} disabled={guardando || !hasItems}>
          {guardando ? "Guardando..." : "Guardar Cotización"}
        </Button>
      </CardContent>
    </Card>
  );
}
