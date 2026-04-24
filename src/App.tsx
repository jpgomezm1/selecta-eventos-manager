import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/Layout/AppLayout";
import type { UserRole } from "@/types/roles";
import Dashboard from "./pages/Dashboard";
import Personal from "./pages/Personal";
import PersonalDetalle from "./pages/PersonalDetalle";
import Eventos from "./pages/Eventos";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Cotizador from "./pages/Cotizador";
import CotizacionesListPage from "./pages/Cotizaciones";
import CotizacionEditorPage from "./pages/CotizacionEditor";
import VersionEditorWizard from "./pages/VersionEditorWizard";
import EventoDetallePage from "./pages/EventoDetalle";
import BodegaPage from "./pages/Bodega"; // ⬅️ NUEVO
import RecetarioPage from "./pages/Recetario";
import InventarioPage from "./pages/Inventario";
import ClientesPage from "./pages/Clientes";
import CotizacionPublica from "./pages/CotizacionPublica";
import CatalogosPage from "./pages/Catalogos";
import PipelinePage from "./pages/Pipeline";
import TransportePage from "./pages/Transporte";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) {
  const { user, loading, roles, rolesLoaded } = useAuth();

  if (loading || (user && !rolesLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !roles.some((r) => allowedRoles.includes(r))) {
    return <Navigate to="/panorama" replace />;
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
            <Route path="/compartido/:token" element={<CotizacionPublica />} />
            <Route path="/" element={<Navigate to="/panorama" replace />} />

            <Route
              path="/panorama"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/personal"
              element={
                <ProtectedRoute allowedRoles={["admin", "operaciones"]}>
                  <Personal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/personal/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "operaciones"]}>
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

            {/* Cotizaciones */}
            <Route
              path="/cotizaciones"
              element={
                <ProtectedRoute allowedRoles={["admin", "comercial", "operaciones"]}>
                  <CotizacionesListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cotizaciones/nueva"
              element={
                <ProtectedRoute allowedRoles={["admin", "comercial"]}>
                  <Cotizador />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cotizaciones/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "comercial", "operaciones"]}>
                  <CotizacionEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cotizaciones/:id/editar/:versionId"
              element={
                <ProtectedRoute allowedRoles={["admin", "comercial"]}>
                  <VersionEditorWizard />
                </ProtectedRoute>
              }
            />

            {/* Pipeline */}
            <Route
              path="/pipeline"
              element={
                <ProtectedRoute allowedRoles={["admin", "comercial"]}>
                  <PipelinePage />
                </ProtectedRoute>
              }
            />

            {/* Clientes */}
            <Route
              path="/clientes"
              element={
                <ProtectedRoute allowedRoles={["admin", "comercial"]}>
                  <ClientesPage />
                </ProtectedRoute>
              }
            />

            {/* Backward-compat redirects */}
            <Route path="/cotizador" element={<Navigate to="/cotizaciones/nueva" replace />} />
            <Route path="/cotizador/nueva" element={<Navigate to="/cotizaciones/nueva" replace />} />
            <Route path="/cotizador/:id" element={<Navigate to="/cotizaciones" replace />} />

            {/* Transporte */}
            <Route
              path="/transporte"
              element={
                <ProtectedRoute allowedRoles={["admin", "operaciones"]}>
                  <TransportePage />
                </ProtectedRoute>
              }
            />

            {/* Bodega / Menaje */}
            <Route
              path="/bodega"
              element={
                <ProtectedRoute allowedRoles={["admin", "operaciones"]}>
                  <BodegaPage />
                </ProtectedRoute>
              }
            />

            {/* Inventario de Insumos */}
            <Route
              path="/inventario"
              element={
                <ProtectedRoute allowedRoles={["admin", "cocina"]}>
                  <InventarioPage />
                </ProtectedRoute>
              }
            />

            {/* Catálogos */}
            <Route
              path="/catalogos"
              element={
                <ProtectedRoute>
                  <CatalogosPage />
                </ProtectedRoute>
              }
            />

            {/* Recetario */}
            <Route
              path="/recetario"
              element={
                <ProtectedRoute allowedRoles={["admin", "cocina"]}>
                  <RecetarioPage />
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
