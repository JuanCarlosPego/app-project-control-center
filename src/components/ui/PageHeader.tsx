// ─────────────────────────────────────────────────────────
//  src/components/ui/PageHeader.tsx
//  Header de pantalla reutilizable.
//
//  Estructura:
//    [Icono?] Título / Subtítulo       [slot acciones]
//
//  Props:
//    icon        — ReactNode (lucide icon)
//    title       — string obligatorio
//    subtitle    — string opcional
//    actions     — ReactNode (botones, selects, etc.)
//    bordered    — añade borde inferior (default true)
//    compact     — menos padding (para modales/drawers)
// ─────────────────────────────────────────────────────────

import React from "react";
import { color, font, radius, spacing, shadow } from "./tokens";

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Muestra borde inferior separador. Default: true */
  bordered?: boolean;
  /** Menos padding (modo embebido). Default: false */
  compact?: boolean;
  /** Badge/pill junto al título */
  badge?: React.ReactNode;
  /** Stats row debajo del título */
  meta?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  subtitle,
  actions,
  bordered = true,
  compact = false,
  badge,
  meta,
}) => {
  const pV = compact ? spacing[5] : spacing[7];
  const pH = compact ? spacing[6] : spacing[8];

  return (
    <div
      style={{
        background: color.surface,
        borderRadius: radius.lg,
        border: `1px solid ${color.border}`,
        boxShadow: shadow.xs,
        padding: `${pV}px ${pH}px`,
        marginBottom: spacing[6],
        display: "flex",
        alignItems: "flex-start",
        gap: spacing[6],
        flexWrap: "wrap",
        fontFamily: font.family,
      }}
    >
      {/* Left: icon + text */}
      <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "flex-start", gap: spacing[5] }}>
        {icon && (
          <div style={{
            width: compact ? 34 : 40,
            height: compact ? 34 : 40,
            borderRadius: radius.md,
            background: color.primaryBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: color.primary,
          }}>
            {icon}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
          <div style={{ display: "flex", alignItems: "center", gap: spacing[4], flexWrap: "wrap" }}>
            <h1 style={{
              margin: 0,
              fontSize: compact ? font.size.lg : font.size.xl,
              fontWeight: font.weight.extrabold,
              color: "#1B2A3E",
              lineHeight: font.lineHeight.tight,
            }}>
              {title}
            </h1>
            {badge}
          </div>
          {subtitle && (
            <p style={{
              margin: 0,
              fontSize: font.size.md,
              color: color.textMuted,
              lineHeight: font.lineHeight.base,
            }}>
              {subtitle}
            </p>
          )}
          {meta && (
            <div style={{ marginTop: spacing[2] }}>
              {meta}
            </div>
          )}
        </div>
      </div>

      {/* Right: actions */}
      {actions && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          flexWrap: "wrap",
          flexShrink: 0,
        }}>
          {actions}
        </div>
      )}
    </div>
  );
};
