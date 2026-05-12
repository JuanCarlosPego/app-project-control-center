// ─────────────────────────────────────────────────────────
//  src/components/ui/KPIStrip.tsx
//  Barra de KPI cards clicables y reutilizables.
//
//  API:
//    <KPIStrip kpis={[...]} activeKey={...} onFilter={fn} />
//
//  Cada KPI: { key, label, value, color?, icon? }
//  key = "" → actúa como "sin filtro" (Total).
// ─────────────────────────────────────────────────────────

import React from "react";
import { color, font, radius, spacing, shadow, transition } from "./tokens";

export interface KPIItem {
  key: string;
  label: string;
  value: number | string;
  /** Color del número y del borde activo. Default: primario. */
  accentColor?: string;
  /** Background cuando activo / hover. */
  accentBg?: string;
  icon?: React.ReactNode;
  /** Si true muestra el valor en rojo cuando es 0 (ej: bloqueados). */
  warnZero?: boolean;
}

interface KPIStripProps {
  kpis: KPIItem[];
  activeKey?: string | null;
  onFilter?: (key: string) => void;
  /** Columnas mínimas de grid. Default: auto-fill 140px. */
  minColWidth?: number;
}

export const KPIStrip: React.FC<KPIStripProps> = ({
  kpis,
  activeKey,
  onFilter,
  minColWidth = 130,
}) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(auto-fill, minmax(${minColWidth}px, 1fr))`,
      gap: spacing[4],
      marginBottom: spacing[6],
      fontFamily: font.family,
    }}
  >
    {kpis.map((kpi) => {
      const isActive = kpi.key === (activeKey ?? "");
      const accent = kpi.accentColor ?? color.primary;
      const bg = kpi.accentBg ?? color.primaryBg;

      return (
        <KPICard
          key={kpi.key}
          kpi={kpi}
          isActive={isActive}
          accent={accent}
          bg={bg}
          onClick={onFilter ? () => onFilter(isActive ? "" : kpi.key) : undefined}
        />
      );
    })}
  </div>
);

// ── KPICard (internal) ────────────────────────────────────
interface KPICardProps {
  kpi: KPIItem;
  isActive: boolean;
  accent: string;
  bg: string;
  onClick?: () => void;
}

const KPICard: React.FC<KPICardProps> = ({ kpi, isActive, accent, bg, onClick }) => {
  const [hovered, setHovered] = React.useState(false);
  const interactive = !!onClick;

  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: spacing[2],
    padding: `${spacing[5]}px ${spacing[6]}px`,
    borderRadius: radius.md,
    border: `2px solid ${isActive || hovered ? accent : color.border}`,
    background: isActive || hovered ? bg : color.surface,
    boxShadow: isActive ? shadow.sm : shadow.xs,
    transition: `border-color ${transition.fast}, background ${transition.fast}, box-shadow ${transition.fast}`,
    cursor: interactive ? "pointer" : "default",
    textAlign: "left",
    fontFamily: font.family,
    outline: "none",
    // ring cuando activo
    ...(isActive ? { boxShadow: `0 0 0 1px ${accent}, ${shadow.sm}` } : {}),
  };

  const inner = (
    <>
      {kpi.icon && (
        <div style={{ color: accent, opacity: 0.7, display: "flex" }}>
          {kpi.icon}
        </div>
      )}
      <span style={{
        fontSize: font.size["2xl"],
        fontWeight: font.weight.extrabold,
        color: accent,
        lineHeight: 1,
      }}>
        {kpi.value}
      </span>
      <span style={{
        fontSize: font.size.sm,
        fontWeight: font.weight.medium,
        color: color.textMuted,
        lineHeight: font.lineHeight.tight,
      }}>
        {kpi.label}
      </span>
    </>
  );

  if (interactive) {
    return (
      <button
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={`Filtrar por ${kpi.label}: ${kpi.value}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={containerStyle}
      >
        {inner}
      </button>
    );
  }

  return (
    <div style={containerStyle}>
      {inner}
    </div>
  );
};
