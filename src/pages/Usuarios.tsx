import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Mail, ShieldCheck, Check, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/Layout/PageHeader";
import { TableSkeleton } from "@/components/ui/skeletons";
import { ROLE_LABELS, type UserRole } from "@/types/roles";
import {
  listUsersWithRoles,
  assignRole,
  revokeRole,
  type UsuarioConRoles,
} from "@/integrations/supabase/apiUsuarios";

const ROLE_KEYS: UserRole[] = ["admin", "comercial", "operaciones", "cocina"];

export default function UsuariosPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filtro, setFiltro] = useState("");

  const usuariosQuery = useQuery({
    queryKey: ["usuarios"],
    queryFn: listUsersWithRoles,
  });

  const assignMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      assignRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const revokeMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      revokeRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
    onError: (err: Error) =>
      toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const usuarios = useMemo(() => usuariosQuery.data ?? [], [usuariosQuery.data]);

  const filtrados = useMemo(() => {
    if (!filtro.trim()) return usuarios;
    const term = filtro.toLowerCase();
    return usuarios.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        u.roles.some((r) => ROLE_LABELS[r].toLowerCase().includes(term))
    );
  }, [usuarios, filtro]);

  const totales = useMemo(() => {
    const counts: Record<UserRole, number> = {
      admin: 0,
      comercial: 0,
      operaciones: 0,
      cocina: 0,
    };
    for (const u of usuarios) for (const r of u.roles) counts[r]++;
    return counts;
  }, [usuarios]);

  const sinRol = useMemo(
    () => usuarios.filter((u) => u.roles.length === 0).length,
    [usuarios]
  );

  function toggleRole(usuario: UsuarioConRoles, role: UserRole) {
    const tiene = usuario.roles.includes(role);
    if (tiene) {
      revokeMut.mutate({ userId: usuario.user_id, role });
    } else {
      assignMut.mutate({ userId: usuario.user_id, role });
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Equipo"
        title="Usuarios y permisos"
        description={`${usuarios.length} ${
          usuarios.length === 1 ? "cuenta" : "cuentas"
        } registradas · gestión de roles para acceso por área`}
      />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
        <Stat kicker="Total" value={usuarios.length} />
        <Stat kicker={ROLE_LABELS.admin} value={totales.admin} />
        <Stat kicker={ROLE_LABELS.comercial} value={totales.comercial} />
        <Stat kicker={ROLE_LABELS.operaciones} value={totales.operaciones} />
        <Stat kicker={ROLE_LABELS.cocina} value={totales.cocina} />
      </div>

      {sinRol > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-[hsl(30_40%_70%)] bg-[hsl(30_50%_94%)] px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(30_55%_42%)]" strokeWidth={1.75} />
          <div className="text-[13px] leading-relaxed text-[hsl(30_55%_30%)]">
            {sinRol} {sinRol === 1 ? "cuenta no tiene rol asignado" : "cuentas no tienen rol asignado"}.
            No podrán acceder a la app hasta que se les asigne uno.
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por correo o rol..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
        </div>

        {usuariosQuery.isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={5} />
          </div>
        ) : usuariosQuery.isError ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <AlertCircle className="mb-3 h-6 w-6 text-destructive" strokeWidth={1.75} />
            <p className="font-serif text-[18px] text-foreground">No se pudo cargar la lista</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {(usuariosQuery.error as Error).message}
            </p>
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <ShieldCheck className="mb-3 h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-serif text-[18px] text-foreground">
              {usuarios.length === 0 ? "Sin usuarios registrados" : "Sin resultados"}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {usuarios.length === 0
                ? "Cuando alguien cree su cuenta aparecerá acá."
                : "Probá con otros términos de búsqueda."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-medium">Correo</TableHead>
                <TableHead className="font-medium">Roles</TableHead>
                <TableHead className="font-medium">Último ingreso</TableHead>
                <TableHead className="w-[140px] text-right font-medium">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((u) => (
                <TableRow key={u.user_id} className="group">
                  <TableCell>
                    <div className="font-medium text-foreground">{u.email}</div>
                    <div className="text-[11.5px] text-muted-foreground tabular-nums">
                      Creada {format(new Date(u.created_at), "d MMM yyyy", { locale: es })}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.roles.length === 0 ? (
                      <span className="text-[12px] italic text-muted-foreground">Sin rol asignado</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {u.roles.map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className="border-primary/40 bg-primary/5 font-normal text-primary"
                          >
                            {ROLE_LABELS[r]}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {u.last_sign_in_at
                      ? format(new Date(u.last_sign_in_at), "d MMM yyyy · HH:mm", { locale: es })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                          Cambiar roles
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Roles asignados
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {ROLE_KEYS.map((r) => {
                          const tiene = u.roles.includes(r);
                          return (
                            <DropdownMenuItem
                              key={r}
                              onSelect={(e) => {
                                e.preventDefault();
                                toggleRole(u, r);
                              }}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>{ROLE_LABELS[r]}</span>
                              {tiene && (
                                <Check className="h-4 w-4 text-primary" strokeWidth={2} />
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function Stat({ kicker, value }: { kicker: string; value: number }) {
  return (
    <div>
      <div className="kicker mb-1.5">{kicker}</div>
      <div className="font-serif text-[26px] leading-none tracking-[-0.02em] tabular-nums text-foreground md:text-[30px]">
        {value}
      </div>
    </div>
  );
}
