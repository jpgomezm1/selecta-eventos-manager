import { useState, useEffect } from "react";
import { Plus, Calendar, MapPin, Edit, Trash2, Users } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { EventoForm } from "@/components/Forms/EventoForm";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal, Personal } from "@/types/database";

export default function EventosPage() {
  const [eventos, setEventos] = useState<EventoConPersonal[]>([]);
  const [personal, setPersonal] = useState<Personal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvento, setSelectedEvento] = useState<EventoConPersonal | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEventos();
    fetchPersonal();
  }, []);

  const fetchPersonal = async () => {
    try {
      const { data, error } = await supabase
        .from("personal")
        .select("*")
        .order("nombre_completo");

      if (error) throw error;
      setPersonal(data as Personal[] || []);
    } catch (error) {
      console.error("Error fetching personal:", error);
    }
  };

  const fetchEventos = async () => {
    try {
      const { data, error } = await supabase
        .from("eventos")
        .select(`
          *,
          evento_personal (
            personal (*)
          )
        `)
        .order("fecha_evento", { ascending: false });

      if (error) throw error;

      const eventosConPersonal: EventoConPersonal[] = (data || []).map((evento) => {
        const personalAsignado = evento.evento_personal?.map((ep: any) => ep.personal) || [];
        const costoTotal = personalAsignado.reduce((sum: number, p: Personal) => sum + Number(p.tarifa_hora), 0);
        
        return {
          ...evento,
          personal: personalAsignado,
          costo_total: costoTotal,
        };
      });

      setEventos(eventosConPersonal);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar los eventos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEventoSubmit = () => {
    fetchEventos();
    setIsDialogOpen(false);
    setSelectedEvento(null);
  };

  const handleDeleteEvento = async (id: string) => {
    try {
      const { error } = await supabase
        .from("eventos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Evento eliminado",
        description: "El evento ha sido eliminado exitosamente",
      });
      fetchEventos();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar el evento",
        variant: "destructive",
      });
    }
  };

  const getEventStatus = (fechaEvento: string) => {
    const eventDate = new Date(fechaEvento);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    eventDate.setHours(0, 0, 0, 0);

    if (eventDate < today) return { status: "Pasado", variant: "secondary" as const };
    if (eventDate.getTime() === today.getTime()) return { status: "Hoy", variant: "default" as const };
    return { status: "Próximo", variant: "outline" as const };
  };

  const totalEventos = eventos.length;
  const eventosProximos = eventos.filter(e => new Date(e.fecha_evento) >= new Date()).length;
  const costoPromedioEventos = eventos.length > 0 
    ? Math.round(eventos.reduce((sum, e) => sum + (e.costo_total || 0), 0) / eventos.length)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando eventos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-selecta-blue">Eventos</h1>
          <p className="text-muted-foreground">
            Gestiona los eventos de Selecta Eventos
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Crear Evento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedEvento ? "Editar Evento" : "Crear Evento"}
              </DialogTitle>
              <DialogDescription>
                {selectedEvento 
                  ? "Modifica los datos del evento" 
                  : "Completa la información del nuevo evento"
                }
              </DialogDescription>
            </DialogHeader>
            <EventoForm
              evento={selectedEvento}
              personal={personal}
              onSubmit={handleEventoSubmit}
              onCancel={() => {
                setIsDialogOpen(false);
                setSelectedEvento(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalEventos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos Eventos</CardTitle>
            <Badge variant="outline">{eventosProximos}</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-secondary">{eventosProximos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Promedio</CardTitle>
            <span className="text-xs text-muted-foreground">COP</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">
              ${costoPromedioEventos.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Lista de Eventos ({eventos.length})</h2>
        </div>

        {eventos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay eventos registrados</h3>
              <p className="text-muted-foreground text-center mb-4">
                Comienza creando tu primer evento
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Evento
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {eventos.map((evento) => {
              const { status, variant } = getEventStatus(evento.fecha_evento);
              return (
                <Card key={evento.id} className="hover:shadow-soft transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-2">
                          {evento.nombre_evento}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant={variant}>{status}</Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      {format(new Date(evento.fecha_evento), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: es })}
                    </div>
                    
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span className="line-clamp-1">{evento.ubicacion}</span>
                    </div>

                    {evento.descripcion && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {evento.descripcion}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center text-muted-foreground">
                        <Users className="h-4 w-4 mr-1" />
                        <span>{evento.personal?.length || 0} personas</span>
                      </div>
                      <div className="font-semibold text-primary">
                        ${(evento.costo_total || 0).toLocaleString()} COP
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedEvento(evento);
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
                            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente
                              el evento "{evento.nombre_evento}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteEvento(evento.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}