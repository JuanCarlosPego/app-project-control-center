// ─────────────────────────────────────────────────────────
//  src/services/requestProgressService.ts
//
//  Recalcula el progreso de una Solicitud a partir de sus
//  WorkItems asociados (requestId).
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { WorkItem, Request } from "../types/domain";

/** Obtiene los workItems que tienen requestId = id */
export const getRequestTasks = (requestId: string): Promise<WorkItem[]> =>
  apiClient.get(`/workitems?requestId=${requestId}`);

/**
 * Solicita al backend que recalcule y persista el progreso de la solicitud.
 * En LOCAL: el handler MSW hace el cálculo directamente en memoria.
 * En Dataverse: sustituir por lógica de cálculo + patch a Xrm.WebApi.
 */
export const recalculateRequestProgress = (requestId: string): Promise<Request> =>
  apiClient.post(`/requests/${requestId}/recalculate-progress`, {});

