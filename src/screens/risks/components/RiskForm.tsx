// ─────────────────────────────────────────────────────────
//  src/screens/risks/components/RiskForm.tsx
//  Modal para crear y editar riesgos.
// ─────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { color, font, radius, shadow, spacing, transition } from "../../../components/ui/tokens";
import type { Risk, Project, WorkItem, AppRole } from "../../../types/domain";
import type { CreateRiskPayload, PatchRiskPayload } from "../../../services/riskService";

// ── Tipos ─────────────────────────────────────────────────
export type RiskFormMode = "create" | "edit";

interface RiskFormProps {
  mode:      RiskFormMode;
  risk?:     Risk;            // en modo edit
  projects:  Project[];
  workItems: WorkItem[];
  onSave:    (payload: CreateRiskPayload | PatchRiskPayload) => Promise<void>;
  onClose:   () => void;
}

interface FormState {
  projectId:        string;
  title:            string;
  description:      string;
  severity:         string;
  ownerRole:        string;
  dueDate:          string;
  linkedWorkItemId: string;
}

const EMPTY: FormState = {
  projectId: "", title: "", description: "",
  severity: "Media", ownerRole: "IT AirEuropa",
  dueDate: "", linkedWorkItemId: "",
};

// ── Estilos ───────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
  color: color.textSecondary,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box" as const,
  height: 34,
  padding: `0 ${spacing[3]}px`,
  fontSize: font.size.sm,
  color: color.text,
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  outline: "none",
  transition: `border-color ${transition.fast}`,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  height: "auto",
  minHeight: 72,
  padding: `${spacing[2]}px ${spacing[3]}px`,
  resize: "vertical" as const,
};

// ── Componente ────────────────────────────────────────────
export const RiskForm: React.FC<RiskFormProps> = ({
  mode, risk, projects, workItems, onSave, onClose,
}) => {
  const [form, setForm]     = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (mode === "edit" && risk) {
      setForm({
        projectId:        risk.projectId,
        title:            risk.title,
        description:      (risk as { description?: string }).description ?? "",
        severity:         risk.severity,
        ownerRole:        risk.ownerRole,
        dueDate:          risk.dueDate,
        linkedWorkItemId: risk.linkedWorkItemId ?? "",
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [mode, risk]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // WorkItems filtrados por proyecto
  const filteredWIs = form.projectId
    ? workItems.filter((w) => w.projectId === form.projectId)
    : workItems;

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.projectId)  e.projectId = "Selecciona un proyecto";
    if (!form.title.trim()) e.title   = "El título es obligatorio";
    if (!form.severity)   e.severity  = "Selecciona la severidad";
    if (!form.ownerRole)  e.ownerRole = "Selecciona el responsable";
    if (!form.dueDate)    e.dueDate   = "La fecha límite es obligatoria";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        projectId:        form.projectId,
        title:            form.title.trim(),
        description:      form.description.trim() || undefined,
        severity:         form.severity as Risk["severity"],
        ownerRole:        form.ownerRole as AppRole,
        dueDate:          form.dueDate,
        linkedWorkItemId: form.linkedWorkItemId || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 39,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: spacing[5],
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div style={{
        zIndex: 40,
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.lg,
        boxShadow: shadow.xl,
        width: "100%",
        maxWidth: 540,
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${spacing[5]}px ${spacing[6]}px`,
          borderBottom: `1px solid ${color.border}`,
        }}>
          <h2 style={{ margin: 0, fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.text }}>
            {mode === "create" ? "Nuevo riesgo" : "Editar riesgo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, border: "none", background: "transparent",
              borderRadius: radius.sm, cursor: "pointer", color: color.textMuted,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ padding: `${spacing[6]}px`, display: "flex", flexDirection: "column", gap: spacing[5] }}>
            {/* Proyecto */}
            <Field label="Proyecto *" error={errors.projectId}>
              <select
                value={form.projectId}
                onChange={(e) => { set("projectId", e.target.value); set("linkedWorkItemId", ""); }}
                style={inputStyle}
                disabled={mode === "edit"}
              >
                <option value="">— Selecciona —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                ))}
              </select>
            </Field>

            {/* Título */}
            <Field label="Título *" error={errors.title}>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Descripción breve del riesgo"
                style={inputStyle}
              />
            </Field>

            {/* Descripción */}
            <Field label="Descripción">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Detalla el impacto y contexto del riesgo..."
                style={textareaStyle}
                rows={3}
              />
            </Field>

            {/* Fila: Severidad + Responsable */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing[4] }}>
              <Field label="Severidad *" error={errors.severity}>
                <select value={form.severity} onChange={(e) => set("severity", e.target.value)} style={inputStyle}>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </Field>

              <Field label="Responsable *" error={errors.ownerRole}>
                <select value={form.ownerRole} onChange={(e) => set("ownerRole", e.target.value)} style={inputStyle}>
                  <option value="IT AirEuropa">IT AirEuropa</option>
                  <option value="Proveedor">Proveedor</option>
                  <option value="Usuario">Usuario</option>
                  <option value="Admin">Admin</option>
                </select>
              </Field>
            </div>

            {/* Fecha límite */}
            <Field label="Fecha límite *" error={errors.dueDate}>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
                style={inputStyle}
              />
            </Field>

            {/* WorkItem vinculado */}
            <Field label="WorkItem vinculado (opcional)">
              <select
                value={form.linkedWorkItemId}
                onChange={(e) => set("linkedWorkItemId", e.target.value)}
                style={inputStyle}
                disabled={!form.projectId}
              >
                <option value="">— Ninguno —</option>
                {filteredWIs.map((w) => (
                  <option key={w.id} value={w.id}>{w.title}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: spacing[3],
            padding: `${spacing[4]}px ${spacing[6]}px`,
            borderTop: `1px solid ${color.border}`,
            background: color.surfaceAlt,
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 34, padding: `0 ${spacing[5]}px`,
                fontSize: font.size.sm, borderRadius: radius.sm,
                border: `1px solid ${color.border}`, background: "transparent",
                color: color.textSecondary, cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                height: 34, padding: `0 ${spacing[5]}px`,
                fontSize: font.size.sm, fontWeight: font.weight.semibold,
                borderRadius: radius.sm, border: "none",
                background: saving ? color.surfaceAlt : color.primary,
                color: "#fff", cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                transition: `opacity ${transition.fast}`,
              }}
            >
              {saving ? "Guardando…" : mode === "create" ? "Crear riesgo" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Sub-componente Field ──────────────────────────────────
const Field: React.FC<{
  label: string;
  error?: string;
  children: React.ReactNode;
}> = ({ label, error, children }) => (
  <div>
    <label style={labelStyle}>{label}</label>
    {children}
    {error && (
      <span style={{ display: "block", marginTop: 3, fontSize: font.size.xs, color: color.danger }}>
        {error}
      </span>
    )}
  </div>
);
