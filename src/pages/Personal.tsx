import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Edit, Trash2, Users, Eye } from "lucide-react";
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
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      "Coordinador": "default",
      "Chef": "secondary",
      "Mesero": "outline",
      "Bartender": "outline",
      "Decorador": "secondary",
      "Técnico de Sonido": "outline",
      "Fotógrafo": "secondary",
      "Otro": "outline"
    };
    return variants[rol] || "outline";
  };

  const totalPersonal = personal.length;
  const totalTarifas = personal.reduce((sum, p) => sum + Number(p.tarifa_hora), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando personal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-selecta-blue">Personal</h1>
          <p className="text-muted-foreground">
            Gestiona el personal de Selecta Eventos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Personal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedPersonal ? "Editar Personal" : "Agregar Personal"}
              </DialogTitle>
              <DialogDescription>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Personal</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalPersonal}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarifa Promedio</CardTitle>
            <span className="text-xs text-muted-foreground">COP/hora</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">
              ${totalPersonal > 0 ? Math.round(totalTarifas / totalPersonal).toLocaleString() : 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roles Activos</CardTitle>
            <Badge variant="outline">{new Set(personal.map(p => p.rol)).size}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              {new Set(personal.map(p => p.rol)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o cédula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por rol" />
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
        </CardContent>
      </Card>

      {/* Personal Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Personal ({filteredPersonal.length})</CardTitle>
          <CardDescription>
            Personal registrado en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPersonal.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {personal.length === 0 
                  ? "No hay personal registrado" 
                  : "No se encontraron resultados"
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Tarifa/Hora</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPersonal.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">
                        {person.nombre_completo}
                      </TableCell>
                      <TableCell>{person.numero_cedula}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(person.rol)}>
                          {person.rol}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        ${Number(person.tarifa_hora).toLocaleString()} COP
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/personal/${person.id}`)}
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
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                ¿Eliminar personal?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente
                                a {person.nombre_completo} del sistema.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeletePersonal(person.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}