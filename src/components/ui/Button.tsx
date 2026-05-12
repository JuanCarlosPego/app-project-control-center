// ─────────────────────────────────────────────────────────
//  src/components/ui/Button.tsx
//  Botones base del Design System.
//  Variantes: primary | secondary | ghost | danger
//  Tamaños: sm | md | lg
// ─────────────────────────────────────────────────────────

import React from "react";
import { color, font, radius, spacing, transition } from "./tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  iconEnd?: React.ReactNode;
  loading?: boolean;
}

const VARIANT_STYLE: Record<Variant, { base: React.CSSProperties; hover: React.CSSProperties }> = {
  primary: {
    base:  { background: color.primary,    color: color.textInverted, border: `1px solid ${color.primary}` },
    hover: { background: color.primaryHover, borderColor: color.primaryHover },
  },
  secondary: {
    base:  { background: color.surface,    color: color.text,          border: `1px solid ${color.border}` },
    hover: { background: color.surfaceAlt, borderColor: color.borderStrong },
  },
  ghost: {
    base:  { background: "transparent",    color: color.textSecondary,  border: "1px solid transparent" },
    hover: { background: color.surfaceAlt, borderColor: color.border },
  },
  danger: {
    base:  { background: color.danger,     color: color.textInverted,   border: `1px solid ${color.danger}` },
    hover: { background: color.dangerHover, borderColor: color.dangerHover },
  },
};

const SIZE_STYLE: Record<Size, React.CSSProperties> = {
  sm: { padding: `${spacing[2]}px ${spacing[5]}px`, fontSize: font.size.sm, gap: spacing[2] },
  md: { padding: `${spacing[3]}px ${spacing[6]}px`, fontSize: font.size.md, gap: spacing[3] },
  lg: { padding: `${spacing[4]}px ${spacing[8]}px`, fontSize: font.size.base, gap: spacing[4] },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", icon, iconEnd, loading, children, style, disabled, ...rest }, ref) => {
    const v = VARIANT_STYLE[variant];

    const [hovered, setHovered] = React.useState(false);
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        {...rest}
        onMouseEnter={(e) => { setHovered(true); rest.onMouseEnter?.(e); }}
        onMouseLeave={(e) => { setHovered(false); rest.onMouseLeave?.(e); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.sm,
          fontFamily: font.family,
          fontWeight: font.weight.semibold,
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: isDisabled ? 0.55 : 1,
          transition: `background ${transition.fast}, border-color ${transition.fast}, opacity ${transition.fast}`,
          whiteSpace: "nowrap",
          outline: "none",
          ...SIZE_STYLE[size],
          ...(hovered && !isDisabled ? { ...v.base, ...v.hover } : v.base),
          ...style,
        }}
      >
        {loading
          ? <><style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style><span style={{ width: 13, height: 13, border: `2px solid currentColor`, borderTopColor: "transparent", borderRadius: radius.full, animation: "ds-spin 0.7s linear infinite", display: "inline-block" }} /></>
          : icon}
        {children}
        {!loading && iconEnd}
      </button>
    );
  },
);
Button.displayName = "Button";
