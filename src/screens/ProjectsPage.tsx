// ─────────────────────────────────────────────────────────
//  src/screens/ProjectsPage.tsx
//  Lista de proyectos con filtros — consume projectService
// ─────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getProjects, getBusinessAreas, getProviders } from "../services/projectService";
import type { Project, BusinessArea, Provider } from "../types/domain";
import { ApiError } from "../services/apiClient";

// ── Paleta de estado ──────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  "En curso":  "#0078D4",
  "Pendiente": "#8A8886",
  "Bloqueado": "#D83B01",
  "Cerrado":   "#107C10",
};

const PRIORITY_COLOR: Record<string, string> = {
  "Alta":  "#D83B01",
  "Media": "#F7630C",
  "Baja":  "#8A8886",
};

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();

  const [projects, setProjects]   = useState<Project[]>([]);
  const [areas, setAreas]         = useState<BusinessArea[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Filtros
  const [areaId, setAreaId]             = useState("");
  const [status, setStatus]             = useState("");
  const [deliveryType, setDeliveryType] = useState("");
  const [query, setQuery]               = useState("");

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProjects({ areaId, status, deliveryOwnerType: deliveryType, query });
      setProjects(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error cargando proyectos");
    } finally {
      setLoading(false);
    }
  }, [areaId, status, deliveryType, query]);

  // Cargar catálogos una vez
  useEffect(() => {
    Promise.all([getBusinessAreas(), getProviders()])
      .then(([a, p]) => { setAreas(a); setProviders(p); })
      .catch(() => {/* catálogos no críticos */});
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // ── Render ──────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200 }}>
      <h1 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, color: "#1B2A3E" }}>
        Proyectos
      </h1>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <input
          placeholder="Buscar..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={inputStyle}
        />
        <select value={areaId} onChange={e => setAreaId(e.target.value)} style={inputStyle}>
          <option value="">Todas las áreas</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
          <option value="">Todos los estados</option>
          {["En curso", "Pendiente", "Bloqueado", "Cerrado"].map(s =>
            <option key={s} value={s}>{s}</option>
          )}
        </select>
        <select value={deliveryType} onChange={e => setDeliveryType(e.target.value)} style={inputStyle}>
          <option value="">Ejecución: Todos</option>
          <option value="IT">IT AirEuropa</option>
          <option value="Proveedor">Proveedor</option>
        </select>
      </div>

      {/* Estados */}
      {loading && <p style={{ color: "#8A8886" }}>Cargando proyectos…</p>}
      {error   && <p style={{ color: "#D83B01" }}>{error}</p>}

      {/* Tabla */}
      {!loading && !error && (
        projects.length === 0
          ? <EmptyState message="No hay proyectos para los filtros seleccionados." />
          : (
            <table style={tableStyle}>
              <thead>
                <tr style={{ background: "#F3F2F1" }}>
                  {["Código", "Proyecto", "Área", "Ejecución", "Proveedor", "Estado", "Prioridad", "Avance"].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const area = areas.find(a => a.id === p.businessAreaId);
                  const provider = p.providerId ? providers.find(pv => pv.id === p.providerId) : null;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      style={{ cursor: "pointer", borderBottom: "1px solid #EDEBE9" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = "#F3F2F1"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                    >
                      <td style={tdStyle}>
                        <code style={{ fontSize: 11, color: "#8A8886" }}>{p.code}</code>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 600, maxWidth: 280 }}>
                        {p.name}
                        {p.blockedReason && (
                          <div style={{ fontSize: 11, color: "#D83B01", marginTop: 2 }}>
                            ⚠ {p.blockedReason}
                          </div>
                        )}
                      </td>
                      <td style={tdStyle}>{area?.name ?? p.businessAreaId}</td>
                      <td style={tdStyle}>{p.deliveryOwnerType}</td>
                      <td style={tdStyle}>{provider?.name ?? "—"}</td>
                      <td style={tdStyle}>
                        <Chip label={p.status} color={STATUS_COLOR[p.status] ?? "#8A8886"} />
                      </td>
                      <td style={tdStyle}>
                        <Chip label={p.priority} color={PRIORITY_COLOR[p.priority] ?? "#8A8886"} />
                      </td>
                      <td style={{ ...tdStyle, minWidth: 100 }}>
                        <ProgressBar value={p.progress} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
      )}
    </div>
  );
};

// ── Micro-componentes ─────────────────────────────────────
const Chip: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{
    display: "inline-block", padding: "2px 8px", borderRadius: 12,
    fontSize: 11, fontWeight: 600, color: "#fff", background: color,
    whiteSpace: "nowrap",
  }}>{label}</span>
);

const ProgressBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <div style={{ flex: 1, height: 6, background: "#EDEBE9", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: value === 100 ? "#107C10" : "#0078D4", borderRadius: 3 }} />
    </div>
    <span style={{ fontSize: 11, color: "#8A8886", width: 28, textAlign: "right" }}>{value}%</span>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ textAlign: "center", padding: "60px 0", color: "#8A8886" }}>
    <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
    <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
  </div>
);

// ── Estilos inline ────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: "6px 10px", border: "1px solid #EDEBE9", borderRadius: 4,
  fontSize: 13, fontFamily: "'Segoe UI', sans-serif", minWidth: 140,
};

const tableStyle: React.CSSProperties = {
  width: "100%", borderCollapse: "collapse", fontSize: 13,
  fontFamily: "'Segoe UI', sans-serif", background: "#fff",
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderRadius: 4, overflow: "hidden",
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px", textAlign: "left", fontWeight: 600,
  fontSize: 12, color: "#323130", borderBottom: "2px solid #EDEBE9",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px", color: "#323130", verticalAlign: "middle",
};
