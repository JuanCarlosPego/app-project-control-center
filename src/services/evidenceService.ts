// ─────────────────────────────────────────────────────────
//  src/services/evidenceService.ts
//  Servicio para evidencias: consulta, creación y exportación.
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { Evidence, EvidenceType } from "../types/domain";

// ── Tipos ─────────────────────────────────────────────────
export interface EvidenceFilters {
  entityType?: "WorkItem" | "Project";
  entityId?:   string;
  projectId?:  string;
  type?:       EvidenceType;
  createdBy?:  string;
  query?:      string;
}

export interface CreateEvidencePayload {
  entityType: "WorkItem" | "Project";
  entityId:   string;
  type:       EvidenceType;
  value:      string;
  comment:    string;
}

// ── Etiquetas de tipo ────────────────────────────────────
export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  link:    "Enlace",
  comment: "Comentario",
  file:    "Archivo",
};

export const EVIDENCE_TYPE_OPTIONS = Object.entries(EVIDENCE_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

// ── GET evidencias ────────────────────────────────────────
export const getEvidences = (filters: EvidenceFilters = {}): Promise<Evidence[]> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const qs = params.toString();
  return apiClient.get(`/evidences${qs ? `?${qs}` : ""}`);
};

// ── GET evidencias de una entidad (WorkItem o Project) ────
export const getEntityEvidences = (
  entityType: "WorkItem" | "Project",
  entityId: string,
): Promise<Evidence[]> =>
  getEvidences({ entityType, entityId });

// ── Crear evidencia ───────────────────────────────────────
export const createEvidence = (payload: CreateEvidencePayload): Promise<Evidence> =>
  apiClient.post("/evidences", payload);

// ── Exportar CSV ──────────────────────────────────────────
export function exportEvidencesCSV(
  evidences: Evidence[],
  workItemMap: Record<string, { title: string; jiraIssueKey?: string; projectId?: string }>,
  projectMap: Record<string, { code: string; name: string }>,
  userMap: Record<string, string>,
) {
  const header = ["Fecha", "Tipo", "Proyecto", "Tarea", "Clave Jira", "Autor", "Comentario", "Valor/URL"];
  const rows = evidences.map((e) => {
    const wi   = e.entityType === "WorkItem" ? workItemMap[e.entityId] : undefined;
    const proj = wi?.projectId ? projectMap[wi.projectId] : (e.entityType === "Project" ? projectMap[e.entityId] : undefined);
    return [
      new Date(e.createdOn).toLocaleString("es-ES"),
      EVIDENCE_TYPE_LABELS[e.type],
      proj ? `${proj.code} — ${proj.name}` : "—",
      wi?.title ?? "—",
      wi?.jiraIssueKey ?? "—",
      userMap[e.createdBy] ?? e.createdBy,
      `"${e.comment}"`,
      `"${e.value}"`,
    ];
  });

  const csv  = [header, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `evidencias-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
