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
  type LucideIcon,
} from "lucide-react";

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
};

export const navSections: NavSection[] = [
  {
    label: "Operación",
    items: [
      { title: "Panorama", url: "/panorama", icon: LayoutDashboard, match: /^\/panorama/ },
      { title: "Eventos", url: "/eventos", icon: Calendar, match: /^\/eventos/ },
      { title: "Pipeline", url: "/pipeline", icon: TrendingUp, match: /^\/pipeline/ },
      { title: "Cotizaciones", url: "/cotizaciones", icon: FileText, match: /^\/cotizaciones|^\/cotizador/ },
    ],
  },
  {
    label: "Recursos",
    items: [
      { title: "Personal", url: "/personal", icon: Users, match: /^\/personal/ },
      { title: "Clientes", url: "/clientes", icon: UserCircle, match: /^\/clientes/ },
      { title: "Transporte", url: "/transporte", icon: Truck, match: /^\/transporte/ },
    ],
  },
  {
    label: "Cocina y bodega",
    items: [
      { title: "Recetario", url: "/recetario", icon: CookingPot, match: /^\/recetario/ },
      { title: "Inventario", url: "/inventario", icon: Warehouse, match: /^\/inventario/ },
      { title: "Menaje", url: "/bodega", icon: Boxes, match: /^\/bodega/ },
    ],
  },
  {
    label: "Ajustes",
    items: [
      { title: "Catálogos", url: "/catalogos", icon: SlidersHorizontal, match: /^\/catalogos/ },
    ],
  },
];

export const allNavItems: NavItem[] = navSections.flatMap((s) => s.items);

export function matchNavItem(pathname: string): NavItem | undefined {
  return allNavItems.find((item) => item.match?.test(pathname));
}
