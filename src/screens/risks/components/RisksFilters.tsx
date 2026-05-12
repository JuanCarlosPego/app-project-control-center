// ─────────────────────────────────────────────────────────
//  src/screens/risks/components/RisksFilters.tsx
//  Barra de filtros para la pantalla de Riesgos y Bloqueos.
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search } from "lucide-react";
import { color, font, radius, shadow, spacing, transition } from "../../../components/ui/tokens";
import type { RiskSeverity, RiskStatus, AppRole } from "../../../types/domain";
import type { RiskFilters } from "../../../services/riskService";

// ── Estado vacío ─────────────────────────────────────────
export const EMPTY_RISK_FILTERS: RiskFilters = {
  projectId:           "",
  severity:            "",
  status:              "",
  ownerRole:           "",
  onlyDueSoon:         false,
  query:               "",
  onlyAssignedToMe:    false,
  onlyWaitingOnOthers: false,
};

export function hasActiveRiskFilters(f: RiskFilters): boolean {
  return !!(
    f.severity || f.status || f.ownerRole ||
    f.onlyDueSoon || f.query ||
    f.onlyAssignedToMe || f.onlyWaitingOnOthers
  );
}

interface RisksFiltersProps {
  filters:  RiskFilters;
  onChange: (f: RiskFilters) => void;
}

// ── Estilos base ──────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  height: 30,
  padding: `0 ${spacing[3]}px`,
  fontSize: font.size.sm,
  color: color.text,
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  outline: "none",
  cursor: "pointer",
  transition: `border-color ${transition.fast}`,
  minWidth: 150,
};

const Toggle: React.FC<{ label: string; active: boolean; color?: "danger" | "primary" | "warning"; onClick: () => void }> = ({
  label, active, color: colorType = "danger", onClick,
}) => {
  const palettes = {
    danger:  { bg: color.dangerBg,  border: color.danger,  fg: color.danger },
    primary: { bg: color.primaryBg, border: color.primary, fg: color.primary },
    warning: { bg: color.warningBg, border: color.warning, fg: color.warning },
  };
  const p = palettes[colorType];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 30,
        padding: `0 ${spacing[3]}px`,
        fontSize: font.size.sm,
        borderRadius: radius.full,
        border: `1px solid ${active ? p.border : color.border}`,
        background: active ? p.bg : "transparent",
        color: active ? p.fg : color.textSecondary,
        fontWeight: active ? font.weight.semibold : font.weight.regular,
        cursor: "pointer",
        transition: `all ${transition.fast}`,
        whiteSpace: "nowrap" as const,
      }}
    >
      {active && <span style={{ fontSize: 10 }}>✓</span>}
      {label}
    </button>
  );
};

// ── Componente ────────────────────────────────────────────
export const RisksFilters: React.FC<RisksFiltersProps> = ({
  filters, onChange,
}) => {
  const set = <K extends keyof RiskFilters>(k: K, v: RiskFilters[K]) =>
    onChange({ ...filters, [k]: v });

  const active = hasActiveRiskFilters(filters);

  return (
    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      padding: `${spacing[4]}px ${spacing[6]}px`,
      marginBottom: spacing[5],
    }}>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: spacing[3],
        alignItems: "center",
      }}>
        {/* Búsqueda de texto */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 30,
          padding: `0 ${spacing[3]}px`,
          border: `1px solid ${color.border}`,
          borderRadius: radius.sm,
          background: color.surface,
          minWidth: 200,
        }}>
          <Search size={13} color={color.textMuted} />
          <input
            type="text"
            placeholder="Buscar riesgo..."
            value={filters.query ?? ""}
            onChange={(e) => set("query", e.target.value)}
            style={{
              border: "none",
              outline: "none",
              fontSize: font.size.sm,
              color: color.text,
              background: "transparent",
              width: "100%",
            }}
          />
        </div>

        {/* Severidad */}
        <select
          value={filters.severity ?? ""}
          onChange={(e) => set("severity", e.target.value as RiskSeverity | "")}
          style={{ ...inputStyle, minWidth: 130 }}
          aria-label="Filtrar por severidad"
        >
          <option value="">Toda severidad</option>
          <option value="Alta">Alta</option>
          <option value="Media">Media</option>
          <option value="Baja">Baja</option>
        </select>

        {/* Estado */}
        <select
          value={filters.status ?? ""}
          onChange={(e) => set("status", e.target.value as RiskStatus | "")}
          style={{ ...inputStyle, minWidth: 140 }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          <option value="Abierto">Abierto</option>
          <option value="En mitigación">En mitigación</option>
          <option value="Resuelto">Resuelto</option>
        </select>

        {/* Responsable */}
        <select
          value={filters.ownerRole ?? ""}
          onChange={(e) => set("ownerRole", e.target.value as AppRole | "")}
          style={{ ...inputStyle, minWidth: 150 }}
          aria-label="Filtrar por responsable"
        >
          <option value="">Todos los responsables</option>
          <option value="IT AirEuropa">IT AirEuropa</option>
          <option value="Proveedor">Proveedor</option>
          <option value="Usuario">Usuario</option>
        </select>

        {/* Separador */}
        <div style={{ width: 1, height: 22, background: color.border, margin: `0 ${spacing[1]}px` }} />

        {/* Toggle vencen pronto */}
        <Toggle
          label="Vencen ≤14d"
          active={!!filters.onlyDueSoon}
          onClick={() => set("onlyDueSoon", !filters.onlyDueSoon)}
        />

        {/* Separador personal */}
        <div style={{ width: 1, height: 22, background: color.border, margin: `0 ${spacing[1]}px` }} />

        {/* Toggle Asignadas a mí */}
        <Toggle
          label="Asignadas a mí"
          active={!!filters.onlyAssignedToMe}
          color="primary"
          onClick={() => set("onlyAssignedToMe", !filters.onlyAssignedToMe)}
        />

        {/* Toggle Esperando a terceros */}
        <Toggle
          label="Esperando a terceros"
          active={!!filters.onlyWaitingOnOthers}
          color="warning"
          onClick={() => set("onlyWaitingOnOthers", !filters.onlyWaitingOnOthers)}
        />

        {/* Limpiar filtros */}
        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_RISK_FILTERS)}
            style={{
              height: 30,
              padding: `0 ${spacing[3]}px`,
              fontSize: font.size.sm,
              borderRadius: radius.sm,
              border: `1px solid ${color.border}`,
              background: "transparent",
              color: color.textMuted,
              cursor: "pointer",
              transition: `all ${transition.fast}`,
              marginLeft: "auto",
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
};
