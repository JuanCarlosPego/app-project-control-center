// ─────────────────────────────────────────────────────────
//  src/components/modals/AddEvidenceModal.tsx
//  Modal reutilizable para añadir evidencia en WorkItems o Proyectos.
//  Usado desde EvidencesPage, WorkItemDrawer (evidenceRequired), etc.
// ─────────────────────────────────────────────────────────

import React from "react";
import { X, Link2, MessageSquare, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { color, font, radius, spacing, shadow, transition } from "../ui/tokens";
import { createEvidence } from "../../services/evidenceService";
import type { Project, WorkItem, EvidenceType } from "../../types/domain";

// ── Tipos ─────────────────────────────────────────────────
export interface AddEvidenceModalProps {
  /** Si se provee workItem, viene pre-seleccionado y bloqueado */
  workItem?: WorkItem;
  /** Si se provee project, viene pre-seleccionado y bloqueado */
  project?: Project;
  /** Lista de proyectos para el selector (cuando no hay pre-selección) */
  projects?: Project[];
  /** Lista de WorkItems del proyecto seleccionado */
  workItems?: WorkItem[];
  /** Tipos permitidos; si está vacío, se muestran todos */
  allowedTypes?: EvidenceType[];
  /** Llamado cuando la evidencia se crea con éxito */
  onCreated?: () => void;
  onClose: () => void;
}

interface FormState {
  projectId:  string;
  entityType: "WorkItem" | "Project";
  entityId:   string;
  type:       EvidenceType | "";
  value:      string;
  comment:    string;
}

const TYPES: { value: EvidenceType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "link",    label: "Enlace",       icon: <Link2 size={14} />,        desc: "URL a documento, PR, SharePoint…" },
  { value: "comment", label: "Comentario",   icon: <MessageSquare size={14} />, desc: "Nota de texto libre" },
  { value: "file",    label: "Archivo",      icon: <FileText size={14} />,      desc: "Nombre o referencia a fichero" },
];

// ── AddEvidenceModal ──────────────────────────────────────
export const AddEvidenceModal: React.FC<AddEvidenceModalProps> = ({
  workItem, project, projects = [], workItems = [], allowedTypes, onCreated, onClose,
}) => {
  // Determinar entidad pre-fijada
  const fixedEntityType = workItem ? "WorkItem" : project ? "Project" : undefined;
  const fixedEntityId   = workItem?.id ?? project?.id ?? "";
  const fixedProjectId  = workItem?.projectId ?? project?.id ?? "";

  const [form, setForm] = React.useState<FormState>({
    projectId:  fixedProjectId,
    entityType: fixedEntityType ?? "WorkItem",
    entityId:   fixedEntityId,
    type:       "",
    value:      "",
    comment:    "",
  });

  const [saving,  setSaving]  = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error,   setError]   = React.useState<string | null>(null);

  // WorkItems disponibles para el proyecto seleccionado
  const availableWIs = workItems.filter((w) => w.projectId === form.projectId);

  // Tipos disponibles
  const availTypes = allowedTypes && allowedTypes.length > 0
    ? TYPES.filter((t) => allowedTypes.includes(t.value))
    : TYPES;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Reset entityId cuando cambia proyecto o tipo de entidad
  React.useEffect(() => {
    if (!fixedEntityId) set("entityId", "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.projectId, form.entityType]);

  // Validación
  const isValid =
    form.entityId !== "" &&
    form.type !== "" &&
    (form.type !== "link" || form.value.trim() !== "") &&
    (form.type !== "comment" || form.comment.trim() !== "");

  const handleSubmit = async () => {
    if (!isValid || form.type === "") return;
    setSaving(true);
    setError(null);
    try {
      await createEvidence({
        entityType: form.entityType,
        entityId:   form.entityId,
        type:       form.type,
        value:      form.value.trim(),
        comment:    form.comment.trim(),
      });
      setSuccess(true);
      onCreated?.();
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar la evidencia");
    } finally {
      setSaving(false);
    }
  };

  // Trap foco + Esc
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Título del modal
  const modalTitle = workItem
    ? `Añadir evidencia — ${workItem.jiraIssueKey ?? workItem.id}`
    : project
    ? `Añadir evidencia — ${project.code}`
    : "Añadir evidencia";

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.40)",
          zIndex: 39,
        }}
      />

      {/* Panel */}
      <div role="dialog" aria-modal="true" aria-label={modalTitle}
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          width: "min(560px, calc(100vw - 40px))",
          maxHeight: "90vh",
          overflowY: "auto",
          background: color.surface,
          borderRadius: radius.lg,
          boxShadow: shadow.xl,
          zIndex: 40,
          fontFamily: font.family,
        }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${spacing[5]}px ${spacing[6]}px`,
          borderBottom: `1px solid ${color.border}`,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: font.size.xl, fontWeight: font.weight.semibold, color: color.text }}>
              Añadir evidencia
            </h2>
            {(workItem ?? project) && (
              <p style={{ margin: `${spacing[1]}px 0 0`, fontSize: font.size.sm, color: color.textMuted }}>
                {workItem?.title ?? project?.name}
              </p>
            )}
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: color.textMuted, display: "flex", padding: spacing[2] }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: `${spacing[6]}px`, display: "flex", flexDirection: "column", gap: spacing[6] }}>

          {/* Éxito */}
          {success && (
            <div style={{
              display: "flex", alignItems: "center", gap: spacing[3],
              padding: spacing[5], borderRadius: radius.md,
              background: color.successBg, border: `1px solid #A3C293`,
              color: color.success, fontWeight: font.weight.semibold,
            }}>
              <CheckCircle2 size={18} />
              Evidencia añadida correctamente
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: spacing[3],
              padding: spacing[5], borderRadius: radius.md,
              background: color.dangerBg, border: `1px solid ${color.dangerBorder}`,
              color: color.danger,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: font.size.sm }}>{error}</span>
            </div>
          )}

          {/* ① Proyecto + Entidad (cuando no hay pre-selección) */}
          {!fixedEntityId && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
              {/* Selector proyecto */}
              {projects.length > 0 && (
                <ModalField label="Proyecto *">
                  <select value={form.projectId} onChange={(e) => set("projectId", e.target.value)}
                    style={selectStyle}>
                    <option value="">Selecciona un proyecto…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </ModalField>
              )}

              {/* Tipo de entidad */}
              <ModalField label="Adjuntar a *">
                <div style={{ display: "flex", gap: spacing[3] }}>
                  {(["WorkItem", "Project"] as const).map((et) => (
                    <EntityTypeButton
                      key={et}
                      label={et === "WorkItem" ? "Tarea" : "Proyecto"}
                      active={form.entityType === et}
                      onClick={() => set("entityType", et)}
                    />
                  ))}
                </div>
              </ModalField>

              {/* Selector WorkItem */}
              {form.entityType === "WorkItem" && (
                <ModalField label="Tarea *">
                  <select value={form.entityId} onChange={(e) => set("entityId", e.target.value)}
                    disabled={!form.projectId}
                    style={{ ...selectStyle, opacity: !form.projectId ? 0.6 : 1 }}>
                    <option value="">Selecciona una tarea…</option>
                    {availableWIs.map((w) => (
                      <option key={w.id} value={w.id}>{w.jiraIssueKey ? `[${w.jiraIssueKey}] ` : ""}{w.title}</option>
                    ))}
                  </select>
                </ModalField>
              )}
            </div>
          )}

          {/* ② Tipo de evidencia */}
          <ModalField label="Tipo de evidencia *">
            <div style={{ display: "flex", gap: spacing[3], flexWrap: "wrap" }}>
              {availTypes.map((t) => (
                <TypeButton
                  key={t.value}
                  icon={t.icon}
                  label={t.label}
                  desc={t.desc}
                  active={form.type === t.value}
                  onClick={() => set("type", t.value)}
                />
              ))}
            </div>
          </ModalField>

          {/* ③ Valor / URL */}
          {(form.type === "link" || form.type === "file") && (
            <ModalField
              label={form.type === "link" ? "URL del enlace *" : "Nombre / referencia del archivo"}
            >
              <input
                type={form.type === "link" ? "url" : "text"}
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder={form.type === "link"
                  ? "https://…"
                  : "Nombre del archivo o referencia…"}
                style={inputStyle}
              />
            </ModalField>
          )}

          {/* ④ Comentario */}
          <ModalField
            label={form.type === "comment" ? "Comentario *" : "Comentario adicional"}
          >
            <textarea
              value={form.comment}
              onChange={(e) => set("comment", e.target.value)}
              placeholder="Explica el contenido o contexto de la evidencia…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
            />
          </ModalField>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: spacing[3],
          padding: `${spacing[5]}px ${spacing[6]}px`,
          borderTop: `1px solid ${color.border}`,
          background: color.surfaceAlt,
          borderRadius: `0 0 ${radius.lg} ${radius.lg}`,
        }}>
          <button onClick={onClose}
            style={{
              padding: `${spacing[3]}px ${spacing[6]}px`,
              border: `1px solid ${color.border}`, borderRadius: radius.sm,
              background: color.surface, color: color.textSecondary,
              fontSize: font.size.md, fontWeight: font.weight.medium,
              fontFamily: font.family, cursor: "pointer",
            }}>
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || saving || success}
            style={{
              padding: `${spacing[3]}px ${spacing[6]}px`,
              border: "none", borderRadius: radius.sm,
              background: !isValid || saving || success ? "#C8C6C4" : color.primary,
              color: !isValid || saving || success ? "#A19F9D" : "#fff",
              fontSize: font.size.md, fontWeight: font.weight.semibold,
              fontFamily: font.family,
              cursor: !isValid || saving || success ? "not-allowed" : "pointer",
              transition: `background ${transition.fast}`,
            }}>
            {saving ? "Guardando…" : success ? "Guardado ✓" : "Añadir evidencia"}
          </button>
        </div>
      </div>
    </>
  );
};

// ── Sub-componentes ───────────────────────────────────────
const ModalField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
    <label style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold, color: color.text }}>
      {label}
    </label>
    {children}
  </div>
);

const EntityTypeButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({
  label, active, onClick,
}) => (
  <button onClick={onClick}
    style={{
      padding: `${spacing[3]}px ${spacing[6]}px`,
      border: `2px solid ${active ? color.primary : color.border}`,
      borderRadius: radius.sm, background: active ? color.primaryBg : color.surface,
      color: active ? color.primary : color.textSecondary,
      fontSize: font.size.md, fontWeight: active ? font.weight.semibold : font.weight.regular,
      fontFamily: font.family, cursor: "pointer",
      transition: `all ${transition.fast}`,
    }}>
    {label}
  </button>
);

const TypeButton: React.FC<{
  icon: React.ReactNode; label: string; desc: string; active: boolean; onClick: () => void;
}> = ({ icon, label, desc, active, onClick }) => {
  const [hov, setHov] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, minWidth: 120,
        padding: `${spacing[4]}px ${spacing[4]}px`,
        border: `2px solid ${active ? color.primary : hov ? color.primary + "88" : color.border}`,
        borderRadius: radius.md,
        background: active ? color.primaryBg : hov ? "#F5FAFE" : color.surface,
        color: active ? color.primary : color.text,
        fontFamily: font.family, cursor: "pointer", textAlign: "left",
        transition: `all ${transition.fast}`,
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2], marginBottom: spacing[1] }}>
        <span style={{ color: active ? color.primary : color.textMuted }}>{icon}</span>
        <span style={{ fontSize: font.size.sm, fontWeight: font.weight.semibold }}>{label}</span>
      </div>
      <p style={{ margin: 0, fontSize: font.size.xs, color: active ? color.primary : color.textMuted, lineHeight: 1.4 }}>
        {desc}
      </p>
    </button>
  );
};

// ── Estilos base ──────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: `${spacing[3]}px ${spacing[4]}px`,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontSize: font.size.md,
  color: color.text,
  background: color.surface,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: font.family,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};
