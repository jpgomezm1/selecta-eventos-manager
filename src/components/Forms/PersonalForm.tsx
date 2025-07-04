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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nombre_completo"
          rules={{ required: "El nombre completo es requerido" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre Completo</FormLabel>
              <FormControl>
                <Input placeholder="Ej: Juan Pérez García" {...field} />
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
              <FormLabel>Número de Cédula</FormLabel>
              <FormControl>
                <Input placeholder="Ej: 12345678" {...field} />
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
              <FormLabel>Rol</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ROLES_PERSONAL.map((rol) => (
                    <SelectItem key={rol} value={rol}>
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
              <FormLabel>Tarifa por Hora (COP)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Ej: 25000"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
            {loading ? "Guardando..." : personal ? "Actualizar" : "Crear"}
          </Button>
        </div>
      </form>
    </Form>
  );
}