// ─────────────────────────────────────────────────────────
//  src/screens/projects/components/CreateProjectModal.tsx
//  Modal para crear un nuevo Proyecto (Épica).
//
//  RBAC: visible solo para Admin / IT AirEuropa.
//  Integra POST /api/projects (MSW en dev).
// ─────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import type { BusinessArea, Provider, Team, AppUser, AppRole, VisibilityMode } from "../../../types/domain";
import { listTeams } from "../../../services/teamService";
import { listAppUsers } from "../../../services/userService";
import { filterTeamsForRole, filterUsersForAssignment } from "../../../services/assignmentService";
import { ProjectVisibilitySelector } from "./ProjectVisibilitySelector";

// ── Payload ───────────────────────────────────────────────
export interface CreateProjectPayload {
  code: string;
  name: string;
  businessAreaId: string;
  deliveryOwnerType: "IT" | "Proveedor";
  providerId: string;
  providerTeamId: string;
  status: "Pendiente" | "En curso" | "Bloqueado" | "Cerrado";
  category: string;
  priority: "Alta" | "Media" | "Baja";
  startDate: string;
  endDate: string;
  // Asignación de responsable
  assignedToRole: AppRole | "";
  assignedToTeamId: string;
  assignedToUserId: string;
  // Visibilidad
  visibilityMode: VisibilityMode;
  visibilityTeamIds: string[];
}

// Roles elegibles como responsable (no Invitado, no Admin como responsable de tarea)
const ASSIGNABLE_ROLES: AppRole[] = ["IT AirEuropa", "Proveedor", "Usuario"];

interface Props {
  open: boolean;
  areas: BusinessArea[];
  providers: Provider[];
  categories: string[];
  onClose: () => void;
  onCreated: () => void;
}

// ── Tokens de diseño ──────────────────────────────────────
const C = {
  primary:    "#0078D4",
  border:     "#EDEBE9",
  bg:         "#FAF9F8",
  text:       "#201F1E",
  textMid:    "#605E5C",
  textMuted:  "#A19F9D",
  danger:     "#D13438",
  success:    "#107C10",
};

// ── Componentes aux ───────────────────────────────────────
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

// ── Valores por defecto ───────────────────────────────────
const EMPTY_FORM: CreateProjectPayload = {
  code:              "",
  name:              "",
  businessAreaId:    "",
  deliveryOwnerType: "IT",
  providerId:        "",
  providerTeamId:    "",
  status:            "Pendiente",
  category:          "",
  priority:          "Media",
  startDate:         "",
  endDate:           "",
  assignedToRole:    "",
  assignedToTeamId:  "",
  assignedToUserId:  "",
  visibilityMode:    "Enterprise",
  visibilityTeamIds: [],
};

// ── CreateProjectModal ────────────────────────────────────
export const CreateProjectModal: React.FC<Props> = ({
  open, areas, providers, categories, onClose, onCreated,
}) => {
  const [form, setForm]     = useState<CreateProjectPayload>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateProjectPayload | "form", string>>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Datos para cascading assignment
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loadingRef, setLoadingRef] = useState(false);

  // Equipos disponibles según el rol seleccionado (para la sección responsable)
  const availableTeams = useMemo(() =>
    form.assignedToRole ? filterTeamsForRole(allTeams, form.assignedToRole as AppRole) : [],
  [allTeams, form.assignedToRole]);

  // Usuarios disponibles según rol + equipo seleccionado
  const availableUsers = useMemo(() =>
    form.assignedToRole
      ? filterUsersForAssignment(allUsers, form.assignedToRole as AppRole, form.assignedToTeamId || null)
      : [],
  [allUsers, form.assignedToRole, form.assignedToTeamId]);

  // Cargar catálogos al abrir
  useEffect(() => {
    if (!open) return;
    setLoadingRef(true);
    Promise.all([
      listTeams({ isActive: true }),
      listAppUsers({ isActive: true }),
    ]).then(([teams, users]) => {
      setAllTeams(teams);
      setAllUsers(users);
    }).catch(() => { /* silencioso — no bloquea el formulario */ })
      .finally(() => setLoadingRef(false));
  }, [open]);

  // Smart preselection de visibilityTeamIds cuando cambia deliveryOwnerType o providerTeamId
  useEffect(() => {
    if (!open) return;
    let suggested: string[];
    if (form.deliveryOwnerType === "Proveedor") {
      // Proyectos de proveedor → team-it + equipo proveedor seleccionado
      suggested = ["team-it", ...(form.providerTeamId ? [form.providerTeamId] : [])];
    } else {
      // Proyectos IT → sólo team-it
      suggested = ["team-it"];
    }
    setForm((f) => ({ ...f, visibilityTeamIds: suggested }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.deliveryOwnerType, form.providerTeamId]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      setErrors({});
      setSuccess(false);
      setTimeout(() => nameRef.current?.focus(), 80);
    }
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  // ── Validar ────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.code.trim())         errs.code = "El código es obligatorio";
    if (!form.name.trim())         errs.name = "El nombre es obligatorio";
    if (!form.businessAreaId)      errs.businessAreaId = "Selecciona un área";
    if (!form.startDate)           errs.startDate = "La fecha de inicio es obligatoria";
    if (!form.endDate)             errs.endDate   = "La fecha de fin es obligatoria";
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      errs.endDate = "La fecha de fin no puede ser anterior a la de inicio";
    // Visibilidad restringida sin equipos
    if (form.visibilityMode === "Restricted" && form.visibilityTeamIds.length === 0)
      (errs as Record<string, string>).visibilityTeamIds = "Selecciona al menos un equipo";
    // Validación de responsable: Proveedor obliga equipo + usuario
    if (form.assignedToRole === "Proveedor") {
      if (!form.assignedToTeamId) errs.assignedToTeamId = "El equipo es obligatorio para rol Proveedor";
      if (!form.assignedToUserId) errs.assignedToUserId = "El usuario responsable es obligatorio para rol Proveedor";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Guardar ────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors({});

    try {
      const resp = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 400 }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Crear proyecto"
        style={{
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 540, maxWidth: "95vw", maxHeight: "90vh",
          background: "#fff", borderRadius: 10,
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
          zIndex: 401, display: "flex", flexDirection: "column",
          fontFamily: "'Segoe UI', sans-serif",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px 14px",
          borderBottom: "1px solid #EDEBE9",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "#fff", zIndex: 1,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>
              + Nuevo proyecto
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textMuted }}>
              Crea una nueva épica de proyecto
            </p>
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

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Error global */}
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
                Proyecto creado correctamente. Cerrando…
              </div>
            )}

            {/* Código + Nombre */}
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
              <Field label="Código" required error={errors.code}>
                <Input
                  value={form.code}
                  hasError={!!errors.code}
                  placeholder="P-XXX"
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                />
              </Field>
              <Field label="Nombre del proyecto" required error={errors.name}>
                <Input
                  ref={nameRef}
                  value={form.name}
                  hasError={!!errors.name}
                  placeholder="Descripción del proyecto"
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
            </div>

            {/* Área + Tipo de ejecución */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Área de negocio" required error={errors.businessAreaId}>
                <Sel
                  value={form.businessAreaId}
                  hasError={!!errors.businessAreaId}
                  onChange={(e) => setForm((f) => ({ ...f, businessAreaId: e.target.value }))}
                >
                  <option value="">— Selecciona —</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Sel>
              </Field>
              <Field label="Ejecutado por">
                <Sel
                  value={form.deliveryOwnerType}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    deliveryOwnerType: e.target.value as CreateProjectPayload["deliveryOwnerType"],
                    providerId: e.target.value === "IT" ? "" : f.providerId,
                  }))}
                >
                  <option value="IT">IT AirEuropa</option>
                  <option value="Proveedor">Proveedor</option>
                </Sel>
              </Field>
            </div>

            {/* Proveedor (solo si deliveryOwnerType=Proveedor) */}
            {form.deliveryOwnerType === "Proveedor" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Empresa proveedora">
                  <Sel
                    value={form.providerId}
                    onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}
                  >
                    <option value="">— Sin proveedor —</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Sel>
                </Field>
                <Field label="Equipo proveedor">
                  <Sel
                    value={form.providerTeamId}
                    onChange={(e) => setForm((f) => ({ ...f, providerTeamId: e.target.value }))}
                  >
                    <option value="">— Sin equipo —</option>
                    {allTeams
                      .filter((t) => t.type === "Provider" && t.isActive)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </Sel>
                </Field>
              </div>
            )}

            {/* Estado + Prioridad */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Estado inicial">
                <Sel
                  value={form.status}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    status: e.target.value as CreateProjectPayload["status"],
                  }))}
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="En curso">En curso</option>
                  <option value="Bloqueado">Bloqueado</option>
                  <option value="Cerrado">Cerrado</option>
                </Sel>
              </Field>
              <Field label="Prioridad">
                <Sel
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    priority: e.target.value as CreateProjectPayload["priority"],
                  }))}
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </Sel>
              </Field>
            </div>

            {/* Categoría */}
            <Field label="Categoría">
              {categories.length > 0 ? (
                <Sel
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="">— Sin categoría —</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Sel>
              ) : (
                <Input
                  value={form.category}
                  placeholder="ej: Transformación, Infraestructura…"
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
              )}
            </Field>

            {/* ── Asignación de responsable ────────────────────── */}
            <div style={{
              border: "1px solid #EDEBE9", borderRadius: 8,
              padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12,
              background: "#FAFAFA",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.textMid, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Responsable del proyecto
              </div>

              {/* Rol responsable */}
              <Field label="Rol responsable" error={errors.assignedToRole as string}>
                <Sel
                  value={form.assignedToRole}
                  hasError={!!errors.assignedToRole}
                  onChange={(e) => {
                    const role = e.target.value as AppRole | "";
                    setForm((f) => ({ ...f, assignedToRole: role, assignedToTeamId: "", assignedToUserId: "" }));
                    setErrors((er) => ({ ...er, assignedToRole: undefined, assignedToTeamId: undefined, assignedToUserId: undefined }));
                  }}
                >
                  <option value="">— Sin asignar —</option>
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Sel>
              </Field>

              {/* Equipo (dependiente del rol) */}
              {form.assignedToRole && (
                <Field
                  label={`Equipo${form.assignedToRole === "Proveedor" ? " *" : ""}`}
                  error={errors.assignedToTeamId as string}
                >
                  <Sel
                    value={form.assignedToTeamId}
                    hasError={!!errors.assignedToTeamId}
                    disabled={loadingRef || availableTeams.length === 0}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, assignedToTeamId: e.target.value, assignedToUserId: "" }));
                      setErrors((er) => ({ ...er, assignedToTeamId: undefined, assignedToUserId: undefined }));
                    }}
                  >
                    <option value="">
                      {loadingRef ? "Cargando…" : availableTeams.length === 0 ? "(sin equipos disponibles)" : "— Selecciona equipo —"}
                    </option>
                    {availableTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Sel>
                </Field>
              )}

              {/* Usuario (dependiente del equipo) */}
              {form.assignedToRole && form.assignedToTeamId && (
                <Field
                  label={`Usuario responsable${form.assignedToRole === "Proveedor" ? " *" : ""}`}
                  error={errors.assignedToUserId as string}
                >
                  <Sel
                    value={form.assignedToUserId}
                    hasError={!!errors.assignedToUserId}
                    disabled={loadingRef || availableUsers.length === 0}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, assignedToUserId: e.target.value }));
                      setErrors((er) => ({ ...er, assignedToUserId: undefined }));
                    }}
                  >
                    <option value="">
                      {loadingRef ? "Cargando…" : availableUsers.length === 0 ? "(sin usuarios en este equipo)" : "— Selecciona usuario —"}
                    </option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.displayName}</option>
                    ))}
                  </Sel>
                </Field>
              )}

              {/* Ayuda contextual */}
              <div style={{ fontSize: 10, color: C.textMuted, fontStyle: "italic" }}>
                {form.assignedToRole === "Proveedor" && "El equipo y usuario responsable son obligatorios para proyectos de tipo Proveedor."}
                {form.assignedToRole === "IT AirEuropa" && "Selecciona el equipo interno y, opcionalmente, el técnico responsable."}
                {form.assignedToRole === "Usuario" && "Selecciona el área y el usuario solicitante como responsable."}
                {!form.assignedToRole && "El responsable puede asignarse más tarde."}
              </div>
            </div>

            {/* Visibilidad */}
            <ProjectVisibilitySelector
              mode={form.visibilityMode}
              teamIds={form.visibilityTeamIds}
              availableTeams={allTeams.filter((t) => t.isActive)}
              onChange={(mode, teamIds) =>
                setForm((f) => ({ ...f, visibilityMode: mode, visibilityTeamIds: teamIds }))
              }
              error={(errors as Record<string, string>).visibilityTeamIds}
            />

            {/* Fechas */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Fecha inicio" required error={errors.startDate}>
                <Input
                  type="date"
                  value={form.startDate}
                  hasError={!!errors.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </Field>
              <Field label="Fecha fin" required error={errors.endDate}>
                <Input
                  type="date"
                  value={form.endDate}
                  hasError={!!errors.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </Field>
            </div>
          </div>

          {/* Footer */}
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
                cursor: saving ? "not-allowed" : "pointer", fontSize: 13,
                fontFamily: "'Segoe UI', sans-serif", color: C.textMid,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || success}
              style={{
                padding: "8px 20px", borderRadius: 5,
                border: "none", background: C.primary,
                color: "#fff", fontSize: 13, fontWeight: 600,
                fontFamily: "'Segoe UI', sans-serif",
                cursor: saving || success ? "not-allowed" : "pointer",
                opacity: saving || success ? 0.7 : 1,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</> : "Crear proyecto"}
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
