// ─────────────────────────────────────────────────────────
//  src/screens/kanban/components/WorkItemDrawer.tsx
//  Drawer lateral con 5 pestañas para un WorkItem
//  Tabs: Detalle | Acciones | Evidencias | Actividad | Jira
// ─────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  X, Info, Zap, ListChecks, Activity, ExternalLink,
  RotateCw, AlertTriangle, CheckCircle2, Send, RefreshCw,
  Link2, MessageSquare, FileText, Clock, User,
} from "lucide-react";
import type {
  WorkItem, State, Transition, Evidence, ActivityLogEntry,
  AppRole, EvidenceType,
} from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";
import { canActOnWorkItem } from "../../../auth/workItemPermissions";
import { LockBanner } from "../../../components/ui/LockBadge";
import {
  getEvidences, getActivity,
} from "../../../services/workItemService";
import {
  addJiraComment, retrySyncWorkItem,
} from "../../../services/workItemService";
import { KANBAN_COLUMNS, STATE_CHIP, SYNC_CHIP, PRIORITY_CHIP, TYPE_CHIP } from "../tokens";

// ── Tipos ────────────────────────────────────────────────
export type DrawerTab = "detalle" | "acciones" | "evidencias" | "actividad" | "jira";

interface Props {
  item: WorkItem;
  states: State[];
  transitions: Transition[];
  currentUserRoles: AppRole[];
  /** Usuario efectivo (para check RBAC+ownership) */
  appUser?: AppUser | null;
  /** Si el Admin tiene adminBypass activo, salta todos los checks */
  adminBypass?: boolean;
  onClose: () => void;
  onMoveFromDrawer: (item: WorkItem, toStateId: string) => void;
  onItemUpdated: (updated: WorkItem) => void;
}

// ── Helpers ──────────────────────────────────────────────
const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  link: "Enlace", comment: "Comentario", file: "Archivo",
};

const EVIDENCE_TYPE_ICONS: Record<EvidenceType, React.ReactNode> = {
  link:    <Link2 size={12} />,
  comment: <MessageSquare size={12} />,
  file:    <FileText size={12} />,
};

function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtDateTime(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{
      fontSize: 11, fontWeight: 600, color: "#605E5C",
      textTransform: "uppercase", letterSpacing: "0.05em",
      marginBottom: 4, fontFamily: "'Segoe UI', sans-serif",
    }}>
      {label}
    </div>
    <div style={{ fontSize: 13, color: "#201F1E", fontFamily: "'Segoe UI', sans-serif" }}>
      {children}
    </div>
  </div>
);

const Chip: React.FC<{ bg: string; text: string; children: React.ReactNode }> = ({
  bg, text, children,
}) => (
  <span style={{
    display: "inline-block", borderRadius: 10, padding: "3px 10px",
    background: bg, color: text, fontSize: 12, fontWeight: 600,
    fontFamily: "'Segoe UI', sans-serif",
  }}>
    {children}
  </span>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 12, fontWeight: 700, color: "#323130",
    fontFamily: "'Segoe UI', sans-serif",
    padding: "10px 0 6px",
    borderBottom: "1px solid #EDEBE9", marginBottom: 12,
  }}>
    {children}
  </div>
);

// ── Tab: Detalle ─────────────────────────────────────────
const TabDetalle: React.FC<{
  item: WorkItem; states: State[]; transitions: Transition[];
  currentUserRoles: AppRole[];
  /** Si false, se muestra el banner de bloqueo y no se ofrecen transiciones */
  canAct?: boolean;
  onMoveRequest: (toStateId: string) => void;
}> = ({ item, states, transitions, currentUserRoles, canAct = true, onMoveRequest }) => {
  const state = states.find((s) => s.id === item.stateId);
  const chip  = STATE_CHIP[item.stateId] ?? { bg: "#F3F2F1", text: "#605E5C" };
  const pChip = PRIORITY_CHIP[item.priority] ?? { bg: "#F3F2F1", text: "#605E5C" };
  const tChip = TYPE_CHIP[item.type] ?? { bg: "#F3F2F1", text: "#605E5C" };

  // Transiciones válidas desde estado actual + rol del usuario
  const validTransitions = transitions.filter((t) =>
    t.fromStateId === item.stateId &&
    t.allowedRoles.some((r) => currentUserRoles.includes(r as AppRole)),
  );

  const [selectedTo, setSelectedTo] = useState("");

  return (
    <div>
      <FieldRow label="Estado actual">
        <Chip bg={chip.bg} text={chip.text}>{state?.name ?? item.stateId}</Chip>
      </FieldRow>

      {item.stateId === "st-blk" && item.blockedReason && (
        <FieldRow label="Motivo de bloqueo">
          <div style={{
            background: "#FDE7E9", border: "1px solid #F4B8BB",
            borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#A4262C",
            display: "flex", gap: 6, alignItems: "flex-start",
          }}>
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            {item.blockedReason}
          </div>
        </FieldRow>
      )}

      <FieldRow label="Tipo">
        <Chip bg={tChip.bg} text={tChip.text}>{item.type}</Chip>
      </FieldRow>

      <FieldRow label="Prioridad">
        <Chip bg={pChip.bg} text={pChip.text}>{item.priority}</Chip>
      </FieldRow>

      <FieldRow label="Asignado a">
        <span style={{
          fontSize: 13, color: "#201F1E", fontFamily: "'Segoe UI', sans-serif",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <User size={13} color="#605E5C" /> {item.assignedToRole}
        </span>
      </FieldRow>

      <FieldRow label="Fechas">
        <span style={{ fontSize: 12, color: "#605E5C", fontFamily: "'Segoe UI', sans-serif" }}>
          {fmtDate(item.startDate)} — {fmtDate(item.endDate)}
        </span>
      </FieldRow>

      <FieldRow label="Progreso">
        <div>
          <div style={{ fontSize: 12, color: "#605E5C", marginBottom: 5, fontFamily: "'Segoe UI', sans-serif" }}>
            {item.progress}%
          </div>
          <div style={{ height: 6, background: "#EDEBE9", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", background: "#0078D4", borderRadius: 3,
              width: `${item.progress}%`,
            }} />
          </div>
        </div>
      </FieldRow>

      {item.tags.length > 0 && (
        <FieldRow label="Etiquetas">
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {item.tags.map((t) => (
              <span key={t} style={{
                background: "#F3F2F1", color: "#605E5C", fontSize: 11,
                borderRadius: 10, padding: "2px 8px", fontFamily: "'Segoe UI', sans-serif",
              }}>
                {t}
              </span>
            ))}
          </div>
        </FieldRow>
      )}

      {/* Mover estado */}
      {validTransitions.length > 0 && (
        <div style={{
          marginTop: 20, padding: "14px", background: "#F3F2F1",
          borderRadius: 8, border: "1px solid #EDEBE9",
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: "#323130",
            marginBottom: 10, fontFamily: "'Segoe UI', sans-serif",
          }}>
            Mover a otro estado
          </div>
          {!canAct ? (
            <LockBanner />
          ) : (
            <>
              <select
                value={selectedTo}
                onChange={(e) => setSelectedTo(e.target.value)}
                style={{
                  width: "100%", padding: "7px 10px", borderRadius: 6,
                  border: "1px solid #EDEBE9", fontSize: 12, color: "#201F1E",
                  background: "#fff", fontFamily: "'Segoe UI', sans-serif", marginBottom: 8,
                }}
              >
                <option value="">Selecciona un estado…</option>
                {validTransitions.map((t) => {
                  const col = KANBAN_COLUMNS.find((c) => c.stateId === t.toStateId);
                  return (
                    <option key={t.toStateId} value={t.toStateId}>
                      {col?.label ?? t.toStateId}
                      {t.evidenceRequired ? " (requiere evidencia)" : ""}
                    </option>
                  );
                })}
              </select>
              <button
                onClick={() => { if (selectedTo) onMoveRequest(selectedTo); }}
                disabled={!selectedTo}
                style={{
                  width: "100%", padding: "8px", borderRadius: 6, border: "none",
                  background: selectedTo ? "#0078D4" : "#EDEBE9",
                  color: selectedTo ? "#fff" : "#A19F9D",
                  cursor: selectedTo ? "pointer" : "not-allowed",
                  fontSize: 12, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
                  transition: "all 150ms",
                }}
              >
                Aplicar transición
              </button>
            </>
          )}
        </div>
      )}

      {validTransitions.length === 0 && (
        <div style={{
          marginTop: 16, padding: "10px 12px", background: "#F3F2F1",
          borderRadius: 6, fontSize: 12, color: "#605E5C",
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          No hay transiciones disponibles desde este estado para tu rol.
        </div>
      )}
    </div>
  );
};

// ── Tab: Acciones ────────────────────────────────────────
const TabAcciones: React.FC<{
  item: WorkItem;
  currentUserRoles: AppRole[];
}> = ({ item, currentUserRoles }) => {
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSendComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await addJiraComment(item.id, comment.trim());
      setResult({ ok: res.success, msg: res.message });
      setComment("");
    } catch {
      setResult({ ok: false, msg: "Error al enviar el comentario a Jira." });
    } finally {
      setSending(false);
    }
  };

  const isReadOnly = !currentUserRoles.includes("Admin") &&
    !currentUserRoles.includes("IT AirEuropa") &&
    !currentUserRoles.includes("Proveedor");

  return (
    <div>
      <SectionTitle>Enviar comentario a Jira</SectionTitle>
      <div style={{
        fontSize: 12, color: "#605E5C", marginBottom: 12,
        fontFamily: "'Segoe UI', sans-serif",
      }}>
        El comentario se enviará al ticket <strong>{item.jiraIssueKey ?? "—"}</strong> vía Power Automate.
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escribe tu comentario para Jira..."
        rows={4}
        style={{
          width: "100%", boxSizing: "border-box", resize: "vertical",
          fontFamily: "'Segoe UI', sans-serif", fontSize: 13, color: "#201F1E",
          border: "1px solid #EDEBE9", borderRadius: 6, padding: "8px 10px",
          background: "#fff",
        }}
      />

      {result && (
        <div style={{
          margin: "8px 0",
          padding: "8px 12px", borderRadius: 6,
          background: result.ok ? "#DFF6DD" : "#FDE7E9",
          border: `1px solid ${result.ok ? "#92C353" : "#F4B8BB"}`,
          fontSize: 12, color: result.ok ? "#107C10" : "#A4262C",
          display: "flex", gap: 6, alignItems: "center",
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          {result.ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
          {result.msg}
        </div>
      )}

      <button
        onClick={handleSendComment}
        disabled={sending || !comment.trim()}
        style={{
          marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 16px", borderRadius: 6, border: "none",
          background: sending || !comment.trim() ? "#EDEBE9" : "#0078D4",
          color: sending || !comment.trim() ? "#A19F9D" : "#fff",
          cursor: sending || !comment.trim() ? "not-allowed" : "pointer",
          fontSize: 12, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        {sending ? <RotateCw size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={12} />}
        {sending ? "Enviando…" : "Enviar comentario"}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </button>

      {isReadOnly && (
        <div style={{ marginTop: 20 }}>
          <SectionTitle>Solicitar cambio de estado</SectionTitle>
          <div style={{
            padding: "10px 12px", background: "#FFF4CE", borderRadius: 6,
            fontSize: 12, color: "#835B00", fontFamily: "'Segoe UI', sans-serif",
          }}>
            No tienes permisos para mover este elemento directamente. Contacta con el equipo IT para solicitar un cambio de estado.
          </div>
        </div>
      )}
    </div>
  );
};

// ── Tab: Evidencias ──────────────────────────────────────
const TabEvidencias: React.FC<{ item: WorkItem }> = ({ item }) => {
  const [evidences, setEvidences] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getEvidences("WorkItem", item.id)
      .then(setEvidences)
      .catch(() => setEvidences([]))
      .finally(() => setLoading(false));
  }, [item.id]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <RotateCw size={18} color="#0078D4" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (evidences.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "#A19F9D", fontSize: 12,
        fontFamily: "'Segoe UI', sans-serif" }}>
        No hay evidencias registradas para este elemento.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {evidences.map((ev) => (
        <div key={ev.id} style={{
          border: "1px solid #EDEBE9", borderRadius: 8, padding: "10px 12px",
          background: "#FAFAFA",
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
          }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600,
              background: "#EFF6FC", color: "#0078D4",
              borderRadius: 4, padding: "2px 7px",
              fontFamily: "'Segoe UI', sans-serif",
            }}>
              {EVIDENCE_TYPE_ICONS[ev.type]} {EVIDENCE_TYPE_LABELS[ev.type]}
            </span>
            <span style={{
              marginLeft: "auto", fontSize: 11, color: "#A19F9D",
              fontFamily: "'Segoe UI', sans-serif",
            }}>
              {fmtDateTime(ev.createdOn)}
            </span>
          </div>

          {ev.type === "link" && ev.value && (
            <a
              href={ev.value}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 12, color: "#0078D4", display: "flex", alignItems: "center",
                gap: 4, marginBottom: 4, fontFamily: "'Segoe UI', sans-serif",
              }}
            >
              <ExternalLink size={11} /> {ev.value}
            </a>
          )}

          {ev.comment && (
            <div style={{
              fontSize: 12, color: "#605E5C", fontFamily: "'Segoe UI', sans-serif",
              lineHeight: 1.5,
            }}>
              {ev.comment}
            </div>
          )}

          <div style={{
            marginTop: 6, fontSize: 11, color: "#A19F9D",
            fontFamily: "'Segoe UI', sans-serif",
          }}>
            Por: {ev.createdBy}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Tab: Actividad ───────────────────────────────────────
const TabActividad: React.FC<{ item: WorkItem }> = ({ item }) => {
  const [log, setLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getActivity(item.projectId)
      .then((all) => setLog(all.filter((e) => e.entityId === item.id)))
      .catch(() => setLog([]))
      .finally(() => setLoading(false));
  }, [item.id, item.projectId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <RotateCw size={18} color="#0078D4" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (log.length === 0) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center", color: "#A19F9D", fontSize: 12,
        fontFamily: "'Segoe UI', sans-serif" }}>
        Sin actividad registrada para este elemento.
      </div>
    );
  }

  const ACTION_LABELS: Record<string, string> = {
    STATE_CHANGED:    "Cambio de estado",
    EVIDENCE_ADDED:   "Evidencia añadida",
    JIRA_COMMENT_SENT: "Comentario Jira enviado",
    DATE_UPDATED:     "Fechas actualizadas",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {log.map((entry) => (
        <div key={entry.id} style={{
          display: "flex", gap: 10, paddingBottom: 14,
          borderLeft: "2px solid #EDEBE9", marginLeft: 8, paddingLeft: 14,
          position: "relative",
        }}>
          {/* Dot */}
          <div style={{
            position: "absolute", left: -6, top: 2,
            width: 10, height: 10, borderRadius: "50%",
            background: "#0078D4", border: "2px solid #fff",
          }} />

          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: "#201F1E",
              fontFamily: "'Segoe UI', sans-serif", marginBottom: 2,
            }}>
              {ACTION_LABELS[entry.action] ?? entry.action}
            </div>

            {entry.action === "STATE_CHANGED" && (
              <div style={{ fontSize: 11, color: "#605E5C", fontFamily: "'Segoe UI', sans-serif" }}>
                <span style={{ background: "#F3F2F1", borderRadius: 3, padding: "1px 5px" }}>{entry.from}</span>
                {" → "}
                <span style={{ background: "#EFF6FC", color: "#0078D4", borderRadius: 3, padding: "1px 5px" }}>{entry.to}</span>
              </div>
            )}

            {entry.to && entry.action !== "STATE_CHANGED" && (
              <div style={{ fontSize: 11, color: "#605E5C", fontFamily: "'Segoe UI', sans-serif" }}>
                {entry.to.length > 80 ? entry.to.slice(0, 80) + "…" : entry.to}
              </div>
            )}

            <div style={{
              display: "flex", gap: 10, marginTop: 4,
              fontSize: 11, color: "#A19F9D", fontFamily: "'Segoe UI', sans-serif",
              alignItems: "center",
            }}>
              <Clock size={10} /> {fmtDateTime(entry.at)}
              <User size={10} /> {entry.who} ({entry.whoRole})
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Tab: Jira ────────────────────────────────────────────
const TabJira: React.FC<{
  item: WorkItem;
  currentUserRoles: AppRole[];
  onItemUpdated: (updated: WorkItem) => void;
}> = ({ item, currentUserRoles, onItemUpdated }) => {
  const [retrying, setRetrying] = useState(false);
  const syncChip = SYNC_CHIP[item.syncStatus] ?? SYNC_CHIP.OK;
  const canRetry = currentUserRoles.includes("Admin") || currentUserRoles.includes("IT AirEuropa");

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const updated = await retrySyncWorkItem(item.id);
      onItemUpdated(updated);
    } catch {
      // silencioso
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div>
      <SectionTitle>Información de Jira</SectionTitle>

      <FieldRow label="Ticket Jira">
        {item.jiraIssueKey ? (
          <a
            href={item.jiraUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            style={{
              color: "#0078D4", fontSize: 14, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 5,
              fontFamily: "'Segoe UI', sans-serif", textDecoration: "none",
            }}
          >
            {item.jiraIssueKey} <ExternalLink size={12} />
          </a>
        ) : (
          <span style={{ color: "#A19F9D", fontSize: 13 }}>Sin ticket asociado</span>
        )}
      </FieldRow>

      <FieldRow label="Estado en Jira">
        <span style={{
          fontSize: 12, background: "#F3F2F1", color: "#323130",
          borderRadius: 4, padding: "3px 9px",
          fontFamily: "'Segoe UI', sans-serif", fontWeight: 600,
        }}>
          {item.jiraState ?? "Desconocido"}
        </span>
      </FieldRow>

      {item.sprintName && (
        <FieldRow label="Sprint">
          <span style={{
            fontSize: 12, background: "#EFF6FC", color: "#0078D4",
            borderRadius: 4, padding: "3px 9px",
            fontFamily: "'Segoe UI', sans-serif", fontWeight: 600,
          }}>
            {item.sprintName}
          </span>
        </FieldRow>
      )}

      <SectionTitle>Estado de sincronización</SectionTitle>

      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px", borderRadius: 8,
        background: syncChip.bg, border: `1px solid ${syncChip.bg}`,
        marginBottom: 12,
      }}>
        <span style={{
          fontSize: 13, fontWeight: 700, color: syncChip.text,
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          {syncChip.label}
        </span>
        {item.syncStatus === "OK" && <CheckCircle2 size={16} color={syncChip.text} />}
        {item.syncStatus === "Pending" && (
          <RotateCw size={14} color={syncChip.text} style={{ animation: "spin 1s linear infinite" }} />
        )}
        {item.syncStatus === "Error" && <AlertTriangle size={14} color={syncChip.text} />}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>

      {item.syncStatus === "Error" && item.syncError && (
        <div style={{
          padding: "10px 12px", background: "#FDE7E9", borderRadius: 6,
          fontSize: 12, color: "#A4262C", marginBottom: 12,
          fontFamily: "'Segoe UI', sans-serif", lineHeight: 1.5,
        }}>
          <strong>Detalle del error:</strong><br />
          {item.syncError}
        </div>
      )}

      {item.syncStatus === "Error" && canRetry && (
        <button
          onClick={handleRetry}
          disabled={retrying}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 6, border: "none",
            background: retrying ? "#EDEBE9" : "#D13438",
            color: retrying ? "#A19F9D" : "#fff",
            cursor: retrying ? "not-allowed" : "pointer",
            fontSize: 12, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
          }}
        >
          {retrying
            ? <RotateCw size={12} style={{ animation: "spin 1s linear infinite" }} />
            : <RefreshCw size={12} />}
          {retrying ? "Reintentando…" : "Reintentar sincronización"}
        </button>
      )}
    </div>
  );
};

// ── WorkItemDrawer ───────────────────────────────────────
export const WorkItemDrawer: React.FC<Props> = ({
  item, states, transitions, currentUserRoles, appUser, adminBypass = false,
  onClose, onMoveFromDrawer, onItemUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<DrawerTab>("detalle");

  // Check de ownership para este item
  const { can: canAct } = canActOnWorkItem(
    appUser ?? null, item, currentUserRoles, transitions, adminBypass,
  );

  // Bloquear scroll del body mientras el drawer está abierto
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const tabs: Array<{ id: DrawerTab; label: string; icon: React.ReactNode }> = [
    { id: "detalle",    label: "Detalle",    icon: <Info size={13} /> },
    { id: "acciones",   label: "Acciones",   icon: <Zap size={13} /> },
    { id: "evidencias", label: "Evidencias", icon: <ListChecks size={13} /> },
    { id: "actividad",  label: "Actividad",  icon: <Activity size={13} /> },
    { id: "jira",       label: "Jira",       icon: <ExternalLink size={13} /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 900,
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 440, zIndex: 901,
        background: "#fff",
        boxShadow: "-6px 0 32px rgba(0,0,0,0.14)",
        display: "flex", flexDirection: "column",
        fontFamily: "'Segoe UI', sans-serif",
        animation: "slideIn 200ms ease-out",
      }}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid #EDEBE9",
          display: "flex", alignItems: "flex-start", gap: 10,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {item.jiraIssueKey && (
              <div style={{ fontSize: 11, color: "#0078D4", fontWeight: 700, marginBottom: 3 }}>
                {item.jiraIssueKey}
              </div>
            )}
            <div style={{
              fontSize: 14, fontWeight: 700, color: "#201F1E",
              lineHeight: 1.35, wordBreak: "break-word",
            }}>
              {item.title}
            </div>
            <div style={{ fontSize: 11, color: "#A19F9D", marginTop: 2 }}>
              {item.projectId} · ID: {item.id}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: "#605E5C", padding: 4, flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", borderBottom: "1px solid #EDEBE9",
          flexShrink: 0, overflowX: "auto",
          scrollbarWidth: "none",
        }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "10px 14px", border: "none", background: "transparent",
                cursor: "pointer", fontSize: 12, fontWeight: activeTab === t.id ? 700 : 400,
                color: activeTab === t.id ? "#0078D4" : "#605E5C",
                borderBottom: activeTab === t.id ? "2px solid #0078D4" : "2px solid transparent",
                whiteSpace: "nowrap", fontFamily: "'Segoe UI', sans-serif",
                transition: "color 140ms",
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {activeTab === "detalle" && (
            <TabDetalle
              item={item}
              states={states}
              transitions={transitions}
              currentUserRoles={currentUserRoles}
              canAct={canAct}
              onMoveRequest={(toStateId) => onMoveFromDrawer(item, toStateId)}
            />
          )}
          {activeTab === "acciones" && (
            <TabAcciones item={item} currentUserRoles={currentUserRoles} />
          )}
          {activeTab === "evidencias" && <TabEvidencias item={item} />}
          {activeTab === "actividad" && <TabActividad item={item} />}
          {activeTab === "jira" && (
            <TabJira
              item={item}
              currentUserRoles={currentUserRoles}
              onItemUpdated={onItemUpdated}
            />
          )}
        </div>
      </div>
    </>
  );
};
