// ─────────────────────────────────────────────────────────
//  src/screens/requests/components/TriageWizardModal.tsx
//
//  Modal de Triage IT completo (gobierno IT).
//  Layout 2 columnas:
//   Izquierda  → Detalle de la solicitud (solo lectura)
//   Derecha    → Wizard: A) Decisión · B) Clasificación
//                        C) Ejecución · D) Backlog · E) Feedback
//
//  RBAC: solo Admin / IT AirEuropa
// ─────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRightCircle, CheckCircle, Copy,
  File, FileText, HelpCircle, Image as ImageIcon, Paperclip, Plus, Trash2,
  Save, X, XCircle,
} from "lucide-react";
import type {
  Request, RequestType, Priority, WorkItemType,
  Team, BusinessArea, Project, RequestAttachment,
  TriageDecision, TriageCategory, TriageEstimate,
  TriageReason, TriageBacklogBucket, DraftTask, AppRole,
} from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";

// ── Helper to make an empty draft task ─────────────────────
const makeTask = (defaults: Partial<DraftTask> = {}): DraftTask & { _id: string } => ({
  _id:             Math.random().toString(36).slice(2),
  title:           "",
  type:            "Feature",
  priority:        "Media",
  stateId:         "st-new",
  assignedToRole:  "IT AirEuropa" as AppRole,
  assignedToTeamId: null,
  assignedToUserId: "",
  startDate:       undefined,
  endDate:         undefined,
  tags:            [],
  ...defaults,
} as DraftTask & { _id: string });
import {
  REQUEST_STATUS_COLORS, REQUEST_TYPE_LABELS, REQUEST_TYPE_COLORS,
  PRIORITY_COLORS,
  fullTriageRequest,
  getRequestAttachments,
  downloadAttachmentFile,
  fetchAttachmentBlobUrl,
} from "../../../services/requestService";

// ── Catálogos ──────────────────────────────────────────────
const CATEGORIES: TriageCategory[] = ["Bug", "Evolutivo", "Integración", "Reporte", "Normativa"];
const ESTIMATES:  TriageEstimate[]  = ["XS", "S", "M", "L"];
const PRIORITIES: Priority[]        = ["Alta", "Media", "Baja"];
const REJECT_REASONS: TriageReason[] = [
  "Fuera alcance", "Duplicada", "No viable", "No prioritario", "Falta información",
];
const BACKLOG_BUCKETS: TriageBacklogBucket[] = [
  "Pendiente priorización", "Plan Q3", "En espera", "Sin fecha",
];
const WI_TYPES: WorkItemType[] = ["Feature", "Bug", "TechDebt", "Spike"];

// Mapa RequestType → WorkItemType sugerido
const TYPE_MAP: Record<RequestType, WorkItemType> = {
  Bug:             "Bug",
  Feature:         "Feature",
  Mejora:          "Feature",
  Incidencia:      "Bug",
  Consulta:        "Spike",
  CambioNormativo: "TechDebt",
  Impedimento:     "Bug",
};

// ── Tokens de estilo ───────────────────────────────────────
const C = {
  border:      "#EDEBE9",
  surface:     "#FAFAFA",
  text:        "#201F1E",
  muted:       "#8A8886",
  blue:        "#0078D4",
  green:       "#107C10",
  amber:       "#986F0B",
  red:         "#D13438",
  purple:      "#8764B8",
  teal:        "#00B7C3",
  sectionBg:   "#F3F9FF",
  sectionBorder: "#C7E0F4",
} as const;

const INPUT: React.CSSProperties = {
  width: "100%", padding: "7px 10px",
  border: `1px solid ${C.border}`, borderRadius: 5,
  fontSize: 13, fontFamily: "'Segoe UI', sans-serif",
  color: C.text, background: "#fff",
  boxSizing: "border-box",
};

const LBL: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 4,
  fontSize: 12, color: "#605E5C", fontFamily: "'Segoe UI', sans-serif",
};

// ── Helpers visuales ───────────────────────────────────────
const Chip: React.FC<{ children: React.ReactNode; color: string }> = ({ children, color }) => (
  <span style={{
    display: "inline-block", padding: "2px 9px", borderRadius: 99,
    fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    background: `${color}22`, color, border: `1px solid ${color}55`,
  }}>{children}</span>
);

const StatusBadge: React.FC<{ status: Request["status"] }> = ({ status }) => (
  <span style={{
    display: "inline-block", padding: "3px 10px", borderRadius: 99,
    fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    background: REQUEST_STATUS_COLORS[status] ?? C.muted,
    color: "#fff",
  }}>{status}</span>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
      {label}
    </div>
    <div style={{ fontSize: 13, color: C.text }}>{children}</div>
  </div>
);

const SectionBox: React.FC<{
  letter: string; title: string; color: string; children: React.ReactNode;
}> = ({ letter, title, color, children }) => (
  <div style={{
    border: `1.5px solid ${color}55`, borderRadius: 8,
    background: `${color}08`, marginBottom: 16,
  }}>
    <div style={{
      padding: "8px 14px", borderBottom: `1px solid ${color}33`,
      display: "flex", alignItems: "center", gap: 8,
      background: `${color}11`, borderRadius: "6px 6px 0 0",
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: "50%",
        background: color, color: "#fff",
        fontSize: 11, fontWeight: 800,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>{letter}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{title}</span>
    </div>
    <div style={{ padding: "12px 14px" }}>{children}</div>
  </div>
);

const RadioCard: React.FC<{
  value: TriageDecision;
  current: TriageDecision | null;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  onChange: (v: TriageDecision) => void;
}> = ({ value, current, label, description, icon, color, onChange }) => {
  const active = current === value;
  return (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "10px 12px",
      border: `2px solid ${active ? color : C.border}`,
      borderRadius: 8, cursor: "pointer",
      background: active ? `${color}0d` : "#fff",
      transition: "border-color 120ms, background 120ms",
    }}>
      <input
        type="radio" name="triage-decision" value={value}
        checked={active}
        onChange={() => onChange(value)}
        style={{ marginTop: 3, flexShrink: 0, accentColor: color }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
          <span style={{ color, display: "flex" }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: active ? color : C.text }}>
            {label}
          </span>
        </div>
        <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{description}</span>
      </div>
    </label>
  );
};

// ── Props ───────────────────────────────────────────────────
interface Props {
  request:      Request;
  appUsers:     AppUser[];
  teams:        Team[];
  fullProjects: Project[];
  areas:        BusinessArea[];
  currentUser:  AppUser;
  selectedYear: number;
  onClose:      () => void;
  onConfirmed:  () => void;
}

// ── Componente principal ────────────────────────────────────
export const TriageWizardModal: React.FC<Props> = ({
  request, appUsers, teams, fullProjects, areas,
  currentUser: _currentUser, selectedYear,
  onClose, onConfirmed,
}) => {
  // Pre-poblar desde borrador guardado
  const [decision, setDecision]       = useState<TriageDecision | null>(request.triageDecision ?? null);
  const [category, setCategory]       = useState<TriageCategory | "">(request.triageCategory ?? "");
  const [priorityIT, setPriorityIT]   = useState<Priority | "">(request.triagePriorityIT ?? "");
  const [estimate, setEstimate]       = useState<TriageEstimate | "">(request.triageEstimate ?? "");
  const [note, setNote]               = useState(request.triageNote ?? "");
  const [reason, setReason]           = useState<TriageReason | "">(request.triageReason ?? "");
  const [backlogBucket, setBacklogBucket] = useState<TriageBacklogBucket | "">(request.triageBacklogBucket ?? "");

  // Sección C — Ejecución multi-tarea (convert)
  type TaskRow = DraftTask & { _id: string };
  const defaultProject = request.relatedProjectId ?? "";
  const [draftTasks, setDraftTasks] = useState<TaskRow[]>(() => [
    makeTask({
      title: request.title,
      type:  TYPE_MAP[request.type] ?? "Feature",
      assignedToTeamId: request.triageExecutorTeamId ?? null,
      assignedToUserId: request.triageExecutorUserId ?? "",
    } as Partial<DraftTask>),
  ]);
  // Proyecto común para todas las tareas (puede sobrescribirse por tarea)
  const [sharedProjectId, setSharedProjectId] = useState(defaultProject);

  // helpers de fila
  const updateTask = (idx: number, patch: Partial<DraftTask>) =>
    setDraftTasks(prev => prev.map((t, i) => i === idx ? { ...t, ...patch } : t));
  const addTask = () =>
    setDraftTasks(prev => [...prev, makeTask({ type: TYPE_MAP[request.type] ?? "Feature", assignedToTeamId: sharedProjectId ? null : null })]);
  const removeTask = (idx: number) =>
    setDraftTasks(prev => prev.filter((_, i) => i !== idx));
  const duplicateTask = (idx: number) =>
    setDraftTasks(prev => {
      const copy = { ...prev[idx], _id: Math.random().toString(36).slice(2) };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const [saving, setSaving]           = useState(false);
  const [savingDraft, setSavingDraft]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [draftSaved, setDraftSaved]     = useState(false);

  // Adjuntos de la solicitud
  const [attachments, setAttachments]   = useState<RequestAttachment[]>([]);
  const [loadingAtts, setLoadingAtts]   = useState(true);

  // Previsualización inline — evita window.open (bloqueado en el iframe de Power Apps)
  const [previewState, setPreviewState] = useState<{
    blobUrl: string; mimeType: string; name: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setLoadingAtts(true);
    getRequestAttachments(request.id)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAtts(false));
  }, [request.id]);

  // ── Previsualización de adjuntos ─────────────────────
  async function handlePreview(att: RequestAttachment) {
    setPreviewLoading(true);
    try {
      const blobUrl = await fetchAttachmentBlobUrl(att);
      setPreviewState({ blobUrl, mimeType: att.mimeType, name: att.name });
    } catch {
      // no se puede previsualizar
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    if (previewState) URL.revokeObjectURL(previewState.blobUrl);
    setPreviewState(null);
  }

  // Maps auxiliares
  const maps = useMemo(() => ({
    user:    new Map(appUsers.map(u => [u.id, u.displayName])),
    team:    new Map(teams.map(t => [t.id, t.name])),
    area:    new Map(areas.map(a => [a.id, a.name])),
    project: new Map(fullProjects.map(p => [p.id, p.name])),
  }), [appUsers, teams, areas, fullProjects]);

  // Filtros de combos
  const itUsers   = useMemo(() =>
    appUsers.filter(u => u.isActive && (u.role === "Admin" || u.role === "IT AirEuropa")),
    [appUsers]);

  const execTeams = useMemo(() =>
    teams.filter(t => t.isActive && (t.type === "Internal" || t.type === "Provider")),
    [teams]);

  // usersForTeam: helper para obtener usuarios de un team en los rows de tareas
  const usersForTeam = useMemo(() => {
    const map = new Map<string, AppUser[]>();
    execTeams.forEach(t => {
      map.set(t.id, appUsers.filter(u => u.isActive && (u.teamIds ?? []).includes(t.id)));
    });
    return map;
  }, [execTeams, appUsers]);

  const yearProjects = useMemo(() =>
    fullProjects.filter(p => p.startDate.startsWith(String(selectedYear))),
    [fullProjects, selectedYear]);

  // ── Helpers de validación ─────────────────────────────
  function validate(): string | null {
    if (!decision) return "Selecciona una decisión de triage.";
    if ((decision === "approve-backlog" || decision === "convert")) {
      if (!category)   return "La categoría IT es obligatoria.";
      if (!priorityIT) return "La prioridad IT es obligatoria.";
    }
    if (decision === "convert") {
      if (!estimate) return "La estimación de tamaño es obligatoria.";
      if (!sharedProjectId) return "El proyecto destino es obligatorio.";
      if (draftTasks.length === 0) return "Debe añadir al menos una tarea.";
      for (let i = 0; i < draftTasks.length; i++) {
        const t = draftTasks[i];
        if (!t.title.trim()) return `La tarea ${i + 1} no tiene título.`;
        if (!t.assignedToUserId) return `La tarea ${i + 1} no tiene responsable asignado.`;
      }
      if (!note.trim()) return "La nota de triage es obligatoria para convertir.";
    }
    if (decision === "approve-backlog" && !backlogBucket) {
      return "El bucket de backlog es obligatorio.";
    }
    if (decision === "request-info" && !note.trim()) {
      return "La nota con la información solicitada es obligatoria.";
    }
    if (decision === "reject") {
      if (!note.trim()) return "El motivo de rechazo es obligatorio.";
      if (!reason)      return "El motivo estandarizado de rechazo es obligatorio.";
    }
    return null;
  }

  // ── Guardar borrador ──────────────────────────────────
  async function handleDraft() {
    setSavingDraft(true);
    setError(null);
    try {
      await fullTriageRequest(request.id, {
        decision:      decision ?? "request-info",
        draft:         true,
        note:          note.trim() || undefined,
        category:      category || undefined,
        priorityIT:    priorityIT || undefined,
        estimate:      estimate || undefined,
        projectId:     sharedProjectId || undefined,
        executorTeamId: draftTasks[0]?.assignedToTeamId ?? undefined,
        executorUserId: draftTasks[0]?.assignedToUserId ?? undefined,
        backlogBucket: backlogBucket || undefined,
        reason:        reason || undefined,
      });
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el borrador.");
    } finally {
      setSavingDraft(false);
    }
  }

  // ── Confirmar decisión ────────────────────────────────
  async function handleConfirm() {
    const validErr = validate();
    if (validErr) { setError(validErr); return; }

    setSaving(true);
    setError(null);
    try {
      const tasksPayload: DraftTask[] = draftTasks.map(({ _id: _ignored, ...rest }) => ({
        ...rest,
        projectId: sharedProjectId,
      } as DraftTask & { projectId: string }));

      await fullTriageRequest(request.id, {
        decision:       decision!,
        draft:          false,
        note:           note.trim() || undefined,
        category:       category || undefined,
        priorityIT:     priorityIT || undefined,
        estimate:       estimate || undefined,
        projectId:      sharedProjectId || undefined,
        tasks:          decision === "convert" ? tasksPayload : undefined,
        backlogBucket:  backlogBucket || undefined,
        reason:         reason || undefined,
      } as Parameters<typeof fullTriageRequest>[1]);
      onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al confirmar la decisión.");
    } finally {
      setSaving(false);
    }
  }

  // ── Urgency labels ────────────────────────────────────
  const URGENCY_LABELS: Record<string, string> = {
    inmediato: "🚨 Inmediato",
    semana:    "⚡ Esta semana",
    mes:       "📅 Este mes",
    backlog:   "🗂️ Backlog",
  };

  // ── Render ────────────────────────────────────────────
  const isClosed = ["Convertida", "Cancelada", "Rechazada"].includes(request.status);

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1100,
        padding: "16px",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 12,
        width: "min(980px, 100%)",
        maxHeight: "calc(100vh - 32px)",
        display: "flex", flexDirection: "column",
        boxShadow: "0 16px 60px rgba(0,0,0,0.28)",
        fontFamily: "'Segoe UI', sans-serif",
        overflow: "hidden",
      }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          padding: "16px 20px 14px",
          borderBottom: `1px solid ${C.border}`,
          background: "#F3F9FF",
          display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <StatusBadge status={request.status} />
              <Chip color={REQUEST_TYPE_COLORS[request.type] ?? C.muted}>
                {REQUEST_TYPE_LABELS[request.type]}
              </Chip>
              <span style={{ fontSize: 11, fontWeight: 700, color: PRIORITY_COLORS[request.priority] ?? C.muted }}>
                ● {request.priority}
              </span>
              {request.triageDecision && (
                <span style={{ fontSize: 11, color: C.muted, fontStyle: "italic" }}>
                  (borrador guardado)
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.35 }}>
              Triage IT — {request.title}
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: C.muted }}>
              #{request.id.slice(-8)} · {new Date(request.createdOn).toLocaleDateString("es-ES")}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Cerrar"
            style={{
              background: "#F3F2F1", border: `1px solid ${C.border}`,
              borderRadius: 6, cursor: "pointer", color: C.text,
              padding: "6px 10px", display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontFamily: "'Segoe UI', sans-serif", flexShrink: 0,
            }}
          >
            <X size={14} /> Cerrar
          </button>
        </div>

        {/* ── Body 2 columnas ────────────────────────────── */}
        <div style={{
          flex: 1, overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 0,
        }}>

          {/* ═══ COLUMNA IZQUIERDA: Detalle solicitud ═══════ */}
          <div style={{
            borderRight: `1px solid ${C.border}`,
            padding: "20px 18px",
            overflowY: "auto",
            background: C.surface,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
              Solicitud
            </div>

            <Field label="Título">
              <span style={{ fontWeight: 600, lineHeight: 1.4 }}>{request.title}</span>
            </Field>

            <Field label="Tipo">
              <Chip color={REQUEST_TYPE_COLORS[request.type] ?? C.muted}>
                {REQUEST_TYPE_LABELS[request.type]}
              </Chip>
            </Field>

            {request.businessAreaId && (
              <Field label="Área de negocio">
                {maps.area.get(request.businessAreaId) ?? request.businessAreaId}
              </Field>
            )}

            <Field label="Solicitado por">
              <span>
                {maps.user.get(request.requestedByUserId) ?? request.requestedByUserId}
                <span style={{ color: C.muted, fontSize: 11, marginLeft: 5 }}>
                  ({request.requestedByRole})
                </span>
              </span>
            </Field>

            {request.requestedByTeamId && (
              <Field label="Equipo">
                {maps.team.get(request.requestedByTeamId) ?? request.requestedByTeamId}
              </Field>
            )}

            {request.urgency && (
              <Field label="Urgencia">
                {URGENCY_LABELS[request.urgency] ?? request.urgency}
              </Field>
            )}

            <Field label="Fecha de creación">
              {new Date(request.createdOn).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
            </Field>

            {request.relatedProjectId && (
              <Field label="Proyecto relacionado">
                {maps.project.get(request.relatedProjectId) ?? request.relatedProjectId}
              </Field>
            )}

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Descripción
              </div>
              <div style={{
                fontSize: 12, color: C.text, lineHeight: 1.65,
                whiteSpace: "pre-wrap",
                background: "#fff", border: `1px solid ${C.border}`,
                borderRadius: 6, padding: "10px 12px",
                maxHeight: 260, overflowY: "auto",
              }}>
                {request.description || <em style={{ color: C.muted }}>Sin descripción.</em>}
              </div>
            </div>

            {/* ── Adjuntos ── */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <Paperclip size={11} />
                Adjuntos{attachments.length > 0 ? ` (${attachments.length})` : ""}
              </div>

              {loadingAtts && (
                <span style={{ fontSize: 12, color: C.muted }}>Cargando adjuntos…</span>
              )}

              {!loadingAtts && attachments.length === 0 && (
                <span style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>No hay archivos adjuntos.</span>
              )}

              {!loadingAtts && attachments.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {attachments.map(att => {
                    const isImage = att.mimeType.startsWith("image/");
                    const isPdf   = att.mimeType === "application/pdf";
                    const isDataUrl = att.url.startsWith("data:");
                    const ext = att.name.split(".").pop()?.toUpperCase() ?? "";

                    return (
                      <div key={att.id} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px",
                        border: `1px solid ${C.border}`,
                        borderRadius: 6, background: "#fff",
                      }}>
                        {/* Icono / miniatura */}
                        {isImage && isDataUrl ? (
                          <img
                            src={att.url} alt={att.name}
                            style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 3, flexShrink: 0, cursor: "pointer" }}
                            onClick={() => void handlePreview(att)}
                          />
                        ) : (
                          <div style={{
                            width: 32, height: 32, borderRadius: 4,
                            background: isPdf ? "#FFF4CE" : isImage ? "#EFF6FC" : "#F3F2F1",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: isPdf ? "#986F0B" : isImage ? C.blue : C.muted,
                            flexShrink: 0,
                          }}>
                            {isPdf ? <FileText size={14} /> : isImage ? <ImageIcon size={14} /> : <File size={14} />}
                          </div>
                        )}

                        {/* Nombre + metadatos */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {att.name}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted }}>
                            {ext}{att.sizeBytes > 0 ? ` · ${(att.sizeBytes / 1024).toFixed(0)} KB` : ""}
                          </div>
                        </div>

                        {/* Acciones */}
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {(isImage || isPdf) && (
                            <button
                              onClick={() => void handlePreview(att)}
                              disabled={previewLoading}
                              title="Ver"
                              style={{
                                fontSize: 11, color: C.blue, background: "none",
                                border: `1px solid ${C.blue}33`, borderRadius: 4,
                                cursor: previewLoading ? "wait" : "pointer", padding: "3px 8px",
                                fontFamily: "'Segoe UI', sans-serif",
                              }}
                            >
                              Ver
                            </button>
                          )}
                          {isDataUrl ? (
                            <a
                              href={att.url} download={att.name}
                              style={{
                                fontSize: 11, color: "#605E5C", background: "none",
                                border: `1px solid ${C.border}`, borderRadius: 4,
                                cursor: "pointer", padding: "3px 8px",
                                fontFamily: "'Segoe UI', sans-serif",
                                textDecoration: "none",
                              }}
                            >
                              Descargar
                            </a>
                          ) : (
                            <button
                              onClick={() => void downloadAttachmentFile(att)}
                              title="Descargar"
                              style={{
                                fontSize: 11, color: "#605E5C", background: "none",
                                border: `1px solid ${C.border}`, borderRadius: 4,
                                cursor: "pointer", padding: "3px 8px",
                                fontFamily: "'Segoe UI', sans-serif",
                              }}
                            >
                              Descargar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Triage previo guardado */}
            {request.triageOwnerUserId && (
              <div style={{
                marginTop: 8, padding: "10px 12px",
                background: "#fff", border: `1px solid ${C.border}`, borderRadius: 6,
              }}>
                <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  Gestionado por
                </div>
                <div style={{ fontSize: 12, color: C.text }}>
                  {maps.user.get(request.triageOwnerUserId) ?? request.triageOwnerUserId}
                </div>
                {request.triageCategory && (
                  <div style={{ marginTop: 4, fontSize: 11, color: C.muted }}>
                    Cat: {request.triageCategory} · Prio: {request.triagePriorityIT} · Est: {request.triageEstimate}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ COLUMNA DERECHA: Wizard ═══════════════════ */}
          <div style={{ padding: "20px 20px", overflowY: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
              Decisión de gobierno IT
            </div>

            {isClosed && (
              <div style={{
                padding: "12px 14px", marginBottom: 16,
                background: "#FAF9F8", border: `1px solid ${C.border}`,
                borderRadius: 8, fontSize: 13, color: C.muted,
              }}>
                Esta solicitud está en estado <strong>{request.status}</strong> — sin acciones disponibles.
              </div>
            )}

            {!isClosed && (
              <>
                {/* ── SECCIÓN A: Decisión ─────────────────── */}
                <SectionBox letter="A" title="Decisión" color={C.blue}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <RadioCard
                      value="approve-backlog" current={decision}
                      label="Aprobar y dejar en Backlog"
                      description="Solicitud aprobada. Queda pendiente de convertir en tarea cuando haya capacidad."
                      icon={<CheckCircle size={14} />}
                      color={C.green}
                      onChange={setDecision}
                    />
                    <RadioCard
                      value="convert" current={decision}
                      label="Convertir en Tarea"
                      description="Aprueba y convierte directamente en WorkItem asignando equipo y responsable."
                      icon={<ArrowRightCircle size={14} />}
                      color={C.blue}
                      onChange={setDecision}
                    />
                    <RadioCard
                      value="request-info" current={decision}
                      label="Pedir Información"
                      description="Solicitar información adicional al solicitante antes de decidir."
                      icon={<HelpCircle size={14} />}
                      color={C.amber}
                      onChange={setDecision}
                    />
                    <RadioCard
                      value="reject" current={decision}
                      label="Rechazar"
                      description="Rechazar la solicitud indicando el motivo al solicitante."
                      icon={<XCircle size={14} />}
                      color={C.red}
                      onChange={setDecision}
                    />
                  </div>
                </SectionBox>

                {/* ── SECCIÓN B: Clasificación IT ─────────── */}
                {(decision === "approve-backlog" || decision === "convert") && (
                  <SectionBox letter="B" title="Clasificación IT" color={C.purple}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <label style={LBL}>
                        Categoría IT <span style={{ color: C.red }}>*</span>
                        <select
                          value={category}
                          onChange={e => setCategory(e.target.value as TriageCategory | "")}
                          style={{ ...INPUT, appearance: "auto" }}
                        >
                          <option value="">Selecciona…</option>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>

                      <label style={LBL}>
                        Prioridad IT <span style={{ color: C.red }}>*</span>
                        <select
                          value={priorityIT}
                          onChange={e => setPriorityIT(e.target.value as Priority | "")}
                          style={{ ...INPUT, appearance: "auto" }}
                        >
                          <option value="">Selecciona…</option>
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </label>

                      <label style={LBL}>
                        Estimación <span style={{ color: decision === "convert" ? C.red : C.muted }}>
                          {decision === "convert" ? "*" : "(opcional)"}
                        </span>
                        <select
                          value={estimate}
                          onChange={e => setEstimate(e.target.value as TriageEstimate | "")}
                          style={{ ...INPUT, appearance: "auto" }}
                        >
                          <option value="">Selecciona…</option>
                          {ESTIMATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                    </div>
                  </SectionBox>
                )}

                {/* ── SECCIÓN C: Tareas a crear (solo convert) ─── */}
                {decision === "convert" && (
                  <SectionBox letter="C" title="Tareas a crear" color={C.blue}>
                    {/* Proyecto destino común */}
                    <label style={{ ...LBL, marginBottom: 14 }}>
                      Proyecto destino (todas las tareas) <span style={{ color: C.red }}>*</span>
                      <select
                        value={sharedProjectId}
                        onChange={e => setSharedProjectId(e.target.value)}
                        style={{ ...INPUT, appearance: "auto" }}
                      >
                        <option value="">Selecciona proyecto…</option>
                        {yearProjects.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </label>

                    {/* Repeater de tareas */}
                    {draftTasks.map((task, idx) => {
                      const taskUsers = task.assignedToTeamId
                        ? (usersForTeam.get(task.assignedToTeamId) ?? itUsers)
                        : itUsers;
                      return (
                        <div key={task._id} style={{
                          border: `1px solid ${C.border}`, borderRadius: 8,
                          padding: "12px 14px", marginBottom: 12,
                          background: "#fff",
                          position: "relative",
                        }}>
                          {/* Cabecera de fila */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <span style={{
                              width: 20, height: 20, borderRadius: "50%",
                              background: C.blue, color: "#fff",
                              fontSize: 11, fontWeight: 800,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0,
                            }}>{idx + 1}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.text, flex: 1 }}>Tarea {idx + 1}</span>
                            <button
                              onClick={() => duplicateTask(idx)}
                              title="Duplicar tarea"
                              style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, padding: 4 }}
                            ><Copy size={14} /></button>
                            {draftTasks.length > 1 && (
                              <button
                                onClick={() => removeTask(idx)}
                                title="Eliminar tarea"
                                style={{ background: "none", border: "none", cursor: "pointer", color: C.red, padding: 4 }}
                              ><Trash2 size={14} /></button>
                            )}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            {/* Título */}
                            <label style={{ ...LBL, gridColumn: "1 / -1" }}>
                              Título <span style={{ color: C.red }}>*</span>
                              <input
                                type="text"
                                value={task.title}
                                onChange={e => updateTask(idx, { title: e.target.value })}
                                style={INPUT}
                                maxLength={150}
                                placeholder="Título de la tarea…"
                              />
                            </label>

                            {/* Tipo */}
                            <label style={LBL}>
                              Tipo
                              <select
                                value={task.type}
                                onChange={e => updateTask(idx, { type: e.target.value as WorkItemType })}
                                style={{ ...INPUT, appearance: "auto" }}
                              >
                                {WI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </label>

                            {/* Prioridad */}
                            <label style={LBL}>
                              Prioridad
                              <select
                                value={task.priority}
                                onChange={e => updateTask(idx, { priority: e.target.value as Priority })}
                                style={{ ...INPUT, appearance: "auto" }}
                              >
                                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </label>

                            {/* Estado inicial */}
                            <label style={LBL}>
                              Estado inicial
                              <select
                                value={task.stateId}
                                onChange={e => updateTask(idx, { stateId: e.target.value })}
                                style={{ ...INPUT, appearance: "auto" }}
                              >
                                <option value="st-new">Nuevo</option>
                                <option value="st-ref">Refinamiento</option>
                              </select>
                            </label>

                            {/* Equipo ejecutor */}
                            <label style={LBL}>
                              Equipo ejecutor <span style={{ color: C.red }}>*</span>
                              <select
                                value={task.assignedToTeamId ?? ""}
                                onChange={e => updateTask(idx, {
                                  assignedToTeamId: e.target.value || null,
                                  assignedToUserId: "",
                                })}
                                style={{ ...INPUT, appearance: "auto" }}
                              >
                                <option value="">Selecciona equipo…</option>
                                {execTeams.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </label>

                            {/* Responsable */}
                            <label style={LBL}>
                              Responsable <span style={{ color: C.red }}>*</span>
                              <select
                                value={task.assignedToUserId}
                                onChange={e => updateTask(idx, { assignedToUserId: e.target.value })}
                                style={{ ...INPUT, appearance: "auto" }}
                              >
                                <option value="">Selecciona responsable…</option>
                                {taskUsers.map(u => (
                                  <option key={u.id} value={u.id}>{u.displayName}</option>
                                ))}
                              </select>
                            </label>

                            {/* Fecha inicio */}
                            <label style={LBL}>
                              Fecha inicio
                              <input
                                type="date"
                                value={task.startDate ?? ""}
                                onChange={e => updateTask(idx, { startDate: e.target.value || undefined })}
                                style={INPUT}
                              />
                            </label>

                            {/* Fecha fin */}
                            <label style={LBL}>
                              Fecha fin
                              <input
                                type="date"
                                value={task.endDate ?? ""}
                                onChange={e => updateTask(idx, { endDate: e.target.value || undefined })}
                                style={INPUT}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}

                    {/* Botón añadir tarea */}
                    <button
                      onClick={addTask}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "7px 14px",
                        border: `1.5px dashed ${C.blue}`,
                        borderRadius: 6,
                        background: "transparent",
                        color: C.blue,
                        fontSize: 12, fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Segoe UI', sans-serif",
                        width: "100%",
                        justifyContent: "center",
                      }}
                    >
                      <Plus size={14} /> Añadir tarea
                    </button>
                  </SectionBox>
                )}

                {/* ── SECCIÓN D: Backlog (solo approve-backlog) */}
                {decision === "approve-backlog" && (
                  <SectionBox letter="D" title="Planificación backlog" color={C.green}>
                    <label style={LBL}>
                      Bucket de backlog <span style={{ color: C.red }}>*</span>
                      <select
                        value={backlogBucket}
                        onChange={e => setBacklogBucket(e.target.value as TriageBacklogBucket | "")}
                        style={{ ...INPUT, appearance: "auto", marginTop: 2 }}
                      >
                        <option value="">Selecciona…</option>
                        {BACKLOG_BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </label>
                    <label style={{ ...LBL, marginTop: 12 }}>
                      Nota para el solicitante (opcional)
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={3}
                        placeholder="Indica cuándo o en qué condiciones se ejecutará…"
                        style={{ ...INPUT, resize: "vertical", marginTop: 2 }}
                      />
                    </label>
                  </SectionBox>
                )}

                {/* ── SECCIÓN E: Feedback (request-info / reject) */}
                {(decision === "request-info" || decision === "reject") && (
                  <SectionBox
                    letter="E"
                    title={decision === "reject" ? "Motivo de rechazo" : "Información solicitada"}
                    color={decision === "reject" ? C.red : C.amber}
                  >
                    {decision === "reject" && (
                      <label style={{ ...LBL, marginBottom: 12 }}>
                        Motivo estandarizado <span style={{ color: C.red }}>*</span>
                        <select
                          value={reason}
                          onChange={e => setReason(e.target.value as TriageReason | "")}
                          style={{ ...INPUT, appearance: "auto", marginTop: 2 }}
                        >
                          <option value="">Selecciona motivo…</option>
                          {REJECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </label>
                    )}
                    <label style={LBL}>
                      {decision === "reject" ? "Explicación al solicitante" : "Información requerida"}
                      {" "}<span style={{ color: C.red }}>*</span>
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={4}
                        placeholder={
                          decision === "reject"
                            ? "Explica al solicitante por qué se rechaza la solicitud…"
                            : "Detalla qué información necesitas para continuar el triage…"
                        }
                        style={{
                          ...INPUT, resize: "vertical", marginTop: 2,
                          borderColor: !note.trim() ? "#F4D160" : C.border,
                        }}
                      />
                    </label>
                  </SectionBox>
                )}

                {/* Nota adicional para convert */}
                {decision === "convert" && (
                  <SectionBox letter="E" title="Nota al solicitante" color={C.teal}>
                    <label style={LBL}>
                      Nota <span style={{ color: C.red }}>*</span>
                      <textarea
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={3}
                        placeholder="Indica al solicitante el resultado del triage y la tarea creada…"
                        style={{ ...INPUT, resize: "vertical", marginTop: 2 }}
                      />
                    </label>
                  </SectionBox>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────── */}
        <div style={{
          padding: "12px 20px",
          borderTop: `1px solid ${C.border}`,
          background: "#FAFAFA",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          flexWrap: "wrap",
        }}>
          {/* Error */}
          {error && (
            <div style={{
              flex: "1 1 100%",
              padding: "8px 12px",
              background: "#FDE7E9", border: "1px solid #F1BCBE",
              borderRadius: 6, fontSize: 12, color: "#A80000",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          {/* Borrador guardado */}
          {draftSaved && (
            <div style={{
              flex: "1 1 100%",
              padding: "8px 12px",
              background: "#DFF6DD", border: "1px solid #A4D4A4",
              borderRadius: 6, fontSize: 12, color: "#107C10",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <CheckCircle size={13} /> Borrador guardado correctamente.
            </div>
          )}

          {!isClosed && (
            <>
              <button
                onClick={() => void handleDraft()}
                disabled={savingDraft || saving || !decision}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 6,
                  border: `1px solid ${C.border}`, background: "#fff",
                  color: !decision ? C.muted : C.text,
                  fontSize: 13, fontWeight: 600, cursor: !decision || savingDraft ? "not-allowed" : "pointer",
                  fontFamily: "'Segoe UI', sans-serif", transition: "background 120ms",
                  opacity: savingDraft ? 0.7 : 1,
                }}
              >
                <Save size={14} />
                {savingDraft ? "Guardando…" : "Guardar borrador"}
              </button>

              <button
                onClick={() => void handleConfirm()}
                disabled={saving || savingDraft || !decision}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 20px", borderRadius: 6,
                  border: "none",
                  background: !decision ? "#F3F2F1" : C.blue,
                  color: !decision ? C.muted : "#fff",
                  fontSize: 13, fontWeight: 700, cursor: !decision || saving ? "not-allowed" : "pointer",
                  fontFamily: "'Segoe UI', sans-serif", transition: "background 120ms",
                  opacity: saving ? 0.75 : 1,
                }}
              >
                {saving ? "Confirmando…" : "Confirmar decisión"}
              </button>
            </>
          )}

          <button
            onClick={onClose}
            disabled={saving || savingDraft}
            style={{
              marginLeft: "auto",
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "8px 14px", borderRadius: 6,
              border: `1px solid ${C.border}`, background: "transparent",
              color: "#605E5C", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            <X size={13} /> Cancelar
          </button>
        </div>
      </div>

      {/* Spinner mientras se carga el fichero para previsualizar */}
      {previewLoading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1200,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.65)",
        }}>
          <span style={{ color: "#fff", fontSize: 14, fontFamily: "'Segoe UI', sans-serif" }}>
            Cargando previsualización…
          </span>
        </div>
      )}

      {/* Visor inline — no usa window.open, funciona dentro del iframe de Power Apps */}
      {previewState && (
        <div
          onClick={closePreview}
          style={{
            position: "fixed", inset: 0, zIndex: 1200,
            background: "rgba(0,0,0,0.88)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
        >
          {/* Cabecera del visor */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 960,
              display: "flex", alignItems: "center", gap: 10,
              marginBottom: 10,
              padding: "8px 14px",
              background: "rgba(255,255,255,0.1)",
              borderRadius: 8,
            }}
          >
            <span style={{
              flex: 1, color: "#fff", fontSize: 13, fontWeight: 600,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {previewState.name}
            </span>
            <button
              onClick={closePreview}
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 5, color: "#fff", cursor: "pointer",
                padding: "5px 12px", fontSize: 12,
                fontFamily: "'Segoe UI', sans-serif",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <X size={13} /> Cerrar
            </button>
          </div>

          {/* Contenido */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 960, width: "100%",
              flex: 1, overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {previewState.mimeType.startsWith("image/") ? (
              <img
                src={previewState.blobUrl}
                alt={previewState.name}
                style={{
                  maxWidth: "100%",
                  maxHeight: "calc(100vh - 140px)",
                  objectFit: "contain",
                  borderRadius: 6,
                  boxShadow: "0 4px 32px rgba(0,0,0,0.6)",
                }}
              />
            ) : (
              <iframe
                src={previewState.blobUrl}
                title={previewState.name}
                style={{
                  width: "100%",
                  height: "calc(100vh - 140px)",
                  border: "none",
                  borderRadius: 6,
                  background: "#fff",
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
