// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/WaitingByRoleTable.tsx
//  Tabla "Esperando a terceros por rol".
//
//  Columns: Rol · Tareas · % del total · Vencidas · Media días restantes
// ─────────────────────────────────────────────────────────
import React from "react";
import {
  color, font, radius, shadow, spacing,
} from "../../../components/ui/tokens";
import type { WaitingRoleRow } from "../reportSelectors";

// ── Design tokens locales ─────────────────────────────────
const ROLE_CHIP: Record<string, { bg: string; text: string }> = {
  "IT AirEuropa": { bg: color.primaryBg,   text: color.primary },
  "Proveedor":    { bg: color.successBg,   text: color.success },
  "Usuario":      { bg: color.warningBg,   text: "#92400E"    },
  "Admin":        { bg: "#EDE9FE",         text: "#5B21B6"    },
};

// ── Helpers de renderizado ────────────────────────────────
const PctBar: React.FC<{ pct: number }> = ({ pct }) => (
  <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
    <div style={{
      flex: 1, height: 6, background: color.surfaceAlt,
      borderRadius: radius.full, overflow: "hidden",
    }}>
      <div style={{
        width: `${Math.min(pct, 100)}%`, height: "100%",
        background: pct >= 60 ? color.danger : pct >= 30 ? color.warning : color.primary,
        borderRadius: radius.full,
        transition: "width 0.4s ease",
      }} />
    </div>
    <span style={{
      fontSize: font.size.xs, color: color.textMuted,
      minWidth: 32, textAlign: "right" as const,
    }}>
      {pct}%
    </span>
  </div>
);

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

/** Muestra los días restantes con color semántico */
const DaysChip: React.FC<{ days: number | null }> = ({ days }) => {
  if (days === null) return <span style={{ color: color.textMuted }}>—</span>;
  const clr = days < 0 ? color.danger : days <= 7 ? color.warning : color.success;
  return (
    <span style={{
      fontSize: font.size.xs, fontWeight: font.weight.semibold, color: clr,
    }}>
      {days < 0 ? `−${Math.abs(days)}d vencido` : `+${days}d`}
    </span>
  );
};

// ── Skeleton row ──────────────────────────────────────────
const SkeletonRow: React.FC = () => (
  <tr>
    {[120, 40, 90, 40, 80].map((w, i) => (
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
      colSpan={5}
      style={{
        textAlign: "center", padding: `${spacing[7]}px`,
        color: color.textMuted, fontSize: font.size.sm,
      }}
    >
      Sin tareas esperando respuesta de terceros.
    </td>
  </tr>
);

// ── Props ─────────────────────────────────────────────────
interface Props {
  rows:    WaitingRoleRow[];
  loading: boolean;
}

// ── WaitingByRoleTable ────────────────────────────────────
export const WaitingByRoleTable: React.FC<Props> = ({ rows, loading }) => {
  const chip = (role: string) => {
    const c = ROLE_CHIP[role] ?? { bg: "#F3F2F1", text: "#323130" };
    return (
      <span style={{
        padding: `2px ${spacing[3]}px`, borderRadius: radius.full,
        fontSize: font.size.xs, fontWeight: font.weight.semibold,
        background: c.bg, color: c.text,
      }}>
        {role}
      </span>
    );
  };

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
          Esperando a terceros — por rol
        </span>
        {!loading && (
          <span style={{
            marginLeft: "auto",
            padding: `2px ${spacing[3]}px`, borderRadius: radius.full,
            fontSize: font.size.xs, fontWeight: font.weight.bold,
            background: color.primaryBg, color: color.primary,
          }}>
            {rows.reduce((s, r) => s + r.count, 0)} tareas
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
              <th style={thStyle}>Rol asignado</th>
              <th style={{ ...thStyle, textAlign: "right" as const }}>Tareas</th>
              <th style={{ ...thStyle, minWidth: 120 }}>% del total</th>
              <th style={{ ...thStyle, textAlign: "right" as const }}>Vencidas</th>
              <th style={{ ...thStyle, textAlign: "right" as const }}>Media días</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }, (_, i) => <SkeletonRow key={i} />)
              : rows.length === 0
              ? <Empty />
              : rows.map((row) => (
                  <tr key={row.role} style={{ transition: "background 120ms" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = color.surfaceAlt)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={tdStyle}>{chip(row.role)}</td>
                    <td style={{ ...tdStyle, textAlign: "right" as const, fontWeight: font.weight.semibold }}>
                      {row.count}
                    </td>
                    <td style={{ ...tdStyle, minWidth: 120 }}>
                      <PctBar pct={row.pctOfTotal} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" as const }}>
                      <DangerBadge n={row.overdue} />
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" as const }}>
                      <DaysChip days={row.avgDaysRemaining} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
