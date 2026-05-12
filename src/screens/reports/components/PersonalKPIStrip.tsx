// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/PersonalKPIStrip.tsx
//  Strip de 5 KPI cards personales para la sección
//  "Mis tareas" en el informe.
//
//  Cards:
//    Asignadas a mí · Esperando a terceros · Bloqueadas
//    Vencen ≤14d · Cerradas (total)
// ─────────────────────────────────────────────────────────
import React from "react";
import {
  UserCheck, Hourglass, ShieldAlert,
  Clock, CheckCircle2,
} from "lucide-react";
import {
  color, font, radius, shadow, spacing,
} from "../../../components/ui/tokens";
import type { PersonalKPIs } from "../reportSelectors";

// ── KPI card ──────────────────────────────────────────────
interface CardProps {
  icon:      React.ReactNode;
  label:     string;
  value:     number;
  accent:    string;
  accentBg:  string;
  loading?:  boolean;
  hint?:     string;
}

const Card: React.FC<CardProps> = ({
  icon, label, value, accent, accentBg, loading, hint,
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
      width: 36, height: 36,
      borderRadius: radius.sm,
      background: accentBg,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: accent,
    }}>
      {icon}
    </div>

    {/* Valor */}
    {loading ? (
      <div style={{
        height: 28,
        background: color.surfaceAlt,
        borderRadius: radius.xs,
        width: "55%",
        animation: "pulse 1.2s ease infinite",
      }} />
    ) : (
      <span style={{
        fontSize: 28, fontWeight: font.weight.bold,
        color: accent, lineHeight: 1,
      }}>
        {value.toLocaleString("es-ES")}
      </span>
    )}

    {/* Label */}
    <span style={{
      fontSize: font.size.xs, color: color.textMuted,
      fontWeight: font.weight.medium, lineHeight: 1.3,
    }}>
      {label}
    </span>
  </div>
);

// ── Divider entre grupos de cards ─────────────────────────
const Divider: React.FC = () => (
  <div style={{
    width: 1, alignSelf: "stretch",
    background: color.border, margin: `${spacing[2]}px 0`,
    flexShrink: 0,
  }} />
);

// ── Props ─────────────────────────────────────────────────
interface Props {
  kpis:    PersonalKPIs;
  loading: boolean;
}

// ── PersonalKPIStrip ──────────────────────────────────────
export const PersonalKPIStrip: React.FC<Props> = ({ kpis, loading }) => (
  <>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: spacing[4],
      marginBottom: spacing[7],
      alignItems: "stretch",
    }}>
      {/* Bloque: mis tareas activas */}
      <Card
        icon={<UserCheck size={16} />}
        label="Asignadas a mí"
        value={kpis.assignedToMe}
        accent={color.primary}
        accentBg={color.primaryBg}
        loading={loading}
        hint="Tareas abiertas asignadas directamente a ti"
      />
      <Card
        icon={<Hourglass size={16} />}
        label="Esperando a terceros"
        value={kpis.waitingOnOthers}
        accent="#92400E"
        accentBg="#FFFBEB"
        loading={loading}
        hint="Tareas que solicitaste y están en manos de otro equipo"
      />

      <Divider />

      {/* Bloque: alertas */}
      <Card
        icon={<ShieldAlert size={16} />}
        label="Bloqueadas"
        value={kpis.blocked}
        accent={color.danger}
        accentBg={color.dangerBg}
        loading={loading}
        hint="Tareas asignadas a ti que están bloqueadas"
      />
      <Card
        icon={<Clock size={16} />}
        label={`Vencen ≤${14}d`}
        value={kpis.dueSoon}
        accent={color.warning}
        accentBg={color.warningBg}
        loading={loading}
        hint="Tareas propias o en espera que vencen en los próximos 14 días"
      />

      <Divider />

      {/* Bloque: cierre */}
      <Card
        icon={<CheckCircle2 size={16} />}
        label="Cerradas (total)"
        value={kpis.closedTotal}
        accent={color.success}
        accentBg={color.successBg}
        loading={loading}
        hint="Tareas cerradas asignadas a ti (sin filtro de periodo)"
      />
    </div>
  </>
);
