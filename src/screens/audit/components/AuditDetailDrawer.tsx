// ─────────────────────────────────────────────────────────
//  src/screens/audit/components/AuditDetailDrawer.tsx
//  Panel lateral de detalle para un registro de auditoría.
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import { X, ShieldAlert, Clock } from "lucide-react";
import { color, font, radius, shadow, spacing, zIndex, transition } from "../../../components/ui/tokens";
import type { AuditEntry, AppUser, Project, WorkItem } from "../../../types/domain";
import { ACTION_LABELS } from "../../../services/auditService";

// ── Helpers ───────────────────────────────────────────────
function fmtDateTime(s: string) {
  return new Date(s).toLocaleString("es-ES", {
    weekday: "long", day: "2-digit", month: "long",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

// ── JSON formateado ───────────────────────────────────────
const JsonBlock: React.FC<{ label: string; data: unknown }> = ({ label, data }) => {
  const [collapsed, setCollapsed] = useState(false);
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  if (!text || text === "{}" || text === "null" || text === "") return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", background: "none", border: "none", cursor: "pointer",
          padding: `${spacing[2]}px 0`, textAlign: "left",
        }}
      >
        <span style={{ fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
        <span style={{ fontSize: font.size.xs, color: color.textMuted }}>{collapsed ? "▶ expandir" : "▼ colapsar"}</span>
      </button>
      {!collapsed && (
        <pre style={{
          margin: 0, padding: `${spacing[3]}px ${spacing[4]}px`,
          background: color.surfaceAlt, border: `1px solid ${color.border}`,
          borderRadius: radius.sm, fontSize: 11, fontFamily: "'Cascadia Code', 'Consolas', monospace",
          color: color.text, overflowX: "auto", lineHeight: 1.6,
          maxHeight: 200, overflowY: "auto",
          whiteSpace: "pre-wrap", wordBreak: "break-all",
        }}>
          {text}
        </pre>
      )}
    </div>
  );
};

// ── Diff simple (from → to) ───────────────────────────────
const DiffRow: React.FC<{ from?: string; to?: string }> = ({ from, to }) => {
  if (!from && !to) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing[3] }}>
      <div>
        <p style={{ margin: `0 0 4px`, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.danger, textTransform: "uppercase" }}>Antes</p>
        <div style={{
          padding: `${spacing[3]}px`, background: color.dangerBg,
          border: `1px solid ${color.dangerBorder}`, borderRadius: radius.sm,
          fontSize: font.size.sm, color: color.text,
          minHeight: 36, wordBreak: "break-all",
        }}>
          {from || <em style={{ color: color.textMuted }}>vacío</em>}
        </div>
      </div>
      <div>
        <p style={{ margin: `0 0 4px`, fontSize: font.size.xs, fontWeight: font.weight.semibold, color: color.success, textTransform: "uppercase" }}>Después</p>
        <div style={{
          padding: `${spacing[3]}px`, background: color.successBg,
          border: `1px solid ${color.success}`, borderRadius: radius.sm,
          fontSize: font.size.sm, color: color.text,
          minHeight: 36, wordBreak: "break-all",
        }}>
          {to || <em style={{ color: color.textMuted }}>vacío</em>}
        </div>
      </div>
    </div>
  );
};

// ── Section ───────────────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p style={{
      margin: `0 0 ${spacing[3]}px`,
      fontSize: font.size.xs, fontWeight: font.weight.semibold,
      color: color.textMuted, textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {title}
    </p>
    {children}
  </div>
);

const MetaRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", gap: spacing[3], marginBottom: spacing[2] }}>
    <span style={{ minWidth: 100, fontSize: font.size.xs, color: color.textMuted }}>{label}</span>
    <span style={{ fontSize: font.size.sm, color: color.text, fontWeight: font.weight.medium }}>{children}</span>
  </div>
);

// ── Badge EntityType ──────────────────────────────────────
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
      display: "inline-block", padding: "2px 9px",
      borderRadius: radius.full, background: c.bg, color: c.fg,
      fontSize: font.size.xs, fontWeight: font.weight.semibold,
    }}>
      {type}
    </span>
  );
};

// ── Props ─────────────────────────────────────────────────
interface AuditDetailDrawerProps {
  entry:     AuditEntry | null;
  users:     AppUser[];
  projects:  Project[];
  workItems: WorkItem[];
  onClose:   () => void;
}

// ── Componente ────────────────────────────────────────────
export const AuditDetailDrawer: React.FC<AuditDetailDrawerProps> = ({
  entry, users, projects, workItems, onClose,
}) => {
  if (!entry) return null;

  const userMap    = Object.fromEntries(users.map((u) => [u.id, u.displayName]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, `${p.code} — ${p.name}`]));
  const wiMap      = Object.fromEntries(workItems.map((w) => [w.id, w.title]));

  const actorName  = userMap[entry.who] ?? entry.who;
  const projectRef = entry.projectId ? projectMap[entry.projectId] : null;
  const entityRef  =
    entry.entityType === "WorkItem" ? wiMap[entry.entityId] ?? entry.entityId
    : entry.entityType === "Project" ? projectMap[entry.entityId] ?? entry.entityId
    : entry.entityId;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: zIndex.drawer - 1 }}
      />

      {/* Panel */}
      <aside style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(560px, 90vw)",
        background: color.surface,
        borderLeft: `1px solid ${color.border}`,
        boxShadow: shadow.xl,
        zIndex: zIndex.drawer,
        overflowY: "auto",
        display: "flex", flexDirection: "column",
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
            <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: 6 }}>
              <EntityTypeBadge type={entry.entityType} />
              {entry.isCritical && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 7px", borderRadius: radius.full,
                  background: color.dangerBg, color: color.danger,
                  fontSize: font.size.xs, fontWeight: font.weight.semibold,
                }}>
                  <ShieldAlert size={11} /> Crítico
                </span>
              )}
            </div>
            <h2 style={{
              margin: 0, fontSize: font.size.md,
              fontWeight: font.weight.semibold, color: color.text,
            }}>
              {ACTION_LABELS[entry.action] ?? entry.action}
            </h2>
            <p style={{ margin: `${spacing[1]}px 0 0`, fontSize: font.size.xs, color: color.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={11} /> {fmtDateTime(entry.at)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              flexShrink: 0, width: 28, height: 28, border: "none",
              background: "transparent", borderRadius: radius.sm,
              cursor: "pointer", color: color.textMuted,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, padding: `${spacing[6]}px`, display: "flex", flexDirection: "column", gap: spacing[6] }}>

          {/* Metadatos */}
          <Section title="Información">
            <MetaRow label="Actor">{actorName} <span style={{ color: color.textMuted, fontSize: font.size.xs }}>({entry.whoRole})</span></MetaRow>
            <MetaRow label="Código de acción">
              <code style={{ fontSize: font.size.xs, background: color.surfaceAlt, padding: "1px 5px", borderRadius: 3 }}>
                {entry.action}
              </code>
            </MetaRow>
            <MetaRow label="Entidad">{entry.entityType} / <span style={{ fontFamily: "monospace", fontSize: font.size.xs }}>{entry.entityId}</span></MetaRow>
            {entityRef && entityRef !== entry.entityId && (
              <MetaRow label="Referencia">{entityRef}</MetaRow>
            )}
            {projectRef && (
              <MetaRow label="Proyecto">{projectRef}</MetaRow>
            )}
            <MetaRow label="Fuente">
              <span style={{
                padding: "1px 6px", borderRadius: radius.full,
                background: entry.source === "auditLog" ? "#FDF4FF" : color.primaryBg,
                color: entry.source === "auditLog" ? "#9333EA" : color.primary,
                fontSize: font.size.xs, fontWeight: font.weight.semibold,
              }}>
                {entry.source === "auditLog" ? "Sistema (auditLog)" : "Actividad (activityLog)"}
              </span>
            </MetaRow>
          </Section>

          {/* Diff desde/hasta */}
          {(entry.from !== undefined || entry.to !== undefined) && (
            <Section title="Cambio">
              <DiffRow from={entry.from} to={entry.to} />
            </Section>
          )}

          {/* Nota / descripción */}
          {(entry.note || entry.description) && (
            <Section title="Nota">
              <div style={{
                padding: `${spacing[3]}px ${spacing[4]}px`,
                background: color.surfaceAlt, border: `1px solid ${color.border}`,
                borderRadius: radius.sm, fontSize: font.size.sm,
                color: color.textSecondary, lineHeight: 1.6,
              }}>
                {entry.note ?? entry.description}
              </div>
            </Section>
          )}

          {/* Payload estructurado (auditLog) */}
          {(entry.before !== undefined || entry.after !== undefined) && (
            <Section title="Payload estructurado">
              <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
                <JsonBlock label="Estado anterior (before)" data={entry.before} />
                <JsonBlock label="Estado nuevo (after)" data={entry.after} />
              </div>
            </Section>
          )}

          {/* Raw JSON de la entrada completa */}
          <Section title="Registro completo">
            <JsonBlock
              label="JSON completo"
              data={entry}
            />
          </Section>
        </div>
      </aside>
    </>
  );
};
