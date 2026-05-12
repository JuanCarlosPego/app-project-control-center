// ─────────────────────────────────────────────────────────
//  src/screens/backlog/components/BacklogTable.tsx
//  Tabla de WorkItems con:
//  - Columna "Fase" (Backlog / Ejecución / Cerrado)
//  - Acción "▶ Enviar a Kanban" para IT/Admin en ítems de backlog
//  - Acción "Ver en Kanban" para ítems en ejecución
//  - Columna Asignado (User + Team + Role)
//  - Sync status
// ─────────────────────────────────────────────────────────

import React, { useRef, useState } from "react";
import {
  GripVertical, ExternalLink, ChevronDown, ChevronRight,
  Edit3, PlayCircle, Eye, AlertTriangle, Clock, RefreshCw,
} from "lucide-react";
import type { WorkItem, Project, State, AppRole, Transition } from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";
import { canActOnWorkItem } from "../../../auth/workItemPermissions";
import { LockBadge } from "../../../components/ui/LockBadge";

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
const PRI_COLOR: Record<string, string> = {
  Alta: "#D13438", Media: "#CA8B00", Baja: "#107C10",
};
const PRI_BG: Record<string, string> = {
  Alta: "#FDE7E9", Media: "#FFF4CE", Baja: "#E8F5E9",
};
const TYPE_ICON: Record<string, string> = {
  Feature: "✦", Bug: "⬤", TechDebt: "⚙", Spike: "◆",
};
const TYPE_COLOR: Record<string, string> = {
  Feature: "#0078D4", Bug: "#D13438", TechDebt: "#8A8886", Spike: "#7530AF",
};

/** Determina la fase de un WorkItem según su stateId */
const BACKLOG_IDS   = new Set(["st-new", "st-ref"]);
const EXECUTION_IDS = new Set(["st-prog", "st-blk", "st-rft", "st-test", "st-acc"]);

function getPhase(stateId: string): { label: string; color: string; bg: string } {
  if (BACKLOG_IDS.has(stateId))   return { label: "Backlog",     color: "#0078D4", bg: "#EFF6FC" };
  if (EXECUTION_IDS.has(stateId)) return { label: "Ejecución",   color: "#107C10", bg: "#E7F7E7" };
  return                                   { label: "Cerrado",    color: "#8A8886", bg: "#F3F2F1" };
}

function fmtDate(d?: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function isNear(endDate?: string) {
  if (!endDate) return false;
  const diff = (new Date(endDate).getTime() - Date.now()) / 86_400_000;
  return diff >= 0 && diff <= 14;
}

function isOverdue(endDate?: string) {
  if (!endDate) return false;
  return new Date(endDate).getTime() < Date.now();
}

const StateChip: React.FC<{ stateId: string; name: string }> = ({ stateId, name }) => (
  <span style={{
    display: "inline-block", padding: "2px 8px", borderRadius: 10,
    background: STATE_BG[stateId] ?? "#F3F2F1",
    color: STATE_TXT[stateId] ?? "#605E5C",
    fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
    fontFamily: "'Segoe UI', sans-serif", lineHeight: 1.6,
  }}>{name}</span>
);

const PriChip: React.FC<{ priority: string }> = ({ priority }) => (
  <span style={{
    display: "inline-block", padding: "2px 7px", borderRadius: 10,
    background: PRI_BG[priority] ?? "#F3F2F1",
    color: PRI_COLOR[priority] ?? "#605E5C",
    fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
    fontFamily: "'Segoe UI', sans-serif",
  }}>{priority}</span>
);

// ── Props ─────────────────────────────────────────────────
interface Props {
  items: WorkItem[];
  projects: Project[];
  states: State[];
  roles: AppRole[];
  appUser?: AppUser | null;
  transitions?: Transition[];
  /** id → displayName de usuarios (para columna Asignado) */
  userMap?: Record<string, string>;
  view: "flat" | "grouped";
  /** Admin/IT AirEuropa: bypass de ownership */
  isBypass?: boolean;
  /** IDs de ítems cuya transición a Kanban está en curso */
  sendingToKanban?: Set<string>;
  /** ID del ítem a resaltar temporalmente (deep-link desde Home) */
  highlightedWiId?: string | null;
  onSelect: (wi: WorkItem) => void;
  onReorder: (reordered: WorkItem[]) => void;
  /** Solo IT/Admin pueden llamar esto */
  onSendToKanban: (wi: WorkItem) => void;
  /** Navegar a Kanban con el ítem destacado */
  onViewInKanban: (wi: WorkItem) => void;
}

// ── Columnas de la tabla ──────────────────────────────────
const COLS = [
  { key: "drag",    label: "",             width: 24  },
  { key: "type",    label: "Tipo",         width: 38  },
  { key: "code",    label: "Código",       width: 92  },
  { key: "title",   label: "Título",       width: 0   }, // flex
  { key: "fase",    label: "Fase",         width: 88  },
  { key: "state",   label: "Estado",       width: 118 },
  { key: "pri",     label: "Pri.",         width: 70  },
  { key: "assigned",label: "Asignado",     width: 140 },
  { key: "end",     label: "Fecha fin",    width: 82  },
  { key: "sync",    label: "Sync",         width: 52  },
  { key: "actions", label: "",             width: 88  },
];

const TH_STYLE: React.CSSProperties = {
  padding: "8px 6px", textAlign: "left", fontSize: 10,
  fontWeight: 700, color: "#8A8886", letterSpacing: "0.06em",
  textTransform: "uppercase", whiteSpace: "nowrap",
  fontFamily: "'Segoe UI', sans-serif", borderBottom: "2px solid #EDEBE9",
  userSelect: "none",
};

// ── Fila de WorkItem ──────────────────────────────────────
interface RowProps {
  wi: WorkItem;
  stateName: string;
  assignedUserName?: string;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onClick: () => void;
  /** Solo IT/Admin */
  onSendToKanban: () => void;
  canSendToKanban: boolean;
  isSendingToKanban: boolean;
  onViewInKanban: () => void;
  /** Razón de bloqueo (RBAC/ownership) — undefined = no bloqueado */
  lockReason?: string;
  /** Resaltar fila (deep-link desde Home) */
  isHighlighted?: boolean;
}

const SYNC_DOT: Record<string, { color: string; label: string }> = {
  OK:      { color: "#107C10", label: "OK" },
  Pending: { color: "#CA8B00", label: "Pend." },
  Error:   { color: "#D13438", label: "Error" },
};

const WorkItemRow: React.FC<RowProps> = ({
  wi, stateName, assignedUserName,
  isDragging, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd,
  onClick, onSendToKanban, canSendToKanban, isSendingToKanban,
  onViewInKanban, lockReason, isHighlighted,
}) => {
  const [hovered, setHovered] = useState(false);
  const rowRef = useRef<HTMLTableRowElement>(null);

  React.useEffect(() => {
    if (!isHighlighted) return;
    rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isHighlighted]);

  const near = isNear(wi.endDate);
  const overdue = isOverdue(wi.endDate) && wi.stateId !== "st-cls";
  const phase = getPhase(wi.stateId);
  const isExecution = EXECUTION_IDS.has(wi.stateId);
  const isBacklogState = BACKLOG_IDS.has(wi.stateId);
  const sync = SYNC_DOT[wi.syncStatus ?? "OK"] ?? SYNC_DOT.OK;

  const code = wi.jiraIssueKey || wi.id.replace("wi-", "WI-").toUpperCase().slice(0, 12);

  return (
    <tr
      ref={rowRef}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isHighlighted ? "#FFFBF0" : isDragging ? "#EFF6FC" : isDragOver ? "#DEEDFB" : hovered ? "#FAF9F8" : "#fff",
        opacity: isDragging ? 0.6 : 1,
        borderBottom: isDragOver ? "2px solid #0078D4" : isHighlighted ? "2px solid #C17D00" : "1px solid #F3F2F1",
        outline: isHighlighted ? "2px solid #C17D0044" : "none",
        cursor: "grab", transition: "background 100ms",
      }}
    >
      {/* Grip */}
      <td style={{ width: 24, padding: "0 4px", color: "#C8C6C4", textAlign: "center", verticalAlign: "middle" }}>
        <GripVertical size={12} />
      </td>

      {/* Tipo */}
      <td style={{ width: 38, padding: "8px 4px", textAlign: "center", verticalAlign: "middle" }}>
        <span title={wi.type} style={{ fontSize: 12, color: TYPE_COLOR[wi.type] ?? "#8A8886" }}>
          {TYPE_ICON[wi.type] ?? "·"}
        </span>
      </td>

      {/* Código */}
      <td style={{ width: 92, padding: "8px 5px", verticalAlign: "middle" }}>
        {wi.jiraUrl ? (
          <a href={wi.jiraUrl} target="_blank" rel="noopener noreferrer" style={{
            fontSize: 10, color: "#0078D4", textDecoration: "none",
            fontFamily: "monospace",
          }}>
            {code}
          </a>
        ) : (
          <code style={{ fontSize: 10, color: "#8A8886" }}>{code}</code>
        )}
      </td>

      {/* Título */}
      <td style={{ padding: "8px 6px", verticalAlign: "middle" }} onClick={onClick}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {wi.stateId === "st-blk" && <AlertTriangle size={11} color="#D13438" style={{ flexShrink: 0 }} />}
          <span style={{
            fontSize: 12, fontWeight: 500, color: "#201F1E",
            cursor: "pointer", textDecoration: hovered ? "underline" : "none",
            fontFamily: "'Segoe UI', sans-serif",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            maxWidth: 260,
          }} title={wi.title}>
            {wi.title}
          </span>
        </div>
        {wi.blockedReason && (
          <div style={{ fontSize: 10, color: "#D13438", marginTop: 1, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {wi.blockedReason}
          </div>
        )}
      </td>

      {/* Fase */}
      <td style={{ width: 88, padding: "8px 5px", verticalAlign: "middle" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 8px", borderRadius: 10,
          background: phase.bg, color: phase.color,
          fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: phase.color, flexShrink: 0 }} />
          {phase.label}
        </span>
      </td>

      {/* Estado */}
      <td style={{ width: 118, padding: "8px 5px", verticalAlign: "middle" }}>
        <StateChip stateId={wi.stateId} name={stateName} />
      </td>

      {/* Prioridad */}
      <td style={{ width: 70, padding: "8px 5px", verticalAlign: "middle" }}>
        <PriChip priority={wi.priority} />
      </td>

      {/* Asignado: User + Team + Role */}
      <td style={{ width: 140, padding: "8px 5px", verticalAlign: "middle" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {assignedUserName && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#201F1E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
              {assignedUserName}
            </span>
          )}
          <span style={{ fontSize: 10, color: "#8A8886", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>
            {wi.assignedToRole ?? "—"}
          </span>
        </div>
      </td>

      {/* Fecha fin */}
      <td style={{ width: 82, padding: "8px 5px", verticalAlign: "middle" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 11, color: overdue ? "#D13438" : near ? "#CA8B00" : "#605E5C",
          fontWeight: (near || overdue) ? 600 : 400,
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          {(near || overdue) && <Clock size={10} />}
          {fmtDate(wi.endDate)}
        </span>
      </td>

      {/* Sync status */}
      <td style={{ width: 52, padding: "8px 4px", textAlign: "center", verticalAlign: "middle" }}>
        <span title={`Sync: ${wi.syncStatus ?? "OK"}`} style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          fontSize: 10, color: sync.color, fontWeight: 600,
        }}>
          {wi.syncStatus === "Pending" && <RefreshCw size={9} style={{ animation: "spin 1.5s linear infinite" }} />}
          {sync.label}
        </span>
      </td>

      {/* Acciones */}
      <td style={{ width: 88, padding: "8px 4px", verticalAlign: "middle" }}>
        <div style={{
          display: "flex", gap: 2, alignItems: "center",
          opacity: hovered ? 1 : 0, transition: "opacity 150ms",
        }}>
          {/* Candado de ownership */}
          {lockReason && <LockBadge size={12} tooltip={lockReason} style={{ marginRight: 2 }} />}

          {/* ▶ Enviar a Kanban (solo IT/Admin, solo si está en Backlog) */}
          {canSendToKanban && isBacklogState && (
            <ActionBtn
              title="Enviar a Kanban"
              onClick={(e) => { e.stopPropagation(); onSendToKanban(); }}
              disabled={isSendingToKanban}
              color="#107C10"
            >
              {isSendingToKanban
                ? <RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} />
                : <PlayCircle size={11} />}
            </ActionBtn>
          )}

          {/* 👁 Ver en Kanban (si está en ejecución) */}
          {isExecution && (
            <ActionBtn
              title="Ver en Kanban"
              onClick={(e) => { e.stopPropagation(); onViewInKanban(); }}
              color="#7530AF"
            >
              <Eye size={11} />
            </ActionBtn>
          )}

          {/* Ver en Jira */}
          {wi.jiraUrl && (
            <ActionBtn
              title="Ver en Jira"
              onClick={(e) => { e.stopPropagation(); window.open(wi.jiraUrl, "_blank", "noopener"); }}
            >
              <ExternalLink size={11} />
            </ActionBtn>
          )}

          {/* Abrir drawer */}
          <ActionBtn
            title="Abrir detalle"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            <Edit3 size={11} />
          </ActionBtn>
        </div>
      </td>
    </tr>
  );
};

const ActionBtn: React.FC<{
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  color?: string;
  disabled?: boolean;
}> = ({ title, onClick, children, color, disabled }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title} onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 24, height: 24, borderRadius: 4,
        border: "none", background: hov ? "#EFF6FC" : "transparent",
        color: disabled ? "#C8C6C4" : hov ? (color ?? "#0078D4") : "#8A8886",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 120ms",
      }}
    >
      {children}
    </button>
  );
};

// ── Cabecera de grupo (vista agrupada) ────────────────────
const GroupHeader: React.FC<{
  project: Project; count: number; open: boolean; onToggle: () => void;
}> = ({ project, count, open, onToggle }) => (
  <tr>
    <td colSpan={COLS.length} style={{
      padding: "10px 12px", background: "#F3F2F1",
      borderTop: "2px solid #EDEBE9", borderBottom: "1px solid #E1DFDD",
    }}>
      <div
        role="button" tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter") onToggle(); }}
        style={{
          display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
          fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        {open
          ? <ChevronDown size={14} color="#605E5C" />
          : <ChevronRight size={14} color="#605E5C" />}
        <code style={{ fontSize: 10, color: "#8A8886" }}>{project.code}</code>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#201F1E" }}>{project.name}</span>
        <span style={{
          marginLeft: 4, fontSize: 10, fontWeight: 600,
          background: "#fff", border: "1px solid #EDEBE9",
          padding: "1px 8px", borderRadius: 10, color: "#605E5C",
        }}>{count} tareas</span>
      </div>
    </td>
  </tr>
);

// ── Empty State ───────────────────────────────────────────
const EmptyRow: React.FC = () => (
  <tr>
    <td colSpan={COLS.length}>
      <div style={{
        padding: "48px 24px", textAlign: "center",
        fontFamily: "'Segoe UI', sans-serif",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
      }}>
        <div style={{ fontSize: 32 }}>📋</div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#323130" }}>
          No hay tareas que mostrar
        </p>
        <p style={{ margin: 0, fontSize: 12, color: "#8A8886" }}>
          Ajusta los filtros o cambia la fase seleccionada.
        </p>
      </div>
    </td>
  </tr>
);

// ── BacklogTable ──────────────────────────────────────────
export const BacklogTable: React.FC<Props> = ({
  items, projects, states, roles, view, appUser, transitions = [],
  userMap = {}, isBypass = false, sendingToKanban = new Set(),
  highlightedWiId,
  onSelect, onReorder, onSendToKanban, onViewInKanban,
}) => {
  // ── Ownership por item: id → razón de bloqueo ─────────────
  const lockedItems = React.useMemo(() => {
    if (!appUser || !transitions.length) return new Map<string, string>();
    const map = new Map<string, string>();
    items.forEach((wi) => {
      const { can, reason } = canActOnWorkItem(appUser, wi, roles, transitions);
      if (!can) map.set(wi.id, reason);
    });
    return map;
  }, [items, appUser, roles, transitions]);

  // ── Drag & drop ───────────────────────────────────────
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleDragStart = (idx: number, id: string) => (e: React.DragEvent) => {
    dragIdx.current = idx;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIdx(idx);
  };
  const handleDrop = (dropIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) return;
    const newItems = [...items];
    const [moved] = newItems.splice(fromIdx, 1);
    newItems.splice(dropIdx, 0, moved);
    onReorder(newItems);
    dragIdx.current = null;
    setDragOverIdx(null);
    setDraggingId(null);
  };
  const handleDragEnd = () => {
    dragIdx.current = null;
    setDragOverIdx(null);
    setDraggingId(null);
  };

  const getStateName = (sid: string) => states.find((s) => s.id === sid)?.name ?? sid;

  // ── Grupos ────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleGroup = (pid: string) =>
    setCollapsed((c) => ({ ...c, [pid]: !c[pid] }));

  const getProject = (pid: string) => projects.find((p) => p.id === pid);

  // ── Filas a renderizar ────────────────────────────────
  const renderRows = () => {
    if (items.length === 0) return <EmptyRow />;

    const makeRow = (wi: WorkItem, idx: number) => (
      <WorkItemRow
        key={wi.id}
        wi={wi}
        stateName={getStateName(wi.stateId)}
        assignedUserName={wi.assignedToUserId ? userMap[wi.assignedToUserId] : undefined}
        isDragging={draggingId === wi.id}
        isDragOver={dragOverIdx === idx}
        onDragStart={handleDragStart(idx, wi.id)}
        onDragOver={handleDragOver(idx)}
        onDrop={handleDrop(idx)}
        onDragEnd={handleDragEnd}
        onClick={() => onSelect(wi)}
        onSendToKanban={() => onSendToKanban(wi)}
        canSendToKanban={isBypass}
        isSendingToKanban={sendingToKanban.has(wi.id)}
        onViewInKanban={() => onViewInKanban(wi)}
        lockReason={lockedItems.get(wi.id)}
        isHighlighted={!!highlightedWiId && wi.id === highlightedWiId}
      />
    );

    if (view === "flat") {
      return items.map((wi, idx) => makeRow(wi, idx));
    }

    // Vista agrupada
    const groups = new Map<string, WorkItem[]>();
    items.forEach((wi) => {
      if (!groups.has(wi.projectId)) groups.set(wi.projectId, []);
      groups.get(wi.projectId)!.push(wi);
    });

    const rows: React.ReactNode[] = [];
    let flatIdx = 0;
    groups.forEach((groupItems, projectId) => {
      const proj = getProject(projectId);
      const isOpen = !collapsed[projectId];
      rows.push(
        <GroupHeader
          key={`g-${projectId}`}
          project={proj ?? {
            id: projectId, code: "", name: projectId, businessAreaId: "",
            deliveryOwnerType: "IT", providerId: "", providerTeamId: null,
            status: "En curso",
            category: "", priority: "Media", startDate: "", endDate: "",
            progress: 0,
          }}
          count={groupItems.length}
          open={isOpen}
          onToggle={() => toggleGroup(projectId)}
        />,
      );
      if (isOpen) {
        groupItems.forEach((wi) => {
          rows.push(makeRow(wi, flatIdx++));
        });
      } else {
        flatIdx += groupItems.length;
      }
    });
    return rows;
  };

  return (
    <div style={{
      background: "#fff", border: "1px solid #EDEBE9", borderRadius: 8,
      overflow: "hidden",
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%", borderCollapse: "collapse",
          fontFamily: "'Segoe UI', sans-serif", tableLayout: "fixed",
          minWidth: 920,
        }}>
          <colgroup>
            {COLS.map((c) => (
              <col key={c.key} style={{ width: c.width === 0 ? "auto" : c.width }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ background: "#FAFAFA" }}>
              {COLS.map((c) => (
                <th key={c.key} style={TH_STYLE}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {renderRows()}
          </tbody>
        </table>
      </div>
    </div>
  );
};
