// ─────────────────────────────────────────────────────────
//  src/components/layout/GlobalFilterBar.tsx
//  Barra de ámbito global — siempre visible en la cabecera
//  de la zona de contenido principal.
//
//  Controla: año (flechas prev/next), área (select), proyecto (select).
//  Cualquier cambio se propaga a AppFilterContext y por cascada
//  a todas las pantallas que consumen useAppFilter().
// ─────────────────────────────────────────────────────────

import React from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal, X, MapPin } from "lucide-react";
import { useAppFilter } from "../../context/AppFilterContext";

// ── Estilos inline ────────────────────────────────────────
const SEL: React.CSSProperties = {
  padding: "3px 8px",
  border: "1px solid #BDD6EE",
  borderRadius: 5,
  fontSize: 12,
  fontFamily: "'Segoe UI', sans-serif",
  background: "#fff",
  color: "#1B2A3E",
  cursor: "pointer",
  maxWidth: 220,
};

const ARROW_BTN: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  border: "1px solid #BDD6EE",
  borderRadius: 4,
  background: "#fff",
  cursor: "pointer",
  color: "#005A9E",
  padding: 0,
  lineHeight: 1,
};

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 14,
  background: "#BDD6EE",
  alignSelf: "center",
  flexShrink: 0,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "#005A9E",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  whiteSpace: "nowrap",
};

// ── GlobalFilterBar ───────────────────────────────────────
export const GlobalFilterBar: React.FC = () => {
  const {
    selectedYear, selectedAreaId, selectedProjectId,
    areas, visibleAreas, projectsInScope,
    setYear, setArea, setProject, resetFilters,
  } = useAppFilter();

  const THIS_YEAR = new Date().getFullYear();
  const isDirty =
    selectedYear !== THIS_YEAR ||
    selectedAreaId !== "" ||
    selectedProjectId !== "";

  // ── Breadcrumb text (derived) ─────────────────────────
  const areaName    = selectedAreaId
    ? (areas.find((a) => a.id === selectedAreaId)?.name ?? selectedAreaId)
    : "Todas las áreas";
  const projectName = selectedProjectId
    ? (projectsInScope.find((p) => p.id === selectedProjectId)?.name ?? selectedProjectId)
    : "Todos los proyectos";

  return (
    <div
      role="toolbar"
      aria-label="Filtros de ámbito global"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "5px 20px",
        background: "linear-gradient(to right, #EBF3FB, #F0F6FF)",
        borderBottom: "1px solid #C7E0F4",
        flexShrink: 0,
        flexWrap: "wrap",
        minHeight: 36,
      }}
    >
      {/* Icono + etiqueta ÁMBITO */}
      <span style={{
        display: "flex", alignItems: "center", gap: 5,
        ...LABEL_STYLE,
      }}>
        <SlidersHorizontal size={12} color="#005A9E" />
        Ámbito
      </span>

      <span style={DIVIDER} />

      {/* ── Selector de año ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span style={{ ...LABEL_STYLE, marginRight: 3 }}>Año</span>
        <button
          style={ARROW_BTN}
          onClick={() => setYear(selectedYear - 1)}
          title={`Ir a ${selectedYear - 1}`}
          aria-label={`Año anterior: ${selectedYear - 1}`}
        >
          <ChevronLeft size={12} />
        </button>
        <span style={{
          fontSize: 13, fontWeight: 700, color: "#1B2A3E",
          minWidth: 38, textAlign: "center",
        }}>
          {selectedYear}
        </span>
        <button
          style={ARROW_BTN}
          onClick={() => setYear(selectedYear + 1)}
          title={`Ir a ${selectedYear + 1}`}
          aria-label={`Año siguiente: ${selectedYear + 1}`}
        >
          <ChevronRight size={12} />
        </button>
      </div>

      <span style={DIVIDER} />

      {/* ── Selector de área ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <label style={LABEL_STYLE} htmlFor="gfb-area">Área</label>
        <select
          id="gfb-area"
          value={selectedAreaId}
          onChange={(e) => setArea(e.target.value)}
          style={SEL}
        >
          <option value="">Todas las áreas</option>
          {visibleAreas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* ── Selector de proyecto (solo si hay proyectos en ámbito) ── */}
      {projectsInScope.length > 0 && (
        <>
          <span style={DIVIDER} />
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <label style={LABEL_STYLE} htmlFor="gfb-project">Proyecto</label>
            <select
              id="gfb-project"
              value={selectedProjectId}
              onChange={(e) => setProject(e.target.value)}
              style={SEL}
            >
              <option value="">Todos los proyectos</option>
              {projectsInScope.map((p) => (
                <option key={p.id} value={p.id}>{p.code} – {p.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {/* ── Reset (solo si hay algún filtro activo) ── */}
      {isDirty && (
        <>
          <span style={DIVIDER} />
          <button
            onClick={resetFilters}
            title="Restaurar ámbito por defecto"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 9px",
              border: "1px solid #C7E0F4",
              borderRadius: 4,
              background: "#fff",
              color: "#0078D4",
              fontSize: 11,
              fontFamily: "'Segoe UI', sans-serif",
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <X size={11} />
            Limpiar
          </button>
        </>
      )}

      {/* ── Breadcrumb contextual — siempre visible a la derecha ── */}
      <div
        aria-label="Contexto de filtrado activo"
        title={`Ámbito: ${selectedYear} · ${areaName} · ${projectName}`}
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 5,
          paddingLeft: 10,
          borderLeft: "1px solid #BDD6EE",
          flexShrink: 0,
        }}
      >
        <MapPin size={11} color="#8A8886" />
        <span style={{
          fontSize: 11,
          fontFamily: "'Segoe UI', sans-serif",
          color: "#605E5C",
          whiteSpace: "nowrap",
          maxWidth: 420,
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}>
          <span style={{ fontWeight: 700, color: "#0078D4" }}>{selectedYear}</span>
          <span style={{ color: "#C8C6C4", margin: "0 5px" }}>·</span>
          <span style={{ color: "#605E5C" }}>{areaName}</span>
          <span style={{ color: "#C8C6C4", margin: "0 5px" }}>·</span>
          <span style={{ fontWeight: 600, color: "#323130" }}>{projectName}</span>
        </span>
      </div>
    </div>
  );
};
