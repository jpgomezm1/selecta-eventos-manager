import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
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
import { EventoConPersonal, Personal, EventoFormData } from "@/types/database";

interface EventoFormProps {
  evento?: EventoConPersonal | null;
  personal: Personal[];
  onSubmit: () => void;
  onCancel: () => void;
}

export function EventoForm({ evento, personal, onSubmit, onCancel }: EventoFormProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPersonal, setSelectedPersonal] = useState<string[]>([]);
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
      const personalIds = evento.personal?.map(p => p.id) || [];
      setSelectedPersonal(personalIds);
      form.reset({
        nombre_evento: evento.nombre_evento,
        ubicacion: evento.ubicacion,
        fecha_evento: evento.fecha_evento,
        descripcion: evento.descripcion || "",
        personal_ids: personalIds,
      });
    }
  }, [evento, form]);

  const handlePersonalToggle = (personalId: string, checked: boolean) => {
    let newSelection;
    if (checked) {
      newSelection = [...selectedPersonal, personalId];
    } else {
      newSelection = selectedPersonal.filter(id => id !== personalId);
    }
    setSelectedPersonal(newSelection);
    form.setValue("personal_ids", newSelection);
  };

  const calculateTotalCost = () => {
    return selectedPersonal.reduce((total, personalId) => {
      const person = personal.find(p => p.id === personalId);
      return total + (person ? Number(person.tarifa_hora) : 0);
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

        // Insert new assignments
        if (selectedPersonal.length > 0) {
          const assignments = selectedPersonal.map(personalId => ({
            evento_id: eventoId,
            personal_id: personalId,
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {personal.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={person.id}
                      checked={selectedPersonal.includes(person.id)}
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
                ))}
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