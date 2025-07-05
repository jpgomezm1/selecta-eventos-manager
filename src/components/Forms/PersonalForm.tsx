import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Personal, PersonalFormData, ROLES_PERSONAL } from "@/types/database";
import { User, IdCard, Briefcase, DollarSign } from "lucide-react";

interface PersonalFormProps {
  personal?: Personal | null;
  onSubmit: () => void;
  onCancel: () => void;
}

export function PersonalForm({ personal, onSubmit, onCancel }: PersonalFormProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<PersonalFormData>({
    defaultValues: {
      nombre_completo: personal?.nombre_completo || "",
      numero_cedula: personal?.numero_cedula || "",
      rol: personal?.rol || "Mesero",
      tarifa_hora: personal?.tarifa_hora || 0,
    },
  });

  useEffect(() => {
    if (personal) {
      form.reset({
        nombre_completo: personal.nombre_completo,
        numero_cedula: personal.numero_cedula,
        rol: personal.rol,
        tarifa_hora: personal.tarifa_hora,
      });
    }
  }, [personal, form]);

  const handleSubmit = async (data: PersonalFormData) => {
    setLoading(true);
    try {
      if (personal) {
        // Update existing personal
        const { error } = await supabase
          .from("personal")
          .update({
            nombre_completo: data.nombre_completo,
            numero_cedula: data.numero_cedula,
            rol: data.rol,
            tarifa_hora: data.tarifa_hora,
          })
          .eq("id", personal.id);

        if (error) throw error;

        toast({
          title: "Personal actualizado",
          description: "Los datos han sido actualizados exitosamente",
        });
      } else {
        // Create new personal
        const { error } = await supabase
          .from("personal")
          .insert({
            nombre_completo: data.nombre_completo,
            numero_cedula: data.numero_cedula,
            rol: data.rol,
            tarifa_hora: data.tarifa_hora,
          });

        if (error) {
          if (error.code === "23505") {
            toast({
              title: "Error",
              description: "Ya existe una persona con este número de cédula",
              variant: "destructive",
            });
            return;
          }
          throw error;
        }

        toast({
          title: "Personal creado",
          description: "El personal ha sido agregado exitosamente",
        });
      }

      onSubmit();
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al guardar los datos del personal",
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
          <FormField
            control={form.control}
            name="nombre_completo"
            rules={{ required: "El nombre completo es requerido" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold flex items-center space-x-2">
                  <User className="h-4 w-4 text-selecta-green" />
                  <span>Nombre Completo</span>
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Ej: Juan Pérez García" 
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
            name="numero_cedula"
            rules={{ 
              required: "El número de cédula es requerido",
              pattern: {
                value: /^\d+$/,
                message: "El número de cédula debe contener solo números"
              }
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold flex items-center space-x-2">
                  <IdCard className="h-4 w-4 text-selecta-green" />
                  <span>Número de Cédula</span>
                </FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Ej: 12345678" 
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
            name="rol"
            rules={{ required: "El rol es requerido" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold flex items-center space-x-2">
                  <Briefcase className="h-4 w-4 text-selecta-green" />
                  <span>Rol</span>
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/20 rounded-2xl">
                    {ROLES_PERSONAL.map((rol) => (
                      <SelectItem key={rol} value={rol} className="rounded-lg">
                        {rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tarifa_hora"
            rules={{ 
              required: "La tarifa por hora es requerida",
              min: {
                value: 1,
                message: "La tarifa debe ser mayor a 0"
              }
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold flex items-center space-x-2">
                 <DollarSign className="h-4 w-4 text-selecta-green" />
                 <span>Tarifa por Hora (COP)</span>
               </FormLabel>
               <FormControl>
                 <Input
                   type="number"
                   placeholder="Ej: 25000"
                   {...field}
                   onChange={(e) => field.onChange(Number(e.target.value))}
                   className="bg-white/80 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green"
                 />
               </FormControl>
               <FormMessage />
             </FormItem>
           )}
         />

         <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200/60">
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
               personal ? "Actualizar Personal" : "Crear Personal"
             )}
           </Button>
         </div>
       </form>
     </Form>
   </div>
 );
}