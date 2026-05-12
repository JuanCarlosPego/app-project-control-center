// ─────────────────────────────────────────────────────────
//  src/lib/priorityEngine.ts
//  Motor de prioridad determinista para Home Inteligente
//
//  Reglas:
//  - Cada WorkItem recibe un score numérico basado en pesos configurables.
//  - Los pesos vienen de settings.priorityWeights (editable por Admin).
//  - Si no hay pesos configurados, se usan DEFAULT_WEIGHTS.
//  - Cada item devuelve reasons[] para transparencia en UI.
//  - NUNCA IA generativa: puro if/else + aritmética.
// ─────────────────────────────────────────────────────────

import type { WorkItem, Project, PriorityWeights } from "../types/domain";

// ── Pesos por defecto ─────────────────────────────────────
export const DEFAULT_WEIGHTS: PriorityWeights = {
  overdue:           50,
  dueSoon3d:         30,
  dueSoon7d:         15,
  blocked:           40,
  evidenceRequired:  10,
  syncError:         20,
  syncPending:        5,
  highPriority:      25,
  mediumPriority:    10,
  assignedToMe:      20,
  waitingOnOthers:    8,
  noRecentActivity7d: 12,
};

// ── Item con score + reasons ──────────────────────────────
export interface ScoredItem {
  workItem: WorkItem;
  project: Project | undefined;
  score: number;
  reasons: string[];
}

// ── Tipos de insight ──────────────────────────────────────
export interface Insight {
  id: string;
  icon: string;
  title: string;
  body: string;
  href: string;
  urgency: "high" | "medium" | "low";
}

// ── Helpers de fecha ──────────────────────────────────────
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function daysSince(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

// ── Merge weights (defaults + overrides) ──────────────────
export function mergeWeights(override?: Partial<PriorityWeights>): PriorityWeights {
  if (!override) return DEFAULT_WEIGHTS;
  return { ...DEFAULT_WEIGHTS, ...override };
}

// ── Score único item ──────────────────────────────────────
export function scoreWorkItem(
  wi: WorkItem,
  currentUserId: string,
  weights: PriorityWeights,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const d     = daysUntil(wi.endDate);
  // WorkItem no tiene updatedAt; usamos startDate como proxy de actividad
  const since = daysSince(wi.startDate);
  const closed = wi.stateId === "st-cls";

  if (closed) return { score: -1, reasons: [] };

  // ── Vencimiento ──────────────────────────────────────────
  if (d < 0) {
    score += weights.overdue;
    reasons.push("Vencida");
  } else if (d <= 3) {
    score += weights.dueSoon3d;
    reasons.push(`Vence en ${d}d`);
  } else if (d <= 7) {
    score += weights.dueSoon7d;
    reasons.push(`Vence en ${d}d`);
  }

  // ── Bloqueo ──────────────────────────────────────────────
  if (wi.stateId === "st-blk") {
    score += weights.blocked;
    reasons.push("Bloqueada");
  }

  // ── Evidencia requerida (st-acc) ─────────────────────────
  if (wi.stateId === "st-acc") {
    score += weights.evidenceRequired;
    reasons.push("Pendiente validación");
  }

  // ── Sync status ──────────────────────────────────────────
  if (wi.syncStatus === "Error") {
    score += weights.syncError;
    reasons.push("Sync error");
  } else if (wi.syncStatus === "Pending") {
    score += weights.syncPending;
    reasons.push("Sync pendiente");
  }

  // ── Prioridad ─────────────────────────────────────────────
  if (wi.priority === "Alta") {
    score += weights.highPriority;
    reasons.push("Alta prioridad");
  } else if (wi.priority === "Media") {
    score += weights.mediumPriority;
  }

  // ── Asignado a mí ─────────────────────────────────────────
  if (wi.assignedToUserId === currentUserId) {
    score += weights.assignedToMe;
    reasons.push("Asignada a ti");
  }

  // ── Sin actividad reciente ────────────────────────────────
  if (since >= 7 && !closed) {
    score += weights.noRecentActivity7d;
    reasons.push("Sin actividad 7d");
  }

  return { score, reasons };
}

// ── Score lista completa ──────────────────────────────────
export function scoreWorkItems(
  workItems: WorkItem[],
  projects: Project[],
  currentUserId: string,
  weights: PriorityWeights,
): ScoredItem[] {
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  return workItems
    .filter((wi) => wi.stateId !== "st-cls")
    .map((wi) => {
      const { score, reasons } = scoreWorkItem(wi, currentUserId, weights);
      return {
        workItem: wi,
        project: projectMap[wi.projectId],
        score,
        reasons,
      };
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score);
}

// ── Top recomendaciones (Top N) ───────────────────────────
export function getTopRecommendations(
  scored: ScoredItem[],
  n: number,
): ScoredItem[] {
  return scored.slice(0, n);
}

// ── Insights del sistema ──────────────────────────────────
export function generateInsights(
  workItems: WorkItem[],
  currentUserId: string,
): Insight[] {
  const insights: Insight[] = [];
  const today = Date.now();

  const blockedItems = workItems.filter((wi) => wi.stateId === "st-blk");
  const overdueItems = workItems.filter(
    (wi) => wi.stateId !== "st-cls" && new Date(wi.endDate).getTime() < today,
  );
  const syncErrors   = workItems.filter((wi) => wi.syncStatus === "Error");
  const mineAcc      = workItems.filter(
    (wi) => wi.stateId === "st-acc" && wi.assignedToUserId === currentUserId,
  );
  const noActivity   = workItems.filter(
    (wi) => wi.stateId !== "st-cls" && daysSince(wi.startDate) >= 7,
  );
  const highPrioItems = workItems.filter(
    (wi) => wi.stateId !== "st-cls" && wi.priority === "Alta",
  );

  if (blockedItems.length > 0) {
    insights.push({
      id: "ins-blocked",
      icon: "⛔",
      title: `${blockedItems.length} tarea${blockedItems.length === 1 ? "" : "s"} bloqueada${blockedItems.length === 1 ? "" : "s"}`,
      body: "Los bloqueos detienen el flujo. Resuélvelos para desbloquear al equipo.",
      href: "/kanban?blocked=true",
      urgency: "high",
    });
  }

  if (overdueItems.length > 0) {
    insights.push({
      id: "ins-overdue",
      icon: "⏰",
      title: `${overdueItems.length} tarea${overdueItems.length === 1 ? "" : "s"} vencida${overdueItems.length === 1 ? "" : "s"}`,
      body: "Estas tareas superaron su fecha límite. Reprograma o escala.",
      href: "/kanban?overdue=true",
      urgency: "high",
    });
  }

  if (mineAcc.length > 0) {
    insights.push({
      id: "ins-validate",
      icon: "🧪",
      title: `${mineAcc.length} tarea${mineAcc.length === 1 ? "" : "s"} esperan tu validación`,
      body: "Están en estado EN_VALIDACIÓN y asignadas a ti. Acepta o rechaza.",
      href: "/kanban?assignedToMe=true",
      urgency: "medium",
    });
  }

  if (syncErrors.length > 0) {
    insights.push({
      id: "ins-sync",
      icon: "⚠️",
      title: `${syncErrors.length} error${syncErrors.length === 1 ? "" : "es"} de sincronización Jira`,
      body: "Tareas con estado de sync 'Error'. Verifica la conexión con Jira.",
      href: "/backlog?phase=execution&syncError=true",
      urgency: "medium",
    });
  }

  if (noActivity.length > 0) {
    insights.push({
      id: "ins-stalled",
      icon: "🕓",
      title: `${noActivity.length} tarea${noActivity.length === 1 ? "" : "s"} sin actividad en 7 días`,
      body: "Tareas que llevan más de una semana sin movimiento. Revisa si están atascadas.",
      href: "/backlog?phase=execution&stalled=true",
      urgency: "low",
    });
  }

  if (highPrioItems.length > 5) {
    insights.push({
      id: "ins-priority",
      icon: "🔺",
      title: `${highPrioItems.length} tareas con prioridad Alta`,
      body: "Demasiadas tareas de alta prioridad activas. Considera reducir el WIP.",
      href: "/backlog?phase=execution",
      urgency: "low",
    });
  }

  // Ordenar: high → medium → low
  return insights.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.urgency] - rank[b.urgency];
  }).slice(0, 5);
}
