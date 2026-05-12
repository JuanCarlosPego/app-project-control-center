// ─────────────────────────────────────────────────────────
//  src/services/activityService.ts
//  Servicio para el feed de actividad / timeline.
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { ActivityLogEntry } from "../types/domain";

export interface ActivityFilters {
  projectId?:  string;
  entityType?: string;
  action?:     string;
  whoRole?:    string;
  from?:       string;   // "YYYY-MM-DD"
  to?:         string;   // "YYYY-MM-DD"
  query?:      string;
}

export const getActivityFeed = (filters: ActivityFilters = {}): Promise<ActivityLogEntry[]> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const qs = params.toString();
  return apiClient.get(`/activity${qs ? `?${qs}` : ""}`);
};

// ── Acciones conocidas con etiqueta legible ──────────────
export const ACTION_LABELS: Record<string, string> = {
  STATE_CHANGED:       "Cambio de estado",
  WORKITEM_CREATED:    "Tarea creada",
  PROJECT_CREATED:     "Proyecto creado",
  EVIDENCE_ADDED:      "Evidencia añadida",
  COMMENT_ADDED:       "Comentario añadido",
  JIRA_COMMENT_SENT:   "Comentario Jira enviado",
  SETTINGS_CHANGED:    "Configuración cambiada",
  WIP_LIMIT_CHANGED:   "Límite WIP actualizado",
  RBAC_CHANGED:        "Permiso RBAC modificado",
  RBAC_RESET_TO_DEFAULTS: "RBAC restaurado",
};

export const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

// ── Tipos de entidad ─────────────────────────────────────
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  WorkItem: "Tarea",
  Project:  "Proyecto",
  Evidence: "Evidencia",
  Settings: "Configuración",
  RBAC:     "Permisos RBAC",
};

// ── Exportar CSV ─────────────────────────────────────────
export function exportActivityCSV(
  logs: ActivityLogEntry[],
  users: { id: string; displayName: string }[],
  projects: { id: string; name: string; code: string }[],
) {
  const userMap    = Object.fromEntries(users.map((u) => [u.id, u.displayName]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, `${p.code} — ${p.name}`]));

  const header = ["Fecha", "Acción", "Entidad", "Quién", "Rol", "Proyecto", "Desde", "Hasta", "Nota"];
  const rows   = logs.map((l) => [
    new Date(l.at).toLocaleString("es-ES"),
    ACTION_LABELS[l.action] ?? l.action,
    ENTITY_TYPE_LABELS[l.entityType] ?? l.entityType,
    userMap[l.who] ?? l.who,
    l.whoRole,
    l.projectId ? (projectMap[l.projectId] ?? l.projectId) : "—",
    l.from ? `"${l.from}"` : "—",
    l.to   ? `"${l.to}"` : "—",
    l.note ? `"${l.note}"` : "",
  ]);

  const csv  = [header, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `actividad-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
