// ─────────────────────────────────────────────────────────
//  src/screens/reports/reportSelectors.ts
//  Funciones puras de cálculo para los informes personales.
//  Sin dependencias React — testeables unitariamente.
// ─────────────────────────────────────────────────────────

import type { WorkItem, Project, State, AppRole } from "../../types/domain";

// ── Constantes ────────────────────────────────────────────
const CLOSED_STATE   = "st-cls";
const DUE_SOON_DAYS  = 14;

// ── Helpers de fecha ──────────────────────────────────────
/** Días hasta la fecha (negativo si vencido). */
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

/** Días naturales entre dos fechas ISO (proxy de duración). */
export function daysSpan(start: string, end: string): number {
  return Math.max(
    0,
    Math.ceil(
      (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000,
    ),
  );
}

// ── Listas para tab "Mi panel" ────────────────────────────

/**
 * WorkItems asignados directamente al usuario — excluyendo Cerrados.
 * Ordenados por endDate ASC. Limitados a `limit` items (default sin límite).
 */
export function getMyAssignmentsForReport(
  workItems:     WorkItem[],
  currentUserId: string,
  limit?:        number,
): WorkItem[] {
  if (!currentUserId) return [];
  const result = workItems
    .filter(
      (wi) => wi.stateId !== CLOSED_STATE && wi.assignedToUserId === currentUserId,
    )
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  return limit ? result.slice(0, limit) : result;
}

/**
 * WorkItems que el usuario solicitó (directamente o por proyecto)
 * pero asignados a otro. Excluyendo Cerrados.
 * Ordenados por assignedToRole luego endDate. Limitados a `limit`.
 */
export function getWaitingOnOthersForReport(
  workItems:     WorkItem[],
  projects:      Project[],
  currentUserId: string,
  limit?:        number,
): WorkItem[] {
  if (!currentUserId) return [];
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const result = workItems
    .filter((wi) => {
      if (wi.stateId === CLOSED_STATE)           return false;
      if (wi.assignedToUserId === currentUserId) return false;
      const proj = projectMap.get(wi.projectId);
      return (
        wi.requestedByUserId === currentUserId ||
        proj?.requestedByUserId === currentUserId
      );
    })
    .sort((a, b) => {
      if (a.assignedToRole < b.assignedToRole) return -1;
      if (a.assignedToRole > b.assignedToRole) return  1;
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
  return limit ? result.slice(0, limit) : result;
}

// ── PersonalKPIs ──────────────────────────────────────────
export interface PersonalKPIs {
  /** Tareas abiertas asignadas al usuario actual. */
  assignedToMe: number;
  /** Tareas abiertas solicitadas por el usuario pero en manos de otro. */
  waitingOnOthers: number;
  /** Tareas "Asignadas a mí" que están bloqueadas. */
  blocked: number;
  /** Tareas propias o en espera que vencen en ≤14 días. */
  dueSoon: number;
  /** Tareas cerradas asignadas al usuario (sin filtro de periodo). */
  closedTotal: number;
}

/**
 * Calcula el strip de KPIs personales.
 */
export function calcPersonalKPIs(
  workItems:     WorkItem[],
  projects:      Project[],
  currentUserId: string,
): PersonalKPIs {
  if (!currentUserId) {
    return { assignedToMe: 0, waitingOnOthers: 0, blocked: 0, dueSoon: 0, closedTotal: 0 };
  }

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const mine = workItems.filter(
    (wi) => wi.stateId !== CLOSED_STATE && wi.assignedToUserId === currentUserId,
  );

  const waiting = workItems.filter((wi) => {
    if (wi.stateId === CLOSED_STATE)             return false;
    if (wi.assignedToUserId === currentUserId)   return false;
    const proj = projectMap.get(wi.projectId);
    return (
      wi.requestedByUserId === currentUserId ||
      proj?.requestedByUserId === currentUserId
    );
  });

  const blocked = mine.filter((wi) => wi.stateId === "st-blk").length;

  const dueSoon = [...mine, ...waiting].filter((wi) => {
    const d = daysUntil(wi.endDate);
    return d >= 0 && d <= DUE_SOON_DAYS;
  }).length;

  const closedTotal = workItems.filter(
    (wi) => wi.stateId === CLOSED_STATE && wi.assignedToUserId === currentUserId,
  ).length;

  return {
    assignedToMe:    mine.length,
    waitingOnOthers: waiting.length,
    blocked,
    dueSoon,
    closedTotal,
  };
}

// ── WaitingByRole ─────────────────────────────────────────
export interface WaitingRoleRow {
  role:             AppRole;
  count:            number;
  /** % sobre el total waiting */
  pctOfTotal:       number;
  overdue:          number;
  /** Media de días restantes (negativo = vencido); null si sin items */
  avgDaysRemaining: number | null;
}

/**
 * Desglosa "Esperando a terceros" por rol del asignado.
 */
export function calcWaitingByRole(
  workItems:     WorkItem[],
  projects:      Project[],
  currentUserId: string,
): WaitingRoleRow[] {
  if (!currentUserId) return [];

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const waiting = workItems.filter((wi) => {
    if (wi.stateId === CLOSED_STATE)            return false;
    if (wi.assignedToUserId === currentUserId)  return false;
    const proj = projectMap.get(wi.projectId);
    return (
      wi.requestedByUserId === currentUserId ||
      proj?.requestedByUserId === currentUserId
    );
  });

  const total = waiting.length;
  const byRole = new Map<AppRole, WorkItem[]>();

  for (const wi of waiting) {
    const role = wi.assignedToRole;
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(wi);
  }

  return Array.from(byRole.entries())
    .map(([role, items]) => {
      const avgDaysRemaining =
        items.length > 0
          ? Math.round(
              items.reduce((sum, wi) => sum + daysUntil(wi.endDate), 0) /
                items.length,
            )
          : null;
      return {
        role,
        count:            items.length,
        pctOfTotal:       total > 0 ? Math.round((items.length / total) * 100) : 0,
        overdue:          items.filter((wi) => daysUntil(wi.endDate) < 0).length,
        avgDaysRemaining,
      };
    })
    .sort((a, b) => b.count - a.count);
}

// ── AssignedByState ───────────────────────────────────────
export interface AssignedStateRow {
  stateId:   string;
  stateName: string;
  count:     number;
  overdue:   number;
  dueSoon:   number;
}

/**
 * Desglosa "Asignadas a mí" por estado del workItem.
 * Excluye el estado "Cerrado".
 */
export function calcAssignedByState(
  workItems:     WorkItem[],
  states:        State[],
  currentUserId: string,
): AssignedStateRow[] {
  if (!currentUserId) return [];

  const stateMap = new Map(states.map((s) => [s.id, s]));

  const mine = workItems.filter(
    (wi) => wi.stateId !== CLOSED_STATE && wi.assignedToUserId === currentUserId,
  );

  const byState = new Map<string, WorkItem[]>();
  for (const wi of mine) {
    if (!byState.has(wi.stateId)) byState.set(wi.stateId, []);
    byState.get(wi.stateId)!.push(wi);
  }

  return Array.from(byState.entries())
    .map(([stateId, items]) => ({
      stateId,
      stateName: stateMap.get(stateId)?.name ?? stateId,
      count:     items.length,
      overdue:   items.filter((wi) => daysUntil(wi.endDate) < 0).length,
      dueSoon:   items.filter((wi) => {
        const d = daysUntil(wi.endDate);
        return d >= 0 && d <= DUE_SOON_DAYS;
      }).length,
    }))
    .sort((a, b) => {
      const oa = stateMap.get(a.stateId)?.order ?? 99;
      const ob = stateMap.get(b.stateId)?.order ?? 99;
      return oa - ob;
    });
}
