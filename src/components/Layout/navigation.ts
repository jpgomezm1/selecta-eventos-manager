import {
  Users,
  Calendar,
  FileText,
  Boxes,
  CookingPot,
  Warehouse,
  UserCircle,
  SlidersHorizontal,
  TrendingUp,
  Truck,
  LayoutDashboard,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types/roles";

export type NavSection = {
  label: string;
  items: NavItem[];
};

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Ruta "base" para marcar activo en rutas hijas (ej: /eventos/:id) */
  match?: RegExp;
  /** Roles que tienen acceso. Si se omite, todos los autenticados. */
  roles?: UserRole[];
};

export const navSections: NavSection[] = [
  {
    label: "Operación",
    items: [
      { title: "Panorama", url: "/panorama", icon: LayoutDashboard, match: /^\/panorama/ },
      { title: "Eventos", url: "/eventos", icon: Calendar, match: /^\/eventos/ },
      { title: "Pipeline", url: "/pipeline", icon: TrendingUp, match: /^\/pipeline/, roles: ["admin", "comercial"] },
      { title: "Cotizaciones", url: "/cotizaciones", icon: FileText, match: /^\/cotizaciones|^\/cotizador/, roles: ["admin", "comercial", "operaciones"] },
    ],
  },
  {
    label: "Recursos",
    items: [
      { title: "Personal", url: "/personal", icon: Users, match: /^\/personal/, roles: ["admin", "operaciones"] },
      { title: "Clientes", url: "/clientes", icon: UserCircle, match: /^\/clientes/, roles: ["admin", "comercial"] },
      { title: "Transporte", url: "/transporte", icon: Truck, match: /^\/transporte/, roles: ["admin", "operaciones"] },
    ],
  },
  {
    label: "Cocina y bodega",
    items: [
      { title: "Recetario", url: "/recetario", icon: CookingPot, match: /^\/recetario/, roles: ["admin", "cocina"] },
      { title: "Inventario", url: "/inventario", icon: Warehouse, match: /^\/inventario/, roles: ["admin", "cocina"] },
      { title: "Menaje", url: "/bodega", icon: Boxes, match: /^\/bodega/, roles: ["admin", "operaciones"] },
    ],
  },
  {
    label: "Ajustes",
    items: [
      { title: "Catálogos", url: "/catalogos", icon: SlidersHorizontal, match: /^\/catalogos/ },
      { title: "Usuarios", url: "/usuarios", icon: ShieldCheck, match: /^\/usuarios/, roles: ["admin"] },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);

export function matchNavItem(pathname: string): NavItem | undefined {
  return allNavItems.find((item) => item.match?.test(pathname));
}

export function filterNavSectionsByRoles(roles: UserRole[]): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.some((r) => roles.includes(r))),
    }))
    .filter((section) => section.items.length > 0);
}
