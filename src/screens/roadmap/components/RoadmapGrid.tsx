// ─────────────────────────────────────────────────────────
//  src/screens/roadmap/components/RoadmapGrid.tsx
//  Grid de proyectos agrupados dinámicamente.
//  Cada grupo tiene: encabezado con nombre + badge,
//  y una cuadrícula de RoadmapProjectCard.
// ─────────────────────────────────────────────────────────

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Project, BusinessArea, Provider } from "../../../types/domain";
import type { GroupBy, ZoomLevel } from "../tokens";
import { STATUS_COLOR } from "../tokens";
import { RoadmapProjectCard } from "./RoadmapProjectCard";

// ── Helpers de agrupación ─────────────────────────────────
export interface RoadmapGroup {
  key:      string;
  label:    string;
  projects: Project[];
}

function getQuarterLabel(q: number): string {
  return `Q${q} – ${["Ene–Mar", "Abr–Jun", "Jul–Sep", "Oct–Dic"][q - 1]}`;
}

function getMonthLabel(m: number): string {
  const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return names[m - 1] ?? `Mes ${m}`;
}

export function groupProjects(
  projects: Project[],
  groupBy:  GroupBy,
  areas:    BusinessArea[],
  providers: Provider[],
  zoom:     ZoomLevel,
): RoadmapGroup[] {
  // Para zoom Año/Trimestre/Mes/Semana usamos endDate como referencia temporal
  if (zoom === "quarter") {
    const groups: Record<number, Project[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const p of projects) {
      const q = Math.ceil((new Date(p.endDate).getMonth() + 1) / 3);
      groups[q].push(p);
    }
    return [1, 2, 3, 4]
      .filter((q) => groups[q].length > 0)
      .map((q) => ({ key: `Q${q}`, label: getQuarterLabel(q), projects: groups[q] }));
  }

  if (zoom === "month") {
    const groups: Record<number, Project[]> = {};
    for (const p of projects) {
      const m = new Date(p.endDate).getMonth() + 1;
      if (!groups[m]) groups[m] = [];
      groups[m].push(p);
    }
    return Object.keys(groups).map(Number).sort((a, b) => a - b).map((m) => ({
      key: `M${m}`, label: getMonthLabel(m), projects: groups[m],
    }));
  }

  if (zoom === "week") {
    const groups: Record<string, Project[]> = {};
    for (const p of projects) {
      const d = new Date(p.endDate);
      const start = new Date(d);
      start.setDate(d.getDate() - d.getDay() + 1); // Lunes
      const key = start.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.keys(groups).sort().map((key) => ({
      key, label: `Semana del ${key}`, projects: groups[key],
    }));
  }

  // zoom === "year" — agrupar por la dimensión seleccionada
  if (groupBy === "area") {
    const areaMap = Object.fromEntries(areas.map((a) => [a.id, a.name]));
    const groups: Record<string, Project[]> = {};
    for (const p of projects) {
      const key = p.businessAreaId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => (areaMap[a] ?? a).localeCompare(areaMap[b] ?? b))
      .map(([key, ps]) => ({ key, label: areaMap[key] ?? key, projects: ps }));
  }

  if (groupBy === "provider") {
    const provMap = Object.fromEntries(providers.map((pv) => [pv.id, pv.name]));
    const groups: Record<string, Project[]> = {};
    for (const p of projects) {
      const key = p.providerId || "__IT__";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => {
        const la = a === "__IT__" ? "IT AirEuropa" : provMap[a] ?? a;
        const lb = b === "__IT__" ? "IT AirEuropa" : provMap[b] ?? b;
        return la.localeCompare(lb);
      })
      .map(([key, ps]) => ({
        key,
        label: key === "__IT__" ? "IT AirEuropa" : provMap[key] ?? key,
        projects: ps,
      }));
  }

  if (groupBy === "deliveryOwner") {
    const groups: Record<string, Project[]> = { IT: [], Proveedor: [] };
    for (const p of projects) {
      groups[p.deliveryOwnerType].push(p);
    }
    return (["IT", "Proveedor"] as const)
      .filter((k) => groups[k].length > 0)
      .map((k) => ({ key: k, label: k === "IT" ? "IT AirEuropa" : "Proveedores externos", projects: groups[k] }));
  }

  // groupBy === "category"
  const groups: Record<string, Project[]> = {};
  for (const p of projects) {
    const key = p.category || "Sin categoría";
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ps]) => ({ key, label: key, projects: ps }));
}

// ── Componente ────────────────────────────────────────────
interface Props {
  groups:    RoadmapGroup[];
  areas:     BusinessArea[];
  providers: Provider[];
  userMap?:  Record<string, string>;
  teamMap?:  Record<string, string>;
  onSelect:  (p: Project) => void;
}

export const RoadmapGrid: React.FC<Props> = ({ groups, areas, providers, userMap, teamMap, onSelect }) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  if (groups.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "#8A8886" }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🗺️</div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#605E5C" }}>
          Ningún proyecto coincide con los filtros aplicados.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key);
        const blocked     = group.projects.filter((p) => p.status === "Bloqueado").length;

        // Mini resumen de estados para el encabezado del grupo
        const statusSummary = (["En curso", "Pendiente", "Bloqueado", "Cerrado"] as const)
          .map((s) => ({ s, count: group.projects.filter((p) => p.status === s).length }))
          .filter(({ count }) => count > 0);

        return (
          <section key={group.key}>
            {/* Encabezado de grupo */}
            <div
              onClick={() => toggle(group.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && toggle(group.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px",
                background: "#F3F2F1", borderRadius: 7,
                cursor: "pointer", marginBottom: isCollapsed ? 0 : 10,
                userSelect: "none",
              }}
            >
              {isCollapsed
                ? <ChevronRight size={14} color="#8A8886" />
                : <ChevronDown size={14} color="#8A8886" />
              }
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1B2A3E" }}>
                {group.label}
              </span>
              <span style={{
                fontSize: 11, color: "#8A8886", background: "#EDEBE9",
                borderRadius: 20, padding: "1px 8px", fontWeight: 600,
              }}>
                {group.projects.length}
              </span>

              {/* Mini-estado chips */}
              <div style={{ display: "flex", gap: 5, marginLeft: 4, flexWrap: "wrap" }}>
                {statusSummary.map(({ s, count }) => (
                  <span key={s} style={{
                    fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 12,
                    background: STATUS_COLOR[s], color: "#fff",
                  }}>{s} {count}</span>
                ))}
              </div>

              {blocked > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 10, color: "#D83B01", fontWeight: 700 }}>
                  ⚠ {blocked} bloqueado{blocked !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Cards */}
            {!isCollapsed && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
                gap: 10,
              }}>
                {group.projects.map((p) => (
                  <RoadmapProjectCard
                    key={p.id}
                    project={p}
                    area={areas.find((a) => a.id === p.businessAreaId)}
                    provider={p.providerId ? providers.find((pv) => pv.id === p.providerId) : undefined}
                    assigneeName={p.assignedToUserId && userMap ? userMap[p.assignedToUserId] : undefined}
                    teamName={p.assignedToTeamId && teamMap ? teamMap[p.assignedToTeamId] : undefined}
                    onClick={() => onSelect(p)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
