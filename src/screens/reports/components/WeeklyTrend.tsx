// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/WeeklyTrend.tsx
//  Tendencia de tareas cerradas por semana (barras CSS).
// ─────────────────────────────────────────────────────────

import React from "react";
import { color, font, radius, shadow, spacing } from "../../../components/ui/tokens";
import type { WeekBucket } from "../../../services/reportService";

interface WeeklyTrendProps {
  buckets: WeekBucket[];
  loading: boolean;
}

export const WeeklyTrend: React.FC<WeeklyTrendProps> = ({ buckets, loading }) => {
  const maxVal = Math.max(...buckets.map((b) => b.closed), 1);

  return (
    <section>
      <h3 style={{
        fontSize: font.size.md,
        fontWeight: font.weight.semibold,
        color: color.text,
        margin: `0 0 ${spacing[4]}px`,
      }}>
        Tareas cerradas por semana
      </h3>

      <div style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        boxShadow: shadow.xs,
        padding: `${spacing[6]}px ${spacing[6]}px ${spacing[4]}px`,
      }}>
        {loading ? (
          <div style={{ display: "flex", gap: spacing[3], alignItems: "flex-end", height: 100 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} style={{
                flex: 1,
                height: `${30 + Math.random() * 60}%`,
                background: color.surfaceAlt,
                borderRadius: `${radius.xs}px ${radius.xs}px 0 0`,
              }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: spacing[2], alignItems: "flex-end", height: 100 }}>
            {buckets.map((b) => {
              const heightPct = Math.max((b.closed / maxVal) * 100, b.closed > 0 ? 8 : 2);
              return (
                <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: spacing[1] }}>
                  {/* Valor sobre la barra */}
                  {b.closed > 0 && (
                    <span style={{
                      fontSize: font.size.xs,
                      fontWeight: font.weight.semibold,
                      color: color.primary,
                    }}>
                      {b.closed}
                    </span>
                  )}
                  {/* Barra */}
                  <div style={{ width: "100%", flex: 1, display: "flex", alignItems: "flex-end" }}>
                    <div
                      title={`${b.label}: ${b.closed} cerradas`}
                      style={{
                        width: "100%",
                        height: `${heightPct}%`,
                        background: b.closed === 0 ? color.surfaceAlt : color.primaryBg,
                        borderTop: `2px solid ${b.closed === 0 ? color.border : color.primary}`,
                        borderRadius: `${radius.xs}px ${radius.xs}px 0 0`,
                        transition: "height 0.4s ease",
                        minHeight: 4,
                        cursor: "default",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Eje X */}
        {!loading && (
          <div style={{
            display: "flex",
            gap: spacing[2],
            marginTop: spacing[2],
            borderTop: `1px solid ${color.border}`,
            paddingTop: spacing[2],
          }}>
            {buckets.map((b) => (
              <div key={b.label} style={{
                flex: 1,
                textAlign: "center",
                fontSize: 10,
                color: color.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
              }}>
                {b.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
