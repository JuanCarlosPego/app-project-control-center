// ─────────────────────────────────────────────────────────
//  src/services/requestService.ts
//  Servicio para Solicitudes (capa de demanda de negocio).
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type {
  Request, RequestStatus, RequestType, Priority, RequestUrgency, RequestAttachment,
  TriageDecision, TriageCategory, TriageEstimate, TriageReason, TriageBacklogBucket,
  WorkItemType, DraftTask,
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
  urgency?:           RequestUrgency | null;
  businessAreaId?:    string | null;
  requestedByTeamId?: string | null;
  relatedProjectId?:  string | null;
}

export interface PatchRequestPayload {
  title?:            string;
  description?:      string;
  type?:             RequestType;
  priority?:         Priority;
  urgency?:          RequestUrgency | null;
  businessAreaId?:   string | null;
  relatedProjectId?: string | null;
}

export interface TriagePayload {
  action: "review" | "request-info" | "approve" | "reject";
  note?:  string;
}

/**
 * Payload del Triage Wizard completo (gobierno IT).
 * draft=true → guarda campos sin cambiar el status (borrador).
 */
export interface FullTriagePayload {
  decision:       TriageDecision;
  note?:          string;
  draft?:         boolean;
  // Sección B – Clasificación (requerida para approve/convert)
  category?:      TriageCategory;
  priorityIT?:    Priority;
  estimate?:      TriageEstimate;
  // Sección C – Ejecución (solo para convert)
  projectId?:     string;
  wiTitle?:       string;
  wiType?:        WorkItemType;
  executorTeamId?: string;
  executorUserId?: string;
  initialStateId?: string;
  /** Para conversión multi-tarea: lista de tareas a crear (≥1 cuando decision="convert") */
  tasks?:         DraftTask[];
  // Sección D – Backlog (solo para approve-backlog)
  backlogBucket?: TriageBacklogBucket;
  // Sección E – Rechazo
  reason?:        TriageReason;
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
  "Nuevo", "En revisión", "Info requerida", "Aprobada",
  "En ejecución", "Resuelta", "Rechazada", "Convertida", "Cancelada",
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
  "Nuevo":           "#0078D4",
  "En revisión":     "#8764B8",
  "Info requerida":  "#986F0B",
  "Aprobada":        "#107C10",
  "En ejecución":   "#00B7C3",
  "Resuelta":        "#498205",
  "Rechazada":       "#D13438",
  "Convertida":      "#00B7C3",
  "Cancelada":       "#605E5C",
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

/**
 * Triage wizard completo (gobierno IT).
 * Llama al mismo endpoint /triage pero con el payload extendido.
 * Si draft=true, guarda los campos sin cambiar el status de la solicitud.
 */
export async function fullTriageRequest(
  id: string,
  payload: FullTriagePayload,
): Promise<Request> {
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

// ── Adjuntos ──────────────────────────────────────────────

export interface UploadAttachmentPayload {
  name:      string;
  mimeType:  string;
  sizeBytes: number;
  /** Objeto File nativo del navegador — se pasa por referencia en producción. */
  file:      File;
  /** Data URL base64 para previsualización local (mock). No se envía a Dataverse. */
  dataUrl?:  string;
}

export async function uploadRequestAttachment(
  requestId: string,
  payload: UploadAttachmentPayload,
): Promise<RequestAttachment> {
  return apiClient.post<RequestAttachment>(
    `/requests/${requestId}/attachments`,
    payload,
  );
}

export async function getRequestAttachments(requestId: string): Promise<RequestAttachment[]> {
  return apiClient.get<RequestAttachment[]>(`/requests/${requestId}/attachments`);
}

export async function deleteRequestAttachment(requestId: string, attachmentId: string): Promise<void> {
  await apiClient.delete<void>(`/requests/${requestId}/attachments/${attachmentId}`);
}

/**
 * Descarga el archivo binario de un adjunto (columna File de Dataverse)
 * y dispara la descarga en el navegador.
 * Solo para entorno de producción (IS_LOCAL=false).
 */
export async function downloadAttachmentFile(
  att: { id: string; name: string; mimeType: string },
): Promise<void> {
  const { sdkDownloadFile } = await import("./dataverseSdk");
  const bytes = await sdkDownloadFile("cproroad_requestattachment", att.id, "cproroad_contenidoarchivo");
  const blob = new Blob([bytes], { type: att.mimeType || "application/octet-stream" });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = att.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

/**
 * Obtiene el adjunto como blob: URL para previsualización inline.
 * Funciona en local (data URL embebido) y en producción (Dataverse SDK).
 * ⚠ El llamador debe liberar la URL con URL.revokeObjectURL() cuando cierre el visor.
 */
export async function fetchAttachmentBlobUrl(
  att: RequestAttachment,
): Promise<string> {
  if (att.url.startsWith("data:")) {
    // Entorno local (MSW): el fichero está embebido como data URL
    const [, base64] = att.url.split(",");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: att.mimeType || "application/octet-stream" });
    return URL.createObjectURL(blob);
  }
  // Producción (Dataverse): descargar bytes vía SDK
  const { sdkDownloadFile } = await import("./dataverseSdk");
  const bytes = await sdkDownloadFile(
    "cproroad_requestattachment",
    att.id,
    "cproroad_contenidoarchivo",
  );
  const blob = new Blob([bytes], { type: att.mimeType || "application/octet-stream" });
  return URL.createObjectURL(blob);
}
