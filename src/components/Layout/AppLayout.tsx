import { SidebarProvider } from "@/hooks/useSidebar";
import { AppSidebar } from "./AppSidebar";
import { MobileSidebar } from "./MobileSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="h-screen flex w-full overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100/50">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="h-14 border-b border-slate-200 bg-white flex items-center px-6 shrink-0">
            <div className="flex items-center w-full">
              <MobileSidebar />

              <div className="ml-4">
                <h1 className="font-semibold text-lg text-slate-800">
                  Sistema de Gestión
                </h1>
              </div>
            </div>
          </header>

          {/* Main content - scrollable */}
          <main className="flex-1 overflow-auto">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}