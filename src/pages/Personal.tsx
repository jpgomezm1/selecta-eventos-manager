import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Edit, Trash2, Users, Eye, UserPlus, Award, DollarSign } from "lucide-react";
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
      "Coordinador": "bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-200/60",
      "Chef": "bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-200/60",
      "Mesero": "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-200/60",
      "Bartender": "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border-emerald-200/60",
      "Decorador": "bg-gradient-to-r from-pink-100 to-pink-200 text-pink-800 border-pink-200/60",
      "Técnico de Sonido": "bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-800 border-indigo-200/60",
      "Fotógrafo": "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-200/60",
      "Otro": "bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 border-slate-200/60"
    };
    return variants[rol] || variants["Otro"];
  };

  const totalPersonal = personal.length;

  if (loading) {
    return (
      <div className="min-h-screen relative">
        {/* Background decorativo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-selecta-green/3 to-primary/3 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-slate-100/50 to-selecta-green/5 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>
        </div>
        
        <div className="relative z-10 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-selecta-green to-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl animate-pulse">
              <Users className="h-8 w-8 text-white" />
            </div>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-selecta-green mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Cargando personal...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Background decorativo sutil */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-selecta-green/3 to-primary/3 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-slate-100/50 to-selecta-green/5 rounded-full blur-3xl transform -translate-x-1/3 translate-y-1/3"></div>
      </div>

      <div className="relative z-10 space-y-8">
        {/* Header mejorado */}
        <div className="flex items-center justify-between">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gradient-primary rounded-2xl flex items-center justify-center shadow-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                  Gestión de Personal
                </h1>
                <p className="text-slate-600 text-lg font-medium mt-1">
                  Administración de empleados y roles
                </p>
              </div>
            </div>
            
            {/* Línea decorativa */}
            <div className="w-32 h-1 bg-gradient-to-r from-selecta-green to-primary rounded-full mx-auto lg:mx-0 mb-2"></div>
            
            {/* Indicador de estado */}
            <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm border border-slate-200/60">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-slate-700">{totalPersonal} empleados activos</span>
            </div>
          </div>

          {/* Botón de agregar personal */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-lg hover:scale-105 transition-all duration-200 rounded-xl px-6 py-3 shadow-md">
                <UserPlus className="h-5 w-5 mr-2" />
                Agregar Personal
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-selecta-green to-primary bg-clip-text text-transparent">
                  {selectedPersonal ? "Editar Personal" : "Agregar Personal"}
                </DialogTitle>
                <DialogDescription className="text-slate-600">
                  {selectedPersonal 
                    ? "Modifica los datos del personal" 
                    : "Completa la información del nuevo personal"
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

        {/* Filtros con glassmorphism */}
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-slate-500 to-slate-600 rounded-xl flex items-center justify-center">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Filtros de Búsqueda</h3>
                <p className="text-sm text-slate-600">Encuentra personal específico</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar por nombre o cédula..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                  />
                </div>
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-full sm:w-48 bg-white/80 border-slate-200/60 rounded-xl">
                  <SelectValue placeholder="Filtrar por rol" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl">
                  <SelectItem value="all">Todos los roles</SelectItem>
                  {ROLES_PERSONAL.map((rol) => (
                    <SelectItem key={rol} value={rol}>
                      {rol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Personal Table con glassmorphism */}
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-1 shadow-xl border border-white/20">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-slate-200/60">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-selecta-green to-primary rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Lista de Personal ({filteredPersonal.length})</h3>
                  <p className="text-sm text-slate-600">Personal registrado en el sistema</p>
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {filteredPersonal.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Users className="h-10 w-10 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">
                    {personal.length === 0 ? "No hay personal registrado" : "No se encontraron resultados"}
                  </h3>
                  <p className="text-slate-600 max-w-sm mx-auto">
                    {personal.length === 0 
                      ? "Comienza agregando el primer empleado al sistema" 
                      : "Intenta ajustar los filtros de búsqueda"
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-200/60 bg-gradient-to-r from-slate-50 to-slate-100/80 hover:from-slate-100 hover:to-slate-200/80">
                        <TableHead className="text-slate-800 font-bold">Nombre</TableHead>
                        <TableHead className="text-slate-800 font-bold">Cédula</TableHead>
                        <TableHead className="text-slate-800 font-bold">Rol</TableHead>
                        <TableHead className="text-slate-800 font-bold">Tarifa/Hora</TableHead>
                        <TableHead className="text-right text-slate-800 font-bold">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPersonal.map((person) => (
                        <TableRow key={person.id} className="border-slate-200/40 hover:bg-slate-50/50 transition-colors">
                          <TableCell className="font-medium text-slate-800">
                            {person.nombre_completo}
                          </TableCell>
                          <TableCell className="text-slate-600">{person.numero_cedula}</TableCell>
                          <TableCell>
                            <Badge className={`${getRoleBadgeVariant(person.rol)} border font-medium`}>
                              {person.rol}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-800">
                            ${Number(person.tarifa_hora).toLocaleString()} COP
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/personal/${person.id}`)}
                                className="hover:bg-blue-50 hover:text-blue-700 rounded-lg"
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
                                className="hover:bg-emerald-50 hover:text-emerald-700 rounded-lg"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="hover:bg-red-50 hover:text-red-700 rounded-lg"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-white/95 backdrop-blur-xl border-white/20 shadow-2xl rounded-3xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-xl font-bold text-slate-800">
                                      ¿Eliminar personal?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-slate-600">
                                      Esta acción no se puede deshacer. Se eliminará permanentemente
                                      a {person.nombre_completo} del sistema.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeletePersonal(person.id)}
                                      className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl"
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
            </div>
          </div>
        </div>

        {/* Footer decorativo sutil */}
        <div className="text-center pt-8">
          <div className="inline-flex items-center space-x-2 text-sm text-slate-400">
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <span>Última actualización: {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}