// ─────────────────────────────────────────────────────────
//  src/hooks/useProjectScope.ts
//
//  Hook centralizado de scope de proyectos.
//
//  Regla (spec):
//    1) proyectos cuyo year(startDate) === selectedYear
//    2) si selectedAreaId != "" → filtrar por businessAreaId
//    3) si selectedProjectId != "" → solo ese proyecto
//
//  La lógica de pasos 1-2 ya la realiza AppFilterContext.projectsInScope.
//  Este hook añade el paso 3 y expone projectIdsScope (Set<string>)
//  que es la fuente de verdad para TODAS las pantallas.
// ─────────────────────────────────────────────────────────

import { useMemo } from "react";
import { useAppFilter } from "../context/AppFilterContext";
import type { Project } from "../types/domain";

export interface ProjectScope {
  /** Proyectos en ámbito: year + area + proyecto (si seleccionado). */
  scopedProjects: Project[];
  /** Set de IDs para filtrado O(1). */
  projectIdsScope: Set<string>;
  /**
   * true si hay al menos un proyecto en el ámbito.
   * false cuando el año no tiene proyectos → mostrar empty state anual.
   */
  hasScope: boolean;
  /** Año activo (fuente: AppFilterContext). */
  selectedYear: number;
}

/**
 * Devuelve el scope de proyectos resuelto según selectedYear + Area + Project.
 * Usar en BacklogPage, ActivityPage, EvidencesPage, RisksPage,
 * ReportsPage, AuditPage y RequestsPage.
 */
export function useProjectScope(): ProjectScope {
  const {
    selectedYear,
    selectedProjectId,
    projectsInScope, // ya filtrado por year + area en AppFilterContext
  } = useAppFilter();

  // Aplica el filtro de proyecto específico (nivel 3 de la jerarquía)
  const scopedProjects = useMemo<Project[]>(() => {
    if (!selectedProjectId) return projectsInScope;
    return projectsInScope.filter((p) => p.id === selectedProjectId);
  }, [projectsInScope, selectedProjectId]);

  const projectIdsScope = useMemo(
    () => new Set(scopedProjects.map((p) => p.id)),
    [scopedProjects],
  );

  return {
    scopedProjects,
    projectIdsScope,
    hasScope: scopedProjects.length > 0,
    selectedYear,
  };
}
