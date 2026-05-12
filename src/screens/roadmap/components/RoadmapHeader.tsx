// ─────────────────────────────────────────────────────────
//  src/screens/roadmap/components/RoadmapHeader.tsx
//  Cabecera de la pantalla Roadmap:
//  - Título + año con flechas
//  - Chips de alerta: bloqueados, vencimientos, zoom
//  - GroupBy selector
//  - Botón "Hoy" y botones de acción
// ─────────────────────────────────────────────────────────

import React from "react";
import { ChevronLeft, ChevronRight, AlertTriangle, CalendarClock, RefreshCw } from "lucide-react";
import type { Project } from "../../../types/domain";
import type { ZoomLevel, GroupBy } from "../tokens";
import { GROUP_LABELS } from "../tokens";

interface Props {
  year:       number;
  onYearPrev: () => void;
  onYearNext: () => void;
  zoom:       ZoomLevel;
  onZoom:     (z: ZoomLevel) => void;
  groupBy:    GroupBy;
  onGroupBy:  (g: GroupBy) => void;
  projects:   Project[];    // todos los proyectos del año (sin filtros de KPI)
  loading:    boolean;
  onRefresh:  () => void;
}

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

const ZOOM_LEVELS: { key: ZoomLevel; label: string }[] = [
  { key: "year",    label: "Año" },
  { key: "quarter", label: "Trimestre" },
  { key: "month",   label: "Mes" },
  { key: "week",    label: "Semana" },
];

const GROUP_OPTIONS: GroupBy[] = ["area", "provider", "deliveryOwner", "category"];

export const RoadmapHeader: React.FC<Props> = ({
  year, onYearPrev, onYearNext,
  zoom, onZoom,
  groupBy, onGroupBy,
  projects,
  loading, onRefresh,
}) => {
  const blocked   = projects.filter((p) => p.status === "Bloqueado").length;
  const almostDue = projects.filter((p) => {
    const d = daysUntil(p.endDate);
    return d > 0 && d <= 14 && p.status !== "Cerrado";
  }).length;

  return (
    <div style={{
      background: "#fff", borderRadius: 10, border: "1px solid #EDEBE9",
      padding: "16px 20px", marginBottom: 16,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      {/* Fila 1: título + año + acciones */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1B2A3E" }}>
          Roadmap del Programa
        </h1>

        {/* Selector de año */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
          <IconBtn onClick={onYearPrev} title="Año anterior"><ChevronLeft size={14} /></IconBtn>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1B2A3E", minWidth: 44, textAlign: "center" }}>{year}</span>
          <IconBtn onClick={onYearNext} title="Año siguiente"><ChevronRight size={14} /></IconBtn>
        </div>

        {/* Alertas */}
        {blocked > 0 && (
          <AlertChip color="#D83B01" bg="#FDF3F0">
            <AlertTriangle size={11} /> {blocked} bloqueado{blocked !== 1 ? "s" : ""}
          </AlertChip>
        )}
        {almostDue > 0 && (
          <AlertChip color="#C8A600" bg="#FFFBE6">
            <CalendarClock size={11} /> {almostDue} vence{almostDue !== 1 ? "n" : ""} pronto
          </AlertChip>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {/* Refrescar */}
          <IconBtn onClick={onRefresh} title="Recargar datos" disabled={loading}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </IconBtn>
        </div>
      </div>

      {/* Fila 2: Zoom + Agrupar por */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {/* Zoom segmented control */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#8A8886", fontWeight: 600 }}>ZOOM</span>
          <div style={{ display: "flex", border: "1px solid #EDEBE9", borderRadius: 6, overflow: "hidden" }}>
            {ZOOM_LEVELS.map((z) => {
              const active = zoom === z.key;
              return (
                <button
                  key={z.key}
                  onClick={() => onZoom(z.key)}
                  style={{
                    padding: "4px 11px", fontSize: 11, border: "none",
                    borderRight: "1px solid #EDEBE9",
                    background: active ? "#0078D4" : "#fff",
                    color: active ? "#fff" : "#323130",
                    cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
                    fontWeight: active ? 700 : 400,
                    transition: "background 150ms",
                  }}
                >
                  {z.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Agrupar por */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#8A8886", fontWeight: 600 }}>AGRUPAR POR</span>
          <div style={{ display: "flex", border: "1px solid #EDEBE9", borderRadius: 6, overflow: "hidden" }}>
            {GROUP_OPTIONS.map((g) => {
              const active = groupBy === g;
              return (
                <button
                  key={g}
                  onClick={() => onGroupBy(g)}
                  style={{
                    padding: "4px 11px", fontSize: 11, border: "none",
                    borderRight: "1px solid #EDEBE9",
                    background: active ? "#1B2A3E" : "#fff",
                    color: active ? "#fff" : "#323130",
                    cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
                    fontWeight: active ? 700 : 400,
                    transition: "background 150ms",
                  }}
                >
                  {GROUP_LABELS[g]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

// ── Micro-componentes ─────────────────────────────────────
const IconBtn: React.FC<{
  onClick: () => void; title: string; disabled?: boolean; children: React.ReactNode;
}> = ({ onClick, title, disabled, children }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: 28, height: 28, border: "1px solid #EDEBE9", borderRadius: 5,
      background: "#fff", cursor: disabled ? "not-allowed" : "pointer",
      color: "#323130", opacity: disabled ? 0.5 : 1,
      transition: "background 120ms",
    }}
    onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "#F3F2F1"; }}
    onMouseLeave={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
  >
    {children}
  </button>
);

const AlertChip: React.FC<{ color: string; bg: string; children: React.ReactNode }> = ({ color, bg, children }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600,
    color, background: bg, border: `1px solid ${color}30`,
    whiteSpace: "nowrap",
  }}>
    {children}
  </span>
);
