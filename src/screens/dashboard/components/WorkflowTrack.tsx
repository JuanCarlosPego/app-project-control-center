// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/WorkflowTrack.tsx
//  "Flujo de trabajo interactivo"
//  [ Solicitudes ] → [ Backlog ] → [ Kanban ] → [ Cerrado ]
//
//  - Contadores dinámicos desde datos reales
//  - Microcopy siempre visible (no solo en hover)
//  - Sub-indicadores en Kanban: asignadas, bloqueadas, vencidas
//  - Botón "Ver →" explícito en cada fase
//  - Personalización por rol (borde resaltado)
//  - Hover: scale + sombra
//  - Inline styles only
// ─────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { ChevronRight, Inbox, ListChecks, LayoutGrid, CheckCircle2, ArrowRight } from "lucide-react";
import type { WorkItem, Request, AppRole } from "../../../types/domain";

// ── Estados por fase ──────────────────────────────────────
const BACKLOG_STATES   = new Set(["st-new", "st-ref"]);
const KANBAN_STATES    = new Set(["st-prog", "st-blk", "st-rft", "st-test", "st-acc"]);
const CLOSED_STATE     = "st-cls";

// ── Colores por fase ──────────────────────────────────────
const PHASE_THEME = {
  requests: { bg: "#F3F2F1", border: "#C8C6C4", accent: "#605E5C", hover: "#EDEBE9", icon: "#605E5C" },
  backlog:  { bg: "#EFF6FC", border: "#0078D4", accent: "#0050A0", hover: "#DEECF9", icon: "#0078D4" },
  kanban:   { bg: "#FFF8DC", border: "#C17D00", accent: "#7A4F00", hover: "#FFF0A0", icon: "#C17D00" },
  closed:   { bg: "#EFF8F0", border: "#107C10", accent: "#054B05", hover: "#DDEEDD", icon: "#107C10" },
} as const;

type PhaseKey = keyof typeof PHASE_THEME;

// ── Rol → fases resaltadas ────────────────────────────────
function getHighlightedPhases(roles: AppRole[]): PhaseKey[] {
  const isAdmin = roles.includes("Admin") || roles.includes("IT AirEuropa");
  if (isAdmin)                   return ["requests", "backlog"];
  if (roles.includes("Proveedor")) return ["kanban"];
  return ["requests"]; // Usuario
}

// ── Props ─────────────────────────────────────────────────
interface Props {
  workItems: WorkItem[];
  requests: Request[];
  effectiveUserId: string;
  roles: AppRole[];
  onNavigate: (href: string) => void;
}

// ── Component ─────────────────────────────────────────────
export const WorkflowTrack: React.FC<Props> = ({
  workItems, requests, effectiveUserId, roles, onNavigate,
}) => {
  const highlighted = useMemo(() => getHighlightedPhases(roles), [roles]);
  const today = Date.now();

  // ── Contadores ───────────────────────────────────────
  const counts = useMemo(() => {
    const backlog  = workItems.filter((wi) => BACKLOG_STATES.has(wi.stateId)).length;
    const kanban   = workItems.filter((wi) => KANBAN_STATES.has(wi.stateId)).length;
    const closed   = workItems.filter((wi) => wi.stateId === CLOSED_STATE).length;
    const reqs     = requests.length;

    // Kanban sub-indicadores
    const mine     = workItems.filter(
      (wi) => KANBAN_STATES.has(wi.stateId) && wi.assignedToUserId === effectiveUserId,
    ).length;
    const blocked  = workItems.filter((wi) => wi.stateId === "st-blk").length;
    const overdue  = workItems.filter(
      (wi) => KANBAN_STATES.has(wi.stateId) &&
               new Date(wi.endDate).getTime() < today,
    ).length;

    return { reqs, backlog, kanban, closed, mine, blocked, overdue };
  }, [workItems, requests, effectiveUserId, today]);

  return (
    <div style={{
      background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
      padding: "16px 20px", marginBottom: 14,
    }}>
      <p style={{
        margin: "0 0 14px", fontSize: 11, fontWeight: 700, color: "#8A8886",
        textTransform: "uppercase", letterSpacing: "0.07em",
      }}>
        Flujo de trabajo
      </p>

      <div style={{
        display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto",
        paddingBottom: 4,
      }}>
        {/* Solicitudes */}
        <PhaseCardWrapper
          phaseKey="requests"
          icon={<Inbox size={20} />}
          label="Solicitudes"
          count={counts.reqs}
          desc="Peticiones recibidas · pendientes de triaje"
          href="/requests"
          isHighlighted={highlighted.includes("requests")}
          onNavigate={onNavigate}
        />

        <Arrow />

        {/* Backlog */}
        <PhaseCardWrapper
          phaseKey="backlog"
          icon={<ListChecks size={20} />}
          label="Backlog"
          count={counts.backlog}
          desc="Tareas planificadas · pendientes de ejecución"
          href="/backlog?phase=backlog"
          isHighlighted={highlighted.includes("backlog")}
          onNavigate={onNavigate}
        />

        <Arrow />

        {/* Kanban */}
        <PhaseCardWrapper
          phaseKey="kanban"
          icon={<LayoutGrid size={20} />}
          label="Kanban"
          count={counts.kanban}
          desc="Tareas en ejecución activa"
          href="/kanban"
          isHighlighted={highlighted.includes("kanban")}
          onNavigate={onNavigate}
          subIndicators={[
            { label: "mías",        value: counts.mine,    color: "#0078D4", href: "/kanban?assignedToMe=true" },
            { label: "bloqueadas",  value: counts.blocked, color: "#D13438", href: "/kanban?blocked=true" },
            { label: "vencidas",    value: counts.overdue, color: "#C17D00", href: "/kanban?overdue=true" },
          ]}
        />

        <Arrow />

        {/* Cerrado */}
        <PhaseCardWrapper
          phaseKey="closed"
          icon={<CheckCircle2 size={20} />}
          label="Cerrado"
          count={counts.closed}
          desc="Tareas completadas y aceptadas"
          href="/backlog?phase=closed"
          isHighlighted={highlighted.includes("closed")}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
};

// ── PhaseCard props ───────────────────────────────────────
interface SubIndicator {
  label: string;
  value: number;
  color: string;
  href?: string;
}

interface PhaseCardProps {
  phaseKey: PhaseKey;
  icon: React.ReactNode;
  label: string;
  count: number;
  desc: string;
  href: string;
  isHighlighted: boolean;
  subIndicators?: SubIndicator[];
  onNavigate: (href: string) => void;
}

// ── PhaseCardWrapper ──────────────────────────────────────
const PhaseCardWrapper: React.FC<PhaseCardProps> = (props) => {
  const [hov, setHov] = useState(false);
  const theme = PHASE_THEME[props.phaseKey];

  // Label del CTA por fase
  const ctaLabel = props.phaseKey === "requests" ? "Ver solicitudes"
    : props.phaseKey === "backlog"  ? "Ver backlog"
    : props.phaseKey === "kanban"   ? "Ir a Kanban"
    : "Ver cerradas";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: "1 1 0", minWidth: 150,
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 5, padding: "14px 10px 12px",
        borderRadius: 10,
        border: `2px solid ${props.isHighlighted ? theme.border : (hov ? theme.border : "#E1DFDD")}`,
        background: hov ? theme.hover : (props.isHighlighted ? theme.bg : "#FAFAF9"),
        cursor: "pointer",
        fontFamily: "'Segoe UI', sans-serif",
        transform: hov ? "scale(1.04) translateY(-2px)" : "scale(1) translateY(0)",
        transition: "transform 140ms ease, background 120ms, border-color 120ms, box-shadow 140ms",
        boxShadow: hov
          ? `0 4px 14px ${theme.border}40`
          : (props.isHighlighted ? `0 1px 4px ${theme.border}30` : "none"),
        position: "relative",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      {/* Barra superior en fases resaltadas */}
      {props.isHighlighted && (
        <span style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: theme.border, borderRadius: "10px 10px 0 0",
        }} />
      )}

      {/* Icon */}
      <span style={{ color: hov ? theme.accent : theme.icon, lineHeight: 1 }}>
        {props.icon}
      </span>

      {/* Label fase */}
      <span style={{
        fontSize: 10, fontWeight: 700,
        color: hov ? theme.accent : (props.isHighlighted ? theme.accent : "#8A8886"),
        textTransform: "uppercase", letterSpacing: "0.07em",
        whiteSpace: "nowrap",
      }}>
        {props.label}
      </span>

      {/* Contador grande */}
      <span style={{
        fontSize: 30, fontWeight: 900, lineHeight: 1,
        color: hov ? theme.accent : (props.isHighlighted ? theme.accent : "#201F1E"),
      }}>
        {props.count}
      </span>

      {/* Microcopy — siempre visible */}
      <span style={{
        fontSize: 10, color: "#8A8886", textAlign: "center",
        lineHeight: 1.35, maxWidth: 130, minHeight: 26,
      }}>
        {props.desc}
      </span>

      {/* Sub-indicadores (Kanban) */}
      {props.subIndicators && props.subIndicators.length > 0 && (
        <div style={{
          display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center",
          marginTop: 2,
        }}>
          {props.subIndicators.map((si) => (
            <span
              key={si.label}
              onClick={si.href ? (e) => { e.stopPropagation(); props.onNavigate(si.href!); } : undefined}
              style={{
                fontSize: 10, fontWeight: 700,
                color: si.value > 0 ? si.color : "#C8C6C4",
                background: si.value > 0 ? `${si.color}18` : "#F3F2F1",
                border: `1px solid ${si.value > 0 ? si.color : "#E1DFDD"}`,
                borderRadius: 10, padding: "1px 6px",
                whiteSpace: "nowrap",
                cursor: si.href ? "pointer" : "default",
                textDecoration: "none",
                transition: "filter 100ms",
              }}
              onMouseEnter={(e) => { if (si.href) (e.currentTarget as HTMLSpanElement).style.filter = "brightness(0.88)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.filter = "brightness(1)"; }}
              title={si.href ? `Ver ${si.label}` : undefined}
            >
              {si.value > 0 ? (
                si.label === "mías"       ? `\u{1F464} ${si.value}` :
                si.label === "bloqueadas" ? `\u26D4 ${si.value}` :
                si.label === "vencidas"   ? `\u23F0 ${si.value}` :
                `${si.value} ${si.label}`
              ) : `0 ${si.label}`}
            </span>
          ))}
        </div>
      )}

      {/* CTA botón — siempre visible */}
      <button
        onClick={() => props.onNavigate(props.href)}
        style={{
          marginTop: 6,
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 10px", borderRadius: 20,
          border: `1px solid ${theme.border}`,
          background: hov ? theme.border : "#fff",
          color: hov ? "#fff" : theme.accent,
          fontSize: 10, fontWeight: 700,
          fontFamily: "'Segoe UI', sans-serif",
          cursor: "pointer",
          transition: "background 120ms, color 120ms",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
          e.currentTarget.style.background = theme.accent;
          e.currentTarget.style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          e.stopPropagation();
          e.currentTarget.style.background = hov ? theme.border : "#fff";
          e.currentTarget.style.color = hov ? "#fff" : theme.accent;
        }}
      >
        {ctaLabel}
        <ArrowRight size={10} />
      </button>
    </div>
  );
};

// ── Arrow separator ───────────────────────────────────────
const Arrow: React.FC = () => (
  <div style={{
    display: "flex", alignItems: "center",
    padding: "0 4px", flexShrink: 0, color: "#C8C6C4",
  }}>
    <ChevronRight size={20} />
  </div>
);
