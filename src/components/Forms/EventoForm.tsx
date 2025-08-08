import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, Clock, MapPin, FileText, Users, Calculator, DollarSign, Save, AlertTriangle, Sparkles } from "lucide-react";
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
      "Coordinador": "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-purple-200",
      "Chef": "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-700 border-orange-200",
      "Mesero": "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200",
      "Bartender": "bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200",
      "Decorador": "bg-gradient-to-r from-pink-50 to-pink-100 text-pink-700 border-pink-200",
      "Técnico de Sonido": "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-700 border-indigo-200",
      "Fotógrafo": "bg-gradient-to-r from-yellow-50 to-yellow-100 text-yellow-700 border-yellow-200",
      "Otro": "bg-gradient-to-r from-slate-50 to-slate-100 text-slate-700 border-slate-200"
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
    <div className="space-y-8">
      {/* Header del formulario */}
      <div className="text-center pb-6 border-b border-slate-200/50">
        <div className="w-16 h-16 bg-gradient-to-r from-selecta-green to-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
          <CalendarIcon className="h-8 w-8 text-white" />
        </div>
        <p className="text-slate-600 text-sm">
          {evento ? "Modifica la información del evento" : "Completa los datos del nuevo evento"}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
          {/* Información básica del evento premium */}
          <Card className="bg-gradient-to-r from-slate-50/80 to-white/80 backdrop-blur-sm shadow-xl border-white/30 rounded-3xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-selecta-green/10 to-primary/10 border-b border-slate-200/30">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-selecta-green to-primary rounded-2xl flex items-center justify-center shadow-lg">
                 <CalendarIcon className="h-5 w-5 text-white" />
               </div>
               <CardTitle className="text-xl font-bold text-slate-800">Información del Evento</CardTitle>
             </div>
           </CardHeader>
           <CardContent className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField
                 control={form.control}
                 name="nombre_evento"
                 rules={{ required: "El nombre del evento es requerido" }}
                 render={({ field }) => (
                   <FormItem className="group">
                     <FormLabel className="text-slate-700 font-bold flex items-center space-x-3 text-base mb-3">
                       <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                         <FileText className="h-4 w-4 text-white" />
                       </div>
                       <span>Nombre del Evento</span>
                     </FormLabel>
                     <FormControl>
                       <div className="relative">
                         <Input 
                           placeholder="Ej: Boda de María y Juan" 
                           {...field} 
                           className="bg-white/90 border-slate-200/50 rounded-2xl h-14 pl-4 text-base focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all group-hover:border-blue-300"
                         />
                         <div className="absolute inset-0 bg-gradient-to-r from-selecta-green/5 to-primary/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                       </div>
                     </FormControl>
                     <FormMessage className="text-red-500 text-sm mt-2" />
                   </FormItem>
                 )}
               />

               <FormField
                 control={form.control}
                 name="ubicacion"
                 rules={{ required: "La ubicación es requerida" }}
                 render={({ field }) => (
                   <FormItem className="group">
                     <FormLabel className="text-slate-700 font-bold flex items-center space-x-3 text-base mb-3">
                       <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                         <MapPin className="h-4 w-4 text-white" />
                       </div>
                       <span>Ubicación</span>
                     </FormLabel>
                     <FormControl>
                       <div className="relative">
                         <Input 
                           placeholder="Ej: Salón Los Rosales, Bogotá" 
                           {...field} 
                           className="bg-white/90 border-slate-200/50 rounded-2xl h-14 pl-4 text-base focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all group-hover:border-green-300"
                         />
                         <div className="absolute inset-0 bg-gradient-to-r from-selecta-green/5 to-primary/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                       </div>
                     </FormControl>
                     <FormMessage className="text-red-500 text-sm mt-2" />
                   </FormItem>
                 )}
               />
             </div>

             <div className="mt-6">
               <FormField
                 control={form.control}
                 name="fecha_evento"
                 rules={{ required: "La fecha del evento es requerida" }}
                 render={({ field }) => (
                   <FormItem className="flex flex-col group">
                     <FormLabel className="text-slate-700 font-bold flex items-center space-x-3 text-base mb-3">
                       <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                         <CalendarIcon className="h-4 w-4 text-white" />
                       </div>
                       <span>Fecha del Evento</span>
                     </FormLabel>
                     <Popover>
                       <PopoverTrigger asChild>
                         <FormControl>
                           <Button
                             variant="outline"
                             className={cn(
                               "w-full h-14 pl-4 text-left font-normal bg-white/90 border-slate-200/50 rounded-2xl hover:bg-white shadow-sm hover:shadow-md transition-all group-hover:border-purple-300",
                               !field.value && "text-muted-foreground"
                             )}
                           >
                             {field.value ? (
                               format(new Date(field.value), "PPP")
                             ) : (
                               <span>Selecciona una fecha</span>
                             )}
                             <CalendarIcon className="ml-auto h-5 w-5 opacity-50" />
                           </Button>
                         </FormControl>
                       </PopoverTrigger>
                       <PopoverContent className="w-auto p-0 bg-white/95 backdrop-blur-2xl border-white/20 rounded-3xl shadow-2xl" align="start">
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
                           className="p-4 pointer-events-auto"
                         />
                       </PopoverContent>
                     </Popover>
                     <FormMessage className="text-red-500 text-sm mt-2" />
                   </FormItem>
                 )}
               />
             </div>

             <div className="mt-6">
               <FormField
                 control={form.control}
                 name="descripcion"
                 render={({ field }) => (
                   <FormItem className="group">
                     <FormLabel className="text-slate-700 font-bold flex items-center space-x-3 text-base mb-3">
                       <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                         <FileText className="h-4 w-4 text-white" />
                       </div>
                       <span>Descripción (Opcional)</span>
                     </FormLabel>
                     <FormControl>
                       <Textarea
                         placeholder="Describe los detalles especiales del evento..."
                         className="resize-none bg-white/90 border-slate-200/50 rounded-2xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green min-h-[120px] shadow-sm hover:shadow-md transition-all group-hover:border-orange-300"
                         {...field}
                       />
                     </FormControl>
                     <FormMessage className="text-red-500 text-sm mt-2" />
                   </FormItem>
                 )}
               />
             </div>
           </CardContent>
         </Card>

         {/* Personal Selection Premium */}
         <Card className="bg-white/70 backdrop-blur-xl shadow-2xl border-white/30 rounded-3xl overflow-hidden">
           <CardHeader className="bg-gradient-to-r from-blue-50/50 to-blue-100/50 backdrop-blur-sm border-b border-slate-200/30">
             <div className="flex justify-between items-center">
               <div className="flex items-center space-x-3">
                 <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                   <Users className="h-5 w-5 text-white" />
                 </div>
                 <CardTitle className="text-xl font-bold text-slate-800">Personal Asignado</CardTitle>
               </div>
               <div className="flex items-center gap-3">
                 <Badge className="bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border-blue-200/60 font-semibold px-4 py-2 shadow-sm">
                   <Users className="h-3 w-3 mr-1" />
                   {selectedPersonal.length} seleccionados
                 </Badge>
                 <Badge className="bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200/60 font-semibold px-4 py-2 shadow-sm">
                   <Calculator className="h-3 w-3 mr-1" />
                   ${calculateTotalCost().toLocaleString()}
                 </Badge>
               </div>
             </div>
           </CardHeader>

           <CardContent className="p-6">
             {personal.length === 0 ? (
               <div className="text-center py-12">
                 <div className="relative mb-6">
                   <div className="w-20 h-20 bg-gradient-to-r from-slate-100 to-slate-200 rounded-3xl flex items-center justify-center mx-auto shadow-xl">
                     <Users className="h-10 w-10 text-slate-400" />
                   </div>
                   <div className="absolute inset-0 w-20 h-20 bg-gradient-to-r from-slate-100/50 to-slate-200/50 rounded-3xl blur-xl mx-auto"></div>
                 </div>
                 <h3 className="text-xl font-bold text-slate-800 mb-2">No hay personal disponible</h3>
                 <p className="text-slate-600">Primero debe registrar empleados en el sistema</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 gap-4 max-h-96 overflow-y-auto">
                 {personal.map((person, index) => {
                   const isSelected = selectedPersonal.some(p => p.id === person.id);
                   const selectedPersonData = selectedPersonal.find(p => p.id === person.id);
                   
                   return (
                     <div
                       key={person.id}
                       className={cn(
                         "border-2 rounded-2xl p-5 transition-all duration-300 group",
                         isSelected 
                           ? "border-selecta-green/40 bg-gradient-to-r from-selecta-green/10 to-primary/10 shadow-lg hover:shadow-xl" 
                           : "border-slate-200/60 bg-white/90 hover:bg-slate-50/90 hover:border-slate-300/60 shadow-sm hover:shadow-md"
                       )}
                       style={{
                         animationDelay: `${index * 100}ms`
                       }}
                     >
                       {/* Checkbox y datos básicos */}
                       <div className="flex items-center space-x-4 mb-4">
                         <Checkbox
                           id={person.id}
                           checked={isSelected}
                           onCheckedChange={(checked) => 
                             handlePersonalToggle(person.id, checked as boolean)
                           }
                           className="border-selecta-green/60 data-[state=checked]:bg-selecta-green data-[state=checked]:border-selecta-green w-5 h-5"
                         />
                         
                         <div className="flex-1 min-w-0">
                           <label
                             htmlFor={person.id}
                             className="text-base font-bold cursor-pointer block truncate text-slate-800 group-hover:text-selecta-green transition-colors"
                           >
                             {person.nombre_completo}
                           </label>
                           
                           <div className="flex items-center justify-between mt-3">
                             <Badge className={`${getRoleBadgeVariant(person.rol)} border text-sm font-semibold shadow-sm hover:shadow-md transition-shadow`}>
                               {person.rol}
                             </Badge>
                             
                             <div className="flex items-center space-x-1 bg-gradient-to-r from-slate-50 to-slate-100 px-3 py-2 rounded-xl border border-slate-200/50">
                               <DollarSign className="h-4 w-4 text-selecta-green" />
                               <span className="text-sm font-bold text-slate-700">
                                 ${Number(person.tarifa_hora).toLocaleString()}/h
                               </span>
                             </div>
                           </div>
                         </div>
                       </div>

                       {/* Campos de horario si está seleccionado */}
                       {isSelected && (
                         <div className="space-y-4 pt-4 border-t border-slate-200/60">
                           <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                               <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                                 <Clock className="h-4 w-4 text-selecta-green" />
                                 <span>Hora Inicio</span>
                               </label>
                               <Input
                                 type="time"
                                 value={selectedPersonData?.hora_inicio || ""}
                                 onChange={(e) => updatePersonalHours(person.id, 'hora_inicio', e.target.value)}
                                 className="text-sm bg-white/90 border-slate-200/50 rounded-xl h-12 focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all"
                               />
                             </div>
                             
                             <div className="space-y-2">
                               <label className="text-sm font-bold text-slate-700 flex items-center space-x-2">
                                 <Clock className="h-4 w-4 text-selecta-green" />
                                 <span>Hora Fin</span>
                               </label>
                               <Input
                                 type="time"
                                 value={selectedPersonData?.hora_fin || ""}
                                 onChange={(e) => updatePersonalHours(person.id, 'hora_fin', e.target.value)}
                                 className="text-sm bg-white/90 border-slate-200/50 rounded-xl h-12 focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all"
                               />
                             </div>
                           </div>

                           {/* Mostrar cálculos si hay horas definidas */}
                           {selectedPersonData?.horas_trabajadas && selectedPersonData.horas_trabajadas > 0 && (
                             <div className="bg-gradient-to-r from-emerald-50/80 to-green-50/80 p-4 rounded-2xl border border-emerald-200/60 shadow-sm">
                               <div className="flex justify-between items-center text-sm">
                                 <div className="flex items-center space-x-2">
                                   <Sparkles className="h-4 w-4 text-emerald-600" />
                                   <span className="text-emerald-800 font-bold">
                                     Horas trabajadas: <span className="text-emerald-700">{selectedPersonData.horas_trabajadas}h</span>
                                   </span>
                                 </div>
                                 <div className="bg-white/80 px-3 py-2 rounded-xl border border-emerald-200/50 shadow-sm">
                                   <span className="font-bold text-emerald-700">
                                     ${selectedPersonData.pago_calculado?.toLocaleString() || 0}
                                   </span>
                                 </div>
                               </div>
                               
                               {selectedPersonData.horas_trabajadas > 12 && (
                                 <div className="flex items-center mt-3 text-xs text-amber-700 bg-amber-50/80 px-3 py-2 rounded-xl border border-amber-200/60">
                                   <AlertTriangle className="h-4 w-4 mr-2" />
                                   <span className="font-medium">Más de 12 horas trabajadas - Verificar información</span>
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
           </CardContent>
         </Card>

         {/* Botones de acción premium */}
         <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-8 border-t border-slate-200/50">
           <Button 
             type="button" 
             variant="outline" 
             onClick={onCancel}
             className="flex-1 sm:flex-initial bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 rounded-2xl h-12 px-8 text-slate-700 font-semibold transition-all duration-200 hover:shadow-md"
           >
             Cancelar
           </Button>
           
           <Button 
             type="submit" 
             disabled={loading} 
             className="flex-1 sm:flex-initial group bg-gradient-to-r from-selecta-green to-primary hover:from-primary hover:to-selecta-green shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 rounded-2xl h-12 px-8 border-0 relative overflow-hidden"
           >
             {loading ? (
               <div className="flex items-center justify-center space-x-3">
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                 <span className="font-semibold">Guardando...</span>
               </div>
             ) : (
               <div className="flex items-center justify-center space-x-2 relative z-10">
                 <Save className="h-5 w-5" />
                 <span className="font-semibold">
                   {evento ? "Actualizar Evento" : "Crear Evento"}
                 </span>
               </div>
             )}
             
             {/* Efecto hover */}
             <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
           </Button>
         </div>

         {/* Información adicional */}
         <div className="text-center pt-4">
           <p className="text-xs text-slate-500">
             Los datos del evento serán guardados de forma segura en la base de datos
           </p>
         </div>
       </form>
     </Form>
   </div>
 );
}