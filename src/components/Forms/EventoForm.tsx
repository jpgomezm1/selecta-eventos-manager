import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal, Personal, EventoFormData, PersonalAsignado } from "@/types/database";

interface EventoFormProps {
  evento?: EventoConPersonal | null;
  personal: Personal[];
  onSubmit: () => void;
  onCancel: () => void;
}

export function EventoForm({ evento, personal, onSubmit, onCancel }: EventoFormProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPersonal, setSelectedPersonal] = useState<PersonalAsignado[]>([]);
  const { toast } = useToast();

  const form = useForm<EventoFormData>({
    defaultValues: {
      nombre_evento: evento?.nombre_evento || "",
      ubicacion: evento?.ubicacion || "",
      fecha_evento: evento?.fecha_evento || "",
      descripcion: evento?.descripcion || "",
      personal_ids: [],
    },
  });

  useEffect(() => {
    if (evento) {
      const personalAsignado: PersonalAsignado[] = evento.personal?.map(p => ({
        ...p,
        hora_inicio: p.hora_inicio || "",
        hora_fin: p.hora_fin || "",
        horas_trabajadas: p.horas_trabajadas || 0,
        pago_calculado: p.pago_calculado || 0,
        evento_personal_id: p.evento_personal_id || "",
      })) || [];
      
      setSelectedPersonal(personalAsignado);
      form.reset({
        nombre_evento: evento.nombre_evento,
        ubicacion: evento.ubicacion,
        fecha_evento: evento.fecha_evento,
        descripcion: evento.descripcion || "",
        personal_ids: personalAsignado.map(p => p.id),
      });
    }
  }, [evento, form]);

  const handlePersonalToggle = (personalId: string, checked: boolean) => {
    if (checked) {
      const person = personal.find(p => p.id === personalId);
      if (person) {
        const newPersonalAsignado: PersonalAsignado = {
          ...person,
          hora_inicio: "",
          hora_fin: "",
          horas_trabajadas: 0,
          pago_calculado: 0,
          evento_personal_id: "",
        };
        setSelectedPersonal([...selectedPersonal, newPersonalAsignado]);
        form.setValue("personal_ids", [...selectedPersonal.map(p => p.id), personalId]);
      }
    } else {
      const newSelection = selectedPersonal.filter(p => p.id !== personalId);
      setSelectedPersonal(newSelection);
      form.setValue("personal_ids", newSelection.map(p => p.id));
    }
  };

  const updatePersonalHours = (personalId: string, field: 'hora_inicio' | 'hora_fin', value: string) => {
    const updatedPersonal = selectedPersonal.map(person => {
      if (person.id === personalId) {
        const updatedPerson = { ...person, [field]: value };
        
        // Calcular horas trabajadas si ambos campos están llenos
        if (updatedPerson.hora_inicio && updatedPerson.hora_fin) {
          const inicio = new Date(`2000-01-01T${updatedPerson.hora_inicio}`);
          const fin = new Date(`2000-01-01T${updatedPerson.hora_fin}`);
          
          // Manejar casos donde el trabajo cruza medianoche
          if (fin < inicio) {
            fin.setDate(fin.getDate() + 1);
          }
          
          const horas = (fin.getTime() - inicio.getTime()) / (1000 * 60 * 60);
          updatedPerson.horas_trabajadas = Math.round(horas * 10) / 10; // Redondear a 1 decimal
          updatedPerson.pago_calculado = horas * Number(person.tarifa_hora);
        }
        
        return updatedPerson;
      }
      return person;
    });
    
    setSelectedPersonal(updatedPersonal);
  };

  const calculateTotalCost = () => {
    return selectedPersonal.reduce((total, person) => {
      return total + (person.pago_calculado || Number(person.tarifa_hora));
    }, 0);
  };

  const handleSubmit = async (data: EventoFormData) => {
    setLoading(true);
    try {
      let eventoId = evento?.id;

      if (evento) {
        // Update existing evento
        const { error } = await supabase
          .from("eventos")
          .update({
            nombre_evento: data.nombre_evento,
            ubicacion: data.ubicacion,
            fecha_evento: data.fecha_evento,
            descripcion: data.descripcion,
          })
          .eq("id", evento.id);

        if (error) throw error;
      } else {
        // Create new evento
        const { data: newEvento, error } = await supabase
          .from("eventos")
          .insert({
            nombre_evento: data.nombre_evento,
            ubicacion: data.ubicacion,
            fecha_evento: data.fecha_evento,
            descripcion: data.descripcion,
          })
          .select()
          .single();

        if (error) throw error;
        eventoId = newEvento.id;
      }

      // Update personal assignments
      if (eventoId) {
        // Delete existing assignments
        await supabase
          .from("evento_personal")
          .delete()
          .eq("evento_id", eventoId);

        // Insert new assignments with hours data
        if (selectedPersonal.length > 0) {
          const assignments = selectedPersonal.map(person => ({
            evento_id: eventoId,
            personal_id: person.id,
            hora_inicio: person.hora_inicio || null,
            hora_fin: person.hora_fin || null,
            horas_trabajadas: person.horas_trabajadas || null,
            pago_calculado: person.pago_calculado || null,
          }));

          const { error: assignmentError } = await supabase
            .from("evento_personal")
            .insert(assignments);

          if (assignmentError) throw assignmentError;
        }
      }

      toast({
        title: evento ? "Evento actualizado" : "Evento creado",
        description: evento 
          ? "El evento ha sido actualizado exitosamente"
          : "El evento ha sido creado exitosamente",
      });

      onSubmit();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al guardar el evento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nombre_evento"
            rules={{ required: "El nombre del evento es requerido" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Evento</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Boda de María y Juan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="ubicacion"
            rules={{ required: "La ubicación es requerida" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ubicación</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: Salón Los Rosales, Bogotá" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="fecha_evento"
          rules={{ required: "La fecha del evento es requerida" }}
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Fecha del Evento</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(new Date(field.value), "PPP")
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value ? new Date(field.value) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        field.onChange(format(date, "yyyy-MM-dd"));
                      }
                    }}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="descripcion"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción (Opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe los detalles del evento..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Personal Selection */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Personal Asignado</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {selectedPersonal.length} seleccionados
                </Badge>
                <Badge variant="secondary">
                  Total: ${calculateTotalCost().toLocaleString()} COP
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {personal.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No hay personal disponible
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                {personal.map((person) => {
                  const isSelected = selectedPersonal.some(p => p.id === person.id);
                  const selectedPersonData = selectedPersonal.find(p => p.id === person.id);
                  
                  return (
                    <div
                      key={person.id}
                      className={cn(
                        "border rounded-lg p-4 transition-all duration-200",
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                      )}
                    >
                      {/* Checkbox y datos básicos */}
                      <div className="flex items-center space-x-3 mb-3">
                        <Checkbox
                          id={person.id}
                          checked={isSelected}
                          onCheckedChange={(checked) => 
                            handlePersonalToggle(person.id, checked as boolean)
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={person.id}
                            className="text-sm font-medium cursor-pointer block truncate"
                          >
                            {person.nombre_completo}
                          </label>
                          <div className="flex items-center justify-between mt-1">
                            <Badge variant="outline" className="text-xs">
                              {person.rol}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ${Number(person.tarifa_hora).toLocaleString()}/h
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Campos de horario si está seleccionado */}
                      {isSelected && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                <Clock className="h-3 w-3 inline mr-1" />
                                Hora Inicio
                              </label>
                              <Input
                                type="time"
                                value={selectedPersonData?.hora_inicio || ""}
                                onChange={(e) => updatePersonalHours(person.id, 'hora_inicio', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                <Clock className="h-3 w-3 inline mr-1" />
                                Hora Fin
                              </label>
                              <Input
                                type="time"
                                value={selectedPersonData?.hora_fin || ""}
                                onChange={(e) => updatePersonalHours(person.id, 'hora_fin', e.target.value)}
                                className="text-sm"
                              />
                            </div>
                          </div>

                          {/* Mostrar cálculos si hay horas definidas */}
                          {selectedPersonData?.horas_trabajadas && selectedPersonData.horas_trabajadas > 0 && (
                            <div className="bg-muted/30 p-3 rounded-md">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">
                                  Horas trabajadas: <strong>{selectedPersonData.horas_trabajadas}h</strong>
                                </span>
                                <span className="font-semibold text-primary">
                                  ${selectedPersonData.pago_calculado?.toLocaleString() || 0} COP
                                </span>
                              </div>
                              {selectedPersonData.horas_trabajadas > 12 && (
                                <p className="text-xs text-amber-600 mt-1">
                                  ⚠️ Más de 12 horas trabajadas
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
            {loading ? "Guardando..." : evento ? "Actualizar Evento" : "Crear Evento"}
          </Button>
        </div>
      </form>
    </Form>
  );
}