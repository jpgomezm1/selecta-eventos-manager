import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
  isCollapsed: boolean;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Recuperar estado del localStorage al inicializar
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-collapsed");
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  // Responsive behavior: auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      const isSmallScreen = window.innerWidth < 1024; // lg breakpoint
      if (isSmallScreen) {
        setIsCollapsed(true);
      }
    };

    // Set initial state based on screen size  
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Guardar estado en localStorage cuando cambie (solo si no es pantalla pequeña)
    if (window.innerWidth >= 1024) {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
    }
  }, [isCollapsed]);

  const toggle = () => setIsCollapsed(!isCollapsed);
  const collapse = () => setIsCollapsed(true);
  const expand = () => setIsCollapsed(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, toggle, collapse, expand }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}