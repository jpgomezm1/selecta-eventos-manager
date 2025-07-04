import { SidebarProvider } from "@/hooks/useSidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileSidebar } from "./MobileSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-selecta-gray">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-background flex items-center px-4 lg:px-6 shadow-soft">
            <MobileSidebar />
            <div className="flex-1">
              <h1 className="font-semibold text-lg text-selecta-blue">
                Sistema de Gestión - Selecta Eventos
              </h1>
            </div>
          </header>
          
          <main className="flex-1 p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}