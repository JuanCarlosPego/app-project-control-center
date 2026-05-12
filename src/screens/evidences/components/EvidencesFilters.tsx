// ─────────────────────────────────────────────────────────
//  src/screens/evidences/components/EvidencesFilters.tsx
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search, X } from "lucide-react";
import { color, font, radius, spacing, transition } from "../../../components/ui/tokens";
import { EVIDENCE_TYPE_OPTIONS } from "../../../services/evidenceService";
import type { Project, AppUser, BusinessArea } from "../../../types/domain";

// ── Tipos ─────────────────────────────────────────────────
export interface EvidenceFilterState {
  projectId: string;
  areaId:    string;
  type:      string;
  createdBy: string;
  query:     string;
  onlyMine:  boolean;
}

export const EMPTY_EVIDENCE_FILTERS: EvidenceFilterState = {
  projectId: "", areaId: "", type: "", createdBy: "", query: "", onlyMine: false,
};

export function hasActiveEvidenceFilters(f: EvidenceFilterState): boolean {
  return !!(f.projectId || f.areaId || f.type || f.createdBy || f.query || f.onlyMine);
}

interface EvidencesFiltersProps {
  filters:   EvidenceFilterState;
  onChange:  (f: EvidenceFilterState) => void;
  projects:  Project[];
  areas:     BusinessArea[];
  users:     AppUser[];
  onReset:   () => void;
}

const TYPE_OPTS = [{ value: "", label: "Todos los tipos" }, ...EVIDENCE_TYPE_OPTIONS];

// ── EvidencesFilters ──────────────────────────────────────
export const EvidencesFilters: React.FC<EvidencesFiltersProps> = ({
  filters, onChange, projects, areas, users, onReset,
}) => {
  const set = <K extends keyof EvidenceFilterState>(k: K, v: EvidenceFilterState[K]) =>
    onChange({ ...filters, [k]: v });

  const active = hasActiveEvidenceFilters(filters);

  const projectOpts = [
    { value: "", label: "Todos los proyectos" },
    ...projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
  ];

  const userOpts = [
    { value: "", label: "Todos los autores" },
    ...users.filter((u) => u.isActive).map((u) => ({ value: u.id, label: u.displayName })),
  ];

  return (
    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      padding: `${spacing[5]}px ${spacing[6]}px`,
      marginBottom: spacing[5],
      display: "flex",
      alignItems: "flex-end",
      gap: spacing[4],
      flexWrap: "wrap",
      fontFamily: font.family,
    }}>
      {/* Búsqueda */}
      <SearchBox
        value={filters.query}
        onChange={(v) => set("query", v)}
        placeholder="Buscar por comentario, título de tarea, clave Jira…"
        width={280}
      />

      <Divider />

      {/* Proyecto */}
      <LabeledSelect
        label="Proyecto"
        value={filters.projectId}
        onChange={(v) => set("projectId", v)}
        options={projectOpts}
        minWidth={200}
      />

      {/* Área */}
      {areas.length > 0 && (
        <LabeledSelect
          label="Área"
          value={filters.areaId}
          onChange={(v) => set("areaId", v)}
          options={[
            { value: "", label: "Todas las áreas" },
            ...areas.map((a) => ({ value: a.id, label: a.name })),
          ]}
          minWidth={150}
        />
      )}

      {/* Tipo */}
      <LabeledSelect
        label="Tipo"
        value={filters.type}
        onChange={(v) => set("type", v)}
        options={TYPE_OPTS}
        minWidth={140}
      />

      {/* Autor */}
      <LabeledSelect
        label="Autor"
        value={filters.createdBy}
        onChange={(v) => set("createdBy", v)}
        options={userOpts}
        minWidth={160}
      />

      <Divider />

      {/* Toggle solo mis evidencias */}
      <ToggleChip
        label="Solo mis evidencias"
        active={filters.onlyMine}
        onClick={() => set("onlyMine", !filters.onlyMine)}
      />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Reset */}
      {active && (
        <button onClick={onReset} style={{
          display: "inline-flex", alignItems: "center", gap: spacing[2],
          padding: `${spacing[2]}px ${spacing[4]}px`,
          border: `1px solid ${color.border}`, borderRadius: radius.sm,
          background: color.surfaceAlt, color: color.textSecondary,
          fontSize: font.size.sm, fontWeight: font.weight.medium,
          fontFamily: font.family, cursor: "pointer", whiteSpace: "nowrap",
        }}>
          <X size={12} /> Limpiar
        </button>
      )}
    </div>
  );
};

// ── SearchBox ─────────────────────────────────────────────
const SearchBox: React.FC<{
  value: string; onChange: (v: string) => void;
  placeholder?: string; width?: number;
}> = ({ value, onChange, placeholder = "Buscar…", width = 240 }) => {
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <Search size={13} style={{ position: "absolute", left: spacing[4], color: focused ? color.primary : color.textMuted, pointerEvents: "none" }} />
      <input type="search" value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          paddingLeft: 30, paddingRight: value ? 28 : spacing[4],
          paddingTop: spacing[3], paddingBottom: spacing[3],
          border: `1px solid ${focused ? color.primary : color.border}`,
          borderRadius: radius.sm, fontSize: font.size.md,
          color: color.text, background: color.surface, outline: "none",
          width, fontFamily: font.family,
          transition: `border-color ${transition.fast}`,
          boxSizing: "border-box" as const,
        }}
      />
      {value && (
        <button onClick={() => onChange("")}
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
        }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
};

// ── ToggleChip ────────────────────────────────────────────
const ToggleChip: React.FC<{
  label: string; active: boolean; onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button onClick={onClick} aria-pressed={active}
    style={{
      display: "inline-flex", alignItems: "center", gap: spacing[2],
      padding: `${spacing[2]}px ${spacing[5]}px`,
      border: `1px solid ${active ? color.primary : color.border}`,
      borderRadius: radius.full, background: active ? color.primaryBg : "transparent",
      color: active ? color.primary : color.textSecondary,
      fontSize: font.size.sm, fontWeight: active ? font.weight.semibold : font.weight.regular,
      fontFamily: font.family, cursor: "pointer",
      transition: `all ${transition.fast}`,
      alignSelf: "flex-end",
    }}>
    {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: color.primary, display: "inline-block" }} />}
    {label}
  </button>
);

// ── Divider ───────────────────────────────────────────────
const Divider: React.FC = () => (
  <div style={{ width: 1, height: 28, background: color.border, alignSelf: "flex-end", marginBottom: 1 }} />
);
