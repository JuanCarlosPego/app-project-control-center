// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/GovernanceTab.tsx
//  Tab "Gobierno" del informe — KPIs globales del sistema.
//
//  Visible solo para Admin + IT AirEuropa.
//  Compone los componentes existentes:
//    KPICards · WeeklyTrend · RisksTable · ProviderTable · AreaTable
// ─────────────────────────────────────────────────────────
import React from "react";
import { color, font, spacing } from "../../../components/ui/tokens";
import type { ReportPayload, ReportFilters } from "../../../services/reportService";
import { KPICards }      from "./KPICards";
import { WeeklyTrend }   from "./WeeklyTrend";
import { RisksTable }    from "./RisksTable";
import { ProviderTable } from "./ProviderTable";
import { AreaTable }     from "./AreaTable";

interface Props {
  payload:    ReportPayload;
  filters:    ReportFilters;
  loading:    boolean;
}

// ── Separador de sección ──────────────────────────────────
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{
    margin: `${spacing[6]}px 0 ${spacing[4]}px`,
    fontSize: font.size.xs, fontWeight: font.weight.semibold,
    color: color.textMuted,
    textTransform: "uppercase" as const, letterSpacing: "0.07em",
    borderBottom: `1px solid ${color.border}`,
    paddingBottom: spacing[2],
  }}>
    {children}
  </p>
);

// ── GovernanceTab ──────────────────────────────────────────
export const GovernanceTab: React.FC<Props> = ({ payload, filters, loading }) => {
  const periodDays = filters.periodDays ?? 30;

  return (
    <div>
      {/* KPI cards globales */}
      <KPICards
        kpis={payload.kpis}
        loading={loading}
        periodDays={periodDays}
      />

      {/* Tendencia + Riesgos */}
      {(loading || payload.topRisks.length > 0 || payload.weeklyTrend.length > 0) && (
        <>
          <SectionLabel>Tendencia y riesgos</SectionLabel>
          <div style={{
            display: "grid",
            gridTemplateColumns:
              payload.topRisks.length > 0 || loading ? "1fr 1fr" : "1fr",
            gap: spacing[6],
            marginBottom: spacing[2],
          }}>
            <WeeklyTrend buckets={payload.weeklyTrend} loading={loading} />
            {(loading || payload.topRisks.length > 0) && (
              <RisksTable risks={payload.topRisks} loading={loading} />
            )}
          </div>
        </>
      )}

      {/* Tablas por proveedor y área */}
      <SectionLabel>Comparativa por proveedor / área</SectionLabel>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: spacing[6],
      }}>
        <ProviderTable
          rows={payload.byProvider}
          periodDays={periodDays}
          loading={loading}
        />
        <AreaTable
          rows={payload.byArea}
          periodDays={periodDays}
          loading={loading}
        />
      </div>
    </div>
  );
};
