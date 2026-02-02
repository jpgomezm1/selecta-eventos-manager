import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ingredientesConStock } from "@/integrations/supabase/apiInventario";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, Package, AlertTriangle, DollarSign, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

export default function StockTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: ingredientes = [], isLoading } = useQuery({
    queryKey: ["ingredientes-stock"],
    queryFn: ingredientesConStock,
  });

  const filtered = ingredientes.filter((i) =>
    i.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const totalItems = filtered.length;
  const sinStock = filtered.filter((i) => (i.stock_actual ?? 0) <= 0).length;
  const valorTotal = filtered.reduce(
    (acc, i) => acc + (i.stock_actual ?? 0) * i.costo_por_unidad,
    0
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const fmt = (n: number) =>
    `$ ${n.toLocaleString("es-CO", { minimumFractionDigits: 0 })}`;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <Package className="h-8 w-8 text-blue-500" />
          <div>
            <p className="text-sm text-slate-500">Total items</p>
            <p className="text-xl font-semibold">{totalItems}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <div>
            <p className="text-sm text-slate-500">Sin stock</p>
            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold">{sinStock}</p>
              {sinStock > 0 && <Badge variant="destructive">{sinStock}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <DollarSign className="h-8 w-8 text-green-500" />
          <div>
            <p className="text-sm text-slate-500">Valor total inventario</p>
            <p className="text-xl font-semibold">{fmt(valorTotal)}</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar ingrediente..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingrediente</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Stock actual</TableHead>
              <TableHead className="text-right">Costo/unidad</TableHead>
              <TableHead className="text-right">Valor en stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  No se encontraron ingredientes
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((i) => {
                const stock = i.stock_actual ?? 0;
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.nombre}</TableCell>
                    <TableCell>{i.unidad}</TableCell>
                    <TableCell className="text-right">
                      <span className={stock <= 0 ? "text-red-600 font-semibold" : ""}>
                        {stock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{fmt(i.costo_por_unidad)}</TableCell>
                    <TableCell className="text-right">{fmt(stock * i.costo_por_unidad)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Mostrando {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalItems)} de {totalItems}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
