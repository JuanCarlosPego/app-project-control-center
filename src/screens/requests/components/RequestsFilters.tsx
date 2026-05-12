// ─────────────────────────────────────────────────────────
//  src/screens/requests/components/RequestsFilters.tsx
//  Barra de filtros de Solicitudes.
//  NO incluye Año/Área/Proyecto — el scope viene de AppFilterContext.
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search, X } from "lucide-react";
import type { RequestFilters } from "../../../services/requestService";
import {
  REQUEST_STATUS_OPTIONS,
  REQUEST_TYPE_OPTIONS,
  REQUEST_TYPE_LABELS,
} from "../../../services/requestService";
import type { Priority } from "../../../types/domain";

export const EMPTY_REQUEST_FILTERS: RequestFilters = {
  status:   "",
  type:     "",
  priority: "",
  query:    "",
  mine:     false,
};

interface Props {
  filters: RequestFilters;
  onChange: (f: RequestFilters) => void;
  totalVisible: number;
  /** true si el usuario actual sólo puede ver sus propias solicitudes */
  canViewAll: boolean;
}

const SEL: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #C8C6C4",
  borderRadius: 5,
  fontSize: 12,
  background: "#fff",
  color: "#201F1E",
  cursor: "pointer",
  fontFamily: "'Segoe UI', sans-serif",
  appearance: "auto" as React.CSSProperties["appearance"],
  minWidth: 0,
};

const LBL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  fontSize: 11,
  color: "#605E5C",
  fontFamily: "'Segoe UI', sans-serif",
};

const PRIORITIES: Priority[] = ["Alta", "Media", "Baja"];

export const RequestsFilters: React.FC<Props> = ({
  filters, onChange, totalVisible, canViewAll,
}) => {
  const set = <K extends keyof RequestFilters>(k: K, v: RequestFilters[K]) =>
    onChange({ ...filters, [k]: v });

  const hasActive = !!(
    filters.status || filters.type || filters.priority ||
    filters.query  || filters.mine
  );

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #EDEBE9",
      borderRadius: 8,
      padding: "14px 16px",
      marginBottom: 16,
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      {/* Fila superior: contador + limpiar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: "#605E5C" }}>
          {totalVisible} {totalVisible === 1 ? "solicitud" : "solicitudes"}
          {hasActive && " · filtros activos"}
        </span>
        {hasActive && (
          <button
            onClick={() => onChange(EMPTY_REQUEST_FILTERS)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "4px 8px", border: "none", background: "transparent",
              color: "#D13438", cursor: "pointer", fontSize: 11,
              fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            <X size={11} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Fila de filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>

        {/* Estado */}
        <label style={LBL}>
          Estado
          <select
            value={filters.status ?? ""}
            onChange={e => set("status", e.target.value as RequestFilters["status"])}
            style={SEL}
          >
            <option value="">Todos</option>
            {REQUEST_STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        {/* Tipo */}
        <label style={LBL}>
          Tipo
          <select
            value={filters.type ?? ""}
            onChange={e => set("type", e.target.value as RequestFilters["type"])}
            style={SEL}
          >
            <option value="">Todos</option>
            {REQUEST_TYPE_OPTIONS.map(t => (
              <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>

        {/* Prioridad */}
        <label style={LBL}>
          Prioridad
          <select
            value={filters.priority ?? ""}
            onChange={e => set("priority", e.target.value as RequestFilters["priority"])}
            style={SEL}
          >
            <option value="">Todas</option>
            {PRIORITIES.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>

        {/* Búsqueda libre */}
        <label style={{ ...LBL, flex: 1, minWidth: 180 }}>
          Buscar
          <div style={{ position: "relative" }}>
            <Search size={13} style={{
              position: "absolute", left: 9, top: "50%",
              transform: "translateY(-50%)", color: "#8A8886", pointerEvents: "none",
            }} />
            <input
              type="text"
              value={filters.query ?? ""}
              onChange={e => set("query", e.target.value)}
              placeholder="Título, descripción…"
              style={{
                ...SEL, paddingLeft: 28, width: "100%",
                boxSizing: "border-box" as React.CSSProperties["boxSizing"],
                appearance: "none" as React.CSSProperties["appearance"],
              }}
            />
          </div>
        </label>

        {/* Toggle "mis solicitudes" — solo si puede ver todas */}
        {canViewAll && (
          <label style={{ ...LBL, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-end" }}>
            <input
              type="checkbox"
              checked={filters.mine ?? false}
              onChange={e => set("mine", e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <span style={{ fontSize: 12, color: "#201F1E", whiteSpace: "nowrap" }}>
              Solicitadas por mí
            </span>
          </label>
        )}
      </div>
    </div>
  );
};
