// ─────────────────────────────────────────────────────────
//  src/screens/risks/RisksPage.tsx
//  Pantalla "Riesgos y Bloqueos"
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, UserCheck, Hourglass } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button } from "../../components/ui/Button";
import { color, font, radius, shadow, spacing } from "../../components/ui/tokens";
import type {
  Risk, Project, WorkItem, State, Transition, ActivityLogEntry,
} from "../../types/domain";
import { useEffectiveUser } from "../../auth/ImpersonationContext";
import { useAppFilter }    from "../../context/AppFilterContext";
import { useProjectScope } from "../../hooks/useProjectScope";
import { getProjects }           from "../../services/projectService";
import { getWorkItems, getStates, getTransitions } from "../../services/workItemService";
import { getActivity }           from "../../services/workItemService";
import {
  getRisks, createRisk, updateRisk, exportRisksCSV,
} from "../../services/riskService";
import type { RiskFilters, CreateRiskPayload, PatchRiskPayload } from "../../services/riskService";
import { RisksFilters, EMPTY_RISK_FILTERS }  from "./components/RisksFilters";
import { RisksTable }    from "./components/RisksTable";
import { RiskForm }      from "./components/RiskForm";
import type { RiskFormMode } from "./components/RiskForm";
import { RiskDrawer }    from "./components/RiskDrawer";
import {
  calcRiskKPIs, getMyRisks, getWaitingRisks,
  isAssignedToMe, isWaitingOnOthers,
} from "./riskSelectors";

// ── KPI Mini Card (clicable) ──────────────────────────────
const KpiCard: React.FC<{
  label:     string;
  value:     number;
  accent?:   string;
  icon?:     React.ReactNode;
  active?:   boolean;
  onClick?:  () => void;
}> = ({ label, value, accent = color.primary, icon, active = false, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: "1 1 130px",
      padding: `${spacing[4]}px ${spacing[5]}px`,
      background: active ? accent + "18" : color.surface,
      border: `1.5px solid ${active ? accent : color.border}`,
      borderRadius: radius.md,
      boxShadow: active ? `0 0 0 2px ${accent}22` : shadow.xs,
      textAlign: "center",
      cursor: onClick ? "pointer" : "default",
      transition: "all 120ms",
    }}
  >
    {icon && (
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        {icon}
      </div>
    )}
    <div style={{ fontSize: 26, fontWeight: font.weight.bold, color: accent, lineHeight: 1.1 }}>
      {value}
    </div>
    <div style={{ marginTop: 4, fontSize: font.size.xs, color: active ? accent : color.textMuted }}>
      {label}
    </div>
  </button>
);

// ── Página ────────────────────────────────────────────────
export const RisksPage: React.FC = () => {
  const { roles, user: currentUser } = useEffectiveUser();
  const canEdit   = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const effectiveUserId = currentUser?.id ?? "";

  // ── Contexto Global ────────────────────────────────────────
  const {
    selectedProjectId: ctxProjectId,
  } = useAppFilter();
  const { projectIdsScope: scopedProjectIds, hasScope, selectedYear } = useProjectScope();

  // ── Estado de datos ───────────────────────────────────
  const [risks,       setRisks]       = useState<Risk[]>([]);
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [workItems,   setWorkItems]   = useState<WorkItem[]>([]);
  const [states,      setStates]      = useState<State[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");

  // ── Filtros ───────────────────────────────────────────
  const [filters, setFilters] = useState<RiskFilters>(EMPTY_RISK_FILTERS);

  // ── UI ────────────────────────────────────────────────
  const [drawerRisk, setDrawerRisk] = useState<Risk | null>(null);
  const [formOpen,   setFormOpen]   = useState(false);
  const [formMode,   setFormMode]   = useState<RiskFormMode>("create");
  const [formRisk,   setFormRisk]   = useState<Risk | undefined>(undefined);

  // ── Carga inicial ─────────────────────────────────────
  useEffect(() => {
    Promise.all([
      getProjects(),
      getWorkItems(),
      getStates(),
      getTransitions(),
      getActivity(),
    ])
      .then(([p, w, s, t, al]) => {
        setProjects(p);
        setWorkItems(w);
        setStates(s);
        setTransitions(t);
        setActivityLog(al as ActivityLogEntry[]);
      })
      .catch(() => setError("Error al cargar datos de soporte"));
  }, []);

  // ── Carga de riesgos ──────────────────────────────────
  const loadRisks = useCallback(() => {
    setLoading(true);
    setError("");
    // Los filtros personales (onlyAssignedToMe, onlyWaitingOnOthers) son client-side
    const { onlyAssignedToMe, onlyWaitingOnOthers, ...serverFilters } = filters;
    // Proyecto: siempre del Contexto Global (no del filtro local)
    const apiFilters = {
      ...serverFilters,
      projectId: ctxProjectId || undefined,
    };
    getRisks(apiFilters)
      .then((r) => setRisks(r as Risk[]))
      .catch(() => setError("Error al cargar los riesgos"))
      .finally(() => setLoading(false));
  }, [filters, ctxProjectId]);

  useEffect(() => { loadRisks(); }, [loadRisks]);

  // ── KPIs (sobre toda la lista, sin filtro personal) ──
  const wiMap   = useMemo(() => new Map(workItems.map((w) => [w.id, w])), [workItems]);
  const projMap = useMemo(() => new Map(projects.map((p) => [p.id, p])),  [projects]);

  const kpis = useMemo(
    () => calcRiskKPIs(risks, workItems, projects, effectiveUserId),
    [risks, workItems, projects, effectiveUserId],
  );

  // ── Filtrado client-side personal + scope global ─────────────
  const displayedRisks = useMemo(() => {
    // 1. Scope año+área+proyecto: SIEMPRE aplica (sin guardia size>0)
    let list = risks.filter((r) => scopedProjectIds.has(r.projectId));

    // 2. Filtros personales client-side
    if (!filters.onlyAssignedToMe && !filters.onlyWaitingOnOthers) return list;

    return list.filter((r) => {
      const wi   = r.linkedWorkItemId ? wiMap.get(r.linkedWorkItemId) : undefined;
      const proj = projMap.get(r.projectId);
      const mine    = isAssignedToMe(r, wi, effectiveUserId);
      const waiting = isWaitingOnOthers(r, wi, proj, effectiveUserId);

      if (filters.onlyAssignedToMe && filters.onlyWaitingOnOthers) {
        return mine || waiting;   // unión
      }
      if (filters.onlyAssignedToMe)    return mine;
      if (filters.onlyWaitingOnOthers) return waiting;
      return true;
    });
  }, [risks, filters.onlyAssignedToMe, filters.onlyWaitingOnOthers, wiMap, projMap, effectiveUserId, scopedProjectIds]);

  // ── Mapa para CSV ─────────────────────────────────────
  const projectNameMap  = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const workItemNameMap = Object.fromEntries(workItems.map((w) => [w.id, w.title]));

  // ── Handlers ─────────────────────────────────────────
  function openCreate() {
    setFormRisk(undefined);
    setFormMode("create");
    setFormOpen(true);
  }

  function openEdit(risk: Risk) {
    setFormRisk(risk);
    setFormMode("edit");
    setFormOpen(true);
    setDrawerRisk(null);
  }

  function openClose(risk: Risk) {
    setDrawerRisk(risk);
  }

  async function handleSave(payload: CreateRiskPayload | PatchRiskPayload) {
    if (formMode === "create") {
      await createRisk(payload as CreateRiskPayload);
    } else if (formRisk) {
      await updateRisk(formRisk.id, payload as PatchRiskPayload);
    }
    loadRisks();
  }

  function handleRiskClosed(updated: Risk) {
    setRisks((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDrawerRisk(updated);
  }

  // ── Toggle helpers ────────────────────────────────────
  function toggleAssignedToMe() {
    setFilters((f) => ({ ...f, onlyAssignedToMe: !f.onlyAssignedToMe }));
  }
  function toggleWaitingOnOthers() {
    setFilters((f) => ({ ...f, onlyWaitingOnOthers: !f.onlyWaitingOnOthers }));
  }

  return (
    <div style={{ padding: `${spacing[6]}px`, maxWidth: 1200, margin: "0 auto" }}>
      {/* PageHeader */}
      <PageHeader
        title="Riesgos y Bloqueos"
        subtitle="Seguimiento de impedimentos y riesgos del programa"
        actions={
          <div style={{ display: "flex", gap: spacing[3] }}>
            {canEdit && (
              <Button variant="primary" icon={<Plus size={14} />} onClick={openCreate}>
                Nuevo riesgo
              </Button>
            )}
            <Button variant="ghost" icon={<RefreshCw size={14} />} onClick={loadRisks}>
              Refrescar
            </Button>
            {canEdit && (
              <Button
                variant="ghost"
                onClick={() => exportRisksCSV(risks, projectNameMap, workItemNameMap)}
              >
                Exportar CSV
              </Button>
            )}
          </div>
        }
      />

      {/* Error banner */}
      {error && (
        <div style={{
          marginBottom: spacing[5], padding: `${spacing[3]}px ${spacing[4]}px`,
          background: color.dangerBg, border: `1px solid ${color.dangerBorder}`,
          borderRadius: radius.sm, color: color.danger, fontSize: font.size.sm,
        }}>
          {error}
        </div>
      )}

      {/* Empty state anual */}
      {!loading && !error && !hasScope && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "60px 24px", gap: 10, color: "#8A8886",
          fontFamily: font.family, textAlign: "center",
        }}>
          <span style={{ fontSize: 36 }}>\uD83D\uDCC5</span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#605E5C" }}>
            Sin proyectos en {selectedYear}
          </p>
          <p style={{ margin: 0, fontSize: 12 }}>
            No hay proyectos con inicio en {selectedYear}.
            Cambia el año en el <strong>Ámbito</strong>.
          </p>
        </div>
      )}

      {/* KPI strip — 5 cards clicables */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[3], marginBottom: spacing[5] }}>
        <KpiCard
          label="Total riesgos"
          value={kpis.total}
          accent={color.textSecondary}
        />
        <KpiCard
          label="Abiertos"
          value={kpis.open}
          accent={color.danger}
        />
        <KpiCard
          label="Vencen ≤14d"
          value={kpis.dueSoon}
          accent={color.warning}
          active={!!filters.onlyDueSoon}
          onClick={() => setFilters((f) => ({ ...f, onlyDueSoon: !f.onlyDueSoon }))}
        />
        <KpiCard
          label="Asignadas a mí"
          value={kpis.assignedToMe}
          accent={color.primary}
          icon={<UserCheck size={14} color={color.primary} />}
          active={!!filters.onlyAssignedToMe}
          onClick={toggleAssignedToMe}
        />
        <KpiCard
          label="Esperando a terceros"
          value={kpis.waitingOnOthers}
          accent="#92400E"
          icon={<Hourglass size={14} color="#92400E" />}
          active={!!filters.onlyWaitingOnOthers}
          onClick={toggleWaitingOnOthers}
        />
      </div>

      {/* Filtros locales (severidad, estado, responsable, vencen, búsqueda) */}
      <RisksFilters filters={filters} onChange={setFilters} />

      {/* Tabla */}
      <RisksTable
        risks={displayedRisks}
        projects={projects}
        workItems={workItems}
        loading={loading}
        canEdit={canEdit}
        currentUserId={effectiveUserId}
        onView={(r)  => setDrawerRisk(r)}
        onEdit={(r)  => openEdit(r)}
        onClose={(r) => openClose(r)}
      />

      {/* Drawer de detalle */}
      {drawerRisk && (
        <RiskDrawer
          risk={drawerRisk}
          projects={projects}
          workItems={workItems}
          states={states}
          transitions={transitions}
          activityLog={activityLog}
          canEdit={canEdit}
          onClose={() => setDrawerRisk(null)}
          onEdit={(r) => openEdit(r)}
          onClosed={handleRiskClosed}
        />
      )}

      {/* Modal de formulario */}
      {formOpen && (
        <RiskForm
          mode={formMode}
          risk={formRisk}
          projects={projects}
          workItems={workItems}
          onSave={handleSave}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
};
