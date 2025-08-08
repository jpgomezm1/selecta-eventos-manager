import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Edit, Trash2, Users, Eye, UserPlus, Award, DollarSign, Filter, Calendar, Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonalForm } from "@/components/Forms/PersonalForm";
import { useToast } from "@/hooks/use-toast";
import { Personal, ROLES_PERSONAL } from "@/types/database";

export default function PersonalPage() {
  const navigate = useNavigate();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [filteredPersonal, setFilteredPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [selectedPersonal, setSelectedPersonal] = useState<Personal | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPersonal();
  }, []);

  useEffect(() => {
    filterPersonal();
  }, [personal, searchTerm, filterRole]);

  const fetchPersonal = async () => {
    try {
      const { data, error } = await supabase
        .from("personal")
        .select("*")
        .order("nombre_completo");

      if (error) throw error;
      setPersonal(data as Personal[] || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar el personal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterPersonal = () => {
    let filtered = personal;

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.nombre_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.numero_cedula.includes(searchTerm)
      );
    }

    if (filterRole !== "all") {
      filtered = filtered.filter((p) => p.rol === filterRole);
    }

    setFilteredPersonal(filtered);
  };

  const handlePersonalSubmit = () => {
    fetchPersonal();
    setIsDialogOpen(false);
    setSelectedPersonal(null);
  };

  const handleDeletePersonal = async (id: string) => {
    try {
      const { error } = await supabase
        .from("personal")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Personal eliminado",
        description: "El personal ha sido eliminado exitosamente",
      });
      fetchPersonal();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar el personal",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (rol: string) => {
    const variants: Record<string, string> = {
      "Coordinador": "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200 shadow-sm hover:shadow-md transition-shadow",
      "Chef": "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200 shadow-sm hover:shadow-md transition-shadow",
      "Mesero": "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200 shadow-sm hover:shadow-md transition-shadow",
      "Bartender": "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200 shadow-sm hover:shadow-md transition-shadow",
      "Decorador": "bg-gradient-to-r from-pink-50 to-pink-100 text-pink-700 border-pink-200 shadow-sm hover:shadow-md transition-shadow",
      "Técnico de Sonido": "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200 shadow-sm hover:shadow-md transition-shadow",
      "Fotógrafo": "bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-700 border-yellow-200 shadow-sm hover:shadow-md transition-shadow",
      "Otro": "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200 shadow-sm hover:shadow-md transition-shadow"
    };
    return variants[rol] || variants["Otro"];
  };

  const totalPersonal = personal.length;
  const averageSalary = personal.length > 0 
    ? personal.reduce((sum, p) => sum + Number(p.tarifa_hora), 0) / personal.length 
    : 0;

  const getRoleStats = () => {
    const stats = ROLES_PERSONAL.map(role => ({
      role,
      count: personal.filter(p => p.rol === role).length
    })).filter(stat => stat.count > 0);
    return stats;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
        {/* Elementos decorativos de fondo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-primary/5 to-selecta-green/5 rounded-full blur-2xl animate-pulse delay-500"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center max-w-md mx-auto px-6">
            {/* Icono animado */}
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-r from-selecta-green via-primary to-selecta-green rounded-3xl flex items-center justify-center mx-auto shadow-2xl animate-bounce">
                <Users className="h-12 w-12 text-white animate-pulse" />
              </div>
              <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-3xl blur-xl animate-pulse mx-auto"></div>
            </div>
            
            {/* Spinner elegante */}
            <div className="relative mb-6">
              <div className="w-16 h-16 border-4 border-slate-200 border-t-selecta-green rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-r-primary rounded-full animate-spin mx-auto animation-delay-150"></div>
            </div>
            
            <h3 className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent mb-3">
              Cargando Personal
            </h3>
            <p className="text-slate-600 text-lg">Preparando la gestión de empleados...</p>
            
            {/* Barra de progreso simulada */}
            <div className="mt-8 w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-selecta-green to-primary rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Elementos decorativos mejorados */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-selecta-green/8 to-primary/8 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-100/30 to-selecta-green/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 left-1/4 w-32 h-32 bg-gradient-to-r from-purple-100/40 to-pink-100/40 rounded-full blur-2xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-40 h-40 bg-gradient-to-l from-yellow-100/30 to-orange-100/30 rounded-full blur-2xl"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 space-y-8">
        {/* Header premium */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start space-x-4 mb-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-selecta-green via-primary to-selecta-green rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <div className="absolute inset-0 w-16 h-16 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-3xl blur-xl"></div>
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-selecta-green via-primary to-selecta-green bg-clip-text text-transparent leading-tight">
                  Gestión de Personal
                </h1>
                <p className="text-slate-600 text-lg font-medium mt-2 max-w-md">
                  Control integral de empleados y administración de recursos humanos
                </p>
              </div>
            </div>
            
            {/* Línea decorativa animada */}
            <div className="flex items-center justify-center lg:justify-start space-x-2 mb-4">
              <div className="w-16 h-1 bg-gradient-to-r from-selecta-green to-primary rounded-full"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <div className="w-8 h-1 bg-gradient-to-r from-primary to-selecta-green rounded-full"></div>
            </div>
            
            {/* Stats mejoradas */}
            <div className="flex items-center justify-center lg:justify-start space-x-6">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg border border-white/30 hover:shadow-xl transition-shadow">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-slate-700">{totalPersonal} empleados</span>
                </div>
              </div>
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg border border-white/30 hover:shadow-xl transition-shadow">
                <div className="flex items-center space-x-2">
                  <DollarSign className="w-4 h-4 text-selecta-green" />
                  <span className="text-sm font-bold text-slate-700">${averageSalary.toLocaleString()} promedio</span>
                </div>
              </div>
            </div>
          </div>

          {/* Botón de agregar mejorado */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="group bg-gradient-to-r from-selecta-green to-primary hover:from-primary hover:to-selecta-green shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 rounded-2xl px-8 py-4 border-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <UserPlus className="h-5 w-5 mr-3 relative z-10" />
                <span className="font-semibold relative z-10">Agregar Personal</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-2xl border-white/30 shadow-2xl rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                  {selectedPersonal ? "Editar Personal" : "Agregar Personal"}
                </DialogTitle>
                <DialogDescription className="text-slate-600 text-base">
                  {selectedPersonal 
                    ? "Modifica los datos del personal seleccionado" 
                    : "Completa la información del nuevo empleado"
                  }
                </DialogDescription>
              </DialogHeader>
              <PersonalForm
                personal={selectedPersonal}
                onSubmit={handlePersonalSubmit}
                onCancel={() => {
                  setIsDialogOpen(false);
                  setSelectedPersonal(null);
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        {getRoleStats().length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {getRoleStats().slice(0, 6).map((stat) => (
              <Card key={stat.role} className="bg-white/70 backdrop-blur-sm border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 rounded-2xl group hover:scale-105">
                <CardContent className="p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                      {stat.count}
                    </div>
                    <p className="text-sm text-slate-600 font-medium truncate">{stat.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filtros premium */}
        <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm border-b border-slate-200/30">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-700 rounded-2xl flex items-center justify-center shadow-lg">
                <Filter className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-800">Filtros de Búsqueda</CardTitle>
                <CardDescription className="text-slate-600">Encuentra empleados de forma rápida y precisa</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-hover:text-selecta-green transition-colors" />
                <Input
                  placeholder="Buscar por nombre o número de cédula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 bg-white/80 border-slate-200/50 rounded-2xl h-12 focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all"
                />
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="bg-white/80 border-slate-200/50 rounded-2xl h-12 shadow-sm hover:shadow-md transition-all">
                  <SelectValue placeholder="Filtrar por rol" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-white/30 rounded-2xl shadow-2xl">
                  <SelectItem value="all" className="rounded-xl">Todos los roles</SelectItem>
                  {ROLES_PERSONAL.map((rol) => (
                    <SelectItem key={rol} value={rol} className="rounded-xl">
                      {rol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabla premium */}
        <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50/50 to-white/50 backdrop-blur-sm border-b border-slate-200/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-selecta-green to-primary rounded-2xl flex items-center justify-center shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-slate-800">
                    Lista de Personal ({filteredPersonal.length})
                  </CardTitle>
                  <CardDescription className="text-slate-600">
                    Personal registrado y activo en el sistema
                  </CardDescription>
                </div>
              </div>
              <div className="hidden md:flex items-center space-x-2 text-sm text-slate-500">
                <Clock className="h-4 w-4" />
                <span>Actualizado {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {filteredPersonal.length === 0 ? (
              <div className="text-center py-16">
                <div className="relative mb-8">
                  <div className="w-24 h-24 bg-gradient-to-r from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                    <Users className="h-12 w-12 text-slate-400" />
                  </div>
                  <div className="absolute inset-0 w-24 h-24 bg-gradient-to-r from-slate-100/50 to-slate-200/50 rounded-3xl blur-xl mx-auto"></div>
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3">
                  {personal.length === 0 ? "No hay personal registrado" : "No se encontraron resultados"}
                </h3>
                <p className="text-slate-600 text-lg max-w-md mx-auto">
                  {personal.length === 0 
                    ? "Comienza agregando el primer empleado a tu equipo de trabajo" 
                    : "Intenta modificar los criterios de búsqueda para encontrar lo que buscas"
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200/40 bg-gradient-to-r from-slate-50/80 to-slate-100/80 hover:from-slate-100/80 hover:to-slate-200/80">
                      <TableHead className="text-slate-800 font-bold text-base py-4">Nombre Completo</TableHead>
                      <TableHead className="text-slate-800 font-bold text-base py-4">Cédula</TableHead>
                      <TableHead className="text-slate-800 font-bold text-base py-4">Rol</TableHead>
                      <TableHead className="text-slate-800 font-bold text-base py-4">Tarifa/Hora</TableHead>
                      <TableHead className="text-right text-slate-800 font-bold text-base py-4">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPersonal.map((person, index) => (
                      <TableRow 
                        key={person.id} 
                        className="border-slate-200/30 hover:bg-gradient-to-r hover:from-selecta-green/5 hover:to-primary/5 transition-all duration-200 group"
                        style={{
                          animationDelay: `${index * 50}ms`
                        }}
                      >
                        <TableCell className="font-semibold text-slate-800 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-selecta-green/20 to-primary/20 rounded-xl flex items-center justify-center">
                              <span className="text-sm font-bold text-selecta-green">
                                {person.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <span>{person.nombre_completo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600 py-4 font-medium">{person.numero_cedula}</TableCell>
                        <TableCell className="py-4">
                          <Badge className={`${getRoleBadgeVariant(person.rol)} border font-semibold px-3 py-1 rounded-xl`}>
                            {person.rol}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-slate-800 py-4">
                          <div className="flex items-center space-x-1">
                            <DollarSign className="h-4 w-4 text-selecta-green" />
                            <span>${Number(person.tarifa_hora).toLocaleString()} COP</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <div className="flex justify-end space-x-2 opacity-70 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/personal/${person.id}`)}
                              className="hover:bg-blue-100 hover:text-blue-700 rounded-xl p-2 transition-all duration-200 hover:scale-105"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPersonal(person);
                                setIsDialogOpen(true);
                              }}
                              className="hover:bg-emerald-100 hover:text-emerald-700 rounded-xl p-2 transition-all duration-200 hover:scale-105"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="hover:bg-red-100 hover:text-red-700 rounded-xl p-2 transition-all duration-200 hover:scale-105"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-white/95 backdrop-blur-2xl border-white/30 shadow-2xl rounded-3xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-2xl font-bold text-slate-800">
                                    ¿Eliminar empleado?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-slate-600 text-base">
                                    Esta acción es irreversible. Se eliminará permanentemente
                                    a <span className="font-semibold">{person.nombre_completo}</span> del sistema.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel className="rounded-2xl border-slate-200 hover:bg-slate-50">
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeletePersonal(person.id)}
                                    className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-2xl shadow-lg hover:shadow-xl transition-all"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer premium */}
        <div className="text-center pt-8">
          <div className="inline-flex items-center justify-center space-x-4 bg-white/60 backdrop-blur-sm rounded-2xl px-6 py-3 shadow-lg border border-white/30">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-600">Sistema actualizado</span>
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-500">
                {new Date().toLocaleTimeString('es-CO', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}