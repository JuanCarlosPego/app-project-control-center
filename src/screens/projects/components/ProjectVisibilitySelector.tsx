// ─────────────────────────────────────────────────────────
//  src/screens/projects/components/ProjectVisibilitySelector.tsx
//
//  Selector de visibilidad de proyecto.
//    "Enterprise" → cualquier usuario autenticado ve el proyecto.
//    "Restricted"  → solo usuarios cuyos teamIds intersecten con
//                    los visibilityTeamIds del proyecto.
//
//  Admin siempre hace bypass (lo gestiona el backend).
//
//  Props:
//    mode            → valor actual de VisibilityMode
//    teamIds         → equipos seleccionados actualmente
//    availableTeams  → equipos disponibles para selección
//    onChange        → callback cuando cambia modo o equipos
//    disabled?       → deshabilita la edición
// ─────────────────────────────────────────────────────────

import React from "react";
import { Globe, Lock } from "lucide-react";
import type { Team, VisibilityMode } from "../../../types/domain";

// ── Tokens ────────────────────────────────────────────────
const C = {
  primary:   "#0078D4",
  border:    "#EDEBE9",
  text:      "#201F1E",
  textMid:   "#605E5C",
  textMuted: "#A19F9D",
  danger:    "#D13438",
  bgCard:    "#FAFAFA",
  bgActive:  "#EFF6FC",
  blue:      "rgba(40,153,245,0.12)",
};

// Colores por tipo de equipo para las chips
const TEAM_TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  Internal: { bg: "rgba(40,153,245,0.12)", color: "#1671B4" },
  Provider: { bg: "rgba(16,124,16,0.10)",  color: "#0E6B0E" },
  Area:     { bg: "rgba(255,170,68,0.14)", color: "#9B4F00" },
};

interface ProjectVisibilitySelectorProps {
  mode: VisibilityMode;
  teamIds: string[];
  availableTeams: Team[];
  onChange: (mode: VisibilityMode, teamIds: string[]) => void;
  disabled?: boolean;
  error?: string;
}

export const ProjectVisibilitySelector: React.FC<ProjectVisibilitySelectorProps> = ({
  mode, teamIds, availableTeams, onChange, disabled = false, error,
}) => {
  // ── Handlers ──────────────────────────────────────────
  const handleModeChange = (newMode: VisibilityMode) => {
    if (disabled) return;
    onChange(newMode, teamIds);
  };

  const toggleTeam = (teamId: string) => {
    if (disabled) return;
    const next = teamIds.includes(teamId)
      ? teamIds.filter((id) => id !== teamId)
      : [...teamIds, teamId];
    onChange(mode, next);
  };

  // ── Render ────────────────────────────────────────────
  return (
    <div style={{
      border: `1px solid ${error ? C.danger : C.border}`,
      borderRadius: 8,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
      background: C.bgCard,
      opacity: disabled ? 0.65 : 1,
    }}>
      {/* Encabezado */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: C.textMid,
        textTransform: "uppercase", letterSpacing: "0.05em",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        Visibilidad del proyecto
      </div>

      {/* Toggle Enterprise / Restricted */}
      <div style={{ display: "flex", gap: 10 }}>
        {/* Enterprise */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange("Enterprise")}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 8,
            border: `1.5px solid ${mode === "Enterprise" ? C.primary : C.border}`,
            background: mode === "Enterprise" ? C.bgActive : "#fff",
            cursor: disabled ? "default" : "pointer",
            display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left",
            transition: "border-color 150ms, background 150ms",
          }}
        >
          <Globe
            size={18}
            style={{
              color: mode === "Enterprise" ? C.primary : C.textMuted,
              flexShrink: 0, marginTop: 1,
            }}
          />
          <div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: mode === "Enterprise" ? C.primary : C.text,
            }}>
              Toda la organización
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Visible para todos los usuarios autenticados
            </div>
          </div>
        </button>

        {/* Restricted */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange("Restricted")}
          style={{
            flex: 1, padding: "10px 14px", borderRadius: 8,
            border: `1.5px solid ${mode === "Restricted" ? C.primary : C.border}`,
            background: mode === "Restricted" ? C.bgActive : "#fff",
            cursor: disabled ? "default" : "pointer",
            display: "flex", alignItems: "flex-start", gap: 10, textAlign: "left",
            transition: "border-color 150ms, background 150ms",
          }}
        >
          <Lock
            size={18}
            style={{
              color: mode === "Restricted" ? C.primary : C.textMuted,
              flexShrink: 0, marginTop: 1,
            }}
          />
          <div>
            <div style={{
              fontSize: 12, fontWeight: 600,
              color: mode === "Restricted" ? C.primary : C.text,
            }}>
              Restringido a equipos
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
              Solo los equipos seleccionados podrán ver el proyecto
            </div>
          </div>
        </button>
      </div>

      {/* Lista de equipos — solo cuando Restricted */}
      {mode === "Restricted" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: C.textMid, fontWeight: 600 }}>
            Equipos con acceso
            {teamIds.length > 0 && (
              <span style={{
                marginLeft: 6, background: C.blue, color: C.primary,
                borderRadius: 10, fontSize: 10, padding: "1px 7px", fontWeight: 700,
              }}>
                {teamIds.length}
              </span>
            )}
          </div>

          {availableTeams.length === 0 ? (
            <div style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>
              Cargando equipos…
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {availableTeams.map((team) => {
                const selected = teamIds.includes(team.id);
                const typeColor = TEAM_TYPE_COLOR[team.type] ?? TEAM_TYPE_COLOR.Area;
                return (
                  <button
                    key={team.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleTeam(team.id)}
                    title={`${team.name} (${team.type})`}
                    style={{
                      padding: "4px 10px", borderRadius: 12, fontSize: 11, fontWeight: 500,
                      cursor: disabled ? "default" : "pointer",
                      border: `1.5px solid ${selected ? typeColor.color : C.border}`,
                      background: selected ? typeColor.bg : "#fff",
                      color: selected ? typeColor.color : C.textMid,
                      transition: "all 150ms",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    {selected && (
                      <span style={{ fontSize: 9, fontWeight: 800 }}>✓</span>
                    )}
                    {team.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Mensaje de validación */}
          {teamIds.length === 0 && (
            <div style={{ fontSize: 10, color: C.danger }}>
              Selecciona al menos un equipo para el acceso restringido
            </div>
          )}
        </div>
      )}

      {/* Error externo */}
      {error && (
        <div style={{ fontSize: 10, color: C.danger }}>{error}</div>
      )}
    </div>
  );
};
