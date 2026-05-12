// ─────────────────────────────────────────────────────────
//  src/screens/projects/components/ViewToggle.tsx
//  Segmented control: Cards | Tabla
// ─────────────────────────────────────────────────────────

import React from "react";
import { LayoutGrid, Table2 } from "lucide-react";

export type ViewMode = "cards" | "table";

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

const OPTIONS: { value: ViewMode; icon: React.ReactNode; label: string }[] = [
  { value: "cards", icon: <LayoutGrid size={14} />, label: "Cards" },
  { value: "table", icon: <Table2 size={14} />,     label: "Tabla" },
];

export const ViewToggle: React.FC<Props> = ({ value, onChange }) => (
  <div
    role="group"
    aria-label="Modo de visualización"
    style={{
      display: "flex", border: "1px solid #EDEBE9", borderRadius: 6,
      overflow: "hidden", flexShrink: 0,
    }}
  >
    {OPTIONS.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={active}
          aria-label={opt.label}
          style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
            border: "none", cursor: "pointer", fontSize: 12, fontFamily: "'Segoe UI', sans-serif",
            background: active ? "#0078D4" : "#fff",
            color: active ? "#fff" : "#605E5C",
            fontWeight: active ? 600 : 400,
            transition: "background 150ms, color 150ms",
          }}
          onMouseEnter={e => {
            if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#F3F2F1";
          }}
          onMouseLeave={e => {
            if (!active) (e.currentTarget as HTMLButtonElement).style.background = "#fff";
          }}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      );
    })}
  </div>
);
