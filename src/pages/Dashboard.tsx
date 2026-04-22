import { ProximosEventos } from "@/components/Dashboard/ProximosEventos";
import { AlertasPanel } from "@/components/Dashboard/AlertasPanel";
import { AccionesRapidas } from "@/components/Dashboard/AccionesRapidas";

function formatToday(): string {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function Dashboard() {
  return (
    <div className="relative">
      {/* Page header — editorial */}
      <header className="animate-rise stagger-1 flex flex-col gap-4 border-b border-border/70 pb-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <span className="kicker">Selecta Eventos · Volumen XII</span>
          <h1 className="font-serif text-[44px] leading-[1.02] tracking-[-0.03em] text-foreground md:text-[56px]">
            <span className="italic text-primary">Panorama</span>
            <span className="text-foreground/70"> del día</span>
          </h1>
          <p className="max-w-xl text-[14px] leading-relaxed text-muted-foreground">
            Un resumen curado de los eventos en marcha, las alertas que requieren atención y los
            accesos rápidos a las operaciones del día.
          </p>
        </div>

        <div className="flex items-center gap-6 md:flex-col md:items-end md:gap-1">
          <div className="text-right">
            <div className="kicker mb-0.5">Hoy</div>
            <div className="font-serif text-lg font-medium capitalize tracking-tight text-foreground">
              {formatToday()}
            </div>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Próximos eventos — main column */}
        <section className="animate-rise stagger-2 lg:col-span-2">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
            <ProximosEventos />
          </div>
        </section>

        {/* Side column */}
        <aside className="space-y-6 lg:space-y-8">
          <section className="animate-rise stagger-3">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
              <AlertasPanel />
            </div>
          </section>

          <section className="animate-rise stagger-4">
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
              <AccionesRapidas />
            </div>
          </section>
        </aside>
      </div>

      {/* Footer note */}
      <footer className="animate-rise stagger-5 mt-12 flex items-center justify-between border-t border-border/70 pt-6 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span>
          Selecta · donde el anfitrión es otro invitado
        </span>
        <span className="tabular-nums">
          {new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </footer>
    </div>
  );
}
