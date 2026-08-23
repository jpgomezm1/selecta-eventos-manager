import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GridCostos from "@/components/CargaPublica/GridCostos";
import GridRecetas from "@/components/CargaPublica/GridRecetas";
import GridMenaje from "@/components/CargaPublica/GridMenaje";
import {
  getCargaDatos,
  type CargaDatos,
  type CargaIngrediente,
  type CargaMenaje,
  type CargaPlato,
} from "@/integrations/supabase/apiCargaPublica";

/**
 * Editor público de catálogo (`/carga/:token`).
 *
 * Reemplaza el ida y vuelta por Excel: el cliente escribe acá y queda guardado
 * en el momento. `/carga` (sin token) sigue existiendo con los .xlsx para quien
 * prefiera llenarlos aparte.
 *
 * Se abre sin sesión. Lo que autoriza a escribir es el token de la URL, que
 * validan por dentro las funciones `fn_carga_publica_*`. Este componente no
 * consulta ninguna tabla directo — ver `apiCargaPublica.ts`.
 *
 * El estado vive acá y no en cada grilla porque los contadores del encabezado
 * tienen que moverse cuando se guarda una fila, sin volver a bajar el catálogo
 * entero (son 325 insumos + 393 platos).
 */

const LOGO_URL =
  "https://storage.googleapis.com/cluvi/Selecta-Eventos/logo_selecta_nuevo.png";

function Progreso({ hechos, total, label }: { hechos: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
  return (
    <div className="py-4 pr-6">
      <div className="kicker mb-1.5">{label}</div>
      <div className="font-serif text-[1.75rem] leading-none tabular-nums">
        {hechos.toLocaleString("es-CO")}
        <span className="text-lg text-muted-foreground">/{total.toLocaleString("es-CO")}</span>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function CargaEditor() {
  const { token = "" } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<CargaDatos | null>(null);

  const { isLoading, error } = useQuery({
    queryKey: ["carga-publica", token],
    queryFn: async () => {
      const d = await getCargaDatos(token);
      setDatos(d);
      return d;
    },
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const cambiarIngredientes = useCallback((ingredientes: CargaIngrediente[]) => {
    setDatos((prev) => (prev ? { ...prev, ingredientes } : prev));
  }, []);

  const actualizarPlato = useCallback((plato: CargaPlato) => {
    setDatos((prev) =>
      prev
        ? { ...prev, platos: prev.platos.map((p) => (p.id === plato.id ? plato : p)) }
        : prev
    );
  }, []);

  const marcarPlatos = useCallback((ids: string[], valor: boolean) => {
    const set = new Set(ids);
    setDatos((prev) =>
      prev
        ? {
            ...prev,
            // Un plato con receta no cambia: la función SQL lo salta y la
            // pantalla tiene que reflejar lo mismo que quedó en la base.
            platos: prev.platos.map((p) =>
              set.has(p.id) && (!valor || p.items.length === 0)
                ? { ...p, sin_insumos: valor }
                : p
            ),
          }
        : prev
    );
  }, []);

  const cambiarMenaje = useCallback((menaje: CargaMenaje[]) => {
    setDatos((prev) => (prev ? { ...prev, menaje } : prev));
  }, []);

  const resumen = useMemo(() => {
    if (!datos) return null;
    return {
      insumosHechos: datos.ingredientes.filter((i) => i.costo_por_unidad > 0).length,
      insumosTotal: datos.ingredientes.length,
      platosHechos: datos.platos.filter((p) => p.items.length > 0 || p.sin_insumos).length,
      platosTotal: datos.platos.length,
      menaje: datos.menaje.length,
    };
  }, [datos]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !datos) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-warning" strokeWidth={1.75} />
          <h1 className="mt-5 font-serif text-2xl tracking-tight">
            Este link no está activo
          </h1>
          <p className="mt-3 text-muted-foreground">
            Puede que haya vencido o que se haya copiado incompleto. Escríbannos y les
            mandamos uno nuevo — toma un minuto.
          </p>
          <Link
            to="/carga"
            className="mt-6 inline-block text-sm text-primary underline underline-offset-4"
          >
            Mientras tanto, descargar las plantillas en Excel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <header className="pt-12 md:pt-16">
          <img src={LOGO_URL} alt="Selecta Eventos" className="mb-8 h-10 w-auto" loading="eager" />

          <h1 className="max-w-3xl font-serif text-[1.75rem] leading-[1.15] tracking-tight md:text-[2.5rem]">
            Completen su catálogo acá mismo
          </h1>
          <p className="mt-4 max-w-[63ch] text-lg leading-relaxed text-muted-foreground">
            Se guarda al momento, acá mismo. No hay que descargar nada, no hay que
            mandarnos nada, y pueden cerrar la página y volver cuando quieran: lo que ya
            guardaron queda.
          </p>

          {resumen && (
            <div className="mt-8 grid grid-cols-1 gap-x-8 border-y border-border sm:grid-cols-3">
              <Progreso
                hechos={resumen.insumosHechos}
                total={resumen.insumosTotal}
                label="Insumos con costo"
              />
              <Progreso
                hechos={resumen.platosHechos}
                total={resumen.platosTotal}
                label="Platos resueltos"
              />
              <div className="py-4">
                <div className="kicker mb-1.5">Artículos en bodega</div>
                <div className="font-serif text-[1.75rem] leading-none tabular-nums">
                  {resumen.menaje.toLocaleString("es-CO")}
                </div>
                <p className="mt-2.5 text-[13px] text-muted-foreground">
                  los que estén de más son de ejemplo — quítenlos
                </p>
              </div>
            </div>
          )}
        </header>

        <Tabs defaultValue="costos" className="pt-10">
          <TabsList>
            <TabsTrigger value="costos">Costos de insumos</TabsTrigger>
            <TabsTrigger value="recetas">Recetas</TabsTrigger>
            <TabsTrigger value="menaje">Menaje</TabsTrigger>
          </TabsList>

          <TabsContent value="costos" className="mt-6">
            <p className="mb-6 max-w-[70ch] rounded-r-sm border-l-[3px] border-primary bg-muted/50 px-5 py-4 text-[15px] leading-relaxed">
              <strong className="font-semibold">Escriban cómo compran, no cómo cocinan.</strong>{" "}
              Si el arroz les llega en bultos de 25&nbsp;kg y el bulto vale $120.000, eso es lo
              que va — el sistema hace la división y saca el costo por kilo solo. Si a un insumo
              le compran a dos proveedores, cárguenlos los dos y elijan cuál manda; si les falta
              un insumo en la lista, créenlo.
            </p>
            <GridCostos
              token={token}
              ingredientes={datos.ingredientes}
              onCambio={cambiarIngredientes}
            />
          </TabsContent>

          <TabsContent value="recetas" className="mt-6">
            <p className="mb-6 max-w-[70ch] rounded-r-sm border-l-[3px] border-primary bg-muted/50 px-5 py-4 text-[15px] leading-relaxed">
              <strong className="font-semibold">La cantidad es para una sola porción.</strong>{" "}
              Si un plato lleva 150 gramos de pollo, escriban 150 — no los 30 kilos del evento
              entero.{" "}
              <strong className="font-semibold">
                Y si algo no lleva insumos —un vino, una gaseosa— dígannoslo con el botón:
              </strong>{" "}
              sale de la lista y deja de aparecer como pendiente.
            </p>
            <GridRecetas
              token={token}
              platos={datos.platos}
              ingredientes={datos.ingredientes}
              onPlatoActualizado={actualizarPlato}
              onPlatosMarcados={marcarPlatos}
            />
          </TabsContent>

          <TabsContent value="menaje" className="mt-6">
            <p className="mb-6 max-w-[70ch] rounded-r-sm border-l-[3px] border-primary bg-muted/50 px-5 py-4 text-[15px] leading-relaxed">
              <strong className="font-semibold">
                El stock es lo que tienen, no lo que está libre hoy.
              </strong>{" "}
              Si tienen 300 copas y hay 80 prestadas en un evento, son 300. El sistema descuenta
              las reservadas en cada fecha. Lo que hay cargado ahora lo pusimos nosotros de
              ejemplo: cámbienlo o quítenlo.
            </p>
            <GridMenaje token={token} menaje={datos.menaje} onCambio={cambiarMenaje} />
          </TabsContent>
        </Tabs>

        <footer className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          ¿Prefieren llenarlo en Excel?{" "}
          <Link to="/carga" className="text-primary underline underline-offset-4">
            Las plantillas siguen disponibles
          </Link>
          . Cualquier duda, respondan al correo por el que les llegó este link.
        </footer>
      </div>
    </div>
  );
}
