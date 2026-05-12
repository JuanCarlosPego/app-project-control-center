// ── Types ──────────────────────────────────────────────────────────────────
export type KanbanStatus     = "ToDo" | "Doing" | "ReadyTest" | "Blocked" | "Done";
export type InitiativeStatus = "Pendiente" | "En Progreso" | "Completado";
export type Area             = "DIROPS" | "DIRPROD" | "PGI" | "40W";

export interface User {
  id: string;
  name: string;
  areas: Area[];
}

export interface Task {
  id: string;
  title: string;
  status: KanbanStatus;
  assignedTo: string; // User.id
}

export interface Initiative {
  id: string;
  title: string;
  area: Area;
  status: InitiativeStatus;
  tasks: Task[];
}

// ── Current session user (mock) ────────────────────────────────────────────
export const CURRENT_USER: User = {
  id: "u1",
  name: "Proveedor 1",
  areas: ["PGI"],
};

// ── Users ──────────────────────────────────────────────────────────────────
export const USERS: User[] = [
  { id: "u1", name: "Proveedor 1", areas: ["PGI"] },
  { id: "u2", name: "Proveedor 2", areas: ["DIROPS"] },
  { id: "u3", name: "Gestor PGI",  areas: ["PGI", "40W"] },
  { id: "u4", name: "Admin",       areas: ["DIROPS", "DIRPROD", "PGI", "40W"] },
];

// ── Initiatives ────────────────────────────────────────────────────────────
export const INITIATIVES: Initiative[] = [
  {
    id: "i1", title: "Automatización de Procesos", area: "PGI", status: "En Progreso",
    tasks: [
      { id: "t1", title: "Análisis de requisitos",  status: "Done",  assignedTo: "u1" },
      { id: "t2", title: "Diseño de flujos",         status: "Doing", assignedTo: "u1" },
      { id: "t3", title: "Implementación y pruebas", status: "ToDo",  assignedTo: "u3" },
    ],
  },
  {
    id: "i2", title: "Optimización Entregas PGI", area: "PGI", status: "Pendiente",
    tasks: [
      { id: "t4", title: "Mapeo de procesos actuales", status: "ToDo",    assignedTo: "u3" },
      { id: "t5", title: "Propuesta de mejoras",       status: "Blocked", assignedTo: "u1" },
    ],
  },
  {
    id: "i3", title: "Dashboard Operativo",  area: "DIROPS",  status: "Pendiente",
    tasks: [
      { id: "t6", title: "Definición de KPIs", status: "ToDo",  assignedTo: "u2" },
      { id: "t7", title: "Maquetación UI",     status: "Doing", assignedTo: "u4" },
    ],
  },
  {
    id: "i4", title: "Catálogo de Productos", area: "DIRPROD", status: "En Progreso",
    tasks: [
      { id: "t8", title: "Importar datos maestros", status: "ReadyTest", assignedTo: "u4" },
    ],
  },
  {
    id: "i5", title: "Integración 40W",       area: "40W",    status: "Pendiente",
    tasks: [
      { id: "t9", title: "Configuración API",   status: "ToDo", assignedTo: "u3" },
      { id: "t10", title: "Testing end-to-end", status: "ToDo", assignedTo: "u4" },
    ],
  },
];
