// ─────────────────────────────────────────────────────────
//  src/screens/roadmap/components/RoadmapDrawer.tsx
//  Panel lateral de detalle de un proyecto en Roadmap.
//  Incluye: metadata, progreso, bloqueo, work items y
//  acceso rápido a Kanban/Roadmap (externo).
// ─────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import {
  X, Building2, Briefcase, Calendar, BarChart2,
  Tag, AlertTriangle, KanbanSquare, Map, Pencil, ListChecks,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffectiveUser } from "../../../auth/ImpersonationContext";
import type { Project, BusinessArea, Provider, AppRole, WorkItem } from "../../../types/domain";
import { getProjectWorkItems } from "../../../services/projectService";
import { STATUS_COLOR, PRIORITY_COLOR, DELIVERY_COLOR } from "../tokens";
import { Chip, ProgressBar } from "./RoadmapProjectCard";
import { CreateProjectModal } from "../../projects/components/CreateProjectModal";

// ── Constantes ────────────────────────────────────────────
const W = 460;

// ── Props ─────────────────────────────────────────────────
interface Props {
  project:   Project | null;
  areas:     BusinessArea[];
  providers: Provider[];
  roles:     AppRole[];
  onClose:   () => void;
  /** Callback para recargar tras guardar edición */
  onProjectUpdated?: () => void;
}

// ── Component ─────────────────────────────────────────────
export const RoadmapDrawer: React.FC<Props> = ({ project: p, areas, providers, roles, onClose, onProjectUpdated }) => {
  const navigate   = useNavigate();
  // canEdit usa el usuario efectivo (respeta impersonación en test mode)
  const { roles: effectiveRoles } = useEffectiveUser();
  const canEdit    = effectiveRoles.includes("Admin") || effectiveRoles.includes("IT AirEuropa");

  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loadingWI, setLoadingWI] = useState(false);
  const [activeTab, setActiveTab] = useState<"detail" | "workitems">("detail");
  const [editOpen,  setEditOpen]  = useState(false);

  // Cerrar con Escape
  useEffect(() => {
    if (!p) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [p, onClose]);

  // Cargar work items cuando se abre el drawer
  useEffect(() => {
    if (!p) { setWorkItems([]); return; }
    setLoadingWI(true);
    setActiveTab("detail");
    getProjectWorkItems(p.id)
      .then(setWorkItems)
      .catch(() => setWorkItems([]))
      .finally(() => setLoadingWI(false));
  }, [p?.id]);

  const area     = p ? areas.find((a) => a.id === p.businessAreaId) : undefined;
  const provider = p?.providerId ? providers.find((pv) => pv.id === p.providerId) : undefined;
  const open     = Boolean(p);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)",
          zIndex: 200, opacity: open ? 1 : 0,
          transition: "opacity 200ms", pointerEvents: open ? "auto" : "none",
        }}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Detalle del proyecto"
        aria-hidden={!open}
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: W,
          background: "#fff", zIndex: 201, overflowY: "auto",
          transform: open ? "translateX(0)" : `translateX(${W}px)`,
          transition: "transform 240ms cubic-bezier(.4,0,.2,1)",
          display: "flex", flexDirection: "column",
          boxShadow: open ? "-4px 0 20px rgba(0,0,0,0.14)" : "none",
        }}
      >
        {p && (
          <>
            {/* Header del drawer */}
            <div style={{
              position: "sticky", top: 0, zIndex: 10,
              background: "#fff",
              borderTop: `4px solid ${STATUS_COLOR[p.status] ?? "#EDEBE9"}`,
              padding: "14px 18px 10px",
              borderBottom: "1px solid #EDEBE9",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 10, color: "#8A8886", fontFamily: "monospace", fontWeight: 600 }}>
                    {p.code}
                  </span>
                  <h2 style={{ margin: "4px 0 8px", fontSize: 15, fontWeight: 700, color: "#1B2A3E", lineHeight: 1.3 }}>
                    {p.name}
                  </h2>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Chip label={p.status}   color={STATUS_COLOR[p.status] ?? "#8A8886"} />
                    <Chip label={p.priority} color={PRIORITY_COLOR[p.priority] ?? "#8A8886"} />
                    <Chip
                      label={p.deliveryOwnerType === "IT" ? "IT AirEuropa" : provider?.name ?? "Proveedor"}
                      color={DELIVERY_COLOR[p.deliveryOwnerType] ?? "#8A8886"}
                    />
                  </div>
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

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #EDEBE9", background: "#FAFAFA" }}>
              {(["detail", "workitems"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: "9px 0", fontSize: 12, fontWeight: 600,
                    border: "none", cursor: "pointer",
                    background: activeTab === tab ? "#fff" : "transparent",
                    color: activeTab === tab ? "#0078D4" : "#605E5C",
                    borderBottom: activeTab === tab ? "2px solid #0078D4" : "2px solid transparent",
                    fontFamily: "'Segoe UI', sans-serif",
                    transition: "all 150ms",
                  }}
                >
                  {tab === "detail" ? "Detalle" : `Work Items (${workItems.length})`}
                </button>
              ))}
            </div>

            {/* Contenido del tab */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
              {activeTab === "detail" && (
                <DetailTab p={p} area={area} provider={provider} canEdit={canEdit} navigate={navigate} onEditProject={() => setEditOpen(true)} />
              )}
              {activeTab === "workitems" && (
                <WorkItemsTab workItems={workItems} loading={loadingWI} />
              )}
            </div>
          </>
        )}
      </aside>

      {/* Modal de edición de proyecto */}
      {p && editOpen && (
        <CreateProjectModal
          open={editOpen}
          initialProject={p}
          areas={areas}
          providers={providers}
          categories={[p.category].filter(Boolean)}
          onClose={() => setEditOpen(false)}
          onCreated={() => { setEditOpen(false); onProjectUpdated?.(); }}
        />
      )}
    </>
  );
};

// (modal de edición montado dentro del component)

// ── Tab Detalle ───────────────────────────────────────────
const DetailTab: React.FC<{
  p: Project; area?: BusinessArea; provider?: Provider;
  canEdit: boolean; navigate: ReturnType<typeof useNavigate>;
  onEditProject: () => void;
}> = ({ p, area, provider, canEdit, navigate, onEditProject }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* Progreso */}
    <Section title="Avance">
      <ProgressBar value={p.progress} height={8} />
    </Section>

    {/* Metadata */}
    <Section title="Información">
      <Grid2>
        <MetaItem icon={<Building2 size={12} />} label="Área" value={area?.name ?? p.businessAreaId} />
        <MetaItem icon={<Briefcase size={12} />}  label="Ejecutor" value={p.deliveryOwnerType === "IT" ? "IT AirEuropa" : provider?.name ?? "—"} />
        <MetaItem icon={<Calendar size={12} />}   label="Inicio" value={p.startDate} />
        <MetaItem icon={<Calendar size={12} />}   label="Fin" value={p.endDate} />
        <MetaItem icon={<BarChart2 size={12} />}  label="Prioridad" value={p.priority} />
        <MetaItem icon={<Tag size={12} />}         label="Categoría" value={p.category} />
      </Grid2>
    </Section>

    {/* Bloqueo */}
    {p.blockedReason && (
      <Section title="Motivo de bloqueo">
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 8,
          background: "#FDF3F0", borderRadius: 6, padding: "10px 12px",
          border: "1px solid #FDCFBC",
        }}>
          <AlertTriangle size={14} color="#D83B01" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 12, color: "#D83B01", lineHeight: 1.5 }}>{p.blockedReason}</p>
        </div>
      </Section>
    )}

    {/* Acciones rápidas */}
    <Section title="Acciones">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <QuickAction
          icon={<KanbanSquare size={13} />}
          label="Ver en Kanban"
          onClick={() => navigate(`/kanban?projectId=${p.id}`)}
        />
        <QuickAction
          icon={<Map size={13} />}
          label="Enlazar Roadmap"
          onClick={() => navigate(`/roadmap?projectId=${p.id}`)}
        />
        {canEdit && (
          <QuickAction
            icon={<Pencil size={13} />}
            label="Editar proyecto"
            onClick={onEditProject}
            variant="secondary"
          />
        )}
      </div>
    </Section>
  </div>
);

// ── Tab Work Items ────────────────────────────────────────
const WorkItemsTab: React.FC<{ workItems: WorkItem[]; loading: boolean }> = ({ workItems, loading }) => {
  if (loading) return <p style={{ fontSize: 12, color: "#8A8886" }}>Cargando work items…</p>;
  if (workItems.length === 0) return (
    <div style={{ textAlign: "center", padding: "32px 0", color: "#8A8886" }}>
      <ListChecks size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
      <p style={{ margin: 0, fontSize: 13 }}>No hay work items asociados.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {workItems.map((wi) => (
        <div key={wi.id} style={{
          border: "1px solid #EDEBE9", borderRadius: 6,
          padding: "10px 12px", background: "#FAFAFA",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#201F1E", flex: 1 }}>{wi.title}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10,
              background: wi.blockedReason ? "#D83B01" : "#EDEBE9",
              color: wi.blockedReason ? "#fff" : "#323130",
              whiteSpace: "nowrap",
            }}>
              {wi.type}
            </span>
          </div>
          <ProgressBar value={wi.progress} height={4} />
          <div style={{ marginTop: 4, fontSize: 10, color: "#8A8886" }}>
            {wi.startDate ? new Date(wi.startDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—"}
            {" → "}
            {wi.endDate   ? new Date(wi.endDate).toLocaleDateString(  "es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
            {" · "}{wi.assignedToRole}
          </div>
          {wi.blockedReason && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#D83B01" }}>
              ⚠ {wi.blockedReason}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Micro-componentes ─────────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "#8A8886", letterSpacing: "0.08em", textTransform: "uppercase" }}>{title}</p>
    {children}
  </div>
);

const Grid2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>
);

const MetaItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
    <span style={{ fontSize: 10, color: "#8A8886", display: "flex", alignItems: "center", gap: 4 }}>
      {icon} {label}
    </span>
    <span style={{ fontSize: 12, fontWeight: 600, color: "#201F1E" }}>{value || "—"}</span>
  </div>
);

const QuickAction: React.FC<{
  icon: React.ReactNode; label: string; onClick: () => void; variant?: "secondary";
}> = ({ icon, label, onClick, variant }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "6px 12px", borderRadius: 5, fontSize: 12, cursor: "pointer",
      fontFamily: "'Segoe UI', sans-serif", transition: "background 150ms",
      border: variant ? "1px solid #EDEBE9" : "1px solid #0078D4",
      background: variant ? "#fff" : "#0078D4",
      color: variant ? "#323130" : "#fff",
      fontWeight: 600,
    }}
    onMouseEnter={(e) => {
      const el = e.currentTarget as HTMLButtonElement;
      el.style.background = variant ? "#F3F2F1" : "#006CBE";
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLButtonElement;
      el.style.background = variant ? "#fff" : "#0078D4";
    }}
  >
    {icon}{label}
  </button>
);
