import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, Clock, MapPin, FileText, Users, Calculator, DollarSign } from "lucide-react";
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
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Información básica del evento */}
          <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/40">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-selecta-green to-primary rounded-xl flex items-center justify-center">
                <CalendarIcon className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Información del Evento</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre_evento"
                rules={{ required: "El nombre del evento es requerido" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-semibold flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-selecta-green" />
                      <span>Nombre del Evento</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Boda de María y Juan" 
                        {...field} 
                        className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
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
                    <FormLabel className="text-slate-700 font-semibold flex items-center space-x-2">
                      <MapPin className="h-4 w-4 text-selecta-green" />
                      <span>Ubicación</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Salón Los Rosales, Bogotá" 
                        {...field} 
                        className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="mt-4">
              <FormField
                control={form.control}
                name="fecha_evento"
                rules={{ required: "La fecha del evento es requerida" }}
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-slate-700 font-semibold flex items-center space-x-2">
                      <CalendarIcon className="h-4 w-4 text-selecta-green" />
                      <span>Fecha del Evento</span>
                    </FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal bg-white/80 border-slate-200/60 rounded-xl hover:bg-white",
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
                      <PopoverContent className="w-auto p-0 bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl shadow-2xl" align="start">
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
            </div>

            <div className="mt-4">
              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-semibold flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-selecta-green" />
                      <span>Descripción (Opcional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe los detalles del evento..."
                        className="resize-none bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Personal Selection */}
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-1 shadow-lg border border-white/20">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden">
              <div className="p-6 border-b border-slate-200/60">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800">Personal Asignado</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border-blue-200/60 font-medium">
                      {selectedPersonal.length} seleccionados
                    </Badge>
                    <Badge className="bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border-emerald-200/60 font-medium">
                      <Calculator className="h-3 w-3 mr-1" />
                      Total: ${calculateTotalCost().toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {personal.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 font-medium">No hay personal disponible</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                    {personal.map((person) => {
                      const isSelected = selectedPersonal.some(p => p.id === person.id);
                      const selectedPersonData = selectedPersonal.find(p => p.id === person.id);
                      
                      return (
                        <div
                          key={person.id}
                          className={cn(
                            "border-2 rounded-xl p-4 transition-all duration-200",
                            isSelected 
                              ? "border-selecta-green/40 bg-gradient-to-r from-selecta-green/5 to-primary/5 shadow-md" 
                              : "border-slate-200/60 bg-white/80 hover:bg-slate-50/80 hover:border-slate-300/60"
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
                              className="border-selecta-green/60 data-[state=checked]:bg-selecta-green data-[state=checked]:border-selecta-green"
                            />
                            <div className="flex-1 min-w-0">
                              <label
                                htmlFor={person.id}
                                className="text-sm font-semibold cursor-pointer block truncate text-slate-800"
                              >
                                {person.nombre_completo}
                              </label>
                              <div className="flex items-center justify-between mt-2">
                                <Badge className={`${getRoleBadgeVariant(person.rol)} border text-xs font-medium`}>
                                  {person.rol}
                                </Badge>
                                <span className="text-xs font-semibold text-slate-600 bg-slate-100/80 px-2 py-1 rounded-lg">
                                  <DollarSign className="h-3 w-3 inline mr-1" />
                                  ${Number(person.tarifa_hora).toLocaleString()}/h
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Campos de horario si está seleccionado */}
                          {isSelected && (
                            <div className="space-y-3 pt-3 border-t border-slate-200/60">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-xs font-semibold text-slate-700 mb-2 block">
                                    <Clock className="h-3 w-3 inline mr-1 text-selecta-green" />
                                    Hora Inicio
                                  </label>
                                  <Input
                                    type="time"
                                    value={selectedPersonData?.hora_inicio || ""}
                                    onChange={(e) => updatePersonalHours(person.id, 'hora_inicio', e.target.value)}
                                    className="text-sm bg-white/80 border-slate-200/60 rounded-lg focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-semibold text-slate-700 mb-2 block">
                                    <Clock className="h-3 w-3 inline mr-1 text-selecta-green" />
                                    Hora Fin
                                  </label>
                                  <Input
                                    type="time"
                                    value={selectedPersonData?.hora_fin || ""}
                                    onChange={(e) => updatePersonalHours(person.id, 'hora_fin', e.target.value)}
                                    className="text-sm bg-white/80 border-slate-200/60 rounded-lg focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                                  />
                                </div>
                              </div>

                              {/* Mostrar cálculos si hay horas definidas */}
                              {selectedPersonData?.horas_trabajadas && selectedPersonData.horas_trabajadas > 0 && (
                                <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-3 rounded-xl border border-emerald-200/60">
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="text-emerald-800 font-medium">
                                      Horas trabajadas: <strong>{selectedPersonData.horas_trabajadas}h</strong>
                                    </span>
                                    <span className="font-bold text-emerald-700 bg-white/80 px-2 py-1 rounded-lg">
                                      ${selectedPersonData.pago_calculado?.toLocaleString() || 0}
                                    </span>
                                  </div>
                                  {selectedPersonData.horas_trabajadas > 12 && (
                                    <div className="flex items-center mt-2 text-xs text-amber-700 bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-200/60">
                                      <span className="mr-1">⚠️</span>
                                      Más de 12 horas trabajadas - Verificar información
                                    </div>
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
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200/60">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onCancel}
              className="rounded-xl border-slate-200/60 hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="bg-gradient-to-r from-selecta-green to-primary hover:shadow-lg hover:scale-105 transition-all duration-200 rounded-xl px-6"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Guardando...</span>
                </div>
              ) : (
                evento ? "Actualizar Evento" : "Crear Evento"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}