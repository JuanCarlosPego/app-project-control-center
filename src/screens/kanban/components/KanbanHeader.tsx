// ─────────────────────────────────────────────────────────
//  src/screens/kanban/components/KanbanHeader.tsx
//  Breadcrumb de contexto global (Año · Área · Proyecto)
//  El filtro de proyecto es exclusivo del Contexto Global (Topbar).
//  - Botón "Ver Backlog" navega a /backlog?projectId=...
// ─────────────────────────────────────────────────────────

import React from "react";
import { RefreshCw, Kanban, List, ArrowRight, Calendar, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  /** ID del proyecto seleccionado en el contexto global ('' | "all" = todos) */
  selectedProjectId: string;
  /** Nombre legible del proyecto (ya derivado en KanbanPage) */
  projectName: string;
  /** Año del ámbito global */
  selectedYear: number;
  /** Nombre del área seleccionada ('' = todas las áreas) */
  areaName: string;
  onRefresh: () => void;
  loading: boolean;
}

export const KanbanHeader: React.FC<Props> = ({
  selectedProjectId, projectName, selectedYear, areaName,
  onRefresh, loading,
}) => {
  const navigate = useNavigate();

  const isAll = !selectedProjectId || selectedProjectId === "all";

  const handleViewBacklog = () => {
    const qs = !isAll ? `?projectId=${selectedProjectId}` : "";
    navigate(`/backlog${qs}`);
  };

  return (
    <div style={{
      borderBottom: "1px solid #EDEBE9",
      background: "#fff",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      {/* Fila principal */}
      <div style={{
        padding: "10px 16px 8px",
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        {/* Icon + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
          <Kanban size={18} color="#0078D4" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#201F1E" }}>
            Kanban
          </span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Ver Backlog */}
        <button
          onClick={handleViewBacklog}
          title={!isAll ? "Ver el Backlog de este proyecto" : "Ver Backlog completo"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "7px 13px", borderRadius: 6,
            border: "1px solid #0078D4", background: "#EFF6FC",
            color: "#0078D4", cursor: "pointer",
            fontSize: 12, fontWeight: 600,
          }}
        >
          <List size={13} />
          Ver Backlog
          <ArrowRight size={12} />
        </button>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Recargar"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "7px 13px", borderRadius: 6,
            border: "1px solid #EDEBE9", background: "#fff",
            color: "#605E5C", cursor: loading ? "not-allowed" : "pointer",
            fontSize: 12, opacity: loading ? 0.6 : 1,
          }}
        >
          <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
          Actualizar
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </button>
      </div>

      {/* Breadcrumb de contexto: Año · Área · Proyecto */}
      <div style={{
        padding: "0 16px 8px",
        display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
      }}>
        {/* Año */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11, color: "#0078D4", fontWeight: 600,
          background: "#EFF6FC", borderRadius: 4, padding: "2px 8px",
          border: "1px solid #C7E0F4",
        }}>
          <Calendar size={10} />
          <span style={{ color: "#A19F9D", fontWeight: 400 }}>Año:</span>
          <span>{selectedYear}</span>
        </span>

        <span style={{ color: "#C8C6C4", fontSize: 11 }}>·</span>

        {/* Área */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11, color: "#605E5C",
        }}>
          <Layers size={10} color="#A19F9D" />
          <span style={{ color: "#A19F9D" }}>Área:</span>
          <span style={{ fontWeight: 600, color: "#323130" }}>
            {areaName || "Todas las áreas"}
          </span>
        </span>

        <span style={{ color: "#C8C6C4", fontSize: 11 }}>·</span>

        {/* Proyecto — badge amarillo cuando es "Todos" para máxima visibilidad */}
        <span style={{
          fontSize: 11, color: "#605E5C",
          display: "inline-flex", alignItems: "center", gap: 4,
          overflow: "hidden",
          ...(isAll ? {
            background: "#FFF4CE", borderRadius: 4, padding: "2px 8px",
            border: "1px solid #F4D180",
          } : {}),
        }}>
          <span style={{ color: "#A19F9D", whiteSpace: "nowrap" }}>Proyecto:</span>
          <span style={{
            fontWeight: 600,
            color: isAll ? "#835B00" : "#323130",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            maxWidth: 260,
          }}>
            {projectName}
          </span>
        </span>
      </div>
    </div>
  );
};

