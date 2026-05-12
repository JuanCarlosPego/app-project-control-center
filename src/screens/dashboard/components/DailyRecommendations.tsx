// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/DailyRecommendations.tsx
//  Bloque "Hoy te recomendamos:" — sugerencias basadas en datos reales
//  Se muestra debajo del header, antes de los bloques de acción.
//  Máx. 4 recomendaciones, basadas en estado actual.
// ─────────────────────────────────────────────────────────

import React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import type { WorkItem, Request, AppRole } from "../../../types/domain";

const KANBAN_STATES = new Set(["st-prog", "st-blk", "st-rft", "st-test", "st-acc"]);
const BACKLOG_STATES = new Set(["st-new", "st-ref"]);

interface Rec {
  id: string;
  icon: string;
  text: string;
  href: string;
  urgent: boolean;
}

// ── Props ─────────────────────────────────────────────────
interface Props {
  workItems: WorkItem[];
  requests: Request[];
  roles: AppRole[];
  effectiveUserId: string;
  onNavigate: (href: string) => void;
}

// ── Component ─────────────────────────────────────────────
export const DailyRecommendations: React.FC<Props> = ({
  workItems, requests, roles, effectiveUserId, onNavigate,
}) => {
  const isIT       = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const isProveedor = roles.includes("Proveedor") && !isIT;

  const today = Date.now();

  // ── Calcular métricas ─────────────────────────────────
  const pendingReqs  = requests.filter((r) => r.status === "Nuevo").length;
  const infoNeeded   = requests.filter(
    (r) => r.requestedByUserId === effectiveUserId && r.status === "Info requerida",
  ).length;
  const blocked      = workItems.filter((wi) => wi.stateId === "st-blk").length;
  const overdue      = workItems.filter(
    (wi) => KANBAN_STATES.has(wi.stateId) && new Date(wi.endDate).getTime() < today,
  ).length;
  const mineCount    = workItems.filter(
    (wi) => KANBAN_STATES.has(wi.stateId) && wi.assignedToUserId === effectiveUserId,
  ).length;
  const accCount     = workItems.filter((wi) => wi.stateId === "st-acc").length;
  const backlogCount = workItems.filter((wi) => BACKLOG_STATES.has(wi.stateId)).length;

  // ── Construir recomendaciones ─────────────────────────
  const recs: Rec[] = [];

  if (isIT) {
    if (pendingReqs > 0) recs.push({
      id: "triaje",
      icon: "📥",
      text: `Revisar ${pendingReqs} solicitud${pendingReqs === 1 ? "" : "es"} pendiente${pendingReqs === 1 ? "" : "s"}`,
      href: "/requests?status=Nuevo",
      urgent: true,
    });
    if (blocked > 0) recs.push({
      id: "bloqueos",
      icon: "⛔",
      text: `Gestionar ${blocked} bloqueo${blocked === 1 ? "" : "s"} crítico${blocked === 1 ? "" : "s"}`,
      href: "/kanban?blocked=true",
      urgent: true,
    });
    if (overdue > 0) recs.push({
      id: "overdue",
      icon: "⏰",
      text: `Revisar ${overdue} tarea${overdue === 1 ? "" : "s"} vencida${overdue === 1 ? "" : "s"}`,
      href: "/kanban?overdue=true",
      urgent: false,
    });
    if (backlogCount > 0) recs.push({
      id: "backlog",
      icon: "📋",
      text: `Planificar ${backlogCount} tarea${backlogCount === 1 ? "" : "s"} en backlog`,
      href: "/backlog?phase=backlog",
      urgent: false,
    });
  } else if (isProveedor) {
    if (mineCount > 0) recs.push({
      id: "mine",
      icon: "✅",
      text: `Continuar ${mineCount} tarea${mineCount === 1 ? "" : "s"} asignada${mineCount === 1 ? "" : "s"}`,
      href: "/kanban?assignedToMe=true",
      urgent: mineCount > 3,
    });
    if (blocked > 0) recs.push({
      id: "bloqueos",
      icon: "⛔",
      text: `Resolver ${blocked} bloqueo${blocked === 1 ? "" : "s"}`,
      href: "/kanban?blocked=true",
      urgent: true,
    });
    if (overdue > 0) recs.push({
      id: "overdue",
      icon: "⏰",
      text: `Atender ${overdue} tarea${overdue === 1 ? "" : "s"} vencida${overdue === 1 ? "" : "s"}`,
      href: "/kanban?overdue=true",
      urgent: true,
    });
    if (accCount > 0) recs.push({
      id: "acc",
      icon: "🧪",
      text: `${accCount} tarea${accCount === 1 ? "" : "s"} esperando validación`,
      href: "/kanban?state=st-acc",
      urgent: false,
    });
  } else {
    // Usuario
    if (infoNeeded > 0) recs.push({
      id: "info",
      icon: "⚠️",
      text: `Responder ${infoNeeded} solicitud${infoNeeded === 1 ? "" : "es"} — IT necesita tu respuesta`,
      href: "/requests?status=Info+requerida",
      urgent: true,
    });
    if (accCount > 0) recs.push({
      id: "validate",
      icon: "🧪",
      text: `Validar ${accCount} tarea${accCount === 1 ? "" : "s"} listas para aceptación`,
      href: "/kanban?state=st-acc",
      urgent: false,
    });
    recs.push({
      id: "check-reqs",
      icon: "📄",
      text: "Revisar el estado de tus solicitudes",
      href: "/requests",
      urgent: false,
    });
  }

  // Máx. 4 recomendaciones, urgentes primero
  const sorted = [
    ...recs.filter((r) => r.urgent),
    ...recs.filter((r) => !r.urgent),
  ].slice(0, 4);

  if (sorted.length === 0) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #F0F6FF 0%, #FFF8F0 100%)",
      border: "1px solid #C7E0F4",
      borderRadius: 10, padding: "13px 18px", marginBottom: 14,
    }}>
      {/* Título */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Sparkles size={14} color="#0078D4" />
        <span style={{
          fontSize: 12, fontWeight: 700, color: "#0078D4",
          letterSpacing: "0.02em",
        }}>
          Hoy te recomendamos:
        </span>
      </div>

      {/* Lista */}
      <div style={{
        display: "flex", gap: 8, flexWrap: "wrap",
      }}>
        {sorted.map((r) => (
          <button
            key={r.id}
            onClick={() => onNavigate(r.href)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 20,
              border: `1px solid ${r.urgent ? "#D83B01" : "#C8C6C4"}`,
              background: r.urgent ? "#FDF3F0" : "#fff",
              color: r.urgent ? "#D83B01" : "#323130",
              fontSize: 12, fontWeight: r.urgent ? 700 : 500,
              fontFamily: "'Segoe UI', sans-serif",
              cursor: "pointer",
              transition: "filter 100ms, transform 100ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(0.93)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "brightness(1)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <span style={{ fontSize: 14 }}>{r.icon}</span>
            {r.text}
            <ArrowRight size={11} />
          </button>
        ))}
      </div>
    </div>
  );
};
