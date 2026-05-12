// ─────────────────────────────────────────────────────────
//  src/screens/audit/components/AuditFilters.tsx
// ─────────────────────────────────────────────────────────

import React from "react";
import { Search, UserCheck, Hourglass } from "lucide-react";
import { color, font, radius, shadow, spacing, transition } from "../../../components/ui/tokens";
import type { AppUser } from "../../../types/domain";
import {
  ENTITY_TYPE_OPTIONS,
  EMPTY_AUDIT_FILTERS,
  hasActiveAuditFilters,
} from "../../../services/auditService";
import type { AuditFilters } from "../../../services/auditService";

interface AuditFiltersProps {
  filters:  AuditFilters;
  onChange: (f: AuditFilters) => void;
  users:    AppUser[];
}

// ── Estilos ──────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  height: 30,
  padding: `0 ${spacing[3]}px`,
  fontSize: font.size.sm,
  color: color.text,
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  outline: "none",
  cursor: "pointer",
  minWidth: 150,
};

const dateInputStyle: React.CSSProperties = {
  ...selectStyle,
  minWidth: 130,
  cursor: "text",
};

type ToggleColor = "danger" | "primary" | "warning";
const TOGGLE_PALETTE: Record<ToggleColor, { border: string; bg: string; fg: string }> = {
  danger:  { border: color.danger,  bg: color.dangerBg,  fg: color.danger },
  primary: { border: color.primary, bg: color.primaryBg, fg: color.primary },
  warning: { border: color.warning, bg: color.warningBg, fg: color.warning },
};

const Toggle: React.FC<{
  label: string; active: boolean; onClick: () => void;
  color?: ToggleColor; icon?: React.ReactNode;
}> = ({ label, active, onClick, color: col = "danger", icon }) => {
  const pal = TOGGLE_PALETTE[col];
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        height: 30, padding: `0 ${spacing[3]}px`,
        fontSize: font.size.sm, borderRadius: radius.full,
        border: `1px solid ${active ? pal.border : color.border}`,
        background: active ? pal.bg : "transparent",
        color: active ? pal.fg : color.textSecondary,
        fontWeight: active ? font.weight.semibold : font.weight.regular,
        cursor: "pointer", transition: `all ${transition.fast}`, whiteSpace: "nowrap",
      }}
    >
      {icon}
      {active && !icon && <span style={{ fontSize: 10 }}>✓</span>}
      {label}
    </button>
  );
};

// ── Acciones disponibles en el combo ─────────────────────
const ACTION_OPTIONS = [
  { value: "",                        label: "Todas las acciones" },
  { value: "STATE_CHANGED",           label: "Cambio de estado" },
  { value: "WORKITEM_CREATED",        label: "WorkItem creado" },
  { value: "EVIDENCE_ADDED",          label: "Evidencia añadida" },
  { value: "COMMENT_ADDED",           label: "Comentario añadido" },
  { value: "PROJECT_CREATED",         label: "Proyecto creado" },
  { value: "RISK_CREATED",            label: "Riesgo creado" },
  { value: "RISK_CLOSED",             label: "Riesgo cerrado" },
  { value: "RBAC_CHANGED",            label: "Cambio RBAC" },
  { value: "RBAC_RESET_TO_DEFAULTS",  label: "Reset RBAC" },
  { value: "SETTINGS_CHANGED",        label: "Cambio configuración" },
  { value: "WIP_LIMIT_CHANGED",       label: "Cambio límite WIP" },
  { value: "USER_CREATED",            label: "Usuario creado" },
  { value: "USER_DEACTIVATED",        label: "Usuario desactivado" },
];

const ROLE_OPTIONS = [
  { value: "", label: "Todos los roles" },
  { value: "Admin",        label: "Admin" },
  { value: "IT AirEuropa", label: "IT AirEuropa" },
  { value: "Proveedor",    label: "Proveedor" },
  { value: "Usuario",      label: "Usuario" },
];

// ── Componente ────────────────────────────────────────────
export const AuditFilters: React.FC<AuditFiltersProps> = ({
  filters, onChange, users,
}) => {
  const set = <K extends keyof AuditFilters>(k: K, v: AuditFilters[K]) =>
    onChange({ ...filters, [k]: v });

  const active = hasActiveAuditFilters(filters);

  return (
    <div style={{
      background: color.surface,
      border: `1px solid ${color.border}`,
      borderRadius: radius.md,
      boxShadow: shadow.xs,
      padding: `${spacing[4]}px ${spacing[6]}px`,
      marginBottom: spacing[5],
    }}>
      {/* Fila 1: búsqueda + entityType + acción + actor */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[3], alignItems: "center" }}>
        {/* Búsqueda libre */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          height: 30, padding: `0 ${spacing[3]}px`,
          border: `1px solid ${color.border}`, borderRadius: radius.sm,
          background: color.surface, minWidth: 220,
        }}>
          <Search size={13} color={color.textMuted} />
          <input
            type="text"
            placeholder="Buscar en auditoría..."
            value={filters.query ?? ""}
            onChange={(e) => set("query", e.target.value)}
            style={{
              border: "none", outline: "none", fontSize: font.size.sm,
              color: color.text, background: "transparent", width: "100%",
            }}
          />
        </div>

        {/* EntityType */}
        <select
          value={filters.entityType ?? ""}
          onChange={(e) => set("entityType", e.target.value as AuditFilters["entityType"])}
          style={{ ...selectStyle, minWidth: 170 }}
          aria-label="Filtrar por tipo de entidad"
        >
          {ENTITY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Acción */}
        <select
          value={filters.action ?? ""}
          onChange={(e) => set("action", e.target.value)}
          style={{ ...selectStyle, minWidth: 180 }}
          aria-label="Filtrar por acción"
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Actor / Usuario */}
        <select
          value={filters.actor ?? ""}
          onChange={(e) => set("actor", e.target.value)}
          style={{ ...selectStyle, minWidth: 160 }}
          aria-label="Filtrar por actor"
        >
          <option value="">Todos los actores</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName}</option>
          ))}
        </select>

        {/* Rol actor */}
        <select
          value={filters.actorRole ?? ""}
          onChange={(e) => set("actorRole", e.target.value)}
          style={{ ...selectStyle, minWidth: 150 }}
          aria-label="Filtrar por rol del actor"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Fila 2: rango fechas + toggle crítico */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: spacing[3],
        alignItems: "center", marginTop: spacing[3],
      }}>
        <span style={{ fontSize: font.size.xs, color: color.textMuted, minWidth: 35 }}>Desde</span>
        <input
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => set("from", e.target.value)}
          style={dateInputStyle}
          aria-label="Fecha desde"
        />
        <span style={{ fontSize: font.size.xs, color: color.textMuted }}>hasta</span>
        <input
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => set("to", e.target.value)}
          style={dateInputStyle}
          aria-label="Fecha hasta"
        />

        <div style={{ width: 1, height: 22, background: color.border, margin: `0 ${spacing[1]}px` }} />

        <Toggle
          label="Solo cambios críticos"
          active={!!filters.onlyCritical}
          onClick={() => set("onlyCritical", !filters.onlyCritical)}
        />

        <div style={{ width: 1, height: 22, background: color.border, margin: `0 ${spacing[1]}px` }} />

        <Toggle
          label="Me afecta"
          active={!!filters.onlyAffectsMe}
          onClick={() => set("onlyAffectsMe", !filters.onlyAffectsMe)}
          color="primary"
          icon={<UserCheck size={12} />}
        />
        <Toggle
          label="Esperando a terceros"
          active={!!filters.onlyWaitingOnOthers}
          onClick={() => set("onlyWaitingOnOthers", !filters.onlyWaitingOnOthers)}
          color="warning"
          icon={<Hourglass size={12} />}
        />

        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_AUDIT_FILTERS)}
            style={{
              marginLeft: "auto", height: 30, padding: `0 ${spacing[3]}px`,
              fontSize: font.size.sm, borderRadius: radius.sm,
              border: `1px solid ${color.border}`, background: "transparent",
              color: color.textMuted, cursor: "pointer",
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
};
