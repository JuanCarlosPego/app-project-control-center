// ─────────────────────────────────────────────────────────
//  src/screens/audit/AuditPage.tsx
//  Pantalla "Auditoría" — registro formal y exportable.
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Download, ShieldAlert } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button }     from "../../components/ui/Button";
import { color, font, radius, shadow, spacing } from "../../components/ui/tokens";
import type { AuditEntry, AppUser, Project, WorkItem } from "../../types/domain";
import { useEffectiveUser }  from "../../auth/ImpersonationContext";
import { useAppFilter }      from "../../context/AppFilterContext";
import { useProjectScope }   from "../../hooks/useProjectScope";
import { getProjects }       from "../../services/projectService";
import { getWorkItems }      from "../../services/workItemService";
import { getAppUsers }       from "../../services/userManagementService";
import {
  getAuditLog, exportAuditCSV,
  EMPTY_AUDIT_FILTERS,
  applyPersonalAuditFilters,
} from "../../services/auditService";
import type { AuditFilters } from "../../services/auditService";
import { AuditFilters as AuditFiltersBar } from "./components/AuditFilters";
import { AuditTable }        from "./components/AuditTable";
import { AuditDetailDrawer } from "./components/AuditDetailDrawer";

// ── KPI mini card ─────────────────────────────────────────
const KpiCard: React.FC<{ label: string; value: number; accent?: string }> = ({
  label, value, accent = color.primary,
}) => (
  <div style={{
    flex: "1 1 140px",
    padding: `${spacing[4]}px ${spacing[5]}px`,
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    boxShadow: shadow.xs,
    textAlign: "center",
  }}>
    <div style={{ fontSize: 28, fontWeight: font.weight.bold, color: accent, lineHeight: 1.1 }}>
      {value}
    </div>
    <div style={{ marginTop: 4, fontSize: font.size.xs, color: color.textMuted }}>{label}</div>
  </div>
);

// ── Diferenciador de fuentes ──────────────────────────────
// "Actividad (humana)" = activityLog; "Sistema (formal)" = auditLog
const SOURCE_LABELS: Record<string, { bg: string; fg: string; label: string }> = {
  activityLog: { bg: color.primaryBg,  fg: color.primary, label: "Actividad humana" },
  auditLog:    { bg: "#FDF4FF",        fg: "#9333EA",     label: "Sistema" },
};

// ── Página ────────────────────────────────────────────────
export const AuditPage: React.FC = () => {
  const { roles, user: currentUser } = useEffectiveUser();
  const canExport = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const effectiveUserId = currentUser?.id ?? "";

  // ── Contexto Global ────────────────────────────────────────
  const {
    selectedProjectId: ctxProjectId,
    selectedAreaId,
  } = useAppFilter();
  const { projectIdsScope: scopedProjectIds, hasScope, selectedYear } = useProjectScope();

  // ── Datos soporte ─────────────────────────────────────
  const [users,     setUsers]     = useState<AppUser[]>([]);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loadingSupport, setLoadingSupport] = useState(true);

  // ── Entradas de auditoría ─────────────────────────────
  const [entries,  setEntries]  = useState<AuditEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // ── UI ────────────────────────────────────────────────
  const [filters,      setFilters]      = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [activeEntry,  setActiveEntry]  = useState<AuditEntry | null>(null);

  // ── Carga de soporte ──────────────────────────────────
  useEffect(() => {
    Promise.all([getAppUsers(), getProjects(), getWorkItems()])
      .then(([u, p, w]) => {
        setUsers(u);
        setProjects(p);
        setWorkItems(w);
      })
      .catch(() => {/* no-op, soporte no crítico */})
      .finally(() => setLoadingSupport(false));
  }, []);

  // ── Carga de auditoría ────────────────────────────────
  const loadAudit = useCallback(() => {
    setLoading(true);
    setError("");
    // Proyecto: siempre del Contexto Global
    const auditFilters: AuditFilters = {
      ...filters,
      projectId: ctxProjectId || undefined,
    };
    getAuditLog(auditFilters)
      .then((data) => setEntries(data))
      .catch(() => setError("Error al cargar el registro de auditoría"))
      .finally(() => setLoading(false));
  }, [filters, ctxProjectId]);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  // ── KPIs ──────────────────────────────────────────────
  // Aplicar quick-filters personales (client-side) + scope año+área tras la carga del servidor
  const displayedEntries = useMemo(() => {
    let list = applyPersonalAuditFilters(entries, workItems, projects, filters, effectiveUserId);
    // Scope: entradas del ámbito anual+área+proyecto
    if (scopedProjectIds.size > 0) {
      list = list.filter((e) => {
        // Entradas sin projectId (RBAC, Settings): solo cuando scope es global
        if (!e.projectId) {
          return !selectedAreaId && !ctxProjectId;
        }
        return scopedProjectIds.has(e.projectId);
      });
    }
    return list;
  }, [entries, workItems, projects, filters, effectiveUserId, scopedProjectIds, selectedAreaId, ctxProjectId]);

  const kpiTotal    = displayedEntries.length;
  const kpiCritical = displayedEntries.filter((e) => e.isCritical).length;
  const kpiRBAC     = displayedEntries.filter((e) => e.entityType === "RBAC" || e.entityType === "Settings").length;
  const kpiWorkItems= displayedEntries.filter((e) => e.entityType === "WorkItem").length;

  // ── Mapa de usuarios para CSV ─────────────────────────
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.displayName]));

  return (
    <div style={{ padding: `${spacing[6]}px`, maxWidth: 1300, margin: "0 auto" }}>
      {/* PageHeader */}
      <PageHeader
        title="Auditoría"
        subtitle="Registro formal de cambios del sistema — diferenciado de la actividad operativa"
        actions={
          <div style={{ display: "flex", gap: spacing[3], alignItems: "center" }}>
            {/* Leyenda fuentes */}
            <div style={{ display: "flex", gap: spacing[2], alignItems: "center" }}>
              {Object.values(SOURCE_LABELS).map((s) => (
                <span key={s.label} style={{
                  display: "inline-block", padding: "2px 8px",
                  borderRadius: radius.full, background: s.bg, color: s.fg,
                  fontSize: font.size.xs, fontWeight: font.weight.medium,
                }}>
                  {s.label}
                </span>
              ))}
            </div>
            <Button variant="ghost" icon={<RefreshCw size={14} />} onClick={loadAudit}>
              Refrescar
            </Button>
            {canExport && (
              <Button
                variant="ghost"
                icon={<Download size={14} />}
                onClick={() => exportAuditCSV(displayedEntries, userMap)}
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

      {/* Aviso de acceso restringido */}
      {!canExport && (
        <div style={{
          marginBottom: spacing[5], padding: `${spacing[3]}px ${spacing[4]}px`,
          background: color.warningBg, border: `1px solid ${color.warning}`,
          borderRadius: radius.sm, color: color.warning, fontSize: font.size.sm,
          display: "flex", alignItems: "center", gap: spacing[2],
        }}>
          <ShieldAlert size={14} /> Solo Admin e IT AirEuropa tienen acceso al registro de auditoría formal.
        </div>
      )}

      {/* KPI strip */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[4], marginBottom: spacing[6] }}>
        <KpiCard label="Total registros"       value={kpiTotal}     accent={color.primary} />
        <KpiCard label="Críticos"              value={kpiCritical}  accent={color.danger} />
        <KpiCard label="RBAC / Configuración"  value={kpiRBAC}      accent={"#9333EA"} />
        <KpiCard label="WorkItems"             value={kpiWorkItems} accent={color.success} />
      </div>

      {/* Barra de filtros locales (entityType, acción, actor, fechas, toggles) */}
      <AuditFiltersBar
        filters={filters}
        onChange={setFilters}
        users={users}
      />

      {/* Empty state anual */}
      {!loading && !loadingSupport && !hasScope && (
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

      {/* Tabla */}
      <AuditTable
        entries={displayedEntries}
        loading={loading || loadingSupport}
        users={users}
        projects={projects}
        workItems={workItems}
        onDetail={(e) => setActiveEntry(e)}
      />

      {/* Drawer de detalle */}
      {activeEntry && (
        <AuditDetailDrawer
          entry={activeEntry}
          users={users}
          projects={projects}
          workItems={workItems}
          onClose={() => setActiveEntry(null)}
        />
      )}
    </div>
  );
};
