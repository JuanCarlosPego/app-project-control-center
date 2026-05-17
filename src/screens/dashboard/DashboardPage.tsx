// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/DashboardPage.tsx
//  Pantalla /dashboard — Command Center guiado por rol
//
//  Layout:
//    1. Header (greeting + año + refresh + export)
//    2. Fila superior: RoleActions (izq) + Bandejas KPI (der)
//    3. Acciones urgentes (UrgentActions)
//    4. KPI Bar de épicas (DashboardKPIBar)
//    5. Alertas del programa (AlertsPanel)
//    6. Accesos rápidos (QuickAccess) + MyBandejasPanel
//
//  RBAC: siempre desde useEffectiveUser() — NUNCA useAuth()
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Download, LayoutDashboard, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useEffectiveUser } from "../../auth/ImpersonationContext";
import { usePermission }   from "../../auth/usePermission";
import { getProjects, getBusinessAreas, getProviders } from "../../services/projectService";
import { getWorkItems, getRisks, getStates } from "../../services/workItemService";
import { getRequests } from "../../services/requestService";
import { listAppUsers } from "../../services/userService";
import { apiClient, ApiError } from "../../services/apiClient";
import { getRolePermissions } from "../../services/adminService";
import type {
  Project, WorkItem, Risk, BusinessArea, Provider, State,
  User, AppUser, AppRole, Request, RolePermissionsMap, PriorityWeights,
} from "../../types/domain";
import { getMyAssignments, getWaitingOnOthers } from "./workSelectors";
import { useAppFilter } from "../../context/AppFilterContext";

import { DashboardKPIBar } from "./components/DashboardKPIBar";
import { RoleActions } from "./components/RoleActions";
import { UrgentActions } from "./components/UrgentActions";
import { QuickAccess } from "./components/QuickAccess";
import { WorkflowTrack } from "./components/WorkflowTrack";
import { DailyRecommendations } from "./components/DailyRecommendations";
import { HomeSmartView } from "./components/HomeSmartView";
import {
  scoreWorkItems, generateInsights, mergeWeights,
  type ScoredItem, type Insight,
} from "../../lib/priorityEngine";

// ── CSV export (solo Admin/IT) ────────────────────────────
function exportCSV(projects: Project[], areas: BusinessArea[], providers: Provider[]) {
  const areaMap     = Object.fromEntries(areas.map((a) => [a.id, a.name]));
  const providerMap = Object.fromEntries(providers.map((p) => [p.id, p.name]));
  const header = ["Código", "Nombre", "Área", "Ejecutor", "Proveedor", "Estado", "Prioridad", "Avance %", "Inicio", "Fin"];
  const rows = projects.map((p) => [
    p.code, `"${p.name}"`,
    areaMap[p.businessAreaId] ?? p.businessAreaId,
    p.deliveryOwnerType,
    p.providerId ? (providerMap[p.providerId] ?? p.providerId) : "",
    p.status, p.priority, p.progress, p.startDate, p.endDate,
  ]);
  const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `dashboard-proyectos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ── DashboardPage ─────────────────────────────────────────
export const DashboardPage: React.FC = () => {
  const { user: currentUser, roles: effectiveRoles } = useEffectiveUser();
  const navigate = useNavigate();

  // Roles efectivos (simulated or real), sin Invitado
  const userRoles = useMemo(
    () => effectiveRoles.filter((r): r is AppRole => r !== "Invitado"),
    [effectiveRoles],
  );
  const canAdmin    = userRoles.includes("Admin") || userRoles.includes("IT AirEuropa");
  const isProveedor = userRoles.includes("Proveedor") && !canAdmin;
  // Botón "Nueva solicitud" en Inicio controlado por permiso RBAC REQUEST_CREATE
  const { allowed: canCreateRequest } = usePermission("REQUEST_CREATE");

  // ── Datos brutos ──────────────────────────────────────
  const [allProjects,      setAllProjects]      = useState<Project[]>([]);
  const [allWorkItems,     setAllWorkItems]     = useState<WorkItem[]>([]);
  const [risks,            setRisks]            = useState<Risk[]>([]);
  const [areas,            setAreas]            = useState<BusinessArea[]>([]);
  const [providers,        setProviders]        = useState<Provider[]>([]);
  const [states,           setStates]           = useState<State[]>([]);
  const [currentUserId,    setCurrentUserId]    = useState<string>("");
  const [appUsers,         setAppUsers]         = useState<AppUser[]>([]);
  const [requests,         setRequests]         = useState<Request[]>([]);
  const [rolePermissions,  setRolePermissions]  = useState<RolePermissionsMap>({});
  const [priorityWeights,  setPriorityWeights]  = useState<PriorityWeights | undefined>(undefined);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);

  // ── Contexto global de ámbito ─────────────────────────
  const { selectedYear, selectedAreaId } = useAppFilter();

  // ── Carga de datos ────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projects, wis, rks, areasData, providersData, statesData, meData, usersData, reqs, rbacData] = await Promise.all([
        getProjects({ year: String(selectedYear) }),
        getWorkItems(),
        getRisks(),
        getBusinessAreas(),
        getProviders(),
        getStates(),
        apiClient.get<User>("/me"),
        listAppUsers({}).catch(() => [] as AppUser[]),
        getRequests({}).catch(() => [] as Request[]),
        getRolePermissions().catch(() => ({ permissions: [], rolePermissions: {} })),
      ]);
      setAllProjects(projects);
      setAllWorkItems(wis);
      setRisks(rks);
      setAreas(areasData);
      setProviders(providersData);
      setStates(statesData);
      setCurrentUserId(meData.id);
      setAppUsers(usersData);
      setRequests(reqs);
      setRolePermissions(rbacData.rolePermissions);
      // Cargar pesos desde settings si están disponibles
      const settingsResp = await apiClient.get<{ settings: { priorityWeights?: PriorityWeights } }>("/admin/settings").catch(() => null);
      setPriorityWeights(settingsResp?.settings?.priorityWeights);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Usuario efectivo (simulado o real) ────────────────
  const effectiveUserId = currentUser.id || currentUserId;

  // ── RBAC: ¿puede usar Home Inteligente? ──────────────
  const canSmartHome = useMemo(() => {
    const roleKey = currentUser.role as string;
    return rolePermissions[roleKey]?.["VIEW_HOME_SMART"] === true;
  }, [currentUser.role, rolePermissions]);

  // ── Modo de home (localStorage por usuario) ───────────
  const [homeMode, setHomeMode] = useState<"basic" | "smart">("basic");

  // Sincronizar homeMode cuando cambia usuario o canSmartHome
  useEffect(() => {
    if (!canSmartHome) {
      setHomeMode("basic");
      return;
    }
    const stored = localStorage.getItem(`homeMode:${effectiveUserId}`);
    setHomeMode(stored === "smart" ? "smart" : "basic");
  }, [canSmartHome, effectiveUserId]);

  const toggleHomeMode = useCallback(() => {
    setHomeMode((prev) => {
      const next = prev === "basic" ? "smart" : "basic";
      localStorage.setItem(`homeMode:${effectiveUserId}`, next);
      return next;
    });
  }, [effectiveUserId]);

  // ── Mapa userId → displayName para el panel de bandejas ─
  const userDisplayMap = useMemo(() => {
    const m: Record<string, string> = {};
    appUsers.forEach((u) => { m[u.id] = u.displayName; });
    return m;
  }, [appUsers]);

  // ── Filtrado client-side de proyectos ─────────────────
  const filteredProjects = useMemo(() => {
    let list = allProjects;
    if (selectedAreaId) list = list.filter((p) => p.businessAreaId === selectedAreaId);
    return list;
  }, [allProjects, selectedAreaId]);

  // ── WorkItems filtrados (por proyectos visibles) ──────
  const filteredWorkItems = useMemo(() => {
    const projectIds = new Set(filteredProjects.map((p) => p.id));
    return allWorkItems.filter((wi) => projectIds.has(wi.projectId));
  }, [allWorkItems, filteredProjects]);

  // ── Riesgos filtrados ─────────────────────────────────
  const filteredRisks = useMemo(() => {
    const projectIds = new Set(filteredProjects.map((p) => p.id));
    return risks.filter((r) => projectIds.has(r.projectId));
  }, [risks, filteredProjects]);

  // ── Greeting ──────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 13 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";

  // ── Navegación con query params ───────────────────────
  const goTo = useCallback((href: string) => {
    const [path, qs] = href.split("?");
    navigate(qs ? `${path}?${qs}` : path);
  }, [navigate]);

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{ padding: "20px 24px", minHeight: "100%", background: "#FAF9F8", boxSizing: "border-box" }}>

      {/* ───────────── 1. HEADER ───────────── */}
      <div style={{
        background: "#fff", borderRadius: 10, border: "1px solid #EDEBE9",
        padding: "16px 20px 14px", marginBottom: 14,
        display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <LayoutDashboard size={18} color="#0078D4" />
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1B2A3E" }}>Inicio</h1>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#8A8886" }}>
            {greeting}, <strong style={{ color: "#323130" }}>{currentUser.displayName || "usuario"}</strong>
            {" — "} Planificación {selectedYear} · Command Center
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {canSmartHome && (
            <button
              onClick={toggleHomeMode}
              title={homeMode === "smart" ? "Volver a vista básica" : "Activar Home Inteligente"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 12px",
                borderRadius: 20,
                border: `1.5px solid ${homeMode === "smart" ? "#7530AF" : "#EDEBE9"}`,
                background: homeMode === "smart" ? "#F4EFFE" : "#FFFFFF",
                color: homeMode === "smart" ? "#7530AF" : "#605E5C",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Segoe UI', sans-serif",
                transition: "all 0.2s",
              }}
            >
              <Zap size={12} />
              {homeMode === "smart" ? "Vista inteligente" : "Básico"}
            </button>
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
              label="Exportar CSV"
              onClick={() => exportCSV(filteredProjects, areas, providers)}
              disabled={filteredProjects.length === 0}
              primary
            />
          )}
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>

      {/* ───────────── ESTADOS CARGA / ERROR ───────────── */}
      {loading && <LoadingState />}

      {!loading && error && (
        <div style={{
          textAlign: "center", padding: "48px 20px",
          background: "#FDF3F0", borderRadius: 8, border: "1px solid #FDCFBC",
        }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
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

      {/* ───────────── CONTENIDO PRINCIPAL ───────────── */}
      {!loading && !error && (
        <>
          {/* ═══════════════════════════════════════════════════
               HOME INTELIGENTE (Nivel 2) — sólo si canSmartHome + homeMode=smart
          ═══════════════════════════════════════════════════ */}
          {homeMode === "smart" && canSmartHome ? (
            <HomeSmartView
              workItems={allWorkItems}
              projects={allProjects}
              states={states}
              effectiveUserId={effectiveUserId}
              weights={priorityWeights}
              onNavigate={goTo}
            />
          ) : (
            <>
          {/* ── BLOQUE 1 — ¿Qué deseas hacer? ─────────────── */}
          <RoleActions
            roles={userRoles}
            workItems={allWorkItems}
            requests={requests}
            effectiveUserId={effectiveUserId}
            canCreateRequest={canCreateRequest}
            onNavigate={goTo}
          />

          {/* ── BLOQUE 2 — Hoy te recomendamos ──────────────── */}
          <DailyRecommendations
            workItems={allWorkItems}
            requests={requests}
            roles={userRoles}
            effectiveUserId={effectiveUserId}
            onNavigate={goTo}
          />

          {/* ── BLOQUE 3 — Acciones urgentes ─────────────────── */}
          <div style={{ marginBottom: 14 }}>
            <UrgentActions
              workItems={allWorkItems}
              requests={requests}
              currentUserId={effectiveUserId}
              roles={userRoles}
              states={states}
              onNavigate={goTo}
            />
          </div>

          {/* ── BLOQUE 4 — Flujo del sistema ─────────────────── */}
          <WorkflowTrack
            workItems={allWorkItems}
            requests={requests}
            effectiveUserId={effectiveUserId}
            roles={userRoles}
            onNavigate={goTo}
          />

          {/* ── BLOQUE 5 + 6 — Prioridades + Insights (motor IA) ─ */}
          <BasicSmartPanels
            workItems={allWorkItems}
            projects={allProjects}
            states={states}
            effectiveUserId={effectiveUserId}
            weights={priorityWeights}
            onNavigate={goTo}
          />

          {/* ── BLOQUE 7 — KPIs de épicas ─────────────────────── */}
          <div style={{ marginBottom: 14, opacity: 0.88 }}>
            <SectionLabel>Estado de épicas · {selectedYear}</SectionLabel>
            <DashboardKPIBar projects={filteredProjects} />
          </div>

          {/* ── BLOQUE 8 — Accesos rápidos ───────────────────── */}
          <QuickAccess roles={userRoles} onNavigate={goTo} />
            </>
          )}
        </>
      )}
    </div>
  );
};

// ── Paneles de prioridades + insights (modo básico) ──────
function BasicSmartPanels({
  workItems,
  projects,
  states,
  effectiveUserId,
  weights,
  onNavigate,
}: {
  workItems: WorkItem[];
  projects: Project[];
  states: State[];
  effectiveUserId: string;
  weights?: import("../../types/domain").PriorityWeights;
  onNavigate: (href: string) => void;
}) {
  const resolvedWeights = React.useMemo(
    () => mergeWeights(weights),
    [weights],
  );
  const scored: ScoredItem[] = React.useMemo(
    () => scoreWorkItems(workItems, projects, effectiveUserId, resolvedWeights),
    [workItems, projects, effectiveUserId, resolvedWeights],
  );
  const top5 = scored.slice(0, 5);
  const insights: Insight[] = React.useMemo(
    () => generateInsights(workItems, effectiveUserId),
    [workItems, effectiveUserId],
  );
  const stateMap = React.useMemo(
    () => Object.fromEntries(states.map((s) => [s.id, s.name])),
    [states],
  );
  const maxScore = scored[0]?.score ?? 1;

  const STATE_COLOR: Record<string, string> = {
    "st-new": "#605E5C", "st-ref": "#0078D4", "st-prog": "#C17D00",
    "st-blk": "#D13438", "st-rft": "#8764B8", "st-test": "#038387",
    "st-acc": "#2B88D8", "st-cls": "#107C10",
  };

  function safeDate(dateStr: string | undefined): string {
    if (!dateStr) return "Sin fecha";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "Sin fecha" : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }

  function buildHref(item: ScoredItem): string {
    const wi = item.workItem;
    if (wi.stateId === "st-new" || wi.stateId === "st-ref") return `/backlog?phase=backlog&wi=${wi.id}`;
    const params = new URLSearchParams({ wi: wi.id });
    if (wi.stateId === "st-blk") params.set("blocked", "true");
    else if (new Date(wi.endDate).getTime() < Date.now()) params.set("overdue", "true");
    else if (wi.assignedToUserId === effectiveUserId) params.set("assignedToMe", "true");
    else if (wi.stateId) params.set("state", wi.stateId);
    return `/kanban?${params}`;
  }

  const urgencyStyle: Record<string, { bg: string; border: string; dot: string }> = {
    high:   { bg: "#FFF4F4", border: "#FDE7E9", dot: "#D13438" },
    medium: { bg: "#FFFBF0", border: "#FFF4CE", dot: "#C17D00" },
    low:    { bg: "#F0F6FF", border: "#DEECF9", dot: "#0078D4" },
  };

  if (top5.length === 0 && insights.length === 0) return null;

  return (
    <>
      {top5.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <SectionLabel>📋 Prioridades de hoy</SectionLabel>
            <button
              onClick={() => onNavigate("/kanban?assignedToMe=true")}
              style={{ fontSize: 11, color: "#0078D4", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >Ver todas →</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {top5.map((item, i) => {
              const wi = item.workItem;
              const pct = Math.min(100, maxScore > 0 ? Math.round((item.score / maxScore) * 100) : 0);
              const barColor = pct >= 70 ? "#D13438" : pct >= 40 ? "#C17D00" : "#0078D4";
              const stateColor = STATE_COLOR[wi.stateId] ?? "#605E5C";
              return (
                <div
                  key={wi.id}
                  onClick={() => onNavigate(buildHref(item))}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                    borderRadius: 8, cursor: "pointer", background: "#FAFAFA", border: "1px solid #EDEBE9",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F0F6FF"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
                >
                  <span style={{ fontSize: 11, color: "#605E5C", minWidth: 18, textAlign: "right" }}>#{i + 1}</span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: stateColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "#201F1E", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {wi.title}
                  </span>
                  <span style={{ fontSize: 10, color: "#605E5C", flexShrink: 0 }}>{safeDate(wi.endDate)}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 80 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#EDEBE9", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#605E5C", minWidth: 24, textAlign: "right" }}>{item.score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {insights.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <SectionLabel>💡 Insights del sistema</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {insights.map((ins) => {
              const s = urgencyStyle[ins.urgency];
              return (
                <div
                  key={ins.id}
                  style={{
                    flex: "1 1 220px", background: s.bg, border: `1px solid ${s.border}`,
                    borderLeft: `3px solid ${s.dot}`, borderRadius: 8, padding: "12px 14px",
                    cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{ins.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#201F1E" }}>{ins.title}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#605E5C", lineHeight: 1.4 }}>{ins.body}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button
                      onClick={() => onNavigate(ins.href)}
                      style={{ fontSize: 11, fontWeight: 600, color: s.dot, background: "none", border: `1px solid ${s.dot}`, borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}
                    >Ver</button>
                    <button
                      onClick={() => onNavigate(ins.href)}
                      style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: s.dot, border: "none", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}
                    >Actuar</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// ── Micro-componentes ─────────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{
    margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#8A8886",
    textTransform: "uppercase", letterSpacing: "0.07em",
  }}>{children}</p>
);

const PersonalKPICard: React.FC<{
  icon: React.ReactNode; label: string; count: number;
  bg: string; borderColor: string; textColor: string;
  cta: string; onClick: () => void;
}> = ({ icon, label, count, bg, borderColor, textColor, cta, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flex: "1 1 160px", minWidth: 140,
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12,
      padding: "12px 16px", borderRadius: 8,
      border: `1px solid ${borderColor}`, background: bg,
      cursor: "pointer", textAlign: "left",
      fontFamily: "'Segoe UI', sans-serif",
      transition: "filter 120ms",
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.94)"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)"; }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      {icon}
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color: textColor, lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: textColor, opacity: 0.8, marginTop: 2 }}>{label}</div>
      </div>
    </div>
    <span style={{
      marginTop: 8, fontSize: 10, fontWeight: 700, color: textColor,
      borderTop: `1px solid ${borderColor}50`, width: "100%",
      paddingTop: 6, display: "flex", alignItems: "center", gap: 3,
    }}>
      {cta} →
    </span>
  </button>
);

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

const LoadingState: React.FC = () => (
  <div>
    {/* KPI skeleton */}
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          flex: "1 1 140px", minWidth: 120, height: 78, borderRadius: 8,
          background: "#EDEBE9", animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.08}s`,
        }} />
      ))}
    </div>
    {/* Grid skeleton */}
    <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr", gap: 14 }}>
      <div style={{ height: 320, borderRadius: 10, background: "#EDEBE9", animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ height: 320, borderRadius: 10, background: "#EDEBE9", animation: "pulse 1.5s ease-in-out infinite", animationDelay: "0.15s" }} />
    </div>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
  </div>
);
