// ─────────────────────────────────────────────────────────
//  src/screens/admin/components/shared.tsx
//  Componentes UI reutilizables para las pantallas de Admin
// ─────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { Info, CheckCircle2, AlertTriangle } from "lucide-react";

// ── Design tokens ─────────────────────────────────────────
const FONT = "'Segoe UI', sans-serif";

// ═══════════════════════════════════════════════════════════
//  Toggle switch (Fluent style)
// ═══════════════════════════════════════════════════════════
interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export const Toggle: React.FC<ToggleProps> = ({
  checked, onChange, disabled = false, size = "md",
}) => {
  const W = size === "sm" ? 32 : 40;
  const H = size === "sm" ? 18 : 22;
  const D = size === "sm" ? 12 : 16;
  const gap = 3;

  return (
    <div
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: W, height: H, borderRadius: H / 2,
        background: disabled ? "#C8C6C4" : checked ? "#0078D4" : "#BEBBB8",
        position: "relative", cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 180ms", flexShrink: 0, display: "inline-block",
      }}
    >
      <div style={{
        position: "absolute",
        top: (H - D) / 2,
        left: checked ? W - D - gap : gap,
        width: D, height: D,
        background: "#fff",
        borderRadius: "50%",
        transition: "left 180ms",
        boxShadow: "0 1px 3px rgba(0,0,0,0.20)",
      }} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  SettingsCard — Contenedor de sección
// ═══════════════════════════════════════════════════════════
interface SettingsCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title, description, children, icon,
}) => (
  <div style={{
    background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
    padding: "20px 24px", marginBottom: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: description ? 4 : 16 }}>
      {icon && <span style={{ color: "#0078D4" }}>{icon}</span>}
      <h3 style={{
        fontSize: 14, fontWeight: 700, color: "#201F1E", margin: 0,
        fontFamily: FONT,
      }}>{title}</h3>
    </div>
    {description && (
      <p style={{
        fontSize: 12, color: "#605E5C", margin: "0 0 16px", fontFamily: FONT,
        lineHeight: 1.55,
      }}>
        {description}
      </p>
    )}
    <div style={{ borderTop: "1px solid #F3F2F1", paddingTop: 14 }}>
      {children}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════
//  SectionHeader — Cabecera de grupo dentro de una card
// ═══════════════════════════════════════════════════════════
export const SectionHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: "#605E5C", fontFamily: FONT,
    textTransform: "uppercase", letterSpacing: "0.06em",
    padding: "8px 0 6px", marginBottom: 4,
    borderBottom: "1px solid #EDEBE9",
  }}>
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════
//  ToggleRow — Fila con label, desc y toggle
// ═══════════════════════════════════════════════════════════
interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  badge?: string;
}

export const ToggleRow: React.FC<ToggleRowProps> = ({
  label, description, checked, onChange, disabled = false, badge,
}) => (
  <div style={{
    display: "flex", alignItems: "flex-start", justifyContent: "space-between",
    gap: 16, padding: "10px 0", borderBottom: "1px solid #F3F2F1",
  }}>
    <div style={{ flex: 1 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 13, fontWeight: 600, color: disabled ? "#A19F9D" : "#201F1E",
        fontFamily: FONT, marginBottom: description ? 3 : 0,
      }}>
        {label}
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, background: "#EFF6FC", color: "#0078D4",
            borderRadius: 4, padding: "1px 6px",
          }}>{badge}</span>
        )}
      </div>
      {description && (
        <div style={{ fontSize: 12, color: "#A19F9D", fontFamily: FONT, lineHeight: 1.4 }}>
          {description}
        </div>
      )}
    </div>
    <div style={{ paddingTop: description ? 2 : 0, flexShrink: 0 }}>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════
//  NumberFieldRow — Fila con label, desc e input numérico
// ═══════════════════════════════════════════════════════════
interface NumberFieldRowProps {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  hint?: string;
  onChange: (v: number) => void;
  disabled?: boolean;
  unit?: string;
}

export const NumberFieldRow: React.FC<NumberFieldRowProps> = ({
  label, description, value, min = 0, max, hint,
  onChange, disabled = false, unit,
}) => {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => { setRaw(String(value)); }, [value]);

  const commit = () => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) onChange(Math.max(min, max !== undefined ? Math.min(max, n) : n));
    else setRaw(String(value));
  };

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      gap: 16, padding: "10px 0", borderBottom: "1px solid #F3F2F1",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#201F1E", fontFamily: FONT, marginBottom: description ? 3 : 0 }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: "#A19F9D", fontFamily: FONT, lineHeight: 1.4 }}>
            {description}
          </div>
        )}
        {hint && (
          <div style={{ fontSize: 11, color: "#A19F9D", marginTop: 3, fontFamily: FONT }}>
            {hint}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <input
          type="number"
          value={raw}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
          style={{
            width: 70, padding: "6px 10px",
            border: "1px solid #EDEBE9", borderRadius: 5,
            fontSize: 13, color: "#201F1E", fontFamily: FONT,
            textAlign: "right", outline: "none",
            background: disabled ? "#F3F2F1" : "#fff",
          }}
          onFocus={(e) => !disabled && (e.currentTarget.style.borderColor = "#0078D4")}
          onBlurCapture={(e) => (e.currentTarget.style.borderColor = "#EDEBE9")}
        />
        {unit && <span style={{ fontSize: 12, color: "#605E5C", fontFamily: FONT }}>{unit}</span>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  InfoBanner — Banner informativo con bullets
// ═══════════════════════════════════════════════════════════
export const InfoBanner: React.FC<{ items: string[] }> = ({ items }) => (
  <div style={{
    background: "#EFF6FC", border: "1px solid #C7E0F4",
    borderRadius: 8, padding: "12px 16px", marginBottom: 16,
    display: "flex", gap: 12, alignItems: "flex-start",
  }}>
    <Info size={16} color="#0078D4" style={{ flexShrink: 0, marginTop: 2 }} />
    <ul style={{
      margin: 0, padding: 0, listStyle: "none",
      display: "flex", flexDirection: "column", gap: 5,
    }}>
      {items.map((item, i) => (
        <li key={i} style={{ fontSize: 12, color: "#201F1E", fontFamily: FONT, lineHeight: 1.5 }}>
          {item}
        </li>
      ))}
    </ul>
  </div>
);

// ═══════════════════════════════════════════════════════════
//  AdminToast — Notificación flotante de guardado
// ═══════════════════════════════════════════════════════════
export interface ToastMsg { id: number; text: string; ok: boolean }
let _adminTid = 0;
export const newAdminToast = (text: string, ok = true): ToastMsg => ({
  id: ++_adminTid, text, ok,
});

export const AdminToastContainer: React.FC<{
  toasts: ToastMsg[];
  onDismiss?: (id: number) => void;
}> = ({ toasts, onDismiss }) => (
  <div style={{
    position: "fixed", bottom: 24, right: 24,
    display: "flex", flexDirection: "column", gap: 8, zIndex: 3000,
  }}>
    {toasts.map((t) => (
      <div key={t.id} onClick={() => onDismiss?.(t.id)} style={{ cursor: onDismiss ? "pointer" : "default",
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 16px", borderRadius: 8,
        background: t.ok ? "#DFF6DD" : "#FDE7E9",
        border: `1px solid ${t.ok ? "#92C353" : "#F4B8BB"}`,
        color: t.ok ? "#107C10" : "#A4262C",
        fontSize: 12, fontWeight: 600, fontFamily: FONT,
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        animation: "adminFadeUp 200ms ease-out",
      }}>
        {t.ok
          ? <CheckCircle2 size={13} />
          : <AlertTriangle size={13} />}
        {t.text}
      </div>
    ))}
    <style>{`@keyframes adminFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
  </div>
);

// ═══════════════════════════════════════════════════════════
//  PageHeader — Encabezado estándar de pantalla admin
// ═══════════════════════════════════════════════════════════
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title, subtitle, icon, actions,
}) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 12,
    padding: "16px 24px 14px",
    borderBottom: "1px solid #EDEBE9",
    background: "#fff",
    flexShrink: 0,
  }}>
    {icon && (
      <div style={{
        width: 36, height: 36, background: "#EFF6FC", borderRadius: 8,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <span style={{ color: "#0078D4" }}>{icon}</span>
      </div>
    )}
    <div style={{ flex: 1 }}>
      <h1 style={{ fontSize: 17, fontWeight: 700, color: "#201F1E", margin: 0, fontFamily: FONT }}>
        {title}
      </h1>
      {subtitle && (
        <div style={{ fontSize: 12, color: "#605E5C", fontFamily: FONT, marginTop: 2 }}>
          {subtitle}
        </div>
      )}
    </div>
    {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
  </div>
);
