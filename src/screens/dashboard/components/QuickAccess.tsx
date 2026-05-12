// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/QuickAccess.tsx
//  Bloque "Accesos rápidos" — CTAs por rol
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import { PlusCircle, LayoutGrid, ListChecks, FileText } from "lucide-react";
import type { AppRole } from "../../../types/domain";

interface QuickLink {
  id: string;
  icon: React.ReactNode;
  label: string;
  href: string;
  color: string;
  bg: string;
  border: string;
  /** roles that can see this link */
  roles: Array<AppRole | "all">;
}

const LINKS: QuickLink[] = [
  {
    id: "new-task",
    icon: <PlusCircle size={16} />,
    label: "Crear tarea",
    href: "/backlog?create=true",
    color: "#fff", bg: "#0078D4", border: "#0078D4",
    roles: ["Admin", "IT AirEuropa"],
  },
  {
    id: "new-request",
    icon: <FileText size={16} />,
    label: "Crear solicitud",
    href: "/requests?new=true",
    color: "#0078D4", bg: "#EFF6FC", border: "#0078D4",
    roles: ["Proveedor", "Usuario", "all"],
  },
  {
    id: "kanban",
    icon: <LayoutGrid size={16} />,
    label: "Ir a Kanban",
    href: "/kanban",
    color: "#107C10", bg: "#EFF8F0", border: "#107C10",
    roles: ["all"],
  },
  {
    id: "backlog",
    icon: <ListChecks size={16} />,
    label: "Ir a Backlog",
    href: "/backlog",
    color: "#8C3900", bg: "#FFF4CE", border: "#C17D2B",
    roles: ["all"],
  },
];

// ── Props ─────────────────────────────────────────────────
interface Props {
  roles: AppRole[];
  onNavigate: (href: string) => void;
}

// ── Component ─────────────────────────────────────────────
export const QuickAccess: React.FC<Props> = ({ roles, onNavigate }) => {
  const visible = LINKS.filter((l) =>
    l.roles.includes("all") ||
    l.roles.some((r) => r !== "all" && roles.includes(r as AppRole)),
  );

  return (
    <div style={{
      background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
      padding: "16px 20px",
    }}>
      <p style={{
        margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#8A8886",
        textTransform: "uppercase", letterSpacing: "0.07em",
      }}>
        Accesos rápidos
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {visible.map((link) => (
          <QuickBtn key={link.id} link={link} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
};

// ── Button ────────────────────────────────────────────────
const QuickBtn: React.FC<{ link: QuickLink; onNavigate: (href: string) => void }> = ({
  link, onNavigate,
}) => {
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={() => onNavigate(link.href)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "8px 14px", borderRadius: 7,
        border: `1px solid ${link.border}`,
        background: hov ? link.bg : link.bg,
        color: link.color,
        fontSize: 12, fontWeight: 600,
        fontFamily: "'Segoe UI', sans-serif",
        cursor: "pointer", transition: "filter 120ms",
        filter: hov ? "brightness(0.93)" : "brightness(1)",
      }}
    >
      {link.icon}
      {link.label}
    </button>
  );
};
