import { SidebarProvider } from "@/hooks/useSidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileSidebar } from "./MobileSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 to-slate-100/50">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header simplificado */}
          <header className="h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl flex items-center px-6 shadow-sm relative">
            {/* Efecto de gradiente sutil */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/50 to-transparent pointer-events-none"></div>
            
            <div className="flex items-center w-full relative z-10">
              <MobileSidebar />
              
              <div className="ml-4">
                <h1 className="font-bold text-xl bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                  Sistema de Gestión
                </h1>
                <p className="text-sm text-slate-500 font-medium -mt-1">
                  Selecta Eventos
                </p>
              </div>
            </div>
          </header>
          
          {/* Main content */}
          <main className="flex-1 p-6 relative overflow-auto">
            {/* Efectos de fondo sutiles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-selecta-green/5 to-primary/5 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-slate-200/30 to-selecta-green/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2"></div>
            </div>
            
            {/* Contenido */}
            <div className="relative z-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}