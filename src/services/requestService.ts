// ─────────────────────────────────────────────────────────
//  src/services/requestService.ts
//  Servicio para Solicitudes (capa de demanda de negocio).
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type {
  Request, RequestStatus, RequestType, Priority,
} from "../types/domain";

// ── Filtros ───────────────────────────────────────────────
export interface RequestFilters {
  year?:     number | "";
  status?:   RequestStatus | "";
  type?:     RequestType | "";
  priority?: Priority | "";
  query?:    string;
  mine?:     boolean;
}

// ── Payloads ──────────────────────────────────────────────
export interface CreateRequestPayload {
  year:               number;
  title:              string;
  description:        string;
  type:               RequestType;
  priority:           Priority;
  requestedByTeamId?: string | null;
  relatedProjectId?:  string | null;
}

export interface PatchRequestPayload {
  title?:            string;
  description?:      string;
  type?:             RequestType;
  priority?:         Priority;
  relatedProjectId?: string | null;
}

export interface TriagePayload {
  action: "review" | "request-info" | "approve" | "reject";
  note?:  string;
}

export interface ConvertPayload {
  projectId:         string;
  title?:            string;
  type?:             string;
  priority?:         Priority;
  assignedToUserId?: string;
  assignedToTeamId?: string | null;
}

export interface CancelRequestPayload {
  note?: string;
}

export interface RespondPayload {
  note: string;
}

// ── Labels y opciones de UI ───────────────────────────────
export const REQUEST_STATUS_OPTIONS: RequestStatus[] = [
  "Nuevo", "En revisión", "Info requerida", "Aprobada", "Rechazada", "Convertida", "Cancelada",
];

export const REQUEST_TYPE_OPTIONS: RequestType[] = [
  "Bug", "Mejora", "Feature", "Incidencia", "Consulta", "CambioNormativo", "Impedimento",
];

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  Bug:             "Bug",
  Mejora:          "Mejora",
  Feature:         "Nueva funcionalidad",
  Incidencia:      "Incidencia",
  Consulta:        "Consulta",
  CambioNormativo: "Cambio normativo",
  Impedimento:     "Impedimento",
};

export const REQUEST_STATUS_COLORS: Record<RequestStatus, string> = {
  "Nuevo":          "#0078D4",
  "En revisión":    "#8764B8",
  "Info requerida": "#986F0B",
  "Aprobada":       "#107C10",
  "Rechazada":      "#D13438",
  "Convertida":     "#00B7C3",
  "Cancelada":      "#605E5C",
};

export const REQUEST_TYPE_COLORS: Record<RequestType, string> = {
  Bug:             "#D13438",
  Mejora:          "#0078D4",
  Feature:         "#00B7C3",
  Incidencia:      "#986F0B",
  Consulta:        "#8764B8",
  CambioNormativo: "#107C10",
  Impedimento:     "#D13438",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  Alta:  "#D13438",
  Media: "#986F0B",
  Baja:  "#605E5C",
};

// ── API ───────────────────────────────────────────────────

export async function getRequests(filters: RequestFilters = {}): Promise<Request[]> {
  const params = new URLSearchParams();
  if (filters.year)     params.set("year",     String(filters.year));
  if (filters.status)   params.set("status",   filters.status);
  if (filters.type)     params.set("type",      filters.type);
  if (filters.priority) params.set("priority",  filters.priority);
  if (filters.query)    params.set("query",     filters.query);
  if (filters.mine)     params.set("mine",      "true");
  const qs = params.toString();
  return apiClient.get<Request[]>(`/requests${qs ? `?${qs}` : ""}`);
}

export async function createRequest(payload: CreateRequestPayload): Promise<Request> {
  return apiClient.post<Request>("/requests", payload);
}

export async function patchRequest(id: string, payload: PatchRequestPayload): Promise<Request> {
  return apiClient.patch<Request>(`/requests/${id}`, payload);
}

export async function triageRequest(id: string, payload: TriagePayload): Promise<Request> {
  return apiClient.post<Request>(`/requests/${id}/triage`, payload);
}

export async function convertRequest(
  id: string,
  payload: ConvertPayload,
): Promise<{ request: Request; workItem: unknown }> {
  return apiClient.post<{ request: Request; workItem: unknown }>(
    `/requests/${id}/convert`,
    payload,
  );
}

export async function cancelRequest(id: string, payload: CancelRequestPayload = {}): Promise<Request> {
  return apiClient.post<Request>(`/requests/${id}/cancel`, payload);
}

export async function respondRequest(id: string, payload: RespondPayload): Promise<Request> {
  return apiClient.post<Request>(`/requests/${id}/respond`, payload);
}
