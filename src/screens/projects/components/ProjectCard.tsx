// ─────────────────────────────────────────────────────────
//  src/screens/projects/components/ProjectCard.tsx
//  Card visual de un proyecto para la vista "Cards"
// ─────────────────────────────────────────────────────────

import React from "react";
import { AlertTriangle, Briefcase, Building2, UserCheck, User } from "lucide-react";
import type { Project, BusinessArea, Provider } from "../../../types/domain";

// ── Helper de fecha ───────────────────────────────────────────
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ── Tokens de color ────────────────────────────────────────
export const STATUS_COLOR: Record<string, string> = {
  "En curso":  "#0078D4",
  "Pendiente": "#8A8886",
  "Bloqueado": "#D83B01",
  "Cerrado":   "#107C10",
};

export const PRIORITY_COLOR: Record<string, string> = {
  "Alta":  "#D83B01",
  "Media": "#C8A600",
  "Baja":  "#8A8886",
};

// ── Sub-componentes ────────────────────────────────────────
export const Chip: React.FC<{ label: string; color: string; small?: boolean }> = ({ label, color, small }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: small ? "1px 7px" : "2px 9px",
    borderRadius: 20, fontSize: small ? 10 : 11, fontWeight: 600,
    color: "#fff", background: color, whiteSpace: "nowrap", letterSpacing: "0.02em",
  }}>{label}</span>
);

export const ProgressBar: React.FC<{ value: number; height?: number }> = ({ value, height = 6 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{
      flex: 1, height, background: "#EDEBE9", borderRadius: height,
      overflow: "hidden",
    }}>
      <div style={{
        height: "100%",
        width: `${value}%`,
        background: value === 100 ? "#107C10" : value >= 50 ? "#0078D4" : "#C8A600",
        borderRadius: height,
        transition: "width 400ms ease",
      }} />
    </div>
    <span style={{ fontSize: 11, color: "#8A8886", minWidth: 28, textAlign: "right" }}>{value}%</span>
  </div>
);

// ── ProjectCard ────────────────────────────────────────────
interface Props {
  project:        Project;
  area:           BusinessArea | undefined;
  provider:       Provider | undefined;
  /** displayName del responsable asignado (assignedToUserId lookup) */
  assigneeName?:  string;
  /** displayName del solicitante (requestedByUserId lookup) */
  requesterName?: string;
  /** Nombre del equipo responsable (assignedToTeamId lookup) */
  teamName?:      string;
  onClick: () => void;
}

export const ProjectCard: React.FC<Props> = ({ project: p, area, provider, assigneeName, requesterName, teamName, onClick }) => {
  const borderColor = STATUS_COLOR[p.status] ?? "#EDEBE9";

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`Proyecto ${p.name}`}
      style={{
        background: "#fff", borderRadius: 8, cursor: "pointer",
        border: "1px solid #EDEBE9",
        borderTop: `3px solid ${borderColor}`,
        padding: "12px 14px",
        display: "flex", flexDirection: "column", gap: 8,
        transition: "box-shadow 150ms, transform 100ms",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "0 4px 16px rgba(0,0,0,0.11)";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "none";
        el.style.transform = "none";
      }}
    >
      {/* Cabecera: código + estado */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <code style={{ fontSize: 10, color: "#8A8886", letterSpacing: "0.04em", fontFamily: "Consolas, monospace" }}>
          {p.code}
        </code>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Chip label={p.status} color={STATUS_COLOR[p.status] ?? "#8A8886"} small />
        </div>
      </div>

      {/* Nombre */}
      <p style={{
        margin: 0, fontSize: 13, fontWeight: 600, color: "#201F1E",
        lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>
        {p.name}
      </p>

      {/* Área y Ejecutor */}
      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#605E5C", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Building2 size={10} />
          {area?.name ?? p.businessAreaId}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Briefcase size={10} />
          {p.deliveryOwnerType === "Proveedor" && provider
            ? provider.name
            : "IT AirEuropa"}
        </span>
      </div>

      {/* Meta-line: responsable + equipo + rol */}
      {(assigneeName || requesterName || p.assignedToRole) && (
        <div style={{
          display: "flex", gap: 8, fontSize: 10, color: "#8A8886",
          flexWrap: "wrap", alignItems: "center",
        }}>
          {assigneeName && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#323130", fontWeight: 500 }}>
              <UserCheck size={10} color="#0078D4" /> {assigneeName}
            </span>
          )}
          {teamName && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              · {teamName}
            </span>
          )}
          {p.assignedToRole && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "1px 6px", borderRadius: 10, fontSize: 9,
              background: "#EFF6FC", color: "#0078D4",
            }}>
              <User size={8} /> {p.assignedToRole}
            </span>
          )}
          {requesterName && !assigneeName && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#8A8886" }}>
              Solicitado por: {requesterName}
            </span>
          )}
        </div>
      )}

      {/* Prioridad + categoría */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip label={p.priority} color={PRIORITY_COLOR[p.priority] ?? "#8A8886"} small />
        {p.category && (
          <span style={{
            fontSize: 10, padding: "1px 7px", borderRadius: 20,
            border: "1px solid #EDEBE9", color: "#605E5C",
          }}>
            {p.category}
          </span>
        )}
      </div>

      {/* Barra de progreso */}
      <ProgressBar value={p.progress} />

      {/* Fechas */}
      <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#8A8886" }}>
        <span>📅 {fmtDate(p.startDate)}</span>
        <span>→ {fmtDate(p.endDate)}</span>
      </div>

      {/* Bloqueo */}
      {p.blockedReason && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 6,
          background: "#FDF3F0", border: "1px solid #FDCFBC",
          borderRadius: 5, padding: "6px 10px",
          fontSize: 11, color: "#D83B01", lineHeight: 1.4,
        }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{p.blockedReason}</span>
        </div>
      )}
    </article>
  );
};
