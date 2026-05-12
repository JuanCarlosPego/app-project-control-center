// ─────────────────────────────────────────────────────────
//  src/screens/kanban/components/KanbanCard.tsx
//  Tarjeta draggable del Kanban
//  - canDrag: false si el usuario no tiene ninguna transición permitida
//  - isLocked: muestra candado visual + cursor default
// ─────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from "react";
import {
  AlertTriangle, ExternalLink, RotateCw, User, Tag,
  Zap, BugIcon, Wrench, Activity, Lock, Calendar, GripVertical,
} from "lucide-react";
import type { WorkItem } from "../../../types/domain";
import { PRIORITY_CHIP, TYPE_CHIP, SYNC_CHIP, ROLE_CHIP } from "../tokens";

interface Props {
  item: WorkItem;
  isSyncing: boolean;
  canDrag: boolean;   // RBAC + ownership: puede arrastrar
  /** Motivo del candado (para tooltip). Si se omite, mensaje genérico. */
  lockReason?: string;
  /** displayName del usuario asignado (pasado desde el padre) */
  assignedUserName?: string;
  /** Nombre del equipo asignado */
  teamName?: string;
  /** Nombre del proyecto (para línea Área·Proyecto) */
  projectName?: string;
  /** Nombre del área de negocio del proyecto */
  projectAreaName?: string;
  /** Mostrar línea compacta Área·Proyecto (cuando selectedProject='all') */
  showProjectLine?: boolean;
  /** Resaltar temporalmente esta card (deep-link desde Home) */
  isHighlighted?: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

// ── Iniciales de un nombre ─────────────────────────────────
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  Feature:  <Zap size={11} />,
  Bug:      <BugIcon size={11} />,
  TechDebt: <Wrench size={11} />,
  Spike:    <Activity size={11} />,
};

function isOverdue(endDate: string): boolean {
  if (!endDate) return false;
  return new Date(endDate) < new Date();
}

function isDueSoon(endDate: string): boolean {
  if (!endDate) return false;
  const diff = new Date(endDate).getTime() - Date.now();
  return diff >= 0 && diff <= 14 * 24 * 60 * 60 * 1000;
}

export const KanbanCard: React.FC<Props> = ({
  item, isSyncing, canDrag, lockReason, assignedUserName, teamName,
  projectName, projectAreaName, showProjectLine, isHighlighted,
  onClick, onDragStart,
}) => {
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Scroll into view + auto-clear highlight after 3 s
  useEffect(() => {
    if (!isHighlighted) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isHighlighted]);

  const priority = PRIORITY_CHIP[item.priority] ?? { bg: "#F3F2F1", text: "#605E5C" };
  const type     = TYPE_CHIP[item.type] ?? { bg: "#F3F2F1", text: "#605E5C" };
  const syncChip = SYNC_CHIP[item.syncStatus] ?? SYNC_CHIP.OK;
  const roleChip = ROLE_CHIP[item.assignedToRole] ?? { bg: "#F3F2F1", text: "#323130" };
  const isBlocked = item.stateId === "st-blk";
  const overdue   = isOverdue(item.endDate);
  const dueSoon   = !overdue && isDueSoon(item.endDate);

  const isDraggable = canDrag && !isSyncing;

  return (
    <div
      ref={cardRef}
      draggable={isDraggable}
      onDragStart={(e) => {
        if (!isDraggable) { e.preventDefault(); return; }
        e.dataTransfer.setData("text/plain", item.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(e);
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isHighlighted ? "#FFFBF0" : "#fff",
        borderRadius: 8,
        border: isHighlighted
          ? "2px solid #C17D00"
          : `1px solid ${isBlocked ? "#F4B8BB" : hovered ? "#C8C6C4" : "#EDEBE9"}`,
        boxShadow: isHighlighted
          ? "0 0 0 3px #FFF4CE, 0 4px 16px rgba(193,125,0,0.25)"
          : hovered ? "0 4px 12px rgba(0,0,0,0.10)" : "0 1px 4px rgba(0,0,0,0.06)",
        padding: "8px 10px",
        // cursor pointer siempre para click; el handle muestra grab
        cursor: isSyncing ? "not-allowed" : "pointer",
        position: "relative",
        transition: "box-shadow 140ms, border-color 140ms, background 140ms",
        opacity: isSyncing ? 0.7 : 1,
        fontFamily: "'Segoe UI', sans-serif",
        marginBottom: 0,
      }}
    >
      {/* Highlight badge (deep-link desde Home) */}
      {isHighlighted && (
        <div style={{
          position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
          fontSize: 10, fontWeight: 700,
          background: "#C17D00", color: "#fff",
          padding: "2px 10px", borderRadius: 10, whiteSpace: "nowrap",
          pointerEvents: "none", zIndex: 3,
        }}>
          📍 Desde Home
        </div>
      )}
      {/* Syncing overlay */}
      {isSyncing && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 7,
          background: "rgba(255,255,255,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: "#835B00", fontWeight: 600, gap: 5, zIndex: 1,
        }}>
          <RotateCw size={12} style={{ animation: "spin 1s linear infinite" }} />
          Sincronizando…
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Lock icon (RBAC o ownership: no puede mover) */}
      {!canDrag && !isSyncing && (
        <div
          title={lockReason || "No tienes permisos para mover esta tarea"}
          style={{
            position: "absolute", top: 6, right: 6, zIndex: 2,
            display: "flex", alignItems: "center",
          }}
        >
          <Lock size={11} color="#A19F9D" />
        </div>
      )}

      {/* Drag handle (solo si draggable): esquina superior derecha */}
      {isDraggable && (
        <div
          onClick={(e) => e.stopPropagation()}
          title="Arrastrar para mover"
          style={{
            position: "absolute", top: 6, right: 6, zIndex: 2,
            cursor: "grab", color: "#C8C6C4",
            display: "flex", alignItems: "center",
            padding: 2, borderRadius: 3,
            transition: "color 120ms",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#605E5C"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#C8C6C4"; }}
        >
          <GripVertical size={13} />
        </div>
      )}

      {/* Header row: Jira key + type + priority */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7, flexWrap: "wrap",
        paddingRight: !canDrag ? 18 : 0 }}>
        {item.jiraIssueKey && (
          <span
            onClick={(e) => { e.stopPropagation(); window.open(item.jiraUrl, "_blank"); }}
            title="Abrir en Jira"
            style={{
              fontSize: 10, fontWeight: 700, color: "#0078D4", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 2, letterSpacing: "0.02em",
            }}
          >
            {item.jiraIssueKey} <ExternalLink size={9} />
          </span>
        )}
        <span style={{
          fontSize: 10, borderRadius: 4, padding: "1px 6px",
          background: type.bg, color: type.text, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 3,
        }}>
          {TYPE_ICON[item.type]} {item.type}
        </span>
        <span style={{
          fontSize: 10, borderRadius: 4, padding: "1px 6px",
          background: priority.bg, color: priority.text, fontWeight: 600,
          marginLeft: "auto",
        }}>
          {item.priority}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 12, fontWeight: 600, color: "#201F1E", lineHeight: 1.35, marginBottom: 5,
      }}>
        {item.title}
      </div>

      {/* Blocked reason */}
      {isBlocked && item.blockedReason && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 5, marginBottom: 6,
          background: "#FDE7E9", borderRadius: 5, padding: "5px 8px",
        }}>
          <AlertTriangle size={11} color="#A4262C" style={{ marginTop: 1, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#A4262C", lineHeight: 1.3 }}>{item.blockedReason}</span>
        </div>
      )}

      {/* Due date warning */}
      {(overdue || dueSoon) && item.endDate && (
        <div style={{
          display: "flex", alignItems: "center", gap: 4, marginBottom: 6,
          background: overdue ? "#FDE7E9" : "#FFF4CE",
          borderRadius: 4, padding: "3px 7px",
        }}>
          <Calendar size={10} color={overdue ? "#A4262C" : "#835B00"} />
          <span style={{
            fontSize: 10, color: overdue ? "#A4262C" : "#835B00", fontWeight: 600,
          }}>
            {overdue
              ? `Vencida ${new Date(item.endDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}`
              : `Vence ${new Date(item.endDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}`
            }
          </span>
        </div>
      )}

      {/* Tags */}
      {item.tags.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 7 }}>
          {item.tags.slice(0, 3).map((tag) => (
            <span key={tag} style={{
              fontSize: 10, color: "#605E5C", background: "#F3F2F1",
              borderRadius: 10, padding: "1px 7px", display: "inline-flex",
              alignItems: "center", gap: 3,
            }}>
              <Tag size={8} /> {tag}
            </span>
          ))}
          {item.tags.length > 3 && (
            <span style={{ fontSize: 10, color: "#A19F9D" }}>+{item.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Área · Proyecto — visible solo en vista "Todos los proyectos" */}
      {showProjectLine && (projectAreaName || projectName) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 3, marginBottom: 5,
          overflow: "hidden",
        }}>
          <span style={{
            fontSize: 9, color: "#A19F9D", whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis",
            display: "inline-flex", alignItems: "center", gap: 3,
            maxWidth: "100%",
          }}>
            {projectAreaName && (
              <span style={{ fontWeight: 600, color: "#605E5C" }}>{projectAreaName}</span>
            )}
            {projectAreaName && projectName && (
              <span style={{ color: "#C8C6C4" }}>·</span>
            )}
            {projectName && (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {projectName}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Progress bar */}
      {item.progress > 0 && item.progress < 100 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{
            height: 3, background: "#EDEBE9", borderRadius: 2, overflow: "hidden",
          }}>
            <div style={{
              height: "100%", background: "#0078D4", borderRadius: 2,
              width: `${item.progress}%`, transition: "width 300ms",
            }} />
          </div>
        </div>
      )}

      {/* Footer: responsable completo + sync badge */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap", marginTop: 2 }}>

        {/* Línea de responsabilidad — siempre visible (incluso si canDrag=false) */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>

          {/* Fila usuario + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {/* Avatar */}
            {assignedUserName ? (
              <div
                title={assignedUserName}
                style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: roleChip.bg, color: roleChip.text,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 700, flexShrink: 0,
                  border: `1px solid ${roleChip.text}44`,
                }}
              >
                {initials(assignedUserName)}
              </div>
            ) : (
              <div
                title={
                  item.assignedToRole === "Proveedor"
                    ? "ERROR: tarea de Proveedor sin usuario asignado. Revisar asignación."
                    : "Sin usuario asignado. Revisar asignación para evitar inconsistencias."
                }
                style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: item.assignedToRole === "Proveedor" ? "#FDE7E9" : "#FFF4CE",
                  color: item.assignedToRole === "Proveedor" ? "#A4262C" : "#835B00",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  border: `1px solid ${item.assignedToRole === "Proveedor" ? "#F4B8BB" : "#F4D18044"}`,
                }}
              >
                <AlertTriangle size={9} />
              </div>
            )}

            {/* displayName completo (o warning) */}
            <span
              title={assignedUserName ?? "Sin usuario asignado"}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: assignedUserName ? "#323130" : (item.assignedToRole === "Proveedor" ? "#A4262C" : "#835B00"),
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              👤 {assignedUserName ?? "Sin usuario"}
            </span>
          </div>

          {/* Fila team + role */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {/* Team */}
            {teamName ? (
              <span style={{
                fontSize: 9, color: "#605E5C",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: 100,
              }}>
                🏢 {teamName}
              </span>
            ) : (
              <span
                title="Esta tarea no tiene team asignado. Revisar asignación (Role/Team/User) para evitar inconsistencias."
                style={{
                  fontSize: 9, fontWeight: 700,
                  color: "#835B00", background: "#FFF4CE",
                  border: "1px solid #F4D180",
                  borderRadius: 4, padding: "1px 5px",
                  display: "inline-flex", alignItems: "center", gap: 2,
                  cursor: "help",
                }}
              >
                ⚠ Sin team
              </span>
            )}

            <span style={{ color: "#C8C6C4", fontSize: 9 }}>·</span>

            {/* Role chip */}
            <span style={{
              borderRadius: 4, padding: "1px 5px",
              background: roleChip.bg, color: roleChip.text, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 2, fontSize: 9,
            }}>
              <User size={8} /> {item.assignedToRole}
            </span>
          </div>
        </div>

        {/* Sync badge — solo si no OK */}
        {item.syncStatus !== "OK" && (
          <span style={{
            fontSize: 9, borderRadius: 10, padding: "1px 6px",
            background: syncChip.bg, color: syncChip.text,
            fontWeight: 600, flexShrink: 0, alignSelf: "flex-end",
          }}>
            {syncChip.label}
          </span>
        )}

        {item.sprintName && item.syncStatus === "OK" && (
          <span style={{ fontSize: 9, color: "#A19F9D", flexShrink: 0, alignSelf: "flex-end" }}>
            {item.sprintName}
          </span>
        )}
      </div>
    </div>
  );
};
