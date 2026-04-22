import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Edit, Trash2, UserCircle, UserPlus, ChevronLeft, ChevronRight, Phone, Mail, Building2, User, Plus, IdCard, Briefcase, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  listClientes, createCliente, updateCliente, deleteCliente,
  listContactos, createContacto, updateContacto, deleteContacto,
} from "@/integrations/supabase/apiClientes";
import type { Cliente, ClienteInsert, ContactoCliente, ContactoClienteInsert } from "@/integrations/supabase/apiClientes";
import { PageHeader } from "@/components/Layout/PageHeader";

const ITEMS_PER_PAGE = 10;

const emptyForm: ClienteInsert & { tipo: 'persona_natural' | 'empresa' } = {
  nombre: "",
  telefono: "",
  correo: "",
  empresa: "",
  nit: "",
  notas: "",
  tipo: "persona_natural",
  cedula: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const { toast } = useToast();

  // Contactos state
  const [contactos, setContactos] = useState<ContactoCliente[]>([]);
  const [loadingContactos, setLoadingContactos] = useState(false);
  const [contactoForm, setContactoForm] = useState({ nombre: "", cargo: "", telefono: "", correo: "" });
  const [editingContacto, setEditingContacto] = useState<ContactoCliente | null>(null);
  const [showContactoForm, setShowContactoForm] = useState(false);

  const filteredClientes = useMemo(() => {
    let filtered = clientes;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.nombre.toLowerCase().includes(term) ||
          c.empresa?.toLowerCase().includes(term) ||
          c.correo?.toLowerCase().includes(term) ||
          c.cedula?.toLowerCase().includes(term) ||
          c.nit?.toLowerCase().includes(term)
      );
    }
    if (filterTipo !== "all") {
      filtered = filtered.filter((c) => c.tipo === filterTipo);
    }
    return filtered;
  }, [clientes, searchTerm, filterTipo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterTipo]);

  const fetchClientes = useCallback(async () => {
    try {
      const data = await listClientes();
      setClientes(data);
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error)?.message || "Error al cargar clientes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const openCreate = () => {
    setSelectedCliente(null);
    setForm(emptyForm);
    setContactos([]);
    setIsDialogOpen(true);
  };

  const openEdit = async (cliente: Cliente) => {
    setSelectedCliente(cliente);
    setForm({
      nombre: cliente.nombre,
      telefono: cliente.telefono || "",
      correo: cliente.correo || "",
      empresa: cliente.empresa || "",
      nit: cliente.nit || "",
      notas: cliente.notas || "",
      tipo: cliente.tipo || "persona_natural",
      cedula: cliente.cedula || "",
    });
    setIsDialogOpen(true);

    // Load contactos for empresa
    if (cliente.tipo === 'empresa') {
      setLoadingContactos(true);
      try {
        const data = await listContactos(cliente.id);
        setContactos(data);
      } catch (err) {
        setContactos([]);
        toast({
          title: "No se pudieron cargar los contactos",
          description: err?.message ?? "Error al consultar contactos de la empresa.",
          variant: "destructive",
        });
      } finally {
        setLoadingContactos(false);
      }
    } else {
      setContactos([]);
    }
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) {
      toast({ title: "Nombre requerido", description: "Ingresa el nombre del cliente", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: ClienteInsert = {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        telefono: form.telefono?.trim() || null,
        correo: form.correo?.trim() || null,
        notas: form.notas?.trim() || null,
      };

      if (form.tipo === 'persona_natural') {
        payload.cedula = form.cedula?.trim() || null;
        payload.empresa = null;
        payload.nit = null;
      } else {
        payload.empresa = form.nombre.trim();
        payload.nit = form.nit?.trim() || null;
        payload.cedula = null;
      }

      if (selectedCliente) {
        await updateCliente(selectedCliente.id, payload);
        toast({ title: "Cliente actualizado", description: "Los datos se guardaron correctamente" });
      } else {
        await createCliente(payload);
        toast({ title: "Cliente creado", description: `"${payload.nombre}" fue agregado exitosamente` });
      }
      setIsDialogOpen(false);
      setSelectedCliente(null);
      setContactos([]);
      setShowContactoForm(false);
      setEditingContacto(null);
      fetchClientes();
    } catch (error) {
      toast({ title: "Error", description: error?.message || "Error al guardar cliente", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCliente(id);
      toast({ title: "Cliente eliminado", description: "El cliente fue eliminado exitosamente" });
      fetchClientes();
    } catch (error) {
      const msg = error?.message?.includes("violates foreign key")
        ? "No se puede eliminar: este cliente tiene cotizaciones o eventos asociados."
        : error?.message || "Error al eliminar cliente";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  // Contactos handlers
  const handleSaveContacto = async () => {
    if (!contactoForm.nombre.trim() || !selectedCliente) return;
    try {
      if (editingContacto) {
        const updated = await updateContacto(editingContacto.id, {
          nombre: contactoForm.nombre.trim(),
          cargo: contactoForm.cargo.trim() || null,
          telefono: contactoForm.telefono.trim() || null,
          correo: contactoForm.correo.trim() || null,
        });
        setContactos((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast({ title: "Contacto actualizado" });
      } else {
        const created = await createContacto({
          cliente_id: selectedCliente.id,
          nombre: contactoForm.nombre.trim(),
          cargo: contactoForm.cargo.trim() || null,
          telefono: contactoForm.telefono.trim() || null,
          correo: contactoForm.correo.trim() || null,
        });
        setContactos((prev) => [...prev, created]);
        toast({ title: "Contacto creado" });
      }
      setContactoForm({ nombre: "", cargo: "", telefono: "", correo: "" });
      setEditingContacto(null);
      setShowContactoForm(false);
    } catch (err) {
      toast({ title: "Error", description: err?.message || "Error al guardar contacto", variant: "destructive" });
    }
  };

  const handleDeleteContacto = async (contacto: ContactoCliente) => {
    if (!window.confirm(`¿Eliminar el contacto "${contacto.nombre}"?`)) return;
    try {
      await deleteContacto(contacto.id);
      setContactos((prev) => prev.filter((c) => c.id !== contacto.id));
      toast({ title: "Contacto eliminado" });
    } catch (err) {
      toast({ title: "Error", description: err?.message || "Error al eliminar", variant: "destructive" });
    }
  };

  const handleTogglePrincipal = async (contacto: ContactoCliente) => {
    try {
      // Desmarcar en paralelo cualquier otro principal antes de setear el nuevo
      const otrosPrincipales = contactos.filter((c) => c.es_principal && c.id !== contacto.id);
      await Promise.all(otrosPrincipales.map((c) => updateContacto(c.id, { es_principal: false })));
      const updated = await updateContacto(contacto.id, { es_principal: !contacto.es_principal });
      setContactos((prev) =>
        prev.map((c) =>
          c.id === updated.id ? updated : { ...c, es_principal: false }
        )
      );
    } catch (err) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  const totalClientes = clientes.length;
  const totalPages = Math.ceil(filteredClientes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedClientes = filteredClientes.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted/70 animate-pulse" />
          <p className="text-sm text-muted-foreground">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Recursos"
        title="Clientes"
        description={`${totalClientes} ${totalClientes === 1 ? "cliente registrado" : "clientes registrados"} · personas y empresas con sus contactos`}
        actions={
          <Button size="sm" className="gap-2" onClick={openCreate}>
            <UserPlus className="h-4 w-4" strokeWidth={1.75} />
            Agregar
          </Button>
        }
      />

      {/* Tabla con filtros */}
      <Card>
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre, empresa, cedula o correo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full sm:w-48 h-9">
                <SelectValue placeholder="Todos los tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="persona_natural">Persona Natural</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredClientes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <UserCircle className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-slate-900 font-medium">
              {clientes.length === 0 ? "No hay clientes registrados" : "Sin resultados"}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {clientes.length === 0
                ? "Agrega el primer cliente para comenzar"
                : "Intenta con otros criterios de busqueda"
              }
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-medium">Nombre</TableHead>
                  <TableHead className="font-medium">Tipo</TableHead>
                  <TableHead className="font-medium">Identificacion</TableHead>
                  <TableHead className="font-medium">Telefono</TableHead>
                  <TableHead className="font-medium">Correo</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClientes.map((cliente) => (
                  <TableRow key={cliente.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                          {cliente.tipo === 'empresa' ? (
                            <Building2 className="h-4 w-4" strokeWidth={1.75} />
                          ) : (
                            <span className="text-[11px] font-medium">
                              {cliente.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="font-medium text-foreground">{cliente.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {cliente.tipo === 'empresa' ? 'Empresa' : 'Persona'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {cliente.tipo === 'empresa'
                        ? (cliente.nit ? `NIT: ${cliente.nit}` : "—")
                        : (cliente.cedula ? `CC: ${cliente.cedula}` : "—")
                      }
                    </TableCell>
                    <TableCell className="text-slate-600">{cliente.telefono || "—"}</TableCell>
                    <TableCell className="text-slate-600">{cliente.correo || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(cliente)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4 text-slate-500" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Trash2 className="h-4 w-4 text-slate-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar cliente?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta accion no se puede deshacer. Se eliminara permanentemente
                                a <span className="font-medium">{cliente.nombre}</span> del sistema.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(cliente.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  {startIndex + 1}-{Math.min(endIndex, filteredClientes.length)} de {filteredClientes.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      if (totalPages <= 5) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                      return false;
                    })
                    .map((page, index, array) => (
                      <span key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-1 text-slate-400">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "ghost"}
                          size="sm"
                          onClick={() => goToPage(page)}
                          className="h-8 w-8 p-0 font-mono tabular-nums text-[12px]"
                        >
                          {page}
                        </Button>
                      </span>
                    ))
                  }

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Dialog crear/editar */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setShowContactoForm(false);
          setEditingContacto(null);
        }
      }}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCliente ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
            <DialogDescription>
              {selectedCliente
                ? "Modifica los datos del cliente"
                : "Ingresa la informacion del nuevo cliente"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Toggle tipo */}
            <div className="flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
                  form.tipo === 'persona_natural'
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted/40"
                )}
                onClick={() => setForm((p) => ({ ...p, tipo: 'persona_natural' }))}
              >
                <User className="h-4 w-4" strokeWidth={1.75} />
                Persona Natural
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors",
                  form.tipo === 'empresa'
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted/40"
                )}
                onClick={() => setForm((p) => ({ ...p, tipo: 'empresa' }))}
              >
                <Building2 className="h-4 w-4" strokeWidth={1.75} />
                Empresa
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {form.tipo === 'empresa' ? 'Nombre de la Empresa *' : 'Nombre *'}
              </label>
              <Input
                placeholder={form.tipo === 'empresa' ? "Nombre de la empresa" : "Nombre del cliente"}
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                className="h-10"
              />
            </div>

            {form.tipo === 'persona_natural' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    <IdCard className="h-3 w-3" /> Cedula
                  </label>
                  <Input
                    placeholder="Numero de cedula"
                    value={form.cedula || ""}
                    onChange={(e) => setForm((p) => ({ ...p, cedula: e.target.value }))}
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
                      value={form.telefono || ""}
                      onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
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
                      value={form.correo || ""}
                      onChange={(e) => setForm((p) => ({ ...p, correo: e.target.value }))}
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
                    value={form.nit || ""}
                    onChange={(e) => setForm((p) => ({ ...p, nit: e.target.value }))}
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
                      value={form.telefono || ""}
                      onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
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
                      value={form.correo || ""}
                      onChange={(e) => setForm((p) => ({ ...p, correo: e.target.value }))}
                      className="h-10"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Notas</label>
              <Input
                placeholder="Notas adicionales"
                value={form.notas || ""}
                onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                className="h-10"
              />
            </div>

            {/* Contactos section for empresas in edit mode */}
            {selectedCliente && form.tipo === 'empresa' && (
              <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">Contactos</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingContacto(null);
                      setContactoForm({ nombre: "", cargo: "", telefono: "", correo: "" });
                      setShowContactoForm(true);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar
                  </Button>
                </div>

                {loadingContactos ? (
                  <p className="text-sm text-slate-500">Cargando contactos...</p>
                ) : contactos.length === 0 && !showContactoForm ? (
                  <p className="text-sm text-slate-500">No hay contactos registrados</p>
                ) : (
                  <div className="space-y-2">
                    {contactos.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-800">{c.nombre}</span>
                            {c.es_principal && (
                              <Badge variant="outline" className="text-[10px] font-normal uppercase tracking-wide text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]">
                                Principal
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-0.5">
                            {c.cargo && <span>{c.cargo}</span>}
                            {c.telefono && <span>{c.telefono}</span>}
                            {c.correo && <span>{c.correo}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleTogglePrincipal(c)}
                            title={c.es_principal ? "Quitar como principal" : "Marcar como principal"}
                          >
                            <Star className={cn("h-3.5 w-3.5", c.es_principal ? "text-[hsl(30_55%_42%)] fill-[hsl(30_55%_42%)]" : "text-muted-foreground/60")} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingContacto(c);
                              setContactoForm({
                                nombre: c.nombre,
                                cargo: c.cargo || "",
                                telefono: c.telefono || "",
                                correo: c.correo || "",
                              });
                              setShowContactoForm(true);
                            }}
                          >
                            <Edit className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDeleteContacto(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline contacto form */}
                {showContactoForm && (
                  <div className="mt-3 p-3 bg-muted/40 rounded-md border border-border space-y-3">
                    <div className="space-y-2">
                      <Input
                        placeholder="Nombre del contacto *"
                        value={contactoForm.nombre}
                        onChange={(e) => setContactoForm((p) => ({ ...p, nombre: e.target.value }))}
                        className="h-9 bg-white"
                      />
                    </div>
                    <Input
                      placeholder="Cargo"
                      value={contactoForm.cargo}
                      onChange={(e) => setContactoForm((p) => ({ ...p, cargo: e.target.value }))}
                      className="h-9 bg-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Telefono"
                        value={contactoForm.telefono}
                        onChange={(e) => setContactoForm((p) => ({ ...p, telefono: e.target.value }))}
                        className="h-9 bg-white"
                      />
                      <Input
                        placeholder="Correo"
                        value={contactoForm.correo}
                        onChange={(e) => setContactoForm((p) => ({ ...p, correo: e.target.value }))}
                        className="h-9 bg-white"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowContactoForm(false);
                          setEditingContacto(null);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveContacto}
                        disabled={!contactoForm.nombre.trim()}
                      >
                        {editingContacto ? "Guardar" : "Crear"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.nombre.trim() || saving}>
              {saving ? "Guardando..." : selectedCliente ? "Guardar Cambios" : "Crear Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
