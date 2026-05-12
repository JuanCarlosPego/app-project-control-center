// ─────────────────────────────────────────────────────────
//  src/screens/kanban/KanbanPage.tsx
//  Orchestrador principal del tablero Kanban
//
//  NUEVO:
//  - Lee ?projectId= de la URL para arrancar ya filtrado
//  - Carga AppSettings (wipLimits, strictValidation, adminBypass)
//  - RBAC drag: solo muestra grab/drag en cards con ≥1 transición
//  - Al soltar en columna no permitida: revert + uiEvent + toast
//  - Durante drag activa highlight/dim de columnas destino
//  - Filtros nuevos: onlyBlocked, onlyDueSoon, onlyActionRequired
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  WorkItem, Project, State, Transition, AppRole, EvidencePayload, AppSettings, User, Team, AppUser,
} from "../../types/domain";
import {
  getWorkItems, getStates, getTransitions, patchWorkItemState,
  getSettings, logUIEvent, getUsers,
} from "../../services/workItemService";
import { getProjects } from "../../services/projectService";
import { listTeams }   from "../../services/teamService";
import { useEffectiveUser } from "../../auth/ImpersonationContext";
import { useAppFilter } from "../../context/AppFilterContext";
import { canActOnWorkItem, BYPASS_ROLES } from "../../auth/workItemPermissions";
import { ErrorState as UIErrorState, InlineSpinner } from "../../components/ui";

// ── ErrorBoundary (evita pantalla en blanco ante crash de render) ──────
interface EBState { error: Error | null }
class KanbanErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error): EBState { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 32, fontFamily: "'Segoe UI', sans-serif",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
        }}>
          <div style={{ fontSize: 28 }}>⚠️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#A4262C" }}>Error inesperado en el Kanban</div>
          <div style={{
            background: "#FDE7E9", border: "1px solid #F4B8BB", borderRadius: 6,
            padding: "10px 16px", fontSize: 12, color: "#A4262C", maxWidth: 500,
            fontFamily: "monospace", wordBreak: "break-all",
          }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload(); }}
            style={{
              padding: "8px 20px", borderRadius: 5, border: "none",
              background: "#0078D4", color: "#fff", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import { KanbanHeader } from "./components/KanbanHeader";
import { KanbanFilters, type KanbanFilterState } from "./components/KanbanFilters";
import { KPIBar, buildPills } from "./components/KPIBar";
import { KanbanBoard } from "./components/KanbanBoard";
import { WorkItemDrawer } from "./components/WorkItemDrawer";
import { EvidenceModal } from "./components/EvidenceModal";
import { AssignUserModal } from "./components/AssignUserModal";

// ── Toast simple ─────────────────────────────────────────
interface ToastMsg { id: number; msg: string; ok: boolean }
let _tid = 0;
const newToast = (msg: string, ok: boolean): ToastMsg => ({ id: ++_tid, msg, ok });

// ── Pending move (esperando evidencia) ───────────────────
interface PendingMove {
  workItemId: string;
  fromStateId: string;  // snapshot para rollback si se cancela
  toStateId: string;
  transition: Transition;
}

// ── Pending assignment (cambio de rol tras evidencia) ────
interface PendingAssignment {
  workItemId: string;
  fromStateId: string;  // snapshot para rollback
  toStateId: string;
  newRole: AppRole;
  evidence?: EvidencePayload;
}

// ── Default settings (fallback si falla la carga) ────────
const DEFAULT_SETTINGS: AppSettings = {
  strictValidation: false,
  adminBypass: false,
  jiraSyncEnabled: true,
  wipLimits: {},
};

// ── Helpers ───────────────────────────────────────────────
function isDueSoon(endDate: string): boolean {
  if (!endDate) return false;
  const diff = new Date(endDate).getTime() - Date.now();
  return diff >= 0 && diff <= 14 * 24 * 60 * 60 * 1000;
}

function isOverdue(endDate: string): boolean {
  if (!endDate) return false;
  return new Date(endDate) < new Date();
}

// ── KanbanPage (inner) ────────────────────────────────────
export const KanbanPage: React.FC = () => {
  // IMPORTANTE: usar siempre el usuario EFECTIVO (simulado ?? real).
  // useAuth() devuelve el rol del usuario autenticado REAL, lo que rompería
  // la simulación de usuarios. useEffectiveUser() es la única fuente de verdad.
  const { user: currentUser, roles: effectiveRoles } = useEffectiveUser();
  const appUser = currentUser as AppUser;
  // Filtrar "Invitado" para la firma de AppRole[] requerida por canActOnWorkItem
  const userRoles = effectiveRoles.filter((r): r is AppRole => r !== "Invitado");
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Ámbito global ────────────────────────────────────────
  const {
    selectedProjectId: ctxProjectId,
    selectedYear,
    selectedAreaId,
    areas,
    projectsInScope,
    loading: ctxLoading,
  } = useAppFilter();

  // ── Remote state ──────────────────────────────────────
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [workItems,   setWorkItems]   = useState<WorkItem[]>([]);
  const [states,      setStates]      = useState<State[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [settings,    setSettings]    = useState<AppSettings>(DEFAULT_SETTINGS);
  const [users,       setUsers]       = useState<User[]>([]);
  const [teams,       setTeams]       = useState<Team[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // ── selectedProjectId: siempre del Contexto Global (sin estado local) ────
  // ctxProjectId="" → sin proyecto específico → "all"
  const selectedProjectId = ctxProjectId || "all";

  // ── Inicializar filtros según ?scope= / deep-link params del Dashboard ──
  const [filters, setFilters] = useState<KanbanFilterState>(() => {
    const scope        = searchParams.get("scope");
    const blocked      = searchParams.get("blocked") === "true";
    const overdue      = searchParams.get("overdue") === "true";
    const assignedToMe = searchParams.get("assignedToMe") === "true";
    return {
      search: "",
      roleFilter: "Todos",
      typeFilter: "Todos",
      areaFilter: "",
      swimlanes: false,
      showClosed: true,
      onlyBlocked:             blocked,
      onlyDueSoon:             overdue,
      onlyAssignedToMe:        assignedToMe || scope === "mine",
      onlyWaitingThirdParties: scope === "waiting",
    };
  });
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);

  // ── Filtro activo de deep-link (badge visual) ─────────
  const deepLinkBadge = useMemo(() => {
    const blocked      = searchParams.get("blocked") === "true";
    const overdue      = searchParams.get("overdue") === "true";
    const assignedToMe = searchParams.get("assignedToMe") === "true";
    const state        = searchParams.get("state");
    if (blocked)      return "Bloqueadas";
    if (overdue)      return "Vencidas";
    if (assignedToMe) return "Asignadas a mí";
    if (state) {
      const stateName = states.find((s) => s.id === state)?.name;
      return stateName ? `Estado: ${stateName}` : `Estado: ${state}`;
    }
    return null;
  }, [searchParams, states]);

  // ── Drawer ─────────────────────────────────────────────
  const [drawerItem, setDrawerItem] = useState<WorkItem | null>(null);

  // ── Highlight temporal (deep-link desde Home) ─────────
  const [highlightedWiId, setHighlightedWiId] = useState<string | null>(null);

  // ── Abrir drawer cuando llega ?wi= de deep-link (espera a que carguen workItems) ──
  const deepLinkWiId = searchParams.get("wi");
  const deepLinkOpened = useRef(false);
  useEffect(() => {
    if (!deepLinkWiId || workItems.length === 0 || deepLinkOpened.current) return;
    const wi = workItems.find((w) => w.id === deepLinkWiId);
    if (wi) {
      setDrawerItem(wi);
      setHighlightedWiId(wi.id);
      // Auto-clear highlight después de 4 s
      setTimeout(() => setHighlightedWiId(null), 4000);
      deepLinkOpened.current = true;
    }
  }, [deepLinkWiId, workItems]);

  // ── Evidence modal ─────────────────────────────────────
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  // ── Assignment modal ────────────────────────────────────
  const [pendingAssignment, setPendingAssignment] = useState<PendingAssignment | null>(null);

  // ── Syncing ids ────────────────────────────────────────
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

  // ── Drag state: columnas objetivo permitidas ───────────
  // null = no hay drag activo; Set<string> = stateIds donde puede dropear
  const [allowedTargetStateIds, setAllowedTargetStateIds] = useState<Set<string> | null>(null);
  const dragItemRef = useRef<WorkItem | null>(null);

  // ── Toasts ────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const showToast = useCallback((msg: string, ok = true) => {
    const t = newToast(msg, ok);
    setToasts((prev) => [...prev, t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
  }, []);

  // ── Load ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prjs, sts, trns, cfg, usrs, tms] = await Promise.all([
        getProjects(),
        getStates(),
        getTransitions(),
        getSettings().catch(() => DEFAULT_SETTINGS),
        getUsers().catch(() => [] as User[]),
        listTeams({ isActive: true }).catch(() => [] as Team[]),
      ]);
      setProjects(prjs);
      setStates(sts);
      setTransitions(trns);
      setSettings(cfg);
      setUsers(usrs);
      setTeams(tms);

      // Cargamos todos los workitems; el filtrado por año/área/proyecto
      // se hace en cliente via scopedProjectIds + filteredItems (AppFilterContext).
      const wis = await getWorkItems();
      setWorkItems(wis);
    } catch {
      setError("No se pudo cargar el tablero. Revisa la conexión.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── adminBypass: Admin puede ir a cualquier estado ────
  const isAdmin = userRoles.includes("Admin");
  const adminBypass = isAdmin && settings.adminBypass;
  // isBypassUser: Admin o IT AirEuropa — saltan el filtro de allowedRoles en
  // getAllowedTargets y handleMoveAttempt (mantienen las transiciones definidas).
  const isBypassUser = BYPASS_ROLES.some((r) => userRoles.includes(r));

  // ── RBAC + ownership: qué cards puede arrastrar este usuario ──────
  // Centralizado en canActOnWorkItem (src/auth/workItemPermissions.ts)
  const { draggableIds, lockReasonMap } = useMemo(() => {
    const ids = new Set<string>();
    const reasons: Record<string, string> = {};
    workItems.forEach((wi) => {
      const { can, reason } = canActOnWorkItem(appUser, wi, userRoles, transitions, adminBypass);
      if (can) ids.add(wi.id);
      else reasons[wi.id] = reason;
    });
    return { draggableIds: ids, lockReasonMap: reasons };
  }, [workItems, transitions, userRoles, adminBypass, appUser]);

  // ── Allowed target state IDs para una card dada ───────
  const getAllowedTargets = useCallback((item: WorkItem): Set<string> => {
    if (adminBypass) {
      // Admin con bypass total: salta transiciones y puede ir a cualquier estado
      return new Set(transitions.map((t) => t.toStateId));
    }
    if (isBypassUser) {
      // Admin/IT AirEuropa: puede usar CUALQUIER transición definida desde el estado actual
      // (no limitado por allowedRoles — el bypass de ownership ya se aplica en draggableIds)
      return new Set(
        transitions
          .filter((t) => t.fromStateId === item.stateId)
          .map((t) => t.toStateId),
      );
    }
    return new Set(
      transitions
        .filter((t) =>
          t.fromStateId === item.stateId &&
          t.allowedRoles.some((r) => userRoles.includes(r as AppRole)),
        )
        .map((t) => t.toStateId),
    );
  }, [transitions, userRoles, adminBypass, isBypassUser]);

  // ── Project map (id → Project) para lookup rápido — usado en filtro Esperando a terceros
  const projectMap = useMemo(() => {
    const m: Record<string, typeof projects[0]> = {};
    projects.forEach((p) => { m[p.id] = p; });
    return m;
  }, [projects]);

  // ── areaMap: areaId → nombre (necesario antes de filteredItems) ──────────
  const areaMap = useMemo(() => {
    const m: Record<string, string> = {};
    areas.forEach((a) => { m[a.id] = a.name; });
    return m;
  }, [areas]);

  // ── Nombre del área seleccionada (para breadcrumb) ──────────────
  const areaName = useMemo(
    () => (selectedAreaId ? (areaMap[selectedAreaId] ?? "") : ""),
    [selectedAreaId, areaMap],
  );

  // ── Nombre del proyecto seleccionado (para breadcrumb en KanbanHeader) ──
  const projectName = useMemo(() => {
    if (!ctxProjectId) return "Todos los proyectos";
    const p = projectsInScope.find((pr) => pr.id === ctxProjectId)
           ?? projects.find((pr) => pr.id === ctxProjectId);
    return p ? `[${p.code}] ${p.name}` : "Todos los proyectos";
  }, [ctxProjectId, projectsInScope, projects]);

  // ── IDs de proyectos en ámbito (año + área) — necesario antes de filteredItems
  const scopedProjectIds = useMemo(
    () => new Set(projectsInScope.map((p) => p.id)),
    [projectsInScope],
  );

  // ── projectInfoMap: projectId → { name, areaName } para las cards
  const projectInfoMap = useMemo(() => {
    const m: Record<string, { name: string; areaName: string }> = {};
    projects.forEach((p) => {
      m[p.id] = { name: p.name, areaName: areaMap[p.businessAreaId] ?? "" };
    });
    return m;
  }, [projects, areaMap]);

  // ── Filtered items ─────────────────────────────────────
  const filteredItems = useMemo(() => {
    let items = workItems;

    // ── KANBAN: Solo estados de EJECUCIÓN (nunca Backlog) ──────────────────
    // st-new y st-ref pertenecen al Backlog y nunca aparecen en el board Kanban.
    const KANBAN_VALID_STATES = new Set(["st-prog", "st-blk", "st-rft", "st-test", "st-acc", "st-cls"]);
    items = items.filter((wi) => KANBAN_VALID_STATES.has(wi.stateId));

    // ── SCOPE ANUAL + ÁREA (OBLIGATORIO): sólo WorkItems de proyectos en el año+área seleccionados.
    // Si el contexto global aún carga (ctxLoading) no filtramos para evitar pantalla vacía.
    if (!ctxLoading) {
      items = items.filter((wi) => scopedProjectIds.has(wi.projectId));
    }

    // ── FILTRO DE PROYECTO del Contexto Global ────────────
    if (ctxProjectId) {
      items = items.filter((wi) => wi.projectId === ctxProjectId);
    }

    // ── Deep-link ?state=stateId (limitar a columna específica) ──
    const deepState = searchParams.get("state");
    if (deepState) {
      items = items.filter((wi) => wi.stateId === deepState);
    }

    // KPI pill filter
    if (kpiFilter && kpiFilter !== "all") {
      const pill = buildPills(workItems).find((p) => p.id === kpiFilter);
      if (pill) items = items.filter(pill.filterFn);
    }

    // Search
    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      items = items.filter((wi) =>
        wi.title.toLowerCase().includes(q) ||
        wi.jiraIssueKey?.toLowerCase().includes(q) ||
        wi.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // Role filter
    if (filters.roleFilter !== "Todos") {
      items = items.filter((wi) => wi.assignedToRole === filters.roleFilter);
    }

    // Type filter
    if (filters.typeFilter !== "Todos") {
      items = items.filter((wi) => wi.type === filters.typeFilter);
    }

    // Hide closed (st-cls) — toggle del usuario
    if (!filters.showClosed) {
      items = items.filter((wi) => wi.stateId !== "st-cls");
    }

    // Solo bloqueados
    if (filters.onlyBlocked) {
      items = items.filter((wi) => wi.stateId === "st-blk");
    }

    // Solo vencen ≤14 días
    if (filters.onlyDueSoon) {
      items = items.filter((wi) => isDueSoon(wi.endDate) || isOverdue(wi.endDate));
    }

    // Filtro área: sólo items cuyo assignedToTeamId coincide
    if (filters.areaFilter) {
      items = items.filter((wi) => wi.assignedToTeamId === filters.areaFilter);
    }

    // ── Filtros de usuario (Asignadas a mí / Esperando a terceros) ──
    if (filters.onlyAssignedToMe || filters.onlyWaitingThirdParties) {
      const uid = currentUser.id;

      /** Tareas donde el usuario actual es el asignado */
      const isAssignedToMe = (wi: WorkItem) => wi.assignedToUserId === uid;

      /**
       * Tareas que el usuario solicitó (directamente o a través del proyecto)
       * pero que NO están asignadas a él → está esperando a terceros.
       */
      const isWaitingThirdParties = (wi: WorkItem) => {
        const proj = projectMap[wi.projectId];
        const requestedByMe =
          wi.requestedByUserId === uid ||
          proj?.requestedByUserId === uid;
        return requestedByMe && wi.assignedToUserId !== uid;
      };

      if (filters.onlyAssignedToMe && filters.onlyWaitingThirdParties) {
        // Unión: ambos activos
        items = items.filter((wi) => isAssignedToMe(wi) || isWaitingThirdParties(wi));
      } else if (filters.onlyAssignedToMe) {
        items = items.filter(isAssignedToMe);
      } else {
        items = items.filter(isWaitingThirdParties);
      }
    }

    return items;
  }, [workItems, kpiFilter, filters, currentUser.id, projectMap, scopedProjectIds, ctxProjectId, ctxLoading]);

  // ── Drag start ─────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, item: WorkItem) => {
    if (syncingIds.has(item.id)) { e.preventDefault(); return; }
    if (!draggableIds.has(item.id)) { e.preventDefault(); return; }

    dragItemRef.current = item;
    e.dataTransfer.setData("text/plain", item.id);
    e.dataTransfer.effectAllowed = "move";

    // Calcular columnas destino permitidas y activar highlight
    const allowed = getAllowedTargets(item);
    setAllowedTargetStateIds(allowed);
  }, [syncingIds, draggableIds, getAllowedTargets]);

  // ── Drag end (cleanup) ─────────────────────────────────
  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null;
    setAllowedTargetStateIds(null);
  }, []);

  // ── Drop ───────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent, toStateId: string) => {
    e.preventDefault();
    const item = dragItemRef.current;
    dragItemRef.current = null;
    setAllowedTargetStateIds(null);

    if (!item || item.stateId === toStateId) return;
    handleMoveAttempt(item, toStateId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitions, userRoles, workItems, syncingIds, adminBypass]);

  // ── Move logic (drag, drawer) ──────────────────────────
  const handleMoveAttempt = useCallback((
    item: WorkItem,
    toStateId: string,
  ) => {
    if (syncingIds.has(item.id)) {
      showToast("El elemento está sincronizando, espera un momento.", false);
      return;
    }

    // adminBypass: Admin salta cualquier regla
    if (adminBypass) {
      // Buscar transición si existe; si no, ejecutar igual (bypass)
      const transition = transitions.find(
        (t) => t.fromStateId === item.stateId && t.toStateId === toStateId,
      );
      const needsEvidence = transition?.requireEvidence || transition?.requireComment;
      if (needsEvidence) {
        logUIEvent({
          entityId: item.id, action: "DROP_EVIDENCE_REQUIRED",
          fromStateId: item.stateId, toStateId,
          whoRole: userRoles[0] ?? ("Invitado" as AppRole),
          meta: { evidenceTypes: transition!.evidenceTypes, adminBypass: true },
        });
        setPendingMove({ workItemId: item.id, fromStateId: item.stateId, toStateId, transition: transition! });
      } else {
        executeMove(item.id, toStateId, item.stateId);
      }
      return;
    }

    // strictValidation: solo transiciones definidas
    const transition = transitions.find(
      (t) => t.fromStateId === item.stateId && t.toStateId === toStateId,
    );
    if (settings.strictValidation && !transition) {
      logUIEvent({
        entityId: item.id, action: "DROP_BLOCKED_STRICT_TRANSITION",
        fromStateId: item.stateId, toStateId,
        whoRole: userRoles[0],
      });
      showToast("Transición no válida según las reglas configuradas.", false);
      return;
    }

    if (!transition) {
      // Transición no existe en la máquina de estados
      logUIEvent({
        entityId: item.id, action: "DROP_INVALID_TRANSITION",
        fromStateId: item.stateId, toStateId,
        whoRole: userRoles[0] ?? ("Invitado" as AppRole),
        meta: { fromStateId: item.stateId, toStateId },
      });
      showToast("Transición no válida entre estos estados.", false);
      return;
    }

    const hasRole =
      isBypassUser ||   // Admin/IT AirEuropa: bypass total de allowedRoles
      transition.allowedRoles.some((r) => userRoles.includes(r as AppRole));
    if (!hasRole) {
      // Registrar uiEvent de intento bloqueado por RBAC
      logUIEvent({
        entityId: item.id, action: "DROP_BLOCKED_BY_RBAC",
        fromStateId: item.stateId, toStateId,
        whoRole: userRoles[0],
        meta: { allowedRoles: transition.allowedRoles },
      });
      showToast("No tienes permisos para esta transición.", false);
      return;
    }

    // Ownership check: bloqueado si el item no pertenece al usuario
    const { can: canOwn } = canActOnWorkItem(appUser, item, userRoles, transitions, adminBypass);
    if (!canOwn) {
      logUIEvent({
        entityId: item.id, action: "DROP_BLOCKED_OWNERSHIP",
        fromStateId: item.stateId, toStateId,
        whoRole: userRoles[0] ?? "Invitado",
        meta: { assignedToUserId: item.assignedToUserId, assignedToTeamId: item.assignedToTeamId },
      });
      showToast("No tienes permisos para realizar esta acción.", false);
      return;
    }

    // confirmMove: mostrar diálogo de confirmación
    if (transition.confirmMove) {
      const ok = window.confirm(
        `¿Mover la tarea al estado "${transition.toStateId}"?\n\nEsta transición requiere confirmación explícita.`,
      );
      if (!ok) return;
    }

    // requireEvidence o requireComment: abrir modal de evidencia
    const needsEvidence = transition.requireEvidence || transition.requireComment;
    if (needsEvidence) {
      // Si requireComment y no requireEvidence → forzar evidenceTypes=["comment"]
      const effectiveTransition: typeof transition = transition.requireComment && !transition.requireEvidence
        ? { ...transition, requireEvidence: true, evidenceTypes: ["comment"] }
        : transition;
      logUIEvent({
        entityId: item.id, action: "DROP_EVIDENCE_REQUIRED",
        fromStateId: item.stateId, toStateId,
        whoRole: userRoles[0] ?? ("Invitado" as AppRole),
        meta: { evidenceTypes: effectiveTransition.evidenceTypes },
      });
      setPendingMove({ workItemId: item.id, fromStateId: item.stateId, toStateId, transition: effectiveTransition });
      return;
    }

    // requireUserAssignment o cambio de rol: abrir modal de asignación
    const newRole = transition.assignToRole as AppRole | undefined;
    const roleChanges = newRole && newRole !== item.assignedToRole;
    if (transition.requireUserAssignment || roleChanges) {
      setPendingAssignment({
        workItemId: item.id, fromStateId: item.stateId, toStateId,
        newRole: newRole ?? item.assignedToRole,
      });
      return;
    }

    executeMove(item.id, toStateId, item.stateId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transitions, userRoles, syncingIds, settings, adminBypass, isBypassUser]);

  // ── Execute move ───────────────────────────────────────
  //
  // ROLLBACK: si la API falla por cualquier motivo (transición inválida,
  // RBAC server-side, error de red…) revertimos el stateId a originalStateId
  // y mostramos toast + logueamos DROP_API_ERROR.
  //
  const executeMove = useCallback(async (
    workItemId: string,
    toStateId: string,
    originalStateId: string,   // snapshot pre-move para rollback
    evidence?: EvidencePayload,
    assignedToUserId?: string,
  ) => {
    // ── Determinar assignToRole + team auto-asignación ──────────────────────
    const transition = transitions.find(
      (t) => t.fromStateId === originalStateId && t.toStateId === toStateId,
    );
    const newRole = transition?.assignToRole as AppRole | undefined;

    // Auto-determinar team según el nuevo rol
    let newTeamId: string | null | undefined;
    if (newRole) {
      const wi = workItems.find((w) => w.id === workItemId);
      const project = wi ? projects.find((p) => p.id === wi.projectId) : undefined;
      if (newRole === "IT AirEuropa") {
        // Equipo IT interno: convención "team-it" (alineado con db.json)
        newTeamId = "team-it";
      } else if (newRole === "Proveedor" && project?.providerTeamId) {
        newTeamId = project.providerTeamId;
      } else if (newRole === "Usuario") {
        // Buscar el team de tipo "Area" cuyo nombre coincida con el área del proyecto
        // Teams "Area" no tienen areaId; se usan como heurística de nombre
        const areaTeam = teams.find(
          (t) => t.type === "Area" && project?.businessAreaId &&
                 t.id.includes(project.businessAreaId.replace("area-", "team-")),
        );
        newTeamId = areaTeam?.id ?? null;
      }
    }

    // ── Optimistic UI ───────────────────────────────────
    setWorkItems((prev) =>
      prev.map((wi) =>
        wi.id === workItemId
          ? {
              ...wi,
              stateId: toStateId,
              syncStatus: "Pending" as const,
              syncError: undefined,
              ...(newRole    ? { assignedToRole: newRole } : {}),
              ...(newTeamId !== undefined ? { assignedToTeamId: newTeamId } : {}),
              // Si el rol cambia y no se especificó usuario explícito → el modal ya lo eligió
              ...(assignedToUserId ? { assignedToUserId } : {}),
            }
          : wi,
      ),
    );
    setSyncingIds((prev) => new Set([...prev, workItemId]));

    try {
      const updated = await patchWorkItemState(workItemId, {
        toStateId,
        evidence,
        assignedToUserId,
        ...(newTeamId !== undefined ? { assignedToTeamId: newTeamId } : {}),
      });
      setWorkItems((prev) =>
        prev.map((wi) => (wi.id === workItemId ? { ...wi, ...updated } : wi)),
      );
      setDrawerItem((di) => (di?.id === workItemId ? { ...di, ...updated } : di));

      // Simular latencia sync Jira
      await new Promise((r) => setTimeout(r, 1500));
      setWorkItems((prev) =>
        prev.map((wi) =>
          wi.id === workItemId ? { ...wi, syncStatus: "OK" } : wi,
        ),
      );
      showToast("Estado actualizado y sincronizado.", true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error desconocido";

      // ── ROLLBACK: volver EXACTAMENTE a posición y estado originales ──
      setWorkItems((prev) =>
        prev.map((wi) =>
          wi.id === workItemId
            ? { ...wi, stateId: originalStateId, syncStatus: "OK", syncError: undefined }
            : wi,
        ),
      );
      // Si el drawer está abierto para esta card, revertirlo también
      setDrawerItem((di) =>
        di?.id === workItemId ? { ...di, stateId: originalStateId } : di,
      );

      // Registrar el fallo como uiEvent (telemetría)
      logUIEvent({
        entityId: workItemId,
        action: "DROP_API_ERROR",
        fromStateId: originalStateId,
        toStateId,
        whoRole: userRoles[0] ?? ("Invitado" as AppRole),
        meta: { error: msg },
      });

      showToast(`Error al mover: ${msg}`, false);
    } finally {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(workItemId);
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast, userRoles, transitions, workItems, projects, teams]);

  // ── Evidence confirm ───────────────────────────────────
  const handleEvidenceConfirm = useCallback((evidence: EvidencePayload) => {
    if (!pendingMove) return;
    const { workItemId, fromStateId, toStateId, transition } = pendingMove;
    setPendingMove(null);
    const item = workItems.find((w) => w.id === workItemId);
    const newRole = transition.assignToRole as AppRole | undefined;
    const roleChanges = item && newRole && newRole !== item.assignedToRole;
    if (item && (transition.requireUserAssignment || roleChanges)) {
      setPendingAssignment({
        workItemId, fromStateId, toStateId,
        newRole: newRole ?? item.assignedToRole,
        evidence,
      });
    } else {
      executeMove(workItemId, toStateId, fromStateId, evidence);
    }
  }, [pendingMove, workItems, executeMove]);

  // ── Item updated from drawer ───────────────────────────
  const handleItemUpdated = useCallback((updated: WorkItem) => {
    setWorkItems((prev) =>
      prev.map((wi) => (wi.id === updated.id ? updated : wi)),
    );
    setDrawerItem(updated);
  }, []);

  // ── Move from drawer ───────────────────────────────────
  const handleMoveFromDrawer = useCallback((item: WorkItem, toStateId: string) => {
    handleMoveAttempt(item, toStateId);
  }, [handleMoveAttempt]);

  // ── adminBypass move: también chequear rol ─────────────
  // (dentro del bloque adminBypass de handleMoveAttempt)
  // Note: el bloque adminBypass llama executeMove directamente,
  // sin AssignUserModal, ya que Admin puede moverse sin restricción.

  // ── userMap: userId → displayName ─────────────────────
  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u) => { map[u.id] = u.displayName; });
    return map;
  }, [users]);
  // ── teamMap: teamId → name ───────────────────────────────────
  const teamMap = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((t) => { map[t.id] = t.name; });
    return map;
  }, [teams]);
  // ── areaTeams para el filtro (type="Area") ──────────────────────
  const areaTeams = useMemo(() => teams.filter((t) => t.type === "Area"), [teams]);
  // ── Column name helper ─────────────────────────────────
  const stateNameById = useCallback((id: string) =>
    states.find((s) => s.id === id)?.name ?? id,
  [states]);

  // ── Render ─────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", height: "100%",
        background: "#FAF9F8", fontFamily: "'Segoe UI', sans-serif", overflow: "hidden",
      }}
      // Cleanup drag state si el usuario suelta fuera de un drop-zone
      onDragEnd={handleDragEnd}
    >
      {/* Header: contexto global de solo lectura (sin selector local de proyecto) */}
      <KanbanHeader
        selectedProjectId={selectedProjectId}
        projectName={projectName}
        selectedYear={selectedYear}
        areaName={areaName}
        onRefresh={load}
        loading={loading}
      />

      {/* Filters */}
      <KanbanFilters
        filters={filters}
        onChange={setFilters}
        currentUserRoles={userRoles}
        areaTeams={areaTeams}
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
              // Limpiar TODOS los flags de deep-link + URL params de forma reactiva
              setFilters((prev) => ({
                ...prev,
                onlyBlocked: false,
                onlyDueSoon: false,
                onlyAssignedToMe: false,
                onlyWaitingThirdParties: false,
              }));
              // setSearchParams({}) actualiza useSearchParams → deepLinkBadge → null → banda desaparece
              setSearchParams({});
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

      {/* KPI bar */}
      <KPIBar
        items={workItems}
        activeFilter={kpiFilter}
        onFilter={setKpiFilter}
      />

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 16px 24px" }}>
        {error && (
          <div style={{ margin: "24px auto", maxWidth: 480 }}>
            <UIErrorState message={error} onRetry={load} />
          </div>
        )}

        {loading && !error && (
          <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
            <InlineSpinner label="Cargando tablero…" size={18} />
          </div>
        )}

        {!loading && !error && (
          <KanbanBoard
            items={filteredItems}
            syncingIds={syncingIds}
            draggableIds={draggableIds}
            wipLimits={settings.wipLimits}
            allowedTargetStateIds={allowedTargetStateIds}
            swimlanes={filters.swimlanes}
            userMap={userMap}
            teamMap={teamMap}
            projectInfoMap={projectInfoMap}
            showProjectLine={selectedProjectId === "all"}
            highlightedWiId={highlightedWiId}
            lockReasonMap={lockReasonMap}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onOpenDrawer={setDrawerItem}
          />
        )}
      </div>

      {/* Drawer */}
      {drawerItem && (
        <WorkItemDrawer
          item={drawerItem}
          states={states}
          transitions={transitions}
          currentUserRoles={userRoles}
          appUser={appUser}
          adminBypass={adminBypass}
          onClose={() => setDrawerItem(null)}
          onMoveFromDrawer={handleMoveFromDrawer}
          onItemUpdated={handleItemUpdated}
        />
      )}

      {/* Evidence modal */}
      {pendingMove && (
        <EvidenceModal
          fromStateName={stateNameById(pendingMove.fromStateId)}
          toStateName={stateNameById(pendingMove.toStateId)}
          evidenceTypes={
            (pendingMove.transition.evidenceTypes ?? ["comment"]) as import("../../types/domain").EvidenceType[]
          }
          onConfirm={handleEvidenceConfirm}
          onCancel={() => setPendingMove(null)}
        />
      )}

      {/* Assignment modal — obligatorio cuando la transición cambia de rol */}
      {pendingAssignment && (
        <AssignUserModal
          newRole={pendingAssignment.newRole}
          project={projects.find(
            (p) => p.id === workItems.find((w) => w.id === pendingAssignment.workItemId)?.projectId,
          )}
          users={users}
          toStateName={stateNameById(pendingAssignment.toStateId)}
          fromStateName={stateNameById(pendingAssignment.fromStateId)}
          onConfirm={(assignedToUserId) => {
            const { workItemId, fromStateId, toStateId, evidence } = pendingAssignment;
            setPendingAssignment(null);
            executeMove(workItemId, toStateId, fromStateId, evidence, assignedToUserId);
          }}
          onCancel={() => setPendingAssignment(null)}
        />
      )}

      {/* Toasts */}
      <div style={{
        position: "fixed", bottom: 20, right: 20,
        display: "flex", flexDirection: "column", gap: 8, zIndex: 3000,
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "10px 16px", borderRadius: 8,
              background: t.ok ? "#DFF6DD" : "#FDE7E9",
              border: `1px solid ${t.ok ? "#92C353" : "#F4B8BB"}`,
              color: t.ok ? "#107C10" : "#A4262C",
              fontSize: 12, fontWeight: 600,
              fontFamily: "'Segoe UI', sans-serif",
              boxShadow: "0 4px 12px rgba(0,0,0,0.14)",
              animation: "fadeUp 200ms ease-out",
              maxWidth: 340,
            }}
          >
            {t.msg}
          </div>
        ))}
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    </div>
  );
};

// ── Exported wrapper con ErrorBoundary ────────────────────
// Evita pantalla en blanco ante cualquier error de render no capturado.
export const KanbanPageWithBoundary: React.FC = () => (
  <KanbanErrorBoundary>
    <KanbanPage />
  </KanbanErrorBoundary>
);

