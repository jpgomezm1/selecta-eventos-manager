import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { UserPlus, Search, Users } from "lucide-react";
import type { PersonalAsignacion } from "@/types/cotizador";

type Props = {
  rol: string;
  asignados: PersonalAsignacion[];
  onToggle: (persona: PersonalAsignacion) => void;
  max: number;
};

export function PersonalAsignacionPopover({ rol, asignados, onToggle, max }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const { data: personas = [] } = useQuery({
    queryKey: ["personal-por-rol", rol],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("personal")
        .select("id, nombre_completo, numero_cedula, rol")
        .eq("rol", rol)
        .order("nombre_completo", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const filtered = personas.filter(
    (p) =>
      p.nombre_completo.toLowerCase().includes(q.toLowerCase()) ||
      p.numero_cedula.includes(q)
  );

  const isChecked = (id: string) => asignados.some((a) => a.personal_id === id);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <UserPlus className="h-3 w-3" />
          Asignar
          {asignados.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {asignados.length}/{max}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {rol}
            </span>
            <Badge variant="secondary" className="text-xs">
              {asignados.length}/{max}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar persona..."
              className="h-8 pl-7 text-sm"
            />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No hay personal con rol "{rol}"
            </p>
          ) : (
            filtered.map((p) => {
              const checked = isChecked(p.id);
              const disabled = !checked && asignados.length >= max;
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-slate-50 ${
                    disabled ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={() =>
                      onToggle({ personal_id: p.id, nombre_completo: p.nombre_completo })
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {p.nombre_completo}
                    </div>
                    <div className="text-xs text-slate-500">{p.numero_cedula}</div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
