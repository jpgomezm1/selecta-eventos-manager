import { useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  construirIndiceIngredientes,
  validarCosto,
  type IndiceIngredientes,
} from "@/lib/mapeoExcelCostos";
import { guardarCostos, type CargaIngrediente } from "@/integrations/supabase/apiCargaPublica";
import type { IngredienteCatalogo } from "@/types/cotizador";

/**
 * Reemplazo web de la hoja «Insumos» del Excel.
 *
 * Una fila se guarda sola cuando el foco sale de ella y los cuatro campos son
 * válidos. No hay botón «Guardar todo» a propósito: quien llena esto lo hace en
 * varias sentadas, y un botón global invita a perder media hora de trabajo al
 * cerrar la pestaña.
 *
 * La validación es la MISMA que la del importador de Excel (`validarCosto`),
 * incluida la conversión a unidad base. Si las dos rutas se separan, el mismo
 * dato entra con distinto costo según por dónde haya entrado.
 */

const UNIDADES = ["gr", "kg", "lb", "oz", "ml", "lt", "und"];
const POR_PAGINA = 60;

type Estado = "limpia" | "guardando" | "guardada" | "error";

interface Borrador {
  proveedor: string;
  presentacion: string;
  unidad: string;
  precio: string;
}

interface Props {
  token: string;
  ingredientes: CargaIngrediente[];
  /** Refresca el contador del encabezado sin volver a bajar todo el catálogo. */
  onGuardado: (ingredienteId: string, costoPorUnidadBase: number) => void;
}

const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

function borradorInicial(ing: CargaIngrediente): Borrador {
  return {
    proveedor: ing.proveedor ?? "",
    presentacion: ing.presentacion_cantidad != null ? String(ing.presentacion_cantidad) : "",
    unidad: ing.presentacion_unidad ?? "",
    precio: ing.precio_presentacion != null ? String(Math.round(ing.precio_presentacion)) : "",
  };
}

export default function GridCostos({ token, ingredientes, onGuardado }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [soloFaltantes, setSoloFaltantes] = useState(true);
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [errores, setErrores] = useState<Record<string, string[]>>({});

  // El índice que espera `validarCosto` está tipado contra el catálogo de la
  // app; acá solo necesita nombre, unidad y costo para resolver y convertir.
  const indice: IndiceIngredientes = useMemo(
    () =>
      construirIndiceIngredientes(
        ingredientes.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          unidad: i.unidad,
          costo_por_unidad: i.costo_por_unidad,
        })) as IngredienteCatalogo[]
      ),
    [ingredientes]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ingredientes.filter((i) => {
      if (soloFaltantes && i.costo_por_unidad > 0) return false;
      if (q && !i.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ingredientes, busqueda, soloFaltantes]);

  const leer = (ing: CargaIngrediente): Borrador =>
    borradores[ing.id] ?? borradorInicial(ing);

  const escribir = (id: string, campo: keyof Borrador, valor: string, ing: CargaIngrediente) => {
    setBorradores((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? borradorInicial(ing)), [campo]: valor },
    }));
    setEstados((prev) => (prev[id] ? { ...prev, [id]: "limpia" } : prev));
    setErrores((prev) => (prev[id] ? { ...prev, [id]: [] } : prev));
  };

  /** Se dispara cuando el foco sale de la fila entera, no de cada input. */
  const salirDeFila = async (ing: CargaIngrediente, e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;

    const b = leer(ing);
    const vacia = !b.proveedor && !b.presentacion && !b.unidad && !b.precio;
    if (vacia) return;

    const validado = validarCosto(
      {
        nombre: ing.nombre,
        proveedor: b.proveedor,
        presentacion: b.presentacion,
        unidad: b.unidad,
        precio: b.precio,
      },
      indice
    );

    if (validado.errores.length > 0) {
      setErrores((prev) => ({ ...prev, [ing.id]: validado.errores }));
      setEstados((prev) => ({ ...prev, [ing.id]: "error" }));
      return;
    }
    if (!validado.ingrediente_id) return;

    setEstados((prev) => ({ ...prev, [ing.id]: "guardando" }));
    try {
      await guardarCostos(token, [
        {
          ingrediente_id: validado.ingrediente_id,
          proveedor: validado.proveedor,
          presentacion_cantidad: validado.presentacion_cantidad,
          presentacion_unidad: validado.presentacion_unidad,
          precio_presentacion: validado.precio_presentacion,
          costo_por_unidad_base: validado.costo_por_unidad_base,
        },
      ]);
      setEstados((prev) => ({ ...prev, [ing.id]: "guardada" }));
      setErrores((prev) => ({ ...prev, [ing.id]: [] }));
      onGuardado(ing.id, validado.costo_por_unidad_base);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      setEstados((prev) => ({ ...prev, [ing.id]: "error" }));
      setErrores((prev) => ({ ...prev, [ing.id]: [msg] }));
      toast.error(`No se pudo guardar "${ing.nombre}"`, { description: msg });
    }
  };

  const pendientes = ingredientes.filter((i) => i.costo_por_unidad === 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setVisibles(POR_PAGINA);
            }}
            placeholder="Buscar un insumo…"
            className="pl-9"
          />
        </div>
        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={soloFaltantes}
            onChange={(e) => {
              setSoloFaltantes(e.target.checked);
              setVisibles(POR_PAGINA);
            }}
            className="h-4 w-4 accent-primary"
          />
          Ver solo los {pendientes} que faltan
        </label>
      </div>

      <div className="hidden gap-3 border-b border-border pb-2 text-xs uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_90px_80px_110px_100px]">
        <span>Insumo</span>
        <span>Proveedor</span>
        <span>Presentación</span>
        <span>Unidad</span>
        <span>Precio</span>
        <span className="text-right">Costo</span>
      </div>

      <div className="space-y-2">
        {filtrados.slice(0, visibles).map((ing) => {
          const b = leer(ing);
          const estado = estados[ing.id] ?? "limpia";
          const errs = errores[ing.id] ?? [];
          const yaTiene = ing.costo_por_unidad > 0;

          return (
            <div
              key={ing.id}
              onBlur={(e) => void salirDeFila(ing, e)}
              className={`rounded-md border px-3 py-2.5 transition-colors ${
                estado === "error"
                  ? "border-destructive/50 bg-destructive/5"
                  : estado === "guardada"
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card"
              }`}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_90px_80px_110px_100px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium">{ing.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    se mide en {ing.unidad}
                    {yaTiene && ` · hoy ${fmt(ing.costo_por_unidad)}/${ing.unidad}`}
                  </p>
                </div>

                <Input
                  value={b.proveedor}
                  onChange={(e) => escribir(ing.id, "proveedor", e.target.value, ing)}
                  placeholder="Proveedor"
                  aria-label={`Proveedor de ${ing.nombre}`}
                />
                <Input
                  value={b.presentacion}
                  onChange={(e) => escribir(ing.id, "presentacion", e.target.value, ing)}
                  placeholder="25"
                  inputMode="decimal"
                  aria-label={`Presentación de ${ing.nombre}`}
                />
                <select
                  value={b.unidad}
                  onChange={(e) => escribir(ing.id, "unidad", e.target.value, ing)}
                  aria-label={`Unidad de compra de ${ing.nombre}`}
                  className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">—</option>
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <Input
                  value={b.precio}
                  onChange={(e) => escribir(ing.id, "precio", e.target.value, ing)}
                  placeholder="120000"
                  inputMode="numeric"
                  aria-label={`Precio de la presentación de ${ing.nombre}`}
                />

                <div className="flex items-center justify-end gap-1.5 text-sm tabular-nums">
                  {estado === "guardando" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {estado === "guardada" && <Check className="h-4 w-4 text-primary" />}
                  {yaTiene && estado !== "guardando" && (
                    <span className="text-muted-foreground">
                      {fmt(ing.costo_por_unidad)}
                    </span>
                  )}
                </div>
              </div>

              {errs.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-sm text-destructive">
                  {errs.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          {soloFaltantes
            ? "No queda ningún insumo sin costo con ese filtro."
            : "Ningún insumo coincide con la búsqueda."}
        </p>
      )}

      {visibles < filtrados.length && (
        <div className="pt-2 text-center">
          <Button variant="outline" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
            Ver {Math.min(POR_PAGINA, filtrados.length - visibles)} más
            <span className="ml-1.5 text-muted-foreground">
              ({filtrados.length - visibles} restantes)
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
