// ─────────────────────────────────────────────────────────
//  src/components/ui/LockBadge.tsx
//  Icono 🔒 con tooltip estándar de "sin permisos".
//  Usado en filas de BacklogTable, cabecera de WorkItemDrawer,
//  y cualquier acción bloqueada por ownership/RBAC.
// ─────────────────────────────────────────────────────────

import React from "react";
import { Lock } from "lucide-react";
import { LOCK_TOOLTIP } from "../../auth/workItemPermissions";

interface Props {
  size?: number;
  tooltip?: string;
  style?: React.CSSProperties;
}

export const LockBadge: React.FC<Props> = ({
  size = 12,
  tooltip = LOCK_TOOLTIP,
  style,
}) => (
  <span
    title={tooltip}
    aria-label={tooltip}
    role="img"
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#A19F9D",
      flexShrink: 0,
      cursor: "default",
      ...style,
    }}
  >
    <Lock size={size} />
  </span>
);

/**
 * Banner de bloqueo para drawers y paneles.
 * Muestra un recuadro amarillo/gris con el candado y el mensaje.
 */
export const LockBanner: React.FC<{ message?: string }> = ({
  message = LOCK_TOOLTIP,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      background: "#FFF4CE",
      border: "1px solid #F7D769",
      borderRadius: 6,
      fontFamily: "'Segoe UI', sans-serif",
      fontSize: 12,
      color: "#835B00",
      marginTop: 8,
    }}
  >
    <Lock size={13} style={{ flexShrink: 0 }} />
    {message}
  </div>
);
