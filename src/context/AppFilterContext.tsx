// ─────────────────────────────────────────────────────────
//  src/context/AppFilterContext.tsx
//  Contexto global de filtros de ámbito temporal/espacial.
//
//  Jerarquía de cascada:
//    selectedYear  → restringe los proyectos visibles
//    selectedAreaId → filtra proyectos dentro del año
//    selectedProjectId → ámbito de detalle (Backlog/Kanban/Activity/Evidences)
//
//  Persistencia: localStorage ("pcc:filter:year/area/project")
//  Carga inicial: businessAreas + todos los proyectos (para dropdowns y validación)
// ─────────────────────────────────────────────────────────

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { getBusinessAreas, getProjects } from "../services/projectService";
import { getAreasByUser, getPOAreas } from "../services/businessAreaService";
import type { BusinessArea, Project } from "../types/domain";
import { useEffectiveUser } from "../auth/ImpersonationContext";

// ── localStorage helpers ──────────────────────────────────
const SK_YEAR    = "pcc:filter:year";
const SK_AREA    = "pcc:filter:area";
const SK_PROJECT = "pcc:filter:project";

function readLS(key: string, fallback: string): string {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function writeLS(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

const THIS_YEAR = new Date().getFullYear();

// ── Context shape ─────────────────────────────────────────
export interface AppFilterContextValue {
  // Ámbito global seleccionado
  selectedYear:      number;
  selectedAreaId:    string;   // "" = todas las áreas
  selectedProjectId: string;   // "" = todos los proyectos

  // Catálogos derivados (para dropdowns)
  areas:           BusinessArea[];
  /** Áreas filtradas por las relaciones del usuario efectivo (membresía / PO).
   *  Admin e IT ven todas. Los demás solo ven las áreas a las que pertenecen. */
  visibleAreas:    BusinessArea[];
  projectsInScope: Project[];  // proyectos en el año + área seleccionados

  // Setters con cascade
  setYear:      (year: number) => void;
  setArea:      (areaId: string) => void;
  setProject:   (projectId: string) => void;
  resetFilters: () => void;

  // Indica si el catálogo aún está cargando (primera vez)
  loading: boolean;
}

const AppFilterContext = createContext<AppFilterContextValue>({
  selectedYear:      THIS_YEAR,
  selectedAreaId:    "",
  selectedProjectId: "",
  areas:           [],
  visibleAreas:    [],
  projectsInScope: [],
  setYear:      () => undefined,
  setArea:      () => undefined,
  setProject:   () => undefined,
  resetFilters: () => undefined,
  loading:      false,
});

// ── AppFilterProvider ─────────────────────────────────────
export const AppFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // Usuario efectivo (respeta impersonación)
  const { user: effectiveUser } = useEffectiveUser();

  // Restaurar desde localStorage
  const [selectedYear, _setYear] = useState<number>(() => {
    const y = parseInt(readLS(SK_YEAR, String(THIS_YEAR)), 10);
    return isNaN(y) ? THIS_YEAR : y;
  });
  const [selectedAreaId,    _setArea]    = useState(() => readLS(SK_AREA,    ""));
  const [selectedProjectId, _setProject] = useState(() => readLS(SK_PROJECT, ""));

  // Catálogos
  const [areas,        setAreas]        = useState<BusinessArea[]>([]);
  const [visibleAreas, setVisibleAreas] = useState<BusinessArea[]>([]);
  const [allProjects,  setAllProjects]  = useState<Project[]>([]);
  const [loading,      setLoading]      = useState(true);

  // Carga de catálogos al montar (una sola vez)
  useEffect(() => {
    setLoading(true);
    Promise.all([getBusinessAreas(), getProjects()])
      .then(([areasData, projectsData]) => {
        setAreas(areasData);
        setAllProjects(projectsData);
      })
      .catch(() => { /* degradación silenciosa — la app sigue funcionando */ })
      .finally(() => setLoading(false));
  }, []);

  // ── Áreas visibles según rol del usuario efectivo ─────
  // Admin e IT AirEuropa ven el catálogo completo.
  // El resto ve únicamente las áreas donde tienen membresía (Member/KeyUser) o son PO.
  useEffect(() => {
    if (areas.length === 0) return;

    const role = effectiveUser.role;
    if (role === "Admin" || role === "IT AirEuropa") {
      setVisibleAreas(areas);
      return;
    }

    Promise.all([
      getAreasByUser(effectiveUser.id),
      getPOAreas(effectiveUser.id),
    ])
      .then(([memberAreas, poAreas]) => {
        const ids = new Set([
          ...memberAreas.map((a) => a.id),
          ...poAreas.map((a) => a.id),
        ]);
        setVisibleAreas(areas.filter((a) => ids.has(a.id)));
      })
      .catch(() => setVisibleAreas(areas)); // fallback: mostrar todas si falla
  }, [areas, effectiveUser.id, effectiveUser.role]);

  // Si el área seleccionada ya no está en las visibles, limpiarla
  useEffect(() => {
    if (
      selectedAreaId &&
      visibleAreas.length > 0 &&
      !visibleAreas.some((a) => a.id === selectedAreaId)
    ) {
      _setArea("");
      writeLS(SK_AREA, "");
    }
  }, [visibleAreas, selectedAreaId]);

  // Proyectos en ámbito (año + área) — para el dropdown de proyecto y validación cascade
  const projectsInScope = useMemo<Project[]>(() => {
    // El año se deriva SOLO de startDate (no endDate) — fuente de verdad del spec.
    let list = allProjects.filter(
      (p) => p.startDate.startsWith(String(selectedYear)),
    );
    if (selectedAreaId) {
      // Hay área concreta seleccionada → filtrar a esa área
      list = list.filter((p) => p.businessAreaId === selectedAreaId);
    } else if (visibleAreas.length > 0 && visibleAreas.length < areas.length) {
      // Sin área concreta, pero el usuario tiene visibilidad restringida
      // → mostrar solo proyectos de sus áreas visibles
      const visibleIds = new Set(visibleAreas.map((a) => a.id));
      list = list.filter((p) => p.businessAreaId && visibleIds.has(p.businessAreaId));
    }
    return list;
  }, [allProjects, selectedYear, selectedAreaId, visibleAreas, areas.length]);

  // Cascade: si el proyecto seleccionado ya no está en ámbito, limpiarlo
  useEffect(() => {
    if (
      selectedProjectId &&
      projectsInScope.length > 0 &&
      !projectsInScope.some((p) => p.id === selectedProjectId)
    ) {
      _setProject("");
      writeLS(SK_PROJECT, "");
    }
  }, [projectsInScope, selectedProjectId]);

  // ── Setters ───────────────────────────────────────────
  const setYear = useCallback((year: number) => {
    _setYear(year);
    writeLS(SK_YEAR, String(year));
    // projectId se valida via el efecto de projectsInScope
  }, []);

  const setArea = useCallback((areaId: string) => {
    _setArea(areaId);
    writeLS(SK_AREA, areaId);
    // projectId se valida via el efecto de projectsInScope
  }, []);

  const setProject = useCallback((projectId: string) => {
    _setProject(projectId);
    writeLS(SK_PROJECT, projectId);
  }, []);

  const resetFilters = useCallback(() => {
    _setYear(THIS_YEAR);
    _setArea("");
    _setProject("");
    writeLS(SK_YEAR,    String(THIS_YEAR));
    writeLS(SK_AREA,    "");
    writeLS(SK_PROJECT, "");
  }, []);

  const value = useMemo<AppFilterContextValue>(
    () => ({
      selectedYear, selectedAreaId, selectedProjectId,
      areas, visibleAreas, projectsInScope,
      setYear, setArea, setProject, resetFilters,
      loading,
    }),
    [
      selectedYear, selectedAreaId, selectedProjectId,
      areas, visibleAreas, projectsInScope,
      setYear, setArea, setProject, resetFilters,
      loading,
    ],
  );

  return (
    <AppFilterContext.Provider value={value}>
      {children}
    </AppFilterContext.Provider>
  );
};

// ── Hook de consumo ───────────────────────────────────────
export const useAppFilter = (): AppFilterContextValue => useContext(AppFilterContext);
