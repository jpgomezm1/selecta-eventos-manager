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
import { User, IdCard, Briefcase, DollarSign, Save, X } from "lucide-react";

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
    },});

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
      <div className="space-y-8">
        {/* Header del formulario */}
        <div className="text-center pb-6 border-b border-slate-200/50">
          <div className="w-16 h-16 bg-gradient-to-r from-selecta-green to-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <User className="h-8 w-8 text-white" />
          </div>
          <p className="text-slate-600 text-sm">
            {personal ? "Modifica la información del empleado" : "Ingresa los datos del nuevo empleado"}
          </p>
        </div>
   
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-7">
            {/* Nombre Completo */}
            <FormField
              control={form.control}
              name="nombre_completo"
              rules={{ required: "El nombre completo es requerido" }}
              render={({ field }) => (
                <FormItem className="group">
                  <FormLabel className="text-slate-700 font-bold flex items-center space-x-3 text-base mb-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <span>Nombre Completo</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Ej: Juan Pérez García" 
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
   
            {/* Número de Cédula */}
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
                <FormItem className="group">
                  <FormLabel className="text-slate-700 font-bold flex items-center space-x-3 text-base mb-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <IdCard className="h-4 w-4 text-white" />
                    </div>
                    <span>Número de Cédula</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Ej: 12345678" 
                        {...field} 
                        className="bg-white/90 border-slate-200/50 rounded-2xl h-14 pl-4 text-base focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all group-hover:border-emerald-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-selecta-green/5 to-primary/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-500 text-sm mt-2" />
                </FormItem>
              )}
            />
   
            {/* Rol */}
            <FormField
              control={form.control}
              name="rol"
              rules={{ required: "El rol es requerido" }}
              render={({ field }) => (
                <FormItem className="group">
                  <FormLabel className="text-slate-700 font-bold flex items-center space-x-3 text-base mb-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <Briefcase className="h-4 w-4 text-white" />
                    </div>
                    <span>Rol o Cargo</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/90 border-slate-200/50 rounded-2xl h-14 text-base focus:ring-2 focus:ring-selecta-green/20 shadow-sm hover:shadow-md transition-all group-hover:border-purple-300">
                        <SelectValue placeholder="Selecciona el rol del empleado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white/95 backdrop-blur-2xl border-white/30 rounded-2xl shadow-2xl">
                      {ROLES_PERSONAL.map((rol) => (
                        <SelectItem key={rol} value={rol} className="rounded-xl text-base py-3 hover:bg-gradient-to-r hover:from-selecta-green/10 hover:to-primary/10">
                          {rol}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-red-500 text-sm mt-2" />
                </FormItem>
              )}
            />
   
            {/* Tarifa por Hora */}
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
                <FormItem className="group">
                  <FormLabel className="text-slate-700 font-bold flex items-center space-x-3 text-base mb-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                      <DollarSign className="h-4 w-4 text-white" />
                    </div>
                    <span>Tarifa por Hora (COP)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 group-hover:text-orange-500 transition-colors" />
                      <Input
                        type="number"
                        placeholder="Ej: 25000"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        className="bg-white/90 border-slate-200/50 rounded-2xl h-14 pl-12 pr-4 text-base focus:ring-2 focus:ring-selecta-green/20 focus:border-selecta-green shadow-sm hover:shadow-md transition-all group-hover:border-orange-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-selecta-green/5 to-primary/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-500 text-sm mt-2" />
                  <p className="text-sm text-slate-500 mt-2 ml-11">
                    Ingresa el valor en pesos colombianos
                  </p>
                </FormItem>
              )}
            />
   
            {/* Botones de acción mejorados */}
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-8 border-t border-slate-200/50">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
                className="flex-1 sm:flex-initial bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 rounded-2xl h-12 px-8 text-slate-700 font-semibold transition-all duration-200 hover:shadow-md"
              >
                <X className="h-4 w-4 mr-2" />
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
                    <Save className="h-4 w-4" />
                    <span className="font-semibold">
                      {personal ? "Actualizar Personal" : "Crear Personal"}
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
                La información será guardada de forma segura en la base de datos
              </p>
            </div>
          </form>
        </Form>
      </div>
    );
   }