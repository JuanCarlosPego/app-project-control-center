import React from "react";
import {
  LayoutDashboard, FolderOpen, Map, CalendarRange,
  ListTodo, LayoutGrid, Clock, FileCheck2,
  BarChart2, AlertTriangle, ShieldCheck,
  Users, Settings, Building2, Network, Inbox, GitBranch,
} from "lucide-react";
import type { AppRole } from "../auth/permissions";

export interface NavItem {
  id: string;
  label: string;
  route: string;
  icon: React.ReactNode;
  requiredRoles: AppRole[];   // [] = visible to ALL roles
  optional?: boolean;         // won't break MVP if not implemented
  children?: NavItem[];
}

export interface NavGroup {
  id: string;
  groupLabel: string;
  items: NavItem[];
}

const ic = (Icon: React.ElementType) => <Icon size={17} strokeWidth={1.8} />;

// ── A · PLANIFICACIÓN ──────────────────────────────────────────────────────
// Admin, IT AirEuropa, Usuario (lectura). Proveedor: configurable (NO por defecto)
const NAV_PLANIFICACION: NavGroup = {
  id: "planning",
  groupLabel: "Planificación",
  items: [
    { id: "dashboard", label: "Inicio",    route: "/dashboard", icon: ic(LayoutDashboard), requiredRoles: [] },
    { id: "projects",  label: "Proyectos", route: "/projects",  icon: ic(FolderOpen),      requiredRoles: [] },
    { id: "roadmap",   label: "Roadmap",   route: "/roadmap",   icon: ic(Map),             requiredRoles: ["Admin", "IT AirEuropa", "Usuario"], optional: true },
    { id: "gantt",     label: "Gantt",     route: "/gantt",     icon: ic(CalendarRange),   requiredRoles: ["Admin", "IT AirEuropa", "Usuario"] },
  ],
};

// ── B · EJECUCIÓN ──────────────────────────────────────────────────────────
// Admin, IT AirEuropa, Proveedor, Usuario (permisos variables)
const NAV_EJECUCION: NavGroup = {
  id: "execution",
  groupLabel: "Ejecución",
  items: [
    { id: "requests", label: "Solicitudes", route: "/requests", icon: ic(Inbox),      requiredRoles: [] },
    { id: "backlog",  label: "Backlog",     route: "/backlog",  icon: ic(ListTodo),   requiredRoles: [] },
    { id: "kanban",   label: "Kanban",      route: "/kanban",   icon: ic(LayoutGrid), requiredRoles: [] },
    { id: "activity", label: "Actividad",   route: "/activity", icon: ic(Clock),      requiredRoles: [] },
    { id: "evidences", label: "Evidencias", route: "/evidences", icon: ic(FileCheck2), requiredRoles: [] },
  ],
};

// ── C · GOBIERNO ───────────────────────────────────────────────────────────
// Admin, IT AirEuropa. Usuario: opcional lectura. Proveedor: NO.
const NAV_GOBIERNO: NavGroup = {
  id: "governance",
  groupLabel: "Gobierno",
  items: [
    { id: "reports", label: "Informes / KPIs",    route: "/reports", icon: ic(BarChart2),     requiredRoles: ["Admin", "IT AirEuropa"] },
    { id: "risks",   label: "Riesgos y Bloqueos", route: "/risks",   icon: ic(AlertTriangle), requiredRoles: ["Admin", "IT AirEuropa"], optional: true },
    { id: "audit",   label: "Auditoría",           route: "/audit",   icon: ic(ShieldCheck),   requiredRoles: ["Admin", "IT AirEuropa"], optional: true },
  ],
};

// ── D · ADMINISTRACIÓN ─────────────────────────────────────────────────────
// Admin ONLY — guarded at render + route level
export const NAV_ADMIN_ITEM: NavItem = {
  id: "admin",
  label: "Administración",
  route: "/admin",
  icon: ic(Settings),
  requiredRoles: ["Admin"],
  children: [
    { id: "admin-users",       label: "Usuarios",      route: "/admin/users",       icon: ic(Users),      requiredRoles: ["Admin"] },
    { id: "admin-teams",       label: "Equipos",       route: "/admin/teams",       icon: ic(Network),    requiredRoles: ["Admin"] },
    { id: "admin-providers",   label: "Proveedores",   route: "/admin/providers",   icon: ic(Building2),  requiredRoles: ["Admin"] },
    { id: "admin-settings",      label: "Configuración",     route: "/admin/settings",      icon: ic(Settings),   requiredRoles: ["Admin"] },
    { id: "admin-permissions",   label: "Permisos RBAC",     route: "/admin/permissions",   icon: ic(ShieldCheck), requiredRoles: ["Admin"] },
    { id: "admin-state-machine", label: "Máquina de estados", route: "/admin/state-machine", icon: ic(GitBranch),  requiredRoles: ["Admin"] },
  ],
};

export const NAV_ADMIN_GROUP: NavGroup = {
  id: "admin-group",
  groupLabel: "Administración",
  items: [NAV_ADMIN_ITEM],
};

// ── Full menu ──────────────────────────────────────────────────────────────
export const NAV_GROUPS: NavGroup[] = [
  NAV_PLANIFICACION,
  NAV_EJECUCION,
  NAV_GOBIERNO,
  NAV_ADMIN_GROUP,
];
