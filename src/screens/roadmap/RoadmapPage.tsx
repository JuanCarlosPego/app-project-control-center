// ─────────────────────────────────────────────────────────
//  src/screens/roadmap/RoadmapPage.tsx
//  Pantalla /roadmap — Timeline del Programa
//
//  Capas:
//    RoadmapHeader  → año, zoom, agrupar por, alertas
//    RoadmapKPIBar  → KPI cards clicables (filtran por estado)
//    RoadmapFilters → búsqueda, área, estado, ejecutor, proveedor, "mías"
//    RoadmapGrid    → grupos colapsables + RoadmapProjectCard
//    RoadmapDrawer  → detalle del proyecto con tabs
//
//  Datos: MSW /api/projects (RBAC en servidor)
//  Filtro "onlyMine": client-side por requestedByUserId
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import {
  getProjects,
  getBusinessAreas,
  getProviders,
} from "../../services/projectService";
import { apiClient, ApiError } from "../../services/apiClient";
import { listAppUsers } from "../../services/userService";
import { listTeams } from "../../services/teamService";
import type { Project, BusinessArea, Provider, User, Team } from "../../types/domain";
import type { AppUser } from "../../auth/ImpersonationContext";
import { applyPersonalProjectFilters } from "../shared/projectSelectors";
import { useAppFilter } from "../../context/AppFilterContext";

import { RoadmapHeader } from "./components/RoadmapHeader";
import { RoadmapKPIBar } from "./components/RoadmapKPIBar";
import { RoadmapFilters, EMPTY_ROADMAP_FILTERS, type RoadmapFilterState } from "./components/RoadmapFilters";
import { RoadmapGrid, groupProjects } from "./components/RoadmapGrid";
import { RoadmapDrawer } from "./components/RoadmapDrawer";
import type { ZoomLevel, GroupBy } from "./tokens";

// ── RoadmapPage ───────────────────────────────────────────
export const RoadmapPage: React.FC = () => {
  const { roles } = useAuth();

  // ── Datos ─────────────────────────────────────────────
  const [allProjects,    setAllProjects]    = useState<Project[]>([]);
  const [areas,          setAreas]          = useState<BusinessArea[]>([]);
  const [providers,      setProviders]      = useState<Provider[]>([]);  const [appUsers,       setAppUsers]       = useState<AppUser[]>([]);
  const [teams,          setTeams]          = useState<Team[]>([]);  const [currentUserId,  setCurrentUserId]  = useState<string>("");
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────
  const [zoom,            setZoom]            = useState<ZoomLevel>("year");
  const [groupBy,         setGroupBy]         = useState<GroupBy>("area");
  const [filters,         setFilters]         = useState<RoadmapFilterState>(EMPTY_ROADMAP_FILTERS);
  const [activeStatus,    setActiveStatus]    = useState<string>("");  // KPI bar
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const canAdmin    = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const isProveedor = roles.includes("Proveedor") && !canAdmin;

  // ── Ámbito global (año + área) ────────────────────────
  const { selectedYear, setYear, selectedAreaId } = useAppFilter();

  // ── Carga de datos ────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projects, areasData, providersData, meData, usersData, teamsData] = await Promise.all([
        getProjects({ year: String(selectedYear), areaId: selectedAreaId || undefined }),
        getBusinessAreas(),
        getProviders(),
        apiClient.get<User>("/me"),
        listAppUsers(),
        listTeams({ isActive: true }),
      ]);
      setAllProjects(projects);
      setAreas(areasData);
      setProviders(providersData);
      setCurrentUserId(meData.id);
      setAppUsers(usersData);
      setTeams(teamsData);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar el roadmap");
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedAreaId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtrado client-side ──────────────────────────────
  const filtered = useMemo(() => {
    let list = allProjects;

    // Filtro KPI bar (status)
    if (activeStatus) list = list.filter((p) => p.status === activeStatus);

    // Filtros barra
    if (filters.query) {
      const q = filters.query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }
    if (filters.status)            list = list.filter((p) => p.status === filters.status);
    if (filters.deliveryOwnerType) list = list.filter((p) => p.deliveryOwnerType === filters.deliveryOwnerType);
    if (filters.providerId)        list = list.filter((p) => p.providerId === filters.providerId);
    if (filters.onlyMine && currentUserId)
      list = list.filter((p) => p.requestedByUserId === currentUserId);

    // Filtro "Esperando a terceros"
    list = applyPersonalProjectFilters(
      list,
      { onlyWaitingOnOthers: filters.onlyWaitingOnOthers },
      currentUserId,
    );

    return list;
  }, [allProjects, activeStatus, filters, currentUserId]);

  // ── Lookup maps ─────────────────────────────────────
  const userMap = useMemo(
    () => Object.fromEntries(appUsers.map((u) => [u.id, u.displayName ?? u.email ?? u.id])),
    [appUsers],
  );
  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t.name])),
    [teams],
  );

  // ── Agrupación dinámica ───────────────────────────────
  const groups = useMemo(
    () => groupProjects(filtered, groupBy, areas, providers, zoom),
    [filtered, groupBy, areas, providers, zoom],
  );

  // ── Manejadores ───────────────────────────────────────
  const handleStatusFilter = (s: string) =>
    setActiveStatus((prev) => (prev === s ? "" : s));

  const handleYearPrev = () => setYear(selectedYear - 1);
  const handleYearNext = () => setYear(selectedYear + 1);

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{ padding: "20px 24px", minHeight: "100%", background: "#FAF9F8", boxSizing: "border-box" }}>

      {/* Header con año, zoom, alertas, agrupar por */}
      <RoadmapHeader
        year={selectedYear}
        onYearPrev={handleYearPrev}
        onYearNext={handleYearNext}
        zoom={zoom}
        onZoom={setZoom}
        groupBy={groupBy}
        onGroupBy={(g) => { setGroupBy(g); if (g !== "area") setZoom("year"); }}
        projects={allProjects}
        loading={loading}
        onRefresh={loadData}
      />

      {/* KPI Bar — filtra allProjects para contar sin filtros de barra */}
      {!loading && !error && (
        <RoadmapKPIBar
          projects={allProjects}
          activeStatus={activeStatus}
          onStatusFilter={handleStatusFilter}
        />
      )}

      {/* Barra de filtros */}
      <RoadmapFilters
        filters={filters}
        onChange={setFilters}
        providers={providers}
        canSeeOnlyMine={!isProveedor}
      />

      {/* Estados de carga / error */}
      {loading && <SkeletonGrid />}
      {!loading && error && <ErrorState message={error} onRetry={loadData} />}

      {/* Grid principal */}
      {!loading && !error && (
        <RoadmapGrid
          groups={groups}
          areas={areas}
          providers={providers}
          userMap={userMap}
          teamMap={teamMap}
          onSelect={setSelectedProject}
        />
      )}

      {/* Drawer lateral */}
      <RoadmapDrawer
        project={selectedProject}
        areas={areas}
        providers={providers}
        roles={roles}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
};

// ── Skeleton de carga ─────────────────────────────────────
const SkeletonGrid: React.FC = () => (
  <div>
    {/* Simula un grupo */}
    <div style={{ height: 36, background: "#F3F2F1", borderRadius: 7, marginBottom: 10 }} />
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
      gap: 10, marginBottom: 20,
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          height: 170, borderRadius: 6, background: "#EDEBE9",
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: `${i * 0.1}s`,
        }} />
      ))}
    </div>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
  </div>
);

// ── Estado de error ───────────────────────────────────────
const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div style={{
    textAlign: "center", padding: "50px 20px",
    background: "#FDF3F0", borderRadius: 8, border: "1px solid #FDCFBC",
  }}>
    <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
    <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600, color: "#D83B01" }}>{message}</p>
    <button
      onClick={onRetry}
      style={{
        padding: "7px 16px", borderRadius: 5, border: "none",
        background: "#D83B01", color: "#fff", cursor: "pointer",
        fontSize: 12, fontFamily: "'Segoe UI', sans-serif", fontWeight: 600,
      }}
    >
      Reintentar
    </button>
  </div>
);
