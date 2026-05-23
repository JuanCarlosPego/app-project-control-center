// ─────────────────────────────────────────────────────────
//  src/screens/requests/components/RequestDrawer.tsx
//  Panel lateral de detalle de una solicitud.
//
//  Tabs: Detalle / Triage (IT) / Historial
//
//  RBAC acciones:
//  - Propietario: EDITAR (Nuevo|Info req.), CANCELAR (Nuevo|Info req.|En rev.), RESPONDER (Info req.)
//  - IT/Admin   : TRIAGE (convierte en tareas desde el wizard de triage)
//  - Cancelada  : solo lectura (IT puede ver todo)
// ─────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRightCircle, CheckCircle, File, FileText,
         HelpCircle, Image as ImageIcon, MessageSquare, Paperclip, Plus,
         Send, Trash2, X, XCircle } from "lucide-react";
import type { Request, RequestType, RequestUrgency, Priority, Team, BusinessArea, RequestAttachment, Project, WorkItem } from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";
import type { AppRole } from "../../../types/domain";
import {
  REQUEST_STATUS_COLORS,
  REQUEST_TYPE_COLORS,
  REQUEST_TYPE_LABELS,
  REQUEST_TYPE_OPTIONS,
  PRIORITY_COLORS,
  triageRequest,
  patchRequest,
  cancelRequest,
  respondRequest,
  getRequestAttachments,
  downloadAttachmentFile,
  deleteRequestAttachment,
  uploadRequestAttachment,
  type PatchRequestPayload,
} from "../../../services/requestService";
import { getRequestTasks } from "../../../services/requestProgressService";
import { TriageWizardModal } from "./TriageWizardModal";

// ── Props ─────────────────────────────────────────────────
interface Props {
  request:       Request;
  appUsers:      AppUser[];
  teams:         Team[];
  projects:      Array<{ id: string; name: string }>;
  fullProjects?: Project[];
  businessAreas: BusinessArea[];
  currentUser:   AppUser;
  roles:         AppRole[];
  onClose:       () => void;
  onRefresh:     () => void;
}

type Tab = "detail" | "triage" | "history";

const PRIORITIES: Priority[] = ["Alta", "Media", "Baja"];

// ── Helpers ───────────────────────────────────────────────
function fmtDT(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

const StatusChip: React.FC<{ status: Request["status"] }> = ({ status }) => (
  <span style={{
    display: "inline-block", padding: "3px 10px", borderRadius: 99,
    fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    background: REQUEST_STATUS_COLORS[status] ?? "#605E5C",
    color: "#fff",
  }}>
    {status}
  </span>
);

const TypeChip: React.FC<{ type: RequestType }> = ({ type }) => (
  <span style={{
    display: "inline-block", padding: "2px 8px", borderRadius: 99,
    fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    background: (REQUEST_TYPE_COLORS[type] ?? "#605E5C") + "22",
    color: REQUEST_TYPE_COLORS[type] ?? "#605E5C",
    border: `1px solid ${(REQUEST_TYPE_COLORS[type] ?? "#605E5C")}55`,
  }}>
    {REQUEST_TYPE_LABELS[type] ?? type}
  </span>
);

const FLD: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 14 }}>
    <span style={{ fontSize: 10, color: "#8A8886", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {label}
    </span>
    <span style={{ fontSize: 13, color: "#201F1E" }}>{children}</span>
  </div>
);

interface ActionBtnProps {
  label: string;
  icon?: React.ReactNode;
  accent?: string;
  variant?: "solid" | "outline" | "ghost";
  onClick: () => void;
  disabled?: boolean;
}
const ActionBtn: React.FC<ActionBtnProps> = ({ label, icon, accent = "#0078D4", variant = "outline", onClick, disabled }) => {
  const bg      = variant === "solid"  ? accent : "transparent";
  const clr     = variant === "solid"  ? "#fff"  : accent;
  const border  = variant === "ghost"  ? "1px solid #EDEBE9" : `1px solid ${accent}`;
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "7px 14px", borderRadius: 6,
        border, background: disabled ? "#F3F2F1" : bg,
        color: disabled ? "#A19F9D" : clr,
        fontSize: 12, fontWeight: 600,
        fontFamily: "'Segoe UI', sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 120ms",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { if (!disabled && variant !== "solid") (e.currentTarget as HTMLButtonElement).style.background = `${accent}15`; }}
      onMouseLeave={e => { if (!disabled && variant !== "solid") (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      {icon} {label}
    </button>
  );
};

// ── Toast interno ─────────────────────────────────────────
interface ToastState { msg: string; ok: boolean }
const InlineToast: React.FC<{ toast: ToastState }> = ({ toast }) => (
  <div style={{
    padding: "9px 14px",
    background: toast.ok ? "#DFF6DD" : "#FDE7E9",
    border: `1px solid ${toast.ok ? "#A4D4A4" : "#F1BCBE"}`,
    borderRadius: 6, fontSize: 12,
    color: toast.ok ? "#107C10" : "#A80000",
    display: "flex", alignItems: "center", gap: 6,
  }}>
    {toast.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
    {toast.msg}
  </div>
);

// ── Componente principal ──────────────────────────────────
export const RequestDrawer: React.FC<Props> = ({
  request, appUsers, teams, projects, fullProjects = [], businessAreas,
  currentUser, roles, onClose, onRefresh,
}) => {
  const isIT    = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const isOwner = request.requestedByUserId === currentUser.id;
  const isClosed = request.status === "Convertida" || request.status === "Cancelada" || request.status === "Rechazada";

  const canEdit    = isOwner && !isIT && ["Nuevo", "Info requerida"].includes(request.status);
  const canCancel  = isOwner && !isIT && ["Nuevo", "Info requerida", "En revisión"].includes(request.status);
  const canRespond = isOwner && !isIT && request.status === "Info requerida";
  const canTriage  = isIT && !isClosed;

  // ── State ─────────────────────────────────────────────
  const [tab, setTab]             = useState<Tab>("detail");
  const [editMode, setEditMode]   = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [showTriageWizard, setShowTriageWizard] = useState(false);

  // Edit fields
  const [editTitle,   setEditTitle]   = useState(request.title);
  const [editDesc,    setEditDesc]    = useState(request.description);
  const [editType,    setEditType]    = useState<RequestType>(request.type);
  const [editPrio,    setEditPrio]    = useState<Priority>(request.priority);
  const [editUrgency, setEditUrgency] = useState<RequestUrgency | "">(request.urgency ?? "");
  const [editAreaId,  setEditAreaId]  = useState<string>(request.businessAreaId ?? "");

  // Adjuntos cargados al abrir el drawer
  const [attachments,  setAttachments]  = useState<RequestAttachment[]>([]);
  const [loadingAtts,  setLoadingAtts]  = useState(false);

  // Tareas asociadas (1:N desde solicitud)
  const [requestTasks, setRequestTasks] = useState<WorkItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Gestión de adjuntos en modo edición
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [pendingNewFiles,  setPendingNewFiles]  = useState<Array<{
    file: File; name: string; mimeType: string; sizeBytes: number; dataUrl: string;
  }>>([]); 

  // Respond fields
  const [respondNote, setRespondNote] = useState("");

  // Cancel fields
  const [cancelNote, setCancelNote]   = useState("");

  // Triage fields
  const [triageNote, setTriageNote]   = useState(request.triageNote ?? "");

  // Saving state
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const maps = {
    user:    new Map(appUsers.map(u => [u.id, u.displayName])),
    team:    new Map(teams.map(t => [t.id, t.name])),
    project: new Map(projects.map(p => [p.id, p.name])),
    area:    new Map(businessAreas.map(a => [a.id, a.name])),
  };

  // Etiquetas de urgencia
  const URGENCY_LABELS: Record<RequestUrgency, string> = {
    inmediato: "🚨 Inmediato (bloqueo crítico)",
    semana:    "⚡ Esta semana (impacto significativo)",
    mes:       "📅 Este mes (planificable)",
    backlog:   "🗂️ Backlog (sin presión de tiempo)",
  };

  // ── Toast helper ──────────────────────────────────────
  function showToast(msg: string, ok: boolean) {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Cargar adjuntos al montar el drawer
  useEffect(() => {
    setLoadingAtts(true);
    getRequestAttachments(request.id)
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAtts(false));
  }, [request.id]);

  // Cargar tareas asociadas (si tiene progress o está en estado de ejecución)
  useEffect(() => {
    if (!request.tasksTotal && request.status !== "En ejecución" && request.status !== "Resuelta") return;
    setLoadingTasks(true);
    getRequestTasks(request.id)
      .then(setRequestTasks)
      .catch(() => setRequestTasks([]))
      .finally(() => setLoadingTasks(false));
  }, [request.id, request.status, request.tasksTotal]);

  // ── Acciones ──────────────────────────────────────────
  async function handleEdit() {
    setSaving(true);
    try {
      const payload: PatchRequestPayload = {
        title:          editTitle.trim() || undefined,
        description:    editDesc.trim(),
        type:           editType,
        priority:       editPrio,
        urgency:        editUrgency || null,
        businessAreaId: editAreaId  || null,
      };
      await patchRequest(request.id, payload);

      // Procesar adjuntos: eliminar marcados
      if (pendingDeleteIds.size > 0) {
        await Promise.all(
          [...pendingDeleteIds].map(id => deleteRequestAttachment(request.id, id)),
        );
      }
      // Procesar adjuntos: subir nuevos
      if (pendingNewFiles.length > 0) {
        await Promise.all(
          pendingNewFiles.map(f =>
            uploadRequestAttachment(request.id, {
              name:      f.name,
              mimeType:  f.mimeType,
              sizeBytes: f.sizeBytes,
              file:      f.file,
              dataUrl:   f.dataUrl,
            }),
          ),
        );
      }
      // Recargar adjuntos
      const updated = await getRequestAttachments(request.id);
      setAttachments(updated);
      setPendingDeleteIds(new Set());
      setPendingNewFiles([]);

      showToast("Solicitud actualizada correctamente.", true);
      setEditMode(false);
      onRefresh();
    } catch {
      showToast("Error al guardar los cambios.", false);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    setSaving(true);
    try {
      await cancelRequest(request.id, { note: cancelNote.trim() || undefined });
      showToast("Solicitud cancelada.", true);
      setCancelConfirm(false);
      onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al cancelar.", false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRespond() {
    if (!respondNote.trim()) {
      showToast("La respuesta no puede estar vacía.", false);
      return;
    }
    setSaving(true);
    try {
      await respondRequest(request.id, { note: respondNote.trim() });
      showToast("Respuesta enviada. La solicitud vuelve a revisión.", true);
      setRespondNote("");
      onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al enviar la respuesta.", false);
    } finally {
      setSaving(false);
    }
  }

  async function doTriage(action: "review" | "request-info" | "approve" | "reject") {
    if ((action === "reject" || action === "request-info") && !triageNote.trim()) {
      showToast(
        action === "reject"
          ? "El motivo de rechazo es obligatorio."
          : "La nota de información es obligatoria.",
        false,
      );
      return;
    }
    setSaving(true);
    try {
      await triageRequest(request.id, { action, note: triageNote.trim() || undefined });
      const labels: Record<string, string> = {
        review: "Tomada en revisión.", "request-info": "Se ha pedido información.", approve: "Aprobada.", reject: "Rechazada.",
      };
      showToast(labels[action] ?? "Acción realizada.", true);
      setTriageNote("");
      onRefresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al procesar la acción.", false);
    } finally {
      setSaving(false);
    }
  }

  // ── UI helpers ────────────────────────────────────────
  const INPUT: React.CSSProperties = {
    width: "100%", padding: "7px 10px",
    border: "1px solid #C8C6C4", borderRadius: 5,
    fontSize: 13, fontFamily: "'Segoe UI', sans-serif",
    color: "#201F1E", background: "#fff",
    boxSizing: "border-box" as React.CSSProperties["boxSizing"],
  };

  const TabBtn: React.FC<{ id: Tab; label: string }> = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{
      padding: "8px 14px", border: "none",
      borderBottom: tab === id ? "2px solid #0078D4" : "2px solid transparent",
      background: "transparent",
      color: tab === id ? "#0078D4" : "#605E5C",
      fontWeight: tab === id ? 600 : 400, fontSize: 13,
      cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
      transition: "color 150ms",
    }}>{label}</button>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.25)",
          zIndex: 899,
        }}
      />
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0,
      width: 500, maxWidth: "100vw",
      background: "#fff",
      boxShadow: "-4px 0 28px rgba(0,0,0,0.16)",
      display: "flex", flexDirection: "column",
      zIndex: 900, fontFamily: "'Segoe UI', sans-serif",
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: "14px 18px 12px",
        borderBottom: "1px solid #EDEBE9",
        background: request.status === "Cancelada" ? "#FAF9F8" : "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <StatusChip status={request.status} />
              <TypeChip type={request.type} />
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: PRIORITY_COLORS[request.priority] ?? "#605E5C",
              }}>
                ● {request.priority}
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#201F1E", lineHeight: 1.35 }}>
              {request.title}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8A8886" }}>
              #{request.id.slice(-8)} · {fmtDT(request.createdOn)}
            </p>
          </div>
          <button
            onClick={onClose}
            title="Cerrar panel"
            style={{
              background: "#F3F2F1", border: "1px solid #EDEBE9",
              cursor: "pointer",
              color: "#201F1E", padding: "6px 8px", borderRadius: 6,
              flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            <X size={15} />
            <span>Cerrar</span>
          </button>
        </div>

        {/* Toast inline en header */}
        {toast && (
          <div style={{ marginTop: 10 }}>
            <InlineToast toast={toast} />
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", borderBottom: "1px solid #EDEBE9", flexShrink: 0 }}>
        <TabBtn id="detail"  label="Detalle" />
        {isIT && <TabBtn id="triage"  label="Triage" />}
        <TabBtn id="history" label="Historial" />
      </div>

      {/* ── Body (scrollable) ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>

        {/* ══ TAB: DETALLE ══ */}
        {tab === "detail" && !editMode && (
          <>
            {/* Banner: solicitud cancelada */}
            {request.status === "Cancelada" && (
              <div style={{
                padding: "10px 14px", marginBottom: 14,
                background: "#FAF9F8", border: "1px solid #EDEBE9", borderRadius: 6,
                fontSize: 12, color: "#605E5C",
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <Trash2 size={14} style={{ marginTop: 1, flexShrink: 0 }} />
                <div>
                  <strong>Solicitud cancelada.</strong>
                  {request.cancelledNote && (
                    <span> Motivo: {request.cancelledNote}</span>
                  )}
                </div>
              </div>
            )}

            {/* Banner: info requerida (para propietario) */}
            {canRespond && (
              <div style={{
                padding: "12px 14px", marginBottom: 16,
                background: "#FFF8E1", border: "1px solid #FFC107", borderRadius: 6,
              }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: "#856404", marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
                  <HelpCircle size={13} /> El equipo IT necesita más información
                </div>
                {request.triageNote && (
                  <p style={{ margin: "0 0 10px", fontSize: 12, color: "#605E5C", whiteSpace: "pre-wrap" }}>
                    {request.triageNote}
                  </p>
                )}
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#605E5C" }}>
                  Tu respuesta
                  <textarea
                    value={respondNote}
                    onChange={e => setRespondNote(e.target.value)}
                    rows={3}
                    placeholder="Proporciona la información solicitada…"
                    style={{
                      padding: "7px 10px", border: "1px solid #FFC107",
                      borderRadius: 5, fontSize: 12,
                      fontFamily: "'Segoe UI', sans-serif",
                      resize: "vertical", width: "100%",
                      boxSizing: "border-box" as React.CSSProperties["boxSizing"],
                    }}
                  />
                </label>
                <div style={{ marginTop: 8 }}>
                  <ActionBtn
                    label={saving ? "Enviando…" : "Enviar respuesta"}
                    icon={<Send size={12} />}
                    accent="#986F0B"
                    variant="solid"
                    onClick={handleRespond}
                    disabled={saving}
                  />
                </div>
              </div>
            )}

            {/* Descripción */}
            <FLD label="Descripción">
              {request.description
                ? <span style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{request.description}</span>
                : <em style={{ color: "#8A8886" }}>Sin descripción.</em>}
            </FLD>

            {/* Urgencia */}
            {request.urgency && (
              <FLD label="Urgencia">
                {URGENCY_LABELS[request.urgency]}
              </FLD>
            )}

            {/* Área de negocio */}
            {request.businessAreaId && (
              <FLD label="Área de negocio">
                {maps.area.get(request.businessAreaId) ?? request.businessAreaId}
              </FLD>
            )}

            {/* Solicitante */}
            <FLD label="Solicitado por">
              <span>
                {maps.user.get(request.requestedByUserId) ?? request.requestedByUserId}
                <span style={{ color: "#8A8886", marginLeft: 6, fontSize: 11 }}>({request.requestedByRole})</span>
              </span>
            </FLD>

            {/* Equipo */}
            <FLD label="Equipo">
              {request.requestedByTeamId
                ? maps.team.get(request.requestedByTeamId) ?? request.requestedByTeamId
                : "—"}
            </FLD>

            {/* Proyecto */}
            <FLD label="Proyecto relacionado">
              {request.relatedProjectId
                ? maps.project.get(request.relatedProjectId) ?? request.relatedProjectId
                : "—"}
            </FLD>

            {/* Gestor */}
            {request.triageOwnerUserId && (
              <FLD label="Gestionado por">
                {maps.user.get(request.triageOwnerUserId) ?? request.triageOwnerUserId}
              </FLD>
            )}

            {/* WorkItem vinculado */}
            {request.convertedWorkItemId && (
              <div style={{
                marginTop: 4, padding: "10px 14px",
                background: "#E6F7F7", border: "1px solid #00B7C3",
                borderRadius: 6, fontSize: 12, color: "#201F1E",
                display: "flex", gap: 6, alignItems: "center",
              }}>
                <ArrowRightCircle size={13} color="#00B7C3" />
                <span><strong>Convertida en tarea:</strong> {request.convertedWorkItemId}</span>
              </div>
            )}

            {/* ── Tareas asociadas (bloque de progreso) ── */}
            {(request.status === "En ejecución" || request.status === "Resuelta" || (request.tasksTotal ?? 0) > 0) && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, color: "#8A8886", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                  Tareas asociadas
                </div>

                {/* Barra de progreso */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: request.status === "Resuelta" ? "#107C10" : "#0078D4" }}>
                      {request.progressPct ?? 0}%
                    </span>
                    <span style={{ fontSize: 11, color: "#8A8886" }}>
                      {request.tasksDone ?? 0} / {request.tasksTotal ?? 0} cerradas
                    </span>
                  </div>
                  <div style={{ height: 8, background: "#EDEBE9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${request.progressPct ?? 0}%`,
                      background: request.status === "Resuelta" ? "#107C10" : "#0078D4",
                      borderRadius: 4,
                      transition: "width 400ms ease",
                    }} />
                  </div>
                  {request.status === "Resuelta" && (
                    <div style={{ marginTop: 4, fontSize: 11, color: "#107C10", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle size={11} /> Resuelta automáticamente al cerrar todas las tareas
                    </div>
                  )}
                </div>

                {/* Tabla de tareas */}
                {loadingTasks ? (
                  <span style={{ fontSize: 12, color: "#8A8886" }}>Cargando tareas…</span>
                ) : requestTasks.length === 0 ? (
                  <span style={{ fontSize: 12, color: "#8A8886" }}>Sin tareas asociadas.</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {requestTasks.map(task => {
                      const isClosed = task.stateId === "st-cls";
                      return (
                        <div key={task.id} style={{
                          display: "grid",
                          gridTemplateColumns: "auto 1fr auto",
                          gap: "6px 10px",
                          padding: "8px 10px",
                          border: "1px solid #EDEBE9",
                          borderRadius: 6,
                          background: isClosed ? "#F3FCF0" : "#FAFAFA",
                          alignItems: "center",
                        }}>
                          {/* Badge estado */}
                          <span style={{
                            display: "inline-block", padding: "1px 7px", borderRadius: 99,
                            fontSize: 10, fontWeight: 700,
                            background: isClosed ? "#107C1022" : "#0078D422",
                            color: isClosed ? "#107C10" : "#0078D4",
                            border: `1px solid ${isClosed ? "#107C1055" : "#0078D455"}`,
                            whiteSpace: "nowrap",
                          }}>
                            {isClosed ? "Cerrada" : "En curso"}
                          </span>
                          {/* Título */}
                          <span style={{ fontSize: 12, color: "#201F1E", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {task.title}
                          </span>
                          {/* ID */}
                          <span style={{ fontSize: 10, color: "#8A8886", whiteSpace: "nowrap" }}>
                            {task.id}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Adjuntos */}
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 10, color: "#8A8886", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Adjuntos
              </div>
              {loadingAtts ? (
                <span style={{ fontSize: 12, color: "#8A8886" }}>Cargando adjuntos…</span>
              ) : attachments.length === 0 ? (
                <span style={{ fontSize: 12, color: "#8A8886", display: "flex", alignItems: "center", gap: 5 }}>
                  <Paperclip size={12} /> Sin adjuntos
                </span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {attachments.map(att => (
                    <div key={att.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 10px", border: "1px solid #EDEBE9",
                      borderRadius: 6, background: "#FAFAFA",
                    }}>
                      {att.mimeType.startsWith("image/") && att.url.startsWith("data:") ? (
                        <img
                          src={att.url}
                          alt={att.name}
                          style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 3, flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: 32, height: 32, borderRadius: 3, background: "#EFF6FC",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#0078D4", flexShrink: 0,
                        }}>
                          {att.mimeType === "application/pdf" ? <FileText size={14} /> : att.mimeType.startsWith("image/") ? <ImageIcon size={14} /> : <File size={14} />}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#201F1E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {att.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#8A8886" }}>
                          {att.sizeBytes > 0 ? `${(att.sizeBytes / 1024).toFixed(0)} KB` : ""}
                        </div>
                      </div>
                      {att.url.startsWith("data:") ? (
                        <a
                          href={att.url}
                          download={att.name}
                          style={{ fontSize: 11, color: "#0078D4", textDecoration: "none", whiteSpace: "nowrap" }}
                        >
                          Descargar
                        </a>
                      ) : (
                        <button
                          onClick={() => downloadAttachmentFile(att)}
                          style={{ fontSize: 11, color: "#0078D4", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", padding: 0 }}
                        >
                          Descargar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ TAB: DETALLE (MODO EDICIÓN) ══ */}
        {tab === "detail" && editMode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{
              padding: "8px 12px", background: "#EFF6FF", border: "1px solid #C7E0F4",
              borderRadius: 6, fontSize: 11, color: "#005A9E", fontWeight: 600,
            }}>
              ✏️ Modo edición — solo puedes modificar solicitudes en estado "{request.status}".
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#605E5C" }}>
              Título
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ ...INPUT }} maxLength={150} />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#605E5C" }}>
              Descripción
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4}
                style={{ ...INPUT, resize: "vertical" }} />
            </label>

            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#605E5C", flex: 1 }}>
                Tipo
                <select value={editType} onChange={e => setEditType(e.target.value as RequestType)}
                  style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}>
                  {REQUEST_TYPE_OPTIONS.map(t => (
                    <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#605E5C", flex: 1 }}>
                Prioridad
                <select value={editPrio} onChange={e => setEditPrio(e.target.value as Priority)}
                  style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>

            {/* Área de negocio */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#605E5C" }}>
              Área de negocio
              <select value={editAreaId} onChange={e => setEditAreaId(e.target.value)}
                style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}>
                <option value="">Sin área específica</option>
                {businessAreas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>

            {/* Urgencia */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#605E5C" }}>
              Urgencia
              <select value={editUrgency} onChange={e => setEditUrgency(e.target.value as RequestUrgency | "")}
                style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}>
                <option value="">Sin especificar</option>
                <option value="inmediato">🚨 Inmediato (bloqueo crítico)</option>
                <option value="semana">⚡ Esta semana (impacto significativo)</option>
                <option value="mes">📅 Este mes (planificable)</option>
                <option value="backlog">🗂️ Backlog (sin presión de tiempo)</option>
              </select>
            </label>

            {/* ── Adjuntos en modo edición ── */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#605E5C", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                <Paperclip size={11} /> Adjuntos
              </div>

              {/* Lista existentes (minus pendientes de borrado) */}
              {loadingAtts ? (
                <p style={{ fontSize: 12, color: "#8A8886", margin: "0 0 8px" }}>Cargando…</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                  {attachments
                    .filter(a => !pendingDeleteIds.has(a.id))
                    .map(att => {
                      const isPdf   = att.mimeType === "application/pdf";
                      const isImage = att.mimeType.startsWith("image/");
                      return (
                        <div key={att.id} style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "5px 8px", border: "1px solid #EDEBE9",
                          borderRadius: 5, background: "#FAFAFA", fontSize: 12,
                        }}>
                          <span style={{ color: isPdf ? "#986F0B" : isImage ? "#0078D4" : "#8A8886", display: "flex", flexShrink: 0 }}>
                            {isPdf ? <FileText size={13} /> : isImage ? <ImageIcon size={13} /> : <File size={13} />}
                          </span>
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#201F1E" }}>
                            {att.name}
                          </span>
                          {att.sizeBytes > 0 && (
                            <span style={{ fontSize: 10, color: "#8A8886", flexShrink: 0 }}>
                              {(att.sizeBytes / 1024).toFixed(0)} KB
                            </span>
                          )}
                          <button
                            type="button"
                            title="Eliminar adjunto"
                            onClick={() => setPendingDeleteIds(prev => new Set([...prev, att.id]))}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              color: "#D13438", padding: 2, display: "flex", alignItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  {attachments.filter(a => !pendingDeleteIds.has(a.id)).length === 0 &&
                    pendingNewFiles.length === 0 && (
                    <p style={{ fontSize: 12, color: "#8A8886", margin: 0, fontStyle: "italic" }}>Sin adjuntos.</p>
                  )}
                </div>
              )}

              {/* Nuevos adjuntos pendientes de subir */}
              {pendingNewFiles.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
                  {pendingNewFiles.map((f, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "5px 8px",
                      border: "1px dashed #C7E0F4",
                      borderRadius: 5, background: "#EFF6FC", fontSize: 12,
                    }}>
                      <span style={{ color: "#0078D4", display: "flex", flexShrink: 0 }}>
                        {f.mimeType === "application/pdf" ? <FileText size={13} /> : f.mimeType.startsWith("image/") ? <ImageIcon size={13} /> : <File size={13} />}
                      </span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#201F1E" }}>
                        {f.name}
                      </span>
                      <span style={{ fontSize: 10, color: "#005A9E", fontWeight: 600, flexShrink: 0 }}>nuevo</span>
                      {f.sizeBytes > 0 && (
                        <span style={{ fontSize: 10, color: "#8A8886", flexShrink: 0 }}>
                          {(f.sizeBytes / 1024).toFixed(0)} KB
                        </span>
                      )}
                      <button
                        type="button"
                        title="Quitar"
                        onClick={() => setPendingNewFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "#D13438", padding: 2, display: "flex", alignItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Botón añadir archivo */}
              <label style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 12px",
                border: "1px dashed #C8C6C4", borderRadius: 5,
                cursor: "pointer", fontSize: 12, color: "#0078D4",
                background: "transparent",
                fontFamily: "'Segoe UI', sans-serif",
              }}>
                <Plus size={12} /> Añadir archivo
                <input
                  type="file"
                  multiple
                  style={{ display: "none" }}
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach(file => {
                      const reader = new FileReader();
                      reader.onload = ev => {
                        setPendingNewFiles(prev => [...prev, {
                          file,
                          name:      file.name,
                          mimeType:  file.type || "application/octet-stream",
                          sizeBytes: file.size,
                          dataUrl:   (ev.target?.result as string) ?? "",
                        }]);
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = ""; // reset para poder subir el mismo archivo de nuevo
                  }}
                />
              </label>

              {(pendingDeleteIds.size > 0 || pendingNewFiles.length > 0) && (
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#986F0B" }}>
                  ⚠️ Los cambios de adjuntos se aplican al guardar.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB: TRIAGE (solo IT) ══ */}
        {tab === "triage" && isIT && (
          <>
            {/* Resumen de triage guardado */}
            {(request.triageDecision || request.triageNote || request.triageCategory) && (
              <div style={{
                padding: "12px 14px", marginBottom: 16,
                background: "#F3F9FF", border: "1px solid #C7E0F4",
                borderRadius: 8, fontSize: 12, color: "#201F1E",
              }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#005A9E" }}>
                  📋 Triage registrado
                </div>
                {request.triageDecision && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#8A8886", marginRight: 4 }}>Decisión:</span>
                    <strong>{{
                      "approve-backlog": "Aprobar → Backlog",
                      "convert":         "Convertir en tarea",
                      "request-info":    "Pedir información",
                      "reject":          "Rechazar",
                    }[request.triageDecision] ?? request.triageDecision}</strong>
                  </div>
                )}
                {request.triageCategory && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#8A8886", marginRight: 4 }}>Categoría:</span>
                    {request.triageCategory}
                    {request.triagePriorityIT && <span style={{ marginLeft: 8, color: "#8A8886" }}>· Prioridad IT: <strong>{request.triagePriorityIT}</strong></span>}
                    {request.triageEstimate && <span style={{ marginLeft: 8, color: "#8A8886" }}>· Estimación: <strong>{request.triageEstimate}</strong></span>}
                  </div>
                )}
                {request.triageBacklogBucket && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#8A8886", marginRight: 4 }}>Bucket backlog:</span>
                    {request.triageBacklogBucket}
                  </div>
                )}
                {request.triageReason && (
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ color: "#8A8886", marginRight: 4 }}>Motivo rechazo:</span>
                    {request.triageReason}
                  </div>
                )}
                {request.triageNote && (
                  <div style={{ marginTop: 6, padding: "8px 10px", background: "#fff", borderRadius: 5, border: "1px solid #EDEBE9", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                    {request.triageNote}
                  </div>
                )}
                {request.triageOwnerUserId && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#8A8886" }}>
                    Gestionado por: {maps.user.get(request.triageOwnerUserId) ?? request.triageOwnerUserId}
                    {request.triageExecutorTeamId && (
                      <span> · Equipo: {maps.team.get(request.triageExecutorTeamId) ?? request.triageExecutorTeamId}</span>
                    )}
                    {request.triageExecutorUserId && (
                      <span> · Responsable: {maps.user.get(request.triageExecutorUserId) ?? request.triageExecutorUserId}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Nota legacy (si no hay triage nuevo) */}
            {request.triageNote && !request.triageDecision && !canTriage && (
              <div style={{
                padding: "10px 14px", background: "#FAF9F8", border: "1px solid #EDEBE9",
                borderRadius: 6, fontSize: 13, color: "#201F1E", lineHeight: 1.6,
                marginBottom: 16, whiteSpace: "pre-wrap",
              }}>
                {request.triageNote}
              </div>
            )}

            {!canTriage && !request.triageNote && !request.triageDecision && (
              <p style={{ color: "#8A8886", fontSize: 13 }}>
                Solicitud en estado <strong>{request.status}</strong> — no hay acciones de triage disponibles.
              </p>
            )}

            {canTriage && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* CTA principal: abrir wizard */}
                <div style={{
                  padding: "16px 18px",
                  background: "linear-gradient(135deg, #F3F9FF 0%, #EFF6FC 100%)",
                  border: "1.5px solid #C7E0F4", borderRadius: 10,
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#005A9E", display: "flex", alignItems: "center", gap: 6 }}>
                    🎯 Triage completo
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "#605E5C", lineHeight: 1.55 }}>
                    Clasifica la solicitud, decide su destino y captura toda la información de trazabilidad necesaria.
                  </p>
                  <ActionBtn
                    label="Gestionar triage completo →"
                    icon={<ArrowRightCircle size={13} />}
                    accent="#0078D4"
                    variant="solid"
                    onClick={() => setShowTriageWizard(true)}
                  />
                </div>

                {/* Acción rápida: tomar en revisión */}
                {request.status === "Nuevo" && (
                  <div style={{ borderTop: "1px solid #EDEBE9", paddingTop: 14 }}>
                    <div style={{ fontSize: 11, color: "#8A8886", marginBottom: 8 }}>
                      Acciones rápidas
                    </div>
                    <ActionBtn
                      label="Tomar en revisión"
                      icon={<MessageSquare size={12} />}
                      accent="#8764B8"
                      onClick={() => void doTriage("review")}
                      disabled={saving}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#8A8886" }}>
                      Marca la solicitud como "En revisión" sin completar el triage aún.
                    </p>
                  </div>
                )}
              </div>
            )}

          </>
        )}

        {/* ══ TAB: HISTORIAL ══ */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <HistoryEntry
              label="Solicitud creada"
              date={request.createdOn}
              by={maps.user.get(request.requestedByUserId) ?? request.requestedByUserId}
              color="#0078D4"
            />
            {request.updatedOn !== request.createdOn && request.status !== "Nuevo" && (
              <HistoryEntry
                label={`Estado actualizado → ${request.status}`}
                date={request.updatedOn}
                by={request.triageOwnerUserId
                  ? (maps.user.get(request.triageOwnerUserId) ?? request.triageOwnerUserId)
                  : (isOwner ? "Tú" : "Sistema")}
                color={REQUEST_STATUS_COLORS[request.status] ?? "#605E5C"}
              />
            )}
            {request.convertedWorkItemId && (
              <HistoryEntry
                label="Convertida en tarea"
                date={request.updatedOn}
                by={request.triageOwnerUserId
                  ? (maps.user.get(request.triageOwnerUserId) ?? "IT")
                  : "IT"}
                extra={`Tarea: ${request.convertedWorkItemId}`}
                color="#00B7C3"
              />
            )}
            {request.status === "Cancelada" && (
              <HistoryEntry
                label="Solicitud cancelada"
                date={request.updatedOn}
                by={maps.user.get(request.requestedByUserId) ?? request.requestedByUserId}
                extra={request.cancelledNote ? `Motivo: ${request.cancelledNote}` : undefined}
                color="#605E5C"
              />
            )}
          </div>
        )}

      </div>

      {/* ── Footer sticky (acciones propietario o edición) ── */}
      {(canEdit || canCancel || editMode) && (
        <div style={{
          padding: "12px 18px",
          borderTop: "1px solid #EDEBE9",
          background: "#FAFAFA",
          display: "flex", flexDirection: "column", gap: 10,
        }}>

          {/* Confirm cancelar */}
          {cancelConfirm && (
            <div style={{
              padding: "12px 14px",
              background: "#FFF4CE", border: "1px solid #F4D160", borderRadius: 6,
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: "#856404", display: "flex", gap: 6, alignItems: "center" }}>
                <AlertTriangle size={13} /> ¿Confirmas la cancelación?
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "#605E5C" }}>
                La solicitud pasará a estado <strong>Cancelada</strong> y no podrá editarse.
              </p>
              <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: "#605E5C" }}>
                Motivo (opcional)
                <textarea
                  value={cancelNote}
                  onChange={e => setCancelNote(e.target.value)}
                  rows={2}
                  placeholder="Indica por qué cancelas la solicitud…"
                  style={{
                    padding: "6px 9px", border: "1px solid #F4D160",
                    borderRadius: 5, fontSize: 12,
                    fontFamily: "'Segoe UI', sans-serif",
                    resize: "none", width: "100%",
                    boxSizing: "border-box" as React.CSSProperties["boxSizing"],
                  }}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <ActionBtn
                  label={saving ? "Cancelando…" : "Confirmar cancelación"}
                  accent="#D13438"
                  variant="solid"
                  onClick={() => void handleCancel()}
                  disabled={saving}
                />
                <ActionBtn
                  label="Volver"
                  accent="#605E5C"
                  variant="ghost"
                  onClick={() => { setCancelConfirm(false); setCancelNote(""); }}
                  disabled={saving}
                />
              </div>
            </div>
          )}

          {/* Botones de acción normales */}
          {!cancelConfirm && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!editMode && canEdit && (
                <ActionBtn
                  label="Editar"
                  accent="#0078D4"
                  onClick={() => { setEditMode(true); setTab("detail"); }}
                />
              )}
              {editMode && (
                <>
                  <ActionBtn
                    label={saving ? "Guardando…" : "Guardar cambios"}
                    accent="#0078D4"
                    variant="solid"
                    onClick={() => void handleEdit()}
                    disabled={saving}
                  />
                  <ActionBtn
                    label="Cancelar edición"
                    accent="#605E5C"
                    variant="ghost"
                    onClick={() => {
                      setEditMode(false);
                      setEditTitle(request.title);
                      setEditDesc(request.description);
                      setEditType(request.type);
                      setEditPrio(request.priority);
                      setPendingDeleteIds(new Set());
                      setPendingNewFiles([]);
                    }}
                    disabled={saving}
                  />
                </>
              )}
              {!editMode && canCancel && (
                <ActionBtn
                  label="Cancelar solicitud"
                  icon={<Trash2 size={12} />}
                  accent="#D13438"
                  onClick={() => setCancelConfirm(true)}
                />
              )}
            </div>
          )}
        </div>
      )}

    </div>
      {showTriageWizard && (
        <TriageWizardModal
          request={request}
          appUsers={appUsers}
          teams={teams}
          fullProjects={fullProjects}
          areas={businessAreas}
          currentUser={currentUser}
          selectedYear={new Date(request.createdOn).getFullYear()}
          onClose={() => setShowTriageWizard(false)}
          onConfirmed={() => {
            setShowTriageWizard(false);
            onRefresh();
          }}
        />
      )}
    </>
  );
};

// ── Sub-componente: entrada de historial ──────────────────
interface HistoryEntryProps { label: string; date: string; by: string; extra?: string; color?: string }
const HistoryEntry: React.FC<HistoryEntryProps> = ({ label, date, by, extra, color = "#0078D4" }) => (
  <div style={{
    display: "flex", gap: 10, alignItems: "flex-start",
    paddingBottom: 12, borderBottom: "1px solid #F3F2F1", marginBottom: 12,
  }}>
    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 5 }} />
    <div>
      <div style={{ fontWeight: 600, color: "#201F1E", fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#8A8886", marginTop: 1 }}>
        {new Date(date).toLocaleString("es-ES", {
          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        })} · por {by}
      </div>
      {extra && <div style={{ fontSize: 11, color: "#605E5C", marginTop: 2 }}>{extra}</div>}
    </div>
  </div>
);
