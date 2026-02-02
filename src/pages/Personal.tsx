import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Edit, Trash2, Users, Eye, UserPlus, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonalForm } from "@/components/Forms/PersonalForm";
import { CargaMasivaPersonal } from "@/components/Forms/CargaMasivaPersonal";
import { useToast } from "@/hooks/use-toast";
import { Personal, ROLES_PERSONAL } from "@/types/database";

const ITEMS_PER_PAGE = 10;

export default function PersonalPage() {
  const navigate = useNavigate();
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [filteredPersonal, setFilteredPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [selectedPersonal, setSelectedPersonal] = useState<Personal | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCargaMasivaOpen, setIsCargaMasivaOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    fetchPersonal();
  }, []);

  useEffect(() => {
    filterPersonal();
    setCurrentPage(1);
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
      "Coordinador": "bg-purple-50 text-purple-700",
      "Chef": "bg-orange-50 text-orange-700",
      "Mesero": "bg-blue-50 text-blue-700",
      "Bartender": "bg-emerald-50 text-emerald-700",
      "Decorador": "bg-pink-50 text-pink-700",
      "Técnico de Sonido": "bg-indigo-50 text-indigo-700",
      "Fotógrafo": "bg-amber-50 text-amber-700",
      "Otro": "bg-slate-100 text-slate-700"
    };
    return variants[rol] || variants["Otro"];
  };

  const totalPersonal = personal.length;

  // Pagination
  const totalPages = Math.ceil(filteredPersonal.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedPersonal = filteredPersonal.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-selecta-green rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500">Cargando personal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Personal</h1>
          <p className="text-slate-500 mt-1">
            {totalPersonal} empleados registrados
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsCargaMasivaOpen(true)}
            variant="outline"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-selecta-green hover:bg-selecta-green/90">
                <UserPlus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {selectedPersonal ? "Editar Personal" : "Agregar Personal"}
                </DialogTitle>
                <DialogDescription>
                  {selectedPersonal
                    ? "Modifica los datos del empleado"
                    : "Ingresa la información del nuevo empleado"
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
      </div>

      {/* Tabla con filtros integrados */}
      <Card>
        {/* Filtros */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o cédula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-48 h-9">
                <SelectValue placeholder="Todos los roles" />
              </SelectTrigger>
              <SelectContent>
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

        {/* Tabla */}
        {filteredPersonal.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-slate-900 font-medium">
              {personal.length === 0 ? "No hay personal registrado" : "Sin resultados"}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {personal.length === 0
                ? "Agrega el primer empleado para comenzar"
                : "Intenta con otros criterios de búsqueda"
              }
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-medium">Nombre</TableHead>
                  <TableHead className="font-medium">Cédula</TableHead>
                  <TableHead className="font-medium">Rol</TableHead>
                  <TableHead className="font-medium">Tarifa</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPersonal.map((person) => (
                  <TableRow key={person.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-selecta-green/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-selecta-green">
                            {person.nombre_completo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-slate-900">{person.nombre_completo}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">{person.numero_cedula}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getRoleBadgeVariant(person.rol)}>
                        {person.rol}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium text-slate-900">
                          ${Number(person.tarifa).toLocaleString()}
                        </span>
                        <span className="text-slate-500 text-xs ml-1">
                          {person.modalidad_cobro === 'por_hora' && '/ hora'}
                          {person.modalidad_cobro === 'jornada_9h' && '/ 9h'}
                          {person.modalidad_cobro === 'jornada_10h' && '/ 10h'}
                          {person.modalidad_cobro === 'jornada_hasta_10h' && '/ hasta 10h'}
                          {person.modalidad_cobro === 'jornada_nocturna' && '/ nocturna'}
                          {person.modalidad_cobro === 'por_evento' && '/ evento'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/personal/${person.id}`)}
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPersonal(person);
                            setIsDialogOpen(true);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4 text-slate-500" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4 text-slate-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente
                                a <span className="font-medium">{person.nombre_completo}</span> del sistema.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePersonal(person.id)}
                                className="bg-red-600 hover:bg-red-700"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  {startIndex + 1}-{Math.min(endIndex, filteredPersonal.length)} de {filteredPersonal.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      if (totalPages <= 5) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                      return false;
                    })
                    .map((page, index, array) => (
                      <span key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-1 text-slate-400">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "ghost"}
                          size="sm"
                          onClick={() => goToPage(page)}
                          className={`h-8 w-8 p-0 ${
                            currentPage === page ? "bg-selecta-green hover:bg-selecta-green/90" : ""
                          }`}
                        >
                          {page}
                        </Button>
                      </span>
                    ))
                  }

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Diálogo de carga masiva */}
      <CargaMasivaPersonal
        isOpen={isCargaMasivaOpen}
        onClose={() => setIsCargaMasivaOpen(false)}
        onSuccess={() => {
          fetchPersonal();
          setIsCargaMasivaOpen(false);
        }}
      />
    </div>
  );
}