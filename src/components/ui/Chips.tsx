// ─────────────────────────────────────────────────────────
//  src/components/ui/Chips.tsx
//  Chips / Badges reutilizables para Status, Prioridad y Sync.
//  Basados en los tokens del Design System.
// ─────────────────────────────────────────────────────────

import React from "react";
import { color, font, radius, statusConfig, priorityConfig, syncConfig } from "./tokens";
import type { ProjectStatus, Priority, SyncStatus } from "../../types/domain";

// ── Chip base ─────────────────────────────────────────────
interface ChipProps {
  label: string;
  chipColor: string;
  bg: string;
  dot?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

const Chip: React.FC<ChipProps> = ({ label, chipColor, bg, dot = true, size = "md", style }) => {
  const isSm = size === "sm";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: isSm ? 3 : 4,
        padding: isSm ? "2px 7px" : "3px 9px",
        borderRadius: radius.full,
        background: bg,
        border: `1px solid ${chipColor}22`,
        fontSize: isSm ? font.size.xs : font.size.sm,
        fontWeight: font.weight.semibold,
        color: chipColor,
        fontFamily: font.family,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: isSm ? 5 : 6,
            height: isSm ? 5 : 6,
            borderRadius: radius.full,
            background: chipColor,
            flexShrink: 0,
            display: "inline-block",
          }}
        />
      )}
      {label}
    </span>
  );
};

// ── StatusChip ────────────────────────────────────────────
interface StatusChipProps {
  status: ProjectStatus | string;
  size?: "sm" | "md";
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, size }) => {
  const cfg = statusConfig[status as ProjectStatus] ?? {
    color: color.textMuted,
    bg: color.border,
    label: status,
  };
  return <Chip label={cfg.label} chipColor={cfg.color} bg={cfg.bg} size={size} />;
};

// ── PriorityChip ──────────────────────────────────────────
interface PriorityChipProps {
  priority: Priority | string;
  size?: "sm" | "md";
}

export const PriorityChip: React.FC<PriorityChipProps> = ({ priority, size }) => {
  const cfg = priorityConfig[priority as Priority] ?? {
    color: color.textMuted,
    bg: color.border,
    label: priority,
  };
  return <Chip label={cfg.label} chipColor={cfg.color} bg={cfg.bg} dot={false} size={size} />;
};

// ── SyncChip ──────────────────────────────────────────────
interface SyncChipProps {
  status: SyncStatus | string;
  size?: "sm" | "md";
}

export const SyncChip: React.FC<SyncChipProps> = ({ status, size }) => {
  const cfg = syncConfig[status as SyncStatus] ?? {
    color: color.textMuted,
    bg: color.border,
    label: status,
  };
  return <Chip label={cfg.label} chipColor={cfg.color} bg={cfg.bg} size={size} />;
};

// ── RoleChip ──────────────────────────────────────────────
const ROLE_CFG: Record<string, { color: string; bg: string }> = {
  "Admin":         { color: "#5C2D91", bg: "#F4EFF9" },
  "IT AirEuropa":  { color: color.primary,  bg: color.primaryBg },
  "Proveedor":     { color: "#107C10",      bg: color.successBg },
  "Usuario":       { color: color.textSecondary, bg: "#F3F2F1" },
  "Invitado":      { color: color.textMuted,     bg: color.surfaceAlt },
};

interface RoleChipProps {
  role: string;
  size?: "sm" | "md";
}

export const RoleChip: React.FC<RoleChipProps> = ({ role, size }) => {
  const cfg = ROLE_CFG[role] ?? { color: color.textMuted, bg: color.border };
  return <Chip label={role} chipColor={cfg.color} bg={cfg.bg} dot={false} size={size} />;
};

// ── TypeChip ──────────────────────────────────────────────
const TYPE_CFG: Record<string, { color: string; bg: string }> = {
  "Feature":  { color: "#0078D4", bg: "#EFF6FF" },
  "Bug":      { color: "#D13438", bg: "#FDF3F0" },
  "TechDebt": { color: "#CA8B00", bg: "#FFF8EA" },
  "Spike":    { color: "#5C2D91", bg: "#F4EFF9" },
};

interface TypeChipProps {
  type: string;
  size?: "sm" | "md";
}

export const TypeChip: React.FC<TypeChipProps> = ({ type, size }) => {
  const cfg = TYPE_CFG[type] ?? { color: color.textMuted, bg: color.border };
  return <Chip label={type} chipColor={cfg.color} bg={cfg.bg} dot={false} size={size} />;
};
