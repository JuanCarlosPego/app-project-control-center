// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/MyWorkPanel.tsx
//  Panel "Mis pendientes" — depende del rol.
//
//  IT AirEuropa: WIs asignados a IT + "Listo para pruebas"
//  Proveedor:    WIs asignados a Proveedor (solo sus proyectos)
//  Usuario:      WIs de proyectos que participa / solicitó
//  Admin:        Vista IT + badge de rol extra
//
//  Click en "Abrir" → WorkItemMiniDrawer
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import { ListChecks, ExternalLink, CheckCircle2 } from "lucide-react";
import type { WorkItem, Project, State, AppRole } from "../../../types/domain";
import { WorkItemMiniDrawer } from "./WorkItemMiniDrawer";

// ── Helpers ───────────────────────────────────────────────
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

const STATE_CATEGORY_COLOR: Record<string, string> = {
  "Pendiente": "#8A8886",
  "En curso":  "#0078D4",
  "Bloqueado": "#D83B01",
  "Cerrado":   "#107C10",
};

// ── Props ─────────────────────────────────────────────────
interface Props {
  allWorkItems:   WorkItem[];   // todos los WIs visibles para el usuario
  projects:       Project[];
  states:         State[];
  roles:          AppRole[];
  currentUserId:  string;
}

// ── Component ─────────────────────────────────────────────
export const MyWorkPanel: React.FC<Props> = ({
  allWorkItems, projects, states, roles, currentUserId,
}) => {
  const [selected, setSelected] = useState<WorkItem | null>(null);

  const canAdmin   = roles.includes("Admin") || roles.includes("IT AirEuropa");
  const isProveedor = roles.includes("Proveedor") && !canAdmin;
  const isUsuario   = roles.includes("Usuario") && !canAdmin && !isProveedor;

  const CLOSED_STATE = "st-cls";
  const stateMap   = Object.fromEntries(states.map((s) => [s.id, s]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p]));

  // ── Selección de items según rol ───────────────────────
  let myItems: WorkItem[] = [];

  if (canAdmin) {
    // IT / Admin: items asignados a IT + items en "Listo para pruebas" (cualquier rol)
    myItems = allWorkItems.filter((wi) =>
      wi.stateId !== CLOSED_STATE && (
        wi.assignedToRole === "IT AirEuropa" ||
        wi.stateId === "st-rft"             // Listo para pruebas
      ),
    );
  } else if (isProveedor) {
    // Proveedor: items asignados al rol Proveedor (MSW ya filtra por proyecto visible)
    myItems = allWorkItems.filter((wi) =>
      wi.stateId !== CLOSED_STATE && wi.assignedToRole === "Proveedor",
    );
  } else {
    // Usuario: items de proyectos donde currentUser es miembro o solicitante
    const myProjectIds = new Set(
      projects
        .filter((p) => p.requestedByUserId === currentUserId)
        .map((p) => p.id),
    );
    myItems = allWorkItems.filter((wi) =>
      wi.stateId !== CLOSED_STATE && myProjectIds.has(wi.projectId),
    );
  }

  // Ordenar: bloqueados primero, luego por días restantes
  myItems = [...myItems].sort((a, b) => {
    const aBlk = a.stateId === "st-blk" ? -1 : 0;
    const bBlk = b.stateId === "st-blk" ? -1 : 0;
    if (aBlk !== bBlk) return aBlk - bBlk;
    return daysUntil(a.endDate) - daysUntil(b.endDate);
  });

  const panelTitle = canAdmin
    ? "Mis pendientes — IT AirEuropa"
    : isProveedor
    ? "Mis pendientes — Proveedor"
    : "Mis pendientes";

  return (
    <>
      <div style={{
        background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
        overflow: "hidden", display: "flex", flexDirection: "column",
        height: "100%",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #EDEBE9",
          background: "#F8F9FB", display: "flex", alignItems: "center", gap: 8,
        }}>
          <ListChecks size={16} color="#0078D4" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1B2A3E", flex: 1 }}>
            {panelTitle}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "1px 9px",
            background: myItems.length > 0 ? "#0078D4" : "#EDEBE9",
            color: myItems.length > 0 ? "#fff" : "#8A8886",
            borderRadius: 20,
          }}>{myItems.length}</span>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {myItems.length === 0 ? (
            <EmptyWork />
          ) : (
            myItems.map((wi) => {
              const proj = projectMap[wi.projectId];
              const st   = stateMap[wi.stateId];
              const stCat = st?.category ?? "Pendiente";
              const days = daysUntil(wi.endDate);
              const almostDue = days >= 0 && days <= 7;
              const overdue   = days < 0;

              return (
                <div
                  key={wi.id}
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid #F3F2F1",
                    borderLeft: `3px solid ${wi.stateId === "st-blk" ? "#D83B01" : wi.stateId === "st-rft" ? "#C8A600" : "#EDEBE9"}`,
                  }}
                >
                  {/* Proyecto + estado */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    {proj && (
                      <span style={{ fontSize: 10, color: "#8A8886", fontFamily: "monospace", fontWeight: 600 }}>
                        {proj.code}
                      </span>
                    )}
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "0 6px", borderRadius: 10,
                      background: `${STATE_CATEGORY_COLOR[stCat]}22`,
                      color: STATE_CATEGORY_COLOR[stCat] ?? "#8A8886",
                    }}>
                      {st?.name ?? wi.stateId}
                    </span>
                    {wi.stateId === "st-rft" && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "0 6px", borderRadius: 10,
                        background: "#FFFBE6", color: "#C8A600",
                      }}>
                        ⚡ Necesita revisión
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <p style={{
                    margin: "0 0 5px", fontSize: 12, fontWeight: 600, color: "#201F1E",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {wi.title}
                  </p>

                  {/* Metadatos + Abrir */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {/* Fecha */}
                    <span style={{
                      fontSize: 10,
                      color: overdue ? "#D83B01" : almostDue ? "#C8A600" : "#8A8886",
                      fontWeight: (overdue || almostDue) ? 700 : 400,
                    }}>
                      {overdue
                        ? `⚠ Vencido (${Math.abs(days)}d)`
                        : almostDue
                        ? `⏰ ${days}d`
                        : `→ ${wi.endDate}`}
                    </span>

                    {/* Progreso */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 40, height: 4, background: "#EDEBE9", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          width: `${wi.progress}%`, height: "100%",
                          background: wi.progress === 100 ? "#107C10" : "#0078D4",
                          borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: "#8A8886" }}>{wi.progress}%</span>
                    </div>

                    {/* Botón Abrir */}
                    <button
                      onClick={() => setSelected(wi)}
                      style={{
                        marginLeft: "auto",
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 10px", borderRadius: 4, border: "1px solid #0078D4",
                        background: "#fff", color: "#0078D4", fontSize: 11, fontWeight: 600,
                        cursor: "pointer", fontFamily: "'Segoe UI', sans-serif",
                        transition: "background 120ms",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#EFF6FF"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                    >
                      <ExternalLink size={10} /> Abrir
                    </button>
                  </div>

                  {/* Bloqueo */}
                  {wi.blockedReason && (
                    <p style={{ margin: "5px 0 0", fontSize: 10, color: "#D83B01" }}>
                      ⚠ {wi.blockedReason}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Drawer de WorkItem */}
      <WorkItemMiniDrawer
        workItem={selected}
        project={selected ? projectMap[selected.projectId] : undefined}
        states={states}
        onClose={() => setSelected(null)}
      />
    </>
  );
};

// ── Empty state ───────────────────────────────────────────
const EmptyWork: React.FC = () => (
  <div style={{ textAlign: "center", padding: "32px 20px", color: "#8A8886" }}>
    <CheckCircle2 size={28} color="#107C10" style={{ marginBottom: 8 }} />
    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#107C10" }}>
      Todo al día
    </p>
    <p style={{ margin: "4px 0 0", fontSize: 11 }}>
      No tienes work items pendientes en este momento.
    </p>
  </div>
);
