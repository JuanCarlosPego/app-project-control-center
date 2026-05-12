// ─────────────────────────────────────────────────────────
//  src/screens/kanban/components/KPIBar.tsx
//  Pills de métricas clicables que filtran el board
// ─────────────────────────────────────────────────────────

import React from "react";
import type { WorkItem } from "../../../types/domain";

interface Pill {
  id: string;
  label: string;
  count: number;
  bg: string;
  active: string;  // color activo
  filterFn: (wi: WorkItem) => boolean;
}

interface Props {
  items: WorkItem[];
  activeFilter: string | null;  // pill id activo
  onFilter: (id: string | null) => void;
}

function buildPills(items: WorkItem[]): Pill[] {
  return [
    {
      id: "all",
      label: "Total",
      count: items.length,
      bg: "#F3F2F1", active: "#0078D4",
      filterFn: () => true,
    },
    {
      id: "st-prog",
      label: "En curso",
      count: items.filter((w) => w.stateId === "st-prog").length,
      bg: "#E7F7E7", active: "#107C10",
      filterFn: (w) => w.stateId === "st-prog",
    },
    {
      id: "st-new",
      label: "Nuevo",
      count: items.filter((w) => w.stateId === "st-new").length,
      bg: "#F3F2F1", active: "#797775",
      filterFn: (w) => w.stateId === "st-new",
    },
    {
      id: "st-blk",
      label: "Bloqueado",
      count: items.filter((w) => w.stateId === "st-blk").length,
      bg: "#FDE7E9", active: "#D13438",
      filterFn: (w) => w.stateId === "st-blk",
    },
    {
      id: "st-rft",
      label: "Listo pruebas",
      count: items.filter((w) => w.stateId === "st-rft").length,
      bg: "#FFF4CE", active: "#CA8B00",
      filterFn: (w) => w.stateId === "st-rft",
    },
    {
      id: "st-test",
      label: "En pruebas",
      count: items.filter((w) => w.stateId === "st-test").length,
      bg: "#F3EFF7", active: "#7530AF",
      filterFn: (w) => w.stateId === "st-test",
    },
    {
      id: "st-acc",
      label: "Aceptado",
      count: items.filter((w) => w.stateId === "st-acc").length,
      bg: "#DDFCE5", active: "#00B294",
      filterFn: (w) => w.stateId === "st-acc",
    },
    {
      id: "st-cls",
      label: "Cerrado",
      count: items.filter((w) => w.stateId === "st-cls").length,
      bg: "#F3F2F1", active: "#605E5C",
      filterFn: (w) => w.stateId === "st-cls",
    },
    {
      id: "sync-pending",
      label: "Sync pendiente",
      count: items.filter((w) => w.syncStatus === "Pending").length,
      bg: "#FFF4CE", active: "#CA8B00",
      filterFn: (w) => w.syncStatus === "Pending",
    },
    {
      id: "sync-error",
      label: "Sync error",
      count: items.filter((w) => w.syncStatus === "Error").length,
      bg: "#FDE7E9", active: "#D13438",
      filterFn: (w) => w.syncStatus === "Error",
    },
  ];
}

export const KPIBar: React.FC<Props> = ({ items, activeFilter, onFilter }) => {
  const pills = buildPills(items);

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 16px",
      borderBottom: "1px solid #EDEBE9",
    }}>
      {pills.map((pill) => {
        const isActive = activeFilter === pill.id;
        return (
          <button
            key={pill.id}
            onClick={() => onFilter(isActive ? null : pill.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 16, cursor: "pointer",
              border: isActive ? `1.5px solid ${pill.active}` : "1.5px solid transparent",
              background: isActive ? pill.active : pill.bg,
              color: isActive ? "#fff" : "#323130",
              fontFamily: "'Segoe UI', sans-serif", fontSize: 12, fontWeight: isActive ? 700 : 500,
              transition: "all 140ms",
              boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.14)" : "none",
            }}
          >
            {pill.label}
            <span style={{
              background: isActive ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.10)",
              borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700,
            }}>
              {pill.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export { buildPills };
export type { Pill };
