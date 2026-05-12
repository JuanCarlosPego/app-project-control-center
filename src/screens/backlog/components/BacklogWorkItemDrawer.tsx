// ─────────────────────────────────────────────────────────
//  src/screens/backlog/components/BacklogWorkItemDrawer.tsx
//  Panel lateral de detalle de WorkItem en el Backlog.
//  Permite cambiar estado, ver Jira, y editar campos básicos.
// ─────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from "react";
import {
  X, ExternalLink, Calendar, Tag, User, Flag,
  ArrowRightCircle, CheckCircle2, AlertTriangle,
  Clock, Layers, RefreshCw,
} from "lucide-react";
import type { WorkItem, Project, State, Transition, AppRole, EvidencePayload, AppUser as DomainAppUser } from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";
import { patchWorkItemState } from "../../../services/workItemService";
import { canActOnWorkItem } from "../../../auth/workItemPermissions";
import { LockBanner } from "../../../components/ui/LockBadge";
import { AssignUserModal } from "../../kanban/components/AssignUserModal";

// ── Tokens ───────────────────────────────────────────────
const STATE_BG: Record<string, string> = {
  "st-new": "#EFF6FC", "st-ref": "#F3EFF7", "st-prog": "#E1EFDD",
  "st-blk": "#FDE7E9", "st-rft": "#E8F5E9", "st-test": "#FFF4CE",
  "st-acc": "#DFF6DD", "st-cls": "#E8E8E8",
};
const STATE_TXT: Record<string, string> = {
  "st-new": "#0078D4", "st-ref": "#7530AF", "st-prog": "#107C10",
  "st-blk": "#D13438", "st-rft": "#107C10", "st-test": "#835B00",
  "st-acc": "#107C10", "st-cls": "#605E5C",
};
const PRI_COLOR: Record<string, string> = { Alta: "#D13438", Media: "#CA8B00", Baja: "#107C10" };
const PRI_BG: Record<string, string> = { Alta: "#FDE7E9", Media: "#FFF4CE", Baja: "#E8F5E9" };
const TYPE_LABEL: Record<string, string> = {
  Feature: "Feature", Bug: "Bug", TechDebt: "Tech Debt", Spike: "Spike",
};
const TYPE_COLOR: Record<string, string> = {
  Feature: "#0078D4", Bug: "#D13438", TechDebt: "#605E5C", Spike: "#7530AF",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ── Props ─────────────────────────────────────────────────
interface Props {
  workItem: WorkItem | null;
  project?: Project;
  states: State[];
  transitions: Transition[];
  roles: AppRole[];  /** Usuario efectivo (para check RBAC+ownership) */
  appUser?: AppUser | null;
  users?: DomainAppUser[];  // para AssignUserModal
  onClose: () => void;
  onUpdated: (wi: WorkItem) => void;
}

const W = 420;

// ── Componentes internos ──────────────────────────────────
const MetaRow: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({ icon, label, children }) => (
  <div style={{
    display: "flex", alignItems: "flex-start", gap: 8,
    padding: "6px 0", borderBottom: "1px solid #F3F2F1", fontSize: 12,
    fontFamily: "'Segoe UI', sans-serif",
  }}>
    <span style={{ color: "#8A8886", flexShrink: 0, marginTop: 1 }}>{icon}</span>
    <span style={{ color: "#8A8886", width: 80, flexShrink: 0 }}>{label}</span>
    <span style={{ color: "#201F1E", fontWeight: 500 }}>{children}</span>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 700, color: "#8A8886",
    letterSpacing: "0.08em", textTransform: "uppercase",
    marginBottom: 8, fontFamily: "'Segoe UI', sans-serif",
  }}>{children}</div>
);

// ── EvidenceModal inline ───────────────────────────────────
interface EvidenceInlineProps {
  onSubmit: (ev: EvidencePayload) => void;
  onCancel: () => void;
  types: string[];
}
const EvidenceInline: React.FC<EvidenceInlineProps> = ({ onSubmit, onCancel, types }) => {
  const [type, setType] = useState<string>(types[0] ?? "comment");
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");

  return (
    <div style={{
      background: "#FFF4CE", border: "1px solid #F7D769",
      borderRadius: 6, padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 10,
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#835B00" }}>
        Esta transición requiere evidencia
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 11, color: "#605E5C" }}>
          Tipo de evidencia
          <select value={type} onChange={(e) => setType(e.target.value)} style={{
            marginTop: 3, width: "100%", padding: "5px 8px",
            border: "1px solid #C8C6C4", borderRadius: 4, fontSize: 12,
          }}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 11, color: "#605E5C" }}>
          Valor / URL
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://…"
            style={{
              marginTop: 3, width: "100%", padding: "5px 8px",
              border: "1px solid #C8C6C4", borderRadius: 4, fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </label>
        <label style={{ fontSize: 11, color: "#605E5C" }}>
          Comentario
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            style={{
              marginTop: 3, width: "100%", padding: "5px 8px",
              border: "1px solid #C8C6C4", borderRadius: 4, fontSize: 12,
              resize: "vertical", boxSizing: "border-box",
            }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSubmit({ type: type as EvidencePayload["type"], value, comment })}
          disabled={!value.trim() && !comment.trim()}
          style={{
            flex: 1, padding: "6px", borderRadius: 4, border: "none",
            background: "#0078D4", color: "#fff", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
          }}
        >Confirmar</button>
        <button onClick={onCancel} style={{
          padding: "6px 12px", borderRadius: 4, border: "1px solid #EDEBE9",
          background: "#fff", color: "#323130", fontSize: 12,
          cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
        }}>Cancelar</button>
      </div>
    </div>
  );
};

// ── BacklogWorkItemDrawer ─────────────────────────────────
export const BacklogWorkItemDrawer: React.FC<Props> = ({
  workItem: wi, project, states, transitions, roles, appUser, users = [], onClose, onUpdated,
}) => {
  // Permiso: canActOnWorkItem ya incorpora bypass para Admin e IT AirEuropa
  const { can: canAct, reason: lockReason } = wi
    ? canActOnWorkItem(appUser ?? null, wi, roles, transitions)
    : { can: false, reason: "" };

  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [showStateMenu, setShowStateMenu] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{
    toStateId: string; needsEvidence: boolean; types: string[];
    needsUserAssign: boolean; assignToRoles: AppRole[];
  } | null>(null);
  const [pendingUserAssign, setPendingUserAssign] = useState<{
    toStateId: string; evidence?: EvidencePayload; assignToRoles: AppRole[];
  } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Cerrar con Escape
  useEffect(() => {
    if (!wi) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showStateMenu && !pendingTransition) onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [wi, onClose, showStateMenu, pendingTransition]);

  // Reset al cambiar workItem
  useEffect(() => {
    setShowStateMenu(false);
    setPendingTransition(null);
    setPendingUserAssign(null);
    setMoveError(null);
    setSuccess(null);
  }, [wi?.id]);

  // ── Transiciones disponibles desde el estado actual ────
  const availableTransitions = useCallback(() => {
    if (!wi) return [];
    return transitions.filter(
      (t) =>
        t.fromStateId === wi.stateId &&
        t.allowedRoles.some((r) => roles.includes(r as AppRole)),
    );
  }, [wi, transitions, roles]);

  const getStateName = (sid: string) => states.find((s) => s.id === sid)?.name ?? sid;

  // ── Lanzar transición ─────────────────────────────────
  const startTransition = (toStateId: string) => {
    const tr = transitions.find(
      (t) => t.fromStateId === wi!.stateId && t.toStateId === toStateId,
    );
    setShowStateMenu(false);
    if (!tr) return;
    const needsEvidence = !!(tr.requireEvidence || tr.requireComment);
    const assignToRoles = tr.assignToRole ?? [];
    const needsUserAssign = !!(tr.requireUserAssignment || assignToRoles.length > 0);
    if (needsEvidence) {
      const types = tr.requireComment && !tr.requireEvidence
        ? ["comment"]
        : (tr.evidenceTypes ?? ["comment"]);
      setPendingTransition({ toStateId, needsEvidence: true, types, needsUserAssign, assignToRoles });
    } else if (needsUserAssign) {
      setPendingUserAssign({ toStateId, assignToRoles });
    } else {
      doTransition(toStateId, undefined);
    }
  };

  const doTransition = async (toStateId: string, evidence?: EvidencePayload, assignedToUserId?: string) => {
    if (!wi) return;
    setMoving(true);
    setMoveError(null);
    setPendingTransition(null);
    try {
      const updated = await patchWorkItemState(wi.id, { toStateId, evidence, assignedToUserId });
      onUpdated(updated);
      setSuccess(`Estado cambiado a "${getStateName(toStateId)}"`);
      setTimeout(() => setSuccess(null), 2500);
    } catch (e: unknown) {
      setMoveError(e instanceof Error ? e.message : "Error al cambiar estado");
    } finally {
      setMoving(false);
    }
  };

  const currentState = wi ? states.find((s) => s.id === wi.stateId) : undefined;
  const available = availableTransitions();

  return (
    <>
      {/* Overlay */}
      <div
        onClick={showStateMenu || pendingTransition ? undefined : onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
          zIndex: 300, opacity: wi ? 1 : 0,
          transition: "opacity 200ms", pointerEvents: wi ? "auto" : "none",
        }}
      />

      {/* Panel */}
      <aside
        role="dialog" aria-label="Detalle de tarea" aria-hidden={!wi}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: W,
          background: "#fff", zIndex: 301,
          boxShadow: "-4px 0 24px rgba(0,0,0,0.14)",
          transform: wi ? "translateX(0)" : `translateX(${W}px)`,
          transition: "transform 240ms cubic-bezier(.4,0,.2,1)",
          display: "flex", flexDirection: "column",
          fontFamily: "'Segoe UI', sans-serif", overflowY: "auto",
        }}
      >
        {wi && (
          <>
            {/* ── Header ── */}
            <div style={{
              padding: "16px 18px 12px",
              borderBottom: `3px solid ${STATE_BG[wi.stateId] ?? "#EDEBE9"}`,
              position: "sticky", top: 0, background: "#fff", zIndex: 2,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Tipo + código */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 10,
                      background: "#F3F2F1", color: TYPE_COLOR[wi.type] ?? "#605E5C",
                      fontWeight: 700,
                    }}>{TYPE_LABEL[wi.type] ?? wi.type}</span>
                    <code style={{ fontSize: 10, color: "#8A8886" }}>
                      {wi.jiraIssueKey || wi.id.replace("wi-", "WI-").toUpperCase().slice(0, 12)}
                    </code>
                    {wi.jiraUrl && (
                      <a
                        href={wi.jiraUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "#0078D4", display: "flex", alignItems: "center", gap: 3, fontSize: 10 }}
                      >
                        <ExternalLink size={11} /> Jira
                      </a>
                    )}
                  </div>

                  {/* Título */}
                  <h2 style={{
                    margin: "0 0 8px", fontSize: 14, fontWeight: 700,
                    color: "#201F1E", lineHeight: 1.4, paddingRight: 8,
                  }}>{wi.title}</h2>

                  {/* Estado + prioridad */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: 11, padding: "3px 10px", borderRadius: 10,
                      background: STATE_BG[wi.stateId] ?? "#F3F2F1",
                      color: STATE_TXT[wi.stateId] ?? "#605E5C", fontWeight: 600,
                    }}>{currentState?.name ?? wi.stateId}</span>
                    <span style={{
                      fontSize: 10, padding: "3px 8px", borderRadius: 10,
                      background: PRI_BG[wi.priority] ?? "#F3F2F1",
                      color: PRI_COLOR[wi.priority] ?? "#605E5C", fontWeight: 700,
                    }}>{wi.priority}</span>
                    {wi.sprintName && (
                      <span style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 10,
                        background: "#F3F2F1", color: "#605E5C",
                      }}>📌 {wi.sprintName}</span>
                    )}
                  </div>
                </div>
                <button onClick={onClose} aria-label="Cerrar" style={{
                  flexShrink: 0, width: 28, height: 28, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  border: "1px solid #EDEBE9", borderRadius: 5,
                  background: "transparent", cursor: "pointer", color: "#605E5C",
                }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, padding: "18px 18px", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* ── Cambio de estado ── */}
              {canAct ? (
                <div>
                  <SectionTitle>Transición de estado</SectionTitle>
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setShowStateMenu((v) => !v)}
                      disabled={moving || available.length === 0}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", border: "1px solid #0078D4", borderRadius: 5,
                        background: moving ? "#EFF6FC" : available.length === 0 ? "#F3F2F1" : "#EFF6FC",
                        color: available.length === 0 ? "#8A8886" : "#0078D4",
                        cursor: available.length === 0 || moving ? "default" : "pointer",
                        fontSize: 12, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
                        width: "100%", justifyContent: "space-between",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {moving
                          ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Actualizando…</>
                          : <><ArrowRightCircle size={13} /> Cambiar a…</>}
                      </span>
                      {available.length === 0 && (
                        <span style={{ fontSize: 10, color: "#8A8886" }}>sin transiciones</span>
                      )}
                    </button>

                    {/* Menú desplegable de transiciones */}
                    {showStateMenu && (
                      <div style={{
                        position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                        background: "#fff", border: "1px solid #EDEBE9", borderRadius: 6,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.12)", zIndex: 10,
                        overflow: "hidden",
                      }}>
                        {available.map((tr) => {
                          const nextState = states.find((s) => s.id === tr.toStateId);
                          return (
                            <button
                              key={tr.toStateId}
                              onClick={() => startTransition(tr.toStateId)}
                              style={{
                                display: "flex", alignItems: "center", gap: 10,
                                width: "100%", padding: "9px 12px",
                                border: "none", borderBottom: "1px solid #F3F2F1",
                                background: "transparent", cursor: "pointer",
                                fontSize: 12, fontFamily: "'Segoe UI', sans-serif",
                                textAlign: "left",
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#EFF6FC"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                            >
                              <span style={{
                                width: 10, height: 10, borderRadius: "50%",
                                background: STATE_BG[tr.toStateId] ?? "#F3F2F1",
                                border: `1.5px solid ${STATE_TXT[tr.toStateId] ?? "#C8C6C4"}`,
                                flexShrink: 0,
                              }} />
                              <span style={{ flex: 1, color: "#201F1E", fontWeight: 500 }}>
                                {nextState?.name ?? tr.toStateId}
                              </span>
                              {(tr.requireEvidence || tr.requireComment) && (
                                <span style={{ fontSize: 10, color: "#CA8B00" }}>Requiere evidencia</span>
                              )}
                              {tr.requireUserAssignment && (
                                <span style={{ fontSize: 10, color: "#0078D4" }}>Asignar usuario</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Formulario de evidencia inline */}
                  {pendingTransition && (
                    <div style={{ marginTop: 10 }}>
                      <EvidenceInline
                        types={pendingTransition.types}
                        onSubmit={(ev) => {
                          if (pendingTransition.needsUserAssign) {
                            setPendingUserAssign({ toStateId: pendingTransition.toStateId, evidence: ev, assignToRoles: pendingTransition.assignToRoles });
                            setPendingTransition(null);
                          } else {
                            doTransition(pendingTransition.toStateId, ev);
                          }
                        }}
                        onCancel={() => setPendingTransition(null)}
                      />
                    </div>
                  )}

                  {/* Mensajes */}
                  {success && (
                    <div style={{
                      marginTop: 8, display: "flex", alignItems: "center", gap: 6,
                      background: "#DFF6DD", border: "1px solid #92C353",
                      borderRadius: 5, padding: "7px 10px",
                      fontSize: 12, color: "#107C10",
                    }}>
                      <CheckCircle2 size={13} /> {success}
                    </div>
                  )}
                  {moveError && (
                    <div style={{
                      marginTop: 8, display: "flex", alignItems: "center", gap: 6,
                      background: "#FDE7E9", border: "1px solid #F9A8A8",
                      borderRadius: 5, padding: "7px 10px",
                      fontSize: 12, color: "#D13438",
                    }}>
                      <AlertTriangle size={13} /> {moveError}
                    </div>
                  )}
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              ) : (
                /* Bloqueo por ownership — el usuario no puede actuar sobre este item */
                <LockBanner message={lockReason || undefined} />
              )}

              {/* ── Bloqueo ── */}
              {wi.blockedReason && (
                <div style={{
                  display: "flex", gap: 8, background: "#FDF3F0",
                  border: "1px solid #FDCFBC", borderRadius: 6,
                  padding: "10px 12px", fontSize: 12, color: "#D83B01", lineHeight: 1.5,
                }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{wi.blockedReason}</span>
                </div>
              )}

              {/* ── Metadatos ── */}
              <div>
                <SectionTitle>Información</SectionTitle>
                {project && (
                  <MetaRow icon={<Layers size={13} />} label="Épica">
                    <code style={{ fontSize: 10 }}>{project.code}</code>&nbsp;{project.name}
                  </MetaRow>
                )}
                <MetaRow icon={<User size={13} />} label="Asignado a">
                  {wi.assignedToRole}
                </MetaRow>
                <MetaRow icon={<Calendar size={13} />} label="Inicio">
                  {fmtDate(wi.startDate)}
                </MetaRow>
                <MetaRow icon={<Calendar size={13} />} label="Fin">
                  <span style={{
                    color: isOverdue(wi.endDate) && wi.stateId !== "st-cls" ? "#D13438" : "inherit",
                    fontWeight: isOverdue(wi.endDate) && wi.stateId !== "st-cls" ? 700 : 400,
                  }}>
                    {fmtDate(wi.endDate)}
                    {isOverdue(wi.endDate) && wi.stateId !== "st-cls" && " ⚠"}
                  </span>
                </MetaRow>
                <MetaRow icon={<Flag size={13} />} label="Prioridad">
                  <span style={{ color: PRI_COLOR[wi.priority] ?? "#605E5C", fontWeight: 600 }}>
                    {wi.priority}
                  </span>
                </MetaRow>
              </div>

              {/* ── Tags ── */}
              {wi.tags.length > 0 && (
                <div>
                  <SectionTitle>Tags</SectionTitle>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {wi.tags.map((t) => (
                      <span key={t} style={{
                        padding: "3px 9px", borderRadius: 10,
                        background: "#EFF6FC", color: "#0078D4",
                        fontSize: 11, fontFamily: "'Segoe UI', sans-serif",
                        display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <Tag size={10} /> {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Jira / Sync ── */}
              <div>
                <SectionTitle>Integración Jira</SectionTitle>
                <div style={{
                  background: "#FAFAFA", border: "1px solid #EDEBE9",
                  borderRadius: 6, padding: "10px 12px",
                  display: "flex", flexDirection: "column", gap: 6,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#605E5C" }}>Clave Jira</span>
                    <span style={{ fontWeight: 600, color: wi.jiraIssueKey ? "#201F1E" : "#8A8886" }}>
                      {wi.jiraIssueKey || "Sin clave"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#605E5C" }}>Estado Jira</span>
                    <span style={{ fontWeight: 600, color: "#201F1E" }}>{wi.jiraState ?? "—"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#605E5C" }}>Sincronización</span>
                    <span style={{
                      fontWeight: 600,
                      color: wi.syncStatus === "OK" ? "#107C10" : wi.syncStatus === "Error" ? "#D13438" : "#CA8B00",
                    }}>
                      {wi.syncStatus}
                    </span>
                  </div>
                  {wi.jiraUrl && (
                    <a
                      href={wi.jiraUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginTop: 4, display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 11, color: "#0078D4", textDecoration: "none",
                        padding: "5px 10px", border: "1px solid #0078D4",
                        borderRadius: 4, alignSelf: "flex-start",
                      }}
                    >
                      <ExternalLink size={12} /> Abrir en Jira
                    </a>
                  )}
                </div>
              </div>

              {/* ── Sprint ── */}
              {wi.sprintName && (
                <MetaRow icon={<Clock size={13} />} label="Sprint">
                  {wi.sprintName}
                </MetaRow>
              )}
            </div>
          </>
        )}
      </aside>

      {/* ── Modal asignación de usuario (desde drawer) ── */}
      {pendingUserAssign && wi && (
        <AssignUserModal
          newRole={pendingUserAssign.assignToRoles}
          project={project}
          users={users}
          toStateName={states.find((s) => s.id === pendingUserAssign.toStateId)?.name ?? pendingUserAssign.toStateId}
          fromStateName={states.find((s) => s.id === wi.stateId)?.name ?? wi.stateId}
          onConfirm={(assignedToUserId) => {
            const { toStateId, evidence } = pendingUserAssign;
            setPendingUserAssign(null);
            doTransition(toStateId, evidence, assignedToUserId);
          }}
          onCancel={() => setPendingUserAssign(null)}
        />
      )}
    </>
  );
};

// ── Helper (inline use) ───────────────────────────────────
function isOverdue(endDate?: string): boolean {
  if (!endDate) return false;
  return new Date(endDate).getTime() < Date.now();
}
