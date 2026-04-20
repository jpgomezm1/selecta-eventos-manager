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
const IMG_FOOTER = "https://storage.googleapis.com/cluvi/Selecta-Eventos/image4_selecta.png";

const TEAL = "#005A64";
const LIME = "#B1C91E";

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
  const heroRef = useRef<HTMLDivElement>(null);

  // Filter versions if ?v= param is present (must be before early returns)
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

  // Sticky bar: show after scrolling past hero, hide when total section is visible
  useEffect(() => {
    const heroEl = heroRef.current;
    const totalEl = totalSectionRef.current;
    if (!heroEl || !totalEl) return;

    let heroVisible = true;
    let totalVisible = false;

    const update = () => setShowStickyBar(!heroVisible && !totalVisible);

    const heroObs = new IntersectionObserver(
      ([e]) => { heroVisible = e.isIntersecting; update(); },
      { threshold: 0 }
    );
    const totalObs = new IntersectionObserver(
      ([e]) => { totalVisible = e.isIntersecting; update(); },
      { threshold: 0.3 }
    );

    heroObs.observe(heroEl);
    totalObs.observe(totalEl);
    return () => { heroObs.disconnect(); totalObs.disconnect(); };
  }, [data]);

  // Version switch with fade animation
  const switchVersion = useCallback((idx: number) => {
    if (idx === activeVersionIdx) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveVersionIdx(idx);
      setTransitioning(false);
    }, 150);
  }, [activeVersionIdx]);

  /* ─── LOADING ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center space-y-5">
          <img src={LOGO_URL} alt="Selecta" className="h-16 sm:h-20 opacity-60" />
          <div className="flex items-center gap-2 text-sm" style={{ color: TEAL }}>
            <div
              className="w-4 h-4 rounded-full animate-spin"
              style={{ border: `2px solid ${TEAL}20`, borderTopColor: TEAL }}
            />
            Cargando propuesta...
          </div>
        </div>
      </div>
    );
  }

  /* ─── NOT FOUND ─── */
  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center space-y-5 text-center px-6 max-w-sm">
          <img src={LOGO_URL} alt="Selecta" className="h-16 sm:h-20 opacity-50" />
          <div className="space-y-2">
            <h2 className="text-lg font-medium text-gray-900">
              Enlace no disponible
            </h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Este enlace ha expirado o fue desactivado. Contacta a quien te lo
              envio para obtener uno nuevo.
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
    if (start && end) return `${start} - ${end}`;
    if (start) return `Desde ${start}`;
    return null;
  })();

  const computeTotal = (items: CotizacionItemsState) =>
    items.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0) +
    items.personal.reduce(
      (a, p) => a + p.tarifa_estimada_por_persona * p.cantidad,
      0
    ) +
    items.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0) +
    (items.menaje ?? []).reduce(
      (a, m) => a + m.precio_alquiler * m.cantidad,
      0
    );

  const computeSubtotales = (items: CotizacionItemsState) => ({
    platos: items.platos.reduce(
      (a, p) => a + p.precio_unitario * p.cantidad,
      0
    ),
    personal: items.personal.reduce(
      (a, p) => a + p.tarifa_estimada_por_persona * p.cantidad,
      0
    ),
    transportes: items.transportes.reduce(
      (a, t) => a + t.tarifa_unitaria * t.cantidad,
      0
    ),
    menaje: (items.menaje ?? []).reduce(
      (a, m) => a + m.precio_alquiler * m.cantidad,
      0
    ),
  });

  const itemsTotal = current ? computeTotal(current.items) : 0;
  const total = itemsTotal + lugarPrecio;
  const subtotales = current
    ? computeSubtotales(current.items)
    : { platos: 0, personal: 0, transportes: 0, menaje: 0 };
  const costPerGuest =
    cotizacion.numero_invitados > 0
      ? total / cotizacion.numero_invitados
      : 0;

  // WhatsApp contact phone
  const whatsappPhone = cotizacion.contacto?.telefono
    || cotizacion.cliente?.telefono
    || cotizacion.contacto_telefono
    || null;

  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hola, me interesa la propuesta "${cotizacion.nombre_cotizacion}". Me gustaria conversar sobre los detalles.`
      )}`
    : null;

  // Validity date: 30 days from fecha_envio or created_at
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
          label: "Menu y Gastronomia",
          items: current.items.platos.map((p) => ({
            nombre: p.nombre,
            unitario: p.precio_unitario,
            cantidad: p.cantidad,
          })),
          subtotal: subtotales.platos,
        },
        {
          label: "Personal de Servicio",
          items: current.items.personal.map((p) => ({
            nombre: p.rol,
            unitario: p.tarifa_estimada_por_persona,
            cantidad: p.cantidad,
          })),
          subtotal: subtotales.personal,
        },
        {
          label: "Logistica y Transporte",
          items: current.items.transportes.map((t) => ({
            nombre: t.lugar,
            unitario: t.tarifa_unitaria,
            cantidad: t.cantidad,
          })),
          subtotal: subtotales.transportes,
        },
        {
          label: "Menaje y Equipamiento",
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
                label: "Salon / Lugar",
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

  // Detail metadata rows
  const detailMeta: Array<{ label: string; value: string }> = [];
  if (cotizacion.fecha_evento_estimada)
    detailMeta.push({
      label: "Fecha del evento",
      value: formatDate(cotizacion.fecha_evento_estimada)!,
    });
  if (timeRange) detailMeta.push({ label: "Horario", value: timeRange });
  detailMeta.push({
    label: "Numero de invitados",
    value: `${cotizacion.numero_invitados} personas`,
  });
  if (lugarSeleccionado) {
    detailMeta.push({
      label: "Lugar",
      value: [lugarSeleccionado.nombre, lugarSeleccionado.ciudad]
        .filter(Boolean)
        .join(", "),
    });
  } else if (cotizacion.ubicacion_evento) {
    detailMeta.push({
      label: "Ubicacion",
      value: cotizacion.ubicacion_evento,
    });
  }
  if (cotizacion.cliente?.nombre || cotizacion.cliente_nombre) {
    detailMeta.push({
      label: "Cliente",
      value: (cotizacion.cliente?.nombre || cotizacion.cliente_nombre)!,
    });
  }
  if (
    cotizacion.comercial_encargado &&
    cotizacion.comercial_encargado !== "Sin asignar"
  ) {
    detailMeta.push({
      label: "Ejecutivo comercial",
      value: cotizacion.comercial_encargado,
    });
  }

  /* ─── RENDER ─── */
  return (
    <div
      className="min-h-screen bg-white"
      style={{
        fontFamily:
          "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ════════════════════════════════════════════
          HERO SECTION
         ════════════════════════════════════════════ */}
      <div className="relative" ref={heroRef}>
        {/* Hero image */}
        <div className="relative h-[340px] sm:h-[420px] overflow-hidden">
          <img
            src={IMG_HERO}
            alt=""
            className="w-full h-full object-cover"
          />
          {/* Dark overlay gradient */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,40,45,0.55) 0%, rgba(0,50,55,0.75) 100%)",
            }}
          />

          {/* Header bar (over image) */}
          <div className="absolute top-0 left-0 right-0">
            <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
              <img
                src={LOGO_URL}
                alt="Selecta Eventos"
                className="h-12 sm:h-14 brightness-0 invert"
              />
              <span
                className="text-[10px] sm:text-xs font-semibold tracking-[0.25em] uppercase"
                style={{ color: LIME }}
              >
                Propuesta Comercial
              </span>
            </div>
          </div>

          {/* Title over hero */}
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="text-center space-y-4 max-w-2xl">
              <div
                className="w-10 h-[2px] mx-auto rounded-full"
                style={{ backgroundColor: LIME }}
              />
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                {cotizacion.nombre_cotizacion}
              </h1>
              <p className="text-white/60 text-sm sm:text-base">
                {cotizacion.cliente?.nombre ||
                  cotizacion.cliente_nombre ||
                  ""}
                {cotizacion.fecha_evento_estimada &&
                  ` \u00B7 ${formatDate(cotizacion.fecha_evento_estimada)}`}
              </p>
              <div
                className="w-10 h-[2px] mx-auto rounded-full"
                style={{ backgroundColor: LIME }}
              />
            </div>
          </div>
        </div>

        {/* Gradient accent line below hero */}
        <div
          className="h-[3px]"
          style={{
            background: `linear-gradient(90deg, ${TEAL}, ${LIME})`,
          }}
        />
      </div>

      {/* ════════════════════════════════════════════
          MAIN CONTENT
         ════════════════════════════════════════════ */}
      <main className="max-w-3xl mx-auto px-6">
        {/* ─── EVENT DETAILS ─── */}
        <div className="py-10">
          <h2
            className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-6"
            style={{ color: TEAL }}
          >
            Detalles del Evento
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
            {detailMeta.map((row, i) => (
              <div key={i}>
                <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">
                  {row.label}
                </p>
                <p className="text-sm font-medium text-gray-900">
                  {row.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Thin divider */}
        <div className="border-t border-gray-100" />

        {/* ─── GASTRONOMY IMAGE SEPARATOR ─── */}
        <div className="py-10">
          <div className="rounded-xl overflow-hidden h-[180px] sm:h-[220px]">
            <img
              src={IMG_GASTRO}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* ─── VERSION SELECTOR ─── */}
        {versiones.length > 1 && (
          <div className="flex justify-center pb-10">
            <div className="inline-flex rounded-full border border-gray-200 p-1 gap-0.5 bg-gray-50">
              {versiones.map((v, idx) => {
                const isActive = idx === activeVersionIdx;
                return (
                  <button
                    key={v.id}
                    onClick={() => switchVersion(idx)}
                    className="px-6 py-2 rounded-full text-sm font-medium transition-all"
                    style={{
                      backgroundColor: isActive ? TEAL : "transparent",
                      color: isActive ? "white" : "#9ca3af",
                    }}
                  >
                    {v.nombre_opcion}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── ITEM SECTIONS ─── */}
        <div
          className="space-y-8 pb-10 transition-opacity duration-150"
          style={{ opacity: transitioning ? 0 : 1 }}
        >
          {sections.map((section, sIdx) => (
            <div key={sIdx}>
              {/* Section header */}
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-[11px] font-semibold tracking-[0.2em] uppercase"
                  style={{ color: TEAL }}
                >
                  {section.label}
                </h3>
                <span className="text-sm font-semibold text-gray-900">
                  {fmt(section.subtotal)}
                </span>
              </div>

              {/* Items table */}
              <div className="bg-gray-50/70 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-medium text-gray-400 uppercase tracking-wider px-5 py-3">
                        Concepto
                      </th>
                      <th className="text-center text-[10px] font-medium text-gray-400 uppercase tracking-wider px-3 py-3 w-16">
                        Cant.
                      </th>
                      <th className="text-right text-[10px] font-medium text-gray-400 uppercase tracking-wider px-3 py-3 w-28 hidden sm:table-cell">
                        Unitario
                      </th>
                      <th className="text-right text-[10px] font-medium text-gray-400 uppercase tracking-wider px-5 py-3 w-32">
                        Subtotal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, iIdx) => (
                      <tr
                        key={iIdx}
                        className="border-t border-gray-100/80"
                      >
                        <td className="px-5 py-3 text-sm text-gray-800">
                          {item.nombre}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500 text-center">
                          {item.cantidad}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-500 text-right hidden sm:table-cell">
                          {fmt(item.unitario)}
                        </td>
                        <td className="px-5 py-3 text-sm font-medium text-gray-900 text-right">
                          {fmt(item.unitario * item.cantidad)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Thin divider */}
        <div className="border-t border-gray-100" />

        {/* ─── EVENT IMAGE SEPARATOR ─── */}
        <div className="py-10">
          <div className="rounded-xl overflow-hidden h-[180px] sm:h-[220px]">
            <img
              src={IMG_EVENTO}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* ─── TOTAL SECTION ─── */}
        <div
          ref={totalSectionRef}
          className="pb-10 transition-opacity duration-150"
          style={{ opacity: transitioning ? 0 : 1 }}
        >
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: `${TEAL}08` }}
          >
            <div className="px-6 py-6 space-y-4">
              {/* Subtotals */}
              <div className="space-y-2.5">
                {sections.map((section, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex justify-between items-center"
                  >
                    <span className="text-sm text-gray-500">
                      {section.label}
                    </span>
                    <span className="text-sm text-gray-700 font-medium">
                      {fmt(section.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div
                className="h-[1px]"
                style={{
                  background: `linear-gradient(90deg, transparent, ${TEAL}30, transparent)`,
                }}
              />

              {/* Grand total */}
              <div className="flex justify-between items-end pt-1">
                <div>
                  <p className="text-sm text-gray-500 mb-0.5">
                    Total de la propuesta
                  </p>
                  {costPerGuest > 0 && (
                    <p className="text-xs text-gray-400">
                      {fmt(costPerGuest)} por invitado
                    </p>
                  )}
                </div>
                <span
                  className="text-3xl sm:text-4xl font-bold tracking-tight"
                  style={{ color: TEAL }}
                >
                  {fmt(total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── DISCLAIMER ─── */}
        <div className="text-center pb-10 space-y-1.5">
          {validUntil && (
            <p className="text-xs font-medium" style={{ color: TEAL }}>
              Propuesta valida hasta el {validUntil}
            </p>
          )}
          <p className="text-xs text-gray-400 leading-relaxed">
            Esta cotizacion es una estimacion y puede estar sujeta a ajustes
            segun requerimientos finales.
          </p>
          {(cotizacion.contacto?.telefono ||
            cotizacion.cliente?.telefono ||
            cotizacion.contacto_telefono) && (
            <p className="text-xs text-gray-400">
              Contactanos:{" "}
              <span className="font-medium" style={{ color: TEAL }}>
                {cotizacion.contacto?.telefono ||
                  cotizacion.cliente?.telefono ||
                  cotizacion.contacto_telefono}
              </span>
            </p>
          )}
        </div>
      </main>

      {/* ════════════════════════════════════════════
          FOOTER
         ════════════════════════════════════════════ */}
      <footer className="relative">
        {/* Footer image */}
        <div className="relative h-[160px] sm:h-[200px] overflow-hidden">
          <img
            src={IMG_FOOTER}
            alt=""
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,40,45,0.5) 0%, rgba(0,50,55,0.8) 100%)",
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-3">
              <img
                src={LOGO_URL}
                alt="Selecta Eventos"
                className="h-12 sm:h-16 brightness-0 invert mx-auto opacity-80"
              />
              <p className="text-white/40 text-xs tracking-widest uppercase">
                Donde el anfitrion es otro invitado
              </p>
            </div>
          </div>
        </div>
        <div
          className="h-[3px]"
          style={{
            background: `linear-gradient(90deg, ${LIME}, ${TEAL})`,
          }}
        />
      </footer>

      {/* ════════════════════════════════════════════
          STICKY TOTAL BAR
         ════════════════════════════════════════════ */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 transition-all duration-300"
        style={{
          transform: showStickyBar ? "translateY(0)" : "translateY(100%)",
          opacity: showStickyBar ? 1 : 0,
        }}
      >
        <div
          className="h-[2px]"
          style={{ background: `linear-gradient(90deg, ${TEAL}, ${LIME})` }}
        />
        <div
          className="backdrop-blur-xl border-t border-white/10"
          style={{ backgroundColor: `${TEAL}f2` }}
        >
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-white/60 text-[10px] uppercase tracking-wider truncate">
                {current?.nombre_opcion ?? "Propuesta"}
              </p>
              {costPerGuest > 0 && (
                <p className="text-white/40 text-[10px]">
                  {fmt(costPerGuest)} /invitado
                </p>
              )}
            </div>
            <span className="text-xl sm:text-2xl font-bold text-white tracking-tight shrink-0 ml-4">
              {fmt(total)}
            </span>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          WHATSAPP FAB
         ════════════════════════════════════════════ */}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
          style={{
            backgroundColor: "#25D366",
            bottom: showStickyBar ? "72px" : "24px",
            right: "24px",
            transition: "bottom 0.3s ease, transform 0.15s ease",
          }}
          aria-label="Contactar por WhatsApp"
        >
          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      )}
    </div>
  );
}
