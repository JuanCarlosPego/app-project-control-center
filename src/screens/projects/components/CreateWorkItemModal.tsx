// ─────────────────────────────────────────────────────────
//  src/screens/projects/components/CreateWorkItemModal.tsx
//  Formulario completo para crear un WorkItem (Tarea) dentro
//  de un Proyecto (Épica). Se muestra como modal centrado.
//
//  RBAC: visible solo si el usuario tiene permiso TASK_CREATE
//  (Admin, IT AirEuropa, Proveedor). Invitado/Usuario: oculto.
//
//  Integración Jira (estructura preparada para Power Automate):
//    jiraIssueKey, jiraUrl  → vacíos al crear
//    syncStatus             → "Pending"
// ─────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import type { Project, State, AppUser, Team, AppRole } from "../../../types/domain";
import { listTeams } from "../../../services/teamService";
import { listAppUsers } from "../../../services/userService";
import { filterTeamsForRole, filterUsersForAssignment } from "../../../services/assignmentService";

// ── Tipos ─────────────────────────────────────────────────
export interface CreateWorkItemPayload {
  projectId: string;
  title: string;
  description?: string;
  type: "Feature" | "Bug" | "TechDebt" | "Spike";
  priority: "Alta" | "Media" | "Baja";
  stateId: string;
  assignedToRole: "IT AirEuropa" | "Proveedor" | "Usuario";
  assignedToUserId: string;
  startDate: string;
  endDate: string;
  tags: string[];
  // Jira (estructura para Power Automate — no usado en creación)
  jiraIssueKey?: string;
  jiraUrl?: string;
}

interface Props {
  open: boolean;
  /** Proyecto preseleccionado. Si es null se muestra un selector. */
  project: Project | null;
  /** Lista completa de proyectos para el selector (solo cuando project=null). */
  projects?: Project[];
  states: State[];
  onClose: () => void;
  onCreated: () => void; // callback para refrescar la lista
  /** Lista de usuarios (opcional — si no se pasa, se cargan internamente) */
  users?: User[];
}

// ── Tokens de diseño ──────────────────────────────────────
const C = {
  primary:   "#0078D4",
  border:    "#EDEBE9",
  bg:        "#FAF9F8",
  text:      "#201F1E",
  textMid:   "#605E5C",
  textMuted: "#A19F9D",
  danger:    "#D13438",
  warning:   "#CA8B00",
  warnBg:    "#FFF4CE",
  warnBorder:"#F4D180",
  success:   "#107C10",
};

// ── Field wrapper ─────────────────────────────────────────
const Field: React.FC<{
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}> = ({ label, required, error, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <label style={{ fontSize: 11, fontWeight: 600, color: C.textMid }}>
      {label}{required && <span style={{ color: C.danger, marginLeft: 2 }}>*</span>}
    </label>
    {children}
    {error && (
      <span style={{ fontSize: 10, color: C.danger, display: "flex", alignItems: "center", gap: 3 }}>
        <AlertTriangle size={10} /> {error}
      </span>
    )}
  </div>
);

// ── Input ─────────────────────────────────────────────────
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }>(
  ({ hasError, style, ...rest }, ref) => (
    <input
      ref={ref}
      {...rest}
      style={{
        fontFamily: "'Segoe UI', sans-serif", fontSize: 13, color: C.text,
        border: `1px solid ${hasError ? C.danger : C.border}`, borderRadius: 4,
        padding: "7px 10px", background: "#fff", outline: "none",
        transition: "border-color 150ms",
        ...style,
      }}
      onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = C.primary; }}
      onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = hasError ? C.danger : C.border; }}
    />
  ),
);

// ── Select ────────────────────────────────────────────────
const Sel: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }> = ({
  hasError, style, ...rest
}) => (
  <select
    {...rest}
    style={{
      fontFamily: "'Segoe UI', sans-serif", fontSize: 13, color: C.text,
      border: `1px solid ${hasError ? C.danger : C.border}`, borderRadius: 4,
      padding: "7px 10px", background: "#fff", cursor: "pointer",
      ...style,
    }}
  />
);

// ── Textarea ──────────────────────────────────────────────
const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  style, ...rest
}) => (
  <textarea
    {...rest}
    style={{
      fontFamily: "'Segoe UI', sans-serif", fontSize: 13, color: C.text,
      border: `1px solid ${C.border}`, borderRadius: 4,
      padding: "7px 10px", background: "#fff", resize: "vertical", minHeight: 64,
      outline: "none",
      ...style,
    }}
    onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = C.primary; }}
    onBlur={(e)  => { (e.target as HTMLTextAreaElement).style.borderColor = C.border; }}
  />
);

// ── CreateWorkItemModal ───────────────────────────────────
export const CreateWorkItemModal: React.FC<Props> = ({
  open, project, projects = [], states, onClose, onCreated,
}) => {
  // ── Proyecto activo (preseleccionado o elegido en el selector) ────
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    project ?? projects[0] ?? null,
  );

  // ── Catálogos para cascading ─────────────────────────────
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingCatalogs(true);
    Promise.all([
      listTeams({ isActive: true }),
      listAppUsers({ isActive: true }),
    ]).then(([teams, users]) => {
      setAllTeams(teams);
      setAllUsers(users);
    }).catch(() => { /* no bloquea el formulario */ })
      .finally(() => setLoadingCatalogs(false));
  }, [open]);

  // ── Estado del formulario ──────────────────────────────
  const defaultStateId = states.find((s) => s.order === 0)?.id
    ?? states[0]?.id
    ?? "st-new";

  const [form, setForm] = useState<CreateWorkItemPayload>({
    projectId:        selectedProject?.id ?? "",
    title:            "",
    description:      "",
    type:             "Feature",
    priority:         "Media",
    stateId:          defaultStateId,
    assignedToRole:   "IT AirEuropa",
    assignedToTeamId: "",
    assignedToUserId: "",
    startDate:        selectedProject?.startDate ?? "",
    endDate:          selectedProject?.endDate   ?? "",
    tags:             [],
  });

  const [tagsInput, setTagsInput]   = useState("");
  const [errors, setErrors]         = useState<Partial<Record<keyof CreateWorkItemPayload | "form", string>>>({});
  const [saving, setSaving]         = useState(false);
  const [success, setSuccess]       = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  // ── Cascading reactivo ──────────────────────────────────
  const availableTeams = useMemo(
    () => form.assignedToRole
      ? filterTeamsForRole(allTeams, form.assignedToRole as AppRole)
      : [],
    [allTeams, form.assignedToRole],
  );

  const availableUsers = useMemo(
    () => form.assignedToRole
      ? filterUsersForAssignment(
          allUsers,
          form.assignedToRole as AppRole,
          form.assignedToTeamId || null,
        )
      : [],
    [allUsers, form.assignedToRole, form.assignedToTeamId],
  );

  // Reset al abrir
  useEffect(() => {
    if (open) {
      const p = project ?? projects[0] ?? null;
      setSelectedProject(p);
      setForm({
        projectId:        p?.id ?? "",
        title:            "",
        description:      "",
        type:             "Feature",
        priority:         "Media",
        stateId:          defaultStateId,
        assignedToRole:   "IT AirEuropa",
        assignedToTeamId: "",
        assignedToUserId: "",
        startDate:        p?.startDate ?? "",
        endDate:          p?.endDate   ?? "",
        tags:             [],
      });
      setTagsInput("");
      setErrors({});
      setSuccess(false);
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sincronizar form.projectId cuando cambia selectedProject
  const handleProjectChange = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId) ?? null;
    setSelectedProject(p);
    setForm((f) => ({
      ...f,
      projectId:        p?.id ?? "",
      assignedToTeamId: "",
      assignedToUserId: "",
      startDate:        p?.startDate ?? f.startDate,
      endDate:          p?.endDate   ?? f.endDate,
    }));
  };

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // ── Advertencia: proyecto cerrado ─────────────────────
  const projectClosed = selectedProject?.status === "Cerrado";

  // ── Advertencias de fechas ────────────────────────────
  const dateWarning = (() => {
    if (!form.startDate || !form.endDate) return null;
    if (!selectedProject?.startDate || !selectedProject?.endDate) return null;
    const outStart = form.startDate < selectedProject.startDate;
    const outEnd   = form.endDate   > selectedProject.endDate;
    if (outStart && outEnd)
      return `Las fechas están fuera del rango del proyecto (${selectedProject.startDate} – ${selectedProject.endDate}).`;
    if (outStart)
      return `La fecha de inicio es anterior al inicio del proyecto (${selectedProject.startDate}).`;
    if (outEnd)
      return `La fecha de fin supera la fecha de cierre del proyecto (${selectedProject.endDate}).`;
    return null;
  })();

  // ── Validar ────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.projectId)       errs.form = "Selecciona un proyecto";
    if (!form.title.trim())    errs.title = "El título es obligatorio";
    if (!form.startDate)       errs.startDate = "La fecha de inicio es obligatoria";
    if (!form.endDate)         errs.endDate   = "La fecha de fin es obligatoria";
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      errs.endDate = "La fecha de fin no puede ser anterior a la de inicio";
    // assignedToRole siempre obligatorio
    if (!form.assignedToRole)  errs.assignedToRole = "El rol es obligatorio";
    // Proveedor: equipo y usuario obligatorios
    if (form.assignedToRole === "Proveedor") {
      if (!form.assignedToTeamId) errs.assignedToTeamId = "El equipo es obligatorio para rol Proveedor";
      if (!form.assignedToUserId) errs.assignedToUserId = "El usuario es obligatorio para rol Proveedor";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Guardar ────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Parsear tags del input
    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    setErrors({});

    try {
      const payload = { ...form, tags: parsedTags };
      const resp = await fetch("/api/workitems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        setErrors({ form: (data as { error?: string }).error ?? `Error ${resp.status}` });
        return;
      }

      setSuccess(true);
      onCreated();
      setTimeout(() => { onClose(); }, 900);
    } catch {
      setErrors({ form: "Error de red. Inténtalo de nuevo." });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.35)", zIndex: 400,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crear tarea"
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 520, maxWidth: "95vw", maxHeight: "90vh",
          background: "#fff", borderRadius: 10,
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
          zIndex: 401, display: "flex", flexDirection: "column",
          fontFamily: "'Segoe UI', sans-serif",
          overflowY: "auto",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: "16px 20px 14px",
          borderBottom: "1px solid #EDEBE9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>
              + Añadir tarea
            </h2>
            {selectedProject ? (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textMuted }}>
                Épica: <strong style={{ color: C.textMid }}>{selectedProject.code}</strong> — {selectedProject.name}
              </p>
            ) : (
              <p style={{ margin: "2px 0 0", fontSize: 11, color: C.danger }}>Selecciona un proyecto</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid #EDEBE9", borderRadius: 6, background: "transparent",
              cursor: "pointer", color: C.textMid, width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body ── */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Aviso proyecto cerrado */}
            {projectClosed && (
              <div style={{
                background: C.warnBg, border: `1px solid ${C.warnBorder}`,
                borderRadius: 6, padding: "10px 12px",
                display: "flex", gap: 8, fontSize: 12, color: "#835B00", lineHeight: 1.5,
              }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  El proyecto está <strong>Cerrado</strong>. Puedes crear la tarea, pero quedará
                  registrada sobre una épica cerrada.
                </span>
              </div>
            )}

            {/* Error de formulario */}
            {errors.form && (
              <div style={{
                background: "#FDF3F0", border: "1px solid #FDCFBC",
                borderRadius: 6, padding: "10px 12px",
                fontSize: 12, color: C.danger,
              }}>
                {errors.form}
              </div>
            )}

            {/* Éxito */}
            {success && (
              <div style={{
                background: "#DFF6DD", border: "1px solid #107C10",
                borderRadius: 6, padding: "10px 12px",
                display: "flex", gap: 8, fontSize: 12, color: C.success,
              }}>
                <CheckCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                Tarea creada correctamente. Cerrando…
              </div>
            )}

            {/* Título */}
            <Field label="Título" required error={errors.title}>
              <Input
                ref={titleRef}
                value={form.title}
                hasError={!!errors.title}
                placeholder="Descripción corta de la tarea"
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>

            {/* Descripción */}
            <Field label="Descripción">
              <Textarea
                value={form.description}
                placeholder="Detalla el alcance, criterios de aceptación…"
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>

            {/* Tipo + Prioridad */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Tipo">
                <Sel
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CreateWorkItemPayload["type"] }))}
                >
                  <option value="Feature">Feature</option>
                  <option value="Bug">Bug</option>
                  <option value="TechDebt">TechDebt</option>
                  <option value="Spike">Spike</option>
                </Sel>
              </Field>
              <Field label="Prioridad">
                <Sel
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as CreateWorkItemPayload["priority"] }))}
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </Sel>
              </Field>
            </div>

            {/* Estado inicial */}
            <Field label="Estado inicial">
              <Sel
                value={form.stateId}
                onChange={(e) => setForm((f) => ({ ...f, stateId: e.target.value }))}
              >
                {states.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Sel>
            </Field>

            {/* ── Asignación cascading: Rol → Equipo → Usuario ──────── */}
            <div style={{
              border: "1px solid #EDEBE9", borderRadius: 8,
              padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10,
              background: "#FAFAFA",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: C.textMuted,
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>
                Asignación de responsable
              </div>

              {/* Rol */}
              <Field label="Rol responsable" required error={errors.assignedToRole as string}>
                <Sel
                  value={form.assignedToRole}
                  hasError={!!errors.assignedToRole}
                  onChange={(e) => {
                    const role = e.target.value as CreateWorkItemPayload["assignedToRole"];
                    setForm((f) => ({ ...f, assignedToRole: role, assignedToTeamId: "", assignedToUserId: "" }));
                    setErrors((er) => ({ ...er, assignedToRole: undefined, assignedToTeamId: undefined, assignedToUserId: undefined }));
                  }}
                >
                  <option value="IT AirEuropa">IT AirEuropa</option>
                  <option value="Proveedor">Proveedor</option>
                  <option value="Usuario">Usuario</option>
                </Sel>
              </Field>

              {/* Equipo (dependiente del rol) */}
              <Field
                label={`Equipo${form.assignedToRole === "Proveedor" ? " *" : ""}`}
                error={errors.assignedToTeamId as string}
              >
                <Sel
                  value={form.assignedToTeamId}
                  hasError={!!errors.assignedToTeamId}
                  disabled={loadingCatalogs || availableTeams.length === 0}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, assignedToTeamId: e.target.value, assignedToUserId: "" }));
                    setErrors((er) => ({ ...er, assignedToTeamId: undefined, assignedToUserId: undefined }));
                  }}
                >
                  <option value="">
                    {loadingCatalogs
                      ? "Cargando…"
                      : availableTeams.length === 0
                        ? "(sin equipos para este rol)"
                        : "— Selecciona equipo —"}
                  </option>
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Sel>
              </Field>

              {/* Usuario (dependiente del equipo) */}
              <Field
                label={`Usuario responsable${form.assignedToRole === "Proveedor" ? " *" : ""}`}
                error={errors.assignedToUserId as string}
              >
                {!loadingCatalogs && form.assignedToTeamId && availableUsers.length === 0 ? (
                  <div style={{
                    padding: "7px 10px", borderRadius: 4,
                    border: `1px solid ${C.warnBorder}`, background: C.warnBg,
                    fontSize: 12, color: "#835B00",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <AlertTriangle size={12} />
                    No hay usuarios con rol "{form.assignedToRole}" en este equipo.
                  </div>
                ) : (
                  <Sel
                    value={form.assignedToUserId}
                    hasError={!!errors.assignedToUserId}
                    disabled={loadingCatalogs || !form.assignedToTeamId}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, assignedToUserId: e.target.value }));
                      setErrors((er) => ({ ...er, assignedToUserId: undefined }));
                    }}
                  >
                    <option value="">
                      {loadingCatalogs
                        ? "Cargando…"
                        : !form.assignedToTeamId
                          ? "Selecciona primero un equipo"
                          : "— Selecciona usuario —"}
                    </option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.displayName}</option>
                    ))}
                  </Sel>
                )}
              </Field>

              {/* Ayuda contextual */}
              <div style={{ fontSize: 10, color: C.textMuted, fontStyle: "italic" }}>
                {form.assignedToRole === "Proveedor"    && "Equipo y usuario son obligatorios para tareas asignadas a Proveedor."}
                {form.assignedToRole === "IT AirEuropa" && "Selecciona el equipo interno y, opcionalmente, el técnico responsable."}
                {form.assignedToRole === "Usuario"      && "Selecciona el área y el usuario de negocio responsable."}
              </div>
            </div>

            {/* Selector de proyecto — solo cuando no viene preseleccionado */}
            {!project && projects.length > 0 && (
              <Field label="Proyecto (épica)" required>
                <Sel
                  value={selectedProject?.id ?? ""}
                  onChange={(e) => handleProjectChange(e.target.value)}
                >
                  <option value="">— Selecciona un proyecto —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                  ))}
                </Sel>
              </Field>
            )}

            {/* Fechas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Fecha inicio" required error={errors.startDate}>
                <Input
                  type="date"
                  value={form.startDate}
                  hasError={!!errors.startDate}
                  min={selectedProject?.startDate ?? undefined}
                  max={selectedProject?.endDate   ?? undefined}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </Field>
              <Field label="Fecha fin" required error={errors.endDate}>
                <Input
                  type="date"
                  value={form.endDate}
                  hasError={!!errors.endDate}
                  min={form.startDate || selectedProject?.startDate || undefined}
                  max={selectedProject?.endDate ?? undefined}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </Field>
            </div>

            {/* Advertencia fechas fuera de rango */}
            {dateWarning && (
              <div style={{
                background: C.warnBg, border: `1px solid ${C.warnBorder}`,
                borderRadius: 6, padding: "8px 12px",
                display: "flex", gap: 6, fontSize: 11, color: "#835B00",
              }}>
                <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                {dateWarning}
              </div>
            )}

            {/* Tags */}
            <Field label="Tags (separados por coma)">
              <Input
                value={tagsInput}
                placeholder="ej: backend, urgente, Q2"
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </Field>

            {/* Jira (estructura preparada — solo lectura en creación) */}
            <div style={{
              background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: 6, padding: "10px 12px",
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
                Integración Jira (Power Automate)
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
                Al crear la tarea, se registrará con <code style={{ background: "#EDEBE9", padding: "1px 4px", borderRadius: 3 }}>syncStatus = "Pending"</code>.
                Power Automate se encargará de sincronizarla con Jira automáticamente.
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{
            padding: "12px 20px",
            borderTop: "1px solid #EDEBE9",
            display: "flex", justifyContent: "flex-end", gap: 10,
            position: "sticky", bottom: 0, background: "#fff",
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "8px 18px", borderRadius: 5,
                border: "1px solid #EDEBE9", background: "#fff",
                cursor: "pointer", fontSize: 13,
                fontFamily: "'Segoe UI', sans-serif", color: C.textMid,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || success}
              style={{
                padding: "8px 20px", borderRadius: 5, border: "none",
                background: saving || success ? "#A1C9F0" : C.primary,
                color: "#fff", cursor: saving || success ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 600,
                fontFamily: "'Segoe UI', sans-serif",
                display: "flex", alignItems: "center", gap: 6,
                transition: "background 150ms",
              }}
            >
              {saving
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</>
                : success
                  ? <><CheckCircle size={13} /> Creada</>
                  : "Crear tarea"}
            </button>
          </div>
        </form>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  );
};
