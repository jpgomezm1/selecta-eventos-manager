import React, { useEffect } from "react";
import { Users, Calendar, LayoutDashboard, LogOut, Menu, ChevronRight } from "lucide-react";
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
            "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group",
            isActive
              ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            isCollapsed && "justify-center px-2"
          )
        }
      >
        <item.icon className={cn("h-5 w-5 shrink-0", isCollapsed && "mx-auto")} />
        <span 
          className={cn(
            "transition-all duration-300",
            isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}
        >
          {item.title}
        </span>
        {isActive && isCollapsed && (
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-primary rounded-l-full" />
        )}
      </NavLink>
    );

    if (isCollapsed) {
      return (
        <TooltipProvider>
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">
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
        "bg-background border-r border-border shadow-soft flex flex-col min-h-screen lg:flex hidden transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[70px]" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn("p-6 border-b border-border", isCollapsed && "p-4")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-bold text-sm">SE</span>
            </div>
            <div 
              className={cn(
                "transition-all duration-300",
                isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
              )}
            >
              <h2 className="font-bold text-xl text-selecta-green">Selecta</h2>
              <p className="text-sm text-muted-foreground -mt-1">Eventos</p>
            </div>
          </div>
          
          {/* Toggle Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            className={cn(
              "h-8 w-8 p-0 hover:bg-muted/50 transition-colors shrink-0",
              isCollapsed && "ml-2"
            )}
            aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4">
        <div className="mb-4">
          <h3 
            className={cn(
              "text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 transition-all duration-300",
              isCollapsed ? "opacity-0 h-0 mb-0 overflow-hidden" : "opacity-100"
            )}
          >
            Navegación
          </h3>
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

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <TooltipProvider>
          <Tooltip delayDuration={500}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className={cn(
                  "w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <LogOut className={cn("h-5 w-5", isCollapsed ? "mx-auto" : "mr-3")} />
                <span 
                  className={cn(
                    "transition-all duration-300",
                    isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                  )}
                >
                  Cerrar Sesión
                </span>
              </Button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" className="ml-2">
                <p>Cerrar Sesión</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </div>
    </aside>
  );
}