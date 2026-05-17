// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/RoleActions.tsx
//  Bloque "¿Qué deseas hacer?" — acciones dinámicas por rol
//  Cada acción muestra: contador real + texto + botón CTA
// ─────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { WorkItem, Request, AppRole } from "../../../types/domain";

// ── Estado sets (reutilizados) ────────────────────────────
const BACKLOG_STATES  = new Set(["st-new", "st-ref"]);
const KANBAN_STATES   = new Set(["st-prog", "st-blk", "st-rft", "st-test", "st-acc"]);

// ── Tipos ─────────────────────────────────────────────────
interface DynAction {
  id: string;
  /** null = ocultar la acción si count=0 */
  count: number | null;
  /** emoji o carácter de semáforo */
  dot: string;
  dotColor: string;
  /** texto dinámico construido con el count */
  headline: string;
  subtext: string;
  cta: string;
  href: string;
  primary: boolean;
  /** si true, mostrar aunque count=0 */
  alwaysShow?: boolean;
}

// ── Props ─────────────────────────────────────────────────
interface Props {
  roles: AppRole[];
  workItems: WorkItem[];
  requests: Request[];
  effectiveUserId: string;
  /** Controlado por RBAC REQUEST_CREATE; oculta la acción "Nueva solicitud" si false */
  canCreateRequest?: boolean;
  onNavigate: (href: string) => void;
}

// ── Component ─────────────────────────────────────────────
export const RoleActions: React.FC<Props> = ({
  roles, workItems, requests, effectiveUserId, canCreateRequest = false, onNavigate,
}) => {
  const isIT       = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const isProveedor = roles.includes("Proveedor") && !isIT;

  const actions = useMemo<DynAction[]>(() => {
    const pendingReqs   = requests.filter((r) => r.status === "Nuevo").length;
    const myRequests    = requests.filter((r) => r.requestedByUserId === effectiveUserId).length;
    const infoNeeded    = requests.filter(
      (r) => r.requestedByUserId === effectiveUserId && r.status === "Info requerida",
    ).length;
    const backlogCount  = workItems.filter((wi) => BACKLOG_STATES.has(wi.stateId)).length;
    const kanbanCount   = workItems.filter((wi) => KANBAN_STATES.has(wi.stateId)).length;
    const blockedCount  = workItems.filter((wi) => wi.stateId === "st-blk").length;
    const mineCount     = workItems.filter(
      (wi) => KANBAN_STATES.has(wi.stateId) && wi.assignedToUserId === effectiveUserId,
    ).length;
    const accCount      = workItems.filter((wi) => wi.stateId === "st-acc").length;

    // ── IT / Admin ────────────────────────────────────────
    if (isIT) {
      return [
        {
          id: "req-triaje",
          count: pendingReqs,
          dot: "🎯",
          dotColor: "#D83B01",
          headline: pendingReqs === 0
            ? "Sin solicitudes pendientes"
            : `Tienes ${pendingReqs} solicitud${pendingReqs === 1 ? "" : "es"} pendiente${pendingReqs === 1 ? "" : "s"}`,
          subtext: "Revisar y hacer triaje",
          cta: "Revisarlas ahora",
          href: "/requests?status=Nuevo",
          primary: pendingReqs > 0,
          alwaysShow: true,
        },
        {
          id: "backlog-plan",
          count: backlogCount,
          dot: "📋",
          dotColor: "#0078D4",
          headline: backlogCount === 0
            ? "Backlog vacío"
            : `${backlogCount} tareas en backlog`,
          subtext: "Priorizar y asignar",
          cta: "Planificar",
          href: "/backlog?phase=backlog",
          primary: false,
          alwaysShow: true,
        },
        {
          id: "kanban-sup",
          count: kanbanCount,
          dot: "🟡",
          dotColor: "#C17D00",
          headline: `${kanbanCount} tareas en ejecución`,
          subtext: "Supervisar progreso",
          cta: "Abrir Kanban",
          href: "/kanban",
          primary: false,
          alwaysShow: true,
        },
        {
          id: "blocked-fix",
          count: blockedCount,
          dot: "⛔",
          dotColor: "#D13438",
          headline: blockedCount === 0
            ? "Sin bloqueos activos"
            : `${blockedCount} tarea${blockedCount === 1 ? "" : "s"} bloqueada${blockedCount === 1 ? "" : "s"}`,
          subtext: blockedCount > 0 ? "Requieren atención urgente" : "Todo en marcha",
          cta: "Ver bloqueos",
          href: "/kanban?filter=blocked",
          primary: blockedCount > 0,
          alwaysShow: true,
        },
      ];
    }

    // ── Proveedor ─────────────────────────────────────────
    if (isProveedor) {
      return [
        {
          id: "prov-mine",
          count: mineCount,
          dot: "✅",
          dotColor: "#107C10",
          headline: mineCount === 0
            ? "Sin tareas asignadas"
            : `Tienes ${mineCount} tarea${mineCount === 1 ? "" : "s"} asignada${mineCount === 1 ? "" : "s"}`,
          subtext: "Ver lo que debes hacer hoy",
          cta: "Ver mis tareas",
          href: "/kanban?scope=mine",
          primary: mineCount > 0,
          alwaysShow: true,
        },
        {
          id: "prov-acc",
          count: accCount,
          dot: "🧪",
          dotColor: "#0078D4",
          headline: accCount === 0
            ? "Sin tareas pendientes de validación"
            : `${accCount} tarea${accCount === 1 ? "" : "s"} esperando validación`,
          subtext: "Listas para revisión del cliente",
          cta: "Ver en Kanban",
          href: "/kanban",
          primary: false,
          alwaysShow: false,
        },
        {
          id: "prov-blocked",
          count: blockedCount,
          dot: "⛔",
          dotColor: "#D13438",
          headline: blockedCount === 0
            ? "Sin bloqueos activos"
            : `${blockedCount} tarea${blockedCount === 1 ? "" : "s"} bloqueada${blockedCount === 1 ? "" : "s"}`,
          subtext: blockedCount > 0 ? "Registra impedimento si es necesario" : "",
          cta: blockedCount > 0 ? "Ver bloqueos" : "Todo en marcha",
          href: "/kanban?filter=blocked",
          primary: blockedCount > 0,
          alwaysShow: true,
        },
        {
          id: "prov-newreq",
          count: null,
          dot: "📎",
          dotColor: "#605E5C",
          headline: "Registrar impedimento",
          subtext: "Crea una solicitud de tipo Impedimento",
          cta: "Crear solicitud",
          href: "/requests?new=Impedimento",
          primary: false,
          alwaysShow: true,
        },
      ];
    }

    // ── Usuario ───────────────────────────────────────────
    const usuarioActions: DynAction[] = [
      // Solo si el usuario tiene permiso REQUEST_CREATE
      ...(canCreateRequest ? [{
        id: "usr-newreq",
        count: null,
        dot: "➕",
        dotColor: "#0078D4",
        headline: "Crear nueva solicitud",
        subtext: "Bug, mejora, consulta o cambio normativo",
        cta: "Nueva solicitud",
        href: "/requests?new=true",
        primary: true,
        alwaysShow: true,
      } as DynAction] : []),
      {
        id: "usr-myreqs",
        count: myRequests,
        dot: "📄",
        dotColor: "#605E5C",
        headline: myRequests === 0
          ? "Sin solicitudes tuyas"
          : `Tienes ${myRequests} solicitud${myRequests === 1 ? "" : "es"} activa${myRequests === 1 ? "" : "s"}`,
        subtext: "Consulta el estado de tus peticiones",
        cta: "Ver mis solicitudes",
        href: "/requests?mine=true",
        primary: false,
        alwaysShow: true,
      },
      {
        id: "usr-infoneed",
        count: infoNeeded,
        dot: "⚠️",
        dotColor: "#D83B01",
        headline: infoNeeded === 0
          ? "Sin información pendiente de aportar"
          : `${infoNeeded} solicitud${infoNeeded === 1 ? "" : "es"} requieren tu respuesta`,
        subtext: infoNeeded > 0 ? "IT necesita más información de tu parte" : "",
        cta: "Responder ahora",
        href: "/requests?mine=true&status=Info+requerida",
        primary: infoNeeded > 0,
        alwaysShow: infoNeeded > 0,
      },
      {
        id: "usr-validate",
        count: accCount,
        dot: "🧪",
        dotColor: "#107C10",
        headline: accCount === 0
          ? "Sin tareas pendientes de validación"
          : `${accCount} tarea${accCount === 1 ? "" : "s"} esperan tu validación`,
        subtext: accCount > 0 ? "Confirma que el trabajo está correcto" : "",
        cta: "Validar ahora",
        href: "/kanban",
        primary: accCount > 0,
        alwaysShow: accCount > 0,
      },
    ];
    return usuarioActions;
  }, [roles, workItems, requests, effectiveUserId, isIT, isProveedor, canCreateRequest]);

  const visible = actions.filter((a) => a.alwaysShow || (a.count !== null && a.count > 0));

  return (
    <div style={{
      background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
      padding: "16px 20px", height: "100%", boxSizing: "border-box",
    }}>
      <p style={{
        margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: "#8A8886",
        textTransform: "uppercase", letterSpacing: "0.07em",
      }}>
        ¿Qué deseas hacer?
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((a) => (
          <DynActionRow key={a.id} action={a} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
};

// ── Fila de acción dinámica ───────────────────────────────
const DynActionRow: React.FC<{
  action: DynAction;
  onNavigate: (href: string) => void;
}> = ({ action: a, onNavigate }) => {
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 12px", borderRadius: 8,
        border: `1px solid ${a.primary ? a.dotColor + "60" : (hov ? "#C8C6C4" : "#EDEBE9")}`,
        background: a.primary
          ? (hov ? `${a.dotColor}15` : `${a.dotColor}0A`)
          : (hov ? "#FAFAFA" : "#fff"),
        transition: "all 120ms",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* dot / emoji */}
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{a.dot}</span>

      {/* texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: a.primary ? 700 : 600,
          color: a.primary ? a.dotColor : "#323130",
          lineHeight: 1.25,
        }}>
          {a.headline}
        </div>
        {a.subtext && (
          <div style={{ fontSize: 11, color: "#8A8886", marginTop: 1 }}>{a.subtext}</div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={() => onNavigate(a.href)}
        style={{
          flexShrink: 0,
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 10px", borderRadius: 6,
          border: `1px solid ${a.primary ? a.dotColor : "#C8C6C4"}`,
          background: a.primary ? a.dotColor : "#fff",
          color: a.primary ? "#fff" : "#323130",
          fontSize: 11, fontWeight: 600,
          fontFamily: "'Segoe UI', sans-serif",
          cursor: "pointer", whiteSpace: "nowrap",
          transition: "filter 100ms",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.88)")}
        onMouseLeave={(e) => (e.currentTarget.style.filter = "brightness(1)")}
      >
        {a.cta}
        <ArrowRight size={11} />
      </button>
    </div>
  );
};
