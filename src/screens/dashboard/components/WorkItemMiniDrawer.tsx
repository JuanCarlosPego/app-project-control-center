// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/WorkItemMiniDrawer.tsx
//  Drawer lateral ligero para ver el detalle de un WorkItem
//  directamente desde el Dashboard sin navegar.
//
//  Props: workItem (nullable), project, states, onClose
//  🔌 FUTURO: ampliar con tabs Comentarios / Evidencias / Historial
// ─────────────────────────────────────────────────────────

import React, { useEffect } from "react";
import {
  X, Calendar, Tag, BarChart2, Briefcase, AlertTriangle, User,
} from "lucide-react";
import type { WorkItem, Project, State } from "../../../types/domain";

// ── Tokens ────────────────────────────────────────────────
const STATE_COLOR: Record<string, string> = {
  "st-new":  "#8A8886",
  "st-ref":  "#8A8886",
  "st-prog": "#0078D4",
  "st-blk":  "#D83B01",
  "st-rft":  "#C8A600",
  "st-test": "#0078D4",
  "st-acc":  "#107C10",
  "st-cls":  "#107C10",
};

const TYPE_COLOR: Record<string, string> = {
  Feature:  "#0078D4",
  Bug:      "#D83B01",
  TechDebt: "#C8A600",
  Spike:    "#5C2D91",
};

const PRIORITY_COLOR: Record<string, string> = {
  Alta:  "#D83B01",
  Media: "#C8A600",
  Baja:  "#8A8886",
};

const W = 420;

// ── Props ─────────────────────────────────────────────────
interface Props {
  workItem:  WorkItem | null;
  project?:  Project;
  states:    State[];
  onClose:   () => void;
}

// ── Component ─────────────────────────────────────────────
export const WorkItemMiniDrawer: React.FC<Props> = ({ workItem: wi, project, states, onClose }) => {
  const open = Boolean(wi);

  // Cerrar con Escape
  useEffect(() => {
    if (!wi) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [wi, onClose]);

  const state = wi ? states.find((s) => s.id === wi.stateId) : undefined;
  const stateColor = wi ? (STATE_COLOR[wi.stateId] ?? "#8A8886") : "#8A8886";

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.24)",
          zIndex: 300, opacity: open ? 1 : 0,
          transition: "opacity 180ms", pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Detalle del work item"
        aria-hidden={!open}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: W,
          background: "#fff", zIndex: 301, overflowY: "auto",
          transform: open ? "translateX(0)" : `translateX(${W}px)`,
          transition: "transform 220ms cubic-bezier(.4,0,.2,1)",
          display: "flex", flexDirection: "column",
          boxShadow: open ? "-4px 0 18px rgba(0,0,0,0.12)" : "none",
        }}
      >
        {wi && (
          <>
            {/* Header */}
            <div style={{
              position: "sticky", top: 0, zIndex: 10,
              background: "#fff",
              borderTop: `4px solid ${stateColor}`,
              padding: "14px 18px 12px",
              borderBottom: "1px solid #EDEBE9",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  {/* Etiquetas */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                    <Badge label={wi.type}     color={TYPE_COLOR[wi.type] ?? "#8A8886"} />
                    <Badge label={wi.priority} color={PRIORITY_COLOR[wi.priority] ?? "#8A8886"} />
                    <Badge label={state?.name ?? wi.stateId} color={stateColor} />
                  </div>
                  {/* Título */}
                  <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1B2A3E", lineHeight: 1.3 }}>
                    {wi.title}
                  </h2>
                  {/* Proyecto */}
                  {project && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8A8886" }}>
                      {project.code} · {project.name}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  style={{
                    border: "none", background: "none", cursor: "pointer",
                    color: "#8A8886", padding: 4, borderRadius: 4,
                    display: "flex", alignItems: "center",
                  }}
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Contenido */}
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Avance */}
              <Section title="Avance">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 8, background: "#EDEBE9", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${wi.progress}%`,
                      background: wi.progress === 100 ? "#107C10" : "#0078D4",
                      borderRadius: 8, transition: "width 400ms",
                    }} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#323130", minWidth: 34, textAlign: "right" }}>
                    {wi.progress}%
                  </span>
                </div>
              </Section>

              {/* Información */}
              <Section title="Información">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <MetaItem icon={<Calendar size={12} />}  label="Inicio" value={wi.startDate} />
                  <MetaItem icon={<Calendar size={12} />}  label="Fin"    value={wi.endDate} />
                  <MetaItem icon={<User size={12} />}       label="Asignado a" value={wi.assignedToRole} />
                  <MetaItem icon={<BarChart2 size={12} />}  label="Prioridad"  value={wi.priority} />
                </div>
              </Section>

              {/* Tags */}
              {wi.tags && wi.tags.length > 0 && (
                <Section title="Etiquetas">
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {wi.tags.map((tag) => (
                      <span key={tag} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 8px", borderRadius: 12,
                        background: "#F3F2F1", color: "#605E5C", fontSize: 11,
                      }}>
                        <Tag size={9} /> {tag}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Bloqueo */}
              {wi.blockedReason && (
                <Section title="Motivo de bloqueo">
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 8,
                    background: "#FDF3F0", borderRadius: 6, padding: "10px 12px",
                    border: "1px solid #FDCFBC",
                  }}>
                    <AlertTriangle size={14} color="#D83B01" style={{ marginTop: 1, flexShrink: 0 }} />
                    <p style={{ margin: 0, fontSize: 12, color: "#D83B01", lineHeight: 1.5 }}>
                      {wi.blockedReason}
                    </p>
                  </div>
                </Section>
              )}

              {/* Placeholder futuro */}
              <div style={{
                borderTop: "1px dashed #EDEBE9", paddingTop: 16,
                fontSize: 11, color: "#8A8886", textAlign: "center",
              }}>
                🔌 Próximamente: Comentarios · Evidencias · Historial de estados
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
};

// ── Micro-componentes ─────────────────────────────────────
const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    color: "#fff", background: color,
  }}>{label}</span>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p style={{
      margin: "0 0 8px", fontSize: 10, fontWeight: 700,
      color: "#8A8886", letterSpacing: "0.08em", textTransform: "uppercase",
    }}>{title}</p>
    {children}
  </div>
);

const MetaItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div>
    <span style={{ fontSize: 10, color: "#8A8886", display: "flex", alignItems: "center", gap: 4 }}>
      {icon} {label}
    </span>
    <span style={{ fontSize: 12, fontWeight: 600, color: "#201F1E" }}>{value || "—"}</span>
  </div>
);
