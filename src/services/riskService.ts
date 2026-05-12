// ─────────────────────────────────────────────────────────
//  src/services/riskService.ts
//  Servicio para Riesgos y Bloqueos.
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { Risk, RiskSeverity, RiskStatus, AppRole } from "../types/domain";

// ── Filtros ───────────────────────────────────────────────
export interface RiskFilters {
  projectId?:           string;
  severity?:            RiskSeverity | "";
  status?:              RiskStatus | "";
  ownerRole?:           AppRole | "";
  onlyDueSoon?:         boolean;   // dueDate ≤ hoy+14d
  query?:               string;
  // ── Filtros personales (client-side) ──────────────────
  onlyAssignedToMe?:    boolean;
  onlyWaitingOnOthers?: boolean;
}

// ── Payloads ──────────────────────────────────────────────
export interface CreateRiskPayload {
  projectId:        string;
  title:            string;
  description?:     string;
  severity:         RiskSeverity;
  ownerRole:        AppRole;
  dueDate:          string;
  linkedWorkItemId?: string;
}

export interface PatchRiskPayload {
  title?:           string;
  description?:     string;
  severity?:        RiskSeverity;
  ownerRole?:       AppRole;
  dueDate?:         string;
  status?:          RiskStatus;
  linkedWorkItemId?: string;
}

export interface CloseRiskPayload {
  closeComment: string;
}

// ── Labels ────────────────────────────────────────────────
export const SEVERITY_LABELS: Record<RiskSeverity, string> = {
  Alta:  "Alta",
  Media: "Media",
  Baja:  "Baja",
};

export const STATUS_LABELS: Record<RiskStatus, string> = {
  Abierto:       "Abierto",
  "En mitigación": "En mitigación",
  Resuelto:      "Resuelto",
};

export const OWNER_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "",            label: "Todos los responsables" },
  { value: "IT AirEuropa", label: "IT AirEuropa" },
  { value: "Proveedor",  label: "Proveedor" },
  { value: "Usuario",    label: "Usuario" },
];

// ── Helpers de cálculo ────────────────────────────────────
export function agingDays(createdOn: string): number {
  return Math.floor((Date.now() - new Date(createdOn).getTime()) / 86_400_000);
}

export function daysUntilDue(dueDate: string): number {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
}

// ── API calls ─────────────────────────────────────────────
export const getRisks = (filters: RiskFilters = {}): Promise<Risk[]> => {
  const params = new URLSearchParams();
  if (filters.projectId)   params.set("projectId",  filters.projectId);
  if (filters.severity)    params.set("severity",    filters.severity);
  if (filters.status)      params.set("status",      filters.status);
  if (filters.ownerRole)   params.set("ownerRole",   filters.ownerRole);
  if (filters.onlyDueSoon) params.set("onlyDueSoon", "true");
  if (filters.query)       params.set("query",       filters.query);
  const qs = params.toString();
  return apiClient.get(`/risks${qs ? `?${qs}` : ""}`);
};

export const createRisk = (payload: CreateRiskPayload): Promise<Risk> =>
  apiClient.post("/risks", payload);

export const updateRisk = (id: string, payload: PatchRiskPayload): Promise<Risk> =>
  apiClient.patch(`/risks/${id}`, payload);

export const closeRisk = (id: string, payload: CloseRiskPayload): Promise<Risk> =>
  apiClient.post(`/risks/${id}/close`, payload);

// ── Exportar CSV ──────────────────────────────────────────
export function exportRisksCSV(
  risks: Risk[],
  projectMap: Record<string, string>,
  workItemMap: Record<string, string>,
): void {
  const rows: string[][] = [
    ["ID", "Proyecto", "Título", "Descripción", "Severidad", "Estado", "Responsable", "Fecha límite", "Días hasta vencimiento", "Aging (días)", "Tarea vinculada", "Creado por", "Creado el", "Cerrado el", "Comentario cierre"],
  ];
  const today = new Date();
  risks.forEach((r) => {
    const due    = daysUntilDue(r.dueDate);
    const aging  = Math.floor((today.getTime() - new Date(r.createdOn).getTime()) / 86_400_000);
    rows.push([
      r.id,
      projectMap[r.projectId] ?? r.projectId,
      r.title,
      r.description ?? "",
      r.severity,
      r.status,
      r.ownerRole,
      r.dueDate,
      String(due),
      String(aging),
      r.linkedWorkItemId ? (workItemMap[r.linkedWorkItemId] ?? r.linkedWorkItemId) : "",
      r.createdBy,
      r.createdOn,
      r.closedOn  ?? "",
      r.closeComment ?? "",
    ]);
  });
  const csv  = rows.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `riesgos_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
