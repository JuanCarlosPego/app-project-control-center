// ─────────────────────────────────────────────────────────
//  src/services/reportService.ts
//  Servicio de Informes / KPIs: tipos, llamada API y CSV.
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";

// ── Filtros ───────────────────────────────────────────────
export interface ReportFilters {
  projectId?:         string;
  areaId?:            string;
  providerId?:        string;
  deliveryOwnerType?: "IT" | "Proveedor" | "";
  periodDays?:        number;
  onlyBlocked?:       boolean;
  onlyDueSoon?:       boolean;
}

// ── Shapes de respuesta ───────────────────────────────────
export interface KPISummary {
  totalProjects:  number;
  totalTasks:     number;
  closedInPeriod: number;
  blocked:        number;
  dueSoon:        number;
  syncErrors:     number;
}

export interface ProviderRow {
  providerId:     string;
  providerName:   string;
  projects:       number;
  tasks:          number;
  blocked:        number;
  closedInPeriod: number;
  pctClosed:      number;
}

export interface AreaRow {
  areaId:         string;
  areaName:       string;
  projects:       number;
  tasks:          number;
  blocked:        number;
  closedInPeriod: number;
  pctClosed:      number;
}

export interface WeekBucket {
  label:  string;
  closed: number;
}

export interface RiskRow {
  id:          string;
  projectId:   string;
  projectCode: string;
  title:       string;
  severity:    string;
  status:      string;
  dueDate:     string;
  daysLeft:    number;
}

export interface ReportPayload {
  kpis:        KPISummary;
  byProvider:  ProviderRow[];
  byArea:      AreaRow[];
  weeklyTrend: WeekBucket[];
  topRisks:    RiskRow[];
}

// ── GET /api/reports/kpis ────────────────────────────────
export const getReportKPIs = (filters: ReportFilters = {}): Promise<ReportPayload> => {
  const params = new URLSearchParams();
  if (filters.projectId)         params.set("projectId",         filters.projectId);
  if (filters.areaId)            params.set("areaId",            filters.areaId);
  if (filters.providerId)        params.set("providerId",        filters.providerId);
  if (filters.deliveryOwnerType) params.set("deliveryOwnerType", filters.deliveryOwnerType);
  if (filters.periodDays)        params.set("periodDays",        String(filters.periodDays));
  if (filters.onlyBlocked)       params.set("onlyBlocked",       "true");
  if (filters.onlyDueSoon)       params.set("onlyDueSoon",       "true");
  const qs = params.toString();
  return apiClient.get(`/reports/kpis${qs ? `?${qs}` : ""}`);
};

// ── Exportar CSV ──────────────────────────────────────────
export function exportReportCSV(
  kpis:       KPISummary,
  byProvider: ProviderRow[],
  byArea:     AreaRow[],
): void {
  const rows: string[][] = [];

  rows.push(["=== KPIs Globales ==="]);
  rows.push(["Épicas totales",      String(kpis.totalProjects)]);
  rows.push(["Tareas totales",      String(kpis.totalTasks)]);
  rows.push(["Cerradas en periodo", String(kpis.closedInPeriod)]);
  rows.push(["Bloqueadas",          String(kpis.blocked)]);
  rows.push(["Vencen ≤14d",         String(kpis.dueSoon)]);
  rows.push(["Errores de sync",     String(kpis.syncErrors)]);
  rows.push([]);

  rows.push(["=== Por Proveedor ==="]);
  rows.push(["Proveedor", "Épicas", "Tareas", "Bloqueadas", "Cerradas (periodo)", "% Cerradas"]);
  byProvider.forEach((r) =>
    rows.push([r.providerName, String(r.projects), String(r.tasks), String(r.blocked), String(r.closedInPeriod), `${r.pctClosed}%`]),
  );
  rows.push([]);

  rows.push(["=== Por Área ==="]);
  rows.push(["Área", "Épicas", "Tareas", "Bloqueadas", "Cerradas (periodo)", "% Cerradas"]);
  byArea.forEach((r) =>
    rows.push([r.areaName, String(r.projects), String(r.tasks), String(r.blocked), String(r.closedInPeriod), `${r.pctClosed}%`]),
  );

  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `informe_kpis_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
