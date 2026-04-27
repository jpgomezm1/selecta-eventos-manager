import React, { useEffect } from "react";
import { LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";
import { filterNavSectionsByRoles, type NavItem } from "./navigation";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/types/roles";

function isItemActive(pathname: string, item: NavItem): boolean {
  if (item.match) return item.match.test(pathname);
  return pathname === item.url;
}

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isCollapsed, toggle } = useSidebar();
  const { user, roles } = useAuth();
  const visibleSections = filterNavSectionsByRoles(roles);
  const primaryRole = roles[0];

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
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [toggle]);

  const Item = ({ item }: { item: NavItem }) => {
    const active = isItemActive(location.pathname, item);
    const content = (
      <NavLink
        to={item.url}
        className={cn(
          "group relative flex items-center transition-all duration-200",
          isCollapsed
            ? "h-10 w-10 justify-center rounded-lg"
            : "gap-3 rounded-md px-3 py-2 text-[13px]",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon
          className={cn(
            "shrink-0 transition-transform",
            isCollapsed ? "h-[18px] w-[18px]" : "h-[17px] w-[17px]",
            active ? "" : "group-hover:scale-105"
          )}
          strokeWidth={active ? 2 : 1.75}
        />
        {!isCollapsed && <span className="truncate tracking-tight">{item.title}</span>}
        {!isCollapsed && active && (
          <span className="ml-auto h-1 w-1 rounded-full bg-sidebar-primary-foreground/60" />
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={12}
            className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          >
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }
    return content;
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out lg:flex",
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center border-b border-sidebar-border/60",
            isCollapsed ? "h-16 justify-center px-3" : "h-16 justify-between px-5"
          )}
        >
          <button
            onClick={isCollapsed ? toggle : undefined}
            className={cn(
              "flex items-center gap-3 text-left",
              isCollapsed ? "cursor-pointer" : "cursor-default"
            )}
            aria-label={isCollapsed ? "Expandir menú" : undefined}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary p-1 shadow-sm">
              <img
                src="https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png"
                alt="Selecta"
                className="h-full w-full object-contain"
              />
            </span>
            {!isCollapsed && (
              <span className="flex flex-col leading-none">
                <span className="font-serif text-[19px] font-semibold tracking-tight text-sidebar-primary">
                  Selecta
                </span>
                <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/50">
                  Eventos · Catering
                </span>
              </span>
            )}
          </button>

          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-7 w-7 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Colapsar menú"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Sections */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto",
            isCollapsed ? "px-3 py-5 space-y-6" : "px-3 py-5 space-y-5"
          )}
        >
          {visibleSections.map((section, idx) => (
            <div key={section.label} className="space-y-1">
              {!isCollapsed && (
                <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/40">
                  {section.label}
                </div>
              )}
              {isCollapsed && idx > 0 && (
                <div className="mx-auto mb-3 h-px w-6 bg-sidebar-border" />
              )}
              <div className={cn("flex flex-col", isCollapsed ? "items-center gap-2" : "gap-0.5")}>
                {section.items.map((item) => (
                  <Item key={item.url} item={item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "border-t border-sidebar-border/60",
            isCollapsed ? "flex flex-col items-center gap-2 px-3 py-4" : "px-3 py-4 space-y-2"
          )}
        >
          {isCollapsed && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggle}
                  className="h-10 w-10 rounded-lg bg-sidebar-accent/40 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  aria-label="Expandir menú"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={12}
                className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
              >
                Expandir menú
              </TooltipContent>
            </Tooltip>
          )}

          {!isCollapsed && user?.email && (
            <div className="px-3 pb-2">
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
          {isCollapsed && primaryRole && (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-sidebar-foreground/25 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/70"
                  aria-label={`Rol: ${ROLE_LABELS[primaryRole]}`}
                >
                  {ROLE_LABELS[primaryRole].slice(0, 2)}
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                sideOffset={12}
                className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
              >
                {user?.email ? `${user.email} · ${ROLE_LABELS[primaryRole]}` : ROLE_LABELS[primaryRole]}
              </TooltipContent>
            </Tooltip>
          )}

          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className={cn(
                  "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-destructive",
                  isCollapsed ? "h-10 w-10 p-0 rounded-lg" : "w-full justify-start gap-3 px-3 py-2 text-[13px] font-normal"
                )}
              >
                <LogOut className="h-[17px] w-[17px] shrink-0" strokeWidth={1.75} />
                {!isCollapsed && <span>Cerrar sesión</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent
                side="right"
                sideOffset={12}
                className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground"
              >
                Cerrar sesión
              </TooltipContent>
            )}
          </Tooltip>

          {!isCollapsed && (
            <a
              href="https://irrelevant.com.co"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center justify-center gap-2 border-t border-sidebar-border/40 pt-3"
            >
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/35">
                by
              </span>
              <img
                src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png"
                alt="Irrelevant"
                className="h-[18px] w-auto opacity-70 transition-opacity group-hover:opacity-100 [filter:brightness(0)_invert(1)]"
              />
            </a>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
