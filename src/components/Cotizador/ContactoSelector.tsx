import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, User, Phone, Mail, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  listContactos,
  createContacto,
} from "@/integrations/supabase/apiClientes";
import type { ContactoCliente } from "@/integrations/supabase/apiClientes";

interface Props {
  clienteId: string;
  value: string | null;
  onChange: (contactoId: string | null, contacto: ContactoCliente | null) => void;
}

export function ContactoSelector({ clienteId, value, onChange }: Props) {
  const { toast } = useToast();
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newContacto, setNewContacto] = useState({
    nombre: "",
    cargo: "",
    telefono: "",
    correo: "",
  });

  useEffect(() => {
    if (!clienteId) return;
    setLoading(true);
    listContactos(clienteId)
      .then((data) => {
        setContactos(data);
        // Auto-select principal if nothing selected
        if (!value && data.length > 0) {
          const principal = data.find((c) => c.es_principal) || data[0];
          onChange(principal.id, principal);
        }
      })
      .catch(() => setContactos([]))
      .finally(() => setLoading(false));
  }, [clienteId]);

  const selectedContacto = contactos.find((c) => c.id === value) ?? null;

  const handleSelect = (contactoId: string) => {
    if (contactoId === "__new__") {
      setDialogOpen(true);
      return;
    }
    const contacto = contactos.find((c) => c.id === contactoId) ?? null;
    onChange(contactoId, contacto);
  };

  const handleCreate = async () => {
    if (!newContacto.nombre.trim()) return;
    setCreating(true);
    try {
      const created = await createContacto({
        cliente_id: clienteId,
        nombre: newContacto.nombre.trim(),
        cargo: newContacto.cargo.trim() || null,
        telefono: newContacto.telefono.trim() || null,
        correo: newContacto.correo.trim() || null,
      });
      setContactos((prev) => [...prev, created]);
      onChange(created.id, created);
      setDialogOpen(false);
      setNewContacto({ nombre: "", cargo: "", telefono: "", correo: "" });
      toast({ title: "Contacto creado", description: `"${created.nombre}" fue agregado` });
    } catch (err: any) {
      toast({
        title: "Error al crear contacto",
        description: err?.message || "Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500 py-2">Cargando contactos...</div>;
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-slate-700 flex items-center space-x-2">
        <User className="h-4 w-4 text-slate-400" />
        <span>Contacto de la Empresa</span>
      </label>

      <Select value={value || ""} onValueChange={handleSelect}>
        <SelectTrigger className="h-12">
          <SelectValue placeholder="Seleccionar contacto..." />
        </SelectTrigger>
        <SelectContent>
          {contactos.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.nombre}</span>
                {c.cargo && (
                  <span className="text-xs text-slate-500">({c.cargo})</span>
                )}
                {c.es_principal && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Principal</span>
                )}
              </div>
            </SelectItem>
          ))}
          <SelectItem value="__new__">
            <div className="flex items-center gap-2 text-selecta-green">
              <Plus className="h-4 w-4" />
              Agregar contacto
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Mini card with selected contacto info */}
      {selectedContacto && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm space-y-1">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-blue-600" />
            <span className="font-medium text-blue-900">{selectedContacto.nombre}</span>
          </div>
          {selectedContacto.cargo && (
            <div className="flex items-center gap-2">
              <Briefcase className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-blue-700">{selectedContacto.cargo}</span>
            </div>
          )}
          {selectedContacto.telefono && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-blue-700">{selectedContacto.telefono}</span>
            </div>
          )}
          {selectedContacto.correo && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-blue-700">{selectedContacto.correo}</span>
            </div>
          )}
        </div>
      )}

      {/* Dialog to create new contacto */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo Contacto</DialogTitle>
            <DialogDescription>
              Agrega una persona de contacto para esta empresa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                placeholder="Nombre del contacto"
                value={newContacto.nombre}
                onChange={(e) =>
                  setNewContacto((p) => ({ ...p, nombre: e.target.value }))
                }
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Cargo
              </label>
              <Input
                placeholder="Ej: Gerente, Coordinador"
                value={newContacto.cargo}
                onChange={(e) =>
                  setNewContacto((p) => ({ ...p, cargo: e.target.value }))
                }
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Telefono
                </label>
                <Input
                  placeholder="300 123 4567"
                  value={newContacto.telefono}
                  onChange={(e) =>
                    setNewContacto((p) => ({ ...p, telefono: e.target.value }))
                  }
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Correo
                </label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={newContacto.correo}
                  onChange={(e) =>
                    setNewContacto((p) => ({ ...p, correo: e.target.value }))
                  }
                  className="h-10"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newContacto.nombre.trim() || creating}
            >
              {creating ? "Creando..." : "Crear Contacto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
