// ─────────────────────────────────────────────────────────
//  src/screens/activity/ActivityPage.tsx
//  Pantalla "Actividad / Timeline" — estilo Microsoft Fluent
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, RefreshCw, Download } from "lucide-react";

// — Design System —
import {
  PageHeader, Button, LoadingSkeleton,
  ErrorState as UIErrorState, EmptyState as UIEmptyState,
  color, font, spacing,
} from "../../components/ui";

// — Auth / RBAC —
import { useEffectiveUser } from "../../auth/ImpersonationContext";
import { useAppFilter } from "../../context/AppFilterContext";
import { useProjectScope } from "../../hooks/useProjectScope";

// — Servicios —
import {
  getActivityFeed, exportActivityCSV,
  type ActivityFilters as ApiFilters,
} from "../../services/activityService";
import { getProjects, getBusinessAreas, getProviders }  from "../../services/projectService";
import { getWorkItems, getStates, getTransitions }       from "../../services/workItemService";
import { getAppUsers }                                   from "../../services/userManagementService";

// — Tipos —
import type {
  ActivityLogEntry, Project, WorkItem, AppUser,
  State, Transition, BusinessArea, Provider, AppRole,
} from "../../types/domain";

// — Componentes locales —
import {
  ActivityFilters,
  EMPTY_ACTIVITY_FILTERS,
  hasActiveFilters,
  type ActivityFilterState,
} from "./components/ActivityFilters";
import { ActivityTimeline } from "./components/ActivityTimeline";

// — Drawers (re-usados desde otras pantallas) —
import { WorkItemDrawer } from "../kanban/components/WorkItemDrawer";
import { ProjectDrawer }  from "../projects/components/ProjectDrawer";

// ── Roles que pueden exportar ─────────────────────────────
const EXPORT_ROLES: AppRole[] = ["Admin", "IT AirEuropa"];

// ── ActivityPage ──────────────────────────────────────────
export const ActivityPage: React.FC = () => {
  const { user: effectiveUser, roles } = useEffectiveUser();
  const canExport = roles.some((r) => EXPORT_ROLES.includes(r));

  // ── Ámbito global (fuente de verdad) ─────────────────────────────
  const { selectedProjectId, selectedYear, selectedAreaId } = useAppFilter();
  const { projectIdsScope, hasScope } = useProjectScope();

  // ── Estado UI ─────────────────────────────────────────────────
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  // ── Filtros locales (sin Proyecto, que viene del contexto) ───────────
  const [filters, setFilters] = useState<ActivityFilterState>(EMPTY_ACTIVITY_FILTERS);

  // ── Datos ────────────────────────────────────────────
  const [logs,      setLogs]      = useState<ActivityLogEntry[]>([]);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [appUsers,  setAppUsers]  = useState<AppUser[]>([]);
  const [states,    setStates]    = useState<State[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [areas,     setAreas]     = useState<BusinessArea[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);

  // ── Drawers ───────────────────────────────────────────
  const [openWI,      setOpenWI]      = useState<WorkItem | null>(null);
  const [openProject, setOpenProject] = useState<Project  | null>(null);

  // ── Carga de datos ────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);

  const buildApiFilters = useCallback((f: ActivityFilterState): ApiFilters => ({
    projectId:  selectedProjectId || undefined,
    entityType: f.entityType || undefined,
    action:     f.action     || undefined,
    whoRole:    f.whoRole    || undefined,
    from:       f.from       || undefined,
    to:         f.to         || undefined,
    query:      f.query      || undefined,
  }), [selectedProjectId]);

  const loadData = useCallback(async (showRefresh = false) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (showRefresh) setRefreshing(true);
    else             setLoading(true);
    setError(null);

    try {
      const [logsRes, projectsRes, workItemsRes, statesRes, transitionsRes, areasRes, providersRes, usersRes] =
        await Promise.all([
          getActivityFeed(buildApiFilters(filters)),
          getProjects(),
          getWorkItems(),
          getStates(),
          getTransitions(),
          getBusinessAreas(),
          getProviders(),
          getAppUsers(),
        ]);

      setLogs(logsRes);
      setProjects(projectsRes);
      setWorkItems(workItemsRes);
      setStates(statesRes);
      setTransitions(transitionsRes);
      setAreas(areasRes);
      setProviders(providersRes);
      setAppUsers(usersRes);
    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setError("No se pudo cargar la actividad. Inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, buildApiFilters, selectedProjectId]);

  // Carga inicial
  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtros cliente (toggles + scope anual) ──────────────────────
  const filtered = useMemo(() => {
    let result = logs;

    // Scope anual+área+proyecto: filtrar por projectIdsScope
    // (entradas sin projectId de tipo Settings/RBAC solo se muestran
    //  cuando el scope es global, i.e. sin área ni proyecto específicos)
    if (projectIdsScope.size > 0 || hasScope) {
      result = result.filter((l) => {
        // Entradas globales (RBAC, Settings sin projectId)
        if (!l.projectId) {
          if (l.entityType === "Settings" || l.entityType === "RBAC") {
            return !selectedAreaId && !selectedProjectId;
          }
          // WorkItem sin projectId directo → resolver por workItems
          if (l.entityType === "WorkItem") {
            const wi = workItems.find((w) => w.id === l.entityId);
            return wi ? projectIdsScope.has(wi.projectId) : false;
          }
          return true; // otros sin projectId: incluir
        }
        return projectIdsScope.has(l.projectId);
      });
    }
    if (filters.onlyMine && effectiveUser) {
      result = result.filter((l) => l.who === effectiveUser.id);
    }
    if (filters.onlyBlocked) {
      result = result.filter(
        (l) => l.action === "STATE_CHANGED" && l.to.toLowerCase().includes("bloquead"),
      );
    }
    if (filters.onlyState) {
      result = result.filter((l) => l.action === "STATE_CHANGED");
    }
    return result;
  }, [logs, filters.onlyMine, filters.onlyBlocked, filters.onlyState, effectiveUser,
      projectIdsScope, hasScope, selectedAreaId, selectedProjectId, workItems]);

  // ── Refresh cuando cambian los filtros de API ─────────
  const prevApiFilters = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(buildApiFilters(filters));
    if (key !== prevApiFilters.current) {
      prevApiFilters.current = key;
      loadData();
    }
  }, [filters.entityType, filters.action, filters.whoRole, filters.from, filters.to, filters.query, selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Exportar CSV ──────────────────────────────────────
  const handleExport = () => {
    if (!filtered.length) return;
    exportActivityCSV(filtered, appUsers, projects);
  };

  // ── Reset filtros ─────────────────────────────────────
  const handleReset = () => setFilters(EMPTY_ACTIVITY_FILTERS);

  // ── Render ────────────────────────────────────────────
  const canSeeRole = roles.some((r) => r === "Admin" || r === "IT AirEuropa");

  return (
    <div style={{
      padding: `${spacing[6]}px ${spacing[7]}px`,
      fontFamily: font.family,
      background: "#FAF9F8",
      minHeight: "100vh",
      maxWidth: 1100,
      margin: "0 auto",
      boxSizing: "border-box" as const,
    }}>
      {/* Header ────────────────────────────────────────── */}
      <PageHeader
        icon={<Clock size={20} />}
        title="Actividad"
        subtitle="Cronología de cambios, evidencias y acciones del sistema"
        bordered
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw size={13} />}
              loading={refreshing}
              onClick={() => loadData(true)}
            >
              Refrescar
            </Button>
            {canExport && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Download size={13} />}
                onClick={handleExport}
              >
                Exportar CSV
              </Button>
            )}
          </>
        }
      />

      {/* Filtros ─────────────────────────────────────── */}
      <ActivityFilters
        filters={filters}
        onChange={setFilters}
        projects={projects}
        onReset={handleReset}
        canSeeRole={canSeeRole}
      />

      {/* Estados UI ─────────────────────────────────── */}
      {loading && (
        <LoadingSkeleton variant="row" count={8} />
      )}

      {!loading && error && (
        <UIErrorState message={error} onRetry={() => loadData()} />
      )}

      {!loading && !error && filtered.length === 0 && !loading && (
        <UIEmptyState
          icon={<Clock size={32} />}
          title={
            !hasScope
              ? `Sin proyectos en ${selectedYear}`
              : hasActiveFilters(filters) ? "Sin resultados" : "Sin actividad registrada"
          }
          description={
            !hasScope
              ? `No hay proyectos con inicio en ${selectedYear}. Cambia el año en el Ámbito.`
              : hasActiveFilters(filters)
              ? "Prueba a ajustar o limpiar los filtros para ver más eventos."
              : "Cuando se realicen cambios en proyectos o tareas, aparecerán aquí."
          }
          action={
            hasScope && hasActiveFilters(filters)
              ? <Button size="sm" variant="ghost" onClick={handleReset}>Limpiar filtros</Button>
              : undefined
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          {/* Contador de resultados */}
          <div style={{
            display: "flex", justifyContent: "flex-end",
            marginBottom: spacing[3],
          }}>
            <span style={{ fontSize: font.size.xs, color: color.textMuted }}>
              {filtered.length} {filtered.length === 1 ? "evento" : "eventos"}
              {hasActiveFilters(filters) ? " (filtrados)" : ""}
            </span>
          </div>

          {/* Timeline */}
          <ActivityTimeline
            logs={filtered}
            workItems={workItems}
            projects={projects}
            appUsers={appUsers}
            onOpenWorkItem={(wi) => setOpenWI(wi)}
            onOpenProject={(p) => setOpenProject(p)}
          />
        </>
      )}

      {/* WorkItemDrawer ──────────────────────────────── */}
      {openWI && (
        <WorkItemDrawer
          item={openWI}
          states={states}
          transitions={transitions}
          currentUserRoles={roles}
          onClose={() => setOpenWI(null)}
          onMoveFromDrawer={() => { /* no-op: en /activity no movemos tareas */ }}
          onItemUpdated={(updated) => setOpenWI(updated)}
        />
      )}

      {/* ProjectDrawer ───────────────────────────────── */}
      {openProject && (
        <ProjectDrawer
          project={openProject}
          areas={areas}
          providers={providers}
          roles={roles}
          states={states}
          onClose={() => setOpenProject(null)}
        />
      )}
    </div>
  );
};
