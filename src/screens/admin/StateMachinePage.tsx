// ─────────────────────────────────────────────────────────
//  src/screens/admin/StateMachinePage.tsx
//  Administración de la Máquina de Estados (transitions[])
//  Acceso: solo Admin
//  Funcionalidades:
//   - Tabla de transiciones con todos los campos
//   - CRUD: Añadir, Editar, Duplicar, Eliminar
//   - Guardrails: ciclos, estados huérfanos, sin ruta a Cerrado, sin roles
//   - Botón "Restaurar máquina por defecto" con confirm modal
//   - AuditLog registrado en cada operación
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState, Component, type ErrorInfo } from "react";
import {
  GitBranch, Plus, Edit2, Copy, Trash2, RotateCcw,
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  X, Save, Loader, Info,
} from "lucide-react";
import type { Transition, State, EvidenceType, AppRole } from "../../types/domain";
import { getStates } from "../../services/workItemService";
import {
  getTransitions, createTransition, updateTransition,
  deleteTransition, resetTransitionsToDefaults,
  type TransitionPayload,
} from "../../services/stateMachineService";
import { AdminToastContainer, newAdminToast, type ToastMsg } from "./components/shared";

// ── Design tokens ─────────────────────────────────────────
const FONT = "'Segoe UI', sans-serif";

const ROLE_OPTIONS: AppRole[] = ["Admin", "IT AirEuropa", "Proveedor", "Usuario"];
const EVIDENCE_TYPE_OPTIONS: EvidenceType[] = ["link", "comment", "file"];

const ROLE_CHIP: Record<string, { bg: string; text: string }> = {
  "Admin":        { bg: "#F3F2F1", text: "#323130" },
  "IT AirEuropa": { bg: "#EFF6FC", text: "#0078D4" },
  "Proveedor":    { bg: "#FFF4CE", text: "#835B00" },
  "Usuario":      { bg: "#E7F7E7", text: "#107C10" },
};

const STATE_ACCENT: Record<string, string> = {
  "st-new":  "#797775",
  "st-ref":  "#2899F5",
  "st-prog": "#107C10",
  "st-blk":  "#D13438",
  "st-rft":  "#CA8B00",
  "st-test": "#7530AF",
  "st-acc":  "#00B294",
  "st-cls":  "#605E5C",
};

// ── Helpers ───────────────────────────────────────────────
function RoleChip({ role }: { role: string }) {
  const c = ROLE_CHIP[role] ?? { bg: "#F3F2F1", text: "#323130" };
  return (
    <span style={{
      fontSize: 10, padding: "1px 6px", borderRadius: 4,
      background: c.bg, color: c.text, fontWeight: 600,
      fontFamily: FONT, whiteSpace: "nowrap",
    }}>{role}</span>
  );
}

function StateBadge({ stateId, stateName }: { stateId: string; stateName: string }) {
  const accent = STATE_ACCENT[stateId] ?? "#797775";
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 4,
      background: `${accent}18`, color: accent, fontWeight: 700,
      fontFamily: FONT, border: `1px solid ${accent}44`,
    }}>{stateName}</span>
  );
}

function BoolBadge({ val, label }: { val?: boolean; label: string }) {
  return val
    ? <span style={{ fontSize: 10, color: "#107C10", fontWeight: 700, fontFamily: FONT }}>{label}</span>
    : <span style={{ fontSize: 10, color: "#A19F9D", fontFamily: FONT }}>—</span>;
}

// ── Guardrail analysis ────────────────────────────────────
interface GuardrailWarning {
  level: "error" | "warning" | "info";
  message: string;
}

function analyzeGuardrails(transitions: Transition[], states: State[]): GuardrailWarning[] {
  const warnings: GuardrailWarning[] = [];
  const stateIds = new Set(states.map((s) => s.id));
  // Buscar el estado terminal dinámicamente por nombre o categoría para
  // que funcione tanto con IDs mock ("st-cls") como con GUIDs de Dataverse.
  const terminalState = states.find(
    (s) => s.name === "Cerrado" || s.category === "Cerrado",
  );
  const TERMINAL = terminalState?.id ?? "st-cls";

  // 1. Transiciones sin roles
  transitions.forEach((t) => {
    if (!t.allowedRoles || t.allowedRoles.length === 0) {
      const from = states.find((s) => s.id === t.fromStateId)?.name ?? t.fromStateId;
      const to   = states.find((s) => s.id === t.toStateId)?.name ?? t.toStateId;
      warnings.push({ level: "error", message: `Transición ${from} → ${to} no tiene roles permitidos.` });
    }
  });

  // 2. Transiciones a estados desconocidos
  transitions.forEach((t) => {
    if (!stateIds.has(t.fromStateId))
      warnings.push({ level: "error", message: `fromStateId desconocido: "${t.fromStateId}"` });
    if (!stateIds.has(t.toStateId))
      warnings.push({ level: "error", message: `toStateId desconocido: "${t.toStateId}"` });
  });

  // 3. Duplicados
  const seen = new Map<string, number>();
  transitions.forEach((t) => {
    const key = `${t.fromStateId}→${t.toStateId}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  });
  seen.forEach((count, key) => {
    if (count > 1) warnings.push({ level: "error", message: `Transición duplicada: ${key} (${count} veces)` });
  });

  // 4. Ciclos (DFS)
  const outEdges = new Map<string, string[]>();
  transitions.forEach((t) => {
    if (!outEdges.has(t.fromStateId)) outEdges.set(t.fromStateId, []);
    outEdges.get(t.fromStateId)!.push(t.toStateId);
  });
  const detectCycle = (node: string, path: Set<string>): string[] | null => {
    if (path.has(node)) return [node];
    path.add(node);
    for (const next of outEdges.get(node) ?? []) {
      const cycle = detectCycle(next, new Set(path));
      if (cycle) return [node, ...cycle];
    }
    return null;
  };
  const visited = new Set<string>();
  for (const stateId of stateIds) {
    if (!visited.has(stateId)) {
      const cycle = detectCycle(stateId, new Set());
      if (cycle) {
        const names = cycle.map((id) => states.find((s) => s.id === id)?.name ?? id);
        warnings.push({ level: "warning", message: `Ciclo detectado: ${names.join(" → ")}` });
        cycle.forEach((id) => visited.add(id));
      }
    }
  }

  // 5. Sin ruta al estado Cerrado (BFS inverso desde st-cls)
  const reachCls = new Set<string>([TERMINAL]);
  const inEdges = new Map<string, string[]>();
  transitions.forEach((t) => {
    if (!inEdges.has(t.toStateId)) inEdges.set(t.toStateId, []);
    inEdges.get(t.toStateId)!.push(t.fromStateId);
  });
  const queue = [TERMINAL];
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (const prev of inEdges.get(node) ?? []) {
      if (!reachCls.has(prev)) { reachCls.add(prev); queue.push(prev); }
    }
  }
  states.forEach((s) => {
    if (s.id !== TERMINAL && !reachCls.has(s.id)) {
      warnings.push({ level: "warning", message: `Estado "${s.name}" no tiene ruta hacia Cerrado.` });
    }
  });

  // 6. Estados huérfanos (sin transiciones ni entrantes ni salientes)
  const hasIn  = new Set(transitions.map((t) => t.toStateId));
  const hasOut = new Set(transitions.map((t) => t.fromStateId));
  states.forEach((s) => {
    if (s.id !== TERMINAL && !hasIn.has(s.id) && !hasOut.has(s.id)) {
      warnings.push({ level: "info", message: `Estado "${s.name}" no participa en ninguna transición.` });
    }
  });

  if (warnings.length === 0) {
    warnings.push({ level: "info", message: "Máquina de estados válida. No se detectaron problemas." });
  }

  return warnings;
}

// ── Modal de Transición (Add/Edit) ───────────────────────
interface TransitionModalProps {
  initial?: Transition | null;
  states: State[];
  onSave: (payload: TransitionPayload) => Promise<void>;
  onClose: () => void;
}

const TransitionModal: React.FC<TransitionModalProps> = ({ initial, states, onSave, onClose }) => {
  const [fromStateId, setFromStateId]               = useState(initial?.fromStateId ?? "st-new");
  const [toStateId, setToStateId]                   = useState(initial?.toStateId   ?? "st-ref");
  const [allowedRoles, setAllowedRoles]             = useState<AppRole[]>(initial?.allowedRoles ?? []);
  const [assignToRoles, setAssignToRoles]           = useState<AppRole[]>(initial?.assignToRole ?? []);
  const [autoAssignTeam, setAutoAssignTeam]         = useState(initial?.autoAssignTeam ?? false);
  const [requireUserAssignment, setRequireUserAssignment] = useState(initial?.requireUserAssignment ?? false);
  const [requireEvidence, setRequireEvidence]       = useState(initial?.requireEvidence ?? false);
  const [evidenceTypes, setEvidenceTypes]           = useState<EvidenceType[]>(initial?.evidenceTypes ?? []);
  const [requireComment, setRequireComment]         = useState(initial?.requireComment ?? false);
  const [confirmMove, setConfirmMove]               = useState(initial?.confirmMove ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const toggleRole = (role: AppRole) => {
    setAllowedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const toggleAssignToRole = (role: AppRole) => {
    setAssignToRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const toggleEvidenceType = (type: EvidenceType) => {
    setEvidenceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const handleSave = async () => {
    if (allowedRoles.length === 0) { setError("Debes seleccionar al menos un rol permitido."); return; }
    if (fromStateId === toStateId)  { setError("El estado origen y destino no pueden ser iguales."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        fromStateId, toStateId,
        allowedRoles,
        assignToRole: assignToRoles.length > 0 ? assignToRoles : undefined,
        autoAssignTeam,
        requireUserAssignment,
        requireEvidence,
        evidenceTypes: requireEvidence ? evidenceTypes : [],
        requireComment,
        confirmMove,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar");
      setSaving(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    padding: "6px 10px", borderRadius: 5,
    border: "1px solid #EDEBE9", fontFamily: FONT,
    fontSize: 12, color: "#201F1E", width: "100%",
    boxSizing: "border-box", background: "#FAFAFA",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#605E5C",
    fontFamily: FONT, marginBottom: 4, display: "block",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  const checkStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 12, fontFamily: FONT, color: "#201F1E",
    cursor: "pointer", padding: "4px 0",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, width: "100%", maxWidth: 560,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #EDEBE9",
          display: "flex", alignItems: "center", gap: 10,
          background: "#F8F8F8",
        }}>
          <GitBranch size={18} color="#0078D4" />
          <span style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT, color: "#201F1E", flex: 1 }}>
            {initial ? "Editar transición" : "Nueva transición"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#605E5C" }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", maxHeight: "70vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Estados */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Estado origen</label>
              <select value={fromStateId} onChange={(e) => setFromStateId(e.target.value)} style={fieldStyle}>
                {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Estado destino</label>
              <select value={toStateId} onChange={(e) => setToStateId(e.target.value)} style={fieldStyle}>
                {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Roles permitidos */}
          <div>
            <label style={labelStyle}>Roles permitidos *</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ROLE_OPTIONS.map((role) => {
                const active = allowedRoles.includes(role);
                const c = ROLE_CHIP[role] ?? { bg: "#F3F2F1", text: "#323130" };
                return (
                  <button key={role} onClick={() => toggleRole(role)} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 4,
                    background: active ? c.bg : "#F3F2F1",
                    color: active ? c.text : "#A19F9D",
                    border: active ? `2px solid ${c.text}` : "2px solid transparent",
                    fontWeight: active ? 700 : 400, cursor: "pointer",
                    fontFamily: FONT, transition: "all 120ms",
                  }}>{role}</button>
                );
              })}
            </div>
          </div>

          {/* Asignación */}
          <div>
            <label style={labelStyle}>Asignar a rol <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(puede ser más de uno)</span></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              {ROLE_OPTIONS.map((role) => {
                const active = assignToRoles.includes(role);
                const c = ROLE_CHIP[role] ?? { bg: "#F3F2F1", text: "#323130" };
                return (
                  <button key={role} onClick={() => toggleAssignToRole(role)} style={{
                    fontSize: 11, padding: "4px 10px", borderRadius: 4,
                    background: active ? c.bg : "#F3F2F1",
                    color: active ? c.text : "#A19F9D",
                    border: active ? `2px solid ${c.text}` : "2px solid transparent",
                    fontWeight: active ? 700 : 400, cursor: "pointer",
                    fontFamily: FONT, transition: "all 120ms",
                  }}>{role}</button>
                );
              })}
            </div>
            {assignToRoles.length === 0 && (
              <span style={{ fontSize: 10, color: "#A19F9D", fontFamily: FONT }}>Sin cambio de rol al mover</span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={checkStyle}>
              <input type="checkbox" checked={autoAssignTeam} onChange={(e) => setAutoAssignTeam(e.target.checked)} />
              Auto-asignar team según rol
            </label>
            <label style={checkStyle}>
              <input type="checkbox" checked={requireUserAssignment} onChange={(e) => setRequireUserAssignment(e.target.checked)} />
              Requerir usuario concreto
            </label>
          </div>

          {/* Separador */}
          <div style={{ borderTop: "1px solid #EDEBE9" }} />

          {/* Requisitos de evidencia */}
          <div>
            <label style={labelStyle}>Requisitos del movimiento</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={checkStyle}>
                <input type="checkbox" checked={requireEvidence} onChange={(e) => setRequireEvidence(e.target.checked)} />
                Requerir evidencia
              </label>
              {requireEvidence && (
                <div style={{ marginLeft: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {EVIDENCE_TYPE_OPTIONS.map((t) => (
                    <label key={t} style={{ ...checkStyle, fontSize: 11 }}>
                      <input type="checkbox" checked={evidenceTypes.includes(t)} onChange={() => toggleEvidenceType(t)} />
                      {t}
                    </label>
                  ))}
                </div>
              )}
              <label style={checkStyle}>
                <input type="checkbox" checked={requireComment} onChange={(e) => setRequireComment(e.target.checked)} />
                Requerir comentario (sin evidencia completa)
              </label>
              <label style={checkStyle}>
                <input type="checkbox" checked={confirmMove} onChange={(e) => setConfirmMove(e.target.checked)} />
                Mostrar confirmación antes de mover
              </label>
            </div>
          </div>

          {error && (
            <div style={{
              background: "#FDE7E9", border: "1px solid #F4B8BB",
              borderRadius: 6, padding: "8px 12px",
              fontSize: 12, color: "#A4262C", fontFamily: FONT,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px", borderTop: "1px solid #EDEBE9",
          display: "flex", justifyContent: "flex-end", gap: 8,
          background: "#FAFAFA",
        }}>
          <button onClick={onClose} style={{
            padding: "6px 16px", borderRadius: 5, border: "1px solid #EDEBE9",
            background: "#fff", cursor: "pointer", fontSize: 12, fontFamily: FONT,
            color: "#605E5C", fontWeight: 600,
          }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: "6px 18px", borderRadius: 5, border: "none",
            background: saving ? "#C8C6C4" : "#0078D4", color: "#fff",
            cursor: saving ? "not-allowed" : "pointer", fontSize: 12,
            fontFamily: FONT, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {saving ? <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={13} />}
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Confirm modal genérico ───────────────────────────────
interface ConfirmModalProps {
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title, body, confirmLabel = "Confirmar", confirmColor = "#D13438",
  onConfirm, onClose,
}) => {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1001, padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, width: "100%", maxWidth: 440,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #EDEBE9", display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={18} color={confirmColor} />
          <span style={{ fontSize: 15, fontWeight: 700, fontFamily: FONT, color: "#201F1E" }}>{title}</span>
        </div>
        <div style={{ padding: "16px 20px", fontSize: 13, fontFamily: FONT, color: "#323130", lineHeight: 1.55 }}>
          {body}
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #EDEBE9", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{
            padding: "6px 16px", borderRadius: 5, border: "1px solid #EDEBE9",
            background: "#fff", cursor: "pointer", fontSize: 12, fontFamily: FONT,
          }}>Cancelar</button>
          <button onClick={async () => { setLoading(true); await onConfirm(); }} disabled={loading} style={{
            padding: "6px 18px", borderRadius: 5, border: "none",
            background: loading ? "#C8C6C4" : confirmColor, color: "#fff",
            cursor: loading ? "not-allowed" : "pointer", fontSize: 12,
            fontFamily: FONT, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {loading && <Loader size={13} style={{ animation: "spin 1s linear infinite" }} />}
            {loading ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Error Boundary ───────────────────────────────────────
interface EBState { hasError: boolean; message: string; }
class StateMachineErrorBoundary extends Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(err: unknown): EBState {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.error("[StateMachinePage] render error:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40, textAlign: "center",
          fontFamily: "'Segoe UI', sans-serif", color: "#A4262C",
        }}>
          <AlertTriangle size={32} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            Error al renderizar la Máquina de Estados
          </div>
          <div style={{ fontSize: 12, color: "#605E5C" }}>{this.state.message}</div>
          <button
            onClick={() => this.setState({ hasError: false, message: "" })}
            style={{
              marginTop: 16, padding: "6px 18px", borderRadius: 5,
              border: "none", background: "#0078D4", color: "#fff",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Main page ─────────────────────────────────────────────
const StateMachinePageInner: React.FC = () => {
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [states,      setStates]      = useState<State[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [toasts, setToasts]           = useState<ToastMsg[]>([]);

  const [editingTransition, setEditingTransition] = useState<Transition | null | undefined>(undefined); // undefined=closed, null=new
  const [showRestoreModal, setShowRestoreModal]   = useState(false);
  const [deletingId, setDeletingId]               = useState<string | null>(null);
  const [guardrailsOpen, setGuardrailsOpen]       = useState(true);

  const showToast = useCallback((msg: string, ok = true) => {
    const t = newAdminToast(msg, ok);
    setToasts((prev) => [...prev, t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tr, st] = await Promise.all([getTransitions(), getStates()]);
      setTransitions(tr);
      setStates(st);
    } catch {
      setError("No se pudo cargar la máquina de estados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stateName = useCallback(
    (id: string) => states.find((s) => s.id === id)?.name ?? id,
    [states],
  );

  // ── Guardrails ─────────────────────────────────────────
  const guardrails = useMemo(
    () => analyzeGuardrails(transitions, states),
    [transitions, states],
  );

  const hasErrors   = guardrails.some((g) => g.level === "error");
  const hasWarnings = guardrails.some((g) => g.level === "warning");

  // ── CRUD handlers ─────────────────────────────────────
  const handleSaveTransition = useCallback(async (payload: TransitionPayload) => {
    if (editingTransition === null) {
      const created = await createTransition(payload);
      setTransitions((prev) => [...prev, created]);
      showToast("Transición creada correctamente.");
    } else if (editingTransition) {
      const updated = await updateTransition(editingTransition.id, payload);
      setTransitions((prev) => prev.map((t) => t.id === updated.id ? updated : t));
      showToast("Transición actualizada.");
    }
    setEditingTransition(undefined);
  }, [editingTransition, showToast]);

  const handleDuplicate = useCallback(async (t: Transition) => {
    // Duplicate con from=to para que el user elija otro destino
    setEditingTransition({
      ...t,
      id: "",
      toStateId: t.toStateId,
    });
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    await deleteTransition(deletingId);
    setTransitions((prev) => prev.filter((t) => t.id !== deletingId));
    showToast("Transición eliminada.", true);
    setDeletingId(null);
  }, [deletingId, showToast]);

  const handleRestore = useCallback(async () => {
    const result = await resetTransitionsToDefaults();
    setTransitions(result);
    showToast("Máquina de estados restaurada a configuración enterprise por defecto.", true);
    setShowRestoreModal(false);
  }, [showToast]);

  // ── Table row ─────────────────────────────────────────
  const renderRow = (t: Transition) => (
    <tr key={t.id} style={{
      borderBottom: "1px solid #F3F2F1",
      transition: "background 120ms",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
    >
      {/* From */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <StateBadge stateId={t.fromStateId} stateName={stateName(t.fromStateId)} />
      </td>
      {/* To */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <StateBadge stateId={t.toStateId} stateName={stateName(t.toStateId)} />
      </td>
      {/* Roles */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {t.allowedRoles.map((r) => <RoleChip key={r} role={r} />)}
          {t.allowedRoles.length === 0 && (
            <span style={{ fontSize: 10, color: "#D13438", fontWeight: 700 }}>⚠ Sin roles</span>
          )}
        </div>
      </td>
      {/* AssignTo */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        {t.assignToRole && t.assignToRole.length > 0
          ? <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{t.assignToRole.map((r) => <RoleChip key={r} role={r} />)}</div>
          : <span style={{ color: "#C8C6C4", fontSize: 11 }}>—</span>}
      </td>
      {/* AutoTeam */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle", textAlign: "center" }}>
        <BoolBadge val={t.autoAssignTeam} label="✓ Auto" />
      </td>
      {/* RequireUser */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle", textAlign: "center" }}>
        <BoolBadge val={t.requireUserAssignment} label="✓ User" />
      </td>
      {/* RequireEvidence */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        {t.requireEvidence
          ? <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 10, color: "#7530AF", fontWeight: 700 }}>✓ Evidencia</span>
              {(t.evidenceTypes ?? []).length > 0 && (
                <span style={{ fontSize: 9, color: "#605E5C" }}>
                  {t.evidenceTypes!.join(", ")}
                </span>
              )}
            </div>
          : t.requireComment
          ? <span style={{ fontSize: 10, color: "#835B00", fontWeight: 700 }}>✓ Comentario</span>
          : <span style={{ color: "#C8C6C4", fontSize: 11 }}>—</span>
        }
      </td>
      {/* ConfirmMove */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle", textAlign: "center" }}>
        <BoolBadge val={t.confirmMove} label="✓ Confirm" />
      </td>
      {/* Actions */}
      <td style={{ padding: "8px 10px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", gap: 4 }}>
          <ActionBtn title="Editar" icon={<Edit2 size={13} />} color="#0078D4"
            onClick={() => setEditingTransition(t)} />
          <ActionBtn title="Duplicar" icon={<Copy size={13} />} color="#107C10"
            onClick={() => handleDuplicate(t)} />
          <ActionBtn title="Eliminar" icon={<Trash2 size={13} />} color="#D13438"
            onClick={() => setDeletingId(t.id)} />
        </div>
      </td>
    </tr>
  );

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 28px", fontFamily: FONT, maxWidth: 1200, minHeight: "100%" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: "#EFF6FC", display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <GitBranch size={20} color="#0078D4" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#201F1E", margin: 0, fontFamily: FONT }}>
            Máquina de Estados
          </h1>
          <p style={{ fontSize: 13, color: "#605E5C", margin: "3px 0 0", fontFamily: FONT }}>
            Define qué transiciones de estado están permitidas, quién puede realizarlas y qué requisitos deben cumplirse.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {/* Restaurar por defecto */}
          <button
            onClick={() => setShowRestoreModal(true)}
            title="Restaura la máquina de estados a la configuración baseline enterprise"
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 6,
              border: "1px solid #D13438", background: "#FDE7E9",
              color: "#A4262C", cursor: "pointer", fontSize: 12,
              fontFamily: FONT, fontWeight: 700,
              transition: "background 120ms",
            }}
          >
            <RotateCcw size={14} /> Restaurar por defecto
          </button>
          {/* Nueva transición */}
          <button
            onClick={() => setEditingTransition(null)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 6,
              border: "none", background: "#0078D4",
              color: "#fff", cursor: "pointer", fontSize: 12,
              fontFamily: FONT, fontWeight: 700,
            }}
          >
            <Plus size={14} /> Nueva transición
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "#FDE7E9", border: "1px solid #F4B8BB", borderRadius: 8,
          padding: "12px 16px", fontSize: 13, color: "#A4262C", marginBottom: 16,
          fontFamily: FONT,
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 60, color: "#605E5C", fontSize: 13 }}>
          <Loader size={20} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
          Cargando máquina de estados…
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Guardrails panel */}
          <div style={{
            border: `1px solid ${hasErrors ? "#F4B8BB" : hasWarnings ? "#F7CA5C" : "#D1F0E8"}`,
            borderRadius: 8, marginBottom: 20, overflow: "hidden",
          }}>
            <button
              onClick={() => setGuardrailsOpen((o) => !o)}
              style={{
                width: "100%", padding: "10px 16px",
                background: hasErrors ? "#FDE7E9" : hasWarnings ? "#FFF4CE" : "#EFF8F5",
                border: "none", cursor: "pointer", display: "flex",
                alignItems: "center", gap: 8, fontFamily: FONT,
              }}
            >
              {hasErrors
                ? <AlertTriangle size={15} color="#A4262C" />
                : hasWarnings
                ? <AlertTriangle size={15} color="#835B00" />
                : <CheckCircle2 size={15} color="#107C10" />
              }
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: hasErrors ? "#A4262C" : hasWarnings ? "#835B00" : "#107C10",
                flex: 1, textAlign: "left",
              }}>
                {hasErrors
                  ? `Guardrails: ${guardrails.filter((g) => g.level === "error").length} error(es) encontrado(s)`
                  : hasWarnings
                  ? `Guardrails: ${guardrails.filter((g) => g.level === "warning").length} aviso(s)`
                  : "Guardrails: configuración válida"
                }
              </span>
              {guardrailsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {guardrailsOpen && (
              <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                {guardrails.map((g, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    {g.level === "error"   && <AlertTriangle size={13} color="#A4262C" style={{ flexShrink: 0, marginTop: 1 }} />}
                    {g.level === "warning" && <AlertTriangle size={13} color="#835B00" style={{ flexShrink: 0, marginTop: 1 }} />}
                    {g.level === "info"    && <Info          size={13} color="#0078D4" style={{ flexShrink: 0, marginTop: 1 }} />}
                    <span style={{
                      fontSize: 12, fontFamily: FONT,
                      color: g.level === "error" ? "#A4262C" : g.level === "warning" ? "#835B00" : "#323130",
                    }}>
                      {g.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transitions table */}
          <div style={{
            background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden",
          }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#F8F8F8", borderBottom: "2px solid #EDEBE9" }}>
                    {[
                      "Desde", "Hasta", "Roles permitidos", "Asignar a",
                      "Auto-team", "Req. usuario", "Evidencia / Comentario",
                      "Confirmar", "Acciones",
                    ].map((h) => (
                      <th key={h} style={{
                        padding: "9px 10px", textAlign: "left",
                        fontSize: 11, fontWeight: 700, color: "#605E5C",
                        fontFamily: FONT, textTransform: "uppercase",
                        letterSpacing: "0.05em", whiteSpace: "nowrap",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {transitions.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{
                        padding: "40px 20px", textAlign: "center",
                        fontSize: 13, color: "#A19F9D", fontFamily: FONT,
                      }}>
                        No hay transiciones definidas. Añade una o restaura la configuración por defecto.
                      </td>
                    </tr>
                  )}
                  {transitions.map(renderRow)}
                </tbody>
              </table>
            </div>
            {transitions.length > 0 && (
              <div style={{
                padding: "8px 16px", borderTop: "1px solid #F3F2F1",
                fontSize: 11, color: "#A19F9D", fontFamily: FONT,
              }}>
                {transitions.length} transición{transitions.length !== 1 ? "es" : ""}
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{
            marginTop: 16, padding: "12px 16px",
            background: "#F8F8F8", borderRadius: 8,
            border: "1px solid #EDEBE9",
            display: "flex", gap: 16, flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 11, color: "#605E5C", fontFamily: FONT }}>
              <strong>Auto-team:</strong> Asigna automáticamente el equipo según el nuevo rol.
            </span>
            <span style={{ fontSize: 11, color: "#605E5C", fontFamily: FONT }}>
              <strong>Req. usuario:</strong> Obliga a elegir el responsable concreto antes de confirmar.
            </span>
            <span style={{ fontSize: 11, color: "#605E5C", fontFamily: FONT }}>
              <strong>Confirmar:</strong> Muestra un diálogo de confirmación antes de mover.
            </span>
          </div>
        </>
      )}

      {/* Modals */}
      {editingTransition !== undefined && (
        <TransitionModal
          initial={editingTransition}
          states={states}
          onSave={handleSaveTransition}
          onClose={() => setEditingTransition(undefined)}
        />
      )}

      {deletingId && (
        <ConfirmModal
          title="Eliminar transición"
          body={(() => {
            const t = transitions.find((tr) => tr.id === deletingId);
            return t ? (
              <span>
                ¿Eliminar la transición <strong>{stateName(t.fromStateId)}</strong> → <strong>{stateName(t.toStateId)}</strong>?
                Esta acción es permanente y puede dejar estados inaccesibles.
              </span>
            ) : "¿Eliminar esta transición?";
          })()}
          confirmLabel="Eliminar"
          confirmColor="#D13438"
          onConfirm={handleDelete}
          onClose={() => setDeletingId(null)}
        />
      )}

      {showRestoreModal && (
        <ConfirmModal
          title="Restaurar máquina por defecto"
          body={
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ margin: 0 }}>
                Esta acción <strong>reemplazará todas las transiciones actuales</strong> ({transitions.length}) por la
                configuración baseline enterprise:
              </p>
              <ul style={{ margin: "4px 0 0 16px", fontSize: 12, color: "#605E5C" }}>
                <li>8 transiciones predefinidas con RBAC, asignación de team y requisitos de evidencia</li>
                <li>Se registrará en el auditLog como TRANSITION_RESET_DEFAULTS</li>
              </ul>
              <p style={{ margin: 0, color: "#A4262C", fontWeight: 600 }}>
                ⚠ Esta acción no se puede deshacer.
              </p>
            </div>
          }
          confirmLabel="Restaurar por defecto"
          confirmColor="#D13438"
          onConfirm={handleRestore}
          onClose={() => setShowRestoreModal(false)}
        />
      )}

      <AdminToastContainer toasts={toasts} />
    </div>
  );
};

// ── ActionBtn helper ──────────────────────────────────────
const ActionBtn: React.FC<{
  title: string; icon: React.ReactNode; color: string; onClick: () => void;
}> = ({ title, icon, color, onClick }) => (
  <button
    title={title}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    style={{
      width: 26, height: 26, borderRadius: 4, border: `1px solid ${color}22`,
      background: `${color}12`, color, cursor: "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      transition: "background 120ms",
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${color}28`; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${color}12`; }}
  >
    {icon}
  </button>
);

// ── Export con ErrorBoundary ──────────────────────────────
export const StateMachinePage: React.FC = () => (
  <StateMachineErrorBoundary>
    <StateMachinePageInner />
  </StateMachineErrorBoundary>
);
