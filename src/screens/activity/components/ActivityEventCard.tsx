// ─────────────────────────────────────────────────────────
//  src/screens/activity/components/ActivityEventCard.tsx
//  Tarjeta de un evento del timeline de actividad.
// ─────────────────────────────────────────────────────────

import React from "react";
import {
  ArrowRight, FilePlus, FolderPlus, MessageSquare,
  Settings2, ShieldCheck, GitMerge, AlertTriangle,
  FileText, ChevronRight,
} from "lucide-react";
import { color, font, radius, spacing, shadow, transition } from "../../../components/ui/tokens";
import { ACTION_LABELS, ENTITY_TYPE_LABELS } from "../../../services/activityService";
import type { ActivityLogEntry, Project, WorkItem, AppUser } from "../../../types/domain";

// ── Config de iconos / colores por acción ─────────────────
interface ActionConfig {
  icon:    React.ReactNode;
  dotColor: string;
  dotBg:   string;
  label:   string;
}

function getActionConfig(action: string): ActionConfig {
  switch (action) {
    case "STATE_CHANGED":
      return { icon: <ArrowRight size={14} />,    dotColor: color.primary,  dotBg: color.primaryBg,  label: ACTION_LABELS[action] };
    case "WORKITEM_CREATED":
      return { icon: <FilePlus size={14} />,       dotColor: color.success,  dotBg: color.successBg,  label: ACTION_LABELS[action] };
    case "PROJECT_CREATED":
      return { icon: <FolderPlus size={14} />,     dotColor: color.success,  dotBg: color.successBg,  label: ACTION_LABELS[action] };
    case "EVIDENCE_ADDED":
      return { icon: <FileText size={14} />,       dotColor: "#7530AF",       dotBg: "#F4EFF9",        label: ACTION_LABELS[action] };
    case "COMMENT_ADDED":
    case "JIRA_COMMENT_SENT":
      return { icon: <MessageSquare size={14} />,  dotColor: color.primary,  dotBg: color.primaryBg,  label: ACTION_LABELS[action] };
    case "SETTINGS_CHANGED":
    case "WIP_LIMIT_CHANGED":
      return { icon: <Settings2 size={14} />,      dotColor: color.warning,  dotBg: color.warningBg,  label: ACTION_LABELS[action] ?? action };
    case "RBAC_CHANGED":
    case "RBAC_RESET_TO_DEFAULTS":
      return { icon: <ShieldCheck size={14} />,    dotColor: "#D83B01",       dotBg: color.dangerBg,   label: ACTION_LABELS[action] ?? action };
    default:
      return { icon: <GitMerge size={14} />,       dotColor: color.textMuted, dotBg: color.border,    label: ACTION_LABELS[action] ?? action };
  }
}

const isBlockAction = (log: ActivityLogEntry): boolean =>
  log.action === "STATE_CHANGED" && log.to.toLowerCase().includes("bloquead");

// ── Resolvers de entidad ──────────────────────────────────
function resolveEntityLabel(
  log: ActivityLogEntry,
  workItems: WorkItem[],
  projects: Project[],
): { label: string; key?: string; canOpen: boolean } {
  if (log.entityType === "WorkItem") {
    const wi = workItems.find((w) => w.id === log.entityId);
    return {
      label: wi?.title ?? log.entityId,
      key:   wi?.jiraIssueKey,
      canOpen: !!wi,
    };
  }
  if (log.entityType === "Project") {
    const p = projects.find((pr) => pr.id === log.entityId);
    return { label: p ? `${p.code} — ${p.name}` : log.entityId, canOpen: !!p };
  }
  if (log.entityType === "Evidence") {
    return { label: `Evidencia ${log.entityId}`, canOpen: false };
  }
  return { label: ENTITY_TYPE_LABELS[log.entityType] ?? log.entityType, canOpen: false };
}

function resolveProjectLabel(
  log: ActivityLogEntry,
  projects: Project[],
): string {
  if (!log.projectId) return "—";
  const p = projects.find((pr) => pr.id === log.projectId);
  return p ? p.code : log.projectId;
}

function resolveUserLabel(userId: string, appUsers: AppUser[]): string {
  return appUsers.find((u) => u.id === userId)?.displayName ?? userId;
}

// ── Role badge colors ─────────────────────────────────────
const ROLE_COLOR: Record<string, { c: string; bg: string }> = {
  "Admin":        { c: "#5C2D91", bg: "#F4EFF9" },
  "IT AirEuropa": { c: color.primary, bg: color.primaryBg },
  "Proveedor":    { c: color.success, bg: color.successBg },
  "Usuario":      { c: color.textSecondary, bg: "#F3F2F1" },
  "Invitado":     { c: color.textMuted, bg: color.surfaceAlt },
};

// ── ActivityEventCard ─────────────────────────────────────
export interface ActivityEventCardProps {
  log:       ActivityLogEntry;
  workItems: WorkItem[];
  projects:  Project[];
  appUsers:  AppUser[];
  onOpenWorkItem?: (wi: WorkItem) => void;
  onOpenProject?:  (p: Project)   => void;
}

export const ActivityEventCard: React.FC<ActivityEventCardProps> = ({
  log, workItems, projects, appUsers, onOpenWorkItem, onOpenProject,
}) => {
  const cfg       = getActionConfig(log.action);
  const entity    = resolveEntityLabel(log, workItems, projects);
  const projLabel = resolveProjectLabel(log, projects);
  const userName  = resolveUserLabel(log.who, appUsers);
  const roleStyle = ROLE_COLOR[log.whoRole] ?? { c: color.textMuted, bg: color.border };
  const isBlocked = isBlockAction(log);

  const [hovered, setHovered] = React.useState(false);
  const canClick = entity.canOpen;

  const handleClick = () => {
    if (!canClick) return;
    if (log.entityType === "WorkItem") {
      const wi = workItems.find((w) => w.id === log.entityId);
      if (wi) onOpenWorkItem?.(wi);
    } else if (log.entityType === "Project") {
      const p = projects.find((pr) => pr.id === log.entityId);
      if (p) onOpenProject?.(p);
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role={canClick ? "button" : undefined}
      tabIndex={canClick ? 0 : undefined}
      onKeyDown={(e) => { if (canClick && (e.key === "Enter" || e.key === " ")) handleClick(); }}
      aria-label={canClick ? `Abrir detalle de ${entity.label}` : undefined}
      style={{
        display: "flex",
        gap: spacing[5],
        padding: `${spacing[5]}px ${spacing[6]}px`,
        background: hovered && canClick ? color.surfaceAlt : color.surface,
        border: `1px solid ${isBlocked ? color.dangerBorder : color.border}`,
        borderRadius: radius.md,
        boxShadow: hovered && canClick ? shadow.sm : shadow.xs,
        cursor: canClick ? "pointer" : "default",
        transition: `background ${transition.fast}, box-shadow ${transition.fast}, border-color ${transition.fast}`,
        fontFamily: font.family,
        outline: "none",
      }}
    >
      {/* Dot de acción */}
      <div style={{
        width: 32, height: 32, borderRadius: radius.full,
        background: cfg.dotBg, color: cfg.dotColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, border: `1px solid ${cfg.dotColor}22`,
      }}>
        {cfg.icon}
      </div>

      {/* Cuerpo */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: spacing[1] }}>

        {/* Línea 1: tipo acción + badge bloqueo */}
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3], flexWrap: "wrap" }}>
          <span style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, color: isBlocked ? color.danger : color.text }}>
            {cfg.label}
          </span>
          {isBlocked && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: `1px 7px`, borderRadius: radius.full,
              background: color.dangerBg, border: `1px solid ${color.dangerBorder}`,
              color: color.danger, fontSize: font.size.xs, fontWeight: font.weight.semibold,
            }}>
              <AlertTriangle size={10} /> Bloqueo
            </span>
          )}
        </div>

        {/* Línea 2: entidad + proyecto */}
        <div style={{ display: "flex", alignItems: "center", gap: spacing[4], flexWrap: "wrap" }}>
          {/* Entidad */}
          <span style={{
            fontSize: font.size.md, color: canClick ? color.primary : color.textSecondary,
            fontWeight: canClick ? font.weight.semibold : font.weight.regular,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 340,
            display: "inline-flex", alignItems: "center", gap: spacing[2],
          }}>
            {entity.label}
            {entity.key && (
              <span style={{ fontSize: font.size.xs, color: color.textMuted, fontWeight: font.weight.regular }}>
                [{entity.key}]
              </span>
            )}
            {canClick && <ChevronRight size={12} style={{ flexShrink: 0, color: color.primary }} />}
          </span>

          {/* Proyecto pill */}
          {log.projectId && (
            <span style={{
              fontSize: font.size.xs, fontWeight: font.weight.medium,
              color: color.textMuted, background: color.surfaceAlt,
              border: `1px solid ${color.border}`, borderRadius: radius.xs,
              padding: `1px 6px`, whiteSpace: "nowrap",
            }}>
              {projLabel}
            </span>
          )}
        </div>

        {/* Línea 3: Cambio de estado from → to */}
        {log.action === "STATE_CHANGED" && log.from && log.to && (
          <div style={{ display: "flex", alignItems: "center", gap: spacing[3], marginTop: spacing[1] }}>
            <StatePill label={log.from} variant="from" />
            <ArrowRight size={12} color={color.textMuted} />
            <StatePill label={log.to} variant="to" />
          </div>
        )}

        {/* Línea 3b: Created (from → to) */}
        {(log.action === "WORKITEM_CREATED" || log.action === "PROJECT_CREATED") && log.to && (
          <span style={{ fontSize: font.size.sm, color: color.textMuted, fontStyle: "italic" }}>
            "{log.to.length > 80 ? log.to.slice(0, 80) + "…" : log.to}"
          </span>
        )}

        {/* Línea 3c: Config / RBAC diff */}
        {(log.entityType === "Settings" || log.entityType === "RBAC") && (log.from || log.to) && (
          <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
            {log.from && <code style={{ fontSize: font.size.xs, background: color.dangerBg, color: color.danger, padding: "1px 5px", borderRadius: radius.xs }}>{log.from}</code>}
            {log.from && log.to && <ArrowRight size={11} color={color.textMuted} />}
            {log.to   && <code style={{ fontSize: font.size.xs, background: color.successBg, color: color.success, padding: "1px 5px", borderRadius: radius.xs }}>{log.to}</code>}
          </div>
        )}

        {/* Nota */}
        {log.note && (
          <p style={{ margin: 0, fontSize: font.size.sm, color: color.textSecondary, fontStyle: "italic", marginTop: spacing[1] }}>
            <MessageSquare size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
            {log.note}
          </p>
        )}
      </div>

      {/* Columna derecha: quién + cuándo */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "flex-end",
        gap: spacing[2], flexShrink: 0, minWidth: 140,
      }}>
        <span style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.textSecondary, textAlign: "right" }}>
          {userName}
        </span>
        <span style={{
          padding: "1px 7px", borderRadius: radius.full, fontSize: font.size.xs,
          fontWeight: font.weight.semibold, color: roleStyle.c, background: roleStyle.bg,
          border: `1px solid ${roleStyle.c}22`,
        }}>
          {log.whoRole}
        </span>
        <time dateTime={log.at} style={{ fontSize: font.size.xs, color: color.textMuted, textAlign: "right" }}>
          <RelativeTime iso={log.at} />
        </time>
      </div>
    </div>
  );
};

// ── StatePill ─────────────────────────────────────────────
const STATE_COLORS: Record<string, { c: string; bg: string }> = {
  "Nuevo":               { c: color.primary,        bg: color.primaryBg  },
  "Refinamiento":        { c: "#7530AF",              bg: "#F4EFF9" },
  "En curso":            { c: color.success,          bg: color.successBg  },
  "Bloqueado":           { c: color.danger,           bg: color.dangerBg   },
  "Listo para pruebas":  { c: "#107C10",              bg: "#DFF6DD" },
  "En pruebas":          { c: color.warningAlt,       bg: color.warningBg  },
  "Aceptado":            { c: color.success,          bg: color.successBg  },
  "Cerrado":             { c: color.textSecondary,    bg: "#F3F2F1" },
};

const StatePill: React.FC<{ label: string; variant: "from" | "to" }> = ({ label, variant }) => {
  const s = STATE_COLORS[label] ?? {
    c:  variant === "from" ? color.textMuted  : color.primary,
    bg: variant === "from" ? color.surfaceAlt : color.primaryBg,
  };
  return (
    <span style={{
      padding: "2px 8px", borderRadius: radius.full, fontSize: font.size.xs,
      fontWeight: font.weight.semibold, color: s.c, background: s.bg,
      border: `1px solid ${s.c}22`, whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
};

// ── RelativeTime ──────────────────────────────────────────
const RelativeTime: React.FC<{ iso: string }> = ({ iso }) => {
  const date = new Date(iso);
  const now  = new Date("2026-05-10T12:00:00Z"); // fecha ficticia del sistema
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  const hrs  = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  let relative: string;
  if (mins < 2)       relative = "ahora mismo";
  else if (hrs < 1)   relative = `hace ${mins} min`;
  else if (hrs < 24)  relative = `hace ${hrs} h`;
  else if (days === 1) relative = "ayer";
  else if (days < 7)  relative = `hace ${days} días`;
  else relative = date.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: days > 365 ? "numeric" : undefined });

  const full = date.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" });

  return <span title={full}>{relative}</span>;
};
