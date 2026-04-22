import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { getCotizacionByShareToken } from "@/integrations/supabase/apiShare";
import type {
  Cotizacion,
  CotizacionVersion,
  CotizacionItemsState,
  LugarOption,
} from "@/types/cotizador";
import { parseLocalDate } from "@/lib/dateLocal";

const LOGO_URL = "https://storage.googleapis.com/cluvi/Selecta-Eventos/logo_selecta_nuevo.png";
const IMG_HERO = "https://storage.googleapis.com/cluvi/Selecta-Eventos/image1_selecta.png";
const IMG_GASTRO = "https://storage.googleapis.com/cluvi/Selecta-Eventos/image2_selecta.png";
const IMG_EVENTO = "https://storage.googleapis.com/cluvi/Selecta-Eventos/image3_selecta.png";

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

type PageData = {
  cotizacion: Cotizacion;
  versiones: Array<CotizacionVersion & { items: CotizacionItemsState }>;
  lugares: LugarOption[];
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);

export default function CotizacionPublica() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const versionFilter = searchParams.get("v");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PageData | null>(null);
  const [activeVersionIdx, setActiveVersionIdx] = useState(0);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const totalSectionRef = useRef<HTMLDivElement>(null);
  const mastheadRef = useRef<HTMLDivElement>(null);

  const versiones = useMemo(() => {
    if (!data) return [];
    if (!versionFilter) return data.versiones;
    const filtered = data.versiones.filter((v) => v.id === versionFilter);
    return filtered.length > 0 ? filtered : data.versiones;
  }, [data, versionFilter]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getCotizacionByShareToken(token)
      .then((result) => setData(result))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const mastheadEl = mastheadRef.current;
    const totalEl = totalSectionRef.current;
    if (!mastheadEl || !totalEl) return;

    let mastheadVisible = true;
    let totalVisible = false;

    const update = () => setShowStickyBar(!mastheadVisible && !totalVisible);

    const mastheadObs = new IntersectionObserver(
      ([e]) => { mastheadVisible = e.isIntersecting; update(); },
      { threshold: 0 }
    );
    const totalObs = new IntersectionObserver(
      ([e]) => { totalVisible = e.isIntersecting; update(); },
      { threshold: 0.3 }
    );

    mastheadObs.observe(mastheadEl);
    totalObs.observe(totalEl);
    return () => { mastheadObs.disconnect(); totalObs.disconnect(); };
  }, [data]);

  const switchVersion = useCallback((idx: number) => {
    if (idx === activeVersionIdx) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveVersionIdx(idx);
      setTransitioning(false);
    }, 180);
  }, [activeVersionIdx]);

  /* ─── LOADING ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <img src={LOGO_URL} alt="Selecta" className="h-14 opacity-40" />
          <div className="w-6 h-6 rounded-full bg-primary/20 animate-pulse" />
          <p className="kicker text-muted-foreground">Cargando propuesta</p>
        </div>
      </div>
    );
  }

  /* ─── NOT FOUND ─── */
  if (!data) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 text-center px-6 max-w-sm">
          <img src={LOGO_URL} alt="Selecta" className="h-14 opacity-40" />
          <div className="space-y-2">
            <h2 className="font-serif text-2xl text-foreground">Enlace no disponible</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Este enlace ha expirado o fue desactivado. Contacta a quien te lo envió
              para obtener uno nuevo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ─── DATA ─── */
  const { cotizacion, lugares } = data;
  const current = versiones[activeVersionIdx] ?? versiones[0];
  const lugarSeleccionado = lugares.find((l) => l.es_seleccionado);
  const lugarPrecio = lugarSeleccionado?.precio_referencia ?? 0;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const d = parseLocalDate(dateStr);
    if (!d) return null;
    return d.toLocaleDateString("es-CO", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (time: string | null | undefined) => {
    if (!time) return null;
    return time.slice(0, 5);
  };

  const timeRange = (() => {
    const start = formatTime(cotizacion.hora_inicio);
    const end = formatTime(cotizacion.hora_fin);
    if (start && end) return `${start} — ${end}`;
    if (start) return `Desde ${start}`;
    return null;
  })();

  const computeTotal = (items: CotizacionItemsState) =>
    items.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0) +
    items.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0) +
    items.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0) +
    (items.menaje ?? []).reduce((a, m) => a + m.precio_alquiler * m.cantidad, 0);

  const computeSubtotales = (items: CotizacionItemsState) => ({
    platos: items.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0),
    personal: items.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0),
    transportes: items.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0),
    menaje: (items.menaje ?? []).reduce((a, m) => a + m.precio_alquiler * m.cantidad, 0),
  });

  const itemsTotal = current ? computeTotal(current.items) : 0;
  const total = itemsTotal + lugarPrecio;
  const subtotales = current
    ? computeSubtotales(current.items)
    : { platos: 0, personal: 0, transportes: 0, menaje: 0 };
  const costPerGuest =
    cotizacion.numero_invitados > 0 ? total / cotizacion.numero_invitados : 0;

  const whatsappPhone =
    cotizacion.contacto?.telefono ||
    cotizacion.cliente?.telefono ||
    cotizacion.contacto_telefono ||
    null;

  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hola, me interesa la propuesta "${cotizacion.nombre_cotizacion}". Me gustaría conversar sobre los detalles.`
      )}`
    : null;

  const validUntil = (() => {
    const base = cotizacion.fecha_envio || cotizacion.created_at;
    if (!base) return null;
    const d = new Date(base);
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  })();

  const sections = current
    ? [
        {
          label: "Menú y gastronomía",
          items: current.items.platos.map((p) => ({
            nombre: p.nombre,
            unitario: p.precio_unitario,
            cantidad: p.cantidad,
          })),
          subtotal: subtotales.platos,
        },
        {
          label: "Personal de servicio",
          items: current.items.personal.map((p) => ({
            nombre: p.rol,
            unitario: p.tarifa_estimada_por_persona,
            cantidad: p.cantidad,
          })),
          subtotal: subtotales.personal,
        },
        {
          label: "Logística y transporte",
          items: current.items.transportes.map((t) => ({
            nombre: t.lugar,
            unitario: t.tarifa_unitaria,
            cantidad: t.cantidad,
          })),
          subtotal: subtotales.transportes,
        },
        {
          label: "Menaje y equipamiento",
          items: (current.items.menaje ?? []).map((m) => ({
            nombre: m.nombre,
            unitario: m.precio_alquiler,
            cantidad: m.cantidad,
          })),
          subtotal: subtotales.menaje,
        },
        ...(lugarSeleccionado && lugarPrecio > 0
          ? [
              {
                label: "Salón — lugar del evento",
                items: [
                  {
                    nombre: [lugarSeleccionado.nombre, lugarSeleccionado.ciudad]
                      .filter(Boolean)
                      .join(", "),
                    unitario: lugarPrecio,
                    cantidad: 1,
                  },
                ],
                subtotal: lugarPrecio,
              },
            ]
          : []),
      ].filter((s) => s.items.length > 0)
    : [];

  const detailMeta: Array<{ label: string; value: string }> = [];
  if (cotizacion.fecha_evento_estimada)
    detailMeta.push({ label: "Fecha del evento", value: formatDate(cotizacion.fecha_evento_estimada)! });
  if (timeRange) detailMeta.push({ label: "Horario", value: timeRange });
  detailMeta.push({ label: "Invitados", value: `${cotizacion.numero_invitados} personas` });
  if (lugarSeleccionado) {
    detailMeta.push({
      label: "Lugar",
      value: [lugarSeleccionado.nombre, lugarSeleccionado.ciudad].filter(Boolean).join(", "),
    });
  } else if (cotizacion.ubicacion_evento) {
    detailMeta.push({ label: "Ubicación", value: cotizacion.ubicacion_evento });
  }
  if (cotizacion.cliente?.nombre || cotizacion.cliente_nombre) {
    detailMeta.push({
      label: "Cliente",
      value: (cotizacion.cliente?.nombre || cotizacion.cliente_nombre)!,
    });
  }
  if (cotizacion.comercial_encargado && cotizacion.comercial_encargado !== "Sin asignar") {
    detailMeta.push({ label: "Ejecutivo comercial", value: cotizacion.comercial_encargado });
  }

  const issueNumber = cotizacion.id
    ? `№ ${String(cotizacion.id).slice(0, 4).toUpperCase()}`
    : "№ —";

  /* ─── RENDER ─── */
  return (
    <div
      className="min-h-screen bg-paper text-foreground"
      style={{
        fontFamily:
          "'Instrument Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ════════ TOP STRIP — cabecera editorial ════════ */}
      <div className="border-b border-border/60">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
          <img src={LOGO_URL} alt="Selecta" className="h-11 [filter:brightness(0)]" />
          <div className="flex items-center gap-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {issueNumber}
            </span>
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Propuesta
            </span>
          </div>
        </div>
      </div>

      {/* ════════ MASTHEAD — título monumental ════════ */}
      <section
        ref={mastheadRef}
        className="max-w-5xl mx-auto px-6 sm:px-10 pt-12 pb-10 sm:pt-16 sm:pb-14 animate-rise stagger-1"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-px bg-primary" />
          <span className="kicker text-primary">
            Para {cotizacion.cliente?.nombre || cotizacion.cliente_nombre || "nuestro invitado"}
          </span>
        </div>

        <h1 className="font-serif font-semibold text-[clamp(2.25rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em] text-foreground">
          {cotizacion.nombre_cotizacion}
        </h1>

        {cotizacion.fecha_evento_estimada && (
          <p className="mt-6 font-serif italic text-base sm:text-lg text-muted-foreground">
            {formatDate(cotizacion.fecha_evento_estimada)}
          </p>
        )}
      </section>

      {/* ════════ HERO FIGURE — foto editorial full-bleed ════════ */}
      <figure className="relative w-full animate-rise stagger-2">
        <div className="relative h-[280px] sm:h-[420px] overflow-hidden">
          <img src={IMG_HERO} alt="" className="w-full h-full object-cover" />
        </div>
        <figcaption className="max-w-5xl mx-auto px-6 sm:px-10 pt-4 flex items-baseline gap-4">
          <span className="kicker text-muted-foreground">Prólogo</span>
          <span className="font-serif italic text-sm text-muted-foreground">
            Gastronomía, servicio y detalle al cuidado de Selecta
          </span>
        </figcaption>
      </figure>

      {/* ════════ DETALLES — ficha colofón ════════ */}
      <section className="max-w-5xl mx-auto px-6 sm:px-10 pt-20 pb-16 animate-rise stagger-3">
        <header className="grid grid-cols-[auto_1fr] gap-6 sm:gap-10 items-baseline mb-10">
          <span className="font-serif italic text-3xl sm:text-4xl text-primary/70 leading-none tabular-nums">
            I
          </span>
          <div>
            <span className="kicker text-muted-foreground block mb-1">Capítulo</span>
            <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
              Detalles del evento
            </h2>
          </div>
        </header>

        <dl className="grid grid-cols-1 sm:grid-cols-2 border-t border-border">
          {detailMeta.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[140px_1fr] sm:grid-cols-[130px_1fr] gap-4 py-4 border-b border-border"
            >
              <dt className="kicker text-muted-foreground pt-0.5">{row.label}</dt>
              <dd className="text-sm text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ════════ VERSION SELECTOR — editions ════════ */}
      {versiones.length > 1 && (
        <section className="max-w-5xl mx-auto px-6 sm:px-10 pb-12">
          <div className="border-t border-border pt-10">
            <span className="kicker text-muted-foreground block mb-4">
              Ediciones disponibles — seleccione una
            </span>
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
              {versiones.map((v, idx) => {
                const isActive = idx === activeVersionIdx;
                return (
                  <button
                    key={v.id}
                    onClick={() => switchVersion(idx)}
                    className={`font-serif italic text-2xl sm:text-3xl leading-tight transition-all ${
                      isActive
                        ? "text-primary border-b-2 border-primary pb-1"
                        : "text-muted-foreground/60 hover:text-foreground border-b-2 border-transparent pb-1"
                    }`}
                  >
                    {v.nombre_opcion}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ════════ SECTIONS — capítulos con dot leaders ════════ */}
      <div
        className="max-w-5xl mx-auto px-6 sm:px-10 pb-20 transition-opacity duration-200"
        style={{ opacity: transitioning ? 0 : 1 }}
      >
        {sections.map((section, sIdx) => (
          <section
            key={sIdx}
            className="py-14 border-t border-border first:border-t-0"
          >
            <header className="grid grid-cols-[auto_1fr] gap-6 sm:gap-10 items-baseline mb-10">
              <span className="font-serif italic text-3xl sm:text-4xl text-primary/70 leading-none tabular-nums">
                {ROMAN[sIdx + 1] /* offset: I was "Detalles" */}
              </span>
              <div>
                <span className="kicker text-muted-foreground block mb-1">Capítulo</span>
                <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
                  {section.label}
                </h2>
              </div>
            </header>

            <ul className="space-y-0">
              {section.items.map((item, iIdx) => (
                <li
                  key={iIdx}
                  className="flex items-baseline gap-3 py-4 border-b border-border/60 last:border-b-0"
                >
                  <span className="font-serif text-lg sm:text-xl text-foreground leading-snug">
                    {item.nombre}
                  </span>
                  {item.cantidad > 1 && (
                    <span className="font-mono text-xs text-muted-foreground tabular-nums shrink-0">
                      × {item.cantidad}
                    </span>
                  )}
                  <span className="flex-1 relative top-[-4px] border-b border-dotted border-muted-foreground/40 mx-1" />
                  <span className="font-mono text-sm sm:text-base text-foreground tabular-nums shrink-0">
                    {fmt(item.unitario * item.cantidad)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-baseline justify-end gap-6 mt-6 pt-4 border-t border-border">
              <span className="kicker text-muted-foreground">Subtotal</span>
              <span className="font-serif italic text-xl text-primary tabular-nums">
                {fmt(section.subtotal)}
              </span>
            </div>
          </section>
        ))}
      </div>

      {/* ════════ INTERLUDE IMG ════════ */}
      <figure className="relative w-full">
        <div className="relative h-[240px] sm:h-[360px] overflow-hidden">
          <img src={IMG_GASTRO} alt="" className="w-full h-full object-cover" />
        </div>
        <figcaption className="max-w-5xl mx-auto px-6 sm:px-10 pt-4 flex items-baseline gap-4">
          <span className="kicker text-muted-foreground">Intermezzo</span>
          <span className="font-serif italic text-sm text-muted-foreground">
            La mesa como escenografía del encuentro
          </span>
        </figcaption>
      </figure>

      {/* ════════ TOTAL — colofón monumental ════════ */}
      <section
        ref={totalSectionRef}
        className="max-w-5xl mx-auto px-6 sm:px-10 pt-24 pb-20 transition-opacity duration-200"
        style={{ opacity: transitioning ? 0 : 1 }}
      >
        <div className="border-t border-border pt-12">
          <span className="kicker text-muted-foreground block mb-4">
            Suma de la propuesta
          </span>

          <div className="flex items-end justify-between gap-6 flex-wrap">
            <div className="font-serif font-semibold text-[clamp(3.5rem,14vw,9rem)] leading-[0.9] tracking-[-0.03em] text-primary tabular-nums">
              {fmt(total)}
            </div>

            {costPerGuest > 0 && (
              <div className="pb-3 text-right">
                <div className="kicker text-muted-foreground mb-1">Por invitado</div>
                <div className="font-serif text-2xl text-foreground tabular-nums">
                  {fmt(costPerGuest)}
                </div>
                <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                  sobre {cotizacion.numero_invitados} personas
                </div>
              </div>
            )}
          </div>

          {/* Subtotales desglose compacto */}
          <dl className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-x-12 max-w-2xl">
            {sections.map((section, i) => (
              <div
                key={i}
                className="flex items-baseline justify-between py-3 border-b border-border/60"
              >
                <dt className="text-sm text-muted-foreground">{section.label}</dt>
                <dd className="font-mono text-sm text-foreground tabular-nums">
                  {fmt(section.subtotal)}
                </dd>
              </div>
            ))}
          </dl>

          {validUntil && (
            <p className="mt-16 font-serif italic text-base text-muted-foreground">
              Propuesta válida hasta el {validUntil}.
            </p>
          )}

          <p className="mt-3 text-xs text-muted-foreground leading-relaxed max-w-xl">
            Esta cotización es una estimación y puede estar sujeta a ajustes
            según requerimientos finales del evento.
          </p>
        </div>
      </section>

      {/* ════════ CLOSING FIGURE ════════ */}
      <figure className="relative w-full">
        <div className="relative h-[220px] sm:h-[320px] overflow-hidden">
          <img src={IMG_EVENTO} alt="" className="w-full h-full object-cover" />
        </div>
      </figure>

      {/* ════════ FOOTER — olive sólido ════════ */}
      <footer className="bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 text-center">
          <img
            src={LOGO_URL}
            alt="Selecta"
            className="h-14 mx-auto mb-6 [filter:brightness(0)_invert(1)] opacity-90"
          />

          <p className="font-serif italic text-xl sm:text-2xl text-primary-foreground/80 max-w-xl mx-auto leading-relaxed">
            «&nbsp;Donde el anfitrión es otro invitado&nbsp;»
          </p>

          <div className="mt-12 w-16 h-px bg-primary-foreground/30 mx-auto" />

          {whatsappPhone && (
            <div className="mt-8 space-y-1">
              <span className="kicker text-primary-foreground/50 block">Contacto</span>
              <a
                href={whatsappUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-primary-foreground hover:underline underline-offset-4"
              >
                {whatsappPhone}
              </a>
            </div>
          )}

          <div className="mt-14 flex items-center justify-center gap-3 text-[10px] font-mono uppercase tracking-[0.2em] text-primary-foreground/40">
            <span>Selecta Eventos</span>
            <span className="w-1 h-1 rounded-full bg-primary-foreground/40" />
            <span>{new Date().getFullYear()}</span>
            <span className="w-1 h-1 rounded-full bg-primary-foreground/40" />
            <span>By Irrelevant</span>
          </div>
        </div>
      </footer>

      {/* ════════ STICKY BAR — hairline editorial ════════ */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 transition-all duration-300"
        style={{
          transform: showStickyBar ? "translateY(0)" : "translateY(100%)",
          opacity: showStickyBar ? 1 : 0,
        }}
      >
        <div className="bg-card border-t border-border shadow-[var(--shadow-elegant)]">
          <div className="max-w-5xl mx-auto px-6 sm:px-10 py-4 flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="kicker text-muted-foreground truncate">
                {current?.nombre_opcion ?? "Propuesta"}
                {costPerGuest > 0 && (
                  <span className="ml-2 font-mono normal-case tracking-normal text-[10px]">
                    · {fmt(costPerGuest)}/invitado
                  </span>
                )}
              </div>
              <div className="font-serif text-xl sm:text-2xl font-semibold text-primary tabular-nums leading-tight">
                {fmt(total)}
              </div>
            </div>

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Conversar
                <span className="font-mono text-xs">→</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ════════ WHATSAPP FAB — discreto ════════ */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed z-50 flex items-center justify-center w-12 h-12 rounded-full shadow-[var(--shadow-elegant)] hover:scale-105 active:scale-95 transition-transform"
          style={{
            backgroundColor: "#128C7E",
            bottom: showStickyBar ? "96px" : "28px",
            right: "28px",
            transition: "bottom 0.3s ease, transform 0.15s ease",
          }}
          aria-label="Contactar por WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      )}
    </div>
  );
}
