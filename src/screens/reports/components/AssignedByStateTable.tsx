// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/AssignedByStateTable.tsx
//  Tabla "Asignadas a mí por estado".
//
//  Columns: Estado · Tareas · Vencidas · Vencen ≤14d
// ─────────────────────────────────────────────────────────
import React from "react";
import {
  color, font, radius, shadow, spacing,
} from "../../../components/ui/tokens";
import type { AssignedStateRow } from "../reportSelectors";

// ── Color del chip por categoría de estado ────────────────
const STATE_COLOR: Record<string, { bg: string; text: string }> = {
  "Nuevo":           { bg: "#F3F2F1",         text: "#605E5C" },
  "Refinamiento":    { bg: "#F3F2F1",         text: "#605E5C" },
  "En progreso":     { bg: color.primaryBg,   text: color.primary },
  "En desarrollo":   { bg: color.primaryBg,   text: color.primary },
  "En pruebas":      { bg: "#FFFBEB",         text: "#92400E"    },
  "Bloqueado":       { bg: color.dangerBg,    text: color.danger },
  "Listo para pruebas": { bg: "#ECFDF5",      text: "#065F46"    },
  "Aceptado":        { bg: color.successBg,   text: color.success },
};

const stateChip = (name: string) => {
  const c = STATE_COLOR[name] ?? { bg: color.primaryBg, text: color.primary };
  return (
    <span style={{
      padding: `2px ${spacing[3]}px`,
      borderRadius: radius.full,
      fontSize: font.size.xs, fontWeight: font.weight.semibold,
      background: c.bg, color: c.text,
    }}>
      {name}
    </span>
  );
};

// ── Badges ────────────────────────────────────────────────
const DangerBadge: React.FC<{ n: number }> = ({ n }) => (
  <span style={{
    display: "inline-block",
    padding: `1px ${spacing[2]}px`,
    borderRadius: radius.full,
    fontSize: font.size.xs, fontWeight: font.weight.semibold,
    background: n === 0 ? color.surfaceAlt : color.dangerBg,
    color:      n === 0 ? color.textMuted  : color.danger,
    minWidth: 24, textAlign: "center" as const,
  }}>
    {n}
  </span>
);

const WarnBadge: React.FC<{ n: number }> = ({ n }) => (
  <span style={{
    display: "inline-block",
    padding: `1px ${spacing[2]}px`,
    borderRadius: radius.full,
    fontSize: font.size.xs, fontWeight: font.weight.semibold,
    background: n === 0 ? color.surfaceAlt : color.warningBg,
    color:      n === 0 ? color.textMuted  : color.warning,
    minWidth: 24, textAlign: "center" as const,
  }}>
    {n}
  </span>
);

// ── Skeleton row ──────────────────────────────────────────
const SkeletonRow: React.FC = () => (
  <tr>
    {[140, 40, 40, 40].map((w, i) => (
      <td key={i} style={{ padding: `${spacing[3]}px ${spacing[4]}px` }}>
        <div style={{
          height: 14, width: w, borderRadius: radius.xs,
          background: color.surfaceAlt, animation: "pulse 1.2s ease infinite",
          animationDelay: `${i * 0.07}s`,
        }} />
      </td>
    ))}
  </tr>
);

// ── Empty state ───────────────────────────────────────────
const Empty: React.FC = () => (
  <tr>
    <td
      colSpan={4}
      style={{
        textAlign: "center", padding: `${spacing[7]}px`,
        color: color.textMuted, fontSize: font.size.sm,
      }}
    >
      No tienes tareas abiertas asignadas.
    </td>
  </tr>
);

// ── Props ─────────────────────────────────────────────────
interface Props {
  rows:    AssignedStateRow[];
  loading: boolean;
}

// ── AssignedByStateTable ──────────────────────────────────
export const AssignedByStateTable: React.FC<Props> = ({ rows, loading }) => {
  const totalCount   = rows.reduce((s, r) => s + r.count,   0);
  const totalOverdue = rows.reduce((s, r) => s + r.overdue, 0);
  const totalDueSoon = rows.reduce((s, r) => s + r.dueSoon, 0);

  const thStyle: React.CSSProperties = {
    padding: `${spacing[3]}px ${spacing[4]}px`,
    fontSize: font.size.xs, fontWeight: font.weight.semibold,
    color: color.textMuted,
    textAlign: "left" as const,
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

  return (
    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      overflow: "hidden",
    }}>
      {/* Cabecera del panel */}
      <div style={{
        padding: `${spacing[4]}px ${spacing[5]}px`,
        borderBottom: `1px solid ${color.border}`,
        display: "flex", alignItems: "center", gap: spacing[3],
      }}>
        <span style={{
          fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text,
        }}>
          Asignadas a mí — por estado
        </span>
        {!loading && (
          <span style={{
            marginLeft: "auto",
            padding: `2px ${spacing[3]}px`, borderRadius: radius.full,
            fontSize: font.size.xs, fontWeight: font.weight.bold,
            background: color.primaryBg, color: color.primary,
          }}>
            {totalCount} tareas
          </span>
        )}
      </div>

      {/* Tabla */}
      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%", borderCollapse: "collapse",
          fontFamily: font.family,
        }}>
          <thead>
            <tr>
              <th style={thStyle}>Estado</th>
              <th style={{ ...thStyle, textAlign: "right" as const }}>Tareas</th>
              <th style={{ ...thStyle, textAlign: "right" as const }}>Vencidas</th>
              <th style={{ ...thStyle, textAlign: "right" as const }}>Vencen ≤14d</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }, (_, i) => <SkeletonRow key={i} />)
              : rows.length === 0
              ? <Empty />
              : rows.map((row) => (
                  <tr key={row.stateId} style={{ transition: "background 120ms" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = color.surfaceAlt)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdStyle}>{stateChip(row.stateName)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" as const, fontWeight: font.weight.semibold }}>
                      {row.count}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" as const }}>
                      <DangerBadge n={row.overdue} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" as const }}>
                      <WarnBadge n={row.dueSoon} />
                    </td>
                  </tr>
                ))}
          </tbody>

          {/* Fila de totales */}
          {!loading && rows.length > 0 && (
            <tfoot>
              <tr style={{ background: color.surfaceAlt }}>
                <td style={{
                  ...tdStyle,
                  fontWeight: font.weight.semibold,
                  color: color.textSecondary,
                  borderTop: `1px solid ${color.border}`,
                  borderBottom: "none",
                }}>
                  Total
                </td>
                <td style={{
                  ...tdStyle, textAlign: "right" as const,
                  fontWeight: font.weight.bold, color: color.text,
                  borderTop: `1px solid ${color.border}`, borderBottom: "none",
                }}>
                  {totalCount}
                </td>
                <td style={{
                  ...tdStyle, textAlign: "right" as const,
                  borderTop: `1px solid ${color.border}`, borderBottom: "none",
                }}>
                  <DangerBadge n={totalOverdue} />
                </td>
                <td style={{
                  ...tdStyle, textAlign: "right" as const,
                  borderTop: `1px solid ${color.border}`, borderBottom: "none",
                }}>
                  <WarnBadge n={totalDueSoon} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
