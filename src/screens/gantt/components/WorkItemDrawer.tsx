// ─────────────────────────────────────────────────────────
//  src/screens/gantt/components/WorkItemDrawer.tsx
//  Drawer lateral para WorkItem (solo lectura para Épicas).
//
//  Permisos de edición de fechas:
//    Admin/IT AirEuropa → siempre (solo WorkItem)
//    Proveedor          → solo si assignedToRole === "Proveedor"
//    Usuario            → solo lectura
//    Épica              → siempre solo lectura (el proyecto se edita desde el detalle)
// ─────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from "react";
import {
  X, ExternalLink, Clock, AlertTriangle,
  Calendar, User, Tag, ArrowRight, CheckCircle2,
} from "lucide-react";
import type { AppRole, State, Transition } from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";
import type { GanttRowData } from "./GanttSplitView";
import { patchWorkItemDates } from "../../../services/workItemService";
import { ApiError } from "../../../services/apiClient";
import { canActOnWorkItem } from "../../../auth/workItemPermissions";
import { LockBanner } from "../../../components/ui/LockBadge";
import { getStateColor, PRIORITY_COLORS, TYPE_COLORS, ROLE_COLORS } from "../tokens";
import { formatDate } from "../ganttUtils";

// ── Props ─────────────────────────────────────────────────
interface Props {
  row: GanttRowData | null;
  states: State[];
  roles: AppRole[];
  /** Transiciones (para ownership check) */
  transitions?: Transition[];
  /** Usuario efectivo (para ownership check) */
  appUser?: AppUser | null;
  onClose: () => void;
  onSaved: (id: string, startDate: string, endDate: string) => void;
}

// ── Helpers ───────────────────────────────────────────────
const Chip: React.FC<{ label: string; bg: string; color: string }> = ({ label, bg, color }) => (
  <span style={{
    display: "inline-block", padding: "2px 8px", borderRadius: 10,
    background: bg, color, fontSize: 11, fontWeight: 600,
    fontFamily: "'Segoe UI', sans-serif", lineHeight: 1.7,
  }}>{label}</span>
);

const MetaRow: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({
  icon, label, value,
}) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
    <div style={{ color: "#8A8886", flexShrink: 0, marginTop: 1 }}>{icon}</div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 10, color: "#8A8886", fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2,
        fontFamily: "'Segoe UI', sans-serif",
      }}>{label}</div>
      <div style={{ fontSize: 12, color: "#201F1E", fontFamily: "'Segoe UI', sans-serif" }}>
        {value}
      </div>
    </div>
  </div>
);

const DateField: React.FC<{
  label: string; value: string; editable: boolean;
  onChange: (v: string) => void;
}> = ({ label, value, editable, onChange }) => (
  <div style={{ flex: 1 }}>
    <label style={{
      display: "block", fontSize: 10, color: "#8A8886", fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4,
      fontFamily: "'Segoe UI', sans-serif",
    }}>{label}</label>
    {editable ? (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box",
          fontFamily: "'Segoe UI', sans-serif", fontSize: 12, color: "#201F1E",
          border: "1px solid #EDEBE9", borderRadius: 4, padding: "5px 8px",
          background: "#fff", outline: "none",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#0078D4")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#EDEBE9")}
      />
    ) : (
      <div style={{
        fontSize: 12, color: "#201F1E", fontFamily: "'Segoe UI', sans-serif",
        padding: "5px 8px", background: "#FAF9F8", borderRadius: 4,
        border: "1px solid #EDEBE9",
      }}>{formatDate(value) || "–"}</div>
    )}
  </div>
);

// ── WorkItemDrawer ────────────────────────────────────────
export const WorkItemDrawer: React.FC<Props> = ({ row, states, roles, transitions = [], appUser, onClose, onSaved }) => {
  const drawerRef  = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [saveOk,    setSaveOk]    = useState(false);
  const [saveErr,   setSaveErr]   = useState<string | null>(null);

  // Inicializar fechas cuando cambia el row
  useEffect(() => {
    if (row) {
      setStartDate(row.startDate ?? "");
      setEndDate(row.endDate ?? "");
      setSaveOk(false);
      setSaveErr(null);
    }
  }, [row?.id]);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!row) return null;

  // ── RBAC edición de fechas + ownership ────────────────────
  const isAdminOrIT = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const isProveedor = roles.includes("Proveedor") && !isAdminOrIT;

  // Construir un WorkItem mínimo desde GanttRowData para el check de ownership
  const rowAsWI = row && row.type === "workitem" ? {
    id: row.id,
    assignedToUserId: row.assignedToUserId ?? "",
    assignedToTeamId: row.assignedToTeamId ?? null,
    assignedToRole:   row.assignedToRole as AppRole,
    stateId:          row.stateId,
  } as import("../../../types/domain").WorkItem : null;

  const ownershipOk = rowAsWI
    ? canActOnWorkItem(appUser ?? null, rowAsWI, roles, transitions).can
    : false;

  const canEdit =
    row?.type === "workitem" && // Épicas: solo lectura
    (isAdminOrIT || (isProveedor && row.assignedToRole === "Proveedor")) &&
    ownershipOk;

  const hasChanges = canEdit && (startDate !== row.startDate || endDate !== row.endDate);

  // ── Guardar fechas ────────────────────────────────────
  const handleSave = async () => {
    if (!hasChanges || saving) return;
    if (startDate > endDate) { setSaveErr("La fecha de inicio no puede ser posterior a la de fin."); return; }

    setSaving(true);
    setSaveErr(null);
    try {
      await patchWorkItemDates(row.id, startDate, endDate);
      setSaveOk(true);
      onSaved(row.id, startDate, endDate);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (e) {
      setSaveErr(e instanceof ApiError ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const stateName  = states.find((s) => s.id === row.stateId)?.name ?? row.stateId;
  const sc  = getStateColor(row.stateId);
  const pc  = PRIORITY_COLORS[row.priority ?? ""] ?? { bg: "#F3F2F1", text: "#605E5C" };
  const tc  = TYPE_COLORS[row.wiType ?? ""] ?? { bg: "#F3F2F1", text: "#605E5C" };
  const rc  = ROLE_COLORS[row.assignedToRole] ?? { bg: "#F3F2F1", text: "#605E5C" };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
          zIndex: 1000, backdropFilter: "blur(1px)",
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: 460, zIndex: 1001, background: "#fff",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.16)",
          display: "flex", flexDirection: "column",
          animation: "slideIn 180ms ease-out",
          fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        <style>{`
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}</style>

        {/* ── Encabezado ── */}
        <div style={{
          padding: "16px 20px 12px", borderBottom: "1px solid #EDEBE9",
          background: "#FAFAFA", display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              {row.type === "workitem" && row.wiType && (
                <Chip label={row.wiType} bg={tc.bg} color={tc.text} />
              )}
              {row.type === "epic" && (
                <Chip label="Épica" bg="#F3EFF7" color="#7530AF" />
              )}
              <Chip label={stateName} bg={sc.bg} color={sc.text} />
              {row.priority && <Chip label={row.priority} bg={pc.bg} color={pc.text} />}
            </div>
            <h2 style={{
              margin: 0, fontSize: 15, fontWeight: 700, color: "#201F1E",
              lineHeight: 1.3,
            }}>{row.title}</h2>
            <div style={{ fontSize: 11, color: "#8A8886", marginTop: 4 }}>
              {row.projectCode}
              {row.type === "epic" && " · Épica"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: "none", background: "transparent", cursor: "pointer",
              padding: 4, borderRadius: 4, color: "#605E5C",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Contenido scrollable ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>

          {/* Progreso (solo WI) */}
          {row.type === "workitem" && row.progress != null && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 11, color: "#605E5C" }}>
                <span>Progreso</span>
                <span style={{ fontWeight: 700, color: sc.text }}>{row.progress}%</span>
              </div>
              <div style={{ height: 8, background: "#EDEBE9", borderRadius: 4, overflow: "hidden" }}>
                <div style={{
                  width: `${Math.min(row.progress, 100)}%`, height: "100%",
                  background: sc.barProgress, borderRadius: 4,
                  transition: "width 400ms ease",
                }} />
              </div>
            </div>
          )}

          {/* Bloqueado */}
          {row.blockedReason && (
            <div style={{
              background: "#FDE7E9", borderRadius: 6, border: "1px solid #F4B8BB",
              padding: "10px 12px", marginBottom: 14, display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <AlertTriangle size={14} color="#A4262C" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#A4262C", marginBottom: 2 }}>Bloqueado</div>
                <div style={{ fontSize: 12, color: "#A4262C" }}>{row.blockedReason}</div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <MetaRow
            icon={<User size={13} />}
            label="Asignado a"
            value={<Chip label={row.assignedToRole} bg={rc.bg} color={rc.text} />}
          />

          {/* Fechas (editables o readonly) */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <Calendar size={13} color="#8A8886" />
              <span style={{
                fontSize: 10, color: "#8A8886", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.05em",
              }}>Planificación</span>
              {canEdit && (
                <span style={{ fontSize: 9, color: "#0078D4", fontWeight: 600, background: "#EFF6FC",
                  padding: "1px 6px", borderRadius: 8 }}>
                  Editable
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <DateField
                label="Inicio"
                value={startDate}
                editable={canEdit}
                onChange={setStartDate}
              />
              <ArrowRight size={14} color="#EDEBE9" style={{ flexShrink: 0, marginTop: 22 }} />
              <DateField
                label="Fin"
                value={endDate}
                editable={canEdit}
                onChange={setEndDate}
              />
            </div>
          </div>

          {/* Duración calculada */}
          {startDate && endDate && (
            <MetaRow
              icon={<Clock size={13} />}
              label="Duración"
              value={(() => {
                const d1 = new Date(startDate + "T00:00:00");
                const d2 = new Date(endDate   + "T00:00:00");
                const days = Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
                return `${days} ${days === 1 ? "día" : "días"}`;
              })()}
            />
          )}

          {/* Tags (solo WI) */}
          {row.type === "workitem" && (
            <MetaRow
              icon={<Tag size={13} />}
              label="Etiquetas"
              value={
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {/* No tenemos tags en GanttRowData — placeholder */}
                  <span style={{ fontSize: 11, color: "#A19F9D" }}>–</span>
                </div>
              }
            />
          )}

          {/* Nota sobre SubTask */}
          {false && (
            <div style={{
              background: "#F3EFF7", borderRadius: 6, border: "1px solid #D4C2EC",
              padding: "8px 12px", marginTop: 12, fontSize: 11, color: "#7530AF",
            }}>
              SubTask vinculada a un WorkItem. Edición de fechas disponible en v2.
            </div>
          )}

          {/* Separador */}
          <div style={{ borderTop: "1px solid #EDEBE9", marginTop: 16, paddingTop: 12 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#A19F9D", fontStyle: "italic" }}>
              🔌 Próximamente: Comentarios · Evidencias · Historial de estados
            </p>
          </div>
        </div>

        {/* ── Footer con acciones ── */}
        <div style={{
          padding: "12px 20px", borderTop: "1px solid #EDEBE9",
          background: "#FAFAFA", display: "flex", gap: 8, alignItems: "center",
        }}>
          {/* Guardar fechas */}
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              style={{
                flex: 1, padding: "8px 16px", borderRadius: 4, border: "none",
                background: hasChanges && !saving ? "#0078D4" : "#C8C6C4",
                color: "#fff", fontSize: 13, fontWeight: 600, cursor: hasChanges && !saving ? "pointer" : "not-allowed",
                fontFamily: "'Segoe UI', sans-serif", transition: "background 150ms",
              }}
            >
              {saving ? "Guardando..." : saveOk ? "✓ Guardado" : "Guardar fechas"}
            </button>
          )}

          {/* Bloqueo por ownership: tiene rol pero no es el responsable */}
          {!canEdit && row.type === "workitem" &&
            (isAdminOrIT || (isProveedor && row.assignedToRole === "Proveedor")) &&
            !ownershipOk && (
            <div style={{ flex: 1 }}>
              <LockBanner message="No tienes permisos para editar las fechas de esta tarea" />
            </div>
          )}

          {/* Ir a Kanban */}
          <a
            href={`/kanban`}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "8px 12px", borderRadius: 4,
              border: "1px solid #EDEBE9", background: "#fff",
              color: "#0078D4", fontSize: 12, fontWeight: 500,
              textDecoration: "none", fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            <ExternalLink size={12} /> Kanban
          </a>

          <button
            onClick={onClose}
            style={{
              padding: "8px 14px", borderRadius: 4,
              border: "1px solid #EDEBE9", background: "#fff",
              color: "#605E5C", fontSize: 12, cursor: "pointer",
              fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            Cerrar
          </button>
        </div>

        {/* Mensajes de estado */}
        {saveOk && (
          <div style={{
            position: "absolute", bottom: 68, left: 20, right: 20,
            background: "#DFF6DD", border: "1px solid #9EE59E", borderRadius: 6,
            padding: "8px 12px", display: "flex", gap: 8, alignItems: "center",
            animation: "fadeIn 200ms ease",
          }}>
            <CheckCircle2 size={14} color="#107C10" />
            <span style={{ fontSize: 12, color: "#107C10", fontFamily: "'Segoe UI', sans-serif" }}>
              Fechas actualizadas correctamente.
            </span>
          </div>
        )}
        {saveErr && (
          <div style={{
            position: "absolute", bottom: 68, left: 20, right: 20,
            background: "#FDE7E9", border: "1px solid #F4B8BB", borderRadius: 6,
            padding: "8px 12px", display: "flex", gap: 8, alignItems: "center",
          }}>
            <AlertTriangle size={14} color="#A4262C" />
            <span style={{ fontSize: 12, color: "#A4262C", fontFamily: "'Segoe UI', sans-serif" }}>
              {saveErr}
            </span>
          </div>
        )}
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    </>
  );
};
