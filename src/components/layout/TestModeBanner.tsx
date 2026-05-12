// ─────────────────────────────────────────────────────────────────
//  src/components/layout/TestModeBanner.tsx
//  Banner sticky global que aparece en todas las pantallas
//  cuando hay simulación activa (isImpersonating = true).
//
//  Contenido: icono + "Modo simulación activo: <nombre> (<rol> · <equipo>)" + Reset
// ─────────────────────────────────────────────────────────────────
import React from "react";
import { UserCheck, X } from "lucide-react";
import { useImpersonation } from "../../auth/ImpersonationContext";

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  "Admin":        { bg: "#EDE9FE", text: "#5B21B6" },
  "IT AirEuropa": { bg: "#EFF6FF", text: "#1D4ED8" },
  "Proveedor":    { bg: "#ECFDF5", text: "#065F46" },
  "Usuario":      { bg: "#FFFBEB", text: "#92400E" },
  "Invitado":     { bg: "#F3F2F1", text: "#323130" },
};

export const TestModeBanner: React.FC = () => {
  const {
    isImpersonating, effectiveUser, realUser,
    clearImpersonation, teamNameMap,
  } = useImpersonation();

  if (!isImpersonating) return null;

  const chip = ROLE_COLORS[effectiveUser.role] ?? ROLE_COLORS["Invitado"];

  // Resolver nombres de equipos del usuario simulado
  const teamNames = (effectiveUser.teamIds ?? [])
    .map((id) => teamNameMap[id])
    .filter(Boolean);
  const teamLabel = teamNames.length > 0 ? teamNames.join(" / ") : null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 16px",
        background: "#EFF6FF",
        borderBottom: "1.5px solid #2563EB",
        fontFamily: "'Segoe UI', sans-serif",
        flexWrap: "wrap",
      }}
    >
      {/* Icono */}
      <UserCheck size={15} color="#1D4ED8" style={{ flexShrink: 0 }} />

      {/* Texto principal */}
      <span style={{ fontSize: 12, color: "#1E3A8A", fontWeight: 500, flex: 1 }}>
        <strong>Modo simulación activo:</strong>{" "}
        <strong>{effectiveUser.displayName}</strong>
        {" "}
        {/* Chip: rol · equipo */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "1px 9px", borderRadius: 10,
          background: chip.bg, color: chip.text,
          fontSize: 11, fontWeight: 600, marginLeft: 2,
        }}>
          {effectiveUser.role}
          {teamLabel && (
            <>
              <span style={{ opacity: 0.4 }}>·</span>
              {teamLabel}
            </>
          )}
        </span>
      </span>

      {/* Info usuario real */}
      <span style={{ fontSize: 11, color: "#1D4ED8", whiteSpace: "nowrap", opacity: 0.75 }}>
        Sesión real: {realUser.displayName}
      </span>

      {/* Botón Reset */}
      <button
        onClick={clearImpersonation}
        aria-label="Salir del modo simulación"
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 12px", borderRadius: 5,
          border: "1px solid #2563EB",
          background: "#DBEAFE", color: "#1D4ED8",
          fontSize: 11, fontWeight: 600, cursor: "pointer",
          fontFamily: "'Segoe UI', sans-serif",
          transition: "background 140ms",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "#BFDBFE";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "#DBEAFE";
        }}
      >
        <X size={11} />
        Salir del modo simulación
      </button>
    </div>
  );
};
