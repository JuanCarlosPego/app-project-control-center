// ─────────────────────────────────────────────────────────────────
//  src/screens/dashboard/components/MyBandejasPanel.tsx
//  Panel "Mis bandejas" con dos tabs operativos:
//    → Tab "Asignadas a mí"        (getMyAssignments)
//    → Tab "Esperando a terceros"  (getWaitingOnOthers)
//
//  Cada fila: título, chip estado, endDate warning,
//             assignedToRole, assignedToUser name, CTA "Abrir"
//  CTA navega a /kanban?scope=mine|waiting o abre WorkItemMiniDrawer
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserCheck,
  Hourglass,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import type { WorkItem, Project, State } from "../../../types/domain";
import { WorkItemMiniDrawer } from "./WorkItemMiniDrawer";
import { getMyAssignments, getWaitingOnOthers } from "../workSelectors";

// ── Design tokens ────────────────────────────────────────────────
const C = {
  primary:    "#0078D4",
  border:     "#EDEBE9",
  bg:         "#F8F9FB",
  text:       "#1B2A3E",
  textMid:    "#605E5C",
  textMuted:  "#8A8886",
  danger:     "#D83B01",
  warning:    "#C8A600",
  success:    "#107C10",
  warnBg:     "#FDF6E3",
  dangerBg:   "#FDF3F0",
};

const STATE_CATEGORY_COLOR: Record<string, string> = {
  "Pendiente": "#8A8886",
  "En curso":  "#0078D4",
  "Bloqueado": "#D83B01",
  "Cerrado":   "#107C10",
};

const ROLE_CHIP: Record<string, { bg: string; text: string }> = {
  "IT AirEuropa": { bg: "#EFF6FF", text: "#1D4ED8" },
  "Proveedor":    { bg: "#D1FAE5", text: "#065F46" },
  "Usuario":      { bg: "#FEF3C7", text: "#92400E" },
  "Admin":        { bg: "#EDE9FE", text: "#5B21B6" },
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// ── Props ─────────────────────────────────────────────────────────
interface Props {
  allWorkItems:   WorkItem[];
  projects:       Project[];
  states:         State[];
  currentUserId:  string;
  /** Mapa userId → displayName para mostrar el asignado */
  userDisplayMap: Record<string, string>;
}

// ── WorkItem row ─────────────────────────────────────────────────
interface RowProps {
  wi:             WorkItem;
  projectMap:     Record<string, Project>;
  stateMap:       Record<string, State>;
  userDisplayMap: Record<string, string>;
  onOpen:         (wi: WorkItem) => void;
  showAssignedTo: boolean;  // false en "Asignadas a mí" (ya soy yo), true en "Esperando"
}

const WorkItemRow: React.FC<RowProps> = ({
  wi, projectMap, stateMap, userDisplayMap, onOpen, showAssignedTo,
}) => {
  const proj    = projectMap[wi.projectId];
  const st      = stateMap[wi.stateId];
  const stCat   = st?.category ?? "Pendiente";
  const days    = daysUntil(wi.endDate);
  const overdue = days < 0;
  const almostDue = days >= 0 && days <= 7;
  const roleChip  = ROLE_CHIP[wi.assignedToRole] ?? { bg: "#F3F2F1", text: "#323130" };
  const assignedName = userDisplayMap[wi.assignedToUserId] ?? null;

  return (
    <div
      style={{
        padding: "10px 14px",
        borderBottom: `1px solid ${C.border}`,
        borderLeft: `3px solid ${
          wi.stateId === "st-blk" ? C.danger
          : overdue              ? C.danger
          : almostDue            ? C.warning
          : C.border
        }`,
        background: overdue ? "#FFFAF9" : "transparent",
      }}
    >
      {/* Fila superior: código + estado chip */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
        {proj && (
          <span style={{
            fontSize: 10, color: C.textMuted,
            fontFamily: "monospace", fontWeight: 600,
          }}>
            {proj.code}
          </span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 700,
          padding: "0 6px", borderRadius: 10,
          background: `${STATE_CATEGORY_COLOR[stCat]}22`,
          color: STATE_CATEGORY_COLOR[stCat] ?? C.textMuted,
        }}>
          {st?.name ?? wi.stateId}
        </span>
        {wi.stateId === "st-blk" && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: "0 6px", borderRadius: 10,
            background: "#FDF3F0", color: C.danger,
            display: "flex", alignItems: "center", gap: 3,
          }}>
            <AlertTriangle size={9} /> Bloqueado
          </span>
        )}
      </div>

      {/* Título */}
      <p style={{
        margin: "0 0 5px", fontSize: 12, fontWeight: 600, color: C.text,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {wi.title}
      </p>

      {/* Metadatos */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Fecha */}
        <span style={{
          fontSize: 10,
          color: overdue ? C.danger : almostDue ? C.warning : C.textMuted,
          fontWeight: (overdue || almostDue) ? 700 : 400,
          display: "flex", alignItems: "center", gap: 3,
        }}>
          {overdue
            ? <><AlertTriangle size={10} /> Vencido ({Math.abs(days)}d)</>
            : almostDue
            ? `⏰ ${days}d restante${days !== 1 ? "s" : ""}`
            : `→ ${wi.endDate}`}
        </span>

        {/* Asignado a (solo en tab Esperando a terceros) */}
        {showAssignedTo && (
          <span style={{
            fontSize: 10,
            padding: "1px 7px", borderRadius: 10,
            background: roleChip.bg, color: roleChip.text,
            fontWeight: 600,
          }}>
            {assignedName
              ? `${wi.assignedToRole}: ${assignedName}`
              : wi.assignedToRole}
          </span>
        )}

        {/* Progreso */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{
            width: 36, height: 4,
            background: C.border, borderRadius: 2, overflow: "hidden",
          }}>
            <div style={{
              width: `${wi.progress}%`, height: "100%", borderRadius: 2,
              background: wi.progress === 100 ? C.success : C.primary,
            }} />
          </div>
          <span style={{ fontSize: 10, color: C.textMuted }}>{wi.progress}%</span>
        </div>

        {/* CTA Abrir */}
        <button
          onClick={() => onOpen(wi)}
          style={{
            marginLeft: "auto",
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "3px 10px", borderRadius: 4,
            border: `1px solid ${C.primary}`,
            background: "#fff", color: C.primary,
            fontSize: 11, fontWeight: 600, cursor: "pointer",
            fontFamily: "'Segoe UI', sans-serif",
            transition: "background 120ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#EFF6FF";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#fff";
          }}
        >
          <ExternalLink size={10} /> Abrir
        </button>
      </div>

      {/* Razón de bloqueo */}
      {wi.blockedReason && (
        <p style={{ margin: "5px 0 0", fontSize: 10, color: C.danger }}>
          ⚠ {wi.blockedReason}
        </p>
      )}
    </div>
  );
};

// ── Empty state ──────────────────────────────────────────────────
const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ textAlign: "center", padding: "32px 20px", color: C.textMuted }}>
    <CheckCircle2 size={28} color={C.success} style={{ marginBottom: 8 }} />
    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.success }}>
      Todo al día
    </p>
    <p style={{ margin: "4px 0 0", fontSize: 11 }}>{message}</p>
  </div>
);

// ── MyBandejasPanel ──────────────────────────────────────────────
type TabId = "mine" | "waiting";

export const MyBandejasPanel: React.FC<Props> = ({
  allWorkItems, projects, states, currentUserId, userDisplayMap,
}) => {
  const navigate = useNavigate();
  const [tab, setTab]         = useState<TabId>("mine");
  const [selected, setSelected] = useState<WorkItem | null>(null);

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));
  const stateMap   = Object.fromEntries(states.map((s) => [s.id, s]));

  const myItems      = getMyAssignments(allWorkItems, currentUserId);
  const waitingItems = getWaitingOnOthers(allWorkItems, projects, currentUserId);

  const activeItems  = tab === "mine" ? myItems : waitingItems;
  const showAssigned = tab === "waiting";

  // Agrupar por assignedToRole para la tab "Esperando a terceros"
  const groups: Record<string, WorkItem[]> = {};
  if (tab === "waiting") {
    waitingItems.forEach((wi) => {
      const role = wi.assignedToRole ?? "Sin rol";
      (groups[role] ??= []).push(wi);
    });
  }

  const tabStyle = (id: TabId): React.CSSProperties => ({
    flex: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 6,
    padding: "9px 12px",
    border: "none",
    borderBottom: `2px solid ${tab === id ? C.primary : "transparent"}`,
    background: "none",
    color: tab === id ? C.primary : C.textMid,
    fontWeight: tab === id ? 700 : 400,
    fontSize: 12, cursor: "pointer",
    fontFamily: "'Segoe UI', sans-serif",
    transition: "color 120ms, border-color 120ms",
    whiteSpace: "nowrap",
  });

  const countBadge = (n: number) => (
    <span style={{
      padding: "0 7px", borderRadius: 10,
      background: n > 0 ? C.primary : C.border,
      color: n > 0 ? "#fff" : C.textMuted,
      fontSize: 10, fontWeight: 700,
    }}>{n}</span>
  );

  return (
    <>
      <div style={{
        background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10,
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        {/* Tabs */}
        <div style={{
          display: "flex",
          borderBottom: `1px solid ${C.border}`,
          background: C.bg,
        }}>
          <button style={tabStyle("mine")} onClick={() => setTab("mine")}>
            <UserCheck size={13} /> Asignadas a mí {countBadge(myItems.length)}
          </button>
          <button style={tabStyle("waiting")} onClick={() => setTab("waiting")}>
            <Hourglass size={13} /> Esperando a terceros {countBadge(waitingItems.length)}
          </button>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, overflowY: "auto", maxHeight: 480 }}>
          {tab === "mine" && (
            myItems.length === 0
              ? <EmptyState message="No tienes tareas asignadas pendientes." />
              : myItems.map((wi) => (
                  <WorkItemRow
                    key={wi.id} wi={wi}
                    projectMap={projectMap} stateMap={stateMap}
                    userDisplayMap={userDisplayMap}
                    onOpen={setSelected} showAssignedTo={false}
                  />
                ))
          )}

          {tab === "waiting" && (
            waitingItems.length === 0
              ? <EmptyState message="No hay tareas esperando respuesta de terceros." />
              : Object.entries(groups).map(([role, items]) => (
                  <div key={role}>
                    {/* Cabecera de grupo */}
                    <div style={{
                      padding: "6px 14px",
                      background: "#F8F9FB",
                      borderBottom: `1px solid ${C.border}`,
                      fontSize: 10, fontWeight: 700,
                      color: C.textMuted,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {ROLE_CHIP[role]
                        ? <span style={{
                            padding: "1px 7px", borderRadius: 10,
                            background: ROLE_CHIP[role].bg, color: ROLE_CHIP[role].text,
                            fontWeight: 700, fontSize: 10,
                          }}>{role}</span>
                        : role}
                      <span style={{ color: C.border }}>·</span>
                      {items.length} tarea{items.length !== 1 ? "s" : ""}
                    </div>
                    {items.map((wi) => (
                      <WorkItemRow
                        key={wi.id} wi={wi}
                        projectMap={projectMap} stateMap={stateMap}
                        userDisplayMap={userDisplayMap}
                        onOpen={setSelected} showAssignedTo={true}
                      />
                    ))}
                  </div>
                ))
          )}
        </div>

        {/* Footer: ir a Kanban filtrado */}
        <div style={{
          padding: "8px 14px",
          borderTop: `1px solid ${C.border}`,
          background: C.bg,
          display: "flex", justifyContent: "flex-end",
        }}>
          <button
            onClick={() =>
              navigate(`/kanban?scope=${tab}`)
            }
            title={
              tab === "mine"
                ? "Ver en Kanban — filtrado 'Asignadas a mí'"
                : "Ver en Kanban — filtrado 'Esperando a terceros'"
            }
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 5,
              border: `1px solid ${C.primary}`,
              background: "#fff", color: C.primary,
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: "'Segoe UI', sans-serif",
              transition: "background 140ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#EFF6FF";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
            }}
          >
            Ver en Kanban <ArrowRight size={12} />
          </button>
        </div>
      </div>

      {/* Drawer */}
      <WorkItemMiniDrawer
        workItem={selected}
        project={selected ? projectMap[selected.projectId] : undefined}
        states={states}
        onClose={() => setSelected(null)}
      />
    </>
  );
};
