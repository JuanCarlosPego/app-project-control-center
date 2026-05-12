// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/UrgentActions.tsx
//  Bloque "Acciones urgentes" — dinámico por usuario
//  Agrupa: bloqueos, vencimientos, solicitudes pendientes de acción
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import { AlertTriangle, Clock, FileQuestion, ArrowRight } from "lucide-react";
import type { WorkItem, Request, AppRole, State } from "../../../types/domain";

// ── Helpers ───────────────────────────────────────────────
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

// ── Tipos internos ────────────────────────────────────────
interface UrgentItem {
  id: string;
  kind: "blocked" | "due" | "request";
  title: string;
  subtitle: string;
  urgency: "high" | "medium";
  href: string;
}

// ── Props ─────────────────────────────────────────────────
interface Props {
  workItems: WorkItem[];
  requests: Request[];
  currentUserId: string;
  roles: AppRole[];
  states: State[];
  onNavigate: (href: string) => void;
}

// ── Component ─────────────────────────────────────────────
export const UrgentActions: React.FC<Props> = ({
  workItems, requests, currentUserId, roles, states, onNavigate,
}) => {
  const [expanded, setExpanded] = useState(true);

  const stateMap = Object.fromEntries(states.map((s) => [s.id, s.name]));
  const isIT = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const isProveedor = roles.includes("Proveedor");

  const items: UrgentItem[] = [];

  // ── 1. Mis tareas bloqueadas ──────────────────────────
  workItems
    .filter((wi) => wi.stateId === "st-blk" && wi.assignedToUserId === currentUserId)
    .slice(0, 3)
    .forEach((wi) => {
      items.push({
        id: `blk-${wi.id}`,
        kind: "blocked",
        title: wi.title,
        subtitle: wi.blockedReason ?? "Sin motivo registrado",
        urgency: "high",
        href: `/kanban?wi=${wi.id}`,
      });
    });

  // ── 2. Tareas que vencen ≤7 días (asignadas a mí) ─────
  workItems
    .filter((wi) => {
      if (wi.stateId === "st-cls") return false;
      if (wi.assignedToUserId !== currentUserId) return false;
      const d = daysUntil(wi.endDate);
      return d >= 0 && d <= 7;
    })
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate))
    .slice(0, 3)
    .forEach((wi) => {
      const d = daysUntil(wi.endDate);
      items.push({
        id: `due-${wi.id}`,
        kind: "due",
        title: wi.title,
        subtitle: d === 0 ? "Vence HOY" : `Vence en ${d} día${d === 1 ? "" : "s"} (${fmtDate(wi.endDate)})`,
        urgency: d <= 2 ? "high" : "medium",
        href: `/kanban?wi=${wi.id}`,
      });
    });

  // ── 3. IT: solicitudes "Nuevo" pendientes de triaje ───
  if (isIT) {
    requests
      .filter((r) => r.status === "Nuevo")
      .slice(0, 3)
      .forEach((r) => {
        items.push({
          id: `req-${r.id}`,
          kind: "request",
          title: r.title,
          subtitle: `Solicitud ${r.type} · Pri. ${r.priority} · ${fmtDate(r.createdOn.slice(0, 10))}`,
          urgency: r.priority === "Alta" ? "high" : "medium",
          href: `/requests?status=Nuevo`,
        });
      });
  }

  // ── 4. Proveedor: solicitudes "Info requerida" mías ───
  if (isProveedor) {
    requests
      .filter((r) => r.requestedByUserId === currentUserId && r.status === "Info requerida")
      .slice(0, 3)
      .forEach((r) => {
        items.push({
          id: `req-info-${r.id}`,
          kind: "request",
          title: r.title,
          subtitle: "IT solicita más información — responde para continuar",
          urgency: "high",
          href: `/requests?mine=true&status=Info+requerida`,
        });
      });
  }

  // ── 5. Usuario: solicitudes "Aprobada" listas para ver ─
  if (!isIT && !isProveedor) {
    requests
      .filter((r) => r.requestedByUserId === currentUserId && r.status === "Aprobada")
      .slice(0, 3)
      .forEach((r) => {
        items.push({
          id: `req-apr-${r.id}`,
          kind: "request",
          title: r.title,
          subtitle: "Solicitud aprobada — en proceso de planificación",
          urgency: "medium",
          href: `/requests?mine=true&status=Aprobada`,
        });
      });
  }

  if (items.length === 0) {
    return (
      <div style={{
        background: "#EFF8F0", border: "1px solid #107C1040",
        borderRadius: 10, padding: "16px 20px",
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#107C10", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Acciones urgentes
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#107C10" }}>✅ Sin acciones urgentes pendientes</p>
      </div>
    );
  }

  return (
    <div style={{
      background: "#fff", border: "1px solid #EDEBE9",
      borderRadius: 10, overflow: "hidden",
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%", padding: "12px 20px",
          display: "flex", alignItems: "center", gap: 8,
          background: "#FFF8F0", border: "none",
          borderBottom: expanded ? "1px solid #FDCFBC" : "none",
          cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
          textAlign: "left",
        }}
      >
        <AlertTriangle size={14} color="#D83B01" />
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#8A8886", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Acciones urgentes
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, background: "#D83B01", color: "#fff",
          borderRadius: 10, padding: "1px 7px", minWidth: 18, textAlign: "center",
        }}>
          {items.length}
        </span>
        <span style={{ fontSize: 14, color: "#8A8886" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ padding: "8px 0" }}>
          {items.map((item) => (
            <UrgentRow key={item.id} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Fila urgente ──────────────────────────────────────────
const ICON_MAP = {
  blocked: <AlertTriangle size={13} color="#D13438" />,
  due:     <Clock size={13} color="#CA8B00" />,
  request: <FileQuestion size={13} color="#0078D4" />,
};

const UrgentRow: React.FC<{ item: UrgentItem; onNavigate: (href: string) => void }> = ({
  item, onNavigate,
}) => {
  const [hov, setHov] = useState(false);

  return (
    <button
      onClick={() => onNavigate(item.href)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: "100%", padding: "9px 20px",
        display: "flex", alignItems: "flex-start", gap: 10,
        background: hov ? "#FFF8F5" : "transparent",
        border: "none", borderBottom: "1px solid #F3F2F1",
        cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
        textAlign: "left", transition: "background 100ms",
      }}
    >
      {/* Urgency dot */}
      <span style={{
        marginTop: 3, flexShrink: 0,
        width: 7, height: 7, borderRadius: "50%",
        background: item.urgency === "high" ? "#D13438" : "#CA8B00",
        display: "inline-block",
      }} />

      {/* Icon */}
      <span style={{ flexShrink: 0, marginTop: 1 }}>{ICON_MAP[item.kind]}</span>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: "#201F1E",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: "#8A8886", marginTop: 1 }}>
          {item.subtitle}
        </div>
      </div>

      <ArrowRight size={12} color="#C8C6C4" style={{ flexShrink: 0, marginTop: 2 }} />
    </button>
  );
};
