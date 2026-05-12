// ─────────────────────────────────────────────────────────
//  src/screens/roadmap/components/RoadmapFilters.tsx
//  Barra de filtros del Roadmap:
//  búsqueda, área, estado, ejecutor, proveedor, "mías"
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search, X, Hourglass } from "lucide-react";
import type { Provider } from "../../../types/domain";

export interface RoadmapFilterState {
  query:             string;
  status:            string;
  deliveryOwnerType: string;
  providerId:        string;
  onlyMine:          boolean;
  onlyWaitingOnOthers: boolean;
}

export const EMPTY_ROADMAP_FILTERS: RoadmapFilterState = {
  query: "", status: "",
  deliveryOwnerType: "", providerId: "", onlyMine: false, onlyWaitingOnOthers: false,
};

interface Props {
  filters:        RoadmapFilterState;
  onChange:       (f: RoadmapFilterState) => void;
  providers:      Provider[];
  canSeeOnlyMine: boolean;
}

const SEL: React.CSSProperties = {
  padding: "5px 8px", border: "1px solid #EDEBE9", borderRadius: 5,
  fontSize: 12, fontFamily: "'Segoe UI', sans-serif",
  background: "#fff", color: "#323130", cursor: "pointer",
};

export const RoadmapFilters: React.FC<Props> = ({
  filters, onChange, providers, canSeeOnlyMine,
}) => {
  const set = (patch: Partial<RoadmapFilterState>) => onChange({ ...filters, ...patch });

  const hasActive =
    filters.query || filters.status ||
    filters.deliveryOwnerType || filters.providerId ||
    filters.onlyMine || filters.onlyWaitingOnOthers;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>

      {/* Búsqueda */}
      <div style={{ position: "relative" }}>
        <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#8A8886" }} />
        <input
          placeholder="Buscar código o nombre…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          style={{ ...SEL, paddingLeft: 26, minWidth: 190 }}
        />
      </div>

      {/* Estado */}
      <select value={filters.status} onChange={(e) => set({ status: e.target.value })} style={SEL}>
        <option value="">Todos los estados</option>
        {["En curso", "Pendiente", "Bloqueado", "Cerrado"].map((s) =>
          <option key={s} value={s}>{s}</option>
        )}
      </select>

      {/* Ejecutor */}
      <select
        value={filters.deliveryOwnerType}
        onChange={(e) => set({ deliveryOwnerType: e.target.value, providerId: "" })}
        style={SEL}
      >
        <option value="">Todos los ejecutores</option>
        <option value="IT">IT AirEuropa</option>
        <option value="Proveedor">Proveedor</option>
      </select>

      {/* Proveedor (solo si ejecutor = Proveedor) */}
      {filters.deliveryOwnerType === "Proveedor" && (
        <select value={filters.providerId} onChange={(e) => set({ providerId: e.target.value })} style={SEL}>
          <option value="">Todos los proveedores</option>
          {providers.map((pv) => <option key={pv.id} value={pv.id}>{pv.name}</option>)}
        </select>
      )}

      {/* Solicitadas por mí */}
      {canSeeOnlyMine && (
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer", color: "#323130" }}>
          <input
            type="checkbox"
            checked={filters.onlyMine}
            onChange={(e) => set({ onlyMine: e.target.checked })}
            style={{ accentColor: "#0078D4" }}
          />
          Solicitadas por mí
        </label>
      )}

      {/* Esperando a terceros */}
      {canSeeOnlyMine && (
        <button
          type="button"
          onClick={() => set({ onlyWaitingOnOthers: !filters.onlyWaitingOnOthers })}
          title="Proyectos que solicité yo pero asignados a otra persona"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12,
            cursor: "pointer", padding: "4px 10px",
            border: `1px solid ${filters.onlyWaitingOnOthers ? "#C8A600" : "#EDEBE9"}`,
            borderRadius: 5, background: filters.onlyWaitingOnOthers ? "#FFF9E6" : "#fff",
            color: filters.onlyWaitingOnOthers ? "#C8A600" : "#605E5C",
            fontFamily: "'Segoe UI', sans-serif",
            fontWeight: filters.onlyWaitingOnOthers ? 600 : 400, transition: "all 150ms",
          }}
        >
          <Hourglass size={11} /> Esperando a terceros
        </button>
      )}

      {/* Limpiar */}
      {hasActive && (
        <button
          onClick={() => onChange(EMPTY_ROADMAP_FILTERS)}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "5px 10px", borderRadius: 5, border: "1px solid #EDEBE9",
            background: "#FAF9F8", fontSize: 12, cursor: "pointer",
            color: "#D83B01", fontFamily: "'Segoe UI', sans-serif",
          }}
        >
          <X size={11} /> Limpiar
        </button>
      )}
    </div>
  );
};
