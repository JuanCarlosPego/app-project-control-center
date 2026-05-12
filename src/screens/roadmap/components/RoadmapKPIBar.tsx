// ─────────────────────────────────────────────────────────
//  src/screens/roadmap/components/RoadmapKPIBar.tsx
//  5 KPI cards clicables: Total | En curso | Pendiente |
//  Bloqueado | Cerrado. Click = filtra por ese estado.
// ─────────────────────────────────────────────────────────

import React from "react";
import type { Project } from "../../../types/domain";
import { STATUS_COLOR } from "../tokens";

interface KPIItem {
  label:  string;
  status: string;   // "" = total (sin filtro de estado)
  color:  string;
  icon:   string;
}

const ITEMS: KPIItem[] = [
  { label: "Total",     status: "",          color: "#1B2A3E", icon: "📋" },
  { label: "En curso",  status: "En curso",  color: STATUS_COLOR["En curso"],  icon: "🔵" },
  { label: "Pendiente", status: "Pendiente", color: STATUS_COLOR["Pendiente"], icon: "⚪" },
  { label: "Bloqueado", status: "Bloqueado", color: STATUS_COLOR["Bloqueado"], icon: "🔴" },
  { label: "Cerrado",   status: "Cerrado",   color: STATUS_COLOR["Cerrado"],   icon: "🟢" },
];

interface Props {
  projects:       Project[];
  activeStatus:   string;
  onStatusFilter: (s: string) => void;
}

export const RoadmapKPIBar: React.FC<Props> = ({ projects, activeStatus, onStatusFilter }) => {
  const counts: Record<string, number> = {
    "":          projects.length,
    "En curso":  projects.filter((p) => p.status === "En curso").length,
    "Pendiente": projects.filter((p) => p.status === "Pendiente").length,
    "Bloqueado": projects.filter((p) => p.status === "Bloqueado").length,
    "Cerrado":   projects.filter((p) => p.status === "Cerrado").length,
  };

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      {ITEMS.map((item) => {
        const active = activeStatus === item.status;
        return (
          <button
            key={item.status}
            onClick={() => onStatusFilter(active ? "" : item.status)}
            style={{
              flex: "1 1 130px", minWidth: 110,
              padding: "10px 14px",
              border: `2px solid ${active ? item.color : "#EDEBE9"}`,
              borderRadius: 8,
              background: active ? item.color : "#fff",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 150ms",
              fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            <div style={{ fontSize: 10, color: active ? "rgba(255,255,255,0.8)" : "#8A8886", marginBottom: 2 }}>
              {item.icon} {item.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: active ? "#fff" : item.color }}>
              {counts[item.status] ?? 0}
            </div>
          </button>
        );
      })}
    </div>
  );
};
