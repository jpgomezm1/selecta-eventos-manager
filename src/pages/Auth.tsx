import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, LogIn } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const backgroundImageUrl = "https://storage.googleapis.com/cluvi/images-tools/fondo_selecta.png";

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/");
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          navigate("/");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => setImageLoaded(false);
    img.src = backgroundImageUrl;
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Error de autenticación",
            description: "Email o contraseña incorrectos",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "¡Bienvenido!",
          description: "Has iniciado sesión correctamente",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ha ocurrido un error inesperado",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Panel Izquierdo - Formulario */}
      <div className="w-full lg:w-1/2 min-h-screen flex flex-col justify-center px-8 sm:px-12 lg:px-16 xl:px-24 bg-white relative">
        {/* Logo y encabezado */}
        <div className="w-full max-w-md mx-auto">
          <div className="mb-12">
            <div className="w-20 h-20 mb-8">
              <img
                src="https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png"
                alt="Selecta Eventos Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Bienvenido de nuevo
            </h1>
            <p className="text-slate-500">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-12 h-12 border-slate-200 bg-slate-50 focus:bg-white focus:border-selecta-green focus:ring-selecta-green/20 rounded-lg transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-12 pr-12 h-12 border-slate-200 bg-slate-50 focus:bg-white focus:border-selecta-green focus:ring-selecta-green/20 rounded-lg transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-selecta-green hover:bg-selecta-green/90 text-white font-semibold rounded-lg transition-all duration-200 hover:shadow-lg"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Ingresando...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <LogIn className="w-5 h-5" />
                  <span>Iniciar Sesión</span>
                </div>
              )}
            </Button>
          </form>

          {/* Footer del formulario */}
          <div className="mt-12 pt-8 border-t border-slate-100">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <span>Developed by</span>
              <div className="bg-slate-800 rounded-md px-2 py-1">
                <img
                  src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png"
                  alt="Irrelevant Logo"
                  className="h-4 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Panel Derecho - Imagen */}
      <div className="hidden lg:block w-1/2 min-h-screen relative overflow-hidden">
        {/* Imagen de fondo */}
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />

        {/* Fallback gradient mientras carga */}
        <div className={`absolute inset-0 bg-gradient-to-br from-selecta-green via-selecta-green/80 to-primary transition-opacity duration-1000 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`} />

        {/* Overlay oscuro para contraste */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-black/50" />

        {/* Overlay con color de marca */}
        <div className="absolute inset-0 bg-gradient-to-t from-selecta-green/30 via-transparent to-transparent" />

        {/* Contenido sobre la imagen */}
        <div className="absolute inset-0 flex flex-col justify-end p-12 xl:p-16">
          <div className="max-w-lg">
            <h2 className="text-4xl xl:text-5xl font-bold text-white mb-4 leading-tight">
              ERP Selecta Eventos
            </h2>
            <p className="text-white/80 text-lg">
              Sistema integral para la administración de personal, cotizaciones e inventario de Selecta Eventos.
            </p>
          </div>

          {/* Indicadores decorativos */}
          <div className="flex gap-2 mt-8">
            <div className="w-12 h-1 bg-white rounded-full"></div>
            <div className="w-8 h-1 bg-white/40 rounded-full"></div>
            <div className="w-8 h-1 bg-white/40 rounded-full"></div>
          </div>
        </div>

        {/* Elementos decorativos */}
        <div className="absolute top-12 right-12 w-24 h-24 border border-white/20 rounded-full"></div>
        <div className="absolute top-24 right-24 w-16 h-16 border border-white/10 rounded-full"></div>
        <div className="absolute bottom-1/3 right-8 w-32 h-32 border border-white/10 rounded-full"></div>
      </div>
    </div>
  );
}