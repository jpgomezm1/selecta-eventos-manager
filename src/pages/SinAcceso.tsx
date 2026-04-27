import { useNavigate } from "react-router-dom";
import { LogOut, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function SinAcceso() {
  const navigate = useNavigate();
  const { user } = useAuth();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  }

  return (
    <main className="bg-paper min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center px-6 py-16 md:px-10">
        <span className="kicker mb-6">Acceso pendiente</span>
        <h1 className="font-serif text-[44px] leading-[1.04] tracking-[-0.028em] text-foreground md:text-[58px]">
          Tu cuenta no tiene <span className="italic text-primary">acceso asignado</span> todavía.
        </h1>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          Cuando el equipo de Selecta active tu cuenta vas a poder entrar al panel.
          Si crees que esto es un error, contactá a un administrador y pedile que te asigne un rol.
        </p>

        {user?.email && (
          <div className="mt-10 flex items-center gap-3 rounded-md border border-border/70 bg-card px-4 py-3">
            <ShieldOff className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            <div className="text-[13px]">
              <span className="text-muted-foreground">Sesión activa:</span>{" "}
              <span className="font-medium text-foreground">{user.email}</span>
            </div>
          </div>
        )}

        <div className="mt-10">
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </main>
  );
}
