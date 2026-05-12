// ─────────────────────────────────────────────────────────
//  src/screens/roadmap/components/RoadmapProjectCard.tsx
//  Card de un proyecto dentro del RoadmapGrid.
//  Incluye: código, estado, progress, fechas, ejecutor,
//  proveedor, bloqueo y chip de vencimiento próximo.
// ─────────────────────────────────────────────────────────

import React from "react";
import { AlertTriangle, Building2, Briefcase, CalendarClock, UserCheck } from "lucide-react";
import type { Project, BusinessArea, Provider } from "../../../types/domain";
import { STATUS_COLOR, PRIORITY_COLOR, DELIVERY_COLOR } from "../tokens";

// ── Sub-componentes reutilizables ─────────────────────────
export const Chip: React.FC<{ label: string; color: string; small?: boolean }> = ({ label, color, small }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: small ? "1px 6px" : "2px 9px",
    borderRadius: 20, fontSize: small ? 10 : 11, fontWeight: 700,
    color: "#fff", background: color, whiteSpace: "nowrap",
    letterSpacing: "0.02em",
  }}>{label}</span>
);

export const ProgressBar: React.FC<{ value: number; height?: number }> = ({ value, height = 5 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div style={{ flex: 1, height, background: "#EDEBE9", borderRadius: height, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${value}%`, borderRadius: height,
        background: value === 100 ? "#107C10" : value >= 50 ? "#0078D4" : "#C8A600",
        transition: "width 400ms ease",
      }} />
    </div>
    <span style={{ fontSize: 10, color: "#8A8886", minWidth: 26, textAlign: "right" }}>{value}%</span>
  </div>
);

// ── Helper ────────────────────────────────────────────────
function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

// ── Props ─────────────────────────────────────────────────
interface Props {
  project:       Project;
  area?:         BusinessArea;
  provider?:     Provider;
  /** displayName del responsable asignado */
  assigneeName?: string;
  /** Nombre del equipo responsable */
  teamName?:     string;
  onClick:       () => void;
}

// ── Component ─────────────────────────────────────────────
export const RoadmapProjectCard: React.FC<Props> = ({ project: p, area, provider, assigneeName, teamName, onClick }) => {
  const days = daysUntil(p.endDate);
  const almostDue = days > 0 && days <= 14 && p.status !== "Cerrado";
  const overdue   = days <= 0 && p.status !== "Cerrado";
  const statusColor = STATUS_COLOR[p.status] ?? "#8A8886";

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`Proyecto ${p.name}`}
      style={{
        background: "#fff",
        border: "1px solid #EDEBE9",
        borderLeft: `4px solid ${statusColor}`,
        borderRadius: 6,
        padding: "12px 14px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transition: "box-shadow 150ms, transform 100ms",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "0 3px 10px rgba(0,0,0,0.12)";
        el.style.transform  = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "none";
        el.style.transform  = "none";
      }}
    >
      {/* Fila superior: código + chips de estado y prioridad */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ fontSize: 10, color: "#8A8886", fontFamily: "monospace", fontWeight: 600 }}>
          {p.code}
        </span>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Chip label={p.status} color={statusColor} small />
          <Chip label={p.priority} color={PRIORITY_COLOR[p.priority] ?? "#8A8886"} small />
        </div>
      </div>

      {/* Nombre */}
      <p style={{
        margin: 0, fontSize: 13, fontWeight: 600, color: "#201F1E",
        lineHeight: 1.35,
        display: "-webkit-box", WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {p.name}
      </p>

      {/* Progress */}
      <ProgressBar value={p.progress} />

      {/* Ejecutor y proveedor */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 10, fontWeight: 600,
          color: DELIVERY_COLOR[p.deliveryOwnerType] ?? "#323130",
        }}>
          {p.deliveryOwnerType === "IT"
            ? <><Briefcase size={10} /> IT AirEuropa</>
            : <><Building2 size={10} /> {provider?.name ?? "Proveedor"}</>
          }
        </span>
        {area && (
          <span style={{ fontSize: 10, color: "#8A8886" }}>· {area.name}</span>
        )}
      </div>

      {/* Meta-line: responsable asignado + equipo + rol */}
      {(assigneeName || teamName || p.assignedToRole) && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, flexWrap: "wrap" }}>
          {assigneeName && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#323130", fontWeight: 500 }}>
              <UserCheck size={9} color="#0078D4" /> {assigneeName}
            </span>
          )}
          {teamName && (
            <span style={{ color: "#8A8886" }}>· {teamName}</span>
          )}
          {p.assignedToRole && (
            <span style={{
              padding: "1px 5px", borderRadius: 8, fontSize: 9,
              background: "#EFF6FC", color: "#0078D4",
            }}>
              {p.assignedToRole}
            </span>
          )}
        </div>
      )}

      {/* Fechas */}
      <div style={{ fontSize: 10, color: "#8A8886", display: "flex", gap: 10 }}>
        <span>📅 {p.startDate}</span>
        <span style={{ color: (almostDue || overdue) ? "#D83B01" : "#8A8886" }}>
          → {p.endDate}
        </span>
      </div>

      {/* Alertas */}
      {overdue && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#D83B01", background: "#FDF3F0", borderRadius: 4, padding: "3px 7px" }}>
          <CalendarClock size={10} /> Vencido hace {Math.abs(days)} días
        </div>
      )}
      {!overdue && almostDue && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#C8A600", background: "#FFFBE6", borderRadius: 4, padding: "3px 7px" }}>
          <CalendarClock size={10} /> Vence en {days} día{days !== 1 ? "s" : ""}
        </div>
      )}
      {p.blockedReason && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "#D83B01", background: "#FDF3F0", borderRadius: 4, padding: "3px 7px" }}>
          <AlertTriangle size={10} /> {p.blockedReason}
        </div>
      )}
    </article>
  );
};
