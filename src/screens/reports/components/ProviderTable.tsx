// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/ProviderTable.tsx
//  Tabla de métricas por proveedor.
// ─────────────────────────────────────────────────────────

import React from "react";
import { color, font, radius, shadow, spacing } from "../../../components/ui/tokens";
import type { ProviderRow } from "../../../services/reportService";

// ── Barra de progreso inline ─────────────────────────────
const PctBar: React.FC<{ pct: number }> = ({ pct }) => (
  <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
    <div style={{
      flex: 1,
      height: 6,
      background: color.surfaceAlt,
      borderRadius: radius.full,
      overflow: "hidden",
    }}>
      <div style={{
        width: `${pct}%`,
        height: "100%",
        background: pct >= 75 ? color.success : pct >= 40 ? color.primary : color.warning,
        borderRadius: radius.full,
        transition: "width 0.4s ease",
      }} />
    </div>
    <span style={{ fontSize: font.size.xs, color: color.textMuted, minWidth: 32, textAlign: "right" as const }}>
      {pct}%
    </span>
  </div>
);

// ── Badge ─────────────────────────────────────────────────
const Badge: React.FC<{ n: number; danger?: boolean }> = ({ n, danger }) => (
  <span style={{
    display: "inline-block",
    padding: `1px ${spacing[2]}px`,
    borderRadius: radius.full,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    background: n === 0 ? color.surfaceAlt : danger ? color.dangerBg : color.warningBg,
    color:      n === 0 ? color.textMuted  : danger ? color.danger   : color.warning,
    minWidth: 24,
    textAlign: "center" as const,
  }}>
    {n}
  </span>
);

// ── Props ─────────────────────────────────────────────────
interface ProviderTableProps {
  rows:       ProviderRow[];
  periodDays: number;
  loading:    boolean;
}

// ── Skeleton ──────────────────────────────────────────────
const SkeletonRow: React.FC = () => (
  <tr>
    {Array.from({ length: 6 }, (_, i) => (
      <td key={i} style={{ padding: `${spacing[3]}px ${spacing[4]}px` }}>
        <div style={{
          height: 14,
          width: i === 0 ? "80%" : "50%",
          background: color.surfaceAlt,
          borderRadius: radius.xs,
        }} />
      </td>
    ))}
  </tr>
);

// ── Tabla ─────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: `${spacing[3]}px ${spacing[4]}px`,
  textAlign: "left",
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.textMuted,
  borderBottom: `1px solid ${color.border}`,
  whiteSpace: "nowrap",
  background: color.surfaceAlt,
};

const tdStyle: React.CSSProperties = {
  padding: `${spacing[3]}px ${spacing[4]}px`,
  fontSize: font.size.sm,
  color: color.text,
  borderBottom: `1px solid ${color.borderSubtle}`,
  verticalAlign: "middle",
};

export const ProviderTable: React.FC<ProviderTableProps> = ({ rows, periodDays, loading }) => (
  <section>
    <h3 style={{
      fontSize: font.size.md,
      fontWeight: font.weight.semibold,
      color: color.text,
      margin: `0 0 ${spacing[4]}px`,
    }}>
      Por proveedor / ejecutor
    </h3>

    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      overflow: "hidden",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}>Proveedor</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Épicas</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Tareas</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Bloqueadas</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Cerradas ({periodDays}d)</th>
            <th style={{ ...thStyle, minWidth: 140 }}>% Cerradas (total)</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)
            : rows.length === 0
              ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: color.textMuted, padding: spacing[7] }}>
                    Sin datos para los filtros seleccionados
                  </td>
                </tr>
              )
              : rows.map((r) => (
                <tr key={r.providerId} style={{ transition: "background 0.1s" }}>
                  <td style={{ ...tdStyle, fontWeight: font.weight.medium }}>{r.providerName}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{r.projects}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>{r.tasks}</td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <Badge n={r.blocked} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <Badge n={r.closedInPeriod} danger={false} />
                  </td>
                  <td style={{ ...tdStyle, minWidth: 140 }}>
                    <PctBar pct={r.pctClosed} />
                  </td>
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  </section>
);
