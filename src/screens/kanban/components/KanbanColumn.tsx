// ─────────────────────────────────────────────────────────
//  src/screens/kanban/components/KanbanColumn.tsx
//  Drop-zone de una columna del Kanban
//  - wipLimit: 0 = sin límite; ≥75% → warning; >100% → danger
//  - isAllowedTarget: se resalta si el usuario puede dropear aquí
//  - isDimmed: se atenúa si hay drag activo pero NO puede dropear aquí
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import type { WorkItem } from "../../../types/domain";
import type { ColumnDef } from "../tokens";
import { KanbanCard } from "./KanbanCard";

interface Props {
  col: ColumnDef;
  items: WorkItem[];
  syncingIds: Set<string>;
  draggableIds: Set<string>;       // IDs que el usuario puede mover
  wipLimit: number;                // 0 = sin límite
  isAllowedTarget: boolean | null; // null = no hay drag activo
  userMap?: Record<string, string>;
  teamMap?: Record<string, string>;
  /** Mapa projectId → { name, areaName } para la línea compacta de la card */
  projectInfoMap?: Record<string, { name: string; areaName: string }>;
  /** Mostrar línea Área·Proyecto en cada card (cuando selectedProject='all') */
  showProjectLine?: boolean;
  /** ID de la card a resaltar (deep-link desde Home) */
  highlightedWiId?: string | null;
  /** Mapa workItemId → motivo del candado (para tooltip) */
  lockReasonMap?: Record<string, string>;
  onDragStart: (e: React.DragEvent, item: WorkItem) => void;
  onDrop: (e: React.DragEvent, toStateId: string) => void;
  onOpenDrawer: (item: WorkItem) => void;
}

function wipStatus(count: number, limit: number): "ok" | "warn" | "danger" {
  if (limit <= 0) return "ok";
  if (count > limit) return "danger";
  if (count / limit >= 0.75) return "warn";
  return "ok";
}

export const KanbanColumn: React.FC<Props> = ({
  col, items, syncingIds, draggableIds, wipLimit,
  isAllowedTarget, userMap, teamMap, projectInfoMap, showProjectLine,
  highlightedWiId, lockReasonMap,
  onDragStart, onDrop, onOpenDrawer,
}) => {
  const [dragOver, setDragOver] = useState(false);

  const wip = wipStatus(items.length, wipLimit);

  // Visual durante drag activo
  const isDimmed   = isAllowedTarget === false;
  const isHighlit  = isAllowedTarget === true;

  const wipColor = wip === "danger" ? "#D13438" : wip === "warn" ? "#CA8B00" : col.accent;
  const wipBg    = wip === "danger" ? "#FDE7E9" : wip === "warn" ? "#FFF4CE" : col.headerBg;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 230,
        flexShrink: 0,
        borderRadius: 8,
        border: dragOver && isAllowedTarget !== false
          ? `2px dashed ${col.accent}`
          : isHighlit
          ? `2px dashed ${col.accent}`
          : `1.5px solid transparent`,
        background: dragOver && isAllowedTarget !== false
          ? col.bg
          : isHighlit
          ? col.bg
          : "transparent",
        opacity: isDimmed ? 0.4 : 1,
        transition: "border 150ms, background 150ms, opacity 200ms",
        pointerEvents: isDimmed ? "none" : "auto",
      }}
      onDragOver={(e) => {
        if (isAllowedTarget === false) return;  // bloquear drop visual
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        if (isAllowedTarget === false) return;
        onDrop(e, col.stateId);
      }}
    >
      {/* Column header */}
      <div style={{
        padding: "8px 10px 7px",
        borderBottom: `3px solid ${wipColor}`,
        display: "flex", alignItems: "center", gap: 7, marginBottom: 8,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: "#323130",
          fontFamily: "'Segoe UI', sans-serif", flex: 1,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {col.label}
        </span>

        {/* WIP counter con semáforo */}
        <span
          title={
            wipLimit > 0
              ? `WIP: ${items.length}/${wipLimit}${wip === "danger" ? " — ¡Límite superado!" : wip === "warn" ? " — Cerca del límite" : ""}`
              : `${items.length} elemento${items.length !== 1 ? "s" : ""}`
          }
          style={{
            fontSize: 11, fontWeight: 700, color: wipColor,
            background: wipBg, borderRadius: 10,
            padding: "2px 8px", minWidth: 22, textAlign: "center",
            fontFamily: "'Segoe UI', sans-serif",
            display: "inline-flex", alignItems: "center", gap: 3,
          }}
        >
          {items.length}
          {wipLimit > 0 && (
            <span style={{ fontWeight: 400, opacity: 0.7 }}>/{wipLimit}</span>
          )}
        </span>

        {/* WIP danger badge */}
        {wip !== "ok" && wipLimit > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            background: wip === "danger" ? "#D13438" : "#CA8B00",
            color: "#fff", borderRadius: 4, padding: "1px 5px",
          }}>
            {wip === "danger" ? "⚠ WIP" : "~WIP"}
          </span>
        )}
      </div>

      {/* Cards */}
      <div style={{
        flex: 1, minHeight: 80, padding: "0 8px 8px",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {items.length === 0 && (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: 60, borderRadius: 6,
            border: dragOver ? `1.5px dashed ${col.accent}` : "1.5px dashed #EDEBE9",
            color: "#A19F9D", fontSize: 11,
            fontFamily: "'Segoe UI', sans-serif", transition: "border 150ms",
          }}>
            {dragOver ? "Suelta aquí" : "Sin elementos"}
          </div>
        )}
        {items.map((wi) => (
          <KanbanCard
            key={wi.id}
            item={wi}
            isSyncing={syncingIds.has(wi.id)}
            canDrag={draggableIds.has(wi.id)}
            assignedUserName={userMap?.[wi.assignedToUserId]}
            teamName={wi.assignedToTeamId ? teamMap?.[wi.assignedToTeamId] : undefined}
            projectName={projectInfoMap?.[wi.projectId]?.name}
            projectAreaName={projectInfoMap?.[wi.projectId]?.areaName}
            showProjectLine={showProjectLine}
            isHighlighted={!!highlightedWiId && wi.id === highlightedWiId}
            lockReason={lockReasonMap?.[wi.id]}
            onClick={() => onOpenDrawer(wi)}
            onDragStart={(e) => onDragStart(e, wi)}
          />
        ))}
      </div>
    </div>
  );
};
