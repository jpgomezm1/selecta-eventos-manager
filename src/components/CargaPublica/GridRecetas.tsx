import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import BarraFiltros, { type EstadoFiltro } from "@/components/CargaPublica/BarraFiltros";
import {
  guardarReceta,
  marcarSinInsumos,
  type CargaIngrediente,
  type CargaPlato,
} from "@/integrations/supabase/apiCargaPublica";

/**
 * Reemplazo web de la hoja «Recetas» del Excel.
 *
 * Dos diferencias con el resto de grillas:
 *
 * 1. No hay autoguardado por fila. Una receta son varias líneas y sustituye a
 *    la anterior completa; guardar a media edición dejaría el plato con la
 *    mitad de sus insumos. Va con botón explícito.
 *
 * 2. Existe «no lleva insumos». Hasta ahora un vino y un plato sin cargar eran
 *    el mismo estado (cero líneas), así que las bebidas iban a quedar en la
 *    lista de pendientes para siempre. Son 51 de los 209 — por eso la marca se
 *    puede aplicar a una categoría entera de un golpe.
 */

const POR_PAGINA = 40;

interface LineaBorrador {
  ingrediente_id: string;
  cantidad: string;
}

interface Props {
  token: string;
  platos: CargaPlato[];
  ingredientes: CargaIngrediente[];
  onPlatoActualizado: (plato: CargaPlato) => void;
  onPlatosMarcados: (ids: string[], valor: boolean) => void;
}

type EstadoPlato = "sin_resolver" | "con_receta" | "sin_insumos";

function estadoDe(p: CargaPlato): EstadoPlato {
  if (p.items.length > 0) return "con_receta";
  if (p.sin_insumos) return "sin_insumos";
  return "sin_resolver";
}

const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

/**
 * Elige un insumo del catálogo para una línea de receta.
 *
 * Tres cosas que la primera versión no hacía y volvían lento el llenado:
 *
 * - Abre la lista al enfocar, sin escribir. Quien llena una receta muchas veces
 *   no recuerda cómo se llama el insumo en el catálogo ("Aceite Vegetal" o
 *   "Aceite de Girasol"), y un input vacío que no muestra nada no ayuda.
 * - Esconde los que ya están en esta receta. Elegirlos dos veces se rechaza al
 *   guardar; mejor que no aparezcan.
 * - Se maneja con teclado (flechas + Enter), que es como se llena una lista
 *   larga sin soltar las manos.
 *
 * Va con input + lista propia y no con el Command de shadcn porque hay una de
 * estas por línea de receta y el popover de Radix pesa de más para esto.
 */
const MAX_OPCIONES = 50;

function SelectorInsumo({
  ingredientes,
  valor,
  excluir,
  onCambio,
}: {
  ingredientes: CargaIngrediente[];
  valor: string;
  /** Ids ya usados en esta receta: no se ofrecen de nuevo. */
  excluir: string[];
  onCambio: (id: string) => void;
}) {
  const elegido = ingredientes.find((i) => i.id === valor);
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const listaRef = useRef<HTMLUListElement>(null);

  const disponibles = useMemo(() => {
    const fuera = new Set(excluir);
    return ingredientes.filter((i) => !fuera.has(i.id));
  }, [ingredientes, excluir]);

  const opciones = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? disponibles.filter((i) => i.nombre.toLowerCase().includes(q)) : disponibles;
    return base.slice(0, MAX_OPCIONES);
  }, [disponibles, query]);

  const sobrantes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const total = q ? disponibles.filter((i) => i.nombre.toLowerCase().includes(q)).length : disponibles.length;
    return total - opciones.length;
  }, [disponibles, query, opciones.length]);

  // El resaltado se sale de rango cuando cambia el filtro.
  useEffect(() => setResaltado(0), [query, abierto]);

  useEffect(() => {
    listaRef.current?.children[resaltado]?.scrollIntoView({ block: "nearest" });
  }, [resaltado]);

  const elegir = (id: string) => {
    onCambio(id);
    setQuery("");
    setAbierto(false);
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (!abierto) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((r) => Math.min(r + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((r) => Math.max(r - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = opciones[resaltado];
      if (o) elegir(o.id);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  if (elegido) {
    return (
      <div className="flex h-10 items-center justify-between gap-2 rounded-md border border-input bg-background px-3">
        <span className="truncate text-sm">
          {elegido.nombre}
          <span className="ml-1.5 text-xs text-muted-foreground">({elegido.unidad})</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onCambio("");
            setQuery("");
          }}
          aria-label={`Quitar ${elegido.nombre}`}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclas}
        // El click en una opción dispara blur antes que el onClick del item;
        // el delay deja que la selección gane.
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="Elijan un insumo…"
        aria-label="Buscar insumo"
        autoComplete="off"
      />
      {abierto && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {opciones.length > 0 ? (
            <>
              <ul ref={listaRef} className="max-h-64 overflow-y-auto">
                {opciones.map((o, idx) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setResaltado(idx)}
                      onClick={() => elegir(o.id)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                        idx === resaltado ? "bg-accent" : ""
                      }`}
                    >
                      <span className="truncate">{o.nombre}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {o.unidad}
                        {o.costo_por_unidad === 0 && " · sin costo"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {sobrantes > 0 && (
                <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  y {sobrantes} más — escriban para filtrar
                </p>
              )}
            </>
          ) : (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {query.trim()
                ? `No hay ningún insumo que se llame «${query.trim()}». Créenlo en la pestaña de Costos de insumos y vuelvan.`
                : "Ya agregaron todos los insumos del catálogo a esta receta."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function GridRecetas({
  token,
  platos,
  ingredientes,
  onPlatoActualizado,
  onPlatosMarcados,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [filtro, setFiltro] = useState<EstadoFiltro>("faltan");
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [lineas, setLineas] = useState<LineaBorrador[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [marcando, setMarcando] = useState(false);

  const categorias = useMemo(
    () => [...new Set(platos.map((p) => p.categoria).filter(Boolean))].sort() as string[],
    [platos]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return platos.filter((p) => {
      const resuelto = estadoDe(p) !== "sin_resolver";
      if (filtro === "hechos" && !resuelto) return false;
      if (filtro === "faltan" && resuelto) return false;
      if (categoria && p.categoria !== categoria) return false;
      if (q && !p.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [platos, busqueda, categoria, filtro]);

  const conteos = useMemo(() => {
    const hechos = platos.filter((p) => estadoDe(p) !== "sin_resolver").length;
    return { todos: platos.length, hechos, faltan: platos.length - hechos };
  }, [platos]);

  /** Los de la categoría elegida que siguen sin resolver: el lote del botón. */
  const loteCategoria = useMemo(() => {
    if (!categoria) return [];
    return platos.filter((p) => p.categoria === categoria && estadoDe(p) === "sin_resolver");
  }, [platos, categoria]);

  const abrir = (p: CargaPlato) => {
    if (abierto === p.id) {
      setAbierto(null);
      return;
    }
    setAbierto(p.id);
    setLineas(
      p.items.length > 0
        ? p.items.map((i) => ({ ingrediente_id: i.ingrediente_id, cantidad: String(i.cantidad) }))
        : [{ ingrediente_id: "", cantidad: "" }]
    );
  };

  const guardar = async (p: CargaPlato) => {
    const items = lineas
      .filter((l) => l.ingrediente_id && Number(l.cantidad) > 0)
      .map((l) => ({ ingrediente_id: l.ingrediente_id, cantidad: Number(l.cantidad) }));

    if (items.length === 0) {
      toast.error("Agreguen al menos un insumo con su cantidad");
      return;
    }
    const ids = new Set(items.map((i) => i.ingrediente_id));
    if (ids.size !== items.length) {
      toast.error("Hay un insumo repetido", {
        description: "Sumen las cantidades en una sola línea.",
      });
      return;
    }

    setGuardando(true);
    try {
      await guardarReceta(token, p.id, items);
      onPlatoActualizado({ ...p, items, sin_insumos: false });
      setAbierto(null);
      toast.success(`Receta de "${p.nombre}" guardada`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      toast.error("No se pudo guardar la receta", { description: msg });
    } finally {
      setGuardando(false);
    }
  };

  const marcar = async (ids: string[], valor: boolean) => {
    setMarcando(true);
    try {
      const n = await marcarSinInsumos(token, ids, valor);
      onPlatosMarcados(ids, valor);
      if (valor) {
        toast.success(
          n === 1 ? "Marcado como que no lleva insumos" : `${n} platos marcados`
        );
      } else {
        toast.success("Vuelve a la lista de pendientes");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo marcar";
      toast.error("No se pudo marcar", { description: msg });
    } finally {
      setMarcando(false);
    }
  };

  return (
    <div className="space-y-5">
      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={(v) => {
          setBusqueda(v);
          setVisibles(POR_PAGINA);
        }}
        placeholder="Buscar un plato…"
        estado={filtro}
        onEstado={(e) => {
          setFiltro(e);
          setVisibles(POR_PAGINA);
        }}
        etiquetas={{ hechos: "Resueltos", faltan: "Sin resolver" }}
        conteos={conteos}
      >
        <select
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            setVisibles(POR_PAGINA);
          }}
          aria-label="Filtrar por categoría"
          className="h-10 shrink-0 rounded-md border border-input bg-background px-3 text-sm sm:w-56"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </BarraFiltros>

      {loteCategoria.length > 1 && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-[15px]">
            <strong className="font-semibold">
              ¿Ninguno de «{categoria}» lleva insumos?
            </strong>{" "}
            Si es una categoría de bebidas o de artículos que compran hechos, márquenlos
            todos de una vez y salen de la lista.
          </p>
          <Button
            className="mt-3"
            size="sm"
            disabled={marcando}
            onClick={() => void marcar(loteCategoria.map((p) => p.id), true)}
          >
            {marcando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Marcar los {loteCategoria.length} de «{categoria}»
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {filtrados.slice(0, visibles).map((p) => {
          const estado = estadoDe(p);
          const esteAbierto = abierto === p.id;

          return (
            <div
              key={p.id}
              className={`rounded-md border transition-colors ${
                estado === "sin_resolver" ? "border-border bg-card" : "border-primary/40 bg-primary/5"
              }`}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => abrir(p)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-expanded={esteAbierto}
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      esteAbierto ? "rotate-180" : ""
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.categoria ?? "sin categoría"} · se vende a {fmt(p.precio)}
                    </p>
                  </div>
                </button>

                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {estado === "con_receta" && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Check className="h-3.5 w-3.5" />
                      {p.items.length} insumos
                    </span>
                  )}
                  {estado === "sin_insumos" && (
                    <button
                      type="button"
                      disabled={marcando}
                      onClick={() => void marcar([p.id], false)}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      no lleva insumos · deshacer
                    </button>
                  )}
                  {estado === "sin_resolver" && <span>sin resolver</span>}
                </span>
              </div>

              {esteAbierto && (
                <div className="space-y-3 border-t border-border/60 px-3 py-3">
                  {lineas.map((l, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_40px]">
                      <SelectorInsumo
                        ingredientes={ingredientes}
                        valor={l.ingrediente_id}
                        excluir={lineas
                          .filter((_, i) => i !== idx)
                          .map((x) => x.ingrediente_id)
                          .filter(Boolean)}
                        onCambio={(id) =>
                          setLineas((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, ingrediente_id: id } : x))
                          )
                        }
                      />
                      <Input
                        value={l.cantidad}
                        onChange={(e) =>
                          setLineas((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, cantidad: e.target.value } : x))
                          )
                        }
                        placeholder="Cantidad"
                        inputMode="decimal"
                        aria-label="Cantidad por porción"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Quitar línea"
                        onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <p className="text-xs text-muted-foreground">
                    La cantidad es para <strong>una porción</strong>, en la unidad que aparece al
                    lado del insumo. El sistema multiplica según cuánta gente tenga el evento.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLineas((prev) => [...prev, { ingrediente_id: "", cantidad: "" }])
                      }
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Otro insumo
                    </Button>
                    <Button size="sm" disabled={guardando} onClick={() => void guardar(p)}>
                      {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Guardar receta
                    </Button>
                    {estado !== "sin_insumos" && p.items.length === 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={marcando}
                        onClick={() => void marcar([p.id], true)}
                      >
                        Este plato no lleva insumos
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <p className="py-10 text-center text-muted-foreground">
          {filtro === "faltan"
            ? "No queda ningún plato sin resolver con ese filtro."
            : "Ningún plato coincide con la búsqueda."}
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
