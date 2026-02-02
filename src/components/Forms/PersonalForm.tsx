import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Personal, PersonalFormData, ROLES_PERSONAL, MODALIDADES_COBRO } from "@/types/database";
import { getTarifaHelpText } from "@/lib/calcularPagoPersonal";
import { User, IdCard, Briefcase, DollarSign, Save, X, Clock } from "lucide-react";

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
      tarifa: personal?.tarifa || 0,
      modalidad_cobro: personal?.modalidad_cobro || "por_hora",
      tarifa_hora_extra: personal?.tarifa_hora_extra || undefined,
    },
  });

  const modalidadCobro = form.watch("modalidad_cobro");

  useEffect(() => {
    if (personal) {
      form.reset({
        nombre_completo: personal.nombre_completo,
        numero_cedula: personal.numero_cedula,
        rol: personal.rol,
        tarifa: personal.tarifa,
        modalidad_cobro: personal.modalidad_cobro,
        tarifa_hora_extra: personal.tarifa_hora_extra,
      });
    }
  }, [personal, form]);

  const handleSubmit = async (data: PersonalFormData) => {
    setLoading(true);
    try {
      const dataToSave = {
        nombre_completo: data.nombre_completo,
        numero_cedula: data.numero_cedula,
        rol: data.rol,
        tarifa: data.tarifa,
        modalidad_cobro: data.modalidad_cobro,
        tarifa_hora_extra: data.tarifa_hora_extra || null,
      };

      if (personal) {
        const { error } = await supabase
          .from("personal")
          .update(dataToSave)
          .eq("id", personal.id);

        if (error) throw error;

        toast({
          title: "Personal actualizado",
          description: "Los datos han sido actualizados exitosamente",
        });
      } else {
        const { error } = await supabase
          .from("personal")
          .insert(dataToSave);

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
      <div className="text-center pb-4 border-b border-slate-200">
        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
          <User className="h-6 w-6 text-slate-600" />
        </div>
        <p className="text-slate-500 text-sm">
          {personal ? "Modifica la información del empleado" : "Ingresa los datos del nuevo empleado"}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          {/* Nombre Completo */}
          <FormField
            control={form.control}
            name="nombre_completo"
            rules={{ required: "El nombre completo es requerido" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  Nombre Completo
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ej: Juan Pérez García"
                    {...field}
                    className="h-10"
                  />
                </FormControl>
                <FormMessage />
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
              <FormItem>
                <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                  <IdCard className="h-4 w-4 text-slate-400" />
                  Número de Cédula
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ej: 12345678"
                    {...field}
                    className="h-10"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Rol */}
          <FormField
            control={form.control}
            name="rol"
            rules={{ required: "El rol es requerido" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-slate-400" />
                  Rol o Cargo
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecciona el rol" />
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

          {/* Modalidad de Cobro */}
          <FormField
            control={form.control}
            name="modalidad_cobro"
            rules={{ required: "La modalidad de cobro es requerida" }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Modalidad de Cobro
                </FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecciona la modalidad" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {MODALIDADES_COBRO.map((modalidad) => (
                      <SelectItem key={modalidad.value} value={modalidad.value}>
                        <div>
                          <div className="font-medium">{modalidad.label}</div>
                          <div className="text-xs text-slate-500">{modalidad.descripcion}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tarifa */}
          <FormField
            control={form.control}
            name="tarifa"
            rules={{
              required: "La tarifa es requerida",
              min: {
                value: 1,
                message: "La tarifa debe ser mayor a 0"
              }
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                  Tarifa (COP)
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="number"
                      placeholder="Ej: 25000"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      className="h-10 pl-9"
                    />
                  </div>
                </FormControl>
                <FormMessage />
                <p className="text-xs text-slate-500 mt-1">
                  {getTarifaHelpText(modalidadCobro)}
                </p>
              </FormItem>
            )}
          />

          {/* Tarifa Hora Extra (solo para jornada_hasta_10h) */}
          {modalidadCobro === 'jornada_hasta_10h' && (
            <FormField
              control={form.control}
              name="tarifa_hora_extra"
              rules={{
                min: {
                  value: 0,
                  message: "La tarifa hora extra debe ser mayor o igual a 0"
                }
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-slate-400" />
                    Tarifa Hora Extra (COP)
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="number"
                        placeholder="Ej: 30000"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                        value={field.value || ''}
                        className="h-10 pl-9"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-slate-500 mt-1">
                    Tarifa por hora cuando se exceden las 10 horas de jornada
                  </p>
                </FormItem>
              )}
            />
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              <X className="h-4 w-4 mr-2" />
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
                  <span>{personal ? "Actualizar Personal" : "Crear Personal"}</span>
                </div>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
