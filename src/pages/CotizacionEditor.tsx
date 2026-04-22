import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCotizacionDetalle,
  addVersionToCotizacion,
  setVersionDefinitiva,
  deleteVersionCotizacion,
  savePersonalAsignaciones,
  loadPersonalAsignaciones,
} from "@/integrations/supabase/apiCotizador";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Plus,
  FileText,
  CheckCircle,
  Clock,
  Edit,
  Pencil,
  Trash2,
  ShieldCheck,
  MapPin,
  Building2,
  Phone,
  Mail,
  ExternalLink,
  User,
  IdCard,
  Briefcase,
  Share2,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CotizacionItemsState } from "@/types/cotizador";
import { ResumenCotizacionReadOnly } from "@/components/Cotizador/ResumenCotizacionReadOnly";
import { LugaresSelector } from "@/components/Cotizador/LugaresSelector";
import { ApprovalDialog } from "@/components/Cotizador/ApprovalDialog";
import { CotizacionChecklist } from "@/components/Cotizador/CotizacionChecklist";
import { ShareDialog } from "@/components/Cotizador/ShareDialog";
import { formatLocalDate } from "@/lib/dateLocal";

export default function CotizacionEditorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [active, setActive] = useState<string | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalVersionId, setApprovalVersionId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [renamingVersionId, setRenamingVersionId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["cotizacion", id],
    queryFn: () => getCotizacionDetalle(id!),
    enabled: !!id,
  });

  const { mutate: marcarDef, isPending: aprobando } = useMutation({
    mutationFn: (version_id: string) => setVersionDefinitiva(id!, version_id),
    onSuccess: async () => {
      toast({
        title: "Cotización aprobada",
        description: "Se creó el evento automáticamente a partir de la versión seleccionada.",
      });
      setApprovalDialogOpen(false);
      setApprovalVersionId(null);
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    },
    onError: (e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startRenaming = (versionId: string, currentName: string) => {
    setRenamingVersionId(versionId);
    setRenamingValue(currentName);
  };

  const { mutate: saveRename } = useMutation({
    mutationFn: async () => {
      const name = renamingValue.trim();
      if (!name || !renamingVersionId) return;
      const { error } = await supabase
        .from("cotizacion_versiones")
        .update({ nombre_opcion: name })
        .eq("id", renamingVersionId);
      if (error) throw error;
    },
    onSuccess: () => {
      setRenamingVersionId(null);
      setRenamingValue("");
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    },
    onError: (e) =>
      toast({ title: "Error al renombrar", description: e.message, variant: "destructive" }),
  });

  const cancelRenaming = () => {
    setRenamingVersionId(null);
    setRenamingValue("");
  };

  const confirmarEliminarVersion = (versionId: string, versionName: string) => {
    if (
      window.confirm(
        `¿Estás seguro de que quieres eliminar la "${versionName}"? Esta acción no se puede deshacer.`
      )
    ) {
      eliminarVersion(versionId);
    }
  };

  const { mutate: agregarVersion, isPending: creandoVersion } = useMutation({
    mutationFn: async () => {
      const nextIndex = (data?.versiones?.length ?? 0) + 1;
      return addVersionToCotizacion(id!, {
        nombre_opcion: `Opción ${String.fromCharCode(64 + nextIndex)}`,
        version_index: nextIndex,
        total: 0,
        estado: "Pendiente por Aprobación",
        items: { platos: [], personal: [], transportes: [], menaje: [] },
      });
    },
    onSuccess: (result) => {
      toast({
        title: "Nueva opción creada",
        description: "Se agregó una nueva versión lista para personalizar.",
      });
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
      nav(`/cotizaciones/${id}/editar/${result.id}`);
    },
    onError: (e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { mutate: duplicarVersion, isPending: duplicandoVersion } = useMutation({
    mutationFn: async (sourceVersion: typeof versiones[0]) => {
      const nextIndex = (data?.versiones?.length ?? 0) + 1;

      // Deep clone items
      const clonedItems: CotizacionItemsState = JSON.parse(JSON.stringify(sourceVersion.items));

      // Calcular total
      const total =
        clonedItems.platos.reduce((a, p) => a + p.precio_unitario * p.cantidad, 0) +
        clonedItems.personal.reduce((a, p) => a + p.tarifa_estimada_por_persona * p.cantidad, 0) +
        clonedItems.transportes.reduce((a, t) => a + t.tarifa_unitaria * t.cantidad, 0) +
        (clonedItems.menaje ?? []).reduce((a, m) => a + m.precio_alquiler * m.cantidad, 0);

      // Crear nueva versión con items clonados
      const result = await addVersionToCotizacion(id!, {
        nombre_opcion: `${sourceVersion.nombre_opcion} - Copia`,
        version_index: nextIndex,
        total,
        estado: "Pendiente por Aprobación",
        items: clonedItems,
      });

      // Clonar asignaciones de personal
      try {
        const asignaciones = await loadPersonalAsignaciones(sourceVersion.id);
        if (Object.values(asignaciones).some(arr => arr.length > 0)) {
          const personalWithAsig = clonedItems.personal.map(p => ({
            ...p,
            asignados: asignaciones[p.personal_costo_id] ?? [],
          }));
          await savePersonalAsignaciones(result.id, personalWithAsig);
        }
      } catch {
        // Asignaciones son opcionales — no fallar si no se pueden copiar
      }

      return { id: result.id, clonedItems };
    },
    onSuccess: (result, sourceVersion) => {
      toast({
        title: "Opción duplicada",
        description: `Se creó una copia de "${sourceVersion.nombre_opcion}"`,
      });
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
      nav(`/cotizaciones/${id}/editar/${result.id}`);
    },
    onError: (e) =>
      toast({ title: "Error al duplicar", description: e.message, variant: "destructive" }),
  });

  const { mutate: eliminarVersion, isPending: eliminandoVersion } = useMutation({
    mutationFn: (versionId: string) => deleteVersionCotizacion(versionId),
    onSuccess: () => {
      toast({
        title: "Versión eliminada",
        description: "La opción ha sido eliminada exitosamente.",
      });
      qc.invalidateQueries({ queryKey: ["cotizacion", id] });
    },
    onError: (e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted/70 animate-pulse" />
          <p className="text-sm text-muted-foreground">Cargando cotización...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center space-y-4 text-center">
          <FileText className="h-8 w-8 text-destructive" strokeWidth={1.5} />
          <h3 className="font-serif text-lg text-foreground">Error al cargar</h3>
          <p className="text-sm text-muted-foreground">No se pudo obtener la información de la cotización</p>
          <Button onClick={() => nav("/cotizaciones")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a cotizaciones
          </Button>
        </div>
      </div>
    );
  }

  const { cotizacion, versiones, lugares } = data;
  const activeId = active ?? versiones[0]?.id;
  const current = versiones.find((v) => v.id === activeId) ?? versiones[0];
  const isAprobada = cotizacion.estado === "Cotización Aprobada";
  const versionDefinitiva = versiones.find((v) => v.is_definitiva);

  // Get estado badge config
  const getStatusConfig = (estado: string) => {
    const configs: Record<string, { cls: string; label: string }> = {
      "Pendiente por Aprobación": {
        cls: "text-[hsl(30_55%_42%)] border-[hsl(30_40%_70%)]",
        label: "Pendiente",
      },
      "Cotización Aprobada": {
        cls: "text-primary border-primary/40",
        label: "Aprobada",
      },
      Rechazada: {
        cls: "text-destructive border-destructive/40",
        label: "Rechazada",
      },
    };
    return configs[estado] || configs["Pendiente por Aprobación"];
  };

  const statusConfig = getStatusConfig(cotizacion.estado);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Approved banner */}
      {isAprobada && versionDefinitiva && (
        <div className="mb-6 p-4 bg-primary/5 border border-primary/30 rounded-md flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <div>
              <span className="font-semibold text-foreground">Cotización aprobada</span>
              <span className="text-muted-foreground text-sm ml-2">
                ({versionDefinitiva.nombre_opcion})
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const { data: ev } = await supabase
                .from("eventos")
                .select("id")
                .eq("cotizacion_version_id", versionDefinitiva.id)
                .maybeSingle();
              if (ev?.id) nav(`/eventos/${ev.id}`);
            }}
          >
            Ver evento
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => nav("/cotizaciones")} size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareDialogOpen(true)}
          >
            <Share2 className="h-4 w-4 mr-1.5" strokeWidth={1.75} />
            Compartir
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl text-foreground">
                {cotizacion.nombre_cotizacion}
              </h1>
              <Badge variant="outline" className={cn("font-normal", statusConfig.cls)}>
                {statusConfig.label}
              </Badge>
            </div>
            <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
              {cotizacion.cliente?.nombre && <span>{cotizacion.cliente.nombre}</span>}
              {!cotizacion.cliente?.nombre && cotizacion.cliente_nombre && (
                <span>{cotizacion.cliente_nombre}</span>
              )}
              <span className="tabular-nums">{cotizacion.numero_invitados} invitados</span>
              {cotizacion.fecha_evento_estimada && (
                <span>
                  {formatLocalDate(cotizacion.fecha_evento_estimada, "es-ES")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main content - 3 columns */}
        <div className="xl:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-lg text-foreground">
                Opciones de cotización
              </CardTitle>
              {!isAprobada && (
                <Button
                  onClick={() => agregarVersion()}
                  disabled={creandoVersion}
                  size="sm"
                >
                  {creandoVersion ? (
                    <>
                      <div className="w-4 h-4 rounded-full bg-primary-foreground/30 animate-pulse mr-2" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" strokeWidth={1.75} />
                      Añadir opción
                    </>
                  )}
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-6">
              <Tabs
                value={activeId ?? ""}
                onValueChange={setActive}
                className="w-full"
              >
                {/* Version tabs */}
                <TabsList className="flex overflow-x-auto gap-1 mb-6">
                  {versiones.map((v) => {
                    const vTotal = Number(v.total) || 0;

                    return (
                      <TabsTrigger
                        key={v.id}
                        value={v.id}
                        className="flex items-center gap-2 whitespace-nowrap px-4 py-2 font-medium"
                      >
                        {v.is_definitiva ? (
                          <CheckCircle className="h-4 w-4 text-primary" strokeWidth={1.75} />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                        )}
                        <span>{v.nombre_opcion}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-normal tabular-nums ml-1",
                            v.is_definitiva && "text-primary border-primary/40"
                          )}
                        >
                          ${vTotal.toLocaleString()}
                        </Badge>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {versiones.map((v) => (
                  <TabsContent key={v.id} value={v.id} className="mt-0 space-y-6">
                    {/* Version header with actions */}
                    <div className="p-5 bg-muted/40 rounded-md border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {v.is_definitiva ? (
                            <CheckCircle className="h-5 w-5 text-primary" strokeWidth={1.75} />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
                          )}
                          <div>
                            {renamingVersionId === v.id ? (
                              <Input
                                autoFocus
                                value={renamingValue}
                                onChange={(e) => setRenamingValue(e.target.value)}
                                onBlur={() => {
                                  if (renamingValue.trim()) saveRename();
                                  else cancelRenaming();
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && renamingValue.trim()) saveRename();
                                  if (e.key === "Escape") cancelRenaming();
                                }}
                                className="font-serif text-lg h-9 w-64 border-primary"
                              />
                            ) : (
                              <h3
                                className="font-serif text-lg text-foreground cursor-pointer hover:text-primary transition-colors group/name flex items-center gap-1.5"
                                onClick={() => !v.is_definitiva && startRenaming(v.id, v.nombre_opcion)}
                              >
                                {v.nombre_opcion}
                                {!v.is_definitiva && (
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" strokeWidth={1.75} />
                                )}
                              </h3>
                            )}
                            <p className="kicker text-muted-foreground mt-0.5">
                              {v.is_definitiva
                                ? "Versión aprobada"
                                : "En proceso de revisión"}
                            </p>
                          </div>
                        </div>

                        {/* Action buttons */}
                        {!v.is_definitiva && (
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => nav(`/cotizaciones/${id}/editar/${v.id}`)}
                              size="sm"
                            >
                              <Edit className="h-4 w-4 mr-1.5" />
                              Editar
                            </Button>

                            <Button
                              onClick={() => duplicarVersion(v)}
                              variant="outline"
                              size="sm"
                              disabled={duplicandoVersion}
                              title="Duplicar esta opción"
                            >
                              {duplicandoVersion ? (
                                <div className="w-4 h-4 rounded-full bg-muted/70 animate-pulse" />
                              ) : (
                                <Copy className="h-4 w-4" strokeWidth={1.75} />
                              )}
                            </Button>

                            {data?.versiones && data.versiones.length > 1 && (
                              <Button
                                onClick={() =>
                                  confirmarEliminarVersion(v.id, v.nombre_opcion)
                                }
                                variant="outline"
                                size="sm"
                                disabled={eliminandoVersion}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}

                            <Button
                              onClick={() => {
                                setApprovalVersionId(v.id);
                                setApprovalDialogOpen(true);
                              }}
                              size="sm"
                            >
                              <ShieldCheck className="h-4 w-4 mr-1.5" strokeWidth={1.75} />
                              Aprobar
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <Badge variant="outline" className="font-normal tabular-nums bg-card">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full mr-1.5" />
                          {v.items.platos.length} platos
                        </Badge>
                        <Badge variant="outline" className="font-normal tabular-nums bg-card">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full mr-1.5" />
                          {v.items.personal.length} personal
                        </Badge>
                        <Badge variant="outline" className="font-normal tabular-nums bg-card">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full mr-1.5" />
                          {v.items.transportes.length} transportes
                        </Badge>
                        <Badge variant="outline" className="font-normal tabular-nums bg-card">
                          <div className="w-1 h-1 bg-muted-foreground rounded-full mr-1.5" />
                          {(v.items.menaje ?? []).length} menaje
                        </Badge>
                      </div>
                    </div>

                    {/* Version content */}
                    <div>
                      <ResumenCotizacionReadOnly
                        invitados={cotizacion.numero_invitados}
                        items={v.items}
                        total={Number(v.total)}
                        subtotales={{
                          platos: v.items.platos.reduce(
                            (a, p) => a + p.precio_unitario * p.cantidad,
                            0
                          ),
                          personal: v.items.personal.reduce(
                            (a, p) => a + p.tarifa_estimada_por_persona * p.cantidad,
                            0
                          ),
                          transportes: v.items.transportes.reduce(
                            (a, t) => a + t.tarifa_unitaria * t.cantidad,
                            0
                          ),
                          menaje: (v.items.menaje ?? []).reduce(
                            (a, m) => a + m.precio_alquiler * m.cantidad,
                            0
                          ),
                        }}
                        versionName={v.nombre_opcion}
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1 column */}
        <div className="xl:col-span-1">
          <div className="sticky top-8 space-y-4">
            {/* Estado general */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="kicker text-muted-foreground">
                  Estado
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
                  <span className="text-muted-foreground text-sm">Estado</span>
                  <Badge variant="outline" className={cn("font-normal", statusConfig.cls)}>
                    {statusConfig.label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
                  <span className="text-muted-foreground text-sm">Opciones</span>
                  <span className="font-semibold text-foreground tabular-nums">{versiones.length}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
                  <span className="text-muted-foreground text-sm">Rango</span>
                  <div className="text-right text-sm tabular-nums">
                    <span className="font-semibold text-foreground">
                      ${Math.min(...versiones.map((v) => Number(v.total))).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground/60 mx-1">–</span>
                    <span className="font-semibold text-foreground">
                      ${Math.max(...versiones.map((v) => Number(v.total))).toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Client info */}
            {(cotizacion.cliente || cotizacion.cliente_nombre) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="kicker text-muted-foreground">
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    {cotizacion.cliente?.tipo === 'empresa' ? (
                      <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    )}
                    <span className="font-medium text-foreground">
                      {cotizacion.cliente?.nombre || cotizacion.cliente_nombre}
                    </span>
                    {cotizacion.cliente?.tipo && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {cotizacion.cliente.tipo === 'empresa' ? 'Empresa' : 'Persona'}
                      </Badge>
                    )}
                  </div>
                  {cotizacion.cliente?.tipo === 'persona_natural' && cotizacion.cliente?.cedula && (
                    <div className="flex items-center gap-2 text-sm">
                      <IdCard className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      <span className="text-muted-foreground">CC: {cotizacion.cliente.cedula}</span>
                    </div>
                  )}
                  {cotizacion.cliente?.tipo === 'empresa' && cotizacion.cliente?.empresa && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      <span className="text-muted-foreground">{cotizacion.cliente.empresa}</span>
                    </div>
                  )}
                  {(cotizacion.cliente?.telefono || cotizacion.contacto_telefono) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      <span className="text-muted-foreground">
                        {cotizacion.cliente?.telefono || cotizacion.contacto_telefono}
                      </span>
                    </div>
                  )}
                  {(cotizacion.cliente?.correo || cotizacion.contacto_correo) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      <span className="text-muted-foreground">
                        {cotizacion.cliente?.correo || cotizacion.contacto_correo}
                      </span>
                    </div>
                  )}

                  {/* Contacto info */}
                  {cotizacion.contacto && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="kicker text-muted-foreground mb-2">Contacto</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                          <span className="font-medium text-foreground">{cotizacion.contacto.nombre}</span>
                        </div>
                        {cotizacion.contacto.cargo && (
                          <div className="flex items-center gap-2 text-sm">
                            <Briefcase className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                            <span className="text-muted-foreground">{cotizacion.contacto.cargo}</span>
                          </div>
                        )}
                        {cotizacion.contacto.telefono && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                            <span className="text-muted-foreground">{cotizacion.contacto.telefono}</span>
                          </div>
                        )}
                        {cotizacion.contacto.correo && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                            <span className="text-muted-foreground">{cotizacion.contacto.correo}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Lugares */}
            {lugares && lugares.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="kicker text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" strokeWidth={1.75} />
                    Ubicaciones
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LugaresSelector
                    lugares={lugares}
                    onChange={() => {}}
                    readOnly
                  />
                </CardContent>
              </Card>
            )}

            {/* Checklist (if approved) */}
            {isAprobada && versionDefinitiva && (
              <CotizacionChecklist
                cotizacionVersionId={versionDefinitiva.id}
              />
            )}
          </div>
        </div>
      </div>

      {/* Approval Dialog */}
      {approvalVersionId && (
        <ApprovalDialog
          open={approvalDialogOpen}
          onOpenChange={setApprovalDialogOpen}
          versionName={
            versiones.find((v) => v.id === approvalVersionId)?.nombre_opcion ?? ""
          }
          versionTotal={Number(
            versiones.find((v) => v.id === approvalVersionId)?.total ?? 0
          )}
          items={versiones.find((v) => v.id === approvalVersionId)?.items}
          onConfirm={() => marcarDef(approvalVersionId)}
          isPending={aprobando}
        />
      )}

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        cotizacionId={id!}
        cotizacionName={cotizacion.nombre_cotizacion}
        versiones={versiones.map(v => ({ id: v.id, nombre_opcion: v.nombre_opcion }))}
      />
    </div>
  );
}
