// ─────────────────────────────────────────────────────────
//  src/services/workItemService.ts
//
//  Modo MOCK: MSW intercepta → db.json
//  Modo DATAVERSE: 🔌 Reemplazar con Xrm.WebApi
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type {
  WorkItem,
  Evidence,
  ActivityLogEntry,
  Risk,
  State,
  Transition,
  PatchWorkItemStatePayload,
  PatchWorkItemPayload,
  AppSettings,
  UIEvent,
  UIEventAction,
  AppRole,
  User,
  DraftTask,
} from "../types/domain";

// ── WorkItems ────────────────────────────────────────────
export interface WorkItemFilters {
  projectId?: string;
  stateId?: string;
  assignedToRole?: string;
  requestId?: string;
}

export const getWorkItems = (filters: WorkItemFilters = {}): Promise<WorkItem[]> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const qs = params.toString();
  return apiClient.get(`/workitems${qs ? `?${qs}` : ""}`);
};

export interface CreateWorkItemPayload {
  projectId: string;
  title: string;
  description?: string;
  type: WorkItem["type"];
  priority: WorkItem["priority"];
  stateId: string;
  requestedByRole?: AppRole;
  requestedByUserId?: string;
  assignedToRole: AppRole;
  /** Equipo responsable — debe coincidir con el tipo esperado para assignedToRole */
  assignedToTeamId?: string | null;
  assignedToUserId: string;
  startDate: string;
  endDate: string;
  tags: string[];
}

export const createWorkItem = (payload: CreateWorkItemPayload): Promise<WorkItem> =>
  apiClient.post("/workitems", payload);

export { DraftTask };

export const patchWorkItem = (id: string, payload: PatchWorkItemPayload): Promise<WorkItem> =>
  apiClient.patch(`/workitems/${id}`, payload);

/** Obtiene usuarios del sistema para el people-picker */
export const getUsers = (): Promise<User[]> =>
  apiClient.get("/users");

/**
 * Cambia el estado de un WorkItem.
 *
 * @throws ApiError(400) si la transición requiere evidencia y no se provee.
 * @throws ApiError(403) si el rol del usuario no permite la transición.
 * @throws ApiError(400) si la transición no es válida (no existe en transitions).
 */
export const patchWorkItemState = (
  workItemId: string,
  payload: PatchWorkItemStatePayload,
): Promise<WorkItem> =>
  apiClient.patch(`/workitems/${workItemId}/state`, payload);

// ── Evidencias ───────────────────────────────────────────
export const getEvidences = (
  entityType: "WorkItem" | "Project",
  entityId: string,
): Promise<Evidence[]> =>
  apiClient.get(`/evidences?entityType=${entityType}&entityId=${entityId}`);

// ── Actividad ────────────────────────────────────────────
export const getActivity = (projectId?: string): Promise<ActivityLogEntry[]> =>
  apiClient.get(`/activity${projectId ? `?projectId=${projectId}` : ""}`);

// ── Riesgos ──────────────────────────────────────────────
export const getRisks = (projectId?: string): Promise<Risk[]> =>
  apiClient.get(`/risks${projectId ? `?projectId=${projectId}` : ""}`);
// ── Jira / Power Automate ───────────────────────────────
export const addJiraComment = (
  workItemId: string,
  comment: string,
  evidence?: import("../types/domain").EvidencePayload,
): Promise<{ success: boolean; message: string }> =>
  apiClient.post(`/workitems/${workItemId}/jira-comment`, { comment, evidence });

export const retrySyncWorkItem = (workItemId: string): Promise<WorkItem> =>
  apiClient.post(`/workitems/${workItemId}/retry-sync`, {});


// ── Edición de fechas (Gantt drawer) ───────────────────
export const patchWorkItemDates = (
  id: string,
  startDate: string,
  endDate: string,
): Promise<WorkItem> =>
  apiClient.patch(`/workitems/${id}/dates`, { startDate, endDate });
// ── Catálogos de máquina de estados ──────────────────────
export const getStates = (): Promise<State[]> =>
  apiClient.get("/states");

export const getTransitions = (): Promise<Transition[]> =>
  apiClient.get("/transitions");

// ── Settings (para Kanban: WIP limits, strictValidation, adminBypass) ──
export const getSettings = (): Promise<AppSettings> =>
  apiClient.get("/settings");

// ── UI Events (telemetría, NO auditoría formal) ───────────────────────
export const logUIEvent = (payload: {
  entityId: string;
  action: UIEventAction;
  fromStateId: string;
  toStateId: string;
  whoRole: AppRole;
  meta?: Record<string, unknown>;
}): Promise<{ ok: boolean }> =>
  apiClient.post("/ui-events", payload).catch(() => ({ ok: false }));

export type { UIEvent, UIEventAction, PatchWorkItemPayload };
