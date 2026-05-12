// ─────────────────────────────────────────────────────────
//  src/screens/requests/RequestsPage.tsx
//  Pantalla /requests — Solicitudes: entrada de demanda IT.
//  Visible para todos los roles; RBAC aplicado inline.
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Inbox, Plus, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/ui/PageHeader";
import { Button }     from "../../components/ui/Button";
import { color, font, radius, shadow, spacing } from "../../components/ui/tokens";
import type { Request, Project, Team } from "../../types/domain";
import type { AppUser } from "../../auth/ImpersonationContext";
import { useEffectiveUser }  from "../../auth/ImpersonationContext";
import { useAppFilter }      from "../../context/AppFilterContext";
import { getProjects }       from "../../services/projectService";
import { apiClient }         from "../../services/apiClient";
import {
  getRequests,
  REQUEST_STATUS_OPTIONS,
  REQUEST_STATUS_COLORS,
  type RequestFilters,
} from "../../services/requestService";
import { RequestsFilters, EMPTY_REQUEST_FILTERS } from "./components/RequestsFilters";
import { RequestsTable }       from "./components/RequestsTable";
import { RequestDrawer }       from "./components/RequestDrawer";
import { NewRequestModal }     from "./components/NewRequestModal";
import { ConvertToWorkItemModal } from "./components/ConvertToWorkItemModal";

// ── KPI Mini Card ─────────────────────────────────────────
const KpiCard: React.FC<{
  label: string;
  value: number;
  accent?: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ label, value, accent = color.primary, active = false, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: "1 1 100px",
      padding: `${spacing[4]}px ${spacing[5]}px`,
      background: active ? accent + "18" : color.surface,
      border: `1.5px solid ${active ? accent : color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      display: "flex", flexDirection: "column", gap: spacing[2],
      cursor: onClick ? "pointer" : "default",
      textAlign: "left",
      transition: "border-color 150ms",
      fontFamily: "'Segoe UI', sans-serif",
    }}
  >
    <span style={{ fontSize: font.size.xs, color: color.textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
      {label}
    </span>
    <span style={{ fontSize: 22, fontWeight: 700, color: active ? accent : color.text, lineHeight: 1 }}>
      {value}
    </span>
  </button>
);

// ── Tipos de datos secundarios ────────────────────────────

// ── Página principal ──────────────────────────────────────
export const RequestsPage: React.FC = () => {
  const { user: effectiveUser, roles } = useEffectiveUser();  const { selectedYear, selectedAreaId, areas, selectedProjectId, projectsInScope } = useAppFilter();
  const isIT    = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const canViewAll = isIT;
  // Todos los roles autenticados pueden crear solicitudes (menos Invitado)
  const canCreate = !roles.includes("Invitado");

  const [searchParams] = useSearchParams();

  // ── Estado ────────────────────────────────────────────
  const [requests,     setRequests]     = useState<Request[]>([]);
  const [fullProjects, setFullProjects] = useState<Project[]>([]);
  const [projects,     setProjects]     = useState<Array<{ id: string; name: string }>>([]);
  const [appUsers,     setAppUsers]     = useState<AppUser[]>([]);
  const [teams,        setTeams]        = useState<Team[]>([]);
  const [filters,      setFilters]      = useState<RequestFilters>(() => {
    const status = searchParams.get("status");
    return status
      ? { ...EMPTY_REQUEST_FILTERS, status }
      : EMPTY_REQUEST_FILTERS;
  });
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [selected,     setSelected]     = useState<Request | null>(null);
  const [showNew,      setShowNew]      = useState(false);
  const [showConvert,  setShowConvert]  = useState(false);
  const [kpiStatus,    setKpiStatus]    = useState<string | null>(null);

  // ── Carga ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqs, prjs, users, teamsRaw] = await Promise.all([
        getRequests({}),
        getProjects(),
        apiClient.get<AppUser[]>("/appusers"),
        apiClient.get<Team[]>("/teams"),
      ]);
      setRequests(reqs);
      setFullProjects(prjs);
      setProjects(prjs.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      setAppUsers(users);
      setTeams(teamsRaw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando solicitudes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Actualizar solicitud seleccionada tras refresh ─────
  useEffect(() => {
    if (selected) {
      const updated = requests.find(r => r.id === selected.id);
      if (updated) setSelected(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests]);

  // ── KPIs ─────────────────────────────────────────────
  const kpis = useMemo(() => {
    // Siempre filtrar KPIs por año seleccionado
    const yearReqs = requests.filter(r => r.year === selectedYear);
    const total = yearReqs.length;
    const byStatus = REQUEST_STATUS_OPTIONS.reduce<Record<string, number>>((acc, s) => {
      acc[s] = yearReqs.filter(r => r.status === s).length;
      return acc;
    }, {});
    return { total, ...byStatus };
  }, [requests, selectedYear]);

  // ── Filtrado client-side ───────────────────────────────
  const displayed = useMemo(() => {
    let items = requests.slice();
    // SCOPE ANUAL: filtrar por año seleccionado (regla DataScope/RequestsInScope)
    items = items.filter(r => r.year === selectedYear);
    // Scope por rol (ya viene desde el server, pero reforzamos client-side)
    if (!canViewAll) {
      items = items.filter(r =>
        r.requestedByUserId === effectiveUser.id ||
        (effectiveUser.teamIds ?? []).includes(r.requestedByTeamId ?? ""),
      );
    }

    // Filtros de UI
    if (filters.status)   items = items.filter(r => r.status === filters.status);
    if (filters.type)     items = items.filter(r => r.type === filters.type);
    if (filters.priority) items = items.filter(r => r.priority === filters.priority);
    if (filters.query)    items = items.filter(r =>
      r.title.toLowerCase().includes((filters.query ?? "").toLowerCase()) ||
      r.description.toLowerCase().includes((filters.query ?? "").toLowerCase()),
    );
    if (filters.mine)     items = items.filter(r => r.requestedByUserId === effectiveUser.id);

    // KPI chip filter (sobrescribe el filtro de status)
    if (kpiStatus && !filters.status) {
      items = items.filter(r => r.status === kpiStatus);
    }

    return items;
  }, [requests, filters, kpiStatus, canViewAll, effectiveUser, selectedYear]);

  // ── Helpers UI ────────────────────────────────────────
  const handleKpiClick = (status: string) => {
    setKpiStatus(prev => prev === status ? null : status);
    setFilters(f => ({ ...f, status: "" }));
  };

  const handleRefresh = useCallback(async () => {
    const reqs = await getRequests({});
    setRequests(reqs);
    if (selected) {
      const updated = reqs.find((r: Request) => r.id === selected.id);
      setSelected(updated ?? null);
    }
  }, [selected]);

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{
      padding: `${spacing[6]}px ${spacing[8]}px`,
      fontFamily: "'Segoe UI', sans-serif",
      minHeight: "100%",
      background: color.surfaceAlt,
    }}>
      {/* ── PageHeader ── */}
      <PageHeader
        icon={<Inbox size={20} color={color.primary} />}
        title="Solicitudes"
        subtitle="Entrada de demanda — IT revisa y convierte en tareas"
        actions={
          <div style={{ display: "flex", gap: spacing[3] }}>
            {canCreate && (
              <Button variant="primary" icon={<Plus size={14} />} onClick={() => setShowNew(true)}>
                Nueva solicitud
              </Button>
            )}
            <Button variant="ghost" icon={<RefreshCw size={14} />} onClick={() => void load()}>
              Refrescar
            </Button>
          </div>
        }
      />

      {/* ── Breadcrumb global ── */}
      {(() => {
        const areaName    = selectedAreaId
          ? (areas.find(a => a.id === selectedAreaId)?.name ?? selectedAreaId)
          : "Todas las áreas";
        const projectName = selectedProjectId
          ? (projectsInScope.find(p => p.id === selectedProjectId)?.name ?? selectedProjectId)
          : "Todos los proyectos";
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginBottom: spacing[4],
            padding: `${spacing[2]}px ${spacing[3]}px`,
            background: color.surface, border: `1px solid ${color.border}`,
            borderRadius: radius.sm,
            fontSize: font.size.sm, color: color.textSecondary,
          }}>
            <CalendarDays size={13} />
            <span style={{ fontWeight: 700, color: color.text }}>{selectedYear}</span>
            <span>·</span>
            <span>{areaName}</span>
            <span>·</span>
            <span>{projectName}</span>
          </div>
        );
      })()}

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          marginBottom: spacing[5],
          padding: `${spacing[3]}px ${spacing[4]}px`,
          background: color.dangerBg,
          border: `1px solid ${color.dangerBorder}`,
          borderRadius: radius.sm,
          color: color.danger,
          fontSize: font.size.sm,
        }}>
          {error}
        </div>
      )}

      {/* ── KPI strip ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[3], marginBottom: spacing[5] }}>
        <KpiCard
          label="Total"
          value={kpis.total}
          accent={color.textSecondary}
          active={kpiStatus === null && !filters.status}
          onClick={() => { setKpiStatus(null); setFilters(f => ({ ...f, status: "" })); }}
        />
        {REQUEST_STATUS_OPTIONS.map(s => (
          <KpiCard
            key={s}
            label={s}
            value={(kpis as Record<string, number>)[s] ?? 0}
            accent={REQUEST_STATUS_COLORS[s] ?? color.primary}
            active={kpiStatus === s}
            onClick={() => handleKpiClick(s)}
          />
        ))}
      </div>

      {/* ── Filtros ── */}
      <RequestsFilters
        filters={filters}
        onChange={f => { setFilters(f); setKpiStatus(null); }}
        totalVisible={displayed.length}
        canViewAll={canViewAll}
      />

      {/* ── Loading ── */}
      {loading && (
        <div style={{
          padding: "40px 0", textAlign: "center",
          color: color.textSecondary, fontSize: font.size.sm,
        }}>
          Cargando solicitudes…
        </div>
      )}

      {/* ── Tabla ── */}
      {!loading && displayed.length === 0 && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "60px 24px", gap: 10, color: color.textSecondary,
          fontFamily: "'Segoe UI', sans-serif", textAlign: "center",
        }}>
          <span style={{ fontSize: 36 }}>📅</span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: color.text }}>
            Sin solicitudes en {selectedYear}
          </p>
          <p style={{ margin: 0, fontSize: 12 }}>
            No hay solicitudes registradas para el año seleccionado.
            Cambia el año en el <strong>Ámbito</strong> o crea una nueva solicitud.
          </p>
        </div>
      )}
      {!loading && displayed.length > 0 && (
        <RequestsTable
          requests={displayed}
          appUsers={appUsers}
          projects={projects}
          teams={teams}
          onSelect={r => setSelected(r)}
        />
      )}

      {/* ── Drawer de detalle ── */}
      {selected && (
        <RequestDrawer
          request={selected}
          appUsers={appUsers}
          teams={teams}
          projects={projects}
          currentUser={effectiveUser}
          roles={roles}
          onClose={() => setSelected(null)}
          onRefresh={() => void handleRefresh()}
          onConvert={() => setShowConvert(true)}
        />
      )}

      {/* ── Modal nueva solicitud ── */}
      {showNew && (
        <NewRequestModal
          currentUser={effectiveUser}
          teams={teams}
          allProjects={fullProjects}
          selectedYear={selectedYear}
          onCreated={() => { setShowNew(false); void load(); }}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* ── Modal convertir en tarea ── */}
      {showConvert && selected && (
        <ConvertToWorkItemModal
          request={selected}
          allProjects={fullProjects}
          selectedYear={selectedYear}
          appUsers={appUsers}
          teams={teams}
          onConverted={() => {
            setShowConvert(false);
            void handleRefresh();
          }}
          onClose={() => setShowConvert(false)}
        />
      )}
    </div>
  );
};
