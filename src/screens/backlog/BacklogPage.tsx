// ─────────────────────────────────────────────────────────
//  src/screens/backlog/BacklogPage.tsx
//  Pantalla /backlog — Gestión profesional de tareas (WorkItems)
//  estilo Azure DevOps / Jira adaptado al modelo Air Europa.
//
//  Fase por defecto: "backlog" (st-new + st-ref).
//  Datos: MSW → /api/workitems, /api/projects, /api/states,
//              /api/transitions, /api/app-users
// ─────────────────────────────────────────────────────────

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import {
  RefreshCw, Activity, AlertTriangle, ListChecks, PlayCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffectiveUser } from "../../auth/ImpersonationContext";
import { useAppFilter } from "../../context/AppFilterContext";
import {
  getWorkItems, getStates, getTransitions, patchWorkItemState,
} from "../../services/workItemService";
import { listAppUsers } from "../../services/userService";
import { useProjectScope } from "../../hooks/useProjectScope";
import { getProjects } from "../../services/projectService";
import { apiClient } from "../../services/apiClient";
import type {
  WorkItem, Project, State, Transition,
  AppRole, AppUser,
} from "../../types/domain";
import { ApiError } from "../../services/apiClient";

import { BacklogFilters, EMPTY_BACKLOG_FILTERS, PHASE_STATES, type BacklogFilterState, type BacklogPhase, type BacklogView } from "./components/BacklogFilters";
import { BacklogTable } from "./components/BacklogTable";
import { BacklogWorkItemDrawer } from "./components/BacklogWorkItemDrawer";
import { CreateWorkItemModal } from "../projects/components/CreateWorkItemModal";
import { AssignUserModal } from "../kanban/components/AssignUserModal";

// ── Tokens ────────────────────────────────────────────────
const PREF_KEY = "pcc:backlog:view";
function loadView(): BacklogView {
  try { return (localStorage.getItem(PREF_KEY) as BacklogView) ?? "flat"; } catch { return "flat"; }
}
function saveView(v: BacklogView) {
  try { localStorage.setItem(PREF_KEY, v); } catch { /* ignore */ }
}

// ── KPI Strip ─────────────────────────────────────────────
interface KPIData {
  total: number;
  backlog: number;
  execution: number;
  blocked: number;
  closed: number;
}

const KPIStrip: React.FC<{
  kpi: KPIData;
  activeFilter: string | null;
  onFilter: (f: string | null) => void;
}> = ({ kpi, activeFilter, onFilter }) => {
  const pills = [
    { key: "total",     label: "Total tareas",    value: kpi.total,     icon: <ListChecks size={16} />, color: "#0078D4", bg: "#EFF6FC" },
    { key: "backlog",   label: "En backlog",      value: kpi.backlog,   icon: <Activity size={16} />,   color: "#7530AF", bg: "#F3EFF7" },
    { key: "execution", label: "En ejecución",    value: kpi.execution, icon: <PlayCircle size={16} />, color: "#107C10", bg: "#E1EFDD" },
    { key: "blocked",   label: "Bloqueadas",      value: kpi.blocked,   icon: <AlertTriangle size={16} />, color: "#D13438", bg: "#FDE7E9" },
  ] as const;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 10, marginBottom: 16,
    }}>
      {pills.map((p) => {
        const isActive = activeFilter === p.key;
        return (
          <div
            key={p.key}
            role="button" tabIndex={0}
            onClick={() => onFilter(isActive ? null : p.key)}
            onKeyDown={(e) => { if (e.key === "Enter") onFilter(isActive ? null : p.key); }}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              background: isActive ? p.bg : "#fff",
              border: `1.5px solid ${isActive ? p.color : "#EDEBE9"}`,
              borderRadius: 8, padding: "12px 16px",
              cursor: "pointer", transition: "all 140ms",
              boxShadow: isActive ? `0 2px 8px ${p.color}22` : "none",
            }}
          >
            <span style={{ color: p.color }}>{p.icon}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: p.color, lineHeight: 1 }}>
                {p.value}
              </div>
              <div style={{ fontSize: 10, color: "#8A8886", fontFamily: "'Segoe UI', sans-serif", marginTop: 2 }}>
                {p.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Toast ─────────────────────────────────────────────────
interface ToastMsg { id: number; msg: string; ok: boolean }
let _tid = 0;

/** Estados considerados "ejecución" (lo que se ve en Kanban) */
const EXECUTION_STATES = new Set(["st-prog", "st-blk", "st-rft", "st-test", "st-acc"]);
const BACKLOG_STATES   = new Set(["st-new", "st-ref"]);

// ── BacklogPage ───────────────────────────────────────────
export const BacklogPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Usar siempre el usuario EFECTIVO (simulado ?? real) — NO useAuth() directamente.
  const { user: currentUser, roles: effectiveRoles } = useEffectiveUser();
  const userRoles = effectiveRoles.filter((r): r is AppRole => r !== "Invitado");
  const appUser = currentUser as import("../../auth/ImpersonationContext").AppUser;

  // ── Ámbito global (fuente de verdad) ─────────────────────────────
  const {
    selectedProjectId, selectedYear,
  } = useAppFilter();
  const { projectIdsScope, hasScope } = useProjectScope();

  // IDs de proyectos en ámbito (año + área + proyecto) — via hook centralizado
  const scopedProjectIds = projectIdsScope;

  // ── RBAC gating ──────────────────────────────────────────
  // TASK_CREATE: Solo IT AirEuropa y Admin pueden crear WorkItems directamente.
  // Proveedor/Usuario crean SOLICITUDES, no WorkItems.
  const canCreate = userRoles.some((r) => ["Admin", "IT AirEuropa"].includes(r));
  // canRequestOnly: Proveedor/Usuario redirigen a /requests
  const canRequestOnly = userRoles.some((r) => ["Proveedor", "Usuario"].includes(r));
  // isBypass: Admin/IT AirEuropa pueden mover/editar cualquier tarea
  const isBypass = userRoles.some((r) => ["Admin", "IT AirEuropa"].includes(r));

  // ── Remote data ───────────────────────────────────────
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [workItems,   setWorkItems]   = useState<WorkItem[]>([]);
  const [states,      setStates]      = useState<State[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [userMap,     setUserMap]     = useState<Record<string, string>>({}); // id → displayName
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────
  const [view,        setView]        = useState<BacklogView>(loadView);
  const [filters,     setFilters]     = useState<BacklogFilterState>(() => {
    // Deep-link desde Home Inteligente
    const phase        = searchParams.get("phase") as BacklogPhase | null;
    const blocked      = searchParams.get("blocked") === "true";
    const overdue      = searchParams.get("overdue") === "true";
    const assignedToMe = searchParams.get("assignedToMe") === "true";
    return {
      ...EMPTY_BACKLOG_FILTERS,
      phase:             phase ?? EMPTY_BACKLOG_FILTERS.phase,
      onlyBlocked:       blocked,
      onlyDueSoon:       overdue,
      onlyAssignedToMe:  assignedToMe,
    };
  });
  const [kpiFilter,   setKpiFilter]   = useState<string | null>(null);
  const [drawerWI,    setDrawerWI]    = useState<WorkItem | null>(null);
  const [createOpen,  setCreateOpen]  = useState(false);
  const [toasts,      setToasts]      = useState<ToastMsg[]>([]);
  const [sendingToKanban, setSendingToKanban] = useState<Set<string>>(new Set());
  const [users,       setUsers]       = useState<AppUser[]>([]);
  const [pendingKanban, setPendingKanban] = useState<{ wi: WorkItem; transition: Transition } | null>(null);

  // ── Badge de filtro activo (deep-link) ─────────────────
  const deepLinkBadge = useMemo(() => {
    const blocked      = searchParams.get("blocked") === "true";
    const overdue      = searchParams.get("overdue") === "true";
    const assignedToMe = searchParams.get("assignedToMe") === "true";
    const syncError    = searchParams.get("syncError") === "true";
    const stalled      = searchParams.get("stalled") === "true";
    const phase        = searchParams.get("phase");
    if (blocked)      return "Bloqueadas";
    if (overdue)      return "Vencidas";
    if (assignedToMe) return "Asignadas a mí";
    if (syncError)    return "Error de sync";
    if (stalled)      return "Sin actividad 7d";
    if (phase)        return `Fase: ${phase}`;
    return null;
  }, [searchParams]);

  // ── Abrir drawer cuando llega ?wi= de deep-link ───────
  const deepLinkWiId    = searchParams.get("wi");
  const deepLinkOpened  = useRef(false);
  const [highlightedWiId, setHighlightedWiId] = useState<string | null>(null);
  useEffect(() => {
    if (!deepLinkWiId || workItems.length === 0 || deepLinkOpened.current) return;
    const wi = workItems.find((w) => w.id === deepLinkWiId);
    if (wi) {
      setDrawerWI(wi);
      setHighlightedWiId(wi.id);
      setTimeout(() => setHighlightedWiId(null), 4000);
      deepLinkOpened.current = true;
    }
  }, [deepLinkWiId, workItems]);

  // ── Toast helper ──────────────────────────────────────
  const showToast = useCallback((msg: string, ok = true) => {
    const t: ToastMsg = { id: ++_tid, msg, ok };
    setToasts((prev) => [...prev, t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
  }, []);

  // ── Carga de datos ────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prjs, sts, trns] = await Promise.all([
        getProjects(),
        getStates(),
        getTransitions(),
      ]);
      setProjects(prjs);
      setStates(sts);
      setTransitions(trns);

      const wis = await getWorkItems(
        selectedProjectId ? { projectId: selectedProjectId } : {},
      );
      setWorkItems(wis);

      // Cargar usuarios completos (para AssignUserModal y userMap)
      try {
        const appUsers = await listAppUsers();
        setUsers(appUsers);
        const map: Record<string, string> = {};
        appUsers.forEach((u) => { map[u.id] = u.displayName; });
        setUserMap(map);
      } catch { /* no crítico */ }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar el backlog");
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── "Enviar a Kanban": st-ref → st-prog (o primera transición válida) ──
  const executeSendToKanban = useCallback(async (wi: WorkItem, transition: Transition, assignedToUserId?: string) => {
    setSendingToKanban((prev) => new Set([...prev, wi.id]));
    try {
      const updated = await patchWorkItemState(wi.id, { toStateId: transition.toStateId, assignedToUserId });
      setWorkItems((prev) => prev.map((w) => w.id === wi.id ? { ...w, ...updated } : w));
      if (drawerWI?.id === wi.id) setDrawerWI((d) => d ? { ...d, ...updated } : d);
      showToast(`"${wi.title}" enviada a Kanban ✓`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al enviar a Kanban", false);
    } finally {
      setSendingToKanban((prev) => { const s = new Set(prev); s.delete(wi.id); return s; });
    }
  }, [drawerWI, showToast]);

  const handleSendToKanban = useCallback((wi: WorkItem) => {
    const transition = transitions.find(
      (t) => t.fromStateId === wi.stateId &&
             (t.toStateId === "st-prog" || EXECUTION_STATES.has(t.toStateId)),
    );
    if (!transition) {
      showToast("No hay transición válida para enviar a Kanban desde el estado actual.", false);
      return;
    }
    // Si la transición requiere asignación de usuario → mostrar modal
    if (transition.requireUserAssignment || (transition.assignToRole && transition.assignToRole.length > 0)) {
      setPendingKanban({ wi, transition });
      return;
    }
    executeSendToKanban(wi, transition);
  }, [transitions, showToast, executeSendToKanban]);

  // ── Filtrado client-side ──────────────────────────────
  const filtered = useMemo(() => {
    let list = workItems;

    // Scope anual+área+proyecto — SIEMPRE aplica
    list = list.filter((wi) => scopedProjectIds.has(wi.projectId));

    // ── Filtro de FASE (el más importante) ────────────────
    const phaseStates = PHASE_STATES[filters.phase];
    if (phaseStates.length > 0) {
      const allowed = new Set(phaseStates);
      list = list.filter((wi) => allowed.has(wi.stateId));
    }

    // ── Búsqueda libre (título, código, tags, proyecto, usuario) ──
    if (filters.query.trim()) {
      const q = filters.query.toLowerCase();
      const projectMap = new Map(projects.map((p) => [p.id, p]));
      list = list.filter((wi) => {
        const proj = projectMap.get(wi.projectId);
        const userName = userMap[wi.assignedToUserId ?? ""] ?? "";
        return (
          wi.title.toLowerCase().includes(q) ||
          (wi.jiraIssueKey ?? "").toLowerCase().includes(q) ||
          wi.id.toLowerCase().includes(q) ||
          wi.tags.some((t) => t.toLowerCase().includes(q)) ||
          (proj?.code ?? "").toLowerCase().includes(q) ||
          (proj?.name ?? "").toLowerCase().includes(q) ||
          userName.toLowerCase().includes(q)
        );
      });
    }

    // ── Filtros de faceta ─────────────────────────────────
    if (filters.assignedToRole) {
      list = list.filter((wi) => wi.assignedToRole === filters.assignedToRole);
    }
    if (filters.priority) {
      list = list.filter((wi) => wi.priority === filters.priority);
    }
    if (filters.onlyBlocked) {
      list = list.filter((wi) => wi.stateId === "st-blk");
    }
    if (filters.onlyDueSoon) {
      list = list.filter((wi) => {
        if (!wi.endDate) return false;
        const diff = new Date(wi.endDate).getTime() - Date.now();
        return diff >= 0 && diff <= 14 * 86_400_000;
      });
    }
    if (filters.onlyAssignedToMe) {
      list = list.filter((wi) => wi.assignedToUserId === appUser.id);
    }
    if (filters.onlyMyTeam) {
      const myTeams = new Set(appUser.teamIds ?? []);
      list = list.filter((wi) => wi.assignedToTeamId != null && myTeams.has(wi.assignedToTeamId));
    }
    if (filters.onlyUnassigned) {
      list = list.filter((wi) => !wi.assignedToUserId && !wi.assignedToRole);
    }

    // ── KPI filter (secundario, sobre el conjunto ya filtrado por fase) ──
    if (kpiFilter === "backlog") {
      list = list.filter((wi) => BACKLOG_STATES.has(wi.stateId));
    } else if (kpiFilter === "execution") {
      list = list.filter((wi) => EXECUTION_STATES.has(wi.stateId));
    } else if (kpiFilter === "blocked") {
      list = list.filter((wi) => wi.stateId === "st-blk");
    }

    // ── Filtros de deep-link adicionales (syncError, stalled) ──────
    if (searchParams.get("syncError") === "true") {
      list = list.filter((wi) => wi.syncStatus === "Error");
    }
    if (searchParams.get("stalled") === "true") {
      const threshold = Date.now() - 7 * 86_400_000;
      list = list.filter((wi) => {
        const ref = wi.startDate ? new Date(wi.startDate).getTime() : 0;
        return ref < threshold;
      });
    }

    return list;
  }, [workItems, scopedProjectIds, filters, kpiFilter, projects, userMap, appUser, searchParams]);

  // ── KPI data (sobre el scope completo sin filtros de búsqueda) ───
  const kpiData: KPIData = useMemo(() => {
    const base = workItems.filter((wi) => scopedProjectIds.has(wi.projectId));
    return {
      total:     base.length,
      backlog:   base.filter((wi) => BACKLOG_STATES.has(wi.stateId)).length,
      execution: base.filter((wi) => EXECUTION_STATES.has(wi.stateId)).length,
      blocked:   base.filter((wi) => wi.stateId === "st-blk").length,
      closed:    base.filter((wi) => wi.stateId === "st-cls").length,
    };
  }, [workItems, scopedProjectIds]);

  // ── Reordenar (DnD) ───────────────────────────────────
  const handleReorder = useCallback(async (reordered: WorkItem[]) => {
    setWorkItems((prev) => {
      const others = prev.filter((wi) => !reordered.some((r) => r.id === wi.id));
      return [...reordered, ...others];
    });
    try {
      const ids = reordered.map((wi) => wi.id);
      await apiClient.patch("/workitems/order", { ids });
    } catch {
      /* No mostramos error — el reordenamiento visual ya se aplicó */
    }
  }, []);

  // ── WorkItem actualizado desde drawer ─────────────────
  const handleUpdated = useCallback((updated: WorkItem) => {
    setWorkItems((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    if (drawerWI?.id === updated.id) setDrawerWI(updated);
    showToast("Tarea actualizada correctamente");
  }, [drawerWI, showToast]);

  // ── Vista ─────────────────────────────────────────────
  const handleViewChange = (v: BacklogView) => {
    setView(v); saveView(v);
  };

  // ── Proyecto seleccionado (para drawer) ───────────────
  const drawerProject = drawerWI
    ? projects.find((p) => p.id === drawerWI.projectId)
    : undefined;

  const createProject = selectedProjectId
    ? projects.find((p) => p.id === selectedProjectId) ?? null
    : null;

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{
      padding: "20px 24px", minHeight: "100%",
      background: "#FAF9F8", boxSizing: "border-box",
      fontFamily: "'Segoe UI', sans-serif",
    }}>

      {/* ── Filtros + header ── */}
      <BacklogFilters
        filters={filters}
        onChange={(f) => { setFilters(f); setKpiFilter(null); }}
        view={view}
        onViewChange={handleViewChange}
        canCreate={canCreate}
        canRequestOnly={canRequestOnly}
        onNew={() => setCreateOpen(true)}
        totalVisible={filtered.length}
      />

      {/* Badge de filtro activo de deep-link */}
      {deepLinkBadge && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 16px",
          background: "#FFF4CE",
          borderBottom: "1px solid #F7CA5C",
        }}>
          <span style={{ fontSize: 12 }}>🔍</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#7A5700" }}>
            Filtro activo desde Home:
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            padding: "2px 10px", borderRadius: 12,
            background: "#C17D00", color: "#fff",
          }}>
            {deepLinkBadge}
          </span>
          <button
            onClick={() => {
              setFilters(EMPTY_BACKLOG_FILTERS);
              window.history.replaceState(null, "", "/backlog");
            }}
            style={{
              marginLeft: "auto",
              fontSize: 11, color: "#7A5700", background: "none",
              border: "1px solid #C17D00", borderRadius: 6,
              padding: "2px 8px", cursor: "pointer",
              fontFamily: "'Segoe UI', sans-serif", fontWeight: 600,
            }}
          >
            Quitar filtro ✕
          </button>
        </div>
      )}

      {/* ── KPI Strip ── */}
      {!loading && !error && (
        <KPIStrip kpi={kpiData} activeFilter={kpiFilter} onFilter={setKpiFilter} />
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 10, padding: "48px", color: "#0078D4", fontSize: 13,
        }}>
          <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
          Cargando tareas…
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── Error ── */}
      {!loading && error && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 10, padding: "48px", textAlign: "center",
        }}>
          <AlertTriangle size={28} color="#D13438" />
          <p style={{ margin: 0, fontSize: 14, color: "#D13438", fontWeight: 600 }}>{error}</p>
          <button onClick={loadData} style={{
            padding: "8px 16px", borderRadius: 5, border: "1px solid #0078D4",
            background: "#EFF6FC", color: "#0078D4", cursor: "pointer",
            fontSize: 12, fontWeight: 600,
          }}>
            Reintentar
          </button>
        </div>
      )}

      {/* ── Empty state por año ── */}
      {!loading && !error && !hasScope && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "60px 24px", gap: 10, color: "#8A8886",
          fontFamily: "'Segoe UI', sans-serif", textAlign: "center",
        }}>
          <span style={{ fontSize: 36 }}>📅</span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#605E5C" }}>
            Sin proyectos en {selectedYear}
          </p>
          <p style={{ margin: 0, fontSize: 12 }}>
            No hay proyectos con startDate en el año seleccionado.
            Cambia el año en el <strong>Ámbito</strong>.
          </p>
        </div>
      )}

      {/* ── Tabla ── */}
      {!loading && !error && hasScope && (
        <BacklogTable
          items={filtered}
          projects={projects}
          states={states}
          roles={userRoles}
          appUser={appUser}
          transitions={transitions}
          userMap={userMap}
          view={view}
          isBypass={isBypass}
          sendingToKanban={sendingToKanban}
          highlightedWiId={highlightedWiId}
          onSelect={setDrawerWI}
          onReorder={handleReorder}
          onSendToKanban={handleSendToKanban}
          onViewInKanban={(wi) => navigate(`/kanban?wi=${wi.id}`)}
        />
      )}

      {/* ── WorkItem Drawer ── */}
      <BacklogWorkItemDrawer
        workItem={drawerWI}
        project={drawerProject}
        states={states}
        transitions={transitions}
        roles={userRoles}
        appUser={appUser}
        users={users}
        onClose={() => setDrawerWI(null)}
        onUpdated={handleUpdated}
      />

      {/* ── Modal asignación usuario (Enviar a Kanban) ── */}
      {pendingKanban && (
        <AssignUserModal
          newRole={(pendingKanban.transition.assignToRole ?? [])} 
          project={projects.find((p) => p.id === pendingKanban.wi.projectId)}
          users={users}
          toStateName={states.find((s) => s.id === pendingKanban.transition.toStateId)?.name ?? pendingKanban.transition.toStateId}
          fromStateName={states.find((s) => s.id === pendingKanban.transition.fromStateId)?.name ?? pendingKanban.transition.fromStateId}
          onConfirm={(assignedToUserId) => {
            const { wi, transition } = pendingKanban;
            setPendingKanban(null);
            executeSendToKanban(wi, transition, assignedToUserId);
          }}
          onCancel={() => setPendingKanban(null)}
        />
      )}

      {/* ── Modal crear tarea ── */}
      {createOpen && (
        <CreateWorkItemModal
          open={createOpen}
          project={createProject ?? null}
          projects={projects}
          states={states}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            loadData();
            showToast("Tarea creada correctamente");
          }}
        />
      )}

      {/* ── Toasts ── */}
      <div style={{
        position: "fixed", bottom: 24, right: 24,
        display: "flex", flexDirection: "column", gap: 8,
        zIndex: 999, pointerEvents: "none",
      }}>
        {toasts.map((t) => (
          <div key={t.id} style={{
            background: t.ok ? "#107C10" : "#D13438",
            color: "#fff", padding: "10px 16px",
            borderRadius: 6, fontSize: 12, fontWeight: 600,
            fontFamily: "'Segoe UI', sans-serif",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            animation: "fadeIn 200ms ease",
            maxWidth: 320,
          }}>
            {t.msg}
          </div>
        ))}
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    </div>
  );
};
