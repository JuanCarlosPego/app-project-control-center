// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/workSelectors.ts
//  Funciones puras de selección de WorkItems por usuario.
//  Sin dependencias de React — testeables de forma aislada.
// ─────────────────────────────────────────────────────────

import type { WorkItem, Project } from "../../types/domain";

const CLOSED_STATE = "st-cls";

/**
 * WorkItems asignados directamente al usuario actual.
 * Excluye cerrados.
 *
 * Lógica: workItem.assignedToUserId === currentUserId
 */
export function getMyAssignments(
  workItems: WorkItem[],
  currentUserId: string,
): WorkItem[] {
  if (!currentUserId) return [];
  return workItems
    .filter(
      (wi) =>
        wi.stateId !== CLOSED_STATE &&
        wi.assignedToUserId === currentUserId,
    )
    .sort((a, b) => {
      // Bloqueados primero, luego por fecha de fin asc
      const aBlk = a.stateId === "st-blk" ? -1 : 0;
      const bBlk = b.stateId === "st-blk" ? -1 : 0;
      if (aBlk !== bBlk) return aBlk - bBlk;
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
}

/**
 * WorkItems que el usuario solicitó (o cuyo proyecto solicitó)
 * pero que están asignados a OTRA persona — el usuario está esperando.
 * Excluye cerrados.
 *
 * Lógica:
 *   (wi.requestedByUserId === currentUserId
 *    OR project.requestedByUserId === currentUserId)
 *   AND wi.assignedToUserId !== currentUserId
 */
export function getWaitingOnOthers(
  workItems: WorkItem[],
  projects: Project[],
  currentUserId: string,
): WorkItem[] {
  if (!currentUserId) return [];

  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return workItems
    .filter((wi) => {
      if (wi.stateId === CLOSED_STATE) return false;
      if (wi.assignedToUserId === currentUserId) return false;
      const proj = projectMap.get(wi.projectId);
      return (
        wi.requestedByUserId === currentUserId ||
        proj?.requestedByUserId === currentUserId
      );
    })
    .sort((a, b) => {
      // Agrupa por assignedToRole, luego por fecha asc
      if (a.assignedToRole < b.assignedToRole) return -1;
      if (a.assignedToRole > b.assignedToRole) return 1;
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
}
