// ─────────────────────────────────────────────────────────
//  src/screens/audit/components/AuditTable.tsx
// ─────────────────────────────────────────────────────────

import React from "react";
import { Eye, ShieldAlert } from "lucide-react";
import { color, font, radius, shadow, spacing, transition } from "../../../components/ui/tokens";
import type { AuditEntry, AppUser, Project, WorkItem } from "../../../types/domain";
import { ACTION_LABELS } from "../../../services/auditService";

// ── Helpers ───────────────────────────────────────────────
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function truncate(s: string, n = 60): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── Badges ────────────────────────────────────────────────
const EntityTypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    WorkItem:  { bg: color.primaryBg,  fg: color.primary },
    Project:   { bg: color.successBg,  fg: color.success },
    Evidence:  { bg: "#EDF2FB",        fg: "#2563EB" },
    Risk:      { bg: color.dangerBg,   fg: color.danger },
    Settings:  { bg: color.warningBg,  fg: color.warning },
    RBAC:      { bg: "#FDF4FF",        fg: "#9333EA" },
    User:      { bg: color.surfaceAlt, fg: color.textSecondary },
  };
  const c = colorMap[type] ?? { bg: color.surfaceAlt, fg: color.textMuted };
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px",
      borderRadius: radius.full, background: c.bg, color: c.fg,
      fontSize: font.size.xs, fontWeight: font.weight.semibold,
      whiteSpace: "nowrap",
    }}>
      {type}
    </span>
  );
};

const CriticalPip: React.FC = () => (
  <span title="Cambio crítico" style={{ color: color.danger, display: "inline-flex", alignItems: "center" }}>
    <ShieldAlert size={12} />
  </span>
);

// ── Skeleton ──────────────────────────────────────────────
const SkeletonRow: React.FC = () => (
  <tr>
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} style={{ padding: `${spacing[3]}px ${spacing[4]}px` }}>
        <div style={{ height: 13, borderRadius: radius.xs, background: color.surfaceAlt, width: "70%" }} />
      </td>
    ))}
  </tr>
);

// ── Estilos de tabla ──────────────────────────────────────
const TH: React.CSSProperties = {
  padding: `${spacing[3]}px ${spacing[4]}px`,
  textAlign: "left",
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.textMuted,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: `1px solid ${color.border}`,
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  background: color.surfaceAlt,
  zIndex: 1,
};

const TD: React.CSSProperties = {
  padding: `${spacing[3]}px ${spacing[4]}px`,
  fontSize: font.size.sm,
  color: color.text,
  borderBottom: `1px solid ${color.borderSubtle}`,
  verticalAlign: "middle",
};

// ── Props ─────────────────────────────────────────────────
interface AuditTableProps {
  entries:   AuditEntry[];
  loading:   boolean;
  users:     AppUser[];
  projects:  Project[];
  workItems: WorkItem[];
  onDetail:  (entry: AuditEntry) => void;
}

// ── Componente ────────────────────────────────────────────
export const AuditTable: React.FC<AuditTableProps> = ({
  entries, loading, users, projects, workItems, onDetail,
}) => {
  const userMap     = Object.fromEntries(users.map((u) => [u.id, u.displayName]));
  const projectMap  = Object.fromEntries(projects.map((p) => [p.id, `${p.code}`]));
  const workItemMap = Object.fromEntries(workItems.map((w) => [w.id, w.title]));

  /** Construye el "resumen" legible from→to */
  function buildSummary(entry: AuditEntry): string {
    if (entry.from !== undefined && entry.to !== undefined && (entry.from || entry.to)) {
      const f = entry.from ? truncate(entry.from, 30) : "—";
      const t = entry.to   ? truncate(entry.to, 30)   : "—";
      if (f !== "—" || t !== "—") return `${f} → ${t}`;
    }
    if (entry.note || entry.description) {
      return truncate(entry.note ?? entry.description ?? "", 60);
    }
    return "—";
  }

  /** Etiqueta de referencia de la entidad */
  function entityRef(entry: AuditEntry): string {
    if (entry.entityType === "WorkItem") {
      return workItemMap[entry.entityId] ?? entry.entityId;
    }
    if (entry.entityType === "Project") {
      return projectMap[entry.entityId] ?? entry.entityId;
    }
    return truncate(entry.entityId, 30);
  }

  if (loading) {
    return (
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.md, boxShadow: shadow.xs, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
        </table>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{
        background: color.surface, border: `1px solid ${color.border}`,
        borderRadius: radius.md, boxShadow: shadow.xs,
        padding: `${spacing[8]}px`, textAlign: "center", color: color.textMuted,
      }}>
        <p style={{ fontSize: font.size.md, marginBottom: 4 }}>No se encontraron registros de auditoría</p>
        <p style={{ fontSize: font.size.sm }}>Prueba a cambiar los filtros o el rango de fechas.</p>
      </div>
    );
  }

  return (
    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      overflow: "hidden",
    }}>
      <div style={{ overflowX: "auto", maxHeight: "calc(100vh - 380px)", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: 145 }} />   {/* Fecha */}
            <col style={{ width: 160 }} />   {/* Actor */}
            <col style={{ width: 110 }} />   {/* EntityType */}
            <col style={{ width: 180 }} />   {/* Referencia */}
            <col style={{ width: 160 }} />   {/* Acción */}
            <col />                           {/* Resumen — flexible */}
            <col style={{ width: 60 }}  />   {/* Acciones */}
          </colgroup>
          <thead>
            <tr>
              <th style={TH}>Fecha / Hora</th>
              <th style={TH}>Actor</th>
              <th style={TH}>Tipo</th>
              <th style={TH}>Referencia</th>
              <th style={TH}>Acción</th>
              <th style={TH}>Resumen</th>
              <th style={{ ...TH, textAlign: "center" }}>Det.</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                style={{ transition: `background ${transition.fast}` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = color.surfaceAlt)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Fecha */}
                <td style={TD}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}>
                    {entry.isCritical && <CriticalPip />}
                    <span style={{ fontSize: font.size.xs, color: color.textSecondary }}>
                      {fmtDateTime(entry.at)}
                    </span>
                  </span>
                </td>

                {/* Actor */}
                <td style={TD}>
                  <span style={{ fontWeight: font.weight.medium, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {userMap[entry.who] ?? entry.who}
                  </span>
                  <span style={{ fontSize: font.size.xs, color: color.textMuted }}>{entry.whoRole}</span>
                </td>

                {/* Tipo entidad */}
                <td style={TD}><EntityTypeBadge type={entry.entityType} /></td>

                {/* Referencia */}
                <td style={{ ...TD, color: color.primary }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: font.size.xs, fontWeight: font.weight.medium }}>
                    {entityRef(entry)}
                  </span>
                  {entry.projectId && projectMap[entry.projectId] && (
                    <span style={{ fontSize: font.size.xs, color: color.textMuted }}>
                      {projectMap[entry.projectId]}
                    </span>
                  )}
                </td>

                {/* Acción */}
                <td style={TD}>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 6px",
                    borderRadius: radius.sm,
                    background: entry.isCritical ? color.dangerBg : color.surfaceAlt,
                    color: entry.isCritical ? color.danger : color.textSecondary,
                    fontSize: font.size.xs,
                    fontWeight: font.weight.medium,
                    whiteSpace: "nowrap",
                  }}>
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                </td>

                {/* Resumen */}
                <td style={{ ...TD, color: color.textSecondary }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: font.size.xs }}>
                    {buildSummary(entry)}
                  </span>
                </td>

                {/* Ver detalle */}
                <td style={{ ...TD, textAlign: "center" }}>
                  <button
                    type="button"
                    title="Ver detalle"
                    onClick={() => onDetail(entry)}
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 28, height: 28, border: `1px solid ${color.border}`,
                      borderRadius: radius.sm, background: "transparent",
                      color: color.textSecondary, cursor: "pointer",
                      transition: `all ${transition.fast}`,
                    }}
                  >
                    <Eye size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pie */}
      <div style={{
        padding: `${spacing[3]}px ${spacing[5]}px`,
        borderTop: `1px solid ${color.border}`,
        fontSize: font.size.xs, color: color.textMuted,
        display: "flex", justifyContent: "space-between",
      }}>
        <span>{entries.length} registro{entries.length !== 1 ? "s" : ""}</span>
        <span>{entries.filter((e) => e.isCritical).length} crítico{entries.filter((e) => e.isCritical).length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
};
