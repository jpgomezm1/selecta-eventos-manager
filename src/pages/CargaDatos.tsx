import { Download, FileSpreadsheet, ScanLine } from "lucide-react";

/**
 * Página pública de carga de datos (`/carga`).
 *
 * Se le manda al cliente para que descargue las plantillas de costos y recetas.
 * No pide sesión: quien la abre no tiene usuario en la app, y meterle un login
 * al paso previo a que nos manden la data sería garantizar que no la manden.
 *
 * Los .xlsx viven en `public/plantillas/` y se sirven estáticos. Se generan
 * desde el catálogo real de Supabase (ver GENERAR_PLANTILLAS.md) — no se
 * arman en el navegador porque esta página es anónima y las tablas de
 * catálogo exigen rol.
 */

const LOGO_URL =
  "https://storage.googleapis.com/cluvi/Selecta-Eventos/logo_selecta_nuevo.png";

/** Cifras del catálogo al generar las plantillas. Actualizar si se regeneran. */
const DATOS = {
  fecha: "23 de agosto de 2026",
  insumos: 325,
  insumosSinCosto: 270,
  platos: 393,
  platosSinReceta: 209,
  recetasCargadas: 184,
  lineasReceta: 1211,
  menajeDemo: 9,
  personalCargado: 67,
};

type Plantilla = {
  quien: string;
  titulo: string;
  descripcion: string;
  pendiente: string;
  archivo: string;
  nombreDescarga: string;
  peso: string;
};

/** Las tres que hacen que los números de la app dejen de ser inventados. */
const PLANTILLAS: Plantilla[] = [
  {
    quien: "Lo llena compras",
    titulo: "Costos de insumos",
    descripcion:
      `Los ${DATOS.insumos} insumos que ya están en el sistema, con su nombre y su unidad. ` +
      "Ustedes agregan proveedor, presentación y precio.",
    pendiente: `${DATOS.insumosSinCosto} filas por llenar · van de primeras y en amarillo`,
    archivo: "/plantillas/selecta-costos-insumos.xlsx",
    nombreDescarga: "Selecta - Costos de insumos.xlsx",
    peso: "19 KB",
  },
  {
    quien: "Lo llena cocina",
    titulo: "Recetas",
    descripcion:
      "Los platos que no tienen receta, con su categoría y su precio de venta al lado. " +
      "Ustedes agregan qué insumo lleva cada uno y cuánto.",
    pendiente: `${DATOS.platosSinReceta} platos por llenar · plato e insumo son listas desplegables`,
    archivo: "/plantillas/selecta-recetas.xlsx",
    nombreDescarga: "Selecta - Recetas.xlsx",
    peso: "57 KB",
  },
  {
    quien: "Lo llena bodega",
    titulo: "Menaje",
    descripcion:
      "El inventario real de bodega: copas, platos, mantelería, decoración. " +
      "Cuántas tienen de cada cosa y en cuánto la alquilan.",
    pendiente: "Empieza en blanco · es la única que no trae su catálogo adentro",
    archivo: "/plantillas/selecta-menaje.xlsx",
    nombreDescarga: "Selecta - Menaje.xlsx",
    peso: "12 KB",
  },
];

/** Las dos que pueden esperar: una es opcional, la otra ya está casi lista. */
const OPCIONALES: Plantilla[] = [
  {
    quien: "Opcional",
    titulo: "Clientes",
    descripcion:
      "Su base de clientes, con los contactos de cada empresa. Sirve para arrancar con el " +
      "histórico adentro — si no la tienen a mano, se van creando al cotizar.",
    pendiente: "",
    archivo: "/plantillas/selecta-clientes.xlsx",
    nombreDescarga: "Selecta - Clientes.xlsx",
    peso: "19 KB",
  },
  {
    quien: "La suben ustedes mismos",
    titulo: "Personal",
    descripcion:
      `Su equipo ya está cargado: ${DATOS.personalCargado} personas con su rol y su tarifa. ` +
      "Esta plantilla es solo para las altas, y va directo en la app: Personal → «Carga masiva».",
    pendiente: "",
    archivo: "/plantillas/selecta-personal.xlsx",
    nombreDescarga: "Selecta - Personal.xlsx",
    peso: "16 KB",
  },
];

function TarjetaPlantilla({ p }: { p: Plantilla }) {
  return (
    <article className="flex flex-col gap-4 rounded-lg border border-border bg-card p-7 shadow-soft">
      <span className="kicker self-start rounded-sm bg-primary/10 px-2.5 py-1 text-primary">
        {p.quien}
      </span>
      <h3 className="font-serif text-xl tracking-tight">{p.titulo}</h3>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{p.descripcion}</p>
      {p.pendiente && (
        <p className="rounded-sm border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning tabular-nums">
          {p.pendiente}
        </p>
      )}
      <a
        href={p.archivo}
        download={p.nombreDescarga}
        className="mt-auto inline-flex items-center justify-center gap-2.5 rounded-sm bg-primary px-5 py-3.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
      >
        <Download className="h-4 w-4" strokeWidth={2} />
        Descargar Excel
      </a>
      <p className="text-center text-xs text-muted-foreground tabular-nums">{p.peso} · Excel</p>
    </article>
  );
}

function Cifra({ valor, label, detalle, alerta }: {
  valor: number; label: string; detalle: string; alerta?: boolean;
}) {
  return (
    <div className="py-5 pr-6">
      <div className="kicker mb-1.5">{label}</div>
      <div
        className={`font-serif text-[2rem] leading-none tabular-nums ${
          alerta ? "text-warning" : "text-foreground"
        }`}
      >
        {valor.toLocaleString("es-CO")}
      </div>
      <div className="mt-2 text-[13px] text-muted-foreground">{detalle}</div>
    </div>
  );
}

export default function CargaDatos() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 pb-24">
        <header className="pt-14 md:pt-20">
          <img
            src={LOGO_URL}
            alt="Selecta Eventos"
            className="mb-10 h-11 w-auto"
            loading="eager"
          />

          <h1 className="max-w-3xl font-serif text-[2rem] leading-[1.1] tracking-tight md:text-[3rem]">
            Tres archivos para que la app deje de trabajar con números prestados
          </h1>

          <p className="mt-5 max-w-[63ch] text-lg leading-relaxed text-muted-foreground">
            La app ya conoce su catálogo completo: los platos, los precios de venta, los insumos y
            sus unidades. Lo que todavía no sabe es{" "}
            <strong className="font-semibold text-foreground">cuánto les cuesta cada insumo</strong>,{" "}
            <strong className="font-semibold text-foreground">qué lleva cada plato</strong> y{" "}
            <strong className="font-semibold text-foreground">qué hay en su bodega</strong>. Sin eso
            puede cotizar, pero no puede decirles cuánto ganan en un evento ni si les alcanzan las
            copas para el sábado.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-x-8 border-y border-border sm:grid-cols-3">
            <Cifra
              valor={DATOS.insumosSinCosto}
              label="Insumos sin costo"
              detalle={`de ${DATOS.insumos} en el sistema`}
              alerta
            />
            <Cifra
              valor={DATOS.platosSinReceta}
              label="Platos sin receta"
              detalle={`de ${DATOS.platos} en el sistema`}
              alerta
            />
            <Cifra
              valor={DATOS.menajeDemo}
              label="Menaje de ejemplo"
              detalle="los únicos artículos que hay hoy en bodega, y los pusimos nosotros"
              alerta
            />
          </div>
        </header>

        {/* Descargas */}
        <section className="pt-14">
          <h2 className="font-serif text-2xl tracking-tight">Descarguen los archivos</h2>
          <p className="mt-3 max-w-[63ch] text-muted-foreground">
            Son tres porque los llena gente distinta y se pueden trabajar al mismo tiempo: compras,
            cocina y bodega. Los dos primeros ya vienen con su catálogo adentro.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {PLANTILLAS.map((p) => (
              <TarjetaPlantilla key={p.archivo} p={p} />
            ))}
          </div>
        </section>

        {/* Opcionales */}
        <section className="pt-14">
          <h2 className="font-serif text-2xl tracking-tight">Y dos que pueden esperar</h2>
          <p className="mt-3 max-w-[63ch] text-muted-foreground">
            Ninguna de las dos bloquea nada. Están aquí por si les sirve hacerlo de una vez.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {OPCIONALES.map((p) => (
              <TarjetaPlantilla key={p.archivo} p={p} />
            ))}
          </div>
        </section>

        {/* Reglas */}
        <section className="pt-14">
          <h2 className="font-serif text-2xl tracking-tight">
            Las tres reglas que cambian el resultado
          </h2>
          <p className="mt-3 max-w-[63ch] text-muted-foreground">
            Todo lo demás del archivo se explica solo. Estas tres son las que, si se entienden al
            revés, dejan los números mal sin que nadie se dé cuenta.
          </p>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-r-sm border-l-[3px] border-primary bg-muted/50 px-6 py-5">
              <p className="font-semibold">
                En costos: escriban cómo compran, no cómo cocinan.
              </p>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                Si el arroz les llega en bultos de 25 kg y el bulto vale $120.000, eso es lo que va.
                No calculen el precio por kilo — el sistema hace la división, y así además queda
                registrado en qué presentación compran.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-sm border border-border bg-card px-3.5 py-3 font-mono text-[13px] leading-7">
{`PRESENTACIÓN   25
UNIDAD         kg
PRECIO         120000`}
              </pre>
            </div>

            <div className="rounded-r-sm border-l-[3px] border-primary bg-muted/50 px-6 py-5">
              <p className="font-semibold">En recetas: la cantidad es para una sola porción.</p>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                Si un plato lleva 150 gramos de pollo, escriban 150. No 0,15 kilos, y no los 30
                kilos que se necesitan para un evento de 200 personas. El sistema multiplica solo
                según cuánta gente tenga cada evento.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-sm border border-border bg-card px-3.5 py-3 font-mono text-[13px] leading-7">
{`INSUMO     Pechuga de pollo
CANTIDAD   150   (gramos, por porción)`}
              </pre>
            </div>

            <div className="rounded-r-sm border-l-[3px] border-primary bg-muted/50 px-6 py-5">
              <p className="font-semibold">
                En menaje: el stock es lo que tienen, no lo que está libre hoy.
              </p>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">
                Si tienen 300 copas de vino y hoy hay 80 prestadas en un evento, el stock total son
                300. El sistema descuenta solo las que están reservadas en cada fecha — para poder
                hacerlo necesita saber el total real.
              </p>
              <pre className="mt-4 overflow-x-auto rounded-sm border border-border bg-card px-3.5 py-3 font-mono text-[13px] leading-7">
{`NOMBRE        Copa vino tinto
STOCK TOTAL   300   (las que son suyas)`}
              </pre>
            </div>
          </div>
        </section>

        {/* Atajo */}
        <section className="pt-14">
          <div className="rounded-lg border border-border bg-card p-7 shadow-soft">
            <h2 className="font-serif text-2xl tracking-tight">
              Si ya lo tienen en otro lado, no lo escriban de nuevo
            </h2>
            <p className="mt-3 max-w-[63ch] text-muted-foreground">
              Antes de sentarse a llenar {DATOS.insumosSinCosto + DATOS.platosSinReceta} filas,
              revisen qué existe ya:
            </p>
            <ul className="mt-5 flex max-w-[63ch] flex-col gap-3.5">
              <li className="flex gap-3">
                <FileSpreadsheet className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="text-[15px] leading-relaxed">
                  Una lista de precios de proveedores en cualquier Excel.
                </span>
              </li>
              <li className="flex gap-3">
                <ScanLine className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="text-[15px] leading-relaxed">
                  Las facturas de compra de los últimos meses.{" "}
                  <strong className="font-semibold">
                    La app tiene un lector de facturas que saca los precios solo
                  </strong>{" "}
                  — con mandarnos los PDF o las fotos avanzamos buena parte de los costos.
                </span>
              </li>
              <li className="flex gap-3">
                <FileSpreadsheet className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="text-[15px] leading-relaxed">
                  El recetario del chef, así esté en Word, en una hoja de cálculo o en fotos de un
                  cuaderno.
                </span>
              </li>
              <li className="flex gap-3">
                <FileSpreadsheet className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="text-[15px] leading-relaxed">
                  El último conteo de bodega, aunque sea la hoja de un inventario a mano.
                </span>
              </li>
            </ul>
            <p className="mt-5 max-w-[63ch] text-muted-foreground">
              Mándenlo como esté y nosotros lo pasamos al formato. Es más rápido para todos, y se
              evitan los errores de volver a teclear lo mismo.
            </p>
          </div>
        </section>

        {/* Cierre */}
        <section className="pt-14">
          <h2 className="font-serif text-2xl tracking-tight">Tres cosas y ya</h2>
          <ul className="mt-6 flex max-w-[63ch] flex-col gap-4">
            <li className="text-[15px] leading-relaxed">
              <strong className="font-semibold">No hay que terminarlo de una.</strong> Manden
              avances y los vamos cargando por partes. Es mejor tener los 40 insumos que más usan
              cargados esta semana que los {DATOS.insumosSinCosto} el mes entrante.
            </li>
            <li className="text-[15px] leading-relaxed">
              <strong className="font-semibold">Empiecen por lo que más venden.</strong> Un plato
              que no se cotiza hace un año puede esperar; los veinte que salen en cada evento son
              los que mueven el margen.
            </li>
            <li className="text-[15px] leading-relaxed">
              <strong className="font-semibold">No cambien los nombres</strong> de insumos ni de
              platos. Son los que el sistema ya conoce: si se renombran, se crean duplicados y las
              recetas dejan de cuadrar.
            </li>
          </ul>
          <p className="mt-6 max-w-[63ch] text-muted-foreground">
            Cuando tengan algo listo, respondan al correo por el que les llegó este link con los
            archivos adjuntos. Nosotros los subimos y les avisamos cuando ya estén viendo costos
            reales en la app.
          </p>
        </section>

        <footer className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          Los archivos se generaron el {DATOS.fecha} con el catálogo que había en el sistema ese día.
        </footer>
      </div>
    </div>
  );
}
