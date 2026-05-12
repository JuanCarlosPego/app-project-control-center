// ─────────────────────────────────────────────────────────
//  src/screens/evidences/EvidencesPage.tsx
//  Repositorio central de evidencias (entregables, pruebas, comentarios).
// ─────────────────────────────────────────────────────────

import React from "react";
import { FileCheck2, RefreshCw, Download, Plus } from "lucide-react";
import {
  PageHeader, Button,
  LoadingSkeleton, ErrorState as UIErrorState, EmptyState as UIEmptyState,
  color, spacing, font,
} from "../../components/ui";
import { useEffectiveUser } from "../../auth/ImpersonationContext";
import { useAppFilter } from "../../context/AppFilterContext";
import { useProjectScope } from "../../hooks/useProjectScope";
import { ownsWorkItem } from "../../auth/workItemPermissions";
import { getEvidences, exportEvidencesCSV } from "../../services/evidenceService";
import { getProjects, getBusinessAreas } from "../../services/projectService";
import { getWorkItems } from "../../services/workItemService";
import { getStates, getTransitions } from "../../services/workItemService";
import { getAppUsers } from "../../services/userManagementService";
import { EvidencesFilters, EMPTY_EVIDENCE_FILTERS } from "./components/EvidencesFilters";
import { EvidencesTable } from "./components/EvidencesTable";
import { AddEvidenceModal } from "../../components/modals/AddEvidenceModal";
import { WorkItemDrawer } from "../kanban/components/WorkItemDrawer";
import type { Evidence, Project, WorkItem, AppUser, State, Transition, BusinessArea } from "../../types/domain";
import type { EvidenceFilterState } from "./components/EvidencesFilters";

// ── EvidencesPage ─────────────────────────────────────────
export const EvidencesPage: React.FC = () => {
  const { roles }      = useEffectiveUser();
  const canCreate      = !roles.includes("Invitado");
  const canExport      = roles.includes("Admin") || roles.includes("IT AirEuropa");

  // ── Ámbito global (proyecto + área + año) ────────────────────────────────────────
  const { selectedProjectId: ctxProjectId, selectedAreaId: ctxAreaId } = useAppFilter();
  const { projectIdsScope, hasScope, selectedYear } = useProjectScope();

  // ── Estado de datos ──────────────────────────────────────
  const [evidences,  setEvidences]  = React.useState<Evidence[]>([]);
  const [projects,   setProjects]   = React.useState<Project[]>([]);
  const [areas,      setAreas]      = React.useState<BusinessArea[]>([]);
  const [workItems,  setWorkItems]  = React.useState<WorkItem[]>([]);
  const [appUsers,   setAppUsers]   = React.useState<AppUser[]>([]);
  const [states,     setStates]     = React.useState<State[]>([]);
  const [transitions,setTransitions]= React.useState<Transition[]>([]);
  const [loading,    setLoading]    = React.useState(false);
  const [error,      setError]      = React.useState<string | null>(null);

  // ── Filtros ──────────────────────────────────────────────
  const [filters, setFilters] = React.useState<EvidenceFilterState>({
    ...EMPTY_EVIDENCE_FILTERS,
    projectId: ctxProjectId || "",
    areaId:    ctxAreaId    || "",
  });

  // Sincronizar con cambios del ámbito global
  React.useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      projectId: ctxProjectId || "",
      areaId:    ctxAreaId    || "",
    }));
  }, [ctxProjectId, ctxAreaId]);

  // ── UI state ─────────────────────────────────────────────
  const [showAddModal,  setShowAddModal]  = React.useState(false);
  const [openWI,        setOpenWI]        = React.useState<WorkItem | null>(null);

  // ── Cargar datos ─────────────────────────────────────────
  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [evList, projs, areasData, wis, sts, trans, users] = await Promise.all([
        getEvidences({}),
        getProjects(),
        getBusinessAreas(),
        getWorkItems(),
        getStates(),
        getTransitions(),
        getAppUsers(),
      ]);
      setEvidences(evList);
      setProjects(projs);
      setAreas(areasData);
      setWorkItems(wis);
      setStates(sts);
      setTransitions(trans);
      setAppUsers(users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar las evidencias");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  // ── Filtrado client-side ──────────────────────────────────
  const { user: currentUser } = useEffectiveUser();
  const appUser = currentUser as import("../../auth/ImpersonationContext").AppUser;

  // WorkItems que el usuario actual posee (para el modal de añadir evidencia)
  const ownedWorkItems = React.useMemo(
    () => workItems.filter((w) => ownsWorkItem(appUser, w)),
    [workItems, appUser],
  );

  const filtered = React.useMemo(() => {
    let list = evidences;

    // SCOPE ANUAL: filtrar por workItems de proyectos en ámbito (año+área+proyecto)
    // Esto es la regla DataScope del spec: EvidencesInScope.
    {
      const scopedWiIds = new Set(
        workItems.filter((w) => projectIdsScope.has(w.projectId)).map((w) => w.id),
      );
      list = list.filter((e) =>
        (e.entityType === "WorkItem" && scopedWiIds.has(e.entityId)) ||
        (e.entityType === "Project"  && projectIdsScope.has(e.entityId)),
      );
    }

    if (filters.areaId) {
      // filtro local de área adicional sobre el scope global
      const projIds = new Set(
        workItems
          .filter((w) => projectIdsScope.has(w.projectId))
          .map((w) => w.projectId)
          .filter((pid) => {
            // verifica que el proyecto pertenece al área del filtro local
            const proj = projects.find((p) => p.id === pid);
            return proj?.businessAreaId === filters.areaId;
          }),
      );
      const wiIds = new Set(
        workItems.filter((w) => projIds.has(w.projectId)).map((w) => w.id),
      );
      list = list.filter((e) =>
        (e.entityType === "WorkItem" && wiIds.has(e.entityId)) ||
        (e.entityType === "Project"  && projIds.has(e.entityId)),
      );
    }

    if (filters.type)      list = list.filter((e) => e.type === filters.type);
    if (filters.createdBy) list = list.filter((e) => e.createdBy === filters.createdBy);

    if (filters.query) {
      const q = filters.query.toLowerCase();
      list = list.filter((e) => {
        const wi = workItems.find((w) => w.id === e.entityId);
        return (
          e.comment.toLowerCase().includes(q) ||
          e.value.toLowerCase().includes(q) ||
          (wi?.title?.toLowerCase().includes(q) ?? false) ||
          (wi?.jiraIssueKey?.toLowerCase().includes(q) ?? false)
        );
      });
    }

    if (filters.onlyMine) {
      list = list.filter((e) => e.createdBy === currentUser?.id);
    }

    return list;
  }, [evidences, filters, workItems, projects, currentUser, projectIdsScope]);

  // ── Exportar CSV ──────────────────────────────────────────
  const handleExport = () => {
    const wiMap    = Object.fromEntries(workItems.map((w) => [w.id, { title: w.title, jiraIssueKey: w.jiraIssueKey, projectId: w.projectId }]));
    const projMap  = Object.fromEntries(projects.map((p) => [p.id, { code: p.code, name: p.name }]));
    const userMap  = Object.fromEntries(appUsers.map((u) => [u.id, u.displayName]));
    exportEvidencesCSV(filtered, wiMap, projMap, userMap);
  };

  // ── KPI de resumen ────────────────────────────────────────
  const kpiLinks    = filtered.filter((e) => e.type === "link").length;
  const kpiComments = filtered.filter((e) => e.type === "comment").length;
  const kpiFiles    = filtered.filter((e) => e.type === "file").length;

  return (
    <div style={{ padding: `${spacing[7]}px ${spacing[8]}px`, minHeight: "100%", fontFamily: font.family }}>

      {/* PageHeader */}
      <PageHeader
        icon={<FileCheck2 size={20} />}
        title="Evidencias"
        subtitle="Entregables, pruebas y comentarios asociados a tareas y transiciones"
        bordered
        actions={
          <>
            <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={loadData} loading={loading}>
              Refrescar
            </Button>
            {canExport && filtered.length > 0 && (
              <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={handleExport}>
                Exportar CSV
              </Button>
            )}
            {canCreate && (
              <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setShowAddModal(true)}>
                Añadir evidencia
              </Button>
            )}
          </>
        }
      />

      {/* KPI Pills */}
      {!loading && !error && evidences.length > 0 && (
        <div style={{
          display: "flex", gap: spacing[4], flexWrap: "wrap",
          marginBottom: spacing[5],
        }}>
          {[
            { label: "Total", value: filtered.length, c: color.primary, bg: color.primaryBg },
            { label: "Enlaces", value: kpiLinks, c: "#0078D4", bg: "#EFF6FC" },
            { label: "Comentarios", value: kpiComments, c: color.textSecondary, bg: "#F3F2F1" },
            { label: "Archivos", value: kpiFiles, c: "#7530AF", bg: "#F4EFF9" },
          ].map(({ label, value, c, bg }) => (
            <div key={label} style={{
              padding: `${spacing[3]}px ${spacing[5]}px`,
              border: `1px solid ${c}33`,
              borderRadius: "24px",
              background: bg,
              display: "flex", alignItems: "center", gap: spacing[3],
            }}>
              <span style={{ fontSize: font.size.xl, fontWeight: font.weight.semibold, color: c }}>{value}</span>
              <span style={{ fontSize: font.size.sm, color: c, fontWeight: font.weight.medium }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* FilterBar */}
      {!loading && !error && (
        <EvidencesFilters
          filters={filters}
          onChange={setFilters}
          projects={projects}
          areas={areas}
          users={appUsers}
          onReset={() => setFilters(EMPTY_EVIDENCE_FILTERS)}
        />
      )}

      {/* Loading */}
      {loading && <LoadingSkeleton variant="row" count={8} />}

      {/* Error */}
      {!loading && error && (
        <UIErrorState message={error} onRetry={loadData} />
      )}

      {/* Empty state anual */}
      {!loading && !error && !hasScope && (
        <UIEmptyState
          icon={<FileCheck2 size={32} />}
          title={`Sin proyectos en ${selectedYear}`}
          description={`No hay proyectos con inicio en ${selectedYear}. Cambia el año en el Ámbito.`}
        />
      )}

      {/* Empty tras filtros */}
      {!loading && !error && hasScope && filtered.length === 0 && evidences.length > 0 && (
        <UIEmptyState
          icon={<FileCheck2 size={32} />}
          title="Sin resultados"
          description="No hay evidencias que coincidan con los filtros aplicados."
          action={<Button size="sm" variant="secondary" onClick={() => setFilters(EMPTY_EVIDENCE_FILTERS)}>Limpiar filtros</Button>}
        />
      )}

      {/* Empty inicial */}
      {!loading && !error && evidences.length === 0 && (
        <UIEmptyState
          icon={<FileCheck2 size={32} />}
          title="Sin evidencias"
          description="Aún no se han registrado evidencias. Usa el botón 'Añadir evidencia' para comenzar."
          action={canCreate
            ? <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setShowAddModal(true)}>Añadir evidencia</Button>
            : undefined
          }
        />
      )}

      {/* Tabla */}
      {!loading && !error && filtered.length > 0 && (
        <EvidencesTable
          evidences={filtered}
          projects={projects}
          workItems={workItems}
          appUsers={appUsers}
          states={states}
          onOpenWorkItem={setOpenWI}
        />
      )}

      {/* Modal añadir evidencia */}
      {showAddModal && (
        <AddEvidenceModal
          projects={projects}
          workItems={ownedWorkItems}
          onCreated={loadData}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* WorkItemDrawer */}
      {openWI && (
        <WorkItemDrawer
          item={openWI}
          states={states}
          transitions={transitions}
          currentUserRoles={roles}
          appUser={appUser}
          onClose={() => setOpenWI(null)}
          onMoveFromDrawer={() => { /* no-op desde evidencias */ }}
          onItemUpdated={(updated: WorkItem) => setOpenWI(updated)}
        />
      )}
    </div>
  );
};
