import React, { useEffect } from "react";
import {
  Users,
  Calendar,
  LayoutDashboard,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Calculator,
  FileText,
  Boxes,
  CookingPot,
  Warehouse,
} from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";

const navigation = [
  { title: "Personal", url: "/personal", icon: Users },
  { title: "Eventos", url: "/eventos", icon: Calendar },
  { title: "Cotizaciones", url: "/cotizaciones", icon: FileText },
  { title: "Nueva Cotización", url: "/cotizador/nueva", icon: Calculator },
  { title: "Menaje", url: "/bodega", icon: Boxes },
  { title: "Recetario", url: "/recetario", icon: CookingPot },
  { title: "Inventario", url: "/inventario", icon: Warehouse },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { isCollapsed, toggle } = useSidebar();

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
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente",
      });
    }
  };

  // Keyboard shortcut handler
  const handleKeyboardShortcut = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      toggle();
    }
  };

  // Add keyboard listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardShortcut);
    return () => document.removeEventListener('keydown', handleKeyboardShortcut);
  }, [toggle]);

  const SidebarItem = ({ item, isActive }: { item: typeof navigation[0], isActive: boolean }) => {
    const content = (
      <NavLink
        to={item.url}
        end
        className={({ isActive }) =>
          cn(
            "flex items-center text-sm font-medium transition-all duration-200",
            isActive
              ? "bg-selecta-green text-white shadow-lg shadow-selecta-green/25"
              : "text-slate-400 hover:bg-slate-800 hover:text-white",
            isCollapsed
              ? "w-11 h-11 justify-center rounded-lg"
              : "px-3 py-2.5 rounded-md"
          )
        }
      >
        <item.icon className={cn(
          "shrink-0",
          isCollapsed ? "h-[22px] w-[22px]" : "h-5 w-5 mr-3"
        )} />

        {!isCollapsed && (
          <span className="whitespace-nowrap">{item.title}</span>
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8} className="bg-slate-800 text-white border-slate-700 font-medium">
              <p>{item.title}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return content;
  };

  return (
    <aside
      className={cn(
        "bg-slate-900 flex flex-col h-screen lg:flex hidden transition-all duration-300 ease-in-out shrink-0",
        isCollapsed ? "w-20" : "w-60"
      )}
    >
      {/* Header */}
      <div className={cn(
        "border-b border-slate-800",
        isCollapsed ? "px-3 py-4" : "px-4 py-5"
      )}>
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          <div className={cn(
            "flex items-center",
            isCollapsed ? "" : "gap-3"
          )}>
            <button
              onClick={isCollapsed ? toggle : undefined}
              className={cn(
                "bg-white rounded-lg flex items-center justify-center shrink-0 transition-transform",
                isCollapsed ? "w-10 h-10 p-2 hover:scale-105 cursor-pointer" : "w-9 h-9 p-1.5 cursor-default"
              )}
              aria-label={isCollapsed ? "Expandir sidebar" : undefined}
            >
              <img
                src="https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png"
                alt="Selecta Logo"
                className="w-full h-full object-contain"
              />
            </button>
            {!isCollapsed && (
              <div>
                <h2 className="font-semibold text-white">Selecta</h2>
                <p className="text-xs text-slate-500">Eventos</p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggle}
              className="p-0 h-8 w-8 hover:bg-slate-800 transition-colors rounded-md"
              aria-label="Colapsar sidebar"
            >
              <ChevronLeft className="h-4 w-4 text-slate-400" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className={cn(
        "flex-1 overflow-y-auto",
        isCollapsed ? "px-3 py-6" : "px-3 py-4"
      )}>
        {!isCollapsed && (
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 px-3">
            Menú
          </p>
        )}
        <nav className={cn(
          "flex flex-col",
          isCollapsed ? "items-center space-y-3" : "space-y-1"
        )}>
          {navigation.map((item) => (
            <SidebarItem
              key={item.title}
              item={item}
              isActive={location.pathname === item.url}
            />
          ))}
        </nav>
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="px-3 pb-4">
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={toggle}
                  className="w-full h-11 bg-slate-800 hover:bg-slate-700 transition-colors rounded-lg text-slate-400 hover:text-white"
                  aria-label="Expandir sidebar"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="bg-slate-800 text-white border-slate-700">
                <p>Expandir menú</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Footer */}
      <div className={cn(
        "border-t border-slate-800",
        isCollapsed ? "p-3" : "p-3"
      )}>
        {/* Logout Button */}
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className={cn(
                  "w-full text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors rounded-md font-medium",
                  isCollapsed ? "h-10 p-0" : "justify-start px-3 py-2.5"
                )}
              >
                <LogOut className={cn(
                  "h-5 w-5 shrink-0",
                  isCollapsed ? "" : "mr-3"
                )} />
                {!isCollapsed && <span>Cerrar Sesión</span>}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" sideOffset={12} className="bg-slate-800 text-white border-slate-700">
                <p>Cerrar Sesión</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Developed by Irrelevant */}
        {!isCollapsed && (
          <div className="mt-2 rounded-md bg-slate-800/50 px-3 py-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-[10px] text-slate-500">by</span>
              <img
                src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png"
                alt="Irrelevant Logo"
                className="w-12 h-auto object-contain opacity-70 hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}