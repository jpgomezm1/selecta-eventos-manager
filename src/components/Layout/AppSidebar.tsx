import React, { useEffect } from "react";
import { Users, Calendar, LayoutDashboard, LogOut, Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/hooks/useSidebar";
import { cn } from "@/lib/utils";

const navigation = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Personal", url: "/personal", icon: Users },
  { title: "Eventos", url: "/eventos", icon: Calendar },
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
            "flex items-center rounded-xl text-sm font-semibold transition-all duration-300 relative group overflow-hidden",
            isActive
              ? "bg-gradient-primary text-white shadow-lg"
              : "text-slate-600 hover:bg-slate-100/80 hover:text-selecta-green",
            isCollapsed ? "justify-center p-3 mx-2" : "px-4 py-3"
          )
        }
      >
        {/* Glow effect para item activo */}
        {isActive && (
          <div className="absolute inset-0 bg-gradient-primary opacity-10 rounded-xl"></div>
        )}
        
        <item.icon className={cn(
          "h-5 w-5 shrink-0 transition-all duration-300",
          isCollapsed ? "mx-auto" : "mr-3",
          isActive ? "text-white" : "text-current"
        )} />
        
        <span 
          className={cn(
            "transition-all duration-300 whitespace-nowrap",
            isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}
        >
          {item.title}
        </span>
        
        {/* Indicador lateral para item activo cuando está colapsado */}
        {isActive && isCollapsed && (
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-primary rounded-l-full shadow-lg" />
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-3 bg-slate-800 text-white border-slate-700">
              <p className="font-medium">{item.title}</p>
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
        "bg-white/90 backdrop-blur-xl border-r border-slate-200/60 shadow-xl flex flex-col min-h-screen lg:flex hidden transition-all duration-300 ease-in-out relative",
        isCollapsed ? "w-[80px]" : "w-72"
      )}
    >
      {/* Efecto de gradiente sutil en el fondo */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-transparent pointer-events-none"></div>
      
      {/* Header mejorado */}
      <div className={cn("border-b border-slate-200/60 relative z-10", isCollapsed ? "p-3" : "p-6")}>
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-4">
              {/* Logo container mejorado */}
              <div className="relative">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-200/60 shrink-0 p-2">
                  <img 
                    src="https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png" 
                    alt="Selecta Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                {/* Glow effect del logo con colores verdes */}
                <div className="absolute inset-0 w-12 h-12 bg-gradient-to-br from-selecta-green/20 to-primary/20 rounded-2xl blur-lg -z-10"></div>
              </div>
              
              <div>
                <h2 className="font-bold text-2xl text-selecta-green">
                  Selecta
                </h2>
                <p className="text-sm text-slate-500 font-medium -mt-1">Eventos</p>
              </div>
            </div>
          )}
          
          {/* Toggle Button mejorado - Más prominente cuando está colapsado */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              "p-0 hover:bg-slate-100/80 transition-all duration-300 rounded-xl border border-slate-200/60 bg-white/80 shadow-sm hover:scale-105 hover:shadow-md",
              isCollapsed ? "h-12 w-12 mx-auto" : "h-10 w-10"
            )}
            aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="h-6 w-6 text-selecta-green" />
            ) : (
              <ChevronLeft className="h-5 w-5 text-selecta-green" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation mejorada - SIEMPRE VISIBLE */}
      <div className="flex-1 relative z-10" style={{ padding: isCollapsed ? "16px 8px" : "20px" }}>
        <div className="mb-6">
          {!isCollapsed && (
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 transition-all duration-300">
              Navegación
            </h3>
          )}
          <nav className="space-y-2">
            {navigation.map((item) => (
              <SidebarItem 
                key={item.title} 
                item={item} 
                isActive={location.pathname === item.url}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Footer mejorado - SIEMPRE VISIBLE */}
      <div className={cn("border-t border-slate-200/60 relative z-10", isCollapsed ? "p-3" : "p-5")}>
        <TooltipProvider>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className={cn(
                  "w-full text-slate-600 hover:text-red-600 hover:bg-red-50/80 transition-all duration-300 rounded-xl font-semibold",
                  isCollapsed ? "justify-center p-3" : "justify-start py-3"
                )}
              >
                <LogOut className={cn(
                  "h-5 w-5 transition-all duration-300", 
                  isCollapsed ? "mx-auto" : "mr-3"
                )} />
                {!isCollapsed && (
                  <span className="whitespace-nowrap">
                    Cerrar Sesión
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" className="ml-3 bg-slate-800 text-white border-slate-700">
                <p className="font-medium">Cerrar Sesión</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        
        {/* Shortcut hint cuando no está colapsado */}
        {!isCollapsed && (
          <div className="mt-4 pt-4 border-t border-slate-200/60">
            <p className="text-xs text-slate-400 text-center">
              <kbd className="px-2 py-1 bg-slate-100 rounded text-xs font-mono">Ctrl</kbd> + 
              <kbd className="px-2 py-1 bg-slate-100 rounded text-xs font-mono ml-1">B</kbd>
              <span className="block mt-1">para colapsar</span>
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}