// ─────────────────────────────────────────────────────────
//  src/screens/projects/components/KPIBar.tsx
//  5 KPI cards clicables que aplican filtro de estado
// ─────────────────────────────────────────────────────────

import React from "react";
import type { Project, ProjectStatus } from "../../../types/domain";

interface Props {
  projects: Project[];
  activeStatus: string;
  onStatusFilter: (status: string) => void;
}

interface KpiDef {
  label: string;
  status: string;       // "" = Total (sin filtro)
  color: string;
  bg: string;
  count: (list: Project[]) => number;
}

const KPIS: KpiDef[] = [
  {
    label: "Total", status: "", color: "#1B2A3E", bg: "#F0F6FF",
    count: (l) => l.length,
  },
  {
    label: "En curso", status: "En curso", color: "#0078D4", bg: "#EFF6FF",
    count: (l) => l.filter((p) => p.status === "En curso").length,
  },
  {
    label: "Pendiente", status: "Pendiente", color: "#605E5C", bg: "#F3F2F1",
    count: (l) => l.filter((p) => p.status === "Pendiente").length,
  },
  {
    label: "Bloqueado", status: "Bloqueado", color: "#D83B01", bg: "#FDF3F0",
    count: (l) => l.filter((p) => p.status === "Bloqueado").length,
  },
  {
    label: "Cerrado", status: "Cerrado", color: "#107C10", bg: "#EFF8EF",
    count: (l) => l.filter((p) => p.status === "Cerrado").length,
  },
];

export const KPIBar: React.FC<Props> = ({ projects, activeStatus, onStatusFilter }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      gap: 10,
      marginBottom: 18,
    }}
  >
    {KPIS.map((kpi) => {
      const isActive = kpi.status === activeStatus;
      const count = kpi.count(projects);
      return (
        <button
          key={kpi.label}
          onClick={() => onStatusFilter(isActive ? "" : kpi.status)}
          aria-pressed={isActive}
          style={{
            display: "flex", flexDirection: "column", alignItems: "flex-start",
            padding: "12px 16px", border: `2px solid ${isActive ? kpi.color : "#EDEBE9"}`,
            borderRadius: 8, cursor: "pointer", background: isActive ? kpi.bg : "#fff",
            transition: "border-color 150ms, background 150ms", textAlign: "left",
            fontFamily: "'Segoe UI', sans-serif", boxShadow: isActive ? `0 0 0 1px ${kpi.color}` : "none",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = kpi.color;
            (e.currentTarget as HTMLButtonElement).style.background = kpi.bg;
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#EDEBE9";
              (e.currentTarget as HTMLButtonElement).style.background = "#fff";
            }
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: kpi.color, lineHeight: 1 }}>
            {count}
          </span>
          <span style={{ fontSize: 11, color: "#8A8886", marginTop: 4, fontWeight: 500 }}>
            {kpi.label}
          </span>
        </button>
      );
    })}
  </div>
);
