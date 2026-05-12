// ─────────────────────────────────────────────────────────
//  src/screens/risks/components/RisksTable.tsx
// ─────────────────────────────────────────────────────────

import React from "react";
import { Eye, Pencil, ShieldOff, UserCheck, Hourglass } from "lucide-react";
import { color, font, radius, shadow, spacing, transition } from "../../../components/ui/tokens";
import type { Risk, Project, WorkItem } from "../../../types/domain";
import { agingDays, daysUntilDue } from "../../../services/riskService";
import { isAssignedToMe, isWaitingOnOthers, waitingOnRole } from "../riskSelectors";

// ── Badge de severidad ────────────────────────────────────
const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const map: Record<string, { bg: string; fg: string }> = {
    Alta:  { bg: color.dangerBg,  fg: color.danger },
    Media: { bg: color.warningBg, fg: color.warning },
    Baja:  { bg: color.primaryBg, fg: color.primary },
  };
  const s = map[severity] ?? { bg: color.surfaceAlt, fg: color.textMuted };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: radius.full,
      background: s.bg,
      color: s.fg,
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
    }}>
      {severity}
    </span>
  );
};

// ── Badge de estado ───────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; fg: string }> = {
    "Abierto":        { bg: color.dangerBg,  fg: color.danger },
    "En mitigación":  { bg: color.warningBg, fg: color.warning },
    "Resuelto":       { bg: color.successBg, fg: color.success },
  };
  const s = map[status] ?? { bg: color.surfaceAlt, fg: color.textMuted };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: radius.full,
      background: s.bg,
      color: s.fg,
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
    }}>
      {status}
    </span>
  );
};

// ── Celda de fecha límite con color ───────────────────────
const DueDateCell: React.FC<{ dueDate: string }> = ({ dueDate }) => {
  const days = daysUntilDue(dueDate);
  let fg = color.text;
  if (days <= 0)  fg = color.danger;
  else if (days <= 7)  fg = color.danger;
  else if (days <= 14) fg = color.warning;
  const label = new Date(dueDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" });
  return (
    <span style={{ color: fg, fontSize: font.size.sm, fontWeight: days <= 14 ? font.weight.semibold : font.weight.regular }}>
      {label}
      {days <= 0 && <span style={{ marginLeft: 4, fontSize: font.size.xs }}>(vencido)</span>}
      {days > 0 && days <= 14 && (
        <span style={{ marginLeft: 4, fontSize: font.size.xs }}>({days}d)</span>
      )}
    </span>
  );
};

// ── Skeleton row ──────────────────────────────────────────
const SkeletonRow: React.FC<{ cols: number }> = ({ cols }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: `${spacing[3]}px ${spacing[4]}px` }}>
        <div style={{
          height: 14, borderRadius: radius.xs,
          background: color.surfaceAlt, width: "70%",
          animation: "pulse 1.2s ease-in-out infinite",
        }} />
      </td>
    ))}
  </tr>
);

// ── Props ─────────────────────────────────────────────────
interface RisksTableProps {
  risks:         Risk[];
  projects:      Project[];
  workItems:     WorkItem[];
  loading:       boolean;
  canEdit:       boolean;
  currentUserId: string;
  onView:        (risk: Risk) => void;
  onEdit:        (risk: Risk) => void;
  onClose:       (risk: Risk) => void;
}

const TH_STYLE: React.CSSProperties = {
  padding: `${spacing[3]}px ${spacing[4]}px`,
  textAlign: "left",
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: `1px solid ${color.border}`,
  whiteSpace: "nowrap",
};

const TD_STYLE: React.CSSProperties = {
  padding: `${spacing[3]}px ${spacing[4]}px`,
  fontSize: font.size.sm,
  color: color.text,
  borderBottom: `1px solid ${color.borderSubtle}`,
  verticalAlign: "middle",
};

// ── Componente ────────────────────────────────────────────
export const RisksTable: React.FC<RisksTableProps> = ({
  risks, projects, workItems, loading, canEdit, currentUserId, onView, onEdit, onClose,
}) => {
  const projectMap  = Object.fromEntries(projects.map((p) => [p.id, p]));
  const workItemMap = Object.fromEntries(workItems.map((w) => [w.id, w]));

  const COLS = 10; // nº de columnas para el skeleton

  if (loading) {
    return (
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, boxShadow: shadow.xs, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={COLS} />)}</tbody>
        </table>
      </div>
    );
  }

  if (risks.length === 0) {
    return (
      <div style={{
        background: color.surface, border: `1px solid ${color.border}`,
        borderRadius: radius.md, boxShadow: shadow.xs,
        padding: `${spacing[8]}px`, textAlign: "center", color: color.textMuted,
      }}>
        <p style={{ fontSize: font.size.md, marginBottom: 4 }}>No se encontraron riesgos</p>
        <p style={{ fontSize: font.size.sm }}>Prueba a cambiar los filtros o crea un nuevo riesgo.</p>
      </div>
    );
  }

  return (
    <div style={{
      background: color.surface, border: `1px solid ${color.border}`,
      borderRadius: radius.md, boxShadow: shadow.xs, overflow: "hidden",
    }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: color.surfaceAlt }}>
            <tr>
              <th style={TH_STYLE}>Severidad</th>
              <th style={{ ...TH_STYLE, minWidth: 200 }}>Título</th>
              <th style={TH_STYLE}>Proyecto</th>
              <th style={TH_STYLE}>WorkItem</th>
              <th style={TH_STYLE}>Responsable</th>
              <th style={TH_STYLE}>Esperando a</th>
              <th style={TH_STYLE}>Fecha límite</th>
              <th style={{ ...TH_STYLE, textAlign: "right" }}>Aging</th>
              <th style={TH_STYLE}>Estado</th>
              <th style={{ ...TH_STYLE, textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {risks.map((risk) => {
              const project  = projectMap[risk.projectId];
              const workItem = risk.linkedWorkItemId ? workItemMap[risk.linkedWorkItemId] : undefined;
              const aging    = agingDays(risk.createdOn ?? risk.dueDate);
              const resolved = risk.status === "Resuelto";
              const isMine    = isAssignedToMe(risk, workItem, currentUserId);
              const isWaiting = isWaitingOnOthers(risk, workItem, project, currentUserId);
              const waitRole  = waitingOnRole(risk, workItem);

              return (
                <tr
                  key={risk.id}
                  style={{ transition: `background ${transition.fast}` }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = color.surfaceAlt)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Severidad */}
                  <td style={TD_STYLE}><SeverityBadge severity={risk.severity} /></td>

                  {/* Título */}
                  <td style={{ ...TD_STYLE, maxWidth: 260 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
                      {isMine && (
                        <span title="Asignado a mí" style={{ flexShrink: 0 }}>
                          <UserCheck size={12} color={color.primary} />
                        </span>
                      )}
                      {isWaiting && !isMine && (
                        <span title="Esperando a terceros" style={{ flexShrink: 0 }}>
                          <Hourglass size={12} color="#92400E" />
                        </span>
                      )}
                      <span style={{
                        fontWeight: font.weight.medium,
                        overflow: "hidden", textOverflow: "ellipsis",
                        whiteSpace: "nowrap", display: "block",
                      }}>
                        {risk.title}
                      </span>
                    </div>
                  </td>

                  {/* Proyecto */}
                  <td style={TD_STYLE}>
                    <span style={{ color: color.primary, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>
                      {project?.code ?? risk.projectId}
                    </span>
                  </td>

                  {/* WorkItem */}
                  <td style={TD_STYLE}>
                    {workItem ? (
                      <span style={{ fontSize: font.size.xs, color: color.textSecondary }}>{workItem.title}</span>
                    ) : (
                      <span style={{ color: color.textMuted, fontSize: font.size.xs }}>—</span>
                    )}
                  </td>

                  {/* Responsable */}
                  <td style={TD_STYLE}>
                    <span style={{ fontSize: font.size.xs, color: color.textSecondary }}>{risk.ownerRole}</span>
                  </td>

                  {/* Esperando a (rol del WI vinculado) */}
                  <td style={TD_STYLE}>
                    {waitRole ? (
                      <span style={{
                        padding: "2px 7px", borderRadius: radius.full,
                        fontSize: 10, fontWeight: font.weight.semibold,
                        background: waitRole === "Proveedor" ? color.successBg
                          : waitRole === "IT AirEuropa" ? color.primaryBg
                          : color.warningBg,
                        color: waitRole === "Proveedor" ? color.success
                          : waitRole === "IT AirEuropa" ? color.primary
                          : "#92400E",
                      }}>
                        {waitRole}
                      </span>
                    ) : (
                      <span style={{ color: color.textMuted, fontSize: font.size.xs }}>—</span>
                    )}
                  </td>

                  {/* Fecha límite */}
                  <td style={TD_STYLE}><DueDateCell dueDate={risk.dueDate} /></td>

                  {/* Aging */}
                  <td style={{ ...TD_STYLE, textAlign: "right" }}>
                    {resolved ? (
                      <span style={{ color: color.textMuted, fontSize: font.size.xs }}>—</span>
                    ) : (
                      <span style={{ fontVariantNumeric: "tabular-nums", color: aging > 30 ? color.danger : color.textSecondary }}>
                        {aging}d
                      </span>
                    )}
                  </td>

                  {/* Estado */}
                  <td style={TD_STYLE}><StatusBadge status={risk.status} /></td>

                  {/* Acciones */}
                  <td style={{ ...TD_STYLE, textAlign: "center", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", gap: spacing[2] }}>
                      {/* Ver */}
                      <ActionBtn icon={<Eye size={13} />} label="Ver" onClick={() => onView(risk)} />
                      {/* Editar — solo si canEdit y no resuelto */}
                      {canEdit && !resolved && (
                        <ActionBtn icon={<Pencil size={13} />} label="Editar" onClick={() => onEdit(risk)} />
                      )}
                      {/* Cerrar */}
                      {canEdit && !resolved && (
                        <ActionBtn icon={<ShieldOff size={13} />} label="Cerrar" danger onClick={() => onClose(risk)} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pie de tabla */}
      <div style={{
        padding: `${spacing[3]}px ${spacing[5]}px`,
        borderTop: `1px solid ${color.border}`,
        fontSize: font.size.xs,
        color: color.textMuted,
      }}>
        {risks.length} resultado{risks.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
};

// ── Botón de acción ───────────────────────────────────────
const ActionBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon, label, danger = false, onClick }) => (
  <button
    type="button"
    title={label}
    onClick={onClick}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      height: 26,
      padding: `0 ${spacing[2]}px`,
      fontSize: font.size.xs,
      borderRadius: radius.sm,
      border: `1px solid ${danger ? color.dangerBorder : color.border}`,
      background: danger ? color.dangerBg : "transparent",
      color: danger ? color.danger : color.textSecondary,
      cursor: "pointer",
      transition: `all ${transition.fast}`,
    }}
  >
    {icon}
    <span>{label}</span>
  </button>
);
