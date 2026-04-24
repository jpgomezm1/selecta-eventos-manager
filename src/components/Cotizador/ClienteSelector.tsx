import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronsUpDown, Check, Plus, User, Building2, Phone, Mail, IdCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { searchClientes, createCliente } from "@/integrations/supabase/apiClientes";
import type { Cliente, ClienteInsert } from "@/integrations/supabase/apiClientes";

interface Props {
  value: string | null; // cliente_id
  onChange: (clienteId: string | null, cliente: Cliente | null) => void;
  selectedCliente?: Cliente | null;
}

export function ClienteSelector({ value, onChange, selectedCliente }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<Cliente[]>([]);
  const [searching, setSearching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTipo, setNewTipo] = useState<'persona_natural' | 'empresa'>('persona_natural');
  const [newCliente, setNewCliente] = useState<ClienteInsert>({
    nombre: "",
    telefono: "",
    correo: "",
    empresa: "",
    nit: "",
    cedula: "",
  });

  // Debounced search
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchClientes(searchTerm);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelect = (cliente: Cliente) => {
    onChange(cliente.id, cliente);
    setOpen(false);
    setSearchTerm("");
  };

  const handleClear = () => {
    onChange(null, null);
    setSearchTerm("");
  };

  const handleCreateCliente = async () => {
    if (!newCliente.nombre.trim()) return;
    setCreating(true);
    try {
      const payload: ClienteInsert = {
        nombre: newCliente.nombre.trim(),
        tipo: newTipo,
      };

      if (newTipo === 'persona_natural') {
        payload.cedula = newCliente.cedula?.trim() || null;
        payload.telefono = newCliente.telefono?.trim() || null;
        payload.correo = newCliente.correo?.trim() || null;
      } else {
        payload.empresa = newCliente.nombre.trim(); // For empresa, nombre IS the empresa name
        payload.nit = newCliente.nit?.trim() || null;
        payload.telefono = newCliente.telefono?.trim() || null;
        payload.correo = newCliente.correo?.trim() || null;
        payload.notas = newCliente.notas?.trim() || null;
      }

      const created = await createCliente(payload);
      onChange(created.id, created);
      setDialogOpen(false);
      setOpen(false);
      setNewCliente({ nombre: "", telefono: "", correo: "", empresa: "", nit: "", cedula: "" });
      setNewTipo('persona_natural');
    } catch (err) {
      toast({ title: "Error al crear cliente", description: err?.message || "Intenta de nuevo.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const displayLabel = selectedCliente
    ? selectedCliente.tipo === 'empresa' || !selectedCliente.empresa
      ? selectedCliente.nombre
      : `${selectedCliente.nombre} (${selectedCliente.empresa})`
    : "Seleccionar cliente...";

  const displayIcon = selectedCliente?.tipo === 'empresa'
    ? <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
    : <User className="h-4 w-4 shrink-0 text-slate-400" />;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full h-12 justify-between font-normal",
              !value && "text-muted-foreground"
            )}
          >
            <div className="flex items-center space-x-2 truncate">
              {displayIcon}
              <span className="truncate">{displayLabel}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar por nombre, empresa o correo..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList>
              {searching && (
                <div className="p-4 text-sm text-center text-slate-500">Buscando...</div>
              )}
              {!searching && searchTerm.length >= 2 && results.length === 0 && (
                <CommandEmpty>No se encontraron clientes</CommandEmpty>
              )}
              {!searching && searchTerm.length < 2 && !value && (
                <div className="p-4 text-sm text-center text-slate-500">
                  Escribe al menos 2 caracteres para buscar
                </div>
              )}
              {results.length > 0 && (
                <CommandGroup heading="Clientes">
                  {results.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => handleSelect(c)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === c.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {c.tipo === 'empresa' ? (
                        <Building2 className="mr-2 h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <User className="mr-2 h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{c.nombre}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          {c.tipo === 'empresa' && c.nit && (
                            <span className="flex items-center gap-1">
                              NIT: {c.nit}
                            </span>
                          )}
                          {c.tipo === 'persona_natural' && c.cedula && (
                            <span className="flex items-center gap-1">
                              CC: {c.cedula}
                            </span>
                          )}
                          {c.empresa && c.tipo !== 'empresa' && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {c.empresa}
                            </span>
                          )}
                          {c.correo && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {c.correo}
                            </span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setDialogOpen(true);
                    setNewCliente((prev) => ({ ...prev, nombre: searchTerm }));
                  }}
                  className="cursor-pointer text-selecta-green"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear nuevo cliente
                  {searchTerm && ` "${searchTerm}"`}
                </CommandItem>
              </CommandGroup>
              {value && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={handleClear} className="cursor-pointer text-red-500">
                      Quitar cliente seleccionado
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Dialog para crear nuevo cliente */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo cliente para la cotizacion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Toggle tipo */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              <button
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
                  newTipo === 'persona_natural'
                    ? "bg-selecta-green text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
                onClick={() => setNewTipo('persona_natural')}
              >
                <User className="h-4 w-4" />
                Persona Natural
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
                  newTipo === 'empresa'
                    ? "bg-selecta-green text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
                onClick={() => setNewTipo('empresa')}
              >
                <Building2 className="h-4 w-4" />
                Empresa
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {newTipo === 'empresa' ? 'Nombre de la Empresa *' : 'Nombre *'}
              </label>
              <Input
                placeholder={newTipo === 'empresa' ? "Nombre de la empresa" : "Nombre del cliente"}
                value={newCliente.nombre}
                onChange={(e) => setNewCliente((p) => ({ ...p, nombre: e.target.value }))}
                className="h-10"
              />
            </div>

            {newTipo === 'persona_natural' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <IdCard className="h-3 w-3" /> Cedula
                  </label>
                  <Input
                    placeholder="Numero de cedula"
                    value={newCliente.cedula || ""}
                    onChange={(e) => setNewCliente((p) => ({ ...p, cedula: e.target.value }))}
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
                      value={newCliente.telefono || ""}
                      onChange={(e) => setNewCliente((p) => ({ ...p, telefono: e.target.value }))}
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
                      value={newCliente.correo || ""}
                      onChange={(e) => setNewCliente((p) => ({ ...p, correo: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">NIT</label>
                  <Input
                    placeholder="NIT de la empresa"
                    value={newCliente.nit || ""}
                    onChange={(e) => setNewCliente((p) => ({ ...p, nit: e.target.value }))}
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
                      value={newCliente.telefono || ""}
                      onChange={(e) => setNewCliente((p) => ({ ...p, telefono: e.target.value }))}
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
                      value={newCliente.correo || ""}
                      onChange={(e) => setNewCliente((p) => ({ ...p, correo: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateCliente}
              disabled={!newCliente.nombre.trim() || creating}
            >
              {creating ? "Creando..." : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
