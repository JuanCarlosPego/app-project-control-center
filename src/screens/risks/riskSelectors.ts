// ─────────────────────────────────────────────────────────
//  src/screens/risks/riskSelectors.ts
//  Selectores puros (sin React) para la pantalla de Riesgos.
//
//  "Asignadas a mí":
//    risk.assignedToUserId === currentUserId
//    || (!risk.assignedToUserId && linkedWorkItem?.assignedToUserId === currentUserId)
//
//  "Esperando a terceros":
//    (risk.createdBy === currentUserId || linkedProject?.requestedByUserId === currentUserId)
//    && (risk.assignedToUserId !== currentUserId)
//    && risk.status !== "Resuelto"
// ─────────────────────────────────────────────────────────

import type { Risk, WorkItem, Project } from "../../types/domain";
import { daysUntilDue } from "../../services/riskService";

// ── KPIs personales + globales ────────────────────────────
export interface RiskKPIs {
  total:           number;
  open:            number;
  dueSoon:         number;   // status != Resuelto && dueDate ≤ hoy+14d
  assignedToMe:    number;
  waitingOnOthers: number;
}

// ── Helpers de matching ───────────────────────────────────

function resolveLinkedWorkItem(
  risk: Risk,
  wiMap: Map<string, WorkItem>,
): WorkItem | undefined {
  if (!risk.linkedWorkItemId) return undefined;
  return wiMap.get(risk.linkedWorkItemId);
}

function resolveLinkedProject(
  risk: Risk,
  projMap: Map<string, Project>,
): Project | undefined {
  return projMap.get(risk.projectId);
}

/** ¿Está el riesgo asignado directamente al usuario actual? */
export function isAssignedToMe(
  risk:          Risk,
  workItem:      WorkItem | undefined,
  currentUserId: string,
): boolean {
  if (!currentUserId) return false;
  if (risk.assignedToUserId) {
    return risk.assignedToUserId === currentUserId;
  }
  // Fallback: workItem asignado a mí
  return !!workItem && workItem.assignedToUserId === currentUserId;
}

/** ¿Es el usuario el solicitante, pero el trabajo recae en otro? */
export function isWaitingOnOthers(
  risk:          Risk,
  workItem:      WorkItem | undefined,
  project:       Project | undefined,
  currentUserId: string,
): boolean {
  if (!currentUserId) return false;
  if (risk.status === "Resuelto") return false;

  const assignee = risk.assignedToUserId ?? workItem?.assignedToUserId;
  if (assignee === currentUserId) return false;

  // El usuario solicitó: por createdBy, requestedByUserId del workItem o del proyecto
  const iRequested =
    risk.createdBy === currentUserId ||
    workItem?.requestedByUserId === currentUserId ||
    project?.requestedByUserId === currentUserId;

  return iRequested;
}

// ── Selectores de lista ───────────────────────────────────

export function getMyRisks(
  risks:         Risk[],
  workItems:     WorkItem[],
  projects:      Project[],
  currentUserId: string,
): Risk[] {
  if (!currentUserId) return [];
  const wiMap   = new Map(workItems.map((w) => [w.id, w]));
  return risks.filter((r) =>
    isAssignedToMe(r, resolveLinkedWorkItem(r, wiMap), currentUserId),
  );
}

export function getWaitingRisks(
  risks:         Risk[],
  workItems:     WorkItem[],
  projects:      Project[],
  currentUserId: string,
): Risk[] {
  if (!currentUserId) return [];
  const wiMap   = new Map(workItems.map((w) => [w.id, w]));
  const projMap = new Map(projects.map((p) => [p.id, p]));
  return risks.filter((r) =>
    isWaitingOnOthers(
      r,
      resolveLinkedWorkItem(r, wiMap),
      resolveLinkedProject(r, projMap),
      currentUserId,
    ),
  );
}

// ── KPI calculator ────────────────────────────────────────
export function calcRiskKPIs(
  risks:         Risk[],
  workItems:     WorkItem[],
  projects:      Project[],
  currentUserId: string,
): RiskKPIs {
  const wiMap   = new Map(workItems.map((w) => [w.id, w]));
  const projMap = new Map(projects.map((p) => [p.id, p]));

  let open = 0, dueSoon = 0, assignedToMe = 0, waitingOnOthers = 0;

  for (const r of risks) {
    if (r.status !== "Resuelto") open++;

    if (r.status !== "Resuelto") {
      const d = daysUntilDue(r.dueDate);
      if (d >= 0 && d <= 14) dueSoon++;
    }

    const wi   = resolveLinkedWorkItem(r, wiMap);
    const proj = resolveLinkedProject(r, projMap);

    if (isAssignedToMe(r, wi, currentUserId))          assignedToMe++;
    if (isWaitingOnOthers(r, wi, proj, currentUserId)) waitingOnOthers++;
  }

  return { total: risks.length, open, dueSoon, assignedToMe, waitingOnOthers };
}

// ── Texto derivado "Esperando a: Rol" ────────────────────
/** Rol del asignado en el workItem vinculado (para mostrar en tabla). */
export function waitingOnRole(risk: Risk, workItem: WorkItem | undefined): string | null {
  if (!workItem) return null;
  if (workItem.assignedToRole) return workItem.assignedToRole;
  return null;
}
