import { SidebarProvider } from "@/hooks/useSidebar";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileSidebar } from "./MobileSidebar";
import { matchNavItem } from "./navigation";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { pathname } = useLocation();
  const current = matchNavItem(pathname);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-paper">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Topbar — minimal, editorial */}
          <header className="relative z-10 flex h-14 shrink-0 items-center gap-4 border-b border-border/70 bg-background/80 px-5 backdrop-blur-md lg:px-8">
            <MobileSidebar />

            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="kicker hidden sm:inline">Selecta</span>
              <span className="hidden h-3 w-px bg-border sm:inline-block" />
              <span className="font-serif text-[15px] font-medium tracking-tight text-foreground truncate">
                {current?.title ?? "Sistema"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1 md:inline-flex">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
                  En línea
                </span>
              </span>
            </div>
          </header>

          {/* Scroll area */}
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
