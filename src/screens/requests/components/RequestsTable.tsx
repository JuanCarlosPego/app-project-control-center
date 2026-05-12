// ─────────────────────────────────────────────────────────
//  src/screens/requests/components/RequestsTable.tsx
//  Tabla de Solicitudes con chips de estado, tipo y prioridad.
// ─────────────────────────────────────────────────────────

import React from "react";
import { ChevronRight } from "lucide-react";
import type { Request } from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";
import {
  REQUEST_STATUS_COLORS,
  REQUEST_TYPE_COLORS,
  REQUEST_TYPE_LABELS,
  PRIORITY_COLORS,
} from "../../../services/requestService";

interface Props {
  requests: Request[];
  appUsers: AppUser[];
  projects: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string }>;
  onSelect: (r: Request) => void;
}

const CHIP = (label: string, bg: string, color = "#fff"): React.ReactNode => (
  <span style={{
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 99,
    fontSize: 10,
    fontWeight: 600,
    background: bg,
    color,
    whiteSpace: "nowrap",
    fontFamily: "'Segoe UI', sans-serif",
  }}>
    {label}
  </span>
);

const COL: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  color: "#201F1E",
  fontFamily: "'Segoe UI', sans-serif",
  verticalAlign: "middle",
  borderBottom: "1px solid #F3F2F1",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 180,
};

const TH: React.CSSProperties = {
  ...COL,
  fontSize: 11,
  fontWeight: 600,
  color: "#605E5C",
  background: "#FAF9F8",
  borderBottom: "2px solid #EDEBE9",
  position: "sticky" as React.CSSProperties["position"],
  top: 0,
  zIndex: 1,
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return iso.slice(0, 10);
  }
}

export const RequestsTable: React.FC<Props> = ({
  requests, appUsers, projects, teams, onSelect,
}) => {
  const userMap   = new Map(appUsers.map(u => [u.id, u.displayName]));
  const projectMap = new Map(projects.map(p => [p.id, p.name]));
  const teamMap   = new Map(teams.map(t => [t.id, t.name]));

  if (requests.length === 0) {
    return (
      <div style={{
        padding: "48px 0",
        textAlign: "center",
        color: "#8A8886",
        fontSize: 13,
        fontFamily: "'Segoe UI', sans-serif",
      }}>
        No hay solicitudes con los filtros actuales.
      </div>
    );
  }

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #EDEBE9",
      borderRadius: 8,
      overflow: "auto",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: 110 }} />
          <col style={{ width: "auto" }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 90 }} />
          <col style={{ width: 36 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={TH}>Estado</th>
            <th style={{ ...TH, maxWidth: "none" }}>Título</th>
            <th style={TH}>Tipo</th>
            <th style={TH}>Prior.</th>
            <th style={TH}>Equipo</th>
            <th style={TH}>Proyecto</th>
            <th style={TH}>Solicitado por</th>
            <th style={TH}>Fecha</th>
            <th style={TH} />
          </tr>
        </thead>
        <tbody>
          {requests.map(r => (
            <tr
              key={r.id}
              onClick={() => onSelect(r)}
              style={{ cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F3F2F1")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}
            >
              <td style={COL}>
                {CHIP(r.status, REQUEST_STATUS_COLORS[r.status] ?? "#605E5C")}
              </td>
              <td style={{ ...COL, maxWidth: "none", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.title}
              </td>
              <td style={COL}>
                {CHIP(
                  REQUEST_TYPE_LABELS[r.type] ?? r.type,
                  REQUEST_TYPE_COLORS[r.type] ?? "#605E5C",
                )}
              </td>
              <td style={COL}>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: PRIORITY_COLORS[r.priority] ?? "#605E5C",
                }}>
                  {r.priority}
                </span>
              </td>
              <td style={COL}>
                {r.requestedByTeamId ? teamMap.get(r.requestedByTeamId) ?? r.requestedByTeamId : "—"}
              </td>
              <td style={COL}>
                {r.relatedProjectId ? projectMap.get(r.relatedProjectId) ?? r.relatedProjectId : "—"}
              </td>
              <td style={COL}>
                {userMap.get(r.requestedByUserId) ?? r.requestedByUserId}
              </td>
              <td style={COL}>{fmtDate(r.createdOn)}</td>
              <td style={{ ...COL, padding: "10px 6px", color: "#8A8886" }}>
                <ChevronRight size={14} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
