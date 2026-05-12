// ─────────────────────────────────────────────────────────
//  src/components/ui/FilterBar.tsx
//  Barra de filtros estándar reutilizable.
//
//  Estructura:
//    [Búsqueda] [Selects...] [Extras] [Reset?]
//
//  Uso:
//    <FilterBar
//      search={value}
//      onSearchChange={fn}
//      searchPlaceholder="Buscar proyectos…"
//    >
//      <FilterBar.Select label="Área" value={} onChange={}>...</FilterBar.Select>
//      <FilterBar.Extra>...</FilterBar.Extra>
//    </FilterBar>
//
//  O con la API flat:
//    <FilterBar search={...} filters={[{...}]} extras={</>} />
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search, X } from "lucide-react";
import { color, font, radius, spacing, shadow, transition } from "./tokens";

// ── Tipos ─────────────────────────────────────────────────
export interface FilterSelectDef {
  key: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  minWidth?: number;
}

interface FilterBarProps {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  /** Filtros select como array declarativo */
  filters?: FilterSelectDef[];
  /** Slot para controles extra (toggles, viewToggle, etc.) */
  extras?: React.ReactNode;
  /** Muestra botón "Limpiar todo" cuando hay filtros activos */
  onReset?: () => void;
  hasActiveFilters?: boolean;
  /** Separar con divisor visual antes de extras */
  divideExtras?: boolean;
}

// ── FilterBar ─────────────────────────────────────────────
export const FilterBar: React.FC<FilterBarProps> = ({
  search,
  onSearchChange,
  searchPlaceholder = "Buscar…",
  filters = [],
  extras,
  onReset,
  hasActiveFilters = false,
  divideExtras = true,
}) => {
  const showSearch = onSearchChange !== undefined;

  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        boxShadow: shadow.xs,
        padding: `${spacing[4]}px ${spacing[6]}px`,
        marginBottom: spacing[5],
        display: "flex",
        alignItems: "center",
        gap: spacing[4],
        flexWrap: "wrap",
        fontFamily: font.family,
      }}
    >
      {/* Búsqueda */}
      {showSearch && (
        <SearchInput
          value={search ?? ""}
          onChange={onSearchChange!}
          placeholder={searchPlaceholder}
        />
      )}

      {/* Divider (si hay búsqueda Y filtros) */}
      {showSearch && filters.length > 0 && (
        <Divider />
      )}

      {/* Filtros select */}
      {filters.map((f) => (
        <FilterSelect key={f.key} def={f} />
      ))}

      {/* Divider antes de extras */}
      {divideExtras && extras && (filters.length > 0 || showSearch) && (
        <Divider />
      )}

      {/* Extras */}
      {extras}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Reset */}
      {onReset && hasActiveFilters && (
        <ResetButton onClick={onReset} />
      )}
    </div>
  );
};

// ── SearchInput ───────────────────────────────────────────
interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder }) => {
  const [focused, setFocused] = React.useState(false);

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <Search
        size={14}
        style={{
          position: "absolute",
          left: spacing[4],
          color: focused ? color.primary : color.textMuted,
          pointerEvents: "none",
          transition: `color ${transition.fast}`,
          flexShrink: 0,
        }}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          paddingLeft: 32,
          paddingRight: value ? 30 : spacing[4],
          paddingTop: spacing[3],
          paddingBottom: spacing[3],
          border: `1px solid ${focused ? color.primary : color.border}`,
          borderRadius: radius.sm,
          fontSize: font.size.md,
          color: color.text,
          background: color.surface,
          outline: "none",
          width: 220,
          fontFamily: font.family,
          transition: `border-color ${transition.fast}`,
          boxSizing: "border-box",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          style={{
            position: "absolute",
            right: spacing[3],
            background: "none",
            border: "none",
            cursor: "pointer",
            color: color.textMuted,
            display: "flex",
            alignItems: "center",
            padding: 0,
          }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
};

// ── FilterSelect ──────────────────────────────────────────
const FilterSelect: React.FC<{ def: FilterSelectDef }> = ({ def }) => {
  const [focused, setFocused] = React.useState(false);
  const hasValue = !!def.value;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
      {def.label && (
        <label style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.textMuted }}>
          {def.label}
        </label>
      )}
      <select
        value={def.value}
        onChange={(e) => def.onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          padding: `${spacing[3]}px ${spacing[6]}px ${spacing[3]}px ${spacing[4]}px`,
          border: `1px solid ${focused || hasValue ? color.primary : color.border}`,
          borderRadius: radius.sm,
          fontSize: font.size.md,
          color: hasValue ? color.text : color.textSecondary,
          background: color.surface,
          cursor: "pointer",
          outline: "none",
          fontFamily: font.family,
          minWidth: def.minWidth ?? 140,
          fontWeight: hasValue ? font.weight.semibold : font.weight.regular,
          transition: `border-color ${transition.fast}`,
        }}
      >
        {def.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// ── Divider ───────────────────────────────────────────────
const Divider: React.FC = () => (
  <div style={{ width: 1, height: 26, background: color.border, flexShrink: 0 }} />
);

// ── ResetButton ───────────────────────────────────────────
const ResetButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: spacing[2],
      padding: `${spacing[2]}px ${spacing[4]}px`,
      border: `1px solid ${color.border}`,
      borderRadius: radius.sm,
      background: color.surfaceAlt,
      color: color.textSecondary,
      fontSize: font.size.sm,
      fontWeight: font.weight.medium,
      fontFamily: font.family,
      cursor: "pointer",
      whiteSpace: "nowrap",
      transition: `background ${transition.fast}`,
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = color.border; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = color.surfaceAlt; }}
  >
    <X size={12} />
    Limpiar filtros
  </button>
);
