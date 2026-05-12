// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/DashboardKPIBar.tsx
//  5 KPI cards clicables.
//  Click → navega a /projects?status=<valor>
// ─────────────────────────────────────────────────────────

import React from "react";
import { useNavigate } from "react-router-dom";
import type { Project } from "../../../types/domain";

interface KPIDef {
  key:    string;   // "" = total
  label:  string;
  icon:   string;
  color:  string;
  bg:     string;
}

const KPIS: KPIDef[] = [
  { key: "",          label: "Épicas totales", icon: "📋", color: "#1B2A3E", bg: "#F0F4F8" },
  { key: "En curso",  label: "En curso",       icon: "🔵", color: "#0078D4", bg: "#EFF6FF" },
  { key: "Pendiente", label: "Pendiente",       icon: "⚪", color: "#605E5C", bg: "#F3F2F1" },
  { key: "Bloqueado", label: "Bloqueadas",      icon: "🔴", color: "#D83B01", bg: "#FDF3F0" },
  { key: "Cerrado",   label: "Cerradas",        icon: "🟢", color: "#107C10", bg: "#EFF8F0" },
];

interface Props {
  projects: Project[];  // proyectos ya filtrados por año/área/ejecutor
}

export const DashboardKPIBar: React.FC<Props> = ({ projects }) => {
  const navigate = useNavigate();

  const counts: Record<string, number> = {
    "":          projects.length,
    "En curso":  projects.filter((p) => p.status === "En curso").length,
    "Pendiente": projects.filter((p) => p.status === "Pendiente").length,
    "Bloqueado": projects.filter((p) => p.status === "Bloqueado").length,
    "Cerrado":   projects.filter((p) => p.status === "Cerrado").length,
  };

  // Progreso medio del programa
  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0;

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
      {KPIS.map((kpi) => {
        const count = counts[kpi.key] ?? 0;
        return (
          <button
            key={kpi.key}
            onClick={() =>
              navigate(kpi.key ? `/projects?status=${encodeURIComponent(kpi.key)}` : "/projects")
            }
            title={`Ver ${kpi.label.toLowerCase()} en Proyectos`}
            style={{
              flex: "1 1 140px", minWidth: 120,
              padding: "14px 16px",
              border: `1px solid ${kpi.color}22`,
              borderLeft: `3px solid ${kpi.color}`,
              borderRadius: 8,
              background: kpi.bg,
              cursor: "pointer",
              textAlign: "left",
              fontFamily: "'Segoe UI', sans-serif",
              transition: "box-shadow 150ms, transform 100ms",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.boxShadow = "0 3px 10px rgba(0,0,0,0.10)";
              el.style.transform  = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.boxShadow = "none";
              el.style.transform  = "none";
            }}
          >
            <div style={{ fontSize: 10, color: kpi.color, fontWeight: 700, marginBottom: 4, opacity: 0.8 }}>
              {kpi.icon} {kpi.label.toUpperCase()}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: kpi.color, lineHeight: 1 }}>
              {count}
            </div>
            {kpi.key === "" && projects.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: "#8A8886" }}>
                Avance medio: <strong style={{ color: kpi.color }}>{avgProgress}%</strong>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
