import { useState } from "react";
import { Menu, LogOut } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { filterNavSectionsByRoles, type NavItem } from "./navigation";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/types/roles";

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.match) return item.match.test(pathname);
  return pathname === item.url;
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, roles } = useAuth();
  const visibleSections = filterNavSectionsByRoles(roles);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Error al cerrar sesión: " + error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
      toast({ title: "Sesión cerrada" });
    }
    setOpen(false);
  };

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="-ml-2" aria-label="Abrir menú">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 border-r-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-sidebar-border/60 px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary p-1.5 shadow-sm">
                  <img
                    src="https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png"
                    alt="Selecta"
                    className="h-full w-full object-contain"
                  />
                </span>
                <div className="flex flex-col leading-none">
                  <SheetTitle className="font-serif text-lg font-semibold tracking-tight text-sidebar-primary">
                    Selecta
                  </SheetTitle>
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/50">
                    Eventos · Catering
                  </span>
                </div>
              </div>
            </SheetHeader>

            <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
              {visibleSections.map((section) => (
                <div key={section.label} className="space-y-1">
                  <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">
                    {section.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {section.items.map((item) => {
                      const active = isItemActive(location.pathname, item);
                      return (
                        <NavLink
                          key={item.url}
                          to={item.url}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                            active
                              ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                              : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} />
                          <span>{item.title}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-sidebar-border/60 px-3 py-4 space-y-2">
              {user?.email && (
                <div className="px-3 pb-1">
                  <div className="truncate text-[12px] font-medium text-sidebar-foreground">
                    {user.email}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {roles.length === 0 ? (
                      <span className="text-[10.5px] uppercase tracking-[0.14em] text-sidebar-foreground/40">
                        Sin rol asignado
                      </span>
                    ) : (
                      roles.map((r) => (
                        <span
                          key={r}
                          className="inline-flex items-center rounded-full border border-sidebar-foreground/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-sidebar-foreground/70"
                        >
                          {ROLE_LABELS[r]}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start gap-3 px-3 py-2 text-[13px] font-normal text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive"
              >
                <LogOut className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} />
                Cerrar sesión
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
