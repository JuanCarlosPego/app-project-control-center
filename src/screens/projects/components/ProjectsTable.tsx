// ─────────────────────────────────────────────────────────
//  src/screens/projects/components/ProjectsTable.tsx
//  Vista de tabla densa con quick-actions
// ─────────────────────────────────────────────────────────

import React from "react";
import { KanbanSquare, Map, Pencil, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Project, BusinessArea, Provider } from "../../../types/domain";
import type { AppRole } from "../../../types/domain";
import { Chip, ProgressBar, STATUS_COLOR, PRIORITY_COLOR } from "./ProjectCard";

// ── Helper de fecha ───────────────────────────────────────────
const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";

interface Props {
  projects: Project[];
  areas: BusinessArea[];
  providers: Provider[];
  roles: AppRole[];
  onSelect: (p: Project) => void;
}

export const ProjectsTable: React.FC<Props> = ({ projects, areas, providers, roles, onSelect }) => {
  const navigate = useNavigate();
  const canEdit = roles.includes("Admin") || roles.includes("IT AirEuropa");

  const areaMap = Object.fromEntries(areas.map((a) => [a.id, a.name]));
  const providerMap = Object.fromEntries(providers.map((p) => [p.id, p.name]));

  if (projects.length === 0) return null;

  return (
    <div style={{ overflowX: "auto", borderRadius: 8, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      <table style={{
        width: "100%", borderCollapse: "collapse", fontSize: 12,
        fontFamily: "'Segoe UI', sans-serif", background: "#fff",
      }}>
        <thead>
          <tr style={{ background: "#F3F2F1", borderBottom: "2px solid #EDEBE9" }}>
            {["Código", "Proyecto", "Área", "Ejecutor", "Estado", "Prioridad", "Avance", "Fechas", ""].map((h) => (
              <th key={h} style={{
                padding: "9px 12px", textAlign: "left", fontWeight: 600,
                fontSize: 11, color: "#323130", whiteSpace: "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.id}
              onClick={() => onSelect(p)}
              style={{ borderBottom: "1px solid #F3F2F1", cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#F8F7F6"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
            >
              {/* Código */}
              <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                <code style={{ fontSize: 10, color: "#8A8886", letterSpacing: "0.03em" }}>{p.code}</code>
              </td>

              {/* Nombre + bloqueo */}
              <td style={{ padding: "10px 12px", maxWidth: 300 }}>
                <div style={{ fontWeight: 600, color: "#201F1E", lineHeight: 1.3 }}>{p.name}</div>
                {p.blockedReason && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, fontSize: 10, color: "#D83B01" }}>
                    <AlertTriangle size={10} />
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 240 }}>
                      {p.blockedReason}
                    </span>
                  </div>
                )}
              </td>

              {/* Área */}
              <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#605E5C" }}>
                {areaMap[p.businessAreaId] ?? p.businessAreaId}
              </td>

              {/* Ejecutor */}
              <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#605E5C" }}>
                {p.deliveryOwnerType === "Proveedor" && p.providerId
                  ? <span>{providerMap[p.providerId] ?? p.providerId}</span>
                  : <span style={{ color: "#0078D4" }}>IT AirEuropa</span>
                }
              </td>

              {/* Estado */}
              <td style={{ padding: "10px 12px" }}>
                <Chip label={p.status} color={STATUS_COLOR[p.status] ?? "#8A8886"} small />
              </td>

              {/* Prioridad */}
              <td style={{ padding: "10px 12px" }}>
                <Chip label={p.priority} color={PRIORITY_COLOR[p.priority] ?? "#8A8886"} small />
              </td>

              {/* Avance */}
              <td style={{ padding: "10px 12px", minWidth: 120 }}>
                <ProgressBar value={p.progress} height={5} />
              </td>

              {/* Fechas */}
              <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontSize: 11, color: "#8A8886" }}>
                <div>{fmtDate(p.startDate)}</div>
                <div>{fmtDate(p.endDate)}</div>
              </td>

              {/* Quick actions */}
              <td
                style={{ padding: "10px 12px", whiteSpace: "nowrap" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: "flex", gap: 4 }}>
                  <IconBtn
                    title="Ver Kanban"
                    icon={<KanbanSquare size={13} />}
                    onClick={() => navigate(`/kanban?projectId=${p.id}`)}
                  />
                  <IconBtn
                    title="Ver Roadmap"
                    icon={<Map size={13} />}
                    onClick={() => navigate(`/roadmap?projectId=${p.id}`)}
                  />
                  {canEdit && (
                    <IconBtn
                      title="Editar"
                      icon={<Pencil size={13} />}
                      onClick={() => onSelect(p)}
                      accent
                    />
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── IconBtn ───────────────────────────────────────────────
const IconBtn: React.FC<{
  title: string; icon: React.ReactNode; onClick: () => void; accent?: boolean;
}> = ({ title, icon, onClick, accent }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: 26, height: 26, border: "1px solid #EDEBE9", borderRadius: 4,
      background: "transparent", cursor: "pointer",
      color: accent ? "#0078D4" : "#605E5C",
      transition: "background 120ms",
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#F3F2F1"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
  >
    {icon}
  </button>
);
