export type UserRole = "admin" | "comercial" | "operaciones" | "cocina";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administración",
  comercial: "Comercial",
  operaciones: "Operaciones",
  cocina: "Cocina",
};

export function hasAnyRole(userRoles: UserRole[], allowed: UserRole[]): boolean {
  return userRoles.some((r) => allowed.includes(r));
}
