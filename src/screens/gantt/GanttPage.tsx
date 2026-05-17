// ─────────────────────────────────────────────────────────
//  src/screens/gantt/GanttPage.tsx
//  Pantalla /gantt — Planificación por fechas
//
//  Datos: MSW → /api/projects, /api/workitems,
//               /api/states, /api/business-areas, /api/providers
//
//  Jerarquía visual:
//    Épica (Project) → WorkItems (hijos, fechas dentro del rango de la épica)
//    Expand/collapse por épica.
//
//  Progreso de épica: count(WI.state=Cerrado) / count(WI) * 100
//  Calculado en el handler (no almacenado).
//
//  RBAC:
//    Admin/IT: ven y editan todo
//    Proveedor: solo proyectos propios; edita solo assignedToRole=Proveedor
//    Usuario: solo lectura
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Download, Plus, BarChart2 } from "lucide-react";

import { useEffectiveUser } from "../../auth/ImpersonationContext";
import type { AppUser } from "../../auth/ImpersonationContext";
import { usePermission } from "../../auth/usePermission";
import { getProjects, getBusinessAreas, getProviders } from "../../services/projectService";
import { getWorkItems, getStates, getTransitions } from "../../services/workItemService";
import { apiClient } from "../../services/apiClient";
import { applyPersonalProjectFilters } from "../shared/projectSelectors";
import { useAppFilter } from "../../context/AppFilterContext";
import type {
  Project, WorkItem, State, BusinessArea, Provider, Team, Transition, AppRole,
} from "../../types/domain";

import { GanttFilters, EMPTY_GANTT_FILTERS, type GanttFilterState } from "./components/GanttFilters";
import { GanttSplitView, type GanttRowData } from "./components/GanttSplitView";
import { WorkItemDrawer } from "./components/WorkItemDrawer";
import { CreateWorkItemModal } from "../projects/components/CreateWorkItemModal";

// ── CSV Export ────────────────────────────────────────────
function exportGanttCSV(rows: GanttRowData[], states: State[]) {
  const stateMap = Object.fromEntries(states.map((s) => [s.id, s.name]));
  const header = ["Tipo","Épica","Título","Estado","Asignado a","Inicio","Fin","Progreso %"];
  const data = rows.map((r) => [
    r.type === "epic" ? "Épica" : "WorkItem",
    r.projectCode,
    `"${r.title}"`,
    stateMap[r.stateId] ?? r.stateId,
    r.assignedToRole,
    r.startDate, r.endDate,
    r.progress ?? "",
  ]);
  const csv = [header, ...data].map((row) => row.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `gantt-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ── Mini botón de acción ──────────────────────────────────
const ActionBtn: React.FC<{
  icon: React.ReactNode; label: string; onClick: () => void;
  disabled?: boolean; primary?: boolean;
}> = ({ icon, label, onClick, disabled, primary }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 12px", borderRadius: 5,
      border: `1px solid ${primary ? "#0078D4" : "#EDEBE9"}`,
      background: primary ? "#0078D4" : "#fff",
      color: primary ? "#fff" : "#323130",
      fontSize: 12, fontFamily: "'Segoe UI', sans-serif", fontWeight: primary ? 600 : 400,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1, transition: "background 150ms",
    }}
    onMouseEnter={(e) => {
      if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = primary ? "#006CBE" : "#F3F2F1";
    }}
    onMouseLeave={(e) => {
      if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = primary ? "#0078D4" : "#fff";
    }}
  >
    {icon}{label}
  </button>
);

// ── GanttPage ─────────────────────────────────────────────
export const GanttPage: React.FC = () => {
  const { roles: effectiveRoles, user: currentEffectiveUser } = useEffectiveUser();
  const appUser = currentEffectiveUser as AppUser;

  // ── Ámbito global (año + área + proyecto) ──────────────────────────
  const { selectedYear, selectedAreaId, selectedProjectId, projectsInScope } = useAppFilter();

  // ── Datos ────────────────────────────────────────────────────────────
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [workItems,    setWorkItems]    = useState<WorkItem[]>([]);
  const [transitions,  setTransitions]  = useState<Transition[]>([]);
  const [states,       setStates]       = useState<State[]>([]);
  const [areas,        setAreas]        = useState<BusinessArea[]>([]);
  const [providers,    setProviders]    = useState<Provider[]>([]);
  const [allAppUsers,  setAllAppUsers]  = useState<AppUser[]>([]);
  const [teams,        setTeams]        = useState<Team[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── UI ───────────────────────────────────────────────────────────────
  const [filters,        setFilters]        = useState<GanttFilterState>({
    ...EMPTY_GANTT_FILTERS,
    dateFrom: `${selectedYear}-01-01`,
    dateTo:   `${selectedYear}-12-31`,
  });
  const [expandedIds,     setExpandedIds]     = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedRow,     setSelectedRow]     = useState<GanttRowData | null>(null);
  const [createWIOpen,    setCreateWIOpen]    = useState(false);

  const canAdmin    = effectiveRoles.includes("Admin") || effectiveRoles.includes("IT AirEuropa");
  const isProveedor = (effectiveRoles as AppRole[]).includes("Proveedor") && !canAdmin;
  // Botón +WorkItem controlado por permiso RBAC TASK_CREATE
  const { allowed: canCreateWorkItem } = usePermission("TASK_CREATE");

  // Sincronizar periodo cuando cambia el año en el ámbito
  const prevYearRef = useRef(selectedYear);
  useEffect(() => {
    if (prevYearRef.current !== selectedYear) {
      prevYearRef.current = selectedYear;
      setFilters((f) => ({
        ...f,
        dateFrom: `${selectedYear}-01-01`,
        dateTo:   `${selectedYear}-12-31`,
      }));
    }
  }, [selectedYear]);


  // ── Carga de datos ────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projs, wis, areasData, providersData, statesData, trns, appUsersData, teamsData] = await Promise.all([
        getProjects({ year: String(selectedYear), areaId: selectedAreaId || undefined }),
        getWorkItems(),
        getBusinessAreas(),
        getProviders(),
        getStates(),
        getTransitions(),
        apiClient.get<AppUser[]>("/app-users"),
        apiClient.get<Team[]>("/teams"),
      ]);
      setProjects(projs);
      setWorkItems(wis);
      setAreas(areasData);
      setProviders(providersData);
      setStates(statesData);
      setTransitions(trns);
      setAllAppUsers(Array.isArray(appUsersData) ? appUsersData : []);
      setTeams(Array.isArray(teamsData) ? teamsData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el Gantt");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedAreaId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Proyectos filtrados ────────────────────────────────
  const filteredProjects = useMemo(() => {
    let list = projects;
    if (selectedProjectId)         list = list.filter((p) => p.id === selectedProjectId);
    if (filters.deliveryOwnerType) list = list.filter((p) => p.deliveryOwnerType === filters.deliveryOwnerType);
    if (filters.providerId)        list = list.filter((p) => p.providerId === filters.providerId);
    list = applyPersonalProjectFilters(
      list,
      { onlyWaitingOnOthers: filters.onlyWaitingOnOthers },
      appUser.id,
    );
    return list;
  }, [projects, selectedProjectId, filters.deliveryOwnerType, filters.providerId, filters.onlyWaitingOnOthers, appUser.id]);

  const visibleProjectIds = useMemo(
    () => new Set(filteredProjects.map((p) => p.id)),
    [filteredProjects],
  );

  // ── Filtrado de WorkItems ──────────────────────────────
  const filteredWorkItems = useMemo(() => {
    let list = workItems.filter((wi) => visibleProjectIds.has(wi.projectId));
    // Filtro por estado (chips) — aplica sobre workItems
    if (filters.stateIds.length > 0)  list = list.filter((wi) => filters.stateIds.includes(wi.stateId));
    if (filters.assignedToRole)        list = list.filter((wi) => wi.assignedToRole === filters.assignedToRole);
    if (filters.dateFrom)              list = list.filter((wi) => wi.endDate >= filters.dateFrom);
    if (filters.dateTo)                list = list.filter((wi) => wi.startDate <= filters.dateTo);
    // "Asignadas a mí": assignedToUserId === currentUser.id (CORRECTO)
    if (filters.onlyAssignedToMe)
      list = list.filter((wi) => wi.assignedToUserId === appUser.id);
    return list;
  }, [workItems, visibleProjectIds, filters, appUser.id]);

  // ── WorkItems agrupados por épica (post-filtro) ──────────
  const wiByProject = useMemo(() => {
    const map: Record<string, WorkItem[]> = {};
    filteredWorkItems.forEach((wi) => {
      if (!map[wi.projectId]) map[wi.projectId] = [];
      map[wi.projectId].push(wi);
    });
    return map;
  }, [filteredWorkItems]);

  // WIs sin filtro de estado/asignado: para contar Cerradas X/Y sobre el total real
  const allWiByProject = useMemo(() => {
    const ids = new Set(filteredProjects.map((p) => p.id));
    const map: Record<string, WorkItem[]> = {};
    workItems.filter((wi) => ids.has(wi.projectId)).forEach((wi) => {
      if (!map[wi.projectId]) map[wi.projectId] = [];
      map[wi.projectId].push(wi);
    });
    return map;
  }, [workItems, filteredProjects]);

  // Mapas de lookup para nombres
  const userById  = useMemo(() => Object.fromEntries(allAppUsers.map((u) => [u.id, u])), [allAppUsers]);
  const teamById  = useMemo(() => Object.fromEntries(teams.map((t) => [t.id, t])),       [teams]);
  const projectById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])),  [projects]);

  const STATUS_TO_STATE: Record<string, string> = {
    "En curso":  "st-prog",
    "Pendiente": "st-new",
    "Bloqueado": "st-blk",
    "Cerrado":   "st-cls",
  };

  // ── Construcción de filas Gantt ───────────────────────
  const rows = useMemo((): GanttRowData[] => {
    const result: GanttRowData[] = [];

    const makeEpicRow = (project: Project, wis: WorkItem[], epicRowId: string): GanttRowData => {
      const allWIs    = allWiByProject[project.id] ?? [];
      const closed    = allWIs.filter((w) => w.stateId === "st-cls").length;
      const totalWIs  = allWIs.length;
      return {
        id:             epicRowId,
        type:           "epic",
        projectId:      project.id,
        projectCode:    project.code,
        title:          project.name,
        stateId:        STATUS_TO_STATE[project.status] ?? "st-new",
        assignedToRole: project.deliveryOwnerType === "IT" ? "IT AirEuropa" : "Proveedor",
        startDate:      project.startDate,
        endDate:        project.endDate,
        progress:       totalWIs > 0 ? Math.round((closed / totalWIs) * 100) : project.progress,
        closedCount:    closed,
        totalWICount:   totalWIs,
        hasChildren:    wis.length > 0,
        isExpanded:     expandedIds.has(epicRowId),
        indent:         0,
      };
    };

    const makeWIRow = (wi: WorkItem, project: Project): GanttRowData => ({
      id:                    wi.id,
      type:                  "workitem",
      parentId:              project.id,
      projectId:             project.id,
      projectCode:           project.code,
      title:                 wi.title,
      stateId:               wi.stateId,
      assignedToRole:        wi.assignedToRole,
      assignedToUserId:      wi.assignedToUserId ?? undefined,
      assignedToTeamId:      wi.assignedToTeamId,
      assignedToDisplayName: wi.assignedToUserId ? (userById[wi.assignedToUserId]?.displayName ?? wi.assignedToUserId) : undefined,
      startDate:             wi.startDate,
      endDate:               wi.endDate,
      progress:              wi.progress,
      priority:              wi.priority,
      wiType:                wi.type,
      blockedReason:         wi.blockedReason,
      tags:                  wi.tags,
      jiraUrl:               wi.jiraUrl,
      jiraIssueKey:          wi.jiraIssueKey,
      sprintName:            wi.sprintName,
      hasChildren:           false,
      isExpanded:            false,
      indent:                1,
    });

    const pushEpicAndChildren = (project: Project, wis: WorkItem[], epicRowId: string) => {
      // Ocultar épica si el filtro de estado está activo y no quedan WIs
      if (filters.stateIds.length > 0 && wis.length === 0) return;
      result.push(makeEpicRow(project, wis, epicRowId));
      if (expandedIds.has(epicRowId)) {
        wis.forEach((wi) => result.push(makeWIRow(wi, project)));
      }
    };

    if (!filters.groupBy) {
      // Sin agrupación: lista plana de épicas → WorkItems
      filteredProjects.forEach((p) =>
        pushEpicAndChildren(p, wiByProject[p.id] ?? [], p.id),
      );
      return result;
    }

    // ── Agrupación por propiedad de PROJECT (area) ────────
    if (filters.groupBy === "area") {
      const getKey   = (p: Project) => p.businessAreaId || "sin-area";
      const getLabel = (key: string) => areas.find((a) => a.id === key)?.name ?? "Sin Área";

      const groupOrder: string[] = [];
      const groupMap: Record<string, Project[]> = {};
      for (const p of filteredProjects) {
        const key = getKey(p);
        if (!groupMap[key]) { groupOrder.push(key); groupMap[key] = []; }
        groupMap[key].push(p);
      }
      groupOrder.sort((a, b) => getLabel(a).localeCompare(getLabel(b)));

      for (const key of groupOrder) {
        const isCollapsed = collapsedGroups.has(`group-${key}`);
        const groupWIs = filteredWorkItems.filter((wi) => groupMap[key].some((p) => p.id === wi.projectId));
        result.push({
          id: `group-${key}`, type: "group",
          projectId: "", projectCode: "", title: getLabel(key),
          stateId: "", assignedToRole: "", startDate: "", endDate: "",
          hasChildren: false, isExpanded: false, indent: -1,
          isCollapsed, groupCount: groupWIs.length, groupKey: key,
        });
        if (!isCollapsed) {
          groupMap[key].forEach((p) => pushEpicAndChildren(p, wiByProject[p.id] ?? [], p.id));
        }
      }
      return result;
    }

    // ── Agrupación por propiedad de WORKITEM (role/assignedTo/team) ────
    const getWIKey = (wi: WorkItem): string => {
      if (filters.groupBy === "role")       return wi.assignedToRole;
      if (filters.groupBy === "assignedTo") return wi.assignedToUserId ?? "sin-asignar";
      if (filters.groupBy === "team")       return wi.assignedToTeamId ?? "sin-equipo";
      return "";
    };
    const getGroupLabel = (key: string): string => {
      if (filters.groupBy === "role") return key;
      if (filters.groupBy === "assignedTo") {
        if (key === "sin-asignar") return "Sin asignar";
        return userById[key]?.displayName ?? key;
      }
      if (filters.groupBy === "team") {
        if (key === "sin-equipo") return "Sin equipo";
        return teamById[key]?.name ?? key;
      }
      return key;
    };

    // Construir: groupKey → Map<projectId, WorkItem[]>
    const groupOrder: string[] = [];
    const groupMap: Record<string, Map<string, WorkItem[]>> = {};
    for (const wi of filteredWorkItems) {
      const key = getWIKey(wi);
      if (!groupMap[key]) { groupOrder.push(key); groupMap[key] = new Map(); }
      if (!groupMap[key].has(wi.projectId)) groupMap[key].set(wi.projectId, []);
      groupMap[key].get(wi.projectId)!.push(wi);
    }
    groupOrder.sort((a, b) => getGroupLabel(a).localeCompare(getGroupLabel(b)));

    for (const key of groupOrder) {
      const isCollapsed = collapsedGroups.has(`group-${key}`);
      const totalWIs = [...groupMap[key].values()].reduce((s, a) => s + a.length, 0);
      result.push({
        id: `group-${key}`, type: "group",
        projectId: "", projectCode: "", title: getGroupLabel(key),
        stateId: "", assignedToRole: "", startDate: "", endDate: "",
        hasChildren: false, isExpanded: false, indent: -1,
        isCollapsed, groupCount: totalWIs, groupKey: key,
      });
      if (!isCollapsed) {
        const epicEntries = [...groupMap[key].entries()]
          .sort(([idA], [idB]) => (projectById[idA]?.name ?? "").localeCompare(projectById[idB]?.name ?? ""));
        for (const [projectId, wis] of epicEntries) {
          const project = projectById[projectId];
          if (project) {
            // ID compuesto para que un proyecto no colisione entre grupos
            pushEpicAndChildren(project, wis, `${project.id}::${key}`);
          }
        }
      }
    }
    return result;
  }, [filteredProjects, filteredWorkItems, wiByProject, allWiByProject, expandedIds, collapsedGroups,
      filters.groupBy, filters.stateIds, areas, userById, teamById, projectById]);

  // ── Toggle expand (épica) ─────────────────────────────
  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Toggle grupo colapsable ────────────────────────────
  const handleToggleGroup = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Colapsar / expandir todos los grupos ──────────────
  const handleCollapseAll = () => {
    const groupIds = rows.filter((r) => r.type === "group").map((r) => r.id);
    setCollapsedGroups(new Set(groupIds));
  };
  const handleExpandAll = () => setCollapsedGroups(new Set());

  // ── Selección de fila ─────────────────────────────────
  const handleSelect = (row: GanttRowData) => {
    if (row.type === "group") return;
    if (row.type === "epic") {
      handleToggleExpand(row.id);
    } else {
      setSelectedRow((prev) => prev?.id === row.id ? null : row);
    }
  };

  // ── Botón de detalle → Drawer (FIX: ya no navega a ruta en blanco) ──
  const handleGoToDetail = (row: GanttRowData) => {
    if (row.type === "epic" || row.type === "workitem") {
      setSelectedRow(row);
    }
  };

  // ── Actualizar fechas en estado local tras guardar ────
  const handleSaved = (id: string, startDate: string, endDate: string) => {
    setWorkItems((prev) =>
      prev.map((wi) => wi.id === id ? { ...wi, startDate, endDate } : wi),
    );
    setSelectedRow((prev) =>
      prev?.id === id ? { ...prev, startDate, endDate } : prev,
    );
  };

  // ── Estadísticas rápidas ──────────────────────────────
  const stats = useMemo(() => ({
    epics:   filteredProjects.length,
    total:   filteredWorkItems.length,
    blocked: filteredWorkItems.filter((wi) => wi.stateId === "st-blk").length,
    closed:  filteredWorkItems.filter((wi) => wi.stateId === "st-cls").length,
  }), [filteredProjects, filteredWorkItems]);

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{ padding: "20px 24px", minHeight: "100%", background: "#FAF9F8", boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{
        background: "#fff", borderRadius: 10, border: "1px solid #EDEBE9",
        padding: "16px 20px 14px", marginBottom: 14,
        display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <BarChart2 size={18} color="#0078D4" />
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1B2A3E" }}>Gantt</h1>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#8A8886" }}>
            Planificación por fechas · Épicas → WorkItems
          </p>
        </div>

        {/* Stats rápidas */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {[
                      { label: "Épicas",     value: stats.epics,   color: "#7530AF" },
            { label: "WorkItems", value: stats.total,   color: "#0078D4" },
            { label: "Bloqueados",value: stats.blocked, color: "#D13438" },
            { label: "Cerrados",  value: stats.closed,  color: "#107C10" },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "#8A8886", fontFamily: "'Segoe UI', sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Acciones */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canCreateWorkItem && (
            <ActionBtn
              icon={<Plus size={13} />}
              label="+WorkItem"
              primary
              onClick={() => setCreateWIOpen(true)}
            />
          )}
          <ActionBtn
            icon={<RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />}
            label="Refrescar"
            onClick={loadData}
            disabled={loading}
          />
          {canAdmin && (
            <ActionBtn
              icon={<Download size={13} />}
              label="CSV"
              onClick={() => exportGanttCSV(rows, states)}
              disabled={rows.length === 0}
            />
          )}
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>

      {/* Filtros */}
      <GanttFilters
        filters={filters}
        onChange={setFilters}
        providers={providers}
        states={states}
        canEdit={canAdmin}
        canSeePersonal={!isProveedor}
        selectedYear={selectedYear}
        hasGroups={filters.groupBy !== ""}
        allGroupsCollapsed={
          rows.filter((r) => r.type === "group").length > 0 &&
          rows.filter((r) => r.type === "group").every((r) => collapsedGroups.has(r.id))
        }
        onCollapseAll={handleCollapseAll}
        onExpandAll={handleExpandAll}
      />

      {/* Error */}
      {error && !loading && (
        <div style={{
          textAlign: "center", padding: "40px 20px",
          background: "#FDF3F0", borderRadius: 8, border: "1px solid #FDCFBC",
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>⚠️</div>
          <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#D83B01" }}>{error}</p>
          <button
            onClick={loadData}
            style={{
              padding: "7px 16px", borderRadius: 5, border: "none",
              background: "#D83B01", color: "#fff", cursor: "pointer",
              fontSize: 12, fontFamily: "'Segoe UI', sans-serif", fontWeight: 600,
            }}
          >Reintentar</button>
        </div>
      )}

      {/* Hint Proveedor read-only */}
      {isProveedor && !canAdmin && (
        <div style={{
          background: "#FFF4CE", border: "1px solid #F4D180", borderRadius: 6,
          padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "#835B00",
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          Modo lectura: Solo visualizas los proyectos asignados a tu proveedor. Para editar fechas, contacta con IT AirEuropa.
        </div>
      )}

      {/* Empty state: año sin proyectos */}
      {!loading && !error && rows.filter((r) => r.type !== "group").length === 0 && projectsInScope.length === 0 && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "60px 20px",
          background: "#fff", borderRadius: 8, border: "1px solid #EDEBE9", marginBottom: 12,
        }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📅</div>
          <p style={{ margin: 0, fontWeight: 700, color: "#323130", fontSize: 14 }}>
            No hay datos en {selectedYear}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#8A8886" }}>
            Cambia el año en el Ámbito para ver proyectos.
          </p>
        </div>
      )}

      {/* Gantt split view */}
      {!error && (
        <GanttSplitView
          rows={rows}
          states={states}
          zoom={filters.zoom}
          showToday={filters.showToday}
          selectedId={selectedRow?.id ?? null}
          onSelect={handleSelect}
          onToggleExpand={handleToggleExpand}
          onGoToDetail={handleGoToDetail}
          onToggleGroup={handleToggleGroup}
          rangeFrom={filters.dateFrom || `${selectedYear}-01-01`}
          rangeTo={filters.dateTo   || `${selectedYear}-12-31`}
          loading={loading}
        />
      )}

      {/* WorkItem Drawer */}
      <WorkItemDrawer
        row={selectedRow}
        states={states}
        transitions={transitions}
        roles={effectiveRoles as AppRole[]}
        appUser={appUser}
        onClose={() => setSelectedRow(null)}
        onSaved={handleSaved}
      />

      {/* Modal crear WorkItem */}
      {createWIOpen && (
        <CreateWorkItemModal
          open={createWIOpen}
          project={selectedProjectId ? (projects.find((p) => p.id === selectedProjectId) ?? null) : null}
          projects={filteredProjects.length > 0 ? filteredProjects : projects}
          states={states}
          onClose={() => setCreateWIOpen(false)}
          onCreated={() => { setCreateWIOpen(false); loadData(); }}
        />
      )}
    </div>
  );
};
