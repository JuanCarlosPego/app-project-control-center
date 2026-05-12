// ─────────────────────────────────────────────────────────
//  src/screens/reports/components/MyPanelTab.tsx
//  Tab "Mi panel" del informe personal.
//
//  Contenido:
//    1) PersonalKPIStrip (cards: asignadas, esperando, bloqueadas, vencen)
//    2) Lista A: Asignadas a mí  (máx 8, orden endDate)
//    3) Lista B: Esperando a terceros (máx 8, agrupadas por assignedToRole)
//    CTA de cada item → /kanban?scope=mine|waiting
// ─────────────────────────────────────────────────────────
import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, UserCheck, Hourglass } from "lucide-react";
import {
  color, font, radius, shadow, spacing,
} from "../../../components/ui/tokens";
import type { WorkItem, Project, State } from "../../../types/domain";
import { PersonalKPIStrip } from "./PersonalKPIStrip";
import {
  calcPersonalKPIs,
  getMyAssignmentsForReport,
  getWaitingOnOthersForReport,
} from "../reportSelectors";

// ── Helpers de fecha ──────────────────────────────────────
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ── Chips de estado ───────────────────────────────────────
const STATE_DOT: Record<string, string> = {
  "st-blk":  color.danger,
  "st-prog": color.primary,
  "st-rft":  color.warning,
  "st-test": color.primary,
  "st-acc":  color.success,
  "st-cls":  color.success,
};

const ROLE_CHIP: Record<string, { bg: string; text: string }> = {
  "IT AirEuropa": { bg: color.primaryBg,  text: color.primary },
  "Proveedor":    { bg: color.successBg,  text: color.success },
  "Usuario":      { bg: color.warningBg,  text: "#92400E"    },
  "Admin":        { bg: "#EDE9FE",        text: "#5B21B6"    },
};

// ── Item row ──────────────────────────────────────────────
interface RowProps {
  wi:          WorkItem;
  projectCode: string;
  stateName:   string;
  showRole:    boolean;
  scope:       "mine" | "waiting";
}

const ItemRow: React.FC<RowProps> = ({ wi, projectCode, stateName, showRole, scope }) => {
  const navigate = useNavigate();
  const days     = daysUntil(wi.endDate);
  const overdue  = days < 0;
  const soon     = days >= 0 && days <= 7;
  const dotClr   = STATE_DOT[wi.stateId] ?? color.textMuted;
  const rc       = showRole ? (ROLE_CHIP[wi.assignedToRole] ?? { bg: "#F3F2F1", text: "#323130" }) : null;

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: spacing[3],
        padding: `${spacing[3]}px ${spacing[4]}px`,
        borderBottom: `1px solid ${color.borderSubtle}`,
        borderLeft: `3px solid ${overdue ? color.danger : soon ? color.warning : "transparent"}`,
        background: overdue ? "#FFFAF9" : "transparent",
        transition: "background 100ms",
      }}
      onMouseEnter={(e) => {
        if (!overdue) (e.currentTarget as HTMLDivElement).style.background = color.surfaceAlt;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = overdue ? "#FFFAF9" : "transparent";
      }}
    >
      {/* Dot estado */}
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: dotClr, flexShrink: 0,
      }} />

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Código + título */}
        <div style={{ display: "flex", alignItems: "baseline", gap: spacing[2], flexWrap: "nowrap" }}>
          {projectCode && (
            <span style={{
              fontSize: font.size.xs, color: color.textMuted,
              fontFamily: "monospace", fontWeight: 700, flexShrink: 0,
            }}>
              {projectCode}
            </span>
          )}
          <span style={{
            fontSize: font.size.sm, fontWeight: font.weight.medium, color: color.text,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {wi.title}
          </span>
        </div>

        {/* Meta */}
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], marginTop: 2 }}>
          {/* Estado */}
          <span style={{
            fontSize: font.size.xs, color: color.textMuted,
          }}>
            {stateName}
          </span>

          {/* Fecha */}
          <span style={{
            fontSize: font.size.xs,
            color: overdue ? color.danger : soon ? color.warning : color.textMuted,
            fontWeight: (overdue || soon) ? font.weight.semibold : font.weight.normal,
            display: "flex", alignItems: "center", gap: 2,
          }}>
            {overdue
              ? <><AlertTriangle size={10} /> {Math.abs(days)}d vencido</>
              : soon
              ? `⏰ ${days}d`
              : `→ ${wi.endDate}`}
          </span>

          {/* Rol asignado (solo en "Esperando") */}
          {rc && (
            <span style={{
              padding: `0 ${spacing[2]}px`, borderRadius: radius.full,
              fontSize: 10, fontWeight: font.weight.semibold,
              background: rc.bg, color: rc.text,
            }}>
              {wi.assignedToRole}
            </span>
          )}
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate(`/kanban?scope=${scope}`)}
        title="Ver en Kanban"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: `3px ${spacing[3]}px`, borderRadius: radius.sm,
          border: `1px solid ${color.border}`,
          background: color.surface, color: color.primary,
          fontSize: font.size.xs, fontWeight: font.weight.semibold,
          cursor: "pointer", flexShrink: 0,
          fontFamily: font.family, transition: "background 120ms",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = color.primaryBg;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = color.surface;
        }}
      >
        Kanban <ArrowRight size={10} />
      </button>
    </div>
  );
};

// ── List panel ─────────────────────────────────────────────
interface ListPanelProps {
  title:    React.ReactNode;
  count:    number;
  scope:    "mine" | "waiting";
  children: React.ReactNode;
  loading:  boolean;
  empty:    string;
}

const SkeletonItem: React.FC = () => (
  <div style={{
    padding: `${spacing[3]}px ${spacing[4]}px`,
    display: "flex", alignItems: "center", gap: spacing[3],
    borderBottom: `1px solid ${color.borderSubtle}`,
  }}>
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color.surfaceAlt }} />
    <div style={{ flex: 1 }}>
      <div style={{ height: 12, width: "65%", background: color.surfaceAlt, borderRadius: radius.xs, marginBottom: 5, animation: "pulse 1.2s infinite" }} />
      <div style={{ height: 10, width: "40%", background: color.surfaceAlt, borderRadius: radius.xs, animation: "pulse 1.2s infinite", animationDelay: "0.08s" }} />
    </div>
  </div>
);

const ListPanel: React.FC<ListPanelProps> = ({
  title, count, scope, children, loading, empty,
}) => {
  const navigate = useNavigate();
  return (
    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      overflow: "hidden",
    }}>
      {/* Cabecera */}
      <div style={{
        padding: `${spacing[4]}px ${spacing[5]}px`,
        borderBottom: `1px solid ${color.border}`,
        display: "flex", alignItems: "center", gap: spacing[3],
        background: color.surfaceAlt,
      }}>
        {title}
        {!loading && (
          <span style={{
            padding: `2px ${spacing[3]}px`, borderRadius: radius.full,
            fontSize: font.size.xs, fontWeight: font.weight.bold,
            background: count > 0 ? color.primaryBg : color.surfaceAlt,
            color: count > 0 ? color.primary : color.textMuted,
          }}>
            {count}
          </span>
        )}
        <button
          onClick={() => navigate(`/kanban?scope=${scope}`)}
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: `3px ${spacing[3]}px`, borderRadius: radius.sm,
            border: `1px solid ${color.border}`,
            background: color.surface, color: color.primary,
            fontSize: font.size.xs, fontWeight: font.weight.semibold,
            cursor: "pointer", fontFamily: font.family,
            transition: "background 120ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = color.primaryBg;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = color.surface;
          }}
        >
          Ver todas <ArrowRight size={10} />
        </button>
      </div>

      {/* Cuerpo */}
      {loading
        ? Array.from({ length: 3 }, (_, i) => <SkeletonItem key={i} />)
        : count === 0
        ? (
          <div style={{
            padding: `${spacing[7]}px`,
            textAlign: "center", color: color.textMuted,
            fontSize: font.size.sm,
          }}>
            {empty}
          </div>
        )
        : children}
    </div>
  );
};

// ── Props ─────────────────────────────────────────────────
interface Props {
  workItems:     WorkItem[];
  projects:      Project[];
  states:        State[];
  effectiveUserId: string;
  loading:       boolean;
}

// ── MyPanelTab ────────────────────────────────────────────
export const MyPanelTab: React.FC<Props> = ({
  workItems, projects, states, effectiveUserId, loading,
}) => {
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const stateMap   = Object.fromEntries(states.map((s) => [s.id, s]));

  const personalKPIs  = calcPersonalKPIs(workItems, projects, effectiveUserId);
  const mineItems     = getMyAssignmentsForReport(workItems, effectiveUserId, 8);
  const waitingItems  = getWaitingOnOthersForReport(workItems, projects, effectiveUserId, 8);

  // Agrupar "Esperando" por assignedToRole
  const waitingGroups: Record<string, WorkItem[]> = {};
  waitingItems.forEach((wi) => {
    const r = wi.assignedToRole ?? "Sin rol";
    (waitingGroups[r] ??= []).push(wi);
  });

  return (
    <div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>

      {/* KPI strip */}
      <PersonalKPIStrip kpis={personalKPIs} loading={loading} />

      {/* Listas */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: spacing[6],
      }}>
        {/* Lista A: Asignadas a mí */}
        <ListPanel
          title={
            <span style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
              <UserCheck size={14} color={color.primary} />
              <span style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text }}>
                Asignadas a mí
              </span>
            </span>
          }
          count={mineItems.length}
          scope="mine"
          loading={loading}
          empty="No tienes tareas abiertas asignadas."
        >
          {mineItems.map((wi) => (
            <ItemRow
              key={wi.id}
              wi={wi}
              projectCode={projectMap[wi.projectId]?.code ?? ""}
              stateName={stateMap[wi.stateId]?.name ?? wi.stateId}
              showRole={false}
              scope="mine"
            />
          ))}
        </ListPanel>

        {/* Lista B: Esperando a terceros */}
        <ListPanel
          title={
            <span style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
              <Hourglass size={14} color="#92400E" />
              <span style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text }}>
                Esperando a terceros
              </span>
            </span>
          }
          count={waitingItems.length}
          scope="waiting"
          loading={loading}
          empty="Sin tareas esperando respuesta de terceros."
        >
          {Object.entries(waitingGroups).map(([role, items]) => (
            <React.Fragment key={role}>
              {/* Cabecera de grupo por rol */}
              <div style={{
                padding: `${spacing[2]}px ${spacing[4]}px`,
                fontSize: 10, fontWeight: font.weight.bold,
                color: color.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                background: color.surfaceAlt,
                borderBottom: `1px solid ${color.borderSubtle}`,
              }}>
                {role} ({items.length})
              </div>
              {items.map((wi) => (
                <ItemRow
                  key={wi.id}
                  wi={wi}
                  projectCode={projectMap[wi.projectId]?.code ?? ""}
                  stateName={stateMap[wi.stateId]?.name ?? wi.stateId}
                  showRole={true}
                  scope="waiting"
                />
              ))}
            </React.Fragment>
          ))}
        </ListPanel>
      </div>
    </div>
  );
};
