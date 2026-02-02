import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPlatosCatalogo, getAllPlatoIngredientes } from "@/integrations/supabase/apiCotizador";
import type { PlatoCatalogo, PlatoIngrediente } from "@/types/cotizador";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent } from "@/components/ui/card";
import { Search, Eye, UtensilsCrossed, DollarSign, ChefHat, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlatoDetailSheet from "./PlatoDetailSheet";

const CATEGORIAS = ["Todas", "Bebida", "Entrada", "Fuerte", "Guarnición", "Pasaboca"];

export default function PlatosTable() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todas");
  const [selectedPlatoId, setSelectedPlatoId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const { data: platos = [], isLoading: loadingPlatos } = useQuery({
    queryKey: ["platos-catalogo"],
    queryFn: getPlatosCatalogo,
  });

  const { data: allIngredientes = [] } = useQuery({
    queryKey: ["plato-ingredientes-all"],
    queryFn: getAllPlatoIngredientes,
  });

  // Compute cost per plato
  const costByPlato = useMemo(() => {
    const map = new Map<string, number>();
    for (const pi of allIngredientes) {
      const cost = pi.cantidad * (pi.ingrediente?.costo_por_unidad ?? 0);
      map.set(pi.plato_id, (map.get(pi.plato_id) ?? 0) + cost);
    }
    return map;
  }, [allIngredientes]);

  const filtered = useMemo(() => {
    return platos.filter((p) => {
      const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase());
      const matchCat = catFilter === "Todas" || p.categoria === catFilter;
      return matchSearch && matchCat;
    });
  }, [platos, search, catFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const conPrecio = platos.filter((p) => p.precio > 0).length;
  const costoPromedio = useMemo(() => {
    const costs = Array.from(costByPlato.values()).filter((c) => c > 0);
    return costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
  }, [costByPlato]);

  const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

  const openDetail = (id: string | null) => {
    setSelectedPlatoId(id);
    setSheetOpen(true);
  };

  if (loadingPlatos) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total platos</p>
              <p className="text-xl font-bold">{platos.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Con precio definido</p>
              <p className="text-xl font-bold">{conPrecio}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <ChefHat className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Costo promedio receta</p>
              <p className="text-xl font-bold">{fmt(costoPromedio)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter + New */}
      <div className="flex flex-wrap gap-3 items-end">
        <Button onClick={() => openDetail(null)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nuevo Plato
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Buscar plato..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-10" />
        </div>
        <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Costo ingredientes</TableHead>
              <TableHead className="text-right">Porciones</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((p) => {
              const costo = costByPlato.get(p.id) ?? 0;
              return (
                <TableRow key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openDetail(p.id)}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>
                    {p.categoria ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{p.categoria}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right">{p.precio > 0 ? fmt(p.precio) : <span className="text-slate-300">—</span>}</TableCell>
                  <TableCell className="text-right">{costo > 0 ? fmt(costo) : <span className="text-slate-300">—</span>}</TableCell>
                  <TableCell className="text-right">{p.porciones_receta ?? <span className="text-slate-300">—</span>}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openDetail(p.id); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-8">No se encontraron platos</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{filtered.length} platos</p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600">{page + 1} / {totalPages}</span>
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <PlatoDetailSheet platoId={selectedPlatoId} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
