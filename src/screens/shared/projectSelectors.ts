// ─────────────────────────────────────────────────────────
//  src/screens/shared/projectSelectors.ts
//  Selectores puros para filtros personales de Projects/Épicas.
//  Reutilizados en ProjectsPage, RoadmapPage, GanttPage, etc.
// ─────────────────────────────────────────────────────────

import type { Project } from "../../types/domain";

// ── "Asignadas a mí" ─────────────────────────────────────
// El proyecto tiene assignedToUserId === currentUserId.
export function isProjectAssignedToMe(
  project: Project,
  currentUserId: string,
): boolean {
  return !!currentUserId && project.assignedToUserId === currentUserId;
}

// ── "Esperando a terceros" ────────────────────────────────
// El proyecto lo solicité yo (requestedByUserId) pero el
// responsable actual (assignedToUserId) es otra persona.
export function isProjectWaitingOnOthers(
  project: Project,
  currentUserId: string,
): boolean {
  if (!currentUserId) return false;
  const iRequested  = project.requestedByUserId === currentUserId;
  const assignedElsewhere =
    !!project.assignedToUserId && project.assignedToUserId !== currentUserId;
  return iRequested && assignedElsewhere;
}

// ── Filtrar lista de proyectos ────────────────────────────
export interface PersonalProjectFilterFlags {
  onlyAssignedToMe?:    boolean;  // projects where I'm the assignee
  onlyWaitingOnOthers?: boolean;  // projects I requested, assigned to others
}

/**
 * Aplica los quick-filters personales sobre una lista de proyectos.
 * Si ambos activos → unión.
 * Si ninguno → devuelve la lista sin cambios.
 */
export function applyPersonalProjectFilters(
  projects:      Project[],
  flags:         PersonalProjectFilterFlags,
  currentUserId: string,
): Project[] {
  const { onlyAssignedToMe, onlyWaitingOnOthers } = flags;
  if (!onlyAssignedToMe && !onlyWaitingOnOthers) return projects;

  return projects.filter((p) => {
    if (onlyAssignedToMe    && isProjectAssignedToMe(p, currentUserId))    return true;
    if (onlyWaitingOnOthers && isProjectWaitingOnOthers(p, currentUserId)) return true;
    return false;
  });
}
