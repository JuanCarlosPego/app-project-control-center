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
import type { BusinessArea, Project } from "../types/domain";

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
  projectsInScope: [],
  setYear:      () => undefined,
  setArea:      () => undefined,
  setProject:   () => undefined,
  resetFilters: () => undefined,
  loading:      false,
});

// ── AppFilterProvider ─────────────────────────────────────
export const AppFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // Restaurar desde localStorage
  const [selectedYear, _setYear] = useState<number>(() => {
    const y = parseInt(readLS(SK_YEAR, String(THIS_YEAR)), 10);
    return isNaN(y) ? THIS_YEAR : y;
  });
  const [selectedAreaId,    _setArea]    = useState(() => readLS(SK_AREA,    ""));
  const [selectedProjectId, _setProject] = useState(() => readLS(SK_PROJECT, ""));

  // Catálogos
  const [areas,       setAreas]       = useState<BusinessArea[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading,     setLoading]     = useState(true);

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

  // Proyectos en ámbito (año + área) — para el dropdown de proyecto y validación cascade
  const projectsInScope = useMemo<Project[]>(() => {
    // El año se deriva SOLO de startDate (no endDate) — fuente de verdad del spec.
    let list = allProjects.filter(
      (p) => p.startDate.startsWith(String(selectedYear)),
    );
    if (selectedAreaId) {
      list = list.filter((p) => p.businessAreaId === selectedAreaId);
    }
    return list;
  }, [allProjects, selectedYear, selectedAreaId]);

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
      areas, projectsInScope,
      setYear, setArea, setProject, resetFilters,
      loading,
    }),
    [
      selectedYear, selectedAreaId, selectedProjectId,
      areas, projectsInScope,
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
