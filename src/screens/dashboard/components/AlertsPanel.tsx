// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/AlertsPanel.tsx
//  Panel de alertas del programa — 3 secciones:
//    1. Épicas bloqueadas (top 5)
//    2. WorkItems que vencen en ≤14 días
//    3. Riesgos Alta con dueDate próximo
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import { AlertTriangle, CalendarClock, ShieldAlert, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Project, WorkItem, Risk, BusinessArea, State } from "../../../types/domain";

// ── Helpers ───────────────────────────────────────────────
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Props ─────────────────────────────────────────────────
interface Props {
  projects:   Project[];
  workItems:  WorkItem[];
  risks:      Risk[];
  areas:      BusinessArea[];
  states:     State[];
}

// ── Component ─────────────────────────────────────────────
export const AlertsPanel: React.FC<Props> = ({
  projects, workItems, risks, areas, states,
}) => {
  // 1. Épicas bloqueadas
  const blockedProjects = projects
    .filter((p) => p.status === "Bloqueado")
    .slice(0, 5);

  // 2. WorkItems que vencen en ≤14 días (estado activo: no st-cls)
  const CLOSED_STATE = "st-cls";
  const dueSoon = workItems
    .filter((wi) => {
      const d = daysUntil(wi.endDate);
      return wi.stateId !== CLOSED_STATE && d >= 0 && d <= 14;
    })
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate))
    .slice(0, 5);

  // También mostrar items vencidos (< 0 días) separados
  const overdueItems = workItems
    .filter((wi) => wi.stateId !== CLOSED_STATE && daysUntil(wi.endDate) < 0)
    .sort((a, b) => daysUntil(a.endDate) - daysUntil(b.endDate))
    .slice(0, 3);

  const allDue = [...overdueItems, ...dueSoon];

  // 3. Riesgos alta severidad, status "Abierto"
  const highRisks = risks
    .filter((r) => r.severity === "Alta" && r.status === "Abierto")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  const areaMap = Object.fromEntries(areas.map((a) => [a.id, a.name]));
  const stateMap = Object.fromEntries(states.map((s) => [s.id, s.name]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  const totalAlerts = blockedProjects.length + allDue.length + highRisks.length;

  if (totalAlerts === 0) {
    return (
      <div style={{
        background: "#EFF8F0", border: "1px solid #107C1040", borderRadius: 10,
        padding: "20px", textAlign: "center",
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
        <p style={{ margin: 0, fontSize: 13, color: "#107C10", fontWeight: 600 }}>
          Sin alertas activas
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8A8886" }}>
          Todos los proyectos y work items están en orden.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Épicas bloqueadas */}
      {blockedProjects.length > 0 && (
        <AlertSection
          icon={<AlertTriangle size={14} />}
          title="Épicas bloqueadas"
          count={blockedProjects.length}
          color="#D83B01"
          bg="#FDF3F0"
        >
          {blockedProjects.map((p) => (
            <BlockedProjectRow
              key={p.id}
              project={p}
              areaName={areaMap[p.businessAreaId] ?? p.businessAreaId}
            />
          ))}
        </AlertSection>
      )}

      {/* WorkItems que vencen pronto / vencidos */}
      {allDue.length > 0 && (
        <AlertSection
          icon={<CalendarClock size={14} />}
          title="Work items con fecha crítica"
          count={allDue.length}
          color="#C8A600"
          bg="#FFFBE6"
        >
          {allDue.map((wi) => {
            const d = daysUntil(wi.endDate);
            const proj = projectMap[wi.projectId];
            return (
              <DueWorkItemRow
                key={wi.id}
                workItem={wi}
                stateName={stateMap[wi.stateId] ?? wi.stateId}
                projectCode={proj?.code ?? wi.projectId}
                daysLeft={d}
              />
            );
          })}
        </AlertSection>
      )}

      {/* Riesgos alta severidad */}
      {highRisks.length > 0 && (
        <AlertSection
          icon={<ShieldAlert size={14} />}
          title="Riesgos Alta — pendientes"
          count={highRisks.length}
          color="#8F2C6C"
          bg="#FCF0F8"
        >
          {highRisks.map((r) => {
            const proj = projectMap[r.projectId];
            const d = daysUntil(r.dueDate);
            return (
              <RiskRow
                key={r.id}
                risk={r}
                projectCode={proj?.code ?? r.projectId}
                daysLeft={d}
              />
            );
          })}
        </AlertSection>
      )}
    </div>
  );
};

// ── Sección colapsable ─────────────────────────────────────
const AlertSection: React.FC<{
  icon: React.ReactNode; title: string; count: number;
  color: string; bg: string; children: React.ReactNode;
}> = ({ icon, title, count, color, bg, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      border: `1px solid ${color}30`, borderRadius: 8,
      background: "#fff", overflow: "hidden",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "10px 14px",
          background: bg, border: "none", cursor: "pointer",
          borderBottom: open ? `1px solid ${color}20` : "none",
          fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        <span style={{ color, display: "flex" }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color, flex: 1, textAlign: "left" }}>{title}</span>
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "1px 8px", borderRadius: 20,
          background: color, color: "#fff",
        }}>{count}</span>
        <span style={{ color, marginLeft: 4 }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>

      {/* Cuerpo */}
      {open && (
        <div style={{ padding: "8px 0" }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ── Fila de proyecto bloqueado ─────────────────────────────
const BlockedProjectRow: React.FC<{ project: Project; areaName: string }> = ({ project: p, areaName }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(`/projects`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("/projects")}
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "8px 14px", cursor: "pointer",
        borderBottom: "1px solid #F3F2F1",
        transition: "background 120ms",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#FDF3F0"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ""; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#8A8886", fontFamily: "monospace" }}>{p.code}</span>
          <span style={{ fontSize: 10, color: "#8A8886" }}>· {areaName}</span>
        </div>
        <p style={{
          margin: "2px 0 4px", fontSize: 12, fontWeight: 600, color: "#201F1E",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{p.name}</p>
        {p.blockedReason && (
          <p style={{ margin: 0, fontSize: 11, color: "#D83B01", lineHeight: 1.4 }}>
            ⚠ {p.blockedReason}
          </p>
        )}
      </div>
      <ExternalLink size={12} color="#8A8886" style={{ marginTop: 4, flexShrink: 0 }} />
    </div>
  );
};

// ── Fila de WorkItem próximo a vencer ─────────────────────
const DueWorkItemRow: React.FC<{
  workItem: WorkItem; stateName: string; projectCode: string; daysLeft: number;
}> = ({ workItem: wi, stateName, projectCode, daysLeft }) => {
  const isOverdue = daysLeft < 0;
  const dayLabel = isOverdue
    ? `Vencido hace ${Math.abs(daysLeft)} día${Math.abs(daysLeft) !== 1 ? "s" : ""}`
    : daysLeft === 0
    ? "Vence hoy"
    : `Vence en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`;

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "8px 14px", borderBottom: "1px solid #F3F2F1",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#8A8886", fontFamily: "monospace" }}>{projectCode}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "0 6px", borderRadius: 10,
            background: "#EDEBE9", color: "#605E5C",
          }}>{stateName}</span>
        </div>
        <p style={{
          margin: "2px 0 4px", fontSize: 12, fontWeight: 600, color: "#201F1E",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{wi.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: isOverdue ? "#D83B01" : "#C8A600",
          }}>
            📅 {dayLabel}
          </span>
          <span style={{ fontSize: 10, color: "#8A8886" }}>→ {formatDate(wi.endDate)}</span>
        </div>
        {wi.blockedReason && (
          <p style={{ margin: "3px 0 0", fontSize: 10, color: "#D83B01" }}>
            ⚠ {wi.blockedReason}
          </p>
        )}
      </div>
    </div>
  );
};

// ── Fila de Riesgo ────────────────────────────────────────
const RiskRow: React.FC<{ risk: Risk; projectCode: string; daysLeft: number }> = ({
  risk: r, projectCode, daysLeft,
}) => {
  const overdue = daysLeft < 0;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "8px 14px", borderBottom: "1px solid #F3F2F1",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#8A8886", fontFamily: "monospace" }}>{projectCode}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "0 6px", borderRadius: 10,
            background: "#FCF0F8", color: "#8F2C6C",
          }}>Riesgo Alta</span>
        </div>
        <p style={{
          margin: "2px 0 4px", fontSize: 12, fontWeight: 600, color: "#201F1E",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{r.title}</p>
        <div style={{ fontSize: 10, color: overdue ? "#D83B01" : "#8A8886" }}>
          Vencimiento: {formatDate(r.dueDate)}
          {overdue && <span style={{ marginLeft: 6, fontWeight: 700 }}>⚠ Vencido</span>}
        </div>
      </div>
    </div>
  );
};
