// ─────────────────────────────────────────────────────────
//  src/screens/projects/ProjectsPage.tsx
//  Pantalla /projects — vista Cards / Tabla con filtros,
//  KPI bar, drawer de detalle y RBAC en acciones.
//
//  Datos: MSW → /api/projects (filtrado por rol en servidor)
//  Filtro "Solicitadas por mí": client-side
//  Preferencia de vista: localStorage["pcc:projects:view"]
// ─────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Download, RefreshCw, LayoutGrid } from "lucide-react";

import { useAuth } from "../../auth/AuthContext";
import {
  PageHeader, Button,
  LoadingSkeleton, ErrorState as UIErrorState, EmptyState as UIEmptyState,
} from "../../components/ui";
import {
  getProjects,
  getBusinessAreas,
  getProviders,
} from "../../services/projectService";
import { getStates } from "../../services/workItemService";
import { listAppUsers } from "../../services/userService";
import { listTeams } from "../../services/teamService";
import { apiClient } from "../../services/apiClient";
import type { Project, BusinessArea, Provider, User, State, Team } from "../../types/domain";
import type { AppUser } from "../../auth/ImpersonationContext";
import { ApiError } from "../../services/apiClient";
import { applyPersonalProjectFilters } from "../shared/projectSelectors";
import { useAppFilter } from "../../context/AppFilterContext";

import { ViewToggle, type ViewMode } from "./components/ViewToggle";
import { KPIBar } from "./components/KPIBar";
import { ProjectsFilters, EMPTY_FILTERS, type FilterState } from "./components/ProjectsFilters";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectsTable } from "./components/ProjectsTable";
import { ProjectDrawer } from "./components/ProjectDrawer";
import { CreateProjectModal } from "./components/CreateProjectModal";

// ── Helpers ───────────────────────────────────────────────
const VIEW_KEY = "pcc:projects:view";

function loadView(): ViewMode {
  try { return (localStorage.getItem(VIEW_KEY) as ViewMode) ?? "cards"; }
  catch { return "cards"; }
}
function saveView(v: ViewMode) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignorar */ }
}

function exportCSV(projects: Project[], areas: BusinessArea[], providers: Provider[]) {
  const areaMap = Object.fromEntries(areas.map((a) => [a.id, a.name]));
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "proyectos.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── ProjectsPage ──────────────────────────────────────────
export const ProjectsPage: React.FC = () => {
  const { roles } = useAuth();

  // Estado de datos
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [areas, setAreas]             = useState<BusinessArea[]>([]);
  const [providers, setProviders]     = useState<Provider[]>([]);
  const [states, setStates]           = useState<State[]>([]);
  const [appUsers, setAppUsers]       = useState<AppUser[]>([]);
  const [teams, setTeams]             = useState<Team[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // UI state
  const [view, setView]           = useState<ViewMode>(loadView);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Inicializar filtro de estado desde URL params (ej: /projects?status=Bloqueado)
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...EMPTY_FILTERS,
    status: searchParams.get("status") ?? "",
  }));

  const canAdmin = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const isProveedor = roles.includes("Proveedor") && !canAdmin;

  // ── Ámbito global (año + área) ──────────────────────────────
  const { selectedYear, selectedAreaId } = useAppFilter();

  // ── Carga de datos ────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projects, areasData, providersData, statesData, meData, usersData, teamsData] = await Promise.all([
        getProjects({ year: String(selectedYear), areaId: selectedAreaId || undefined }),                                         // MSW aplica RBAC + filtro de ámbito
        getBusinessAreas(),
        getProviders(),
        getStates(),
        apiClient.get<User>("/me"),
        listAppUsers(),
        listTeams({ isActive: true }),
      ]);
      setAllProjects(projects);
      setAreas(areasData);
      setProviders(providersData);
      setStates(statesData);
      setCurrentUserId(meData.id);
      setAppUsers(usersData);
      setTeams(teamsData);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar proyectos");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedAreaId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Categorías únicas del catálogo ───────────────────────
  const categories = useMemo(
    () => [...new Set(allProjects.map((p) => p.category).filter(Boolean))].sort(),
    [allProjects],
  );

  // ── Filtrado client-side ──────────────────────────────────
  const filtered = useMemo(() => {
    let list = allProjects;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
      );
    }
    if (filters.status)            list = list.filter((p) => p.status === filters.status);
    if (filters.deliveryOwnerType) list = list.filter((p) => p.deliveryOwnerType === filters.deliveryOwnerType);
    if (filters.providerId)        list = list.filter((p) => p.providerId === filters.providerId);
    if (filters.category)          list = list.filter((p) => p.category === filters.category);
    if (filters.onlyMine && currentUserId)
      list = list.filter((p) => p.requestedByUserId === currentUserId);
    // Filtros personales extra (unión si ambos activos)
    list = applyPersonalProjectFilters(
      list,
      { onlyAssignedToMe: filters.onlyAssignedToMe, onlyWaitingOnOthers: filters.onlyWaitingOnOthers },
      currentUserId,
    );
    return list;
  }, [allProjects, filters, currentUserId]);

  // Lookup maps
  const userMap = useMemo(
    () => Object.fromEntries(appUsers.map((u) => [u.id, u.displayName ?? u.email ?? u.id])),
    [appUsers],
  );
  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams],
  );

  // ── Cambio de vista con persistencia ─────────────────────
  const handleViewChange = (v: ViewMode) => {
    setView(v); saveView(v);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ padding: "20px 24px", minHeight: "100%", background: "#FAF9F8", boxSizing: "border-box" }}>

      {/* ── Page Header ── */}
      <PageHeader
        icon={<LayoutGrid size={20} />}
        title="Proyectos"
        subtitle={loading ? "Cargando…" : `${filtered.length} de ${allProjects.length} proyectos`}
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw size={12} style={{ animation: loading ? "ds-spin 1s linear infinite" : "none" }} />}
              onClick={loadData}
              disabled={loading}
            >
              Refrescar
            </Button>
            {canAdmin && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Download size={12} />}
                onClick={() => exportCSV(filtered, areas, providers)}
                disabled={filtered.length === 0}
              >
                Exportar
              </Button>
            )}
            {canAdmin && (
              <Button
                size="sm"
                variant="primary"
                icon={<Plus size={13} />}
                onClick={() => setCreateOpen(true)}
              >
                Nuevo proyecto
              </Button>
            )}
            <ViewToggle value={view} onChange={handleViewChange} />
          </>
        }
      />
      <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── KPI Bar ── */}
      {!loading && !error && (
        <KPIBar
          projects={allProjects}
          activeStatus={filters.status}
          onStatusFilter={(s) => setFilters((f) => ({ ...f, status: s }))}
        />
      )}

      {/* ── Filtros ── */}
      <ProjectsFilters
        filters={filters}
        onChange={setFilters}
        providers={providers}
        categories={categories}
        canSeeOnlyMine={!isProveedor}
      />

      {/* ── Estados de carga / error ── */}
      {loading && <LoadingSkeleton count={6} variant="card" />}
      {!loading && error && <UIErrorState message={error} onRetry={loadData} />}

      {/* ── Contenido ── */}
      {!loading && !error && (
        filtered.length === 0
          ? <UIEmptyState
              title={JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) ? "Ningún proyecto coincide" : "No hay proyectos"}
              description={JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) ? "Prueba a cambiar o limpiar los filtros." : "No tienes proyectos disponibles aún."}
            />
          : view === "cards"
            ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 14,
              }}>
                {filtered.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    area={areas.find((a) => a.id === p.businessAreaId)}
                    provider={p.providerId ? providers.find((pv) => pv.id === p.providerId) : undefined}
                    assigneeName={p.assignedToUserId ? userMap[p.assignedToUserId] : undefined}
                    requesterName={p.requestedByUserId ? userMap[p.requestedByUserId] : undefined}
                    teamName={p.assignedToTeamId ? teamMap[p.assignedToTeamId] : undefined}
                    onClick={() => setSelectedProject(p)}
                  />
                ))}
              </div>
            )
            : (
              <ProjectsTable
                projects={filtered}
                areas={areas}
                providers={providers}
                roles={roles}
                onSelect={setSelectedProject}
              />
            )
      )}

      {/* ── Drawer ── */}
      <ProjectDrawer
        project={selectedProject}
        areas={areas}
        providers={providers}
        roles={roles}
        states={states}
        onClose={() => setSelectedProject(null)}
      />

      {/* ── Modal crear proyecto ── */}
      {createOpen && (
        <CreateProjectModal
          open={createOpen}
          areas={areas}
          providers={providers}
          categories={categories}
          onClose={() => setCreateOpen(false)}
          onCreated={() => { setCreateOpen(false); loadData(); }}
        />
      )}
    </div>
  );
};


