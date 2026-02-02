import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, MapPin, FileText, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { EventoConPersonal, EventoFormData } from "@/types/database";

interface EventoFormProps {
  evento?: EventoConPersonal | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export function EventoForm({ evento, onSubmit, onCancel }: EventoFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<EventoFormData>({
    defaultValues: {
      nombre_evento: evento?.nombre_evento || "",
      ubicacion: evento?.ubicacion || "",
      fecha_evento: evento?.fecha_evento || "",
      descripcion: evento?.descripcion || "",
    },
  });

  useEffect(() => {
    if (evento) {
      form.reset({
        nombre_evento: evento.nombre_evento,
        ubicacion: evento.ubicacion,
        fecha_evento: evento.fecha_evento,
        descripcion: evento.descripcion || "",
      });
    }
  }, [evento, form]);

  const handleSubmit = async (data: EventoFormData) => {
    setLoading(true);
    try {
      if (evento) {
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

        toast({
          title: "Evento actualizado",
          description: "El evento ha sido actualizado exitosamente",
        });
      } else {
        const { error } = await supabase
          .from("eventos")
          .insert({
            nombre_evento: data.nombre_evento,
            ubicacion: data.ubicacion,
            fecha_evento: data.fecha_evento,
            descripcion: data.descripcion,
          });

        if (error) throw error;

        toast({
          title: "Evento creado",
          description: "El evento ha sido creado exitosamente",
        });
      }

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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b border-slate-200">
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <CalendarIcon className="h-6 w-6 text-slate-600" />
        </div>
        <p className="text-slate-500 text-sm">
          {evento ? "Modifica la información del evento" : "Completa los datos del nuevo evento"}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="nombre_evento"
              rules={{ required: "El nombre del evento es requerido" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-slate-400" />
                    Nombre del Evento
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Boda de María y Juan"
                      {...field}
                      className="h-10"
                    />
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
                  <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    Ubicación
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ej: Salón Los Rosales, Bogotá"
                      {...field}
                      className="h-10"
                    />
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
                <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-slate-400" />
                  Fecha del Evento
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-10 pl-3 text-left font-normal",
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
                      className="p-3 pointer-events-auto"
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
                <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-400" />
                  Descripción (Opcional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe los detalles especiales del evento..."
                    className="resize-none min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  <span>{evento ? "Actualizar Evento" : "Crear Evento"}</span>
                </div>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
