import { useMemo, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import BarraFiltros, { type EstadoFiltro } from "@/components/CargaPublica/BarraFiltros";
import {
  bajaMenaje,
  guardarMenaje,
  type CargaMenaje,
} from "@/integrations/supabase/apiCargaPublica";

/**
 * Reemplazo web de la hoja «Menaje» del Excel.
 *
 * Es la única grilla que crea filas: las otras dos completan un catálogo que ya
 * existe. Guarda al salir de la fila, igual que costos.
 *
 * «Quitar» es baja lógica (activo = false), no DELETE: un artículo puede estar
 * amarrado a una reserva o a una cotización vieja y borrarlo rompería el
 * histórico. Sirve sobre todo para que saquen las 9 filas de ejemplo que
 * sembramos nosotros sin tener que pedírnoslo.
 */

const UNIDADES = ["unidad", "juego", "docena", "par", "metro"];

type Estado = "limpia" | "guardando" | "guardada" | "error";

interface Fila {
  /** Vacío mientras la fila no exista en la base todavía. */
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stock_total: string;
  precio_alquiler: string;
  costo_reposicion: string;
  /** Clave estable de React: el id no sirve porque las filas nuevas no tienen. */
  key: string;
}

interface Props {
  token: string;
  menaje: CargaMenaje[];
  onCambio: (menaje: CargaMenaje[]) => void;
}

const fmt = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

function aFila(m: CargaMenaje): Fila {
  return {
    id: m.id,
    nombre: m.nombre,
    categoria: m.categoria,
    unidad: m.unidad,
    stock_total: String(m.stock_total),
    precio_alquiler: String(Math.round(m.precio_alquiler)),
    costo_reposicion: m.costo_reposicion ? String(Math.round(m.costo_reposicion)) : "",
    key: m.id,
  };
}

function filaVacia(categoriaSugerida: string): Fila {
  return {
    id: "",
    nombre: "",
    categoria: categoriaSugerida,
    unidad: "unidad",
    stock_total: "",
    precio_alquiler: "",
    costo_reposicion: "",
    key: `nueva-${Math.random().toString(36).slice(2)}`,
  };
}

export default function GridMenaje({ token, menaje, onCambio }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<EstadoFiltro>("todos");
  const [nuevas, setNuevas] = useState<Fila[]>([]);
  const [editadas, setEditadas] = useState<Record<string, Fila>>({});
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});

  const categorias = useMemo(
    () => [...new Set(menaje.map((m) => m.categoria).filter(Boolean))].sort(),
    [menaje]
  );

  const existentes = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return menaje
      .filter((m) => {
        // El filtro mira el COSTO DE REPOSICIÓN, no el alquiler: el alquiler ya
        // está cargado en todo el catálogo, y la reposición es la que falta y
        // la que deja la factura de un evento incompleta cuando se rompe algo.
        const tiene = m.costo_reposicion > 0;
        if (filtro === "hechos" && !tiene) return false;
        if (filtro === "faltan" && tiene) return false;
        return !q || m.nombre.toLowerCase().includes(q) || m.categoria.toLowerCase().includes(q);
      })
      .map((m) => editadas[m.id] ?? aFila(m));
  }, [menaje, busqueda, filtro, editadas]);

  const conteos = useMemo(() => {
    const hechos = menaje.filter((m) => m.costo_reposicion > 0).length;
    return { todos: menaje.length, hechos, faltan: menaje.length - hechos };
  }, [menaje]);

  const escribir = (fila: Fila, campo: keyof Fila, valor: string) => {
    const actualizada = { ...fila, [campo]: valor };
    if (fila.id) {
      setEditadas((prev) => ({ ...prev, [fila.id]: actualizada }));
    } else {
      setNuevas((prev) => prev.map((f) => (f.key === fila.key ? actualizada : f)));
    }
    setEstados((prev) => (prev[fila.key] ? { ...prev, [fila.key]: "limpia" } : prev));
    setErrores((prev) => (prev[fila.key] ? { ...prev, [fila.key]: "" } : prev));
  };

  const salirDeFila = async (fila: Fila, e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;

    const vigente = fila.id ? (editadas[fila.id] ?? fila) : nuevas.find((f) => f.key === fila.key);
    if (!vigente) return;

    const vacia =
      !vigente.nombre.trim() &&
      !vigente.stock_total.trim() &&
      !vigente.precio_alquiler.trim() &&
      !vigente.costo_reposicion.trim();
    if (vacia) return;

    const stock = Number(vigente.stock_total);
    if (!vigente.nombre.trim()) {
      setErrores((prev) => ({ ...prev, [fila.key]: "Falta el nombre" }));
      setEstados((prev) => ({ ...prev, [fila.key]: "error" }));
      return;
    }
    if (!vigente.categoria.trim()) {
      setErrores((prev) => ({ ...prev, [fila.key]: "Falta la categoría" }));
      setEstados((prev) => ({ ...prev, [fila.key]: "error" }));
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      setErrores((prev) => ({
        ...prev,
        [fila.key]: "El stock total tiene que ser un número entero, sin decimales",
      }));
      setEstados((prev) => ({ ...prev, [fila.key]: "error" }));
      return;
    }

    setEstados((prev) => ({ ...prev, [fila.key]: "guardando" }));
    try {
      const precio = Number(vigente.precio_alquiler) || 0;
      const reposicion = Number(vigente.costo_reposicion) || 0;
      const { id, accion } = await guardarMenaje(token, {
        id: vigente.id || undefined,
        nombre: vigente.nombre.trim(),
        categoria: vigente.categoria.trim(),
        unidad: vigente.unidad.trim() || "unidad",
        stock_total: stock,
        precio_alquiler: precio,
        costo_reposicion: reposicion,
      });

      const guardado: CargaMenaje = {
        id,
        nombre: vigente.nombre.trim(),
        categoria: vigente.categoria.trim(),
        unidad: vigente.unidad.trim() || "unidad",
        stock_total: stock,
        precio_alquiler: precio,
        costo_reposicion: reposicion,
      };

      // Una fila nueva cuyo nombre ya existía vuelve como "actualizado": se
      // reemplaza la existente en vez de duplicarla en pantalla.
      const resto = menaje.filter((m) => m.id !== id);
      onCambio([...resto, guardado].sort((a, b) =>
        (a.categoria + a.nombre).localeCompare(b.categoria + b.nombre, "es")
      ));

      if (!vigente.id) {
        setNuevas((prev) => prev.filter((f) => f.key !== fila.key));
        if (accion === "actualizado") {
          toast.info(`"${guardado.nombre}" ya estaba en el sistema`, {
            description: "Se actualizó en vez de crearse dos veces.",
          });
        }
      } else {
        setEditadas((prev) => {
          const copia = { ...prev };
          delete copia[vigente.id];
          return copia;
        });
      }
      setEstados((prev) => ({ ...prev, [fila.key]: "guardada" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      setEstados((prev) => ({ ...prev, [fila.key]: "error" }));
      setErrores((prev) => ({ ...prev, [fila.key]: msg }));
      toast.error("No se pudo guardar el artículo", { description: msg });
    }
  };

  const quitar = async (fila: Fila) => {
    if (!fila.id) {
      setNuevas((prev) => prev.filter((f) => f.key !== fila.key));
      return;
    }
    setEstados((prev) => ({ ...prev, [fila.key]: "guardando" }));
    try {
      await bajaMenaje(token, fila.id);
      onCambio(menaje.filter((m) => m.id !== fila.id));
      toast.success(`"${fila.nombre}" salió del inventario`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo quitar";
      setEstados((prev) => ({ ...prev, [fila.key]: "error" }));
      toast.error("No se pudo quitar", { description: msg });
    }
  };

  const render = (fila: Fila) => {
    const estado = estados[fila.key] ?? "limpia";
    const error = errores[fila.key];

    return (
      <div
        key={fila.key}
        onBlur={(e) => void salirDeFila(fila, e)}
        className={`rounded-md border px-3 py-2.5 transition-colors ${
          estado === "error"
            ? "border-destructive/50 bg-destructive/5"
            : estado === "guardada"
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card"
        }`}
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_100px_90px_110px_120px_72px] md:items-center">
          <Input
            value={fila.nombre}
            onChange={(e) => escribir(fila, "nombre", e.target.value)}
            placeholder="Copa vino tinto"
            aria-label="Nombre del artículo"
          />
          <Input
            value={fila.categoria}
            onChange={(e) => escribir(fila, "categoria", e.target.value)}
            placeholder="Vasos"
            list="categorias-menaje"
            aria-label="Categoría"
          />
          <select
            value={fila.unidad}
            onChange={(e) => escribir(fila, "unidad", e.target.value)}
            aria-label="Unidad"
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
            {!UNIDADES.includes(fila.unidad) && fila.unidad && (
              <option value={fila.unidad}>{fila.unidad}</option>
            )}
          </select>
          <Input
            value={fila.stock_total}
            onChange={(e) => escribir(fila, "stock_total", e.target.value)}
            placeholder="300"
            inputMode="numeric"
            aria-label="Stock total"
          />
          <Input
            value={fila.precio_alquiler}
            onChange={(e) => escribir(fila, "precio_alquiler", e.target.value)}
            placeholder="8000"
            inputMode="numeric"
            aria-label="Precio de alquiler"
          />
          <Input
            value={fila.costo_reposicion}
            onChange={(e) => escribir(fila, "costo_reposicion", e.target.value)}
            placeholder="25000"
            inputMode="numeric"
            aria-label="Costo de reposición"
          />
          <div className="flex items-center justify-end gap-1">
            {estado === "guardando" && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {estado === "guardada" && <Check className="h-4 w-4 text-primary" />}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Quitar ${fila.nombre || "esta fila"}`}
              onClick={() => void quitar(fila)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <datalist id="categorias-menaje">
        {categorias.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <BarraFiltros
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        placeholder="Buscar artículo o categoría…"
        estado={filtro}
        onEstado={setFiltro}
        etiquetas={{ hechos: "Con reposición", faltan: "Falta reposición" }}
        conteos={conteos}
      />

      <div className="hidden gap-3 border-b border-border pb-2 text-xs uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_100px_90px_110px_120px_72px]">
        <span>Artículo</span>
        <span>Categoría</span>
        <span>Unidad</span>
        <span>Stock total</span>
        <span>Alquiler</span>
        <span>Reposición</span>
        <span />
      </div>

      <div className="space-y-2">
        {existentes.map(render)}
        {nuevas.map(render)}
      </div>

      {menaje.length === 0 && nuevas.length === 0 && (
        <p className="py-8 text-center text-muted-foreground">
          El inventario está vacío. Agreguen su primer artículo.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <Button
          variant="outline"
          onClick={() => setNuevas((prev) => [...prev, filaVacia(categorias[0] ?? "")])}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Agregar artículo
        </Button>
        {menaje.length > 0 && (
          <p className="text-sm tabular-nums text-muted-foreground">
            {menaje.length} artículos ·{" "}
            {menaje.reduce((s, m) => s + m.stock_total, 0).toLocaleString("es-CO")} unidades ·
            alquiler promedio{" "}
            {fmt(menaje.reduce((s, m) => s + m.precio_alquiler, 0) / menaje.length)}
          </p>
        )}
      </div>
    </div>
  );
}
