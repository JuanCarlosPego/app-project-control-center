// ─────────────────────────────────────────────────────────
//  src/screens/backlog/components/BacklogFilters.tsx
//  Header + toggle de fases + búsqueda pro del Backlog.
//  Año / Área / Proyecto vienen del contexto global (NO se repiten aquí).
//
//  Fases:
//    backlog    → st-new, st-ref  (planificación)
//    execution  → st-prog, st-blk, st-rft, st-test, st-acc  (en Kanban)
//    closed     → st-cls  (histórico)
//    all        → todos los estados
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search, Plus, List, Layers, X, AlertTriangle, Clock, UserCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { AppRole } from "../../../types/domain";

export type BacklogView = "flat" | "grouped";

/** Fase de ciclo de vida de la tarea (usada como filtro principal) */
export type BacklogPhase = "backlog" | "execution" | "closed" | "all";

/** Estados por fase */
export const PHASE_STATES: Record<BacklogPhase, string[]> = {
  backlog:   ["st-new", "st-ref"],
  execution: ["st-prog", "st-blk", "st-rft", "st-test", "st-acc"],
  closed:    ["st-cls"],
  all:       [],   // vacío = sin filtro de estado
};

export interface BacklogFilterState {
  phase: BacklogPhase;
  assignedToRole: string;
  priority: string;
  query: string;
  onlyBlocked: boolean;
  onlyDueSoon: boolean;
  onlyAssignedToMe: boolean;
  onlyMyTeam: boolean;
  onlyUnassigned: boolean;
}

export const EMPTY_BACKLOG_FILTERS: BacklogFilterState = {
  phase: "backlog",
  assignedToRole: "",
  priority: "",
  query: "",
  onlyBlocked: false,
  onlyDueSoon: false,
  onlyAssignedToMe: false,
  onlyMyTeam: false,
  onlyUnassigned: false,
};

interface Props {
  filters: BacklogFilterState;
  onChange: (f: BacklogFilterState) => void;
  view: BacklogView;
  onViewChange: (v: BacklogView) => void;
  /** Solo IT AirEuropa + Admin pueden crear WorkItems */
  canCreate: boolean;
  /** Proveedor/Usuario: pueden solicitar pero no crear WorkItems */
  canRequestOnly?: boolean;
  /** Permiso RBAC REQUEST_CREATE para mostrar botón Nueva solicitud */
  canCreateRequest?: boolean;
  onNew: () => void;
  totalVisible: number;
}

const ROLES: AppRole[] = ["IT AirEuropa", "Proveedor", "Usuario"];
const PRIORITIES = ["Alta", "Media", "Baja"];

// ── Estilos compartidos ───────────────────────────────────
const SEL: React.CSSProperties = {
  padding: "5px 8px", border: "1px solid #C8C6C4", borderRadius: 5,
  fontSize: 12, background: "#fff", color: "#201F1E",
  cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
  appearance: "auto",
};

// ── Chip de toggle rápido ─────────────────────────────────
const Chip: React.FC<{
  active: boolean; onClick: () => void; children: React.ReactNode; danger?: boolean;
}> = ({ active, onClick, children, danger }) => {
  const ac = danger ? "#D13438" : "#0078D4";
  const bg = danger ? "#FDE7E9" : "#EFF6FC";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: active ? 600 : 400,
        border: `1px solid ${active ? ac : "#EDEBE9"}`,
        background: active ? bg : "#F3F2F1",
        color: active ? ac : "#605E5C",
        cursor: "pointer", transition: "all 120ms",
        fontFamily: "'Segoe UI', sans-serif", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
};

// ── Definición de fases para el selector ─────────────────
const PHASES: { id: BacklogPhase; label: string; dot: string; title: string }[] = [
  { id: "backlog",   label: "Backlog",       dot: "#0078D4", title: "Nuevo + Refinamiento (planificación)" },
  { id: "execution", label: "En ejecución",  dot: "#107C10", title: "En curso, Bloqueado, Listo para pruebas, En pruebas, Aceptado (visible en Kanban)" },
  { id: "closed",    label: "Cerrado",       dot: "#8A8886", title: "Historial de tareas cerradas" },
  { id: "all",       label: "Todo",          dot: "#605E5C", title: "Todos los estados sin filtrar" },
];

export const BacklogFilters: React.FC<Props> = ({
  filters, onChange, view, onViewChange,
  canCreate, canRequestOnly, canCreateRequest, onNew, totalVisible,
}) => {
  const navigate = useNavigate();
  const set = <K extends keyof BacklogFilterState>(k: K, v: BacklogFilterState[K]) =>
    onChange({ ...filters, [k]: v });

  const hasActiveFilter =
    !!filters.assignedToRole || !!filters.priority || !!filters.query ||
    filters.onlyBlocked || filters.onlyDueSoon ||
    filters.onlyAssignedToMe || filters.onlyMyTeam || filters.onlyUnassigned;

  const activePhase = PHASES.find((p) => p.id === filters.phase) ?? PHASES[0];

  return (
    <div style={{
      background: "#fff", border: "1px solid #EDEBE9", borderRadius: 8,
      marginBottom: 16, fontFamily: "'Segoe UI', sans-serif",
      overflow: "hidden",
    }}>
      {/* ── Fila 1: Título + fase + acciones ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 16px 10px", gap: 16, flexWrap: "wrap",
      }}>
        {/* Título */}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#201F1E" }}>
            Backlog de Tareas
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8A8886" }}>
            <span style={{
              display: "inline-block", width: 8, height: 8, borderRadius: "50%",
              background: activePhase.dot, marginRight: 5, verticalAlign: "middle",
            }} />
            {activePhase.label} · {totalVisible} {totalVisible === 1 ? "tarea" : "tareas"}
            {hasActiveFilter && " · filtros activos"}
          </p>
        </div>

        {/* ── Selector de fase ── */}
        <div style={{
          display: "flex", border: "1px solid #EDEBE9", borderRadius: 6,
          overflow: "hidden", flexShrink: 0,
        }}>
          {PHASES.map((ph) => {
            const isActive = filters.phase === ph.id;
            return (
              <button
                key={ph.id}
                title={ph.title}
                onClick={() => set("phase", ph.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "6px 12px", border: "none", cursor: "pointer",
                  background: isActive ? ph.dot : "#fff",
                  color: isActive ? "#fff" : "#605E5C",
                  fontSize: 11, fontWeight: isActive ? 700 : 400,
                  fontFamily: "'Segoe UI', sans-serif",
                  transition: "all 130ms", whiteSpace: "nowrap",
                  borderRight: "1px solid #EDEBE9",
                }}
              >
                <span style={{
                  display: "inline-block", width: 7, height: 7, borderRadius: "50%",
                  background: isActive ? "#ffffff88" : ph.dot,
                  flexShrink: 0,
                }} />
                {ph.label}
              </button>
            );
          })}
        </div>

        {/* ── Acciones (Vista + Crear) ── */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
          {/* Toggle vista flat/grouped */}
          <div style={{ display: "flex", border: "1px solid #EDEBE9", borderRadius: 5, overflow: "hidden" }}>
            {(["flat", "grouped"] as BacklogView[]).map((v) => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                title={v === "flat" ? "Lista plana" : "Agrupado por proyecto"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 30, height: 28,
                  background: view === v ? "#0078D4" : "#fff",
                  color: view === v ? "#fff" : "#605E5C",
                  border: "none", cursor: "pointer", transition: "background 150ms",
                }}
              >
                {v === "flat" ? <List size={13} /> : <Layers size={13} />}
              </button>
            ))}
          </div>

          {/* IT/Admin: crear WorkItem */}
          {canCreate && (
            <button
              onClick={onNew}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "7px 14px", borderRadius: 5, border: "none",
                background: "#0078D4", color: "#fff",
                fontSize: 12, fontWeight: 600,
                fontFamily: "'Segoe UI', sans-serif", cursor: "pointer",
                transition: "background 150ms", whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#006CBE"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0078D4"; }}
            >
              <Plus size={13} /> Nueva tarea
            </button>
          )}

          {/* Proveedor/Usuario: solo solicitudes */}
          {canRequestOnly && canCreateRequest && !canCreate && (
            <button
              onClick={() => navigate("/requests")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "7px 14px", borderRadius: 5,
                border: "1px solid #0078D4", background: "#fff",
                color: "#0078D4",
                fontSize: 12, fontWeight: 600,
                fontFamily: "'Segoe UI', sans-serif", cursor: "pointer",
                transition: "background 150ms", whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E8F4FD"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
            >
              <Plus size={13} /> Nueva solicitud
            </button>
          )}
        </div>
      </div>

      {/* ── Fila 2: Búsqueda pro + filtros ── */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
        padding: "8px 16px 12px", borderTop: "1px solid #F3F2F1",
      }}>
        {/* Búsqueda libre — busca en título, código, tags, proyecto, usuario, team */}
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
          <Search size={13} style={{
            position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
            color: "#8A8886", pointerEvents: "none",
          }} />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => set("query", e.target.value)}
            placeholder="Buscar título, código, tags, proyecto, usuario…"
            style={{
              ...SEL, paddingLeft: 28, paddingRight: filters.query ? 28 : 8,
              width: "100%", boxSizing: "border-box",
            }}
          />
          {filters.query && (
            <button
              onClick={() => set("query", "")}
              style={{
                position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
                border: "none", background: "transparent", cursor: "pointer",
                color: "#8A8886", display: "flex", padding: 0,
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filtro rol asignado */}
        <select
          value={filters.assignedToRole}
          onChange={(e) => set("assignedToRole", e.target.value)}
          style={{ ...SEL, color: filters.assignedToRole ? "#0078D4" : "#605E5C" }}
        >
          <option value="">Rol: Todos</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>

        {/* Filtro prioridad */}
        <select
          value={filters.priority}
          onChange={(e) => set("priority", e.target.value)}
          style={{ ...SEL, color: filters.priority ? "#0078D4" : "#605E5C" }}
        >
          <option value="">Prioridad: Todas</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* Separador */}
        <div style={{ width: 1, height: 22, background: "#EDEBE9", flexShrink: 0 }} />

        {/* Chips rápidos */}
        <Chip active={filters.onlyBlocked} onClick={() => set("onlyBlocked", !filters.onlyBlocked)} danger>
          <AlertTriangle size={11} /> Bloqueadas
        </Chip>

        <Chip active={filters.onlyDueSoon} onClick={() => set("onlyDueSoon", !filters.onlyDueSoon)} danger>
          <Clock size={11} /> Vencen ≤14d
        </Chip>

        <Chip active={filters.onlyAssignedToMe} onClick={() => set("onlyAssignedToMe", !filters.onlyAssignedToMe)}>
          <UserCheck size={11} /> Asignadas a mí
        </Chip>

        <Chip active={filters.onlyMyTeam} onClick={() => set("onlyMyTeam", !filters.onlyMyTeam)}>
          <Users size={11} /> Mi Team
        </Chip>

        <Chip active={filters.onlyUnassigned} onClick={() => set("onlyUnassigned", !filters.onlyUnassigned)}>
          Sin asignar
        </Chip>

        {/* Limpiar filtros de búsqueda (no limpia la fase) */}
        {hasActiveFilter && (
          <button
            onClick={() => onChange({
              ...filters,
              assignedToRole: "", priority: "", query: "",
              onlyBlocked: false, onlyDueSoon: false,
              onlyAssignedToMe: false, onlyMyTeam: false, onlyUnassigned: false,
            })}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "5px 10px", border: "1px solid #EDEBE9", borderRadius: 5,
              background: "transparent", color: "#D13438", cursor: "pointer",
              fontSize: 11, fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            <X size={11} /> Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
};
