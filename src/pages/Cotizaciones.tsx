import { useQuery } from "@tanstack/react-query";
import { listCotizaciones } from "@/integrations/supabase/apiCotizador";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function CotizacionesListPage() {
  const nav = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["cotizaciones"],
    queryFn: listCotizaciones,
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-10 text-center">Cargando…</CardContent></Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card><CardContent className="p-10 text-center text-red-600">Error cargando cotizaciones.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cotizaciones</h1>
        <Button onClick={() => nav("/cotizador/nueva")}>Nueva cotización</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(data ?? []).map((c) => (
          <Card key={c.id} className="hover:shadow transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="truncate">{c.nombre_cotizacion}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-sm text-slate-600">Cliente: {c.cliente_nombre ?? "-"}</div>
              <div className="text-sm text-slate-600">Invitados: {c.numero_invitados}</div>
              <div className="text-sm text-slate-600">Estado: {c.estado}</div>
              <div className="text-sm font-medium">Total: ${c.total_cotizado.toLocaleString()}</div>
              <div className="pt-2">
                <Button variant="outline" onClick={() => nav(`/cotizador/${c.id}`)}>Abrir</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
