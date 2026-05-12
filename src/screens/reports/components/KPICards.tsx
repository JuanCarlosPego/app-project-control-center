// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/KPICards.tsx
//  Fila de tarjetas KPI globales.
// ─────────────────────────────────────────────────────────

import React from "react";
import { FolderOpen, ListTodo, CheckCircle2, AlertTriangle, Clock, AlertOctagon } from "lucide-react";
import { color, font, radius, shadow, spacing } from "../../../components/ui/tokens";
import type { KPISummary } from "../../../services/reportService";

// ── KPI Card individual ───────────────────────────────────
interface CardProps {
  icon:    React.ReactNode;
  label:   string;
  value:   number;
  accent?: string;       // color de valor destacado
  bgAccent?: string;     // fondo del icono
  loading?: boolean;
  hint?:   string;       // tooltip/descripción
}

const KPICard: React.FC<CardProps> = ({
  icon, label, value, accent, bgAccent, loading, hint,
}) => (
  <div
    title={hint}
    style={{
      flex: "1 1 140px",
      minWidth: 130,
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      padding: `${spacing[5]}px ${spacing[5]}px ${spacing[4]}px`,
      display: "flex",
      flexDirection: "column",
      gap: spacing[3],
    }}
  >
    {/* Icono */}
    <div style={{
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      background: bgAccent ?? color.primaryBg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: accent ?? color.primary,
    }}>
      {icon}
    </div>

    {/* Valor */}
    {loading ? (
      <div style={{
        height: 28,
        background: color.surfaceAlt,
        borderRadius: radius.xs,
        width: "60%",
        animation: "pulse 1.2s ease infinite",
      }} />
    ) : (
      <span style={{
        fontSize: 28,
        fontWeight: font.weight.bold,
        color: accent ?? color.text,
        lineHeight: 1,
      }}>
        {value.toLocaleString("es-ES")}
      </span>
    )}

    {/* Label */}
    <span style={{
      fontSize: font.size.xs,
      color: color.textMuted,
      fontWeight: font.weight.medium,
      lineHeight: 1.3,
    }}>
      {label}
    </span>
  </div>
);

// ── KPICards ──────────────────────────────────────────────
interface KPICardsProps {
  kpis:    KPISummary;
  loading: boolean;
  periodDays: number;
}

export const KPICards: React.FC<KPICardsProps> = ({ kpis, loading, periodDays }) => (
  <div style={{
    display: "flex",
    flexWrap: "wrap",
    gap: spacing[4],
    marginBottom: spacing[7],
  }}>
    <KPICard
      icon={<FolderOpen size={18} />}
      label="Épicas totales"
      value={kpis.totalProjects}
      loading={loading}
      hint="Proyectos (épicas) visibles con los filtros actuales"
    />
    <KPICard
      icon={<ListTodo size={18} />}
      label="Tareas totales"
      value={kpis.totalTasks}
      loading={loading}
      hint="WorkItems de las épicas filtradas"
    />
    <KPICard
      icon={<CheckCircle2 size={18} />}
      label={`Cerradas en ${periodDays}d`}
      value={kpis.closedInPeriod}
      accent={color.success}
      bgAccent={color.successBg}
      loading={loading}
      hint={`Tareas que pasaron a estado "Cerrado" en los últimos ${periodDays} días`}
    />
    <KPICard
      icon={<AlertTriangle size={18} />}
      label="Bloqueadas"
      value={kpis.blocked}
      accent={kpis.blocked > 0 ? color.warning : color.textMuted}
      bgAccent={kpis.blocked > 0 ? color.warningBg : color.surfaceAlt}
      loading={loading}
      hint="Tareas en estado Bloqueado o con blockedReason"
    />
    <KPICard
      icon={<Clock size={18} />}
      label="Vencen ≤14d"
      value={kpis.dueSoon}
      accent={kpis.dueSoon > 0 ? color.danger : color.textMuted}
      bgAccent={kpis.dueSoon > 0 ? color.dangerBg : color.surfaceAlt}
      loading={loading}
      hint="Tareas abiertas cuya fecha fin ≤ hoy + 14 días"
    />
    {kpis.syncErrors > 0 && (
      <KPICard
        icon={<AlertOctagon size={18} />}
        label="Errores de sync"
        value={kpis.syncErrors}
        accent={color.danger}
        bgAccent={color.dangerBg}
        loading={loading}
        hint="Tareas con syncStatus = Error (Jira)"
      />
    )}
  </div>
);
