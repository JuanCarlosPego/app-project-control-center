// ─────────────────────────────────────────────────────────
//  src/screens/gantt/components/GanttFilters.tsx
//  Barra de filtros del Gantt
//  Año / Área / Proyecto vienen del contexto global; NO se repiten aquí.
// ─────────────────────────────────────────────────────────

import React from "react";
import { X, CalendarDays, ChevronDown, ChevronUp, UserCheck, Hourglass } from "lucide-react";
import type { Provider, State } from "../../../types/domain";
import type { ZoomLevel } from "../ganttUtils";

export type GanttGroupBy = "" | "role" | "area" | "assignedTo" | "team";

export interface GanttFilterState {
  stateIds: string[];
  assignedToRole: string;
  deliveryOwnerType: string;
  providerId: string;
  groupBy: GanttGroupBy;
  dateFrom: string;
  dateTo: string;
  zoom: ZoomLevel;
  showToday: boolean;
  onlyAssignedToMe:    boolean;
  onlyWaitingOnOthers: boolean;
}

export const EMPTY_GANTT_FILTERS: GanttFilterState = {
  stateIds: [],
  assignedToRole: "",
  deliveryOwnerType: "",
  providerId: "",
  groupBy: "",
  dateFrom: "",
  dateTo: "",
  zoom: "month",
  showToday: true,
  onlyAssignedToMe: false,
  onlyWaitingOnOthers: false,
};

interface Props {
  filters: GanttFilterState;
  onChange: (f: GanttFilterState) => void;
  providers: Provider[];
  states: State[];
  canEdit: boolean;
  canSeePersonal?: boolean;
  selectedYear: number;
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  hasGroups?: boolean;
  allGroupsCollapsed?: boolean;
}

// ── Selectores re-usables ─────────────────────────────────
const Select: React.FC<{
  label: string; value: string; disabled?: boolean;
  onChange: (v: string) => void; children: React.ReactNode;
}> = ({ label, value, disabled, onChange, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <label style={{ fontSize: 10, fontWeight: 600, color: "#8A8886", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </label>
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontFamily: "'Segoe UI', sans-serif", fontSize: 12, color: "#201F1E",
        border: "1px solid #EDEBE9", borderRadius: 4, padding: "4px 8px",
        background: disabled ? "#FAF9F8" : "#fff", cursor: disabled ? "not-allowed" : "pointer",
        height: 30, minWidth: 120,
      }}
    >
      {children}
    </select>
  </div>
);

const DateInput: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
}> = ({ label, value, onChange }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <label style={{ fontSize: 10, fontWeight: 600, color: "#8A8886", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </label>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontFamily: "'Segoe UI', sans-serif", fontSize: 12, color: "#201F1E",
        border: "1px solid #EDEBE9", borderRadius: 4, padding: "4px 8px",
        background: "#fff", height: 30, minWidth: 120,
      }}
    />
  </div>
);

// ── Multiselect de estados ────────────────────────────────
const StateMultiSelect: React.FC<{
  states: State[]; selected: string[]; onChange: (ids: string[]) => void;
}> = ({ states, selected, onChange }) => {
  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onChange(next);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: "#8A8886", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Estado
      </label>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 300 }}>
        {states.map((st) => {
          const active = selected.includes(st.id);
          return (
            <button
              key={st.id}
              onClick={() => toggle(st.id)}
              style={{
                padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 500,
                fontFamily: "'Segoe UI', sans-serif", cursor: "pointer",
                border: active ? "1.5px solid #0078D4" : "1px solid #EDEBE9",
                background: active ? "#EFF6FC" : "#F3F2F1",
                color: active ? "#0078D4" : "#605E5C",
                transition: "all 100ms",
              }}
            >
              {st.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── Segmented control (zoom) ──────────────────────────────
const ZoomToggle: React.FC<{
  value: ZoomLevel; onChange: (v: ZoomLevel) => void;
}> = ({ value, onChange }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <label style={{ fontSize: 10, fontWeight: 600, color: "#8A8886", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      Zoom
    </label>
    <div style={{ display: "flex", border: "1px solid #EDEBE9", borderRadius: 4, overflow: "hidden" }}>
      {(["month", "week"] as ZoomLevel[]).map((z) => {
        const active = value === z;
        return (
          <button
            key={z}
            onClick={() => onChange(z)}
            style={{
              padding: "4px 14px", border: "none", cursor: "pointer", fontSize: 12,
              fontFamily: "'Segoe UI', sans-serif", fontWeight: active ? 600 : 400,
              background: active ? "#0078D4" : "#fff",
              color: active ? "#fff" : "#323130",
              transition: "all 150ms",
            }}
          >
            {z === "month" ? "Mes" : "Semana"}
          </button>
        );
      })}
    </div>
  </div>
);

// ── GanttFilters ──────────────────────────────────────────
export const GanttFilters: React.FC<Props> = ({
  filters, onChange, providers, states, canSeePersonal,
  selectedYear, onCollapseAll, onExpandAll, hasGroups, allGroupsCollapsed,
}) => {
  const set = <K extends keyof GanttFilterState>(k: K, v: GanttFilterState[K]) =>
    onChange({ ...filters, [k]: v });

  const hasActive =
    filters.stateIds.length > 0 || filters.assignedToRole ||
    filters.deliveryOwnerType || filters.providerId || filters.groupBy ||
    filters.dateFrom || filters.dateTo;

  const reset = () => onChange({
    ...EMPTY_GANTT_FILTERS,
    zoom: filters.zoom,
    showToday: filters.showToday,
    dateFrom: `${selectedYear}-01-01`,
    dateTo: `${selectedYear}-12-31`,
  });

  // Shortcuts de rango de fecha
  const shortcuts: Array<{ label: string; from: string; to: string }> = [
    { label: "Año completo", from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` },
    { label: "Q1", from: `${selectedYear}-01-01`, to: `${selectedYear}-03-31` },
    { label: "Q2", from: `${selectedYear}-04-01`, to: `${selectedYear}-06-30` },
    { label: "Q3", from: `${selectedYear}-07-01`, to: `${selectedYear}-09-30` },
    { label: "Q4", from: `${selectedYear}-10-01`, to: `${selectedYear}-12-31` },
  ];

  const activeShortcut = shortcuts.find(
    (s) => s.from === filters.dateFrom && s.to === filters.dateTo,
  )?.label ?? null;

  return (
    <div style={{
      background: "#fff", border: "1px solid #EDEBE9", borderRadius: 8,
      padding: "12px 16px", marginBottom: 12,
    }}>
      {/* Fila 1: filtros propios del Gantt + zoom + hoy */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        {/* Asignado a rol */}
        <Select label="Asignado a" value={filters.assignedToRole} onChange={(v) => set("assignedToRole", v)}>
          <option value="">Todos los roles</option>
          <option value="IT AirEuropa">IT AirEuropa</option>
          <option value="Proveedor">Proveedor</option>
          <option value="Usuario">Usuario</option>
        </Select>

        {/* Ejecutor */}
        <Select label="Ejecutor" value={filters.deliveryOwnerType} onChange={(v) => {
          onChange({ ...filters, deliveryOwnerType: v, providerId: "" });
        }}>
          <option value="">Todos los ejecutores</option>
          <option value="IT">IT</option>
          <option value="Proveedor">Proveedor</option>
        </Select>

        {/* Proveedor (solo si ejecutor = Proveedor) */}
        {filters.deliveryOwnerType === "Proveedor" && (
          <Select label="Proveedor" value={filters.providerId} onChange={(v) => set("providerId", v)}>
            <option value="">Todos los proveedores</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        )}

        {/* Agrupar por */}
        <Select
          label="Agrupar por"
          value={filters.groupBy}
          onChange={(v) => set("groupBy", v as GanttGroupBy)}
        >
          <option value="">Sin agrupación</option>
          <option value="role">Rol (WI)</option>
          <option value="area">Área de negocio</option>
          <option value="assignedTo">Asignado a</option>
          <option value="team">Teams</option>
        </Select>

        {/* Colapsar / expandir todo — botón único que alterna la acción */}
        {hasGroups && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={{ fontSize: 10, color: "transparent" }}>_</label>
            <button
              onClick={allGroupsCollapsed ? onExpandAll : onCollapseAll}
              title={allGroupsCollapsed ? "Expandir todos los grupos" : "Colapsar todos los grupos"}
              style={{
                height: 30, padding: "0 12px", borderRadius: 4,
                border: "1px solid #EDEBE9", background: "#fff", cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, color: "#323130", fontFamily: "'Segoe UI', sans-serif",
                fontWeight: 500,
              }}
            >
              {allGroupsCollapsed
                ? <><ChevronDown size={11} /> Expandir todo</>  
                : <><ChevronUp   size={11} /> Colapsar todo</>}
            </button>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Zoom */}
        <ZoomToggle value={filters.zoom} onChange={(v) => set("zoom", v)} />

        {/* Toggle línea hoy */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: "#8A8886", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Línea Hoy
          </label>
          <button
            onClick={() => set("showToday", !filters.showToday)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4, height: 30,
              padding: "0 12px", borderRadius: 4, cursor: "pointer", fontSize: 12,
              fontFamily: "'Segoe UI', sans-serif", fontWeight: 500,
              border: "1px solid #EDEBE9",
              background: filters.showToday ? "#0078D4" : "#fff",
              color: filters.showToday ? "#fff" : "#605E5C",
              transition: "all 150ms",
            }}
          >
            <CalendarDays size={12} />
            {filters.showToday ? "Visible" : "Oculta"}
          </button>
        </div>

        {/* Limpiar filtros */}
        {hasActive && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={{ fontSize: 10, color: "transparent" }}>_</label>
            <button
              onClick={reset}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4, height: 30,
                padding: "0 12px", borderRadius: 4, cursor: "pointer", fontSize: 12,
                fontFamily: "'Segoe UI', sans-serif",
                border: "1px solid #EDEBE9", background: "#FAF9F8", color: "#A19F9D",
              }}
            >
              <X size={12} /> Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Fila 2: estado (multiselect) + fechas */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <StateMultiSelect
          states={states}
          selected={filters.stateIds}
          onChange={(ids) => set("stateIds", ids)}
        />

        {/* Separador visual */}
        <div style={{ width: 1, background: "#EDEBE9", alignSelf: "stretch", margin: "4px 0" }} />

        <DateInput label="Desde" value={filters.dateFrom} onChange={(v) => set("dateFrom", v)} />
        <DateInput label="Hasta" value={filters.dateTo}   onChange={(v) => set("dateTo", v)} />

        {/* Shortcuts de período */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: "#8A8886", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Período rápido
          </label>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {shortcuts.map((sc) => {
              const isActive = activeShortcut === sc.label;
              return (
                <button
                  key={sc.label}
                  onClick={() => onChange({ ...filters, dateFrom: sc.from, dateTo: sc.to })}
                  style={{
                    height: 30, padding: "0 10px", borderRadius: 4, cursor: "pointer",
                    fontSize: 11, fontFamily: "'Segoe UI', sans-serif",
                    border: isActive ? "1.5px solid #0078D4" : "1px solid #EDEBE9",
                    background: isActive ? "#EFF6FC" : "#fff",
                    color: isActive ? "#0078D4" : "#323130",
                    fontWeight: isActive ? 600 : 400,
                    transition: "all 100ms",
                  }}
                >
                  {sc.label}
                </button>
              );
            })}
          </div>
        </div>

        {(filters.dateFrom || filters.dateTo) && activeShortcut === null && (
          <button
            onClick={() => onChange({ ...filters, dateFrom: `${selectedYear}-01-01`, dateTo: `${selectedYear}-12-31` })}
            style={{
              alignSelf: "flex-end", height: 30, padding: "0 10px", borderRadius: 4,
              border: "1px solid #EDEBE9", background: "transparent", cursor: "pointer",
              fontSize: 11, color: "#A19F9D", fontFamily: "'Segoe UI', sans-serif",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <X size={11} /> borrar fechas
          </button>
        )}

        {/* Quick-filters personales */}
        {canSeePersonal && (
          <>
            <div style={{ width: 1, background: "#EDEBE9", alignSelf: "stretch", margin: "4px 0" }} />
            <button
              type="button"
              onClick={() => set("onlyAssignedToMe", !filters.onlyAssignedToMe)}
              title="WorkItems asignados a mí"
              style={{
                alignSelf: "flex-end", height: 30, padding: "0 10px", borderRadius: 4,
                display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11,
                fontFamily: "'Segoe UI', sans-serif", cursor: "pointer",
                border: `1px solid ${filters.onlyAssignedToMe ? "#0078D4" : "#EDEBE9"}`,
                background: filters.onlyAssignedToMe ? "#EFF6FC" : "#fff",
                color: filters.onlyAssignedToMe ? "#0078D4" : "#605E5C",
                fontWeight: filters.onlyAssignedToMe ? 600 : 400, transition: "all 150ms",
              }}
            >
              <UserCheck size={11} /> Asignadas a mí
            </button>
            <button
              type="button"
              onClick={() => set("onlyWaitingOnOthers", !filters.onlyWaitingOnOthers)}
              title="Épicas que solicíté yo pero asignadas a otro responsable"
              style={{
                alignSelf: "flex-end", height: 30, padding: "0 10px", borderRadius: 4,
                display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11,
                fontFamily: "'Segoe UI', sans-serif", cursor: "pointer",
                border: `1px solid ${filters.onlyWaitingOnOthers ? "#C8A600" : "#EDEBE9"}`,
                background: filters.onlyWaitingOnOthers ? "#FFF9E6" : "#fff",
                color: filters.onlyWaitingOnOthers ? "#C8A600" : "#605E5C",
                fontWeight: filters.onlyWaitingOnOthers ? 600 : 400, transition: "all 150ms",
              }}
            >
              <Hourglass size={11} /> Esperando a terceros
            </button>
          </>
        )}
      </div>
    </div>
  );
};
