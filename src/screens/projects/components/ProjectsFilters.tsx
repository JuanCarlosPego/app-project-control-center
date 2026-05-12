// ─────────────────────────────────────────────────────────
//  src/screens/projects/components/ProjectsFilters.tsx
//  Barra de filtros: búsqueda, área, estado, ejecutor,
//  proveedor, categoría, "solicitadas por mí"
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search, X, UserCheck, Hourglass } from "lucide-react";
import type { Provider } from "../../../types/domain";

export interface FilterState {
  query:              string;
  status:             string;
  deliveryOwnerType:  string;
  providerId:         string;
  category:           string;
  onlyMine:           boolean;  // "Solicitadas por mí"
  onlyAssignedToMe:   boolean;  // assignedToUserId === currentUser
  onlyWaitingOnOthers: boolean; // requestedByUserId === currentUser AND assignedToUserId ≠ currentUser
}

export const EMPTY_FILTERS: FilterState = {
  query: "", status: "", deliveryOwnerType: "",
  providerId: "", category: "",
  onlyMine: false, onlyAssignedToMe: false, onlyWaitingOnOthers: false,
};

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  providers: Provider[];
  categories: string[];
  canSeeOnlyMine: boolean;   // false para Proveedor (ya filtrado por rol)
}

const sel: React.CSSProperties = {
  padding: "5px 8px", border: "1px solid #EDEBE9", borderRadius: 5,
  fontSize: 12, fontFamily: "'Segoe UI', sans-serif", background: "#fff",
  color: "#323130", minWidth: 130, cursor: "pointer",
};

export const ProjectsFilters: React.FC<Props> = ({
  filters, onChange, providers, categories, canSeeOnlyMine,
}) => {
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  const hasActiveFilters =
    filters.query || filters.status ||
    filters.deliveryOwnerType || filters.providerId ||
    filters.category || filters.onlyMine ||
    filters.onlyAssignedToMe || filters.onlyWaitingOnOthers;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>

      {/* Búsqueda */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#8A8886" }} />
        <input
          placeholder="Buscar código o nombre…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          style={{ ...sel, paddingLeft: 28, minWidth: 200 }}
        />
      </div>

      {/* Estado */}
      <select value={filters.status} onChange={(e) => set({ status: e.target.value })} style={sel}>
        <option value="">Todos los estados</option>
        {["En curso", "Pendiente", "Bloqueado", "Cerrado"].map((s) =>
          <option key={s} value={s}>{s}</option>
        )}
      </select>

      {/* Ejecutor */}
      <select
        value={filters.deliveryOwnerType}
        onChange={(e) => set({ deliveryOwnerType: e.target.value, providerId: "" })}
        style={sel}
      >
        <option value="">Todos los ejecutores</option>
        <option value="IT">IT AirEuropa</option>
        <option value="Proveedor">Proveedor</option>
      </select>

      {/* Proveedor (solo cuando ejecutor=Proveedor o hay valor) */}
      {(filters.deliveryOwnerType === "Proveedor" || filters.providerId) && (
        <select value={filters.providerId} onChange={(e) => set({ providerId: e.target.value })} style={sel}>
          <option value="">Todos los proveedores</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}

      {/* Categoría */}
      {categories.length > 0 && (
        <select value={filters.category} onChange={(e) => set({ category: e.target.value })} style={sel}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Solicitadas por mí */}
      {canSeeOnlyMine && (
        <label
          style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12,
            color: filters.onlyMine ? "#0078D4" : "#605E5C",
            cursor: "pointer", padding: "5px 10px",
            border: `1px solid ${filters.onlyMine ? "#0078D4" : "#EDEBE9"}`,
            borderRadius: 5, background: filters.onlyMine ? "#EFF6FF" : "#fff",
            fontFamily: "'Segoe UI', sans-serif", fontWeight: filters.onlyMine ? 600 : 400,
            transition: "all 150ms", userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={filters.onlyMine}
            onChange={(e) => set({ onlyMine: e.target.checked })}
            style={{ accentColor: "#0078D4", width: 13, height: 13 }}
          />
          Solicitadas por mí
        </label>
      )}

      {/* Asignadas a mí */}
      {canSeeOnlyMine && (
        <button
          type="button"
          onClick={() => set({ onlyAssignedToMe: !filters.onlyAssignedToMe })}
          title="Proyectos donde soy el responsable asignado"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12,
            cursor: "pointer", padding: "5px 10px",
            border: `1px solid ${filters.onlyAssignedToMe ? "#0078D4" : "#EDEBE9"}`,
            borderRadius: 5, background: filters.onlyAssignedToMe ? "#EFF6FF" : "#fff",
            color: filters.onlyAssignedToMe ? "#0078D4" : "#605E5C",
            fontFamily: "'Segoe UI', sans-serif", fontWeight: filters.onlyAssignedToMe ? 600 : 400,
            transition: "all 150ms",
          }}
        >
          <UserCheck size={12} /> Asignadas a mí
        </button>
      )}

      {/* Esperando a terceros */}
      {canSeeOnlyMine && (
        <button
          type="button"
          onClick={() => set({ onlyWaitingOnOthers: !filters.onlyWaitingOnOthers })}
          title="Proyectos que solicías tú pero están asignados a otra persona"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12,
            cursor: "pointer", padding: "5px 10px",
            border: `1px solid ${filters.onlyWaitingOnOthers ? "#C8A600" : "#EDEBE9"}`,
            borderRadius: 5, background: filters.onlyWaitingOnOthers ? "#FFF9E6" : "#fff",
            color: filters.onlyWaitingOnOthers ? "#C8A600" : "#605E5C",
            fontFamily: "'Segoe UI', sans-serif", fontWeight: filters.onlyWaitingOnOthers ? 600 : 400,
            transition: "all 150ms",
          }}
        >
          <Hourglass size={12} /> Esperando a terceros
        </button>
      )}

      {/* Limpiar filtros */}
      {hasActiveFilters && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          title="Limpiar todos los filtros"
          style={{
            display: "flex", alignItems: "center", gap: 4, padding: "5px 10px",
            border: "1px solid #EDEBE9", borderRadius: 5, cursor: "pointer",
            fontSize: 12, background: "#fff", color: "#D83B01",
            fontFamily: "'Segoe UI', sans-serif",
          }}
        >
          <X size={12} />
          Limpiar
        </button>
      )}
    </div>
  );
};
