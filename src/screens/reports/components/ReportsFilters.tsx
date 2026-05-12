// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/ReportsFilters.tsx
//  Barra de filtros para la pantalla de Informes / KPIs.
// ─────────────────────────────────────────────────────────

import React from "react";
import { color, font, radius, shadow, spacing, transition } from "../../../components/ui/tokens";
import type { Provider } from "../../../types/domain";
import type { ReportFilters } from "../../../services/reportService";

// ── Opciones de periodo ──────────────────────────────────
export const PERIOD_OPTIONS = [
  { value: 7,  label: "Últimos 7 días" },
  { value: 14, label: "Últimos 14 días" },
  { value: 30, label: "Últimos 30 días" },
  { value: 90, label: "Últimos 90 días" },
];

// ── Estado vacío ─────────────────────────────────────────
export const EMPTY_REPORT_FILTERS: ReportFilters = {
  projectId:         "",
  areaId:            "",
  providerId:        "",
  deliveryOwnerType: "",
  periodDays:        30,
  onlyBlocked:       false,
  onlyDueSoon:       false,
};

export function hasActiveReportFilters(f: ReportFilters): boolean {
  return !!(
    f.providerId || f.deliveryOwnerType ||
    f.onlyBlocked || f.onlyDueSoon
  );
}

// ── Props ─────────────────────────────────────────────────
interface ReportsFiltersProps {
  filters:   ReportFilters;
  onChange:  (f: ReportFilters) => void;

  providers: Provider[];
}

// ── Helpers de estilo ────────────────────────────────────
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
  minWidth: 160,
};

// ── Chip toggle ──────────────────────────────────────────
const Toggle: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
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
      border: `1px solid ${active ? color.primary : color.border}`,
      background: active ? color.primaryBg : "transparent",
      color: active ? color.primary : color.textSecondary,
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

// ── Componente ────────────────────────────────────────────
export const ReportsFilters: React.FC<ReportsFiltersProps> = ({
  filters, onChange, providers,
}) => {
  const set = <K extends keyof ReportFilters>(k: K, v: ReportFilters[K]) =>
    onChange({ ...filters, [k]: v });

  const handleReset = () => onChange({ ...EMPTY_REPORT_FILTERS, periodDays: filters.periodDays });
  const active = hasActiveReportFilters(filters);

  return (
    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      padding: `${spacing[4]}px ${spacing[6]}px`,
      marginBottom: spacing[6],
    }}>
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: spacing[3],
        alignItems: "center",
      }}>
        {/* Ejecutor */}
        <select
          value={filters.deliveryOwnerType ?? ""}
          onChange={(e) => set("deliveryOwnerType", e.target.value as ReportFilters["deliveryOwnerType"])}
          style={{ ...inputStyle, minWidth: 140 }}
          aria-label="Filtrar por ejecutor"
        >
          <option value="">Todos los ejecutores</option>
          <option value="IT">IT AirEuropa</option>
          <option value="Proveedor">Proveedor</option>
        </select>

        {/* Proveedor */}
        <select
          value={filters.providerId ?? ""}
          onChange={(e) => set("providerId", e.target.value)}
          style={inputStyle}
          aria-label="Filtrar por proveedor"
        >
          <option value="">Todos los proveedores</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Periodo */}
        <select
          value={filters.periodDays ?? 30}
          onChange={(e) => set("periodDays", parseInt(e.target.value, 10))}
          style={{ ...inputStyle, minWidth: 150 }}
          aria-label="Periodo de referencia"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Separador */}
        <div style={{ width: 1, height: 22, background: color.border, margin: `0 ${spacing[1]}px` }} />

        {/* Toggles */}
        <Toggle
          label="Solo bloqueados"
          active={!!filters.onlyBlocked}
          onClick={() => set("onlyBlocked", !filters.onlyBlocked)}
        />
        <Toggle
          label="Vencen ≤14d"
          active={!!filters.onlyDueSoon}
          onClick={() => set("onlyDueSoon", !filters.onlyDueSoon)}
        />

        {/* Reset */}
        {active && (
          <button
            type="button"
            onClick={handleReset}
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
