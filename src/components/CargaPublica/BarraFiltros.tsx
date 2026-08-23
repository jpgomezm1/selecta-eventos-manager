import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Encabezado común de las tres pestañas de `/carga/:token`: buscador +
 * filtro de estado.
 *
 * Vive suelto y no dentro de cada grilla porque las tres tenían su propia
 * versión y ya habían empezado a divergir — una con checkbox, otra sin filtro,
 * cada una con su placeholder. Quien llena esto salta entre pestañas todo el
 * tiempo; que el control cambie de forma en cada una es fricción gratis.
 *
 * El filtro es de tres estados y no un checkbox porque «ver solo lo que falta»
 * no deja revisar lo ya cargado, que es justo lo que hace falta cuando se
 * quiere corregir algo. Las etiquetas las pone cada pestaña: lo que en costos
 * es «con costo», en recetas es «resueltos».
 */

export type EstadoFiltro = "todos" | "hechos" | "faltan";

interface Props {
  busqueda: string;
  onBusqueda: (valor: string) => void;
  placeholder: string;
  estado: EstadoFiltro;
  onEstado: (estado: EstadoFiltro) => void;
  /** Cómo se llama cada estado en esta pestaña. */
  etiquetas: { hechos: string; faltan: string };
  conteos: { todos: number; hechos: number; faltan: number };
  /** Controles extra de la pestaña, ej. el selector de categoría en recetas. */
  children?: React.ReactNode;
}

function Opcion({
  activo,
  onClick,
  texto,
  cuantos,
}: {
  activo: boolean;
  onClick: () => void;
  texto: string;
  cuantos: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
        activo
          ? "bg-background font-semibold text-foreground shadow-soft"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {texto}
      <span className="ml-1.5 text-xs tabular-nums opacity-70">{cuantos}</span>
    </button>
  );
}

export default function BarraFiltros({
  busqueda,
  onBusqueda,
  placeholder,
  estado,
  onEstado,
  etiquetas,
  conteos,
  children,
}: Props) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder={placeholder}
            className="pl-9"
            autoComplete="off"
          />
        </div>
        {children}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-muted p-1">
        <Opcion
          activo={estado === "todos"}
          onClick={() => onEstado("todos")}
          texto="Todos"
          cuantos={conteos.todos}
        />
        <Opcion
          activo={estado === "hechos"}
          onClick={() => onEstado("hechos")}
          texto={etiquetas.hechos}
          cuantos={conteos.hechos}
        />
        <Opcion
          activo={estado === "faltan"}
          onClick={() => onEstado("faltan")}
          texto={etiquetas.faltan}
          cuantos={conteos.faltan}
        />
      </div>
    </div>
  );
}
