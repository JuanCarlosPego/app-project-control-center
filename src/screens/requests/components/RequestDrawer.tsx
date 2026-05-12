// ─────────────────────────────────────────────────────────
//  src/screens/requests/components/RequestDrawer.tsx
//  Panel lateral de detalle de una solicitud.
//
//  Tabs: Detalle / Triage (IT) / Historial
//
//  RBAC acciones:
//  - Propietario: EDITAR (Nuevo|Info req.), CANCELAR (Nuevo|Info req.|En rev.), RESPONDER (Info req.)
//  - IT/Admin   : TRIAGE + CONVERTIR EN TAREA (si Aprobada)
//  - Cancelada  : solo lectura (IT puede ver todo)
// ─────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRightCircle, CheckCircle, HelpCircle,
         MessageSquare, Send, Trash2, X, XCircle } from "lucide-react";
import type { Request, RequestType, Priority, Team } from "../../../types/domain";
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
  type PatchRequestPayload,
} from "../../../services/requestService";

// ── Props ─────────────────────────────────────────────────
interface Props {
  request:     Request;
  appUsers:    AppUser[];
  teams:       Team[];
  projects:    Array<{ id: string; name: string }>;
  currentUser: AppUser;
  roles:       AppRole[];
  onClose:     () => void;
  onRefresh:   () => void;
  onConvert:   () => void;
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
  request, appUsers, teams, projects,
  currentUser, roles, onClose, onRefresh, onConvert,
}) => {
  const isIT    = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const isOwner = request.requestedByUserId === currentUser.id;
  const isClosed = request.status === "Convertida" || request.status === "Cancelada" || request.status === "Rechazada";

  const canEdit    = isOwner && !isIT && ["Nuevo", "Info requerida"].includes(request.status);
  const canCancel  = isOwner && !isIT && ["Nuevo", "Info requerida", "En revisión"].includes(request.status);
  const canRespond = isOwner && !isIT && request.status === "Info requerida";
  const canTriage  = isIT && !isClosed;
  const canConvert = isIT && request.status === "Aprobada";

  // ── State ─────────────────────────────────────────────
  const [tab, setTab]             = useState<Tab>("detail");
  const [editMode, setEditMode]   = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // Edit fields
  const [editTitle, setEditTitle]     = useState(request.title);
  const [editDesc,  setEditDesc]      = useState(request.description);
  const [editType,  setEditType]      = useState<RequestType>(request.type);
  const [editPrio,  setEditPrio]      = useState<Priority>(request.priority);

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
  };

  // ── Toast helper ──────────────────────────────────────
  function showToast(msg: string, ok: boolean) {
    clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ── Acciones ──────────────────────────────────────────
  async function handleEdit() {
    setSaving(true);
    try {
      const payload: PatchRequestPayload = {
        title:       editTitle.trim() || undefined,
        description: editDesc.trim(),
        type:        editType,
        priority:    editPrio,
      };
      await patchRequest(request.id, payload);
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
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ ...INPUT }} maxLength={200} />
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
          </div>
        )}

        {/* ══ TAB: TRIAGE (solo IT) ══ */}
        {tab === "triage" && isIT && (
          <>
            {/* Nota actual guardada */}
            {request.triageNote && !canTriage && (
              <div style={{
                padding: "10px 14px", background: "#FAF9F8", border: "1px solid #EDEBE9",
                borderRadius: 6, fontSize: 13, color: "#201F1E", lineHeight: 1.6,
                marginBottom: 16, whiteSpace: "pre-wrap",
              }}>
                {request.triageNote}
              </div>
            )}

            {!canTriage && !request.triageNote && (
              <p style={{ color: "#8A8886", fontSize: 13 }}>
                Solicitud en estado <strong>{request.status}</strong> — no hay acciones de triage disponibles.
              </p>
            )}

            {canTriage && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Nota de triage */}
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#605E5C" }}>
                  <span>
                    Nota{" "}
                    <span style={{ color: "#D13438" }}>
                      (obligatoria para Pedir info y Rechazar)
                    </span>
                  </span>
                  <textarea
                    value={triageNote}
                    onChange={e => setTriageNote(e.target.value)}
                    rows={4}
                    placeholder="Escribe tu nota para el solicitante o el equipo…"
                    style={{
                      ...INPUT, resize: "vertical",
                      borderColor: triageNote ? "#C8C6C4" : "#EDEBE9",
                    }}
                  />
                </label>

                {/* Acciones de triage */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {request.status !== "En revisión" && (
                    <ActionBtn
                      label="Tomar en revisión"
                      icon={<MessageSquare size={12} />}
                      accent="#8764B8"
                      onClick={() => void doTriage("review")}
                      disabled={saving}
                    />
                  )}
                  <ActionBtn
                    label="Pedir información *"
                    icon={<HelpCircle size={12} />}
                    accent="#986F0B"
                    onClick={() => void doTriage("request-info")}
                    disabled={saving}
                  />
                  {request.status !== "Aprobada" && (
                    <ActionBtn
                      label="Aprobar"
                      icon={<CheckCircle size={12} />}
                      accent="#107C10"
                      onClick={() => void doTriage("approve")}
                      disabled={saving}
                    />
                  )}
                  {request.status !== "Rechazada" && (
                    <ActionBtn
                      label="Rechazar *"
                      icon={<XCircle size={12} />}
                      accent="#D13438"
                      onClick={() => void doTriage("reject")}
                      disabled={saving}
                    />
                  )}
                </div>

                {/* Convertir en tarea */}
                {canConvert && (
                  <div style={{ borderTop: "1px solid #EDEBE9", paddingTop: 14 }}>
                    <ActionBtn
                      label="Convertir en tarea"
                      icon={<ArrowRightCircle size={13} />}
                      accent="#0078D4"
                      variant="solid"
                      onClick={onConvert}
                      disabled={saving}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "#8A8886" }}>
                      Crea un WorkItem a partir de esta solicitud aprobada.
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
