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

/**
 * Urgencia del solicitante:
 *   inmediato → bloqueo crítico de operación (SLA < 24h)
 *   semana    → impacto significativo, necesario esta semana
 *   mes       → planificable antes de fin de mes
 *   backlog   → mejora sin presión de tiempo
 */
export type RequestUrgency = "inmediato" | "semana" | "mes" | "backlog";

// ── Triage extendido ──────────────────────────────────────
/** Decisión final de triage IT */
export type TriageDecision =
  | "approve-backlog"  // Aprobada y deja en backlog (sin convertir aún)
  | "convert"          // Convertir directamente en WorkItem
  | "request-info"     // Pedir información al solicitante
  | "reject";          // Rechazar

/** Categorización interna IT de la solicitud */
export type TriageCategory = "Bug" | "Evolutivo" | "Integración" | "Reporte" | "Normativa";

/** Estimación de tamaño IT */
/**(XS <2 días, S 2-5 días, M 1-2 semanas, L >2 semanas)*/  
export type TriageEstimate = "XS" | "S" | "M" | "L";

/** Motivo de rechazo estandarizado */
export type TriageReason =
  | "Fuera alcance"
  | "Duplicada"
  | "No viable"
  | "No prioritario"
  | "Falta información";

/** Bucket de backlog para solicitudes aprobadas sin convertir */
export type TriageBacklogBucket =
  | "Pendiente priorización"
  | "Plan Q3"
  | "En espera"
  | "Sin fecha";

export type RequestStatus =
  | "Nuevo"
  | "En revisión"
  | "Info requerida"
  | "Aprobada"
  | "En ejecución"
  | "Resuelta"
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
  /** Urgencia declarada por el solicitante */
  urgency?: RequestUrgency;
  /** Área de negocio que origina la solicitud */
  businessAreaId?: string | null;
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

  // ── Triage extendido (gobierno IT) ───────────────────
  /** Decisión del triage (puede ser borrador) */
  triageDecision?: TriageDecision | null;
  /** Categoría interna IT */
  triageCategory?: TriageCategory | null;
  /** Prioridad IT (puede diferir de la prioridad del solicitante) */
  triagePriorityIT?: Priority | null;
  /** Estimación de tamaño */
  triageEstimate?: TriageEstimate | null;
  /** Equipo ejecutor asignado */
  triageExecutorTeamId?: string | null;
  /** Responsable individual asignado */
  triageExecutorUserId?: string | null;
  /** Motivo de rechazo estandarizado */
  triageReason?: TriageReason | null;
  /** Bucket de backlog cuando se aprueba sin convertir */
  triageBacklogBucket?: TriageBacklogBucket | null;
  /** true = aprobada y deja en backlog (no convertida aún) */
  approvedInBacklog?: boolean;

  // ── Progreso calculado a partir de tareas asociadas ──
  /** 0-100. Calculado automáticamente desde las tareas asociadas */
  progressPct?: number;
  /** Número total de tareas asociadas */
  tasksTotal?: number;
  /** Número de tareas cerradas (stateId=st-cls) */
  tasksDone?: number;
  /** Última vez que se recalculó el progreso (ISO datetime) */
  lastProgressCalcAt?: string;
}

/** Adjunto ligado a una solicitud (almacenado en cproroad_requestattachment) */
export interface RequestAttachment {
  id: string;
  requestId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** URL de descarga (Dataverse webresource URL o base64 dataUrl en LOCAL) */
  url: string;
  uploadedBy: string;
  uploadedOn: string;
}

// ── Catálogos ───────────────────────────────────────────
export interface BusinessArea {
  id: string;
  name: string;
  description?: string;
  /** Si no está presente se trata como activa (retrocompatibilidad) */
  isActive?: boolean;
}

// ── Áreas de negocio: membresías y ownership ─────────────
export type AreaMemberRoleType = "Member" | "KeyUser";

export interface UserAreaMembership {
  id: string;
  userId: string;
  businessAreaId: string;
  roleType: AreaMemberRoleType;
}

export interface UserAreaOwnership {
  id: string;
  userId: string;
  businessAreaId: string;
  roleType: "PO";
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
export type VisibilityMode = "Enterprise" | "Restricted";

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
  /**
   * Modo de visibilidad:
   *   "Enterprise" → cualquier usuario autenticado puede ver el proyecto
   *   "Restricted"  → solo usuarios cuyos teamIds intersecten con visibilityTeamIds
   * Admin siempre ve todos (bypass).
   */
  visibilityMode?: VisibilityMode;
  /** Equipos que pueden ver el proyecto cuando visibilityMode = "Restricted" */
  visibilityTeamIds?: string[];
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
  /** ID de la solicitud de origen (1:N). null si no proviene de solicitud. */
  requestId?: string | null;
  // ── Integración Jira ────────────────────────────
  jiraIssueKey?: string;
  jiraUrl?: string;
  jiraState?: string;
  sprintName?: string;
  syncStatus: SyncStatus;
  syncError?: string;
}

/**
 * Tarea en borrador para creación masiva desde triage.
 * Se usa en FullTriagePayload.tasks y en el wizard de conversión multi-tarea.
 */
export interface DraftTask {
  title: string;
  type: WorkItemType;
  priority: Priority;
  stateId: string;
  assignedToRole: AppRole;
  assignedToTeamId: string | null;
  assignedToUserId: string;
  startDate?: string;
  endDate?: string;
  tags?: string[];
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
 * profileIds: perfiles de permisos adicionales asignados (ej. ["pp-po"]).
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
  /**
   * IDs de PermissionProfile asignados (ej. ["pp-po"]).
   * Solo Admin puede asignar perfiles. Sincronizado con la tabla userProfiles (N:N).
   */
  profileIds?: string[];
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

// ── Permission Profiles ───────────────────────────────────
/**
 * Perfil de permisos adicionales (ej. "PO").
 * NO es un rol. Se asigna a usuarios concretos para elevar permisos
 * sin cambiar su rol de aplicación.
 * Solo Admin puede crear/modificar/asignar perfiles.
 */
export interface PermissionProfile {
  id: string;
  name: string;
  /** Nombre largo mostrado en UI */
  label: string;
  description: string;
  isActive: boolean;
  createdOn?: string;
}

/** Entrada N:N: qué claves de permiso otorga un perfil */
export interface ProfilePermission {
  id: string;
  profileId: string;
  permissionKey: string;
}

/** Entrada N:N (audit trail): qué perfiles tiene asignado cada usuario */
export interface UserProfile {
  id: string;
  userId: string;
  profileId: string;
  assignedBy: string;
  assignedOn: string;
}

/**
 * Override por usuario — solo Admin puede crearlo.
 * Permite elevar o revocar un permiso concreto para un usuario específico
 * con justificación obligatoria y trazabilidad.
 */
export interface UserPermissionOverride {
  id: string;
  userId: string;
  permissionKey: string;
  /** true = conceder; false = revocar */
  value: boolean;
  reason: string;
  createdBy: string;
  createdOn: string;
}

/**
 * Permisos efectivos pre-resueltos para un usuario concreto.
 * Resultado de: Admin bypass | base rol | perfiles | overrides.
 * Devuelto por GET /api/users/:userId/effective-permissions
 */
export interface EffectivePermissions {
  /** Mapa completo clave→boolean ya resuelto */
  permissions: Record<string, boolean>;
  /** Claves que provienen de perfiles (no del rol base) — para info en UI */
  fromProfiles: string[];
  /** Overrides aplicados para este usuario — para info en UI */
  overrides: Record<string, boolean>;
}

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

// ── Sistema de ayuda contextual ───────────────────────────
/**
 * A qué roles es visible un contenido de ayuda.
 * "ALL" = todos los roles autenticados.
 */
export type HelpRole = "ALL" | AppRole;

/**
 * Entrada de contenido de ayuda vinculada a una pantalla (screenId).
 * El campo contentHtml es HTML seguro gestionado solo por Admins.
 */
export interface HelpContent {
  id: string;
  /** Identificador de la pantalla: "dashboard", "gantt", "admin-users", etc. */
  screenId: string;
  title: string;
  /** Roles que pueden ver este contenido. "ALL" = cualquier usuario. */
  role: HelpRole;
  /** HTML del cuerpo de la ayuda. Solo Admins pueden editarlo. */
  contentHtml: string;
  isActive: boolean;
  updatedOn?: string;
}
