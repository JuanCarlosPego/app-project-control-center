// ─────────────────────────────────────────────────────────
//  src/services/auditService.ts
//  Servicio de auditoría formal — fusiona auditLog + activityLog.
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { AuditEntry, AuditEntityType, WorkItem, Project } from "../types/domain";

// ── Filtros ───────────────────────────────────────────────
export interface AuditFilters {
  projectId?:            string;
  entityType?:           AuditEntityType | "";
  action?:               string;
  actor?:                string;
  actorRole?:            string;
  from?:                 string;   // ISO date "YYYY-MM-DD"
  to?:                   string;   // ISO date "YYYY-MM-DD"
  query?:                string;   // texto libre
  onlyCritical?:         boolean;
  // ── Quick filters personales (client-side) ────────────
  onlyAffectsMe?:        boolean;  // eventos en WorkItems asignados a mí
  onlyWaitingOnOthers?:  boolean;  // eventos en WorkItems solicitados por mí, asignados a otros
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  projectId: "", entityType: "", action: "",
  actor: "", actorRole: "", from: "", to: "",
  query: "", onlyCritical: false,
  onlyAffectsMe: false, onlyWaitingOnOthers: false,
};

export function hasActiveAuditFilters(f: AuditFilters): boolean {
  return !!(
    f.projectId || f.entityType || f.action || f.actor ||
    f.actorRole || f.from || f.to || f.query || f.onlyCritical ||
    f.onlyAffectsMe || f.onlyWaitingOnOthers
  );
}

// ── Selectores client-side personales ────────────────────

/**
 * Eventos en WorkItems cuyo assignedToUserId === currentUserId.
 * Sólo aplica a entradas de tipo WorkItem.
 */
export function getAuditAffectingMe(
  entries:       AuditEntry[],
  workItems:     WorkItem[],
  currentUserId: string,
): AuditEntry[] {
  const myWiIds = new Set(
    workItems
      .filter((w) => w.assignedToUserId === currentUserId)
      .map((w) => w.id),
  );
  return entries.filter(
    (e) => e.entityType === "WorkItem" && myWiIds.has(e.entityId),
  );
}

/**
 * Eventos en WorkItems donde:
 *   (workItem.requestedByUserId === currentUserId OR project.requestedByUserId === currentUserId)
 *   AND workItem.assignedToUserId !== currentUserId
 * Sólo aplica a entradas de tipo WorkItem.
 */
export function getAuditWaitingOnOthers(
  entries:       AuditEntry[],
  workItems:     WorkItem[],
  projects:      Project[],
  currentUserId: string,
): AuditEntry[] {
  const wiMap   = new Map(workItems.map((w) => [w.id, w]));
  const projMap = new Map(projects.map((p) => [p.id, p]));
  return entries.filter((e) => {
    if (e.entityType !== "WorkItem") return false;
    const wi = wiMap.get(e.entityId);
    if (!wi) return false;
    const proj = wi.projectId ? projMap.get(wi.projectId) : undefined;
    const requestedByMe =
      wi.requestedByUserId === currentUserId ||
      (proj?.requestedByUserId === currentUserId);
    const assignedToOther = wi.assignedToUserId !== currentUserId;
    return requestedByMe && assignedToOther;
  });
}

/**
 * Aplica los quick-filters personales (onlyAffectsMe, onlyWaitingOnOthers)
 * sobre la lista de entradas ya obtenida del servidor.
 * Retorna la lista filtrada (unión si ambos activos).
 */
export function applyPersonalAuditFilters(
  entries:       AuditEntry[],
  workItems:     WorkItem[],
  projects:      Project[],
  filters:       Pick<AuditFilters, "onlyAffectsMe" | "onlyWaitingOnOthers">,
  currentUserId: string,
): AuditEntry[] {
  const { onlyAffectsMe, onlyWaitingOnOthers } = filters;
  if (!onlyAffectsMe && !onlyWaitingOnOthers) return entries;

  const affectsMe = onlyAffectsMe
    ? new Set(getAuditAffectingMe(entries, workItems, currentUserId).map((e) => e.id))
    : null;
  const waitingOn = onlyWaitingOnOthers
    ? new Set(getAuditWaitingOnOthers(entries, workItems, projects, currentUserId).map((e) => e.id))
    : null;

  return entries.filter((e) => {
    if (affectsMe && affectsMe.has(e.id)) return true;
    if (waitingOn && waitingOn.has(e.id)) return true;
    return false;
  });
}

// ── Entity types legibles ─────────────────────────────────
export const ENTITY_TYPE_OPTIONS: { value: AuditEntityType | ""; label: string }[] = [
  { value: "",          label: "Todos los tipos" },
  { value: "WorkItem",  label: "WorkItem (Tarea)" },
  { value: "Project",   label: "Proyecto (Épica)" },
  { value: "Evidence",  label: "Evidencia" },
  { value: "Risk",      label: "Riesgo" },
  { value: "Settings",  label: "Configuración" },
  { value: "RBAC",      label: "RBAC (Permisos)" },
  { value: "User",      label: "Usuario" },
];

// Acciones que se consideran críticas
export const CRITICAL_ACTIONS = new Set([
  "RBAC_CHANGED", "RBAC_RESET_TO_DEFAULTS",
  "SETTINGS_CHANGED", "WIP_LIMIT_CHANGED",
  "USER_DEACTIVATED", "USER_CREATED",
  "STATE_CHANGED",   // cuando to = Cerrado
]);

// ── Etiquetas de acción amigables ─────────────────────────
export const ACTION_LABELS: Record<string, string> = {
  STATE_CHANGED:          "Cambio de estado",
  WORKITEM_CREATED:       "WorkItem creado",
  EVIDENCE_ADDED:         "Evidencia añadida",
  COMMENT_ADDED:          "Comentario añadido",
  PROJECT_CREATED:        "Proyecto creado",
  PROJECT_UPDATED:        "Proyecto actualizado",
  RISK_CREATED:           "Riesgo creado",
  RISK_UPDATED:           "Riesgo actualizado",
  RISK_CLOSED:            "Riesgo cerrado",
  RBAC_CHANGED:           "Cambio de permisos RBAC",
  RBAC_RESET_TO_DEFAULTS: "Reset RBAC a defaults",
  SETTINGS_CHANGED:       "Cambio de configuración",
  WIP_LIMIT_CHANGED:      "Cambio de límite WIP",
  USER_CREATED:           "Usuario creado",
  USER_UPDATED:           "Usuario actualizado",
  USER_ACTIVATED:         "Usuario activado",
  USER_DEACTIVATED:       "Usuario desactivado",
  TEAM_CREATED:           "Equipo creado",
  TEAM_UPDATED:           "Equipo actualizado",
  TEAM_ACTIVATED:         "Equipo activado",
  TEAM_DEACTIVATED:       "Equipo desactivado",
};

// ── Llamada al API ────────────────────────────────────────
export const getAuditLog = (filters: AuditFilters = {}): Promise<AuditEntry[]> => {
  const qs = new URLSearchParams();
  if (filters.projectId)   qs.set("projectId",   filters.projectId);
  if (filters.entityType)  qs.set("entityType",  filters.entityType);
  if (filters.action)      qs.set("action",      filters.action);
  if (filters.actor)       qs.set("actor",       filters.actor);
  if (filters.actorRole)   qs.set("actorRole",   filters.actorRole);
  if (filters.from)        qs.set("from",        filters.from);
  if (filters.to)          qs.set("to",          filters.to);
  if (filters.query)       qs.set("query",       filters.query);
  if (filters.onlyCritical) qs.set("onlyCritical", "true");
  const q = qs.toString();
  return apiClient.get(`/audit${q ? `?${q}` : ""}`);
};

// ── Exportar CSV ──────────────────────────────────────────
export function exportAuditCSV(entries: AuditEntry[], userMap: Record<string, string>): void {
  const headers = ["Fecha/Hora", "Actor", "Rol", "EntityType", "EntityId", "Acción", "Desde", "Hasta", "Nota/Descripción"];
  const rows = entries.map((e) => [
    new Date(e.at).toLocaleString("es-ES"),
    userMap[e.who] ?? e.who,
    e.whoRole,
    e.entityType,
    e.entityId,
    ACTION_LABELS[e.action] ?? e.action,
    e.from ?? "",
    e.to ?? "",
    e.note ?? e.description ?? "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url,
    download: `auditoria-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
