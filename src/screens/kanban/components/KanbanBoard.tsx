// ─────────────────────────────────────────────────────────
//  src/screens/kanban/components/KanbanBoard.tsx
//  Renderiza el board completo: columnas y swimlanes
//  - wipLimits: mapa stateId → límite (0 = sin límite)
//  - draggableIds: IDs que el usuario puede arrastrar (RBAC)
//  - activeFromStateId: stateId de la card en drag (para highlight de cols)
//  - allowedTargetStateIds: stateIds a los que puede ir la card en drag
// ─────────────────────────────────────────────────────────

import React from "react";
import type { WorkItem, AppRole } from "../../../types/domain";
import { KANBAN_COLUMNS } from "../tokens";
import { KanbanColumn } from "./KanbanColumn";

interface BoardProps {
  items: WorkItem[];
  syncingIds: Set<string>;
  draggableIds: Set<string>;
  wipLimits: Record<string, number>;
  allowedTargetStateIds: Set<string> | null;  // null = no hay drag activo
  swimlaneLabel?: string;
  swimlaneLabelColor?: string;
  userMap?: Record<string, string>;
  teamMap?: Record<string, string>;  projectInfoMap?: Record<string, { name: string; areaName: string }>;
  showProjectLine?: boolean;
  /** ID de la card a resaltar (deep-link desde Home) */
  highlightedWiId?: string | null;
  onDragStart: (e: React.DragEvent, item: WorkItem) => void;
  onDrop: (e: React.DragEvent, toStateId: string) => void;
  onOpenDrawer: (item: WorkItem) => void;
}

/** Un board de columnas (puede ser todo el board o una fila de swimlane) */
const Board: React.FC<BoardProps> = ({
  items, syncingIds, draggableIds, wipLimits, allowedTargetStateIds,
  swimlaneLabel, swimlaneLabelColor, userMap, teamMap,
  projectInfoMap, showProjectLine, highlightedWiId, lockReasonMap,
  onDragStart, onDrop, onOpenDrawer,
}) => (
  <div>
    {/* Swimlane row label */}
    {swimlaneLabel && (
      <div style={{
        padding: "6px 10px", marginBottom: 8,
        background: swimlaneLabelColor ?? "#F3F2F1",
        borderRadius: 6, display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "#323130",
          textTransform: "uppercase", letterSpacing: "0.06em",
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          {swimlaneLabel}
        </span>
        <span style={{ fontSize: 11, color: "#605E5C", fontFamily: "'Segoe UI', sans-serif" }}>
          ({items.length} elemento{items.length !== 1 ? "s" : ""})
        </span>
      </div>
    )}

    {/* Columns row */}
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      {KANBAN_COLUMNS.map((col) => {
        // isAllowedTarget:
        //   null  → no hay drag activo (ningún highlight/dim)
        //   true  → puede recibir el drop
        //   false → NO puede recibir el drop (se atenúa)
        const isAllowedTarget: boolean | null =
          allowedTargetStateIds === null
            ? null
            : allowedTargetStateIds.has(col.stateId);

        return (
          <KanbanColumn
            key={col.stateId}
            col={col}
            items={items.filter((wi) => wi.stateId === col.stateId)}
            syncingIds={syncingIds}
            draggableIds={draggableIds}
            wipLimit={wipLimits[col.stateId] ?? 0}
            isAllowedTarget={isAllowedTarget}
            userMap={userMap}
            teamMap={teamMap}
            projectInfoMap={projectInfoMap}
            showProjectLine={showProjectLine}
            highlightedWiId={highlightedWiId}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onOpenDrawer={onOpenDrawer}
          />
        );
      })}
    </div>
  </div>
);

const ROLE_COLORS: Record<string, string> = {
  "IT AirEuropa": "#EFF6FC",
  "Proveedor":    "#FFF4CE",
  "Usuario":      "#E7F7E7",
  "Admin":        "#F3F2F1",
};

const SWIMLANE_ROLES: AppRole[] = ["IT AirEuropa", "Proveedor", "Usuario"];

interface KanbanBoardProps {
  items: WorkItem[];
  syncingIds: Set<string>;
  draggableIds: Set<string>;
  wipLimits: Record<string, number>;
  allowedTargetStateIds: Set<string> | null;
  swimlanes: boolean;
  userMap?: Record<string, string>;
  teamMap?: Record<string, string>;
  projectInfoMap?: Record<string, { name: string; areaName: string }>;
  showProjectLine?: boolean;
  /** ID de la card a resaltar (deep-link desde Home) */
  highlightedWiId?: string | null;
  /** Mapa workItemId → motivo de candado */
  lockReasonMap?: Record<string, string>;
  onDragStart: (e: React.DragEvent, item: WorkItem) => void;
  onDrop: (e: React.DragEvent, toStateId: string) => void;
  onOpenDrawer: (item: WorkItem) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  items, syncingIds, draggableIds, wipLimits, allowedTargetStateIds,
  swimlanes, userMap, teamMap, projectInfoMap, showProjectLine, highlightedWiId,
  lockReasonMap,
  onDragStart, onDrop, onOpenDrawer,
}) => {
  if (!swimlanes) {
    return (
      <Board
        items={items}
        syncingIds={syncingIds}
        draggableIds={draggableIds}
        wipLimits={wipLimits}
        allowedTargetStateIds={allowedTargetStateIds}
        userMap={userMap}
        teamMap={teamMap}
        projectInfoMap={projectInfoMap}
        showProjectLine={showProjectLine}
        highlightedWiId={highlightedWiId}
            lockReasonMap={lockReasonMap}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onOpenDrawer={onOpenDrawer}
      />
    );
  }

  // Swimlane por rol
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {SWIMLANE_ROLES.map((role) => {
        const roleItems = items.filter((wi) => wi.assignedToRole === role);
        return (
          <Board
            key={role}
            items={roleItems}
            syncingIds={syncingIds}
            draggableIds={draggableIds}
            wipLimits={wipLimits}
            allowedTargetStateIds={allowedTargetStateIds}
            swimlaneLabel={role}
            swimlaneLabelColor={ROLE_COLORS[role]}
            userMap={userMap}
            teamMap={teamMap}
            projectInfoMap={projectInfoMap}
            showProjectLine={showProjectLine}
            highlightedWiId={highlightedWiId}
            lockReasonMap={lockReasonMap}
            onDragStart={onDragStart}
            onDrop={onDrop}
            onOpenDrawer={onOpenDrawer}
          />
        );
      })}
    </div>
  );
};

