// ─────────────────────────────────────────────────────────
//  src/screens/kanban/components/KanbanFilters.tsx
//  Buscador + filtros rápidos del board
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search, X, Layers, Users, AlertTriangle, Calendar, UserCheck, Hourglass, Building2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AppRole, Team } from "../../../types/domain";

export interface KanbanFilterState {
  search: string;
  roleFilter: AppRole | "Todos";
  typeFilter: string;
  areaFilter: string;              // teamId del área (team.type="Area"); "" = todas
  swimlanes: boolean;
  showClosed: boolean;
  onlyBlocked: boolean;
  onlyDueSoon: boolean;              // vencen en ≤14 días
  onlyAssignedToMe: boolean;         // assignedToUserId === currentUser.id
  onlyWaitingThirdParties: boolean;  // requestedByUserId === currentUser.id AND assignedToUserId !== currentUser.id
}

interface Props {
  filters: KanbanFilterState;
  onChange: (f: KanbanFilterState) => void;
  currentUserRoles: AppRole[];
  /** Equipos de tipo Area disponibles para el filtro área */
  areaTeams?: Team[];
}

const Btn: React.FC<{
  active: boolean; onClick: () => void; children: React.ReactNode;
  danger?: boolean;
}> = ({ active, onClick, children, danger }) => {
  const activeColor = danger ? "#D13438" : "#0078D4";
  const activeBg    = danger ? "#FDE7E9" : "#EFF6FC";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px",
        borderRadius: 6, cursor: "pointer",
        border: `1px solid ${active ? activeColor : "#EDEBE9"}`,
        background: active ? activeBg : "#fff",
        color: active ? activeColor : "#605E5C",
        fontSize: 12, fontWeight: active ? 600 : 400,
        fontFamily: "'Segoe UI', sans-serif", transition: "all 140ms",
      }}
    >
      {children}
    </button>
  );
};

const ROLES: Array<AppRole | "Todos"> = ["Todos", "IT AirEuropa", "Proveedor", "Usuario"];
const TYPES = ["Todos", "Feature", "Bug", "TechDebt", "Spike"];

export const KanbanFilters: React.FC<Props> = ({ filters, onChange, currentUserRoles, areaTeams = [] }) => {
  const navigate = useNavigate();
  const set = (partial: Partial<KanbanFilterState>) =>
    onChange({ ...filters, ...partial });

  const isAdmin = currentUserRoles.includes("Admin") || currentUserRoles.includes("IT AirEuropa");

  const hasActiveFilter =
    filters.onlyBlocked || filters.onlyDueSoon ||
    filters.onlyAssignedToMe || filters.onlyWaitingThirdParties ||
    filters.roleFilter !== "Todos" || filters.typeFilter !== "Todos" ||
    !!filters.areaFilter ||
    !filters.showClosed;

  return (
    <div style={{
      padding: "8px 16px", display: "flex", alignItems: "center",
      gap: 8, flexWrap: "wrap", borderBottom: "1px solid #EDEBE9",
      background: "#FAFAFA",
    }}>
      {/* ← Ver Backlog */}
      <button
        onClick={() => navigate("/backlog")}
        title="Ir al Backlog (planificación)"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "6px 10px", borderRadius: 6, cursor: "pointer",
          border: "1px solid #EDEBE9", background: "#fff",
          color: "#0078D4", fontSize: 12, fontWeight: 600,
          fontFamily: "'Segoe UI', sans-serif", flexShrink: 0,
          transition: "background 120ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#EFF6FC")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
      >
        <ArrowLeft size={12} /> Backlog
      </button>

      {/* Separador */}
      <div style={{ width: 1, height: 22, background: "#EDEBE9" }} />
      <div style={{ position: "relative", flex: "0 0 220px" }}>
        <Search size={13} color="#A19F9D" style={{
          position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none",
        }} />
        <input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Buscar elemento..."
          style={{
            width: "100%", boxSizing: "border-box", padding: "7px 28px 7px 28px",
            border: "1px solid #EDEBE9", borderRadius: 6, fontSize: 12,
            color: "#201F1E", background: "#fff",
            fontFamily: "'Segoe UI', sans-serif", outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#0078D4")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#EDEBE9")}
        />
        {filters.search && (
          <button
            onClick={() => set({ search: "" })}
            style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              border: "none", background: "transparent", cursor: "pointer", color: "#A19F9D",
              display: "flex",
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Separador */}
      <div style={{ width: 1, height: 22, background: "#EDEBE9" }} />

      {/* Filtro por rol */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Users size={12} color="#605E5C" />
        <select
          value={filters.roleFilter}
          onChange={(e) => set({ roleFilter: e.target.value as AppRole | "Todos" })}
          style={{
            border: "1px solid #EDEBE9", borderRadius: 6, padding: "6px 10px",
            fontSize: 12, color: "#201F1E", background: "#fff",
            fontFamily: "'Segoe UI', sans-serif", cursor: "pointer",
          }}
        >
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Filtro por tipo */}
      <select
        value={filters.typeFilter}
        onChange={(e) => set({ typeFilter: e.target.value })}
        style={{
          border: "1px solid #EDEBE9", borderRadius: 6, padding: "6px 10px",
          fontSize: 12, color: "#201F1E", background: "#fff",
          fontFamily: "'Segoe UI', sans-serif", cursor: "pointer",
        }}
      >
        {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>

      {/* Filtro por área (team.type=Area) */}
      {areaTeams.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Building2 size={12} color="#605E5C" />
          <select
            value={filters.areaFilter}
            onChange={(e) => set({ areaFilter: e.target.value })}
            style={{
              border: "1px solid #EDEBE9", borderRadius: 6, padding: "6px 10px",
              fontSize: 12, color: "#201F1E", background: "#fff",
              fontFamily: "'Segoe UI', sans-serif", cursor: "pointer",
              borderColor: filters.areaFilter ? "#0078D4" : undefined,
            }}
          >
            <option value="">Área: Todas</option>
            {areaTeams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Separador */}
      <div style={{ width: 1, height: 22, background: "#EDEBE9" }} />

      {/* Filtros rápidos */}
      <Btn
        active={filters.onlyBlocked}
        onClick={() => set({ onlyBlocked: !filters.onlyBlocked })}
        danger
      >
        <AlertTriangle size={12} /> Bloqueados
      </Btn>

      <Btn
        active={filters.onlyDueSoon}
        onClick={() => set({ onlyDueSoon: !filters.onlyDueSoon })}
        danger
      >
        <Calendar size={12} /> Vencen ≤14d
      </Btn>

      <span title="Tareas donde tú eres el responsable asignado">
        <Btn
          active={filters.onlyAssignedToMe}
          onClick={() => set({ onlyAssignedToMe: !filters.onlyAssignedToMe })}
        >
          <UserCheck size={12} /> Asignadas a mí
        </Btn>
      </span>

      <span title="Tareas que pediste tú (o tu proyecto) pero están asignadas a otra persona">
        <Btn
          active={filters.onlyWaitingThirdParties}
          onClick={() => set({ onlyWaitingThirdParties: !filters.onlyWaitingThirdParties })}
        >
          <Hourglass size={12} /> Esperando a terceros
        </Btn>
      </span>

      {/* Separador */}
      <div style={{ width: 1, height: 22, background: "#EDEBE9" }} />

      {/* Toggle swimlanes (solo IT/Admin) */}
      {isAdmin && (
        <Btn active={filters.swimlanes} onClick={() => set({ swimlanes: !filters.swimlanes })}>
          <Layers size={12} /> Swimlanes
        </Btn>
      )}

      {/* Toggle mostrar cerrados */}
      <Btn active={filters.showClosed} onClick={() => set({ showClosed: !filters.showClosed })}>
        Mostrar cerrados
      </Btn>

      {/* Limpiar filtros */}
      {hasActiveFilter && (
        <button
          onClick={() => set({
            roleFilter: "Todos", typeFilter: "Todos", areaFilter: "",
            showClosed: true, onlyBlocked: false,
            onlyDueSoon: false,
            onlyAssignedToMe: false, onlyWaitingThirdParties: false,
          })}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "5px 10px", borderRadius: 6, cursor: "pointer",
            border: "1px solid #EDEBE9", background: "#fff",
            color: "#A19F9D", fontSize: 11,
            fontFamily: "'Segoe UI', sans-serif",
          }}
        >
          <X size={11} /> Limpiar
        </button>
      )}
    </div>
  );
};
