// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/DashboardFilters.tsx
//  Barra de filtros compacta del Dashboard:
//  ejecutor, proveedor (condicional), "mías"
//  (año y área gestionados por GlobalFilterBar)
// ─────────────────────────────────────────────────────────

import React from "react";
import { X } from "lucide-react";
import type { Provider } from "../../../types/domain";

export interface DashboardFilterState {
  deliveryOwnerType: string;
  providerId:        string;
  onlyMine:          boolean;
}

export const EMPTY_DASH_FILTERS: DashboardFilterState = {
  deliveryOwnerType: "", providerId: "", onlyMine: false,
};

interface Props {
  filters:        DashboardFilterState;
  onChange:       (f: DashboardFilterState) => void;
  providers:      Provider[];
  canSeeOnlyMine: boolean;  // false para Proveedor
}

const SEL: React.CSSProperties = {
  padding: "4px 8px", border: "1px solid #EDEBE9", borderRadius: 5,
  fontSize: 12, fontFamily: "'Segoe UI', sans-serif",
  background: "#fff", color: "#323130", cursor: "pointer",
};

export const DashboardFilters: React.FC<Props> = ({
  filters, onChange, providers, canSeeOnlyMine,
}) => {
  const set = (patch: Partial<DashboardFilterState>) => onChange({ ...filters, ...patch });

  const hasActive =
    filters.deliveryOwnerType ||
    filters.providerId || filters.onlyMine;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      background: "#fff", border: "1px solid #EDEBE9", borderRadius: 8,
      padding: "8px 14px", marginBottom: 14,
    }}>
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

      {/* Limpiar filtros */}
      {hasActive && (
        <button
          onClick={() => onChange(EMPTY_DASH_FILTERS)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            padding: "4px 9px", borderRadius: 5, border: "1px solid #EDEBE9",
            background: "transparent", fontSize: 11, cursor: "pointer",
            color: "#D83B01", fontFamily: "'Segoe UI', sans-serif",
            marginLeft: "auto",
          }}
        >
          <X size={10} /> Limpiar
        </button>
      )}
    </div>
  );
};
