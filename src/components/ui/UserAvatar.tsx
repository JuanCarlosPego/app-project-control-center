// ─────────────────────────────────────────────────────────
//  src/components/ui/UserAvatar.tsx
//
//  Avatar circular con foto real (Office 365) o fallback de iniciales.
//  Patrón tomado de app-calen-vs:
//    - src/components/ui/TecnicoAvatar.jsx
//    - src/hooks/useTecnicoPhoto.js
//
//  En LOCAL: siempre muestra iniciales (useUserPhoto devuelve null).
//  En Power Apps: usa la foto de Microsoft 365 si está disponible.
// ─────────────────────────────────────────────────────────

import React from "react";
import { useUserPhoto } from "../../hooks/useUserPhoto";

// Paleta determinista para iniciales (sin necesidad de almacenar color)
const PALETTE = [
  "#0078D4", "#107C10", "#7530AF", "#CA8B00",
  "#D13438", "#00B294", "#E74856", "#2D7D9A",
  "#8E8CD8", "#986F0B", "#498205", "#C239B3",
];

function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

function initials(displayName: string): string {
  return (displayName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .join("")
    .slice(0, 2);
}

interface UserAvatarProps {
  displayName: string;
  upn?: string;
  size?: number; // px, default 36
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  displayName,
  upn,
  size = 36,
}) => {
  const { photoUrl } = useUserPhoto(upn);
  const bg = colorForName(displayName);
  const ini = initials(displayName);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={displayName}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
    );
  }

  return (
    <div
      aria-label={displayName}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: bg, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontWeight: 700,
        fontSize: Math.max(10, Math.round(size * 0.38)),
        fontFamily: "'Segoe UI', sans-serif",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        userSelect: "none",
      }}
    >
      {ini}
    </div>
  );
};
