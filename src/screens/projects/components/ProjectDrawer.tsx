// ─────────────────────────────────────────────────────────
//  src/screens/projects/components/ProjectDrawer.tsx
//  Panel lateral con detalle de un proyecto (Épica).
//  Incluye lista real de WorkItems, acciones rápidas,
//  cálculo de avance por cerrados y botón "+ Añadir tarea".
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import {
  X, Building2, Briefcase, Calendar, BarChart2,
  Tag, AlertTriangle, KanbanSquare, Map, Pencil,
  ListTodo, Plus, ExternalLink, CheckCircle2,
  Clock, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Project, BusinessArea, Provider, AppRole, WorkItem, State } from "../../../types/domain";
import { Chip, ProgressBar, STATUS_COLOR, PRIORITY_COLOR } from "./ProjectCard";
import { CreateWorkItemModal } from "./CreateWorkItemModal";

// ── Props ─────────────────────────────────────────────────
interface Props {
  project: Project | null;
  areas: BusinessArea[];
  providers: Provider[];
  roles: AppRole[];
  states: State[];
  onClose: () => void;
}

const W = 440; // ancho del drawer

// ── Colores de estado (WorkItem mini-chip) ────────────────
const STATE_BG: Record<string, string> = {
  "st-new":  "#EFF6FC", "st-ref":  "#F3EFF7", "st-prog": "#E1EFDD",
  "st-blk":  "#FDE7E9", "st-rft":  "#E8F5E9", "st-test": "#FFF4CE",
  "st-acc":  "#DFF6DD", "st-cls":  "#E8E8E8",
};
const STATE_TXT: Record<string, string> = {
  "st-new":  "#0078D4", "st-ref":  "#7530AF", "st-prog": "#107C10",
  "st-blk":  "#D13438", "st-rft":  "#107C10", "st-test": "#835B00",
  "st-acc":  "#107C10", "st-cls":  "#605E5C",
};

// ── RBAC ──────────────────────────────────────────────────
const canCreateTask = (roles: AppRole[]) =>
  roles.includes("Admin") || roles.includes("IT AirEuropa") || roles.includes("Proveedor");

// ── Helpers ───────────────────────────────────────────────
const fmtDate = (d?: string) => {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const isNearDeadline = (endDate?: string) => {
  if (!endDate) return false;
  const diff = (new Date(endDate).getTime() - Date.now()) / 86_400_000;
  return diff >= 0 && diff <= 14;
};

// ── WI state chip ─────────────────────────────────────────
const WiStateChip: React.FC<{ stateId: string; stateName: string }> = ({ stateId, stateName }) => (
  <span style={{
    display: "inline-block", padding: "1px 7px", borderRadius: 8,
    background: STATE_BG[stateId] ?? "#F3F2F1",
    color: STATE_TXT[stateId] ?? "#605E5C",
    fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
    fontFamily: "'Segoe UI', sans-serif", lineHeight: 1.7,
  }}>{stateName}</span>
);

// ── Fila WorkItem en el drawer ────────────────────────────
const WorkItemRow: React.FC<{
  wi: WorkItem; stateName: string; onClick: () => void;
}> = ({ wi, stateName, onClick }) => {
  const near = isNearDeadline(wi.endDate);
  return (
    <div
      onClick={onClick}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
      style={{
        display: "flex", flexDirection: "column", gap: 4,
        padding: "9px 10px", borderRadius: 6,
        border: "1px solid #EDEBE9", background: "#FAFAFA",
        cursor: "pointer", transition: "background 120ms",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#EFF6FC"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{
          flex: 1, fontSize: 12, fontWeight: 500, color: "#201F1E",
          fontFamily: "'Segoe UI', sans-serif", lineHeight: 1.4,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }} title={wi.title}>{wi.title}</span>
        <WiStateChip stateId={wi.stateId} stateName={stateName} />
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 10, color: "#8A8886", fontFamily: "'Segoe UI', sans-serif",
      }}>
        <span style={{
          padding: "1px 6px", borderRadius: 8, background: "#F3F2F1",
          color: "#605E5C", fontWeight: 500,
        }}>{wi.assignedToRole === "IT AirEuropa" ? "IT" : wi.assignedToRole}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <Clock size={10} />
          <span style={{ color: near ? "#CA8B00" : "#8A8886", fontWeight: near ? 600 : 400 }}>
            {fmtDate(wi.endDate)}
          </span>
          {near && <AlertTriangle size={9} color="#CA8B00" />}
        </span>
        {wi.priority && (
          <span style={{
            padding: "1px 6px", borderRadius: 8,
            background: wi.priority === "Alta" ? "#FDE7E9" : wi.priority === "Media" ? "#FFF4CE" : "#E8F5E9",
            color: wi.priority === "Alta" ? "#D13438" : wi.priority === "Media" ? "#835B00" : "#107C10",
            fontWeight: 600,
          }}>{wi.priority}</span>
        )}
      </div>
    </div>
  );
};

// ── ProjectDrawer ─────────────────────────────────────────
export const ProjectDrawer: React.FC<Props> = ({
  project: p, areas, providers, roles, states, onClose,
}) => {
  const navigate = useNavigate();
  const canEdit   = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const canCreate = canCreateTask(roles);

  const [workItems,  setWorkItems]  = useState<WorkItem[]>([]);
  const [wiLoading,  setWiLoading]  = useState(false);
  const [wiError,    setWiError]    = useState<string | null>(null);
  const [showAllWIs, setShowAllWIs] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const loadWorkItems = useCallback(async (projectId: string) => {
    setWiLoading(true); setWiError(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/workitems`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setWorkItems(await r.json());
    } catch (e) {
      setWiError(e instanceof Error ? e.message : "Error al cargar tareas");
    } finally { setWiLoading(false); }
  }, []);

  useEffect(() => {
    if (p) { setShowAllWIs(false); loadWorkItems(p.id); }
    else    setWorkItems([]);
  }, [p, loadWorkItems]);

  useEffect(() => {
    if (!p) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !createOpen) onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [p, onClose, createOpen]);

  const area     = p ? areas.find((a) => a.id === p.businessAreaId) : undefined;
  const provider = p?.providerId ? providers.find((pv) => pv.id === p.providerId) : undefined;

  const totalWI  = workItems.length;
  const closedWI = workItems.filter((wi) => wi.stateId === "st-cls").length;
  const progress = totalWI > 0 ? Math.round((closedWI / totalWI) * 100) : (p?.progress ?? 0);

  const getStateName = (sid: string) => states.find((s) => s.id === sid)?.name ?? sid;

  const MAX_VISIBLE = 6;
  const visibleWIs = showAllWIs ? workItems : workItems.slice(0, MAX_VISIBLE);
  const hasMore    = workItems.length > MAX_VISIBLE;

  return (
    <>
      <div
        onClick={createOpen ? undefined : onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)",
          zIndex: 200, opacity: p ? 1 : 0,
          transition: "opacity 200ms",
          pointerEvents: p ? "auto" : "none",
        }}
      />

      <aside
        aria-label="Detalle del proyecto" aria-hidden={!p} role="dialog"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0,
          width: W, background: "#fff", zIndex: 201,
          boxShadow: "-4px 0 24px rgba(0,0,0,0.14)",
          transform: p ? "translateX(0)" : `translateX(${W}px)`,
          transition: "transform 240ms cubic-bezier(.4,0,.2,1)",
          display: "flex", flexDirection: "column",
          fontFamily: "'Segoe UI', sans-serif", overflowY: "auto",
        }}
      >
        {p && (
          <>
            {/* Header */}
            <div style={{
              padding: "18px 20px 14px",
              borderBottom: `3px solid ${STATUS_COLOR[p.status] ?? "#EDEBE9"}`,
              position: "sticky", top: 0, background: "#fff", zIndex: 2,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <code style={{ fontSize: 10, color: "#8A8886", letterSpacing: "0.04em" }}>{p.code}</code>
                  <h2 style={{ margin: "4px 0 8px", fontSize: 15, fontWeight: 700, color: "#201F1E", lineHeight: 1.35, paddingRight: 12 }}>
                    {p.name}
                  </h2>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Chip label={p.status} color={STATUS_COLOR[p.status] ?? "#8A8886"} />
                    <Chip label={p.priority} color={PRIORITY_COLOR[p.priority] ?? "#8A8886"} small />
                    {p.category && (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, border: "1px solid #EDEBE9", color: "#605E5C" }}>
                        {p.category}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={onClose} aria-label="Cerrar panel" style={{
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  width: 30, height: 30, border: "1px solid #EDEBE9", borderRadius: 6,
                  background: "transparent", cursor: "pointer", color: "#605E5C",
                }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Progreso calculado por cerrados */}
              <Section title="Progreso de la épica">
                <ProgressBar value={progress} height={8} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, fontFamily: "'Segoe UI', sans-serif" }}>
                  <span style={{ color: "#8A8886" }}>
                    {wiLoading ? "Calculando…"
                      : totalWI > 0
                        ? <>{`Cerradas: `}<strong style={{ color: "#107C10" }}>{closedWI}/{totalWI}</strong></>
                        : "Sin tareas aún"}
                  </span>
                  <span style={{ fontWeight: 700, color: progress >= 100 ? "#107C10" : "#0078D4" }}>{progress}%</span>
                </div>
              </Section>

              {/* Metadatos */}
              <Section title="Información">
                <InfoRow icon={<Building2 size={13} />} label="Área"      value={area?.name ?? p.businessAreaId} />
                <InfoRow
                  icon={<Briefcase size={13} />} label="Ejecutor"
                  value={p.deliveryOwnerType === "Proveedor" && provider ? `Proveedor — ${provider.name}` : "IT AirEuropa"}
                />
                <InfoRow icon={<Calendar size={13} />}  label="Inicio"    value={fmtDate(p.startDate)} />
                <InfoRow icon={<Calendar size={13} />}  label="Fin"       value={fmtDate(p.endDate)} />
                <InfoRow icon={<BarChart2 size={13} />} label="Avance"    value={`${progress}%`} />
                <InfoRow icon={<Tag size={13} />}       label="Categoría" value={p.category ?? "—"} />
              </Section>

              {/* Bloqueo */}
              {p.blockedReason && (
                <Section title="Motivo de bloqueo">
                  <div style={{
                    display: "flex", gap: 8, background: "#FDF3F0", border: "1px solid #FDCFBC",
                    borderRadius: 6, padding: "10px 12px", fontSize: 12, color: "#D83B01", lineHeight: 1.5,
                  }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{p.blockedReason}</span>
                  </div>
                </Section>
              )}

              {/* Acciones rápidas */}
              <Section title="Acciones rápidas">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <DrawerAction icon={<KanbanSquare size={14} />} label="Ver tablero Kanban"
                    onClick={() => { onClose(); navigate(`/kanban?projectId=${p.id}`); }} />
                  <DrawerAction icon={<ListTodo size={14} />} label="Ver todas en Backlog"
                    onClick={() => { onClose(); navigate(`/backlog?projectId=${p.id}`); }} />
                  <DrawerAction icon={<Map size={14} />} label="Ver en Roadmap"
                    onClick={() => { onClose(); navigate(`/roadmap?projectId=${p.id}`); }} />
                  <DrawerAction icon={<BarChart2 size={14} />} label="Ver en Gantt"
                    onClick={() => { onClose(); navigate(`/gantt?projectId=${p.id}`); }} />
                  {canEdit && (
                    <DrawerAction icon={<Pencil size={14} />} label="Editar proyecto"
                      onClick={() => alert(`Editar proyecto ${p.code} — próximamente`)} accent />
                  )}
                </div>
              </Section>

              {/* WorkItems */}
              <Section
                title={`Tareas (${totalWI})`}
                action={
                  canCreate ? (
                    <button
                      onClick={() => setCreateOpen(true)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "4px 10px", borderRadius: 5, border: "none",
                        background: "#0078D4", color: "#fff",
                        fontSize: 11, fontWeight: 600,
                        fontFamily: "'Segoe UI', sans-serif", cursor: "pointer",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#006CBE"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#0078D4"; }}
                    >
                      <Plus size={11} /> Añadir tarea
                    </button>
                  ) : undefined
                }
              >
                {wiLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i} style={{
                        height: 52, borderRadius: 6, background: "#F3F2F1",
                        animation: "shimmer 1.4s ease-in-out infinite",
                      }} />
                    ))}
                    <style>{`@keyframes shimmer{0%,100%{opacity:1}50%{opacity:0.45}}`}</style>
                  </div>
                ) : wiError ? (
                  <div style={{
                    background: "#FDF3F0", border: "1px solid #FDCFBC", borderRadius: 6,
                    padding: "10px 12px", fontSize: 12, color: "#D13438",
                    display: "flex", gap: 6, alignItems: "center",
                  }}>
                    <AlertTriangle size={13} /> {wiError}
                  </div>
                ) : workItems.length === 0 ? (
                  <div style={{
                    background: "#F9F8F8", borderRadius: 6, padding: "20px 16px",
                    textAlign: "center", display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 8,
                  }}>
                    <CheckCircle2 size={28} color="#BDBDBD" />
                    <p style={{ margin: 0, fontSize: 12, color: "#8A8886" }}>
                      Este proyecto aún no tiene tareas.
                    </p>
                    {canCreate && (
                      <button
                        onClick={() => setCreateOpen(true)}
                        style={{
                          marginTop: 4, padding: "6px 14px", borderRadius: 5,
                          border: "1px solid #0078D4", background: "#EFF6FC",
                          color: "#0078D4", cursor: "pointer", fontSize: 12,
                          fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
                        }}
                      >
                        + Añadir primera tarea
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {visibleWIs.map((wi) => (
                      <WorkItemRow
                        key={wi.id}
                        wi={wi}
                        stateName={getStateName(wi.stateId)}
                        onClick={() => { onClose(); navigate(`/kanban?projectId=${p.id}&highlightWI=${wi.id}`); }}
                      />
                    ))}
                    {hasMore && (
                      <button
                        onClick={() => setShowAllWIs((v) => !v)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                          padding: "6px", borderRadius: 5, border: "1px solid #EDEBE9",
                          background: "transparent", cursor: "pointer", fontSize: 11,
                          color: "#0078D4", fontFamily: "'Segoe UI', sans-serif",
                        }}
                      >
                        {showAllWIs ? "Ver menos" : `Ver ${workItems.length - MAX_VISIBLE} tareas más`}
                        <ChevronRight size={11} style={{ transform: showAllWIs ? "rotate(-90deg)" : "rotate(90deg)" }} />
                      </button>
                    )}
                    <button
                      onClick={() => { onClose(); navigate(`/backlog?projectId=${p.id}`); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                        padding: "6px", borderRadius: 5, border: "none", background: "transparent",
                        cursor: "pointer", fontSize: 11, color: "#605E5C",
                        fontFamily: "'Segoe UI', sans-serif", textDecoration: "underline",
                      }}
                    >
                      <ExternalLink size={10} /> Ver todas en Backlog
                    </button>
                  </div>
                )}
              </Section>
            </div>
          </>
        )}
      </aside>

      {/* Modal de creación */}
      {p && (
        <CreateWorkItemModal
          open={createOpen}
          project={p}
          states={states}
          onClose={() => setCreateOpen(false)}
          onCreated={() => loadWorkItems(p.id)}
        />
      )}
    </>
  );
};

// ── Micro-componentes ─────────────────────────────────────
const Section: React.FC<{
  title: string; children: React.ReactNode; action?: React.ReactNode;
}> = ({ title, children, action }) => (
  <div>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8A8886" }}>
        {title}
      </div>
      {action}
    </div>
    {children}
  </div>
);

const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px solid #F3F2F1", fontSize: 12 }}>
    <span style={{ color: "#8A8886", display: "flex", flexShrink: 0 }}>{icon}</span>
    <span style={{ color: "#8A8886", width: 70, flexShrink: 0 }}>{label}</span>
    <span style={{ color: "#201F1E", fontWeight: 500 }}>{value}</span>
  </div>
);

const DrawerAction: React.FC<{
  icon: React.ReactNode; label: string; onClick: () => void; accent?: boolean;
}> = ({ icon, label, onClick, accent }) => (
  <button
    onClick={onClick}
    style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 12px", border: `1px solid ${accent ? "#0078D4" : "#EDEBE9"}`,
      borderRadius: 6, background: accent ? "#EFF6FC" : "#fff",
      cursor: "pointer", color: accent ? "#0078D4" : "#323130",
      fontSize: 12, fontFamily: "'Segoe UI', sans-serif", fontWeight: accent ? 600 : 400,
      textAlign: "left", transition: "background 150ms",
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accent ? "#DEEDFB" : "#F3F2F1"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = accent ? "#EFF6FC" : "#fff"; }}
  >
    {icon}{label}
  </button>
);
