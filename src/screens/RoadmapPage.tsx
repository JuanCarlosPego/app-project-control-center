// ─────────────────────────────────────────────────────────
//  src/screens/RoadmapPage.tsx
//  Vista de proyectos agrupados por trimestre (Roadmap v1)
//  Consume projectService + workItemService
// ─────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects } from "../services/projectService";
import type { Project } from "../types/domain";
import { ApiError } from "../services/apiClient";

const QUARTERS: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };

function getQuarter(dateStr: string): number {
  const month = new Date(dateStr).getMonth() + 1; // 1–12
  return Math.ceil(month / 3);
}

const STATUS_COLOR: Record<string, string> = {
  "En curso":  "#0078D4",
  "Pendiente": "#8A8886",
  "Bloqueado": "#D83B01",
  "Cerrado":   "#107C10",
};

export const RoadmapPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [year, setYear]         = useState("2026");

  useEffect(() => {
    setLoading(true);
    setError(null);
    getProjects({ year })
      .then(setProjects)
      .catch(e => setError(e instanceof ApiError ? e.message : "Error cargando roadmap"))
      .finally(() => setLoading(false));
  }, [year]);

  // Agrupar proyectos por trimestre de su endDate
  const grouped: Record<number, Project[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const p of projects) {
    const q = getQuarter(p.endDate);
    grouped[q].push(p);
  }

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100 }}>
      {/* Cabecera */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1B2A3E" }}>
          Roadmap
        </h1>
        <select
          value={year}
          onChange={e => setYear(e.target.value)}
          style={{ padding: "4px 8px", border: "1px solid #EDEBE9", borderRadius: 4, fontSize: 13 }}
        >
          {["2025", "2026", "2027"].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading && <p style={{ color: "#8A8886" }}>Cargando roadmap…</p>}
      {error   && <p style={{ color: "#D83B01" }}>{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#8A8886" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
          <p style={{ margin: 0, fontSize: 14 }}>No hay proyectos para el año {year}.</p>
        </div>
      )}

      {/* Cuadrantes por trimestre */}
      {!loading && !error && [1, 2, 3, 4].map(q => {
        const items = grouped[q];
        return (
          <section key={q} style={{ marginBottom: 32 }}>
            {/* Cabecera de trimestre */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              borderBottom: "2px solid #0078D4", paddingBottom: 6, marginBottom: 12,
            }}>
              <span style={{
                background: "#0078D4", color: "#fff", fontWeight: 700,
                fontSize: 12, padding: "2px 10px", borderRadius: 10,
              }}>
                {QUARTERS[q]} {year}
              </span>
              <span style={{ fontSize: 12, color: "#8A8886" }}>
                {items.length} proyecto{items.length !== 1 ? "s" : ""}
              </span>
            </div>

            {items.length === 0 ? (
              <p style={{ color: "#C8C6C4", fontSize: 13, marginLeft: 4 }}>
                Sin proyectos este trimestre.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {items.map(p => (
                  <ProjectCard key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};

// ── ProjectCard ───────────────────────────────────────────
const ProjectCard: React.FC<{ project: Project; onClick: () => void }> = ({ project: p, onClick }) => (
  <div
    onClick={onClick}
    role="button"
    tabIndex={0}
    onKeyDown={e => e.key === "Enter" && onClick()}
    style={{
      border: "1px solid #EDEBE9", borderRadius: 6, padding: "14px 16px",
      cursor: "pointer", background: "#fff", transition: "box-shadow 150ms",
      borderLeft: `4px solid ${STATUS_COLOR[p.status] ?? "#8A8886"}`,
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
      <span style={{ fontSize: 11, color: "#8A8886", fontFamily: "monospace" }}>{p.code}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 10,
        background: STATUS_COLOR[p.status] ?? "#8A8886", color: "#fff", whiteSpace: "nowrap",
      }}>{p.status}</span>
    </div>

    <p style={{ margin: "6px 0 8px", fontSize: 13, fontWeight: 600, color: "#323130", lineHeight: 1.3 }}>
      {p.name}
    </p>

    {/* Barra de progreso */}
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "#EDEBE9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${p.progress}%`,
          background: p.progress === 100 ? "#107C10" : "#0078D4",
          borderRadius: 3,
        }} />
      </div>
      <span style={{ fontSize: 11, color: "#8A8886" }}>{p.progress}%</span>
    </div>

    {/* Fechas */}
    <div style={{ marginTop: 8, fontSize: 11, color: "#8A8886", display: "flex", gap: 12 }}>
      <span>🗓 {p.startDate}</span>
      <span>→ {p.endDate}</span>
    </div>

    {/* Bloqueo */}
    {p.blockedReason && (
      <div style={{ marginTop: 8, fontSize: 11, color: "#D83B01", background: "#FDF3F0", borderRadius: 4, padding: "4px 8px" }}>
        ⚠ {p.blockedReason}
      </div>
    )}

    {/* Ejecución */}
    <div style={{ marginTop: 8, fontSize: 11, color: "#8A8886" }}>
      Ejecución: <strong>{p.deliveryOwnerType}</strong>
    </div>
  </div>
);
