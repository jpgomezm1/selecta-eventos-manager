import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Precargar la imagen
  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => {
      console.log("Error cargando imagen de fondo");
      setImageLoaded(false);
    };
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

  // URL de la imagen de fondo
  const backgroundImageUrl = "https://storage.googleapis.com/cluvi/images-tools/fondo_selecta.png";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image con overlay - Solo si la imagen está cargada */}
      {imageLoaded && (
        <div 
          className="absolute inset-0 z-0 transition-opacity duration-1000 opacity-100"
          style={{
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
          }}
        >
          {/* Overlay gradiente para mejor legibilidad */}
          <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/30 to-black/50"></div>
          {/* Overlay de color para mejorar contraste con brand colors */}
          <div className="absolute inset-0 bg-gradient-to-br from-selecta-green/15 via-transparent to-primary/15"></div>
        </div>
      )}

      {/* Fallback gradient - Siempre visible, pero con menor prioridad */}
      <div className={`absolute inset-0 z-0 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 transition-opacity duration-1000 ${imageLoaded ? 'opacity-0' : 'opacity-100'}`}></div>

      {/* Contenido principal */}
      <div className="w-full max-w-md relative z-10">
        {/* Header Section - Con logo de la empresa */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-white/95 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl border border-white/40 p-3">
            <img 
              src="https://storage.googleapis.com/cluvi/Web-Risk/logo_selecta.png" 
              alt="Selecta Eventos Logo"
              className="w-full h-full object-contain"
            />
          </div>

        </div>

        {/* Main Card - Con glassmorphism mejorado */}
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-xl border border-white/30">
          <CardHeader className="text-center pb-8 pt-8">
            <div className="w-12 h-12 bg-selecta-green/10 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <LogIn className="w-6 h-6 text-selecta-green" />
            </div>
            <CardTitle className="text-2xl text-selecta-green mb-2 font-bold">Iniciar Sesión</CardTitle>

          </CardHeader>
          
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Field - Con icono mejorado */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                  Email
                </Label>
                <div className="relative">
                  <div className="absolute left-3 top-3 w-5 h-5 bg-selecta-green/10 rounded-md flex items-center justify-center">
                    <Mail className="h-3 w-3 text-selecta-green" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-12 h-12 border-slate-200/80 bg-white/90 backdrop-blur-sm focus:border-selecta-green focus:ring-selecta-green/20 rounded-xl shadow-sm"
                  />
                </div>
              </div>

              {/* Password Field - Con toggle de visibilidad mejorado */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                  Contraseña
                </Label>
                <div className="relative">
                  <div className="absolute left-3 top-3 w-5 h-5 bg-selecta-green/10 rounded-md flex items-center justify-center">
                    <Lock className="h-3 w-3 text-selecta-green" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-12 pr-12 h-12 border-slate-200/80 bg-white/90 backdrop-blur-sm focus:border-selecta-green focus:ring-selecta-green/20 rounded-xl shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-selecta-green transition-colors duration-200 rounded-md hover:bg-selecta-green/10"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Login Button - Con gradiente y efectos mejorados */}
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-selecta-green to-primary hover:from-selecta-green/90 hover:to-primary/90 text-white font-semibold text-base shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 rounded-xl"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Ingresando...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <LogIn className="w-5 h-5" />
                    <span>Iniciar Sesión</span>
                  </div>
                )}
              </Button>
            </form>


          </CardContent>
        </Card>

        {/* Developed by Irrelevant - Con glassmorphism adaptativo */}
        <div className={`mt-8 p-4 rounded-2xl backdrop-blur-xl border transition-all duration-300 group shadow-lg ${
          imageLoaded 
            ? 'bg-white/10 border-white/20 hover:bg-white/15' 
            : 'bg-slate-100/80 border-slate-200/40 hover:bg-slate-200/60'
        }`}>
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-medium drop-shadow transition-colors duration-1000 ${
              imageLoaded ? 'text-white/90' : 'text-slate-700'
            }`}>
              Developed by
            </span>
            <div className="flex items-center gap-2 group-hover:scale-105 transition-transform duration-300">
              <img 
                src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png" 
                alt="Irrelevant Logo" 
                className="w-20 h-auto object-contain group-hover:brightness-110 transition-all duration-300 drop-shadow-lg"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Marca de agua sutil en la esquina - Adaptativa */}
      <div className="fixed bottom-6 right-6 opacity-40 hover:opacity-70 transition-opacity duration-300 z-20">
        <div className={`flex items-center gap-2 text-xs backdrop-blur-sm rounded-full px-3 py-2 transition-colors duration-1000 ${
          imageLoaded 
            ? 'text-white/80 bg-black/20' 
            : 'text-slate-600 bg-white/60 border border-slate-200/40'
        }`}>
          <span className="font-medium drop-shadow">Powered by</span>
          <img 
            src="https://storage.googleapis.com/cluvi/nuevo_irre-removebg-preview.png" 
            alt="Irrelevant" 
            className={`w-12 h-auto object-contain transition-all duration-1000 ${
              imageLoaded 
                ? 'brightness-0 invert drop-shadow' 
                : 'drop-shadow-sm'
            }`}
          />
        </div>
      </div>

      {/* Elementos decorativos flotantes - Solo si la imagen está cargada */}
      {imageLoaded && (
        <>
          <div className="absolute top-20 left-10 w-2 h-2 bg-white/30 rounded-full animate-pulse"></div>
          <div className="absolute top-40 right-20 w-3 h-3 bg-selecta-green/40 rounded-full animate-pulse delay-1000"></div>
          <div className="absolute bottom-32 left-16 w-1 h-1 bg-primary/50 rounded-full animate-pulse delay-2000"></div>
          <div className="absolute bottom-20 right-32 w-2 h-2 bg-white/40 rounded-full animate-pulse delay-500"></div>
        </>
      )}


    </div>
  );
}