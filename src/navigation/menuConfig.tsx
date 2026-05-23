import React from "react";
import {
  LayoutDashboard, FolderOpen, Map, CalendarRange,
  ListTodo, LayoutGrid, Clock, FileCheck2,
  BarChart2, AlertTriangle, ShieldCheck,
  Users, Settings, Building2, Network, Inbox, GitBranch, Layers, BookOpen,
} from "lucide-react";
import type { AppRole } from "../auth/permissions";

export interface NavItem {
  id: string;
  label: string;
  route: string;
  icon: React.ReactNode;
  requiredRoles: AppRole[];   // [] = visible to ALL roles
  optional?: boolean;         // won't break MVP if not implemented
  permissionKey?: string;     // RBAC VIEW_ key — si se define, oculta el item si el permiso es false
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
    { id: "dashboard", label: "Inicio",    route: "/dashboard", icon: ic(LayoutDashboard), requiredRoles: [], permissionKey: "VIEW_DASHBOARD" },
    { id: "projects",  label: "Proyectos", route: "/projects",  icon: ic(FolderOpen),      requiredRoles: [], permissionKey: "VIEW_PROJECTS" },
    { id: "roadmap",   label: "Roadmap",   route: "/roadmap",   icon: ic(Map),             requiredRoles: [], permissionKey: "VIEW_ROADMAP",   optional: true },
    { id: "gantt",     label: "Gantt",     route: "/gantt",     icon: ic(CalendarRange),   requiredRoles: [], permissionKey: "VIEW_GANTT" },
  ],
};

// ── B · EJECUCIÓN ──────────────────────────────────────────────────────────
// Admin, IT AirEuropa, Proveedor, Usuario (permisos variables)
const NAV_EJECUCION: NavGroup = {
  id: "execution",
  groupLabel: "Ejecución",
  items: [
    { id: "requests",  label: "Solicitudes", route: "/requests",  icon: ic(Inbox),      requiredRoles: [], permissionKey: "VIEW_REQUESTS" },
    { id: "backlog",   label: "Backlog",     route: "/backlog",   icon: ic(ListTodo),   requiredRoles: [], permissionKey: "VIEW_BACKLOG" },
    { id: "kanban",    label: "Kanban",      route: "/kanban",    icon: ic(LayoutGrid), requiredRoles: [], permissionKey: "VIEW_KANBAN" },
    { id: "activity",  label: "Actividad",   route: "/activity",  icon: ic(Clock),      requiredRoles: [], permissionKey: "VIEW_ACTIVITY" },
    { id: "evidences", label: "Evidencias",  route: "/evidences", icon: ic(FileCheck2), requiredRoles: [], permissionKey: "VIEW_EVIDENCES" },
  ],
};

// ── C · GOBIERNO ───────────────────────────────────────────────────────────
// Admin, IT AirEuropa. Usuario: opcional lectura. Proveedor: NO.
const NAV_GOBIERNO: NavGroup = {
  id: "governance",
  groupLabel: "Gobierno",
  items: [
    { id: "reports", label: "Informes / KPIs",    route: "/reports", icon: ic(BarChart2),     requiredRoles: [], permissionKey: "VIEW_REPORTS" },
    { id: "risks",   label: "Riesgos y Bloqueos", route: "/risks",   icon: ic(AlertTriangle), requiredRoles: [], permissionKey: "VIEW_RISKS",   optional: true },
    { id: "audit",   label: "Auditoría",           route: "/audit",   icon: ic(ShieldCheck),   requiredRoles: [], permissionKey: "VIEW_AUDIT",   optional: true },
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
    { id: "admin-users",        label: "Usuarios",            route: "/admin/users",        icon: ic(Users),      requiredRoles: ["Admin"] },
    { id: "admin-teams",        label: "Equipos",             route: "/admin/teams",        icon: ic(Network),    requiredRoles: ["Admin"] },
    { id: "admin-providers",    label: "Proveedores",         route: "/admin/providers",    icon: ic(Building2),  requiredRoles: ["Admin"] },
    { id: "admin-areas",        label: "Áreas",               route: "/admin/areas",        icon: ic(Building2),  requiredRoles: ["Admin"] },
    { id: "admin-settings",     label: "Configuración",       route: "/admin/settings",     icon: ic(Settings),   requiredRoles: ["Admin"] },
    { id: "admin-permissions",  label: "Permisos RBAC",       route: "/admin/permissions",  icon: ic(ShieldCheck), requiredRoles: ["Admin"] },
    { id: "admin-profiles",     label: "Perfiles de Permisos",route: "/admin/profiles",     icon: ic(Layers),     requiredRoles: ["Admin"] },
    { id: "admin-state-machine",label: "Máquina de estados",  route: "/admin/state-machine",icon: ic(GitBranch),  requiredRoles: ["Admin"] },    { id: "admin-help",          label: "Ayuda contextual",      route: "/admin/help",          icon: ic(BookOpen),    requiredRoles: ["Admin"] },  ],
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
