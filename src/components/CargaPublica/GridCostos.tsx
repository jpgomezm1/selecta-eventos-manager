import { useMemo, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  construirIndiceIngredientes,
  validarCosto,
  type IndiceIngredientes,
} from "@/lib/mapeoExcelCostos";
import { normalizarTexto } from "@/lib/mapeoExcelPersonal";
import {
  borrarProveedor,
  crearInsumo,
  guardarProveedor,
  hacerProveedorPrincipal,
  type CargaIngrediente,
  type CargaProveedor,
} from "@/integrations/supabase/apiCargaPublica";
import type { IngredienteCatalogo } from "@/types/cotizador";

/**
 * Insumos y sus proveedores en `/carga/:token`.
 *
 * La primera versión era una fila por insumo con un solo proveedor y
 * autoguardado al salir del campo. Se rehizo por tres cosas que pidió el
 * cliente y que la forma vieja no daba:
 *
 * 1. Un insumo puede tener varios proveedores. El esquema siempre lo soportó
 *    (`es_principal` marca cuál define el costo vigente); la grilla plana no.
 * 2. Se pueden crear insumos que no estén en el catálogo.
 * 3. Guardar es un botón, no un efecto de perder el foco. El autoguardado
 *    ahorra clics pero deja al que llena sin saber si su dato entró — y en una
 *    página que se usa sin acompañamiento eso vale más que los clics.
 *
 * La validación y la conversión a unidad base siguen siendo las MISMAS que las
 * del importador de Excel (`validarCosto`). Si se separan, el mismo dato entra
 * con distinto costo según por dónde haya entrado.
 */

const UNIDADES = ["gr", "kg", "lb", "oz", "ml", "lt", "und"];
const POR_PAGINA = 40;

interface Props {
  token: string;
  ingredientes: CargaIngrediente[];
  onCambio: (ingredientes: CargaIngrediente[]) => void;
}

const money = (n: number) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

/** Los costos por unidad base son chicos ($9/ml): redondear los mataría. */
const fmtCosto = (n: number, unidad: string) =>
  n >= 100
    ? `${money(n)}/${unidad}`
    : `$ ${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })}/${unidad}`;

interface FormProveedor {
  proveedor: string;
  presentacion: string;
  unidad: string;
  precio: string;
}

const FORM_VACIO: FormProveedor = {
  proveedor: "",
  presentacion: "",
  unidad: "",
  precio: "",
};

/**
 * Nombres del catálogo que se parecen al que están por crear.
 *
 * Crear insumos desde una página pública reabre el problema que el importador
 * de Excel evita no creándolos: "Aceite Girasol" y "Aceite de girasol" quedan
 * como dos, y el costeo de los platos se parte entre los dos. El SQL rechaza el
 * nombre idéntico; esto atrapa los parecidos y deja decidir a quien escribe.
 */
function parecidos(nombre: string, ingredientes: CargaIngrediente[]): CargaIngrediente[] {
  const q = normalizarTexto(nombre);
  if (q.length < 3) return [];
  const palabras = q.split(" ").filter((p) => p.length > 2);
  return ingredientes
    .filter((i) => {
      const n = normalizarTexto(i.nombre);
      if (n === q) return true;
      if (n.includes(q) || q.includes(n)) return true;
      // Comparte todas las palabras largas, en cualquier orden:
      // "Aceite Girasol" vs "Aceite de Girasol".
      return palabras.length > 0 && palabras.every((p) => n.includes(p));
    })
    .slice(0, 4);
}

export default function GridCostos({ token, ingredientes, onCambio }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [soloFaltantes, setSoloFaltantes] = useState(true);
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [abierto, setAbierto] = useState<string | null>(null);

  // Qué proveedor se está editando: el id, o "nuevo" para un alta.
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<FormProveedor>(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);

  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaUnidad, setNuevaUnidad] = useState("gr");
  const [creandoInsumo, setCreandoInsumo] = useState(false);

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

  const pendientes = ingredientes.filter((i) => i.costo_por_unidad === 0).length;
  const similares = useMemo(
    () => (nuevoNombre.trim() ? parecidos(nuevoNombre, ingredientes) : []),
    [nuevoNombre, ingredientes]
  );

  /** Costo por unidad base con lo que hay escrito ahora. null si aún no cierra. */
  const previa = (ing: CargaIngrediente) => {
    if (!form.presentacion || !form.unidad || !form.precio) return null;
    const v = validarCosto(
      {
        nombre: ing.nombre,
        proveedor: form.proveedor || "—",
        presentacion: form.presentacion,
        unidad: form.unidad,
        precio: form.precio,
      },
      indice
    );
    return v.errores.length === 0 ? v.costo_por_unidad_base : null;
  };

  const reemplazar = (ing: CargaIngrediente) =>
    onCambio(ingredientes.map((x) => (x.id === ing.id ? ing : x)));

  const abrirForm = (proveedorId: string | "nuevo", p?: CargaProveedor) => {
    setEditando(proveedorId);
    setErrores([]);
    setForm(
      p
        ? {
            proveedor: p.proveedor,
            presentacion: String(p.presentacion_cantidad),
            unidad: p.presentacion_unidad,
            precio: String(Math.round(p.precio_presentacion)),
          }
        : FORM_VACIO
    );
  };

  const guardar = async (ing: CargaIngrediente) => {
    const validado = validarCosto(
      {
        nombre: ing.nombre,
        proveedor: form.proveedor,
        presentacion: form.presentacion,
        unidad: form.unidad,
        precio: form.precio,
      },
      indice
    );
    if (validado.errores.length > 0) {
      setErrores(validado.errores);
      return;
    }

    setGuardando(true);
    try {
      const esEdicion = editando !== "nuevo" && editando !== null;
      const r = await guardarProveedor(token, {
        id: esEdicion ? editando : undefined,
        ingrediente_id: ing.id,
        proveedor: validado.proveedor,
        presentacion_cantidad: validado.presentacion_cantidad,
        presentacion_unidad: validado.presentacion_unidad,
        precio_presentacion: validado.precio_presentacion,
        costo_por_unidad_base: validado.costo_por_unidad_base,
      });

      const guardado: CargaProveedor = {
        id: r.id,
        proveedor: validado.proveedor,
        presentacion_cantidad: validado.presentacion_cantidad,
        presentacion_unidad: validado.presentacion_unidad,
        precio_presentacion: validado.precio_presentacion,
        costo_por_unidad_base: validado.costo_por_unidad_base,
        es_principal: r.es_principal,
      };

      const resto = ing.proveedores.filter((p) => p.id !== r.id);
      const lista = [...resto, guardado]
        .map((p) => ({ ...p, es_principal: r.es_principal ? p.id === r.id : p.es_principal }))
        .sort((a, b) => Number(b.es_principal) - Number(a.es_principal));

      const principal = lista.find((p) => p.es_principal);
      reemplazar({
        ...ing,
        proveedores: lista,
        costo_por_unidad: principal?.costo_por_unidad_base ?? 0,
      });

      setEditando(null);
      setForm(FORM_VACIO);
      toast.success(
        r.accion === "creado"
          ? `${validado.proveedor} agregado a ${ing.nombre}`
          : `${validado.proveedor} actualizado`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar";
      setErrores([msg]);
      toast.error("No se pudo guardar", { description: msg });
    } finally {
      setGuardando(false);
    }
  };

  const usarEste = async (ing: CargaIngrediente, p: CargaProveedor) => {
    try {
      await hacerProveedorPrincipal(token, ing.id, p.id);
      reemplazar({
        ...ing,
        proveedores: ing.proveedores
          .map((x) => ({ ...x, es_principal: x.id === p.id }))
          .sort((a, b) => Number(b.es_principal) - Number(a.es_principal)),
        costo_por_unidad: p.costo_por_unidad_base,
      });
      toast.success(`El costo de ${ing.nombre} ahora sale de ${p.proveedor}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo cambiar";
      toast.error("No se pudo cambiar el proveedor", { description: msg });
    }
  };

  const quitar = async (ing: CargaIngrediente, p: CargaProveedor) => {
    try {
      await borrarProveedor(token, p.id);
      const lista = ing.proveedores.filter((x) => x.id !== p.id);
      // El SQL asciende a otro si se fue el principal; acá se replica para no
      // tener que volver a bajar todo el catálogo solo por esto.
      if (p.es_principal && lista.length > 0) lista[0] = { ...lista[0], es_principal: true };
      const principal = lista.find((x) => x.es_principal);
      reemplazar({
        ...ing,
        proveedores: lista,
        costo_por_unidad: principal?.costo_por_unidad_base ?? 0,
      });
      toast.success(`${p.proveedor} ya no está en ${ing.nombre}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo quitar";
      toast.error("No se pudo quitar el proveedor", { description: msg });
    }
  };

  const crear = async () => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    setCreandoInsumo(true);
    try {
      const creado = await crearInsumo(token, nombre, nuevaUnidad);
      const nuevo: CargaIngrediente = {
        id: creado.id,
        nombre: creado.nombre,
        unidad: creado.unidad,
        costo_por_unidad: 0,
        proveedores: [],
      };
      onCambio(
        [...ingredientes, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      );
      setNuevoNombre("");
      setCreando(false);
      // Se abre de una para cargarle el proveedor: crear el insumo sin costo no
      // sirve de nada por sí solo.
      setAbierto(creado.id);
      abrirForm("nuevo");
      setBusqueda(creado.nombre);
      toast.success(`"${creado.nombre}" creado`, {
        description: "Ahora agréguenle el proveedor y el precio.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo crear";
      toast.error("No se pudo crear el insumo", { description: msg });
    } finally {
      setCreandoInsumo(false);
    }
  };

  const formProveedor = (ing: CargaIngrediente) => {
    const costo = previa(ing);
    return (
      <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_90px_90px_minmax(0,1fr)]">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">¿A quién le compran?</label>
            <Input
              autoFocus
              value={form.proveedor}
              onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
              placeholder="Distrito Horeka"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Viene de</label>
            <Input
              value={form.presentacion}
              onChange={(e) => setForm({ ...form, presentacion: e.target.value })}
              placeholder="25"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Unidad</label>
            <select
              value={form.unidad}
              onChange={(e) => setForm({ ...form, unidad: e.target.value })}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">—</option>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Y cuesta</label>
            <Input
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
              placeholder="120000"
              inputMode="numeric"
            />
          </div>
        </div>

        {errores.length > 0 && (
          <ul className="mt-3 space-y-0.5 text-sm text-destructive">
            {errores.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {costo !== null ? (
              <>
                Les sale a{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {fmtCosto(costo, ing.unidad)}
                </strong>
              </>
            ) : (
              "Llenen los cuatro campos y les mostramos el costo por " + ing.unidad
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditando(null);
                setErrores([]);
              }}
            >
              Cancelar
            </Button>
            <Button size="sm" disabled={guardando} onClick={() => void guardar(ing)}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar proveedor
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
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
        <div className="flex flex-wrap items-center gap-4">
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
            Ver solo los {pendientes} sin costo
          </label>
          <Button variant="outline" size="sm" onClick={() => setCreando((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Insumo nuevo
          </Button>
        </div>
      </div>

      {creando && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_140px_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                ¿Cómo se llama?
              </label>
              <Input
                autoFocus
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Pechuga de pollo"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Se mide en</label>
              <select
                value={nuevaUnidad}
                onChange={(e) => setNuevaUnidad(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <Button disabled={creandoInsumo || !nuevoNombre.trim()} onClick={() => void crear()}>
              {creandoInsumo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear insumo
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            La unidad es la de la receta, no la de la compra. Si el pollo se pesa en gramos
            cuando cocinan, va <strong>gr</strong> — aunque lo compren por bultos.
          </p>

          {similares.length > 0 && (
            <div className="mt-3 rounded-sm border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm">
              <p className="font-semibold text-warning">
                Ya hay {similares.length === 1 ? "uno parecido" : "algunos parecidos"} en el
                catálogo:
              </p>
              <ul className="mt-1.5 space-y-1">
                {similares.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setBusqueda(s.nombre);
                        setSoloFaltantes(false);
                        setAbierto(s.id);
                        setCreando(false);
                        setNuevoNombre("");
                      }}
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      {s.nombre} ({s.unidad})
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-muted-foreground">
                Si es el mismo, háganle clic y agréguenle el proveedor ahí en vez de crear otro.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {filtrados.slice(0, visibles).map((ing) => {
          const esteAbierto = abierto === ing.id;
          const principal = ing.proveedores.find((p) => p.es_principal);

          return (
            <div
              key={ing.id}
              className={`rounded-md border transition-colors ${
                ing.costo_por_unidad > 0
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setAbierto(esteAbierto ? null : ing.id);
                    setEditando(null);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-expanded={esteAbierto}
                >
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      esteAbierto ? "rotate-180" : ""
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{ing.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      se mide en {ing.unidad}
                      {ing.proveedores.length > 0 &&
                        ` · ${ing.proveedores.length} ${
                          ing.proveedores.length === 1 ? "proveedor" : "proveedores"
                        }`}
                    </p>
                  </div>
                </button>

                <span className="shrink-0 text-sm tabular-nums">
                  {ing.costo_por_unidad > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <Check className="h-3.5 w-3.5" />
                      {fmtCosto(ing.costo_por_unidad, ing.unidad)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">sin costo</span>
                  )}
                </span>
              </div>

              {esteAbierto && (
                <div className="space-y-2 border-t border-border/60 px-3 py-3">
                  {ing.proveedores.map((p) =>
                    editando === p.id ? (
                      <div key={p.id}>{formProveedor(ing)}</div>
                    ) : (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate text-[15px]">
                            {p.proveedor}
                            {p.es_principal && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                <Star className="h-2.5 w-2.5 fill-current" />
                                el que manda
                              </span>
                            )}
                          </p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {p.presentacion_cantidad} {p.presentacion_unidad} por{" "}
                            {money(p.precio_presentacion)} ={" "}
                            <strong className="font-semibold text-foreground">
                              {fmtCosto(p.costo_por_unidad_base, ing.unidad)}
                            </strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!p.es_principal && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void usarEste(ing, p)}
                            >
                              Usar este
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => abrirForm(p.id, p)}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Quitar ${p.proveedor}`}
                            onClick={() => void quitar(ing, p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  )}

                  {editando === "nuevo" ? (
                    formProveedor(ing)
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => abrirForm("nuevo")}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      {ing.proveedores.length === 0 ? "Agregar proveedor" : "Otro proveedor"}
                    </Button>
                  )}

                  {ing.proveedores.length > 1 && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      El marcado como «el que manda» es el que define el costo del insumo. Los
                      otros quedan guardados para comparar.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <div className="py-10 text-center">
          <p className="text-muted-foreground">
            {soloFaltantes
              ? "No queda ningún insumo sin costo con ese filtro."
              : "Ningún insumo coincide con la búsqueda."}
          </p>
          {busqueda.trim() && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setNuevoNombre(busqueda.trim());
                setCreando(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Crear «{busqueda.trim()}» como insumo nuevo
            </Button>
          )}
        </div>
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
