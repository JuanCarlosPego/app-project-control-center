// ─────────────────────────────────────────────────────────────────
//  src/components/layout/TestUserSwitcher.tsx
//  Bloque compacto de "Simular usuario" en el sidebar.
//
//  Expandido:
//    - Muestra usuario simulado actual (avatar + nombre + rol + equipos)
//    - Botón "Cambiar" → abre UserSwitcherModal
//    - Botón "Salir del modo simulación" (solo si hay simulación activa)
//
//  Colapsado: solo avatar con tooltip y botón de cambio.
// ─────────────────────────────────────────────────────────────────
import React, { useState } from "react";
import { UserCheck, RefreshCw, LogOut } from "lucide-react";
import { useImpersonation } from "../../auth/ImpersonationContext";
import { UserSwitcherModal } from "./UserSwitcherModal";

// ── Design tokens (hereda paleta del sidebar oscuro) ─────────────
const T = {
  border:  "rgba(255,255,255,0.08)",
  muted:   "rgba(255,255,255,0.42)",
  text:    "rgba(255,255,255,0.90)",
  hover:   "rgba(255,255,255,0.07)",
  accent:  "#2899F5",
  danger:  "#FF8C8C",
};

const ROLE_AVATAR: Record<string, string> = {
  "Admin":        "#7C3AED",
  "IT AirEuropa": "#0078D4",
  "Proveedor":    "#059669",
  "Usuario":      "#D97706",
  "Invitado":     "#6B7280",
};

const ROLE_CHIP: Record<string, { bg: string; text: string }> = {
  "Admin":        { bg: "rgba(124,58,237,0.20)", text: "#C4B5FD" },
  "IT AirEuropa": { bg: "rgba(40,153,245,0.20)", text: "#93C5FD" },
  "Proveedor":    { bg: "rgba(5,150,105,0.20)",  text: "#6EE7B7" },
  "Usuario":      { bg: "rgba(217,119,6,0.20)",  text: "#FCD34D" },
  "Invitado":     { bg: "rgba(107,114,128,0.20)", text: "#D1D5DB" },
};

function initials(name: string) {
  return name.split(" ").map(w => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}

interface Props { collapsed: boolean; }

export const TestUserSwitcher: React.FC<Props> = ({ collapsed }) => {
  const {
    realUser, effectiveUser, impersonatedUser,
    isImpersonating, setImpersonatedUser, clearImpersonation,
    teamNameMap,
  } = useImpersonation();

  const [modalOpen, setModalOpen] = useState(false);

  const avatarBg  = ROLE_AVATAR[effectiveUser.role] ?? "#6B7280";
  const chip      = ROLE_CHIP[effectiveUser.role] ?? ROLE_CHIP["Invitado"];
  const teamNames = (impersonatedUser?.teamIds ?? [])
    .map(id => teamNameMap[id])
    .filter(Boolean)
    .join(", ");

  // ── Colapsado: solo avatar + click para abrir modal ──────────────
  if (collapsed) {
    return (
      <div style={{ borderTop: `1px solid ${T.border}`, flexShrink: 0, padding: "8px 0" }}>
        <button
          onClick={() => setModalOpen(true)}
          title={`Simular usuario · ${effectiveUser.displayName} (${effectiveUser.role})`}
          aria-label="Cambiar usuario simulado"
          style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            width: "100%", border: "none", background: "none", cursor: "pointer",
            padding: "4px 0",
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: avatarBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 10, fontWeight: 700,
            border: isImpersonating ? `2px solid ${T.accent}` : "2px solid transparent",
          }}>
            {initials(effectiveUser.displayName)}
          </div>
        </button>
        <UserSwitcherModal
          open={modalOpen}
          effectiveUser={effectiveUser}
          realUser={realUser}
          onSelect={setImpersonatedUser}
          onClose={() => setModalOpen(false)}
        />
      </div>
    );
  }

  // ── Expandido ────────────────────────────────────────────────────
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
      {/* Encabezado */}
      <div style={{
        padding: "9px 14px 5px",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <UserCheck size={11} color={T.muted} />
        <span style={{
          color: T.muted, fontSize: 9, fontWeight: 700,
          letterSpacing: "0.10em", textTransform: "uppercase",
        }}>
          Simular usuario
        </span>
      </div>

      {/* Tarjeta del usuario actual */}
      <div style={{
        margin: "2px 10px 6px",
        padding: "8px 10px",
        borderRadius: 7,
        background: isImpersonating
          ? "rgba(40,153,245,0.12)"
          : "rgba(255,255,255,0.05)",
        border: `1px solid ${isImpersonating ? "rgba(40,153,245,0.35)" : T.border}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {/* Avatar */}
        <div style={{
          flexShrink: 0,
          width: 30, height: 30, borderRadius: "50%",
          background: avatarBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 11, fontWeight: 700,
          border: isImpersonating ? `2px solid ${T.accent}` : "2px solid transparent",
        }}>
          {initials(effectiveUser.displayName)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: T.text, fontSize: 11, fontWeight: 600,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {effectiveUser.displayName}
          </div>
          {teamNames ? (
            <div style={{
              color: T.muted, fontSize: 9,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {teamNames}
            </div>
          ) : null}
        </div>

        {/* Chip rol */}
        <span style={{
          flexShrink: 0,
          padding: "1px 7px", borderRadius: 10,
          background: chip.bg, color: chip.text,
          fontSize: 9, fontWeight: 700,
        }}>
          {effectiveUser.role === "IT AirEuropa" ? "IT AE" : effectiveUser.role}
        </span>
      </div>

      {/* Botón "Cambiar" */}
      <button
        onClick={() => setModalOpen(true)}
        aria-label="Cambiar usuario simulado"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          width: "calc(100% - 20px)", margin: "0 10px 4px",
          border: `1px solid rgba(40,153,245,0.40)`,
          background: "rgba(40,153,245,0.10)",
          color: T.accent, fontSize: 11, fontWeight: 600,
          borderRadius: 5, padding: "5px 10px",
          cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
          transition: "background 140ms",
          justifyContent: "center",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(40,153,245,0.20)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(40,153,245,0.10)";
        }}
      >
        <RefreshCw size={11} />
        Cambiar
      </button>

      {/* Botón "Salir" — solo si hay simulación activa */}
      {isImpersonating && (
        <button
          onClick={clearImpersonation}
          aria-label="Salir del modo simulación"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            width: "calc(100% - 20px)", margin: "0 10px 8px",
            border: "none",
            background: "rgba(255,140,140,0.10)",
            color: T.danger, fontSize: 11, fontWeight: 600,
            borderRadius: 5, padding: "5px 10px",
            cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
            transition: "background 140ms",
            justifyContent: "center",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,140,140,0.20)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,140,140,0.10)";
          }}
        >
          <LogOut size={11} />
          Salir del modo simulación
        </button>
      )}

      {/* Modal */}
      <UserSwitcherModal
        open={modalOpen}
        effectiveUser={effectiveUser}
        realUser={realUser}
        onSelect={setImpersonatedUser}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};
