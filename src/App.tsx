import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/Layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Personal from "./pages/Personal";
import PersonalDetalle from "./pages/PersonalDetalle";
import Eventos from "./pages/Eventos";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Cotizador from "./pages/Cotizador";
import CotizacionesListPage from "./pages/Cotizaciones";
import CotizacionEditorPage from "./pages/CotizacionEditor";
import EventoDetallePage from "./pages/EventoDetalle";
import BodegaPage from "./pages/Bodega"; // ⬅️ NUEVO

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Navigate to="/personal" replace />} />

            <Route
              path="/personal"
              element={
                <ProtectedRoute>
                  <Personal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/personal/:id"
              element={
                <ProtectedRoute>
                  <PersonalDetalle />
                </ProtectedRoute>
              }
            />

            <Route
              path="/eventos"
              element={
                <ProtectedRoute>
                  <Eventos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/eventos/:id"
              element={
                <ProtectedRoute>
                  <EventoDetallePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/cotizaciones"
              element={
                <ProtectedRoute>
                  <CotizacionesListPage />
                </ProtectedRoute>
              }
            />

            {/* Crear nueva cotización: admitimos ambas URLs */}
            <Route
              path="/cotizador"
              element={
                <ProtectedRoute>
                  <Cotizador />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cotizador/nueva"
              element={
                <ProtectedRoute>
                  <Cotizador />
                </ProtectedRoute>
              }
            />

            {/* Editor de una cotización existente */}
            <Route
              path="/cotizador/:id"
              element={
                <ProtectedRoute>
                  <CotizacionEditorPage />
                </ProtectedRoute>
              }
            />

            {/* Bodega / Menaje */}
            <Route
              path="/bodega"
              element={
                <ProtectedRoute>
                  <BodegaPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
