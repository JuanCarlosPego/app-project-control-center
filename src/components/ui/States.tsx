// ─────────────────────────────────────────────────────────
//  src/components/ui/States.tsx
//  EmptyState, LoadingSkeleton, ErrorState reutilizables.
// ─────────────────────────────────────────────────────────

import React from "react";
import { AlertTriangle, SearchX, RefreshCw } from "lucide-react";
import { color, font, radius, spacing, shadow } from "./tokens";

// ── LoadingSkeleton ───────────────────────────────────────
interface LoadingSkeletonProps {
  /** Nº de "cards" skeleton a mostrar (default 6). */
  count?: number;
  /** Modo: "card" (grid) | "row" (lista) | "bar" (full-width). */
  variant?: "card" | "row" | "bar";
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  count = 6,
  variant = "card",
}) => {
  const keyframes = `
    @keyframes ds-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.45; }
    }
  `;

  if (variant === "bar") {
    return (
      <>
        <style>{keyframes}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[5] }}>
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 52,
                borderRadius: radius.sm,
                background: color.border,
                animation: `ds-pulse 1.5s ease-in-out infinite`,
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
      </>
    );
  }

  if (variant === "row") {
    return (
      <>
        <style>{keyframes}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing[4] }}>
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: spacing[5],
                padding: `${spacing[4]}px ${spacing[6]}px`,
                background: color.surface,
                borderRadius: radius.sm,
                border: `1px solid ${color.border}`,
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: radius.full, background: color.border, animation: `ds-pulse 1.5s ease-in-out ${i * 60}ms infinite`, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: spacing[2] }}>
                <div style={{ height: 13, borderRadius: radius.xs, background: color.border, width: `${55 + (i % 3) * 15}%`, animation: `ds-pulse 1.5s ease-in-out ${i * 60 + 80}ms infinite` }} />
                <div style={{ height: 10, borderRadius: radius.xs, background: color.borderSubtle, width: `${30 + (i % 4) * 10}%`, animation: `ds-pulse 1.5s ease-in-out ${i * 60 + 160}ms infinite` }} />
              </div>
              <div style={{ width: 60, height: 22, borderRadius: radius.full, background: color.border, animation: `ds-pulse 1.5s ease-in-out ${i * 60 + 240}ms infinite` }} />
            </div>
          ))}
        </div>
      </>
    );
  }

  // card (default)
  return (
    <>
      <style>{keyframes}</style>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
        gap: spacing[6],
      }}>
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 200,
              borderRadius: radius.md,
              background: color.border,
              animation: `ds-pulse 1.5s ease-in-out infinite`,
              animationDelay: `${i * 90}ms`,
              boxShadow: shadow.xs,
            }}
          />
        ))}
      </div>
    </>
  );
};

// ── EmptyState ────────────────────────────────────────────
interface EmptyStateProps {
  /** Icono (cualquier ReactNode). Por defecto SearchX. */
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  /** Acción principal (botón). */
  action?: React.ReactNode;
  /** Compacto: menos padding, ideal dentro de tablas. */
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title = "Sin resultados",
  description = "Prueba a cambiar los filtros o crea un nuevo elemento.",
  action,
  compact = false,
}) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: compact ? `${spacing[9]}px ${spacing[8]}px` : `${spacing[11]}px ${spacing[8]}px`,
    gap: spacing[5],
    color: color.textMuted,
    fontFamily: font.family,
  }}>
    <div style={{
      width: compact ? 44 : 56,
      height: compact ? 44 : 56,
      borderRadius: radius.full,
      background: color.surfaceAlt,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: color.textMuted,
    }}>
      {icon ?? <SearchX size={compact ? 22 : 28} />}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
      <p style={{ margin: 0, fontSize: compact ? font.size.base : font.size.lg, fontWeight: font.weight.semibold, color: color.textSecondary }}>
        {title}
      </p>
      {description && (
        <p style={{ margin: 0, fontSize: font.size.md, color: color.textMuted, maxWidth: 380 }}>
          {description}
        </p>
      )}
    </div>
    {action}
  </div>
);

// ── ErrorState ────────────────────────────────────────────
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = "Ha ocurrido un error al cargar los datos.",
  onRetry,
  compact = false,
}) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: compact ? `${spacing[8]}px` : `${spacing[11]}px ${spacing[8]}px`,
    gap: spacing[5],
    fontFamily: font.family,
  }}>
    <div style={{
      width: compact ? 44 : 56,
      height: compact ? 44 : 56,
      borderRadius: radius.full,
      background: color.dangerBg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <AlertTriangle size={compact ? 22 : 26} color={color.danger} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
      <p style={{ margin: 0, fontSize: compact ? font.size.base : font.size.lg, fontWeight: font.weight.semibold, color: color.danger }}>
        Error al cargar
      </p>
      <p style={{ margin: 0, fontSize: font.size.md, color: color.textSecondary, maxWidth: 400 }}>
        {message}
      </p>
    </div>
    {onRetry && (
      <button
        onClick={onRetry}
        style={{
          display: "inline-flex", alignItems: "center", gap: spacing[3],
          padding: `${spacing[3]}px ${spacing[6]}px`,
          borderRadius: radius.sm,
          border: `1px solid ${color.danger}`,
          background: color.surface,
          color: color.danger,
          fontSize: font.size.md,
          fontWeight: font.weight.semibold,
          fontFamily: font.family,
          cursor: "pointer",
        }}
      >
        <RefreshCw size={13} />
        Reintentar
      </button>
    )}
  </div>
);

// ── InlineSpinner ─────────────────────────────────────────
interface InlineSpinnerProps {
  size?: number;
  color?: string;
  label?: string;
}

export const InlineSpinner: React.FC<InlineSpinnerProps> = ({
  size = 16,
  color: c = color.primary,
  label = "Cargando…",
}) => (
  <>
    <style>{`@keyframes ds-spin{to{transform:rotate(360deg)}}`}</style>
    <span style={{ display: "inline-flex", alignItems: "center", gap: spacing[3], color: c, fontFamily: font.family, fontSize: font.size.md }}>
      <RefreshCw size={size} style={{ animation: "ds-spin 1s linear infinite", flexShrink: 0 }} />
      {label}
    </span>
  </>
);
