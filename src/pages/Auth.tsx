import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate("/");
    };
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({
          title: "Error de autenticación",
          description: error.message.includes("Invalid login credentials")
            ? "Email o contraseña incorrectos"
            : error.message,
          variant: "destructive",
        });
      } else {
        toast({ title: "Bienvenido", description: "Sesión iniciada correctamente" });
      }
    } catch {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-paper">
      {/* Capas decorativas */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-1/4 h-[420px] w-[420px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -right-40 bottom-1/4 h-[380px] w-[380px] rounded-full bg-accent/30 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1180px] flex-col px-6 py-8 md:px-12 md:py-12">
        {/* Brand strip */}
        <header className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary p-1.5 shadow-sm">
            <img
              src="https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png"
              alt="Selecta"
              className="h-full w-full object-contain"
            />
          </span>
          <div className="flex flex-col leading-none">
            <span className="font-serif text-[20px] font-semibold tracking-tight text-primary">
              Selecta
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Eventos · Catering
            </span>
          </div>
        </header>

        {/* Main split */}
        <main className="mt-8 grid flex-1 grid-cols-1 items-center gap-12 md:mt-16 lg:grid-cols-5">
          {/* Editorial copy */}
          <section className="animate-rise stagger-1 space-y-8 lg:col-span-3">
            <div className="space-y-4">
              <span className="kicker">Volumen XII · Acceso</span>
              <h1 className="font-serif text-[52px] leading-[0.98] tracking-[-0.035em] text-foreground md:text-[72px]">
                <span className="italic text-primary">Bienvenido</span>
                <br />
                <span>de nuevo</span>
              </h1>
              <p className="max-w-[44ch] text-[15px] leading-relaxed text-muted-foreground">
                El gestor interno de Selecta Eventos — personal, cotizaciones, menaje, inventario y
                finanzas en un solo lugar.
              </p>
            </div>

            <blockquote className="relative max-w-[36ch] border-l-2 border-primary/30 pl-5">
              <p className="font-serif text-[18px] italic leading-snug text-foreground/90">
                Donde el anfitrión es otro invitado.
              </p>
              <footer className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Selecta Eventos
              </footer>
            </blockquote>
          </section>

          {/* Login card */}
          <section className="animate-rise stagger-2 lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-7 shadow-elegant md:p-9">
              <div className="mb-6 space-y-2">
                <span className="kicker">Acceso</span>
                <h2 className="font-serif text-[26px] leading-tight tracking-tight text-foreground">
                  Ingresar al sistema
                </h2>
                <p className="text-[12.5px] text-muted-foreground">
                  Solo personal autorizado de Selecta.
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="email"
                    className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    Correo electrónico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@selecta.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="password"
                    className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.75} /> : <Eye className="h-4 w-4" strokeWidth={1.75} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="mt-2 h-11 w-full gap-2 text-[13px] font-medium"
                >
                  {loading ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                      <span>Ingresando…</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar sesión</span>
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-12 flex items-center justify-between border-t border-border pt-5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:mt-16">
          <span>Selecta Eventos · Catering</span>
          <span className="flex items-center gap-2">
            <span>por</span>
            <img
              src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png"
              alt="Irrelevant"
              className="h-3 w-auto opacity-60"
            />
          </span>
        </footer>
      </div>
    </div>
  );
}
