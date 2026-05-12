// ─────────────────────────────────────────────────────────
//  src/screens/reports/ReportsPage.tsx
//  Pantalla "Informes / KPIs" — dos tabs:
//    "Mi panel"   → KPIs + listas personales
//    "Gobierno"   → KPIs globales (Admin + IT AirEuropa)
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BarChart2, RefreshCw, Download, UserCheck } from "lucide-react";

// — Design System —
import {
  PageHeader, Button, ErrorState as UIErrorState,
  color, font, spacing,
} from "../../components/ui";

// — Auth —
import { useEffectiveUser } from "../../auth/ImpersonationContext";
import { useAppFilter }    from "../../context/AppFilterContext";
import { useProjectScope } from "../../hooks/useProjectScope";

// — Servicios —
import {
  getReportKPIs, exportReportCSV,
  type ReportFilters, type ReportPayload,
} from "../../services/reportService";
import { getProjects, getBusinessAreas, getProviders } from "../../services/projectService";
import { getWorkItems, getStates } from "../../services/workItemService";

// — Tipos —
import type { Project, BusinessArea, Provider, AppRole, WorkItem, State } from "../../types/domain";

// — Componentes locales —
import { ReportsFilters, EMPTY_REPORT_FILTERS } from "./components/ReportsFilters";
import { MyPanelTab }    from "./components/MyPanelTab";
import { GovernanceTab } from "./components/GovernanceTab";

// ── Roles con acceso a la tab Gobierno ───────────────────
const GOVERNANCE_ROLES: AppRole[] = ["Admin", "IT AirEuropa"];
const EXPORT_ROLES:     AppRole[] = ["Admin", "IT AirEuropa"];

// ── Tab tipos ─────────────────────────────────────────────
type TabId = "mipanel" | "gobierno";

// ── Estado vacío de payload ───────────────────────────────
const EMPTY_PAYLOAD: ReportPayload = {
  kpis:        { totalProjects: 0, totalTasks: 0, closedInPeriod: 0, blocked: 0, dueSoon: 0, syncErrors: 0 },
  byProvider:  [],
  byArea:      [],
  weeklyTrend: [],
  topRisks:    [],
};

// ── Tab bar ───────────────────────────────────────────────
interface TabBarProps {
  active:         TabId;
  showGovernance: boolean;
  onChange:       (id: TabId) => void;
}

const TabBar: React.FC<TabBarProps> = ({ active, showGovernance, onChange }) => {
  const tabStyle = (id: TabId): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: spacing[2],
    padding: `${spacing[3]}px ${spacing[5]}px`,
    border: "none",
    borderBottom: `2px solid ${active === id ? color.primary : "transparent"}`,
    background: "none",
    color: active === id ? color.primary : color.textSecondary,
    fontWeight: active === id ? font.weight.semibold : font.weight.normal,
    fontSize: font.size.sm,
    cursor: "pointer",
    fontFamily: font.family,
    transition: "color 120ms, border-color 120ms",
    whiteSpace: "nowrap" as const,
  });

  return (
    <div style={{
      display: "flex",
      borderBottom: `1px solid ${color.border}`,
      marginBottom: spacing[6],
    }}>
      <button style={tabStyle("mipanel")} onClick={() => onChange("mipanel")}>
        <UserCheck size={13} />
        Mi panel
      </button>
      {showGovernance && (
        <button style={tabStyle("gobierno")} onClick={() => onChange("gobierno")}>
          <BarChart2 size={13} />
          Gobierno
        </button>
      )}
    </div>
  );
};

// ── ReportsPage ───────────────────────────────────────────
export const ReportsPage: React.FC = () => {
  const { roles, user: currentUser } = useEffectiveUser();

  // ── Contexto Global (año + área + proyecto) ──────────────────
  const {
    selectedYear,
    selectedAreaId,
    selectedProjectId: ctxProjectId,
  } = useAppFilter();
  const { projectIdsScope, hasScope } = useProjectScope();

  const canGovernance = roles.some((r) => GOVERNANCE_ROLES.includes(r as AppRole));
  const canExport     = roles.some((r) => EXPORT_ROLES.includes(r as AppRole));

  // ── Tab activa ────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("mipanel");

  // ── Estado UI ─────────────────────────────────────────
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Filtros ───────────────────────────────────────────
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);

  // ── Datos ─────────────────────────────────────────────
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [areas,      setAreas]      = useState<BusinessArea[]>([]);
  const [providers,  setProviders]  = useState<Provider[]>([]);
  const [workItems,  setWorkItems]  = useState<WorkItem[]>([]);
  const [states,     setStates]     = useState<State[]>([]);
  const [payload,    setPayload]    = useState<ReportPayload>(EMPTY_PAYLOAD);

  const abortRef = useRef<AbortController | null>(null);

  // ── Construir filtros API ─────────────────────────────
  // projectId y areaId vienen SIEMPRE del Contexto Global, no de filtros locales.
  const buildApiFilters = useCallback((f: ReportFilters): ReportFilters => ({
    projectId:         ctxProjectId   || undefined,
    areaId:            selectedAreaId || undefined,
    providerId:        f.providerId        || undefined,
    deliveryOwnerType: f.deliveryOwnerType || undefined,
    periodDays:        f.periodDays        ?? 30,
    onlyBlocked:       f.onlyBlocked       || undefined,
    onlyDueSoon:       f.onlyDueSoon       || undefined,
  }), [ctxProjectId, selectedAreaId]);

  // ── Carga ─────────────────────────────────────────────
  const loadAll = useCallback(async (showRefresh = false) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (showRefresh) setRefreshing(true);
    else             setLoading(true);
    setError(null);

    try {
      const [data, projs, areasData, provData, wis, sts] = await Promise.all([
        getReportKPIs(buildApiFilters(filters)),
        getProjects(),
        getBusinessAreas(),
        getProviders(),
        getWorkItems(),
        getStates(),
      ]);
      setPayload(data);
      setProjects(projs);
      setAreas(areasData);
      setProviders(provData);
      // Guardar TODOS los workItems; el scope se aplica en useMemo (ver más abajo)
      setWorkItems(wis);
      setStates(sts);
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== "AbortError") {
        setError("No se pudieron cargar los datos del informe. Inténtalo de nuevo.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, buildApiFilters]);

  // Carga inicial
  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // WorkItems filtrados por scope (useMemo reacciona correctamente al cambio de año)
  const scopedWorkItems = React.useMemo(
    () => workItems.filter((wi) => projectIdsScope.has(wi.projectId)),
    [workItems, projectIdsScope],
  );

  // Re-carga cuando cambian filtros locales O el Contexto Global
  const prevKey = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(buildApiFilters(filters));
    if (key !== prevKey.current) {
      prevKey.current = key;
      loadAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.providerId, filters.deliveryOwnerType,
    filters.periodDays, filters.onlyBlocked, filters.onlyDueSoon,
    ctxProjectId, selectedAreaId, selectedYear,
  ]);

  const handleExport = () =>
    exportReportCSV(payload.kpis, payload.byProvider, payload.byArea);

  const isLoading = loading || refreshing;

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{
      padding: `${spacing[6]}px ${spacing[7]}px`,
      fontFamily: font.family,
      background: "#FAF9F8",
      minHeight: "100vh",
      maxWidth: 1200,
      margin: "0 auto",
      boxSizing: "border-box" as const,
    }}>
      {/* Header */}
      <PageHeader
        icon={<BarChart2 size={20} />}
        title="Informes / KPIs"
        subtitle={
          activeTab === "mipanel"
            ? "Vista personal de tus tareas activas"
            : "Métricas globales del programa"
        }
        bordered
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw size={13} />}
              loading={refreshing}
              onClick={() => loadAll(true)}
            >
              Refrescar
            </Button>
            {canExport && activeTab === "gobierno" && (
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

      {/* Filtros locales (ejecutor, proveedor, periodo, toggles) */}
      <ReportsFilters
        filters={filters}
        onChange={setFilters}
        providers={providers}
      />

      {/* Error */}
      {!isLoading && error && (
        <UIErrorState message={error} onRetry={() => loadAll()} />
      )}

      {/* Empty state anual */}
      {!isLoading && !error && !hasScope && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "60px 24px", gap: 10, color: "#8A8886",
          fontFamily: font.family, textAlign: "center",
        }}>
          <span style={{ fontSize: 36 }}>📅</span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#605E5C" }}>
            Sin proyectos en {selectedYear}
          </p>
          <p style={{ margin: 0, fontSize: 12 }}>
            No hay proyectos con inicio en {selectedYear}.
            Cambia el año en el <strong>Ámbito</strong>.
          </p>
        </div>
      )}

      {/* Tabs + contenido */}
      {!error && hasScope && (
        <>
          <TabBar
            active={activeTab}
            showGovernance={canGovernance}
            onChange={(tab) => {
              if (tab === "gobierno" && !canGovernance) return;
              setActiveTab(tab);
            }}
          />

          {/* Tab: Mi panel */}
          {activeTab === "mipanel" && (
            <MyPanelTab
              workItems={scopedWorkItems}
              projects={projects}
              states={states}
              effectiveUserId={currentUser?.id ?? ""}
              loading={isLoading}
            />
          )}

          {/* Tab: Gobierno */}
          {activeTab === "gobierno" && canGovernance && (
            <GovernanceTab
              payload={payload}
              filters={filters}
              loading={isLoading}
            />
          )}

          {activeTab === "gobierno" && !canGovernance && (
            <div style={{
              textAlign: "center", padding: `${spacing[8]}px`,
              color: color.textMuted, fontSize: font.size.sm,
            }}>
              <p style={{ fontWeight: font.weight.semibold, color: color.text, marginBottom: spacing[2] }}>
                Acceso restringido
              </p>
              La pestaña "Gobierno" requiere rol Admin o IT AirEuropa.
            </div>
          )}
        </>
      )}
    </div>
  );
};
