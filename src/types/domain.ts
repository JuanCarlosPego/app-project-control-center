// ─────────────────────────────────────────────────────────
//  src/types/domain.ts
//  Tipos del dominio compartidos por servicios y componentes
// ─────────────────────────────────────────────────────────

export type AppRole = "Admin" | "IT AirEuropa" | "Proveedor" | "Usuario" | "Invitado";
export type DeliveryOwnerType = "IT" | "Proveedor";
export type TeamType = "Area" | "Provider" | "Internal";
export type ProjectStatus = "Pendiente" | "En curso" | "Bloqueado" | "Cerrado";
export type WorkItemType = "Feature" | "Bug" | "TechDebt" | "Spike";
export type Priority = "Alta" | "Media" | "Baja";
export type EvidenceType = "link" | "comment" | "file";
export type RiskSeverity = "Alta" | "Media" | "Baja";
export type RiskStatus = "Abierto" | "En mitigación" | "Resuelto";
export type SyncStatus = "OK" | "Pending" | "Error";

// ── Solicitudes (Requests) ────────────────────────────────
export type RequestType =
  | "Bug"
  | "Mejora"
  | "Feature"
  | "Incidencia"
  | "Consulta"
  | "CambioNormativo"
  | "Impedimento";

export type RequestStatus =
  | "Nuevo"
  | "En revisión"
  | "Info requerida"
  | "Aprobada"
  | "Rechazada"
  | "Convertida"
  | "Cancelada";

export interface Request {
  id: string;
  year: number;
  title: string;
  description: string;
  type: RequestType;
  priority: Priority;
  requestedByUserId: string;
  requestedByRole: AppRole;
  /** Team de Área (si solicitante es Usuario) o Provider (si Proveedor) */
  requestedByTeamId: string | null;
  relatedProjectId: string | null;
  status: RequestStatus;
  /** IT/Admin que gestiona la solicitud */
  triageOwnerUserId: string | null;
  triageNote: string | null;
  createdOn: string;
  updatedOn: string;
  /** ID del WorkItem creado al convertir */
  convertedWorkItemId: string | null;
  /** Nota al cancelar (opcional) */
  cancelledNote: string | null;
}

// ── Catálogos ───────────────────────────────────────────
export interface BusinessArea {
  id: string;
  name: string;
}

/**
 * Team — agrupación de usuarios.
 * type:
 *   "Area"     → área de negocio interna (ej. DIROPS, DIRPROD)
 *   "Provider" → empresa proveedora externa (ej. 40West, SkyTech)
 *   "Internal" → equipo interno IT (ej. IT AirEuropa)
 *
 * Regla: usuarios con role="Proveedor" deben pertenecer al menos
 * a un team con type="Provider".
 */
export interface Team {
  id: string;
  name: string;
  type: TeamType;
  isActive: boolean;
}

/** @deprecated Usar Team con type="Provider". Mantenido por retrocompatibilidad. */
export interface Provider {
  id: string;
  name: string;
  contactEmail: string;
}

export interface State {
  id: string;
  name: string;
  category: string;
  order: number;
}

export interface Transition {
  /** Identificador único (necesario para CRUD en Admin) */
  id: string;
  fromStateId: string;
  toStateId: string;
  allowedRoles: AppRole[];
  /** Roles a los que se puede reasignar la tarea al ejecutar esta transición */
  assignToRole?: AppRole[];
  /** Auto-asignar team según el nuevo rol (IT→team-it, Proveedor→providerTeamId, Usuario→área) */
  autoAssignTeam?: boolean;
  /** Obligatorio elegir usuario concreto antes de confirmar el movimiento */
  requireUserAssignment?: boolean;
  /** Requiere adjuntar evidencia (link, comentario, archivo) */
  requireEvidence?: boolean;
  evidenceTypes?: EvidenceType[];
  /** Requiere al menos un comentario. Shorthand: requireEvidence + evidenceTypes:["comment"] */
  requireComment?: boolean;
  /** Muestra diálogo de confirmación antes de ejecutar */
  confirmMove?: boolean;
}

// ── Entidades principales ────────────────────────────────
export interface Project {
  id: string;
  code: string;
  name: string;
  businessAreaId: string;
  deliveryOwnerType: DeliveryOwnerType;
  /** @deprecated Usar providerTeamId. Mantenido por retrocompatibilidad. */
  providerId: string;
  /**
   * Equipo proveedor responsable (team.type="Provider").
   * Obligatorio cuando deliveryOwnerType="Proveedor".
   */
  providerTeamId: string | null;
  status: ProjectStatus;
  category: string;
  priority: Priority;
  startDate: string;
  endDate: string;
  progress: number;
  blockedReason?: string;
  requestedByRole?: AppRole;
  requestedByUserId?: string;
  /** Rol responsable actual de la épica */
  assignedToRole?: AppRole;
  /** Equipo responsable: team.type debe coincidir con assignedToRole */
  assignedToTeamId?: string | null;
  /** Usuario responsable concreto — debe pertenecer a assignedToTeamId si está informado */
  assignedToUserId?: string | null;
}

export interface WorkItem {
  id: string;
  projectId: string;
  title: string;
  type: WorkItemType;
  priority: Priority;
  stateId: string;
  requestedByRole?: AppRole;
  requestedByUserId?: string;
  /** Rol responsable actual */
  assignedToRole: AppRole;
  /** Equipo responsable — debe coincidir con assignedToRole */
  assignedToTeamId: string | null;
  /** Usuario concreto asignado — debe pertenecer a assignedToTeamId si informado */
  assignedToUserId: string;
  startDate: string;
  endDate: string;
  progress: number;
  tags: string[];
  createdBy: string;
  blockedReason?: string;
  // ── Integración Jira ────────────────────────────
  jiraIssueKey?: string;
  jiraUrl?: string;
  jiraState?: string;
  sprintName?: string;
  syncStatus: SyncStatus;
  syncError?: string;
}

export interface Evidence {
  id: string;
  entityType: "WorkItem" | "Project";
  entityId: string;
  type: EvidenceType;
  value: string;
  comment: string;
  createdBy: string;
  createdOn: string;
}

export interface ActivityLogEntry {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  from: string;
  to: string;
  who: string;
  whoRole: AppRole;
  at: string;
  note?: string;
}

export interface Risk {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  severity: RiskSeverity;
  status: RiskStatus;
  ownerRole: AppRole;
  /** ID del AppUser responsable del riesgo (au-XXX). Si no existe, fallback a linkedWorkItem.assignedToUserId. */
  assignedToUserId?: string;
  dueDate: string;
  linkedWorkItemId: string;
  createdBy: string;
  createdOn: string;
  closedBy?: string;
  closedOn?: string;
  closeComment?: string;
}

export interface User {
  id: string;
  displayName: string;
  email: string;
  roles: AppRole[];
  /** @deprecated Usar teamIds. Mantenido por retrocompatibilidad con mock legacy. */
  providerId?: string;
  businessAreaId?: string;
}

/**
 * AppUser — usuario registrado en la aplicación.
 * teamIds: lista de teams a los que pertenece (puede ser varios).
 * Regla: role="Proveedor" → debe tener al menos 1 teamId de type="Provider".
 * Regla: role="Invitado" → nunca puede ser assignedToUserId en workItems/projects.
 */
export interface AppUser {
  id: string;
  displayName: string;
  email: string;
  upn: string;
  role: AppRole;
  /** Equipos a los que pertenece — array porque un usuario puede estar en varios */
  teamIds: string[];
  isActive: boolean;
  createdOn?: string;
  updatedOn?: string;
}

export interface TenantUser {
  upn: string;
  displayName: string;
  email: string;
}

// ── Payloads de API ──────────────────────────────────────
export interface EvidencePayload {
  type: EvidenceType;
  value: string;
  comment: string;
}

export interface PatchWorkItemStatePayload {
  toStateId: string;
  evidence?: EvidencePayload;
  /** Nuevo usuario asignado (obligatorio cuando la transición cambia de rol) */
  assignedToUserId?: string;
  /** Equipo del nuevo usuario asignado */
  assignedToTeamId?: string | null;
}

/** Payload para editar campos generales de un WorkItem */
export interface PatchWorkItemPayload {
  title?: string;
  description?: string;
  type?: WorkItemType;
  priority?: Priority;
  assignedToRole?: AppRole;
  assignedToTeamId?: string | null;
  assignedToUserId?: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  blockedReason?: string;
}

export interface ActionRequest {
  id: string;
  workItemId: string;
  actionType: "Transition" | "Comment";
  payload: Record<string, unknown>;
  status: "Pending" | "Processing" | "Done" | "Error";
  createdAt: string;
  errorMessage?: string;
}

// ── Settings de aplicación ───────────────────────────────
export interface AppSettings {
  strictValidation: boolean;  // Solo transiciones definidas en transitions[]
  adminBypass: boolean;       // Admin puede saltar a cualquier estado
  jiraSyncEnabled: boolean;
  wipLimits: Record<string, number>;  // stateId → límite (0 = sin límite)
}

// ── UI Events (telemetría, NO auditoría) ─────────────────
export type UIEventAction =
  | "DROP_BLOCKED_BY_RBAC"
  | "DROP_BLOCKED_WIP_LIMIT"
  | "DROP_BLOCKED_STRICT_TRANSITION"
  | "DROP_BLOCKED_OWNERSHIP"
  | "ACTION_BLOCKED_OWNERSHIP"
  | "CARD_LOCKED_NO_TRANSITIONS"
  /** Transición no existe en la máquina de estados (sin strictValidation) */
  | "DROP_INVALID_TRANSITION"
  /** Error de API/sync al confirmar el move: se revirtió a posición original */
  | "DROP_API_ERROR"
  /** Se abrió el modal de evidencia (move pausado pendiente de confirmar) */
  | "DROP_EVIDENCE_REQUIRED";

export interface UIEvent {
  id: string;
  entityType: "WorkItem";
  entityId: string;
  action: UIEventAction;
  fromStateId: string;
  toStateId: string;
  who: string;
  whoRole: AppRole;
  timestamp: string;
  meta?: Record<string, unknown>;
}

// ── Priority weights (Home Inteligente) ──────────────────
export interface PriorityWeights {
  overdue: number;
  dueSoon3d: number;
  dueSoon7d: number;
  blocked: number;
  evidenceRequired: number;
  syncError: number;
  syncPending: number;
  highPriority: number;
  mediumPriority: number;
  assignedToMe: number;
  waitingOnOthers: number;
  noRecentActivity7d: number;
}

// ── Administración: Settings ─────────────────────────────
export interface SystemSettings {
  strictValidation: boolean;
  adminBypass: boolean;
  closeCommentRequired: boolean;
  closeChecklistRequired: boolean;
  weekDays: number;
  priorityWeights?: PriorityWeights;
}

export type WipLimits = Record<string, number>;

export interface RbacPermission {
  key: string;
  label: string;
  group: "TAREAS" | "TRANSICIONES" | "VISTAS";
}

export type RolePermissionsMap = Record<string, Record<string, boolean>>;

export interface AdminAuditEntry {
  id: string;
  category: "Settings" | "RBAC" | "User";
  action: string;
  who: string;
  whoRole: string;
  at: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  description: string;
}

// ── Auditoría formal unificada ────────────────────────────
export type AuditEntityType =
  | "WorkItem"
  | "Project"
  | "Evidence"
  | "Risk"
  | "Settings"
  | "RBAC"
  | "User";

export interface AuditEntry {
  id: string;
  /** Fuente: "activityLog" = actividad humana normalizada; "auditLog" = cambio de sistema */
  source: "activityLog" | "auditLog";
  projectId: string;
  entityType: AuditEntityType;
  entityId: string;
  action: string;
  who: string;
  whoRole: string;
  at: string;
  /** Valor anterior (texto o JSON) */
  from?: string;
  /** Valor posterior (texto o JSON) */
  to?: string;
  /** Comentario / nota libre */
  note?: string;
  /** Before/After estructurado (solo en auditLog) */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  /** Descripción legible (solo en auditLog) */
  description?: string;
  /** Indica si es un cambio crítico del sistema */
  isCritical: boolean;
}

// ── Gestión de usuarios de aplicación ────────────────────
export interface AppUser {
  id: string;
  displayName: string;
  email: string;
  upn: string;
  role: AppRole;
  isActive: boolean;
  createdOn?: string;
  updatedOn?: string;
}

/** Usuario del tenant (para el buscador/people-picker) */
export interface TenantUser {
  upn: string;
  displayName: string;
  email: string;
}

// ── KPIs de reports ──────────────────────────────────────
export interface ReportKpis {
  totalProjects: number;
  inProgress: number;
  blocked: number;
  closed: number;
  totalWorkItems: number;
  workItemsByState: Record<string, number>;
  blockedWorkItems: number;
  avgProgress: number;
}
