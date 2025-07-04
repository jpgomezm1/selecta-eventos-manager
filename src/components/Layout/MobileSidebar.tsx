import { useState } from "react";
import { Menu, X, Users, Calendar, LayoutDashboard, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const navigation = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Personal", url: "/personal", icon: Users },
  { title: "Eventos", url: "/eventos", icon: Calendar },
];

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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
    setOpen(false);
  };

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="p-6 border-b border-border">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white font-bold text-sm">SE</span>
                </div>
                <div>
                  <SheetTitle className="font-bold text-xl text-selecta-green text-left">
                    Selecta
                  </SheetTitle>
                  <p className="text-sm text-muted-foreground -mt-1 text-left">Eventos</p>
                </div>
              </div>
            </SheetHeader>

            {/* Navigation */}
            <div className="flex-1 p-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Navegación
                </h3>
                <nav className="space-y-2">
                  {navigation.map((item) => (
                    <NavLink
                      key={item.title}
                      to={item.url}
                      end
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  ))}
                </nav>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border">
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
              >
                <LogOut className="h-5 w-5 mr-3" />
                <span>Cerrar Sesión</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}