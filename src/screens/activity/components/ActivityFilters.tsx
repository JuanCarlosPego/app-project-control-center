// ─────────────────────────────────────────────────────────
//  src/screens/activity/components/ActivityFilters.tsx
//  Barra de filtros de la pantalla Actividad.
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search, X, Calendar } from "lucide-react";
import { color, font, radius, spacing, shadow, transition } from "../../../components/ui/tokens";
import { ACTION_OPTIONS, ENTITY_TYPE_LABELS } from "../../../services/activityService";
import type { Project } from "../../../types/domain";

// ── Tipos ─────────────────────────────────────────────────
export interface ActivityFilterState {
  entityType:  string;
  action:      string;
  whoRole:     string;
  from:        string;
  to:          string;
  query:       string;
  onlyMine:    boolean;
  onlyBlocked: boolean;
  onlyState:   boolean;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilterState = {
  entityType: "", action: "", whoRole: "",
  from: "", to: "", query: "", onlyMine: false, onlyBlocked: false, onlyState: false,
};

interface ActivityFiltersProps {
  filters:   ActivityFilterState;
  onChange:  (f: ActivityFilterState) => void;
  onReset?:  () => void;
  canSeeRole?: boolean;
}

const ROLES = ["Admin", "IT AirEuropa", "Proveedor", "Usuario", "Invitado"];

const ENTITY_OPTS = [
  { value: "",          label: "Todas las entidades" },
  { value: "WorkItem",  label: ENTITY_TYPE_LABELS["WorkItem"] },
  { value: "Project",   label: ENTITY_TYPE_LABELS["Project"] },
  { value: "Evidence",  label: ENTITY_TYPE_LABELS["Evidence"] },
  { value: "Settings",  label: ENTITY_TYPE_LABELS["Settings"] },
  { value: "RBAC",      label: ENTITY_TYPE_LABELS["RBAC"] },
];

const ACTION_OPTS = [{ value: "", label: "Todas las acciones" }, ...ACTION_OPTIONS];
const ROLE_OPTS   = [{ value: "", label: "Todos los roles" }, ...ROLES.map((r) => ({ value: r, label: r }))];

// ── Helper: ¿hay filtros activos? ──────────────────────────
export function hasActiveFilters(f: ActivityFilterState): boolean {
  return !!(f.entityType || f.action || f.whoRole || f.from || f.to || f.query || f.onlyMine || f.onlyBlocked || f.onlyState);
}

// ── ActivityFilters ────────────────────────────────────────
export const ActivityFilters: React.FC<ActivityFiltersProps> = ({
  filters, onChange, onReset, canSeeRole = true,
}) => {
  const set = <K extends keyof ActivityFilterState>(k: K, v: ActivityFilterState[K]) =>
    onChange({ ...filters, [k]: v });

  const handleReset = () => onReset ? onReset() : onChange(EMPTY_ACTIVITY_FILTERS);

  const active = hasActiveFilters(filters);

  return (
    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      padding: `${spacing[5]}px ${spacing[6]}px`,
      marginBottom: spacing[5],
      display: "flex",
      flexDirection: "column",
      gap: spacing[4],
      fontFamily: font.family,
    }}>
      {/* Row 1: búsqueda + selects principales */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: spacing[4], flexWrap: "wrap" }}>

        {/* Búsqueda texto */}
        <SearchBox
          value={filters.query}
          onChange={(v) => set("query", v)}
          placeholder="Buscar por título, clave Jira, nota, usuario…"
          width={260}
        />

        {/* Entidad */}
        <LabeledSelect
          label="Entidad"
          value={filters.entityType}
          onChange={(v) => set("entityType", v)}
          options={ENTITY_OPTS}
          minWidth={150}
        />

        {/* Acción */}
        <LabeledSelect
          label="Acción"
          value={filters.action}
          onChange={(v) => set("action", v)}
          options={ACTION_OPTS}
          minWidth={170}
        />

        {/* Rol (opcional) */}
        {canSeeRole && (
          <LabeledSelect
            label="Rol"
            value={filters.whoRole}
            onChange={(v) => set("whoRole", v)}
            options={ROLE_OPTS}
            minWidth={140}
          />
        )}

        <Divider />

        {/* Rango fechas */}
        <DateRange
          from={filters.from}
          to={filters.to}
          onFromChange={(v) => set("from", v)}
          onToChange={(v) => set("to", v)}
        />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Reset */}
        {active && (
          <button
            onClick={handleReset}
            style={{
              display: "inline-flex", alignItems: "center", gap: spacing[2],
              padding: `${spacing[2]}px ${spacing[4]}px`,
              border: `1px solid ${color.border}`,
              borderRadius: radius.sm, background: color.surfaceAlt,
              color: color.textSecondary, fontSize: font.size.sm,
              fontWeight: font.weight.medium, fontFamily: font.family,
              cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            <X size={12} />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Row 2: toggles */}
      <div style={{ display: "flex", alignItems: "center", gap: spacing[5], flexWrap: "wrap" }}>
        <ToggleChip
          label="Solo mi actividad"
          active={filters.onlyMine}
          onClick={() => set("onlyMine", !filters.onlyMine)}
        />
        <ToggleChip
          label="Solo bloqueos"
          active={filters.onlyBlocked}
          color={color.danger}
          onClick={() => set("onlyBlocked", !filters.onlyBlocked)}
        />
        <ToggleChip
          label="Solo cambios de estado"
          active={filters.onlyState}
          color={color.primary}
          onClick={() => set("onlyState", !filters.onlyState)}
        />
      </div>
    </div>
  );
};

// ── SearchBox ─────────────────────────────────────────────
const SearchBox: React.FC<{
  value: string; onChange: (v: string) => void;
  placeholder?: string; width?: number;
}> = ({ value, onChange, placeholder = "Buscar…", width = 220 }) => {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <Search size={13} style={{ position: "absolute", left: spacing[4], color: focused ? color.primary : color.textMuted, pointerEvents: "none" }} />
      <input
        type="search" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          paddingLeft: 30, paddingRight: value ? 28 : spacing[4],
          paddingTop: spacing[3], paddingBottom: spacing[3],
          border: `1px solid ${focused ? color.primary : color.border}`,
          borderRadius: radius.sm, fontSize: font.size.md,
          color: color.text, background: color.surface,
          outline: "none", width, fontFamily: font.family,
          transition: `border-color ${transition.fast}`,
          boxSizing: "border-box",
        }}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Limpiar búsqueda"
          style={{ position: "absolute", right: spacing[3], background: "none", border: "none", cursor: "pointer", color: color.textMuted, display: "flex", padding: 0 }}>
          <X size={12} />
        </button>
      )}
    </div>
  );
};

// ── LabeledSelect ─────────────────────────────────────────
const LabeledSelect: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; minWidth?: number;
}> = ({ label, value, onChange, options, minWidth = 140 }) => {
  const [focused, setFocused] = React.useState(false);
  const hasValue = !!value;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
      <label style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.textMuted }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          padding: `${spacing[3]}px ${spacing[6]}px ${spacing[3]}px ${spacing[4]}px`,
          border: `1px solid ${focused || hasValue ? color.primary : color.border}`,
          borderRadius: radius.sm, fontSize: font.size.md,
          color: hasValue ? color.text : color.textSecondary,
          background: color.surface, cursor: "pointer",
          outline: "none", fontFamily: font.family,
          minWidth, fontWeight: hasValue ? font.weight.semibold : font.weight.regular,
          transition: `border-color ${transition.fast}`,
        }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
};

// ── DateRange ─────────────────────────────────────────────
const DateRange: React.FC<{
  from: string; to: string;
  onFromChange: (v: string) => void; onToChange: (v: string) => void;
}> = ({ from, to, onFromChange, onToChange }) => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: spacing[2] }}>
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
      <label style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
        <Calendar size={11} /> Desde
      </label>
      <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} max={to || undefined}
        style={{ padding: `${spacing[3]}px ${spacing[4]}px`, border: `1px solid ${from ? color.primary : color.border}`, borderRadius: radius.sm, fontSize: font.size.md, color: from ? color.text : color.textSecondary, background: color.surface, outline: "none", fontFamily: font.family, cursor: "pointer" }}
      />
    </div>
    <span style={{ color: color.textMuted, fontSize: font.size.md, paddingBottom: spacing[3] }}>—</span>
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
      <label style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
        <Calendar size={11} /> Hasta
      </label>
      <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} min={from || undefined}
        style={{ padding: `${spacing[3]}px ${spacing[4]}px`, border: `1px solid ${to ? color.primary : color.border}`, borderRadius: radius.sm, fontSize: font.size.md, color: to ? color.text : color.textSecondary, background: color.surface, outline: "none", fontFamily: font.family, cursor: "pointer" }}
      />
    </div>
  </div>
);

// ── ToggleChip ────────────────────────────────────────────
const ToggleChip: React.FC<{
  label: string; active: boolean; onClick: () => void; color?: string;
}> = ({ label, active, onClick, color: c = color.primary }) => (
  <button onClick={onClick} aria-pressed={active}
    style={{
      display: "inline-flex", alignItems: "center", gap: spacing[2],
      padding: `${spacing[2]}px ${spacing[5]}px`,
      border: `1px solid ${active ? c : color.border}`,
      borderRadius: radius.full, background: active ? `${c}18` : "transparent",
      color: active ? c : color.textSecondary,
      fontSize: font.size.sm, fontWeight: active ? font.weight.semibold : font.weight.regular,
      fontFamily: font.family, cursor: "pointer",
      transition: `all ${transition.fast}`,
    }}>
    {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block" }} />}
    {label}
  </button>
);

// ── Divider ───────────────────────────────────────────────
const Divider: React.FC = () => (
  <div style={{ width: 1, height: 28, background: color.border, alignSelf: "flex-end", marginBottom: 1 }} />
);
