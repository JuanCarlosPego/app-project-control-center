// ─────────────────────────────────────────────────────────
//  src/screens/risks/components/RiskDrawer.tsx
//  Panel lateral de detalle para un riesgo.
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import { X, ExternalLink, Clock, AlertTriangle, CalendarX2, Bell, UserCheck, Hourglass } from "lucide-react";
import { color, font, radius, shadow, spacing, transition, zIndex } from "../../../components/ui/tokens";
import type { Risk, Project, WorkItem, State, Transition, AppRole, ActivityLogEntry } from "../../../types/domain";
import { agingDays, daysUntilDue, closeRisk } from "../../../services/riskService";
import { WorkItemDrawer } from "../../kanban/components/WorkItemDrawer";
import { useEffectiveUser } from "../../../auth/ImpersonationContext";

// ── Helpers de formato ────────────────────────────────────
function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

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
      display: "inline-block", padding: "2px 10px",
      borderRadius: radius.full, background: s.bg, color: s.fg,
      fontSize: font.size.xs, fontWeight: font.weight.semibold,
    }}>
      {severity}
    </span>
  );
};

// ── Sección ───────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p style={{
      margin: `0 0 ${spacing[3]}px`,
      fontSize: font.size.xs,
      fontWeight: font.weight.semibold,
      color: color.textMuted,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    }}>{title}</p>
    {children}
  </div>
);

// ── Row de metadato ───────────────────────────────────────
const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: spacing[3], marginBottom: spacing[2] }}>
    <span style={{ minWidth: 110, fontSize: font.size.xs, color: color.textMuted }}>{label}</span>
    <span style={{ fontSize: font.size.sm, color: color.text, fontWeight: font.weight.medium }}>{children}</span>
  </div>
);

// ── Props ─────────────────────────────────────────────────
interface RiskDrawerProps {
  risk:         Risk | null;
  projects:     Project[];
  workItems:    WorkItem[];
  states:       State[];
  transitions:  Transition[];
  activityLog:  ActivityLogEntry[];
  onClose:      () => void;
  onEdit:       (risk: Risk) => void;
  onClosed:     (updated: Risk) => void;   // tras cerrar el riesgo
  canEdit:      boolean;
}

// ── Componente ────────────────────────────────────────────
export const RiskDrawer: React.FC<RiskDrawerProps> = ({
  risk, projects, workItems, states, transitions, activityLog,
  onClose, onEdit, onClosed, canEdit,
}) => {
  const { roles, user: currentUser } = useEffectiveUser();
  const [closeMode, setCloseMode]     = useState(false);
  const [comment, setComment]         = useState("");
  const [commentErr, setCommentErr]   = useState("");
  const [saving, setSaving]           = useState(false);
  const [wiDrawerOpen, setWiDrawerOpen] = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  if (!risk) return null;

  const project  = projects.find((p) => p.id === risk.projectId);
  const workItem = risk.linkedWorkItemId
    ? workItems.find((w) => w.id === risk.linkedWorkItemId)
    : undefined;

  const aging    = agingDays((risk as { createdOn?: string }).createdOn ?? risk.dueDate);
  const daysLeft = daysUntilDue(risk.dueDate);
  const resolved = risk.status === "Resuelto";

  // Solicitante: quién creó el riesgo (puede ser el usuario actual)
  const isMyRisk = risk.createdBy === currentUser?.id;
  // Owner assignee
  const assigneeId = risk.assignedToUserId ?? workItem?.assignedToUserId;

  // Historial de actividad relacionado con este riesgo
  const riskLog = activityLog
    .filter((e) => e.entityId === risk.id)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // ── Cerrar riesgo ─────────────────────────────────────────
  async function handleClose() {
    if (!comment.trim()) { setCommentErr("El comentario es obligatorio para cerrar el riesgo"); return; }
    setSaving(true);
    try {
      const updated = await closeRisk(risk.id, { closeComment: comment.trim() });
      setCloseMode(false);
      setComment("");
      onClosed(updated as unknown as Risk);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: zIndex.drawer - 1,
        }}
      />

      {/* Panel */}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(520px, 90vw)",
        background: color.surface,
        borderLeft: `1px solid ${color.border}`,
        boxShadow: shadow.xl,
        zIndex: zIndex.drawer,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: `${spacing[6]}px`,
          borderBottom: `1px solid ${color.border}`,
          gap: spacing[3],
          position: "sticky", top: 0, background: color.surface, zIndex: 1,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: 4 }}>
              <SeverityBadge severity={risk.severity} />
              <span style={{
                display: "inline-block", padding: "2px 8px",
                borderRadius: radius.full,
                background: resolved ? color.successBg : risk.status === "En mitigación" ? color.warningBg : color.dangerBg,
                color: resolved ? color.success : risk.status === "En mitigación" ? color.warning : color.danger,
                fontSize: font.size.xs, fontWeight: font.weight.semibold,
              }}>
                {risk.status}
              </span>
            </div>
            <h2 style={{
              margin: 0, fontSize: font.size.md,
              fontWeight: font.weight.semibold, color: color.text,
              wordBreak: "break-word",
            }}>
              {risk.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, border: "none", background: "transparent",
              borderRadius: radius.sm, cursor: "pointer", color: color.textMuted,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, padding: `${spacing[6]}px`, display: "flex", flexDirection: "column", gap: spacing[6] }}>

          {/* Alerta de vencimiento */}
          {!resolved && daysLeft <= 7 && (
            <div style={{
              display: "flex", alignItems: "center", gap: spacing[3],
              padding: `${spacing[3]}px ${spacing[4]}px`,
              background: daysLeft <= 0 ? color.dangerBg : color.warningBg,
              border: `1px solid ${daysLeft <= 0 ? color.dangerBorder : color.warning}`,
              borderRadius: radius.sm,
              color: daysLeft <= 0 ? color.danger : color.warning,
              fontSize: font.size.sm,
              fontWeight: font.weight.medium,
            }}>
              {daysLeft <= 0
                ? <><CalendarX2 size={14} /> Riesgo vencido hace {Math.abs(daysLeft)} días</>
                : <><AlertTriangle size={14} /> Vence en {daysLeft} día{daysLeft !== 1 ? "s" : ""}</>
              }
            </div>
          )}

          {/* Metadatos */}
          <Section title="Información">
            <MetaRow label="Proyecto">{project ? `${project.code} — ${project.name}` : risk.projectId}</MetaRow>
            <MetaRow label="Responsable (rol)">{risk.ownerRole}</MetaRow>
            {assigneeId && (
              <MetaRow label="Asignado a">
                <span style={{ fontFamily: "monospace", fontSize: font.size.xs, color: color.primary }}>
                  {assigneeId}
                </span>
              </MetaRow>
            )}
            <MetaRow label="Solicitante">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {isMyRisk
                  ? <><UserCheck size={12} color={color.primary} /> Yo ({risk.createdBy})</>
                  : risk.createdBy}
              </span>
            </MetaRow>
            <MetaRow label="Fecha límite">{fmtDate(risk.dueDate)}</MetaRow>
            {!resolved && (
              <MetaRow label="Aging">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: aging > 30 ? color.danger : color.textSecondary }}>
                  <Clock size={12} /> {aging} día{aging !== 1 ? "s" : ""}
                </span>
              </MetaRow>
            )}
            {(risk as { createdOn?: string }).createdOn && (
              <MetaRow label="Creado">{fmtDateTime((risk as { createdOn?: string }).createdOn!)}</MetaRow>
            )}
            {/* Indicador personal */}
            {workItem && workItem.assignedToRole && workItem.assignedToRole !== currentUser?.role && (
              <MetaRow label="Esperando a">
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "2px 8px", borderRadius: radius.full,
                  fontSize: 10, fontWeight: font.weight.semibold,
                  background: color.warningBg, color: "#92400E",
                }}>
                  <Hourglass size={10} /> {workItem.assignedToRole}
                </span>
              </MetaRow>
            )}
          </Section>

          {/* Descripción */}
          {(risk as { description?: string }).description && (
            <Section title="Descripción">
              <p style={{ margin: 0, fontSize: font.size.sm, color: color.textSecondary, lineHeight: 1.6 }}>
                {(risk as { description?: string }).description}
              </p>
            </Section>
          )}

          {/* WorkItem vinculado */}
          {workItem && (
            <Section title="WorkItem vinculado">
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: `${spacing[3]}px ${spacing[4]}px`,
                background: color.primaryBg,
                border: `1px solid ${color.border}`,
                borderRadius: radius.sm,
              }}>
                <span style={{ fontSize: font.size.sm, color: color.text, fontWeight: font.weight.medium }}>
                  {workItem.title}
                </span>
                <button
                  type="button"
                  onClick={() => setWiDrawerOpen(true)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: font.size.xs, color: color.primary,
                    background: "transparent", border: "none", cursor: "pointer",
                    padding: `2px ${spacing[2]}px`,
                  }}
                >
                  <ExternalLink size={12} /> Ver detalle
                </button>
              </div>
            </Section>
          )}

          {/* Cierre (info) */}
          {resolved && (risk as { closedBy?: string }).closedBy && (
            <Section title="Resolución">
              <MetaRow label="Cerrado por">{(risk as { closedBy?: string }).closedBy}</MetaRow>
              <MetaRow label="Fecha de cierre">{fmtDateTime((risk as { closedOn?: string }).closedOn ?? "")}</MetaRow>
              {(risk as { closeComment?: string }).closeComment && (
                <div style={{
                  marginTop: spacing[2],
                  padding: `${spacing[3]}px ${spacing[4]}px`,
                  background: color.surfaceAlt,
                  border: `1px solid ${color.border}`,
                  borderRadius: radius.sm,
                  fontSize: font.size.sm, color: color.textSecondary,
                }}>
                  {(risk as { closeComment?: string }).closeComment}
                </div>
              )}
            </Section>
          )}

          {/* Historial */}
          {riskLog.length > 0 && (
            <Section title="Historial">
              <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
                {riskLog.map((entry) => (
                  <div key={entry.id} style={{
                    padding: `${spacing[3]}px ${spacing[4]}px`,
                    background: color.surfaceAlt,
                    border: `1px solid ${color.borderSubtle}`,
                    borderRadius: radius.sm,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.primary }}>
                        {entry.action}
                      </span>
                      <span style={{ fontSize: font.size.xs, color: color.textMuted }}>
                        {fmtDateTime(entry.at)}
                      </span>
                    </div>
                    <span style={{ fontSize: font.size.xs, color: color.textSecondary }}>
                      {entry.who} ({entry.whoRole})
                      {(entry as { note?: string }).note ? ` — ${(entry as { note?: string }).note}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Acción: Cerrar riesgo */}
          {canEdit && !resolved && !closeMode && (
            <div style={{ marginTop: "auto" }} />
          )}

          {canEdit && !resolved && closeMode && (
            <Section title="Cerrar riesgo">
              <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
                <textarea
                  value={comment}
                  onChange={(e) => { setComment(e.target.value); if (e.target.value.trim()) setCommentErr(""); }}
                  placeholder="Comentario de cierre obligatorio…"
                  rows={3}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    padding: `${spacing[3]}px`,
                    fontSize: font.size.sm, color: color.text,
                    background: color.surface,
                    border: `1px solid ${commentErr ? color.dangerBorder : color.border}`,
                    borderRadius: radius.sm, outline: "none",
                    resize: "vertical",
                  }}
                />
                {commentErr && (
                  <span style={{ fontSize: font.size.xs, color: color.danger }}>{commentErr}</span>
                )}
                <div style={{ display: "flex", gap: spacing[3] }}>
                  <button
                    type="button"
                    onClick={() => { setCloseMode(false); setComment(""); setCommentErr(""); }}
                    style={{
                      flex: 1, height: 34, fontSize: font.size.sm,
                      border: `1px solid ${color.border}`, background: "transparent",
                      borderRadius: radius.sm, color: color.textSecondary, cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={saving}
                    style={{
                      flex: 1, height: 34, fontSize: font.size.sm,
                      fontWeight: font.weight.semibold,
                      border: "none", background: saving ? color.surfaceAlt : color.danger,
                      borderRadius: radius.sm, color: "#fff",
                      cursor: saving ? "not-allowed" : "pointer",
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? "Cerrando…" : "Confirmar cierre"}
                  </button>
                </div>
              </div>
            </Section>
          )}
        </div>

        {/* Footer de acciones */}
        {!resolved && (
          <div style={{
            display: "flex", gap: spacing[3], flexWrap: "wrap",
            padding: `${spacing[4]}px ${spacing[6]}px`,
            borderTop: `1px solid ${color.border}`,
            background: color.surfaceAlt,
          }}>
            {/* Recordatorio (stub) */}
            <button
              type="button"
              onClick={() => { setReminderSent(true); setTimeout(() => setReminderSent(false), 3000); }}
              title="Enviar recordatorio al responsable (stub)"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 34, padding: `0 ${spacing[4]}px`,
                fontSize: font.size.sm, fontWeight: font.weight.medium,
                border: `1px solid ${reminderSent ? color.success : color.border}`,
                background: reminderSent ? color.successBg : color.surface,
                borderRadius: radius.sm,
                color: reminderSent ? color.success : color.textSecondary,
                cursor: "pointer", transition: `all ${transition.fast}`,
              }}
            >
              <Bell size={13} />
              {reminderSent ? "¡Recordatorio enviado!" : "Enviar recordatorio"}
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(risk)}
                style={{
                  flex: 1, height: 34, fontSize: font.size.sm,
                  border: `1px solid ${color.border}`, background: color.surface,
                  borderRadius: radius.sm, color: color.text, cursor: "pointer",
                  transition: `all ${transition.fast}`,
                }}
              >
                Editar
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setCloseMode(true)}
                disabled={closeMode}
                style={{
                  flex: 1, height: 34, fontSize: font.size.sm,
                  fontWeight: font.weight.semibold,
                  border: "none", background: color.danger,
                  borderRadius: radius.sm, color: "#fff",
                  cursor: closeMode ? "not-allowed" : "pointer",
                  opacity: closeMode ? 0.5 : 1,
                  transition: `opacity ${transition.fast}`,
                }}
              >
                Cerrar riesgo
              </button>
            )}
          </div>
        )}
      </aside>

      {/* WorkItemDrawer anidado */}
      {wiDrawerOpen && workItem && (
        <WorkItemDrawer
          item={workItem}
          states={states}
          transitions={transitions}
          currentUserRoles={roles as AppRole[]}
          onClose={() => setWiDrawerOpen(false)}
          onMoveFromDrawer={() => {}}
          onItemUpdated={() => {}}
        />
      )}
    </>
  );
};
