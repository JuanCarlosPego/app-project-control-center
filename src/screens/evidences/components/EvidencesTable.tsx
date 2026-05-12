// ─────────────────────────────────────────────────────────
//  src/screens/evidences/components/EvidencesTable.tsx
//  Tabla de evidencias con acciones contextuales.
// ─────────────────────────────────────────────────────────

import React from "react";
import {
  Link2, MessageSquare, FileText, ExternalLink, Copy,
  Eye, CheckCircle2, ChevronRight,
} from "lucide-react";
import { color, font, radius, spacing, shadow, transition } from "../../../components/ui/tokens";
import { EVIDENCE_TYPE_LABELS } from "../../../services/evidenceService";
import type { Evidence, Project, WorkItem, AppUser, State } from "../../../types/domain";

// ── Icon por tipo ─────────────────────────────────────────
const TYPE_ICONS: Record<string, React.ReactNode> = {
  link:    <Link2 size={13} />,
  comment: <MessageSquare size={13} />,
  file:    <FileText size={13} />,
};

const TYPE_COLORS: Record<string, { c: string; bg: string }> = {
  link:    { c: color.primary,       bg: color.primaryBg  },
  comment: { c: color.textSecondary, bg: "#F3F2F1"        },
  file:    { c: "#7530AF",            bg: "#F4EFF9"        },
};

// ── Helpers ───────────────────────────────────────────────
const STATE_COLOR: Record<string, { c: string; bg: string }> = {
  "st-new":  { c: "#0078D4", bg: "#EFF6FC" },
  "st-ref":  { c: "#7530AF", bg: "#F4EFF9" },
  "st-prog": { c: "#107C10", bg: "#E1EFDD" },
  "st-blk":  { c: "#D13438", bg: "#FDE7E9" },
  "st-rft":  { c: "#107C10", bg: "#E8F5E9" },
  "st-test": { c: "#835B00", bg: "#FFF4CE" },
  "st-acc":  { c: "#107C10", bg: "#DFF6DD" },
  "st-cls":  { c: "#605E5C", bg: "#E8E8E8" },
};

// ── Props ─────────────────────────────────────────────────
export interface EvidencesTableProps {
  evidences:  Evidence[];
  projects:   Project[];
  workItems:  WorkItem[];
  appUsers:   AppUser[];
  states:     State[];
  onOpenWorkItem?: (wi: WorkItem) => void;
  onCopyLink?:     (ev: Evidence) => void;
}

// ── EvidencesTable ────────────────────────────────────────
export const EvidencesTable: React.FC<EvidencesTableProps> = ({
  evidences, projects, workItems, appUsers, states, onOpenWorkItem, onCopyLink,
}) => {
  const projMap  = React.useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const wiMap    = React.useMemo(() => Object.fromEntries(workItems.map((w) => [w.id, w])), [workItems]);
  const userMap  = React.useMemo(() => Object.fromEntries(appUsers.map((u) => [u.id, u])), [appUsers]);
  const stateMap = React.useMemo(() => Object.fromEntries(states.map((s) => [s.id, s])), [states]);

  const [copied, setCopied] = React.useState<string | null>(null);

  const handleCopy = (ev: Evidence) => {
    if (ev.type === "link" && ev.value) {
      navigator.clipboard.writeText(ev.value).catch(() => null);
    } else {
      navigator.clipboard.writeText(ev.comment || ev.value).catch(() => null);
    }
    setCopied(ev.id);
    setTimeout(() => setCopied(null), 2000);
    onCopyLink?.(ev);
  };

  return (
    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      overflow: "hidden",
      fontFamily: font.family,
    }}>
      {/* Cabecera */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: color.surfaceAlt, borderBottom: `1px solid ${color.border}` }}>
            {["Fecha", "Tipo", "Proyecto", "Tarea", "Estado", "Autor", "Contenido", "Acciones"].map((h) => (
              <th key={h} style={{
                padding: `${spacing[3]}px ${spacing[4]}px`,
                textAlign: "left", fontSize: font.size.xs,
                fontWeight: font.weight.semibold, color: color.textMuted,
                whiteSpace: "nowrap",
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {evidences.map((ev, idx) => (
            <EvidenceRow
              key={ev.id}
              ev={ev}
              isEven={idx % 2 === 0}
              projMap={projMap}
              wiMap={wiMap}
              userMap={userMap}
              stateMap={stateMap}
              onOpenWorkItem={onOpenWorkItem}
              onCopy={() => handleCopy(ev)}
              isCopied={copied === ev.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Fila de evidencia ─────────────────────────────────────
interface RowProps {
  ev:     Evidence;
  isEven: boolean;
  projMap:  Record<string, Project>;
  wiMap:    Record<string, WorkItem>;
  userMap:  Record<string, AppUser>;
  stateMap: Record<string, State>;
  onOpenWorkItem?: (wi: WorkItem) => void;
  onCopy: () => void;
  isCopied: boolean;
}

const EvidenceRow: React.FC<RowProps> = ({
  ev, isEven, projMap, wiMap, userMap, stateMap, onOpenWorkItem, onCopy, isCopied,
}) => {
  const [hovered, setHovered] = React.useState(false);
  const wi     = ev.entityType === "WorkItem" ? wiMap[ev.entityId] : undefined;
  const proj   = wi ? projMap[wi.projectId] : (ev.entityType === "Project" ? projMap[ev.entityId] : undefined);
  const author = userMap[ev.createdBy];
  const state  = wi ? stateMap[wi.stateId] : undefined;
  const stClr  = wi ? (STATE_COLOR[wi.stateId] ?? { c: color.textMuted, bg: "#F3F2F1" }) : null;
  const typClr = TYPE_COLORS[ev.type] ?? { c: color.textMuted, bg: "#F3F2F1" };

  const canOpen = !!wi;

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? color.surfaceAlt : (isEven ? color.surface : "#FAFAFA"),
        borderBottom: `1px solid ${color.borderSubtle}`,
        transition: `background ${transition.fast}`,
      }}
    >
      {/* Fecha */}
      <td style={{ padding: `${spacing[3]}px ${spacing[4]}px`, fontSize: font.size.sm, color: color.textMuted, whiteSpace: "nowrap", verticalAlign: "middle" }}>
        <time dateTime={ev.createdOn}>
          {new Date(ev.createdOn).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
        </time>
        <div style={{ fontSize: font.size.xs, color: color.textMuted, marginTop: 1 }}>
          {new Date(ev.createdOn).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </td>

      {/* Tipo */}
      <td style={{ padding: `${spacing[3]}px ${spacing[4]}px`, verticalAlign: "middle" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: spacing[2],
          padding: "2px 8px", borderRadius: radius.full,
          fontSize: font.size.xs, fontWeight: font.weight.semibold,
          color: typClr.c, background: typClr.bg, border: `1px solid ${typClr.c}22`,
          whiteSpace: "nowrap",
        }}>
          {TYPE_ICONS[ev.type]}
          {EVIDENCE_TYPE_LABELS[ev.type]}
        </span>
      </td>

      {/* Proyecto */}
      <td style={{ padding: `${spacing[3]}px ${spacing[4]}px`, verticalAlign: "middle" }}>
        {proj ? (
          <div>
            <div style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.textMuted }}>{proj.code}</div>
            <div style={{ fontSize: font.size.sm, color: color.textSecondary, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</div>
          </div>
        ) : <span style={{ color: color.textMuted, fontSize: font.size.sm }}>—</span>}
      </td>

      {/* Tarea */}
      <td style={{ padding: `${spacing[3]}px ${spacing[4]}px`, verticalAlign: "middle", maxWidth: 200 }}>
        {wi ? (
          <button
            onClick={() => canOpen && onOpenWorkItem?.(wi)}
            title={canOpen ? "Abrir detalle de la tarea" : undefined}
            style={{
              background: "none", border: "none", cursor: canOpen ? "pointer" : "default",
              padding: 0, textAlign: "left", fontFamily: font.family,
            }}>
            <div style={{
              fontSize: font.size.sm, color: canOpen ? color.primary : color.text,
              fontWeight: canOpen ? font.weight.semibold : font.weight.regular,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190,
              display: "flex", alignItems: "center", gap: spacing[1],
            }}>
              {wi.title}
              {canOpen && <ChevronRight size={11} style={{ flexShrink: 0 }} />}
            </div>
            {wi.jiraIssueKey && (
              <div style={{ fontSize: font.size.xs, color: color.textMuted }}>{wi.jiraIssueKey}</div>
            )}
          </button>
        ) : <span style={{ color: color.textMuted, fontSize: font.size.sm }}>—</span>}
      </td>

      {/* Estado de la tarea */}
      <td style={{ padding: `${spacing[3]}px ${spacing[4]}px`, verticalAlign: "middle" }}>
        {state && stClr ? (
          <span style={{
            display: "inline-block", padding: "2px 8px", borderRadius: radius.full,
            fontSize: font.size.xs, fontWeight: font.weight.semibold,
            color: stClr.c, background: stClr.bg, border: `1px solid ${stClr.c}22`,
            whiteSpace: "nowrap",
          }}>
            {state.name}
          </span>
        ) : <span style={{ color: color.textMuted, fontSize: font.size.sm }}>—</span>}
      </td>

      {/* Autor */}
      <td style={{ padding: `${spacing[3]}px ${spacing[4]}px`, verticalAlign: "middle" }}>
        <div style={{ fontSize: font.size.sm, fontWeight: font.weight.medium, color: color.text, whiteSpace: "nowrap" }}>
          {author?.displayName ?? ev.createdBy}
        </div>
        {author && (
          <div style={{ fontSize: font.size.xs, color: color.textMuted }}>{author.role}</div>
        )}
      </td>

      {/* Contenido */}
      <td style={{ padding: `${spacing[3]}px ${spacing[4]}px`, verticalAlign: "middle", maxWidth: 260 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
          {ev.type === "link" && ev.value && (
            <a href={ev.value} target="_blank" rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: spacing[2],
                fontSize: font.size.sm, color: color.primary,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240,
              }}>
              <ExternalLink size={11} />
              {ev.value.length > 40 ? ev.value.slice(0, 40) + "…" : ev.value}
            </a>
          )}
          {ev.type === "file" && ev.value && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: spacing[2],
              fontSize: font.size.sm, color: color.text,
            }}>
              <FileText size={11} color={color.textMuted} />
              {ev.value}
            </span>
          )}
          {ev.comment && (
            <p style={{
              margin: 0, fontSize: font.size.sm, color: color.textSecondary,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 250,
              fontStyle: ev.type === "comment" ? "italic" : undefined,
            }}>
              {ev.comment}
            </p>
          )}
        </div>
      </td>

      {/* Acciones */}
      <td style={{ padding: `${spacing[3]}px ${spacing[4]}px`, verticalAlign: "middle" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
          {/* Ver tarea */}
          {canOpen && (
            <IconButton title="Ver tarea" onClick={() => onOpenWorkItem?.(wi!)}>
              <Eye size={13} />
            </IconButton>
          )}

          {/* Abrir enlace externo */}
          {ev.type === "link" && ev.value && (
            <a href={ev.value} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: radius.sm, border: `1px solid ${color.border}`, background: color.surface, color: color.textMuted, cursor: "pointer", textDecoration: "none" }}
              title="Abrir enlace">
              <ExternalLink size={13} />
            </a>
          )}

          {/* Copiar */}
          <IconButton title={isCopied ? "Copiado" : "Copiar"} onClick={onCopy}>
            {isCopied ? <CheckCircle2 size={13} color={color.success} /> : <Copy size={13} />}
          </IconButton>
        </div>
      </td>
    </tr>
  );
};

// ── IconButton ────────────────────────────────────────────
const IconButton: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({
  title, onClick, children,
}) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, borderRadius: radius.sm,
        border: `1px solid ${hov ? color.primary : color.border}`,
        background: hov ? color.primaryBg : color.surface,
        color: hov ? color.primary : color.textMuted,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        transition: `all ${transition.fast}`,
      }}>
      {children}
    </button>
  );
};
