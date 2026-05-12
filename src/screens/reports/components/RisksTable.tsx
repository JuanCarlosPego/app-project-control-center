// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/RisksTable.tsx
//  Tabla de riesgos top (severidad + vencimiento).
// ─────────────────────────────────────────────────────────

import React from "react";
import { AlertTriangle, AlertOctagon, Minus } from "lucide-react";
import { color, font, radius, shadow, spacing } from "../../../components/ui/tokens";
import type { RiskRow } from "../../../services/reportService";

// ── Chip de severidad ─────────────────────────────────────
const SeverityChip: React.FC<{ severity: string }> = ({ severity }) => {
  const map: Record<string, { bg: string; text: string; Icon: React.ElementType }> = {
    Alta:  { bg: color.dangerBg,  text: color.danger,  Icon: AlertOctagon },
    Media: { bg: color.warningBg, text: color.warning, Icon: AlertTriangle },
    Baja:  { bg: color.surfaceAlt, text: color.textMuted, Icon: Minus },
  };
  const cfg = map[severity] ?? map["Baja"];
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: `2px ${spacing[2]}px`,
      borderRadius: radius.full,
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
      background: cfg.bg,
      color: cfg.text,
    }}>
      <Icon size={11} />
      {severity}
    </span>
  );
};

// ── Chip de días restantes ────────────────────────────────
const DaysLeft: React.FC<{ days: number }> = ({ days }) => {
  const urgent = days <= 7;
  const warn   = days <= 14;
  return (
    <span style={{
      fontSize: font.size.xs,
      fontWeight: font.weight.medium,
      color: urgent ? color.danger : warn ? color.warning : color.textMuted,
    }}>
      {days < 0 ? `Vencido (${Math.abs(days)}d)` : `${days}d`}
    </span>
  );
};

// ── Props ─────────────────────────────────────────────────
interface RisksTableProps {
  risks:   RiskRow[];
  loading: boolean;
}

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

export const RisksTable: React.FC<RisksTableProps> = ({ risks, loading }) => {
  if (!loading && risks.length === 0) return null;

  return (
    <section>
      <h3 style={{
        fontSize: font.size.md,
        fontWeight: font.weight.semibold,
        color: color.text,
        margin: `0 0 ${spacing[4]}px`,
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
      }}>
        <AlertTriangle size={16} color={color.warning} />
        Riesgos abiertos (top por severidad)
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
              <th style={thStyle}>Proyecto</th>
              <th style={thStyle}>Riesgo</th>
              <th style={thStyle}>Severidad</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Fecha límite</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Días restantes</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }, (__, j) => (
                    <td key={j} style={{ padding: `${spacing[3]}px ${spacing[4]}px` }}>
                      <div style={{ height: 14, width: j === 1 ? "75%" : "50%", background: color.surfaceAlt, borderRadius: radius.xs }} />
                    </td>
                  ))}
                </tr>
              ))
              : risks.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...tdStyle }}>
                    <span style={{
                      fontSize: font.size.xs,
                      fontWeight: font.weight.semibold,
                      color: color.primary,
                      fontFamily: "monospace",
                    }}>
                      {r.projectCode}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 320 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.title}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <SeverityChip severity={r.severity} />
                  </td>
                  <td style={{ ...tdStyle, color: color.textSecondary }}>
                    {r.status}
                  </td>
                  <td style={{ ...tdStyle, color: color.textSecondary, whiteSpace: "nowrap" }}>
                    {r.dueDate}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <DaysLeft days={r.daysLeft} />
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </section>
  );
};
