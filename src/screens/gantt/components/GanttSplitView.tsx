// ─────────────────────────────────────────────────────────
//  src/screens/gantt/components/GanttSplitView.tsx
//
//  Split view Gantt:
//  - Panel izquierdo STICKY (tabla de filas): título, estado,
//    asignado, fechas, progreso, expand/collapse subtasks
//  - Panel derecho TIMELINE: cabecera mes/semana + barras
//  - Un único contenedor con overflow auto (x+y)
//  - Hoy: línea vertical roja
//  - Click en fila/barra → onSelect(row)
// ─────────────────────────────────────────────────────────

import React, { useRef, useState } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, ExternalLink } from "lucide-react";
import type { State } from "../../../types/domain";
import {
  ROW_HEIGHT, HEADER_HEIGHT,
  computeTimelineRange, getBarPosition, getTodayOffset,
  formatDate,
  type ZoomLevel, type TimelineColumn,
} from "../ganttUtils";
import { getStateColor, ROLE_COLORS } from "../tokens";

// ── Tipos de fila ─────────────────────────────────────────
export interface GanttRowData {
  id: string;
  type: "epic" | "workitem" | "group";
  parentId?: string;      // projectId para workitems
  projectId: string;
  projectCode: string;    // e.g. "DIROPS-01"
  title: string;
  stateId: string;
  assignedToRole: string;
  assignedToUserId?: string;        // au-xxx del WI
  assignedToTeamId?: string | null; // team-xxx del WI
  assignedToDisplayName?: string;   // nombre resuelto del asignado
  startDate: string;
  endDate: string;
  progress?: number;
  priority?: string;
  wiType?: string;        // Feature|Bug|TechDebt|Spike (solo WI)
  blockedReason?: string;
  tags?: string[];        // solo WI
  jiraUrl?: string;       // solo WI
  jiraIssueKey?: string;  // solo WI
  sprintName?: string;    // solo WI
  hasChildren: boolean;   // true si épica tiene workitems
  isExpanded: boolean;
  indent: number;         // 0=Épica, 1=WorkItem, -1=Group header
  closedCount?: number;   // WIs cerrados (solo épicas)
  totalWICount?: number;  // WIs totales (solo épicas)
  // Group-specific
  isCollapsed?: boolean;  // para filas de grupo
  groupCount?: number;    // contador de items del grupo
  groupKey?: string;      // clave para identificar el grupo
}

// ── Props del componente ──────────────────────────────────
interface Props {
  rows: GanttRowData[];
  states: State[];
  zoom: ZoomLevel;
  showToday: boolean;
  selectedId: string | null;
  onSelect: (row: GanttRowData) => void;
  onToggleExpand: (id: string) => void;
  onGoToDetail: (row: GanttRowData) => void;
  onToggleGroup: (id: string) => void;
  loading: boolean;
  rangeFrom?: string;  // fecha mínima forzada para el timeline
  rangeTo?: string;    // fecha máxima forzada para el timeline
}

// ── Constantes de columnas (panel izquierdo) ──────────────
const COL = {
  expand:   26,
  title:   148,
  state:    80,
  role:     84,
  start:    58,
  end:      58,
  progress: 36,
  action:   30,  // botón "Ir al detalle"
};
const TOTAL_LEFT = Object.values(COL).reduce((a, b) => a + b, 0);
const LEFT_COLLAPSED = COL.expand + COL.action + 8;

// ── Chip pequeño ──────────────────────────────────────────
const Chip: React.FC<{ label: string; bg: string; color: string; size?: number }> = ({
  label, bg, color, size = 10,
}) => (
  <span style={{
    display: "inline-block", padding: "1px 6px", borderRadius: 8,
    background: bg, color, fontSize: size, fontWeight: 600,
    whiteSpace: "nowrap", fontFamily: "'Segoe UI', sans-serif", lineHeight: 1.6,
  }}>{label}</span>
);

// ── Cabecera izquierda ────────────────────────────────────
const LeftHeader: React.FC<{
  collapsed: boolean; onToggleCollapse: () => void; leftWidth: number;
}> = ({ collapsed, onToggleCollapse, leftWidth }) => (
  <div style={{
    display: "flex", alignItems: "center",
    height: HEADER_HEIGHT, padding: "0 4px",
    position: "sticky", left: 0, zIndex: 40,
    background: "#F3F2F1", width: leftWidth, flexShrink: 0,
    borderRight: "2px solid #D6D4D3",
  }}>
    <div style={{ width: COL.expand, flexShrink: 0 }} />
    {!collapsed && (
      <>
        <div style={{ width: COL.title, flexShrink: 0, fontWeight: 600, fontSize: 11, color: "#605E5C" }}>Título</div>
        <div style={{ width: COL.state, flexShrink: 0, fontWeight: 600, fontSize: 11, color: "#605E5C" }}>Estado</div>
        <div style={{ width: COL.role,  flexShrink: 0, fontWeight: 600, fontSize: 11, color: "#605E5C" }}>Asignado</div>
        <div style={{ width: COL.start, flexShrink: 0, fontWeight: 600, fontSize: 11, color: "#605E5C", textAlign: "center" }}>Inicio</div>
        <div style={{ width: COL.end,   flexShrink: 0, fontWeight: 600, fontSize: 11, color: "#605E5C", textAlign: "center" }}>Fin</div>
        <div style={{ width: COL.progress, flexShrink: 0, fontWeight: 600, fontSize: 11, color: "#605E5C", textAlign: "right" }}>%</div>
      </>
    )}
    {/* Botón colapsar / expandir panel */}
    <button
      title={collapsed ? "Expandir panel de datos" : "Colapsar panel de datos"}
      onClick={onToggleCollapse}
      style={{
        width: COL.action, flexShrink: 0, border: "none",
        background: "transparent", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#605E5C", borderRadius: 4, padding: 0, height: 22,
        transition: "background 150ms",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#E1DFDD"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
    </button>
  </div>
);

// ── Fila izquierda ────────────────────────────────────────
const LeftRow: React.FC<{
  row: GanttRowData; bg: string; states: State[];
  collapsed: boolean; leftWidth: number;
  onToggleExpand: (id: string) => void;
  onGoToDetail: (row: GanttRowData) => void;
}> = ({ row, bg, states, collapsed, leftWidth, onToggleExpand, onGoToDetail }) => {
  const stateName = states.find((s) => s.id === row.stateId)?.name ?? row.stateId;
  const sc  = getStateColor(row.stateId);
  const rc  = ROLE_COLORS[row.assignedToRole] ?? { bg: "#F3F2F1", text: "#605E5C" };
  const isBlocked = row.stateId === "st-blk";

  return (
    <div style={{
      display: "flex", alignItems: "center",
      height: ROW_HEIGHT, padding: "0 4px",
      position: "sticky", left: 0, zIndex: 10,
      background: bg, width: leftWidth, flexShrink: 0,
      borderRight: "2px solid #D6D4D3",
    }}>
      {/* Expand/collapse — icono moderno animado (solo Épicas con workitems) */}
      <div
        style={{
          width: COL.expand, flexShrink: 0,
          cursor: row.hasChildren ? "pointer" : "default",
          paddingLeft: row.type === "workitem" ? 8 : 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onClick={(e) => { if (row.hasChildren) { e.stopPropagation(); onToggleExpand(row.id); } }}
      >
        {row.hasChildren ? (
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            background: row.isExpanded ? "#E0D4F7" : "#EDE8F7",
            border: "1.5px solid #B89FDF",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 150ms",
            boxShadow: row.isExpanded ? "0 0 0 3px rgba(178,143,225,0.20)" : "none",
          }}>
            <ChevronDown
              size={11}
              color="#7530AF"
              style={{
                transform: row.isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>
        ) : row.type === "workitem" ? (
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C7E0F4", flexShrink: 0 }} />
        ) : null}
      </div>

      {/* Columnas visibles solo cuando no está colapsado */}
      {!collapsed && (
        <>
          {/* Título */}
          <div style={{ width: COL.title, flexShrink: 0, overflow: "hidden" }}>
            <div style={{
              fontSize: row.type === "epic" ? 13 : 11,
              fontWeight: row.type === "epic" ? 700 : 400,
              color: isBlocked ? "#A4262C" : row.type === "epic" ? "#201F1E" : "#323130",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              fontFamily: "'Segoe UI', sans-serif",
            }} title={row.title}>{row.title}</div>
            {row.type === "epic" && (
              <div style={{ fontSize: 10, color: "#8A8886", fontFamily: "'Segoe UI', sans-serif", display: "flex", gap: 6, alignItems: "center" }}>
                <span>{row.projectCode} · Épica</span>
                {row.totalWICount != null && row.totalWICount > 0 && (
                  <span style={{
                    background: row.closedCount === row.totalWICount ? "#DFF6DD" : "#F3F2F1",
                    color:      row.closedCount === row.totalWICount ? "#107C10" : "#605E5C",
                    borderRadius: 8, padding: "0px 5px", fontSize: 9, fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}>
                    Cerradas {row.closedCount}/{row.totalWICount}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Estado */}
          <div style={{ width: COL.state, flexShrink: 0 }}>
            <Chip label={stateName} bg={sc.bg} color={sc.text} />
          </div>

          {/* Asignado */}
          <div style={{ width: COL.role, flexShrink: 0 }}>
            <Chip label={row.assignedToRole === "IT AirEuropa" ? "IT" : row.assignedToRole} bg={rc.bg} color={rc.text} />
          </div>

          {/* Inicio */}
          <div style={{ width: COL.start, flexShrink: 0, fontSize: 10, color: "#605E5C",
            fontFamily: "'Segoe UI', sans-serif", textAlign: "center" }}>
            {formatDate(row.startDate)}
          </div>

          {/* Fin */}
          <div style={{ width: COL.end, flexShrink: 0, fontSize: 10, color: "#605E5C",
            fontFamily: "'Segoe UI', sans-serif", textAlign: "center" }}>
            {formatDate(row.endDate)}
          </div>

          {/* % Progreso */}
          <div style={{ width: COL.progress, flexShrink: 0, textAlign: "right", fontSize: 11,
            fontWeight: 600, color: sc.text, fontFamily: "'Segoe UI', sans-serif" }}>
            {row.progress != null ? `${row.progress}%` : "–"}
          </div>
        </>
      )}

      {/* Botón "Ir al detalle" */}
      <div style={{ width: COL.action, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button
          title="Ir al detalle"
          onClick={(e) => { e.stopPropagation(); onGoToDetail(row); }}
          style={{
            border: "none", background: "transparent", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#A19F9D", padding: 3, borderRadius: 4,
            transition: "color 150ms, background 150ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#0078D4";
            (e.currentTarget as HTMLButtonElement).style.background = "#EFF6FC";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#A19F9D";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <ExternalLink size={12} />
        </button>
      </div>
    </div>
  );
};

// ── Cabecera del timeline ─────────────────────────────────
const TimelineHeader: React.FC<{ cols: TimelineColumn[] }> = ({ cols }) => (
  <div style={{ display: "flex", height: HEADER_HEIGHT, background: "#F3F2F1" }}>
    {cols.map((col) => (
      <div
        key={col.key}
        style={{
          width: col.widthPx, flexShrink: 0,
          display: "flex", flexDirection: "column", justifyContent: "center",
          padding: "0 8px", borderLeft: "1px solid #EDEBE9",
          overflow: "hidden",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: "#323130",
          fontFamily: "'Segoe UI', sans-serif", whiteSpace: "nowrap", overflow: "hidden" }}>
          {col.label}
        </div>
        {col.sublabel && (
          <div style={{ fontSize: 9, color: "#8A8886", fontFamily: "'Segoe UI', sans-serif" }}>
            {col.sublabel}
          </div>
        )}
      </div>
    ))}
  </div>
);

// ── Barra Gantt ───────────────────────────────────────────
const GanttBar: React.FC<{
  row: GanttRowData; timelineStart: Date; zoom: ZoomLevel;
}> = ({ row, timelineStart, zoom }) => {
  const { left, width } = getBarPosition(timelineStart, row.startDate, row.endDate, zoom);
  const sc = getStateColor(row.stateId);
  const showLabel = width > 50;

  return (
    <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)",
      left, width, height: row.type === "epic" ? 22 : 14, borderRadius: row.type === "epic" ? 4 : 3,
      background: sc.bar, opacity: row.type === "workitem" ? 0.8 : 1,
      overflow: "hidden", transition: "opacity 150ms",
    }}>
      {/* Overlay de progreso */}
      {row.progress != null && row.progress > 0 && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${Math.min(row.progress, 100)}%`,
          background: sc.barProgress, borderRadius: 3,
        }} />
      )}
      {/* Etiqueta */}
      {showLabel && (
        <span style={{
          position: "relative", zIndex: 1, fontSize: 9, color: "#fff",
          padding: "0 5px", lineHeight: `${row.indent > 0 ? 14 : 20}px`,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          display: "block", fontFamily: "'Segoe UI', sans-serif", fontWeight: 600,
          textShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}>
          {row.title}
        </span>
      )}
    </div>
  );
};

// ── Líneas de cuadrícula del timeline ─────────────────────
const GridLines: React.FC<{ cols: TimelineColumn[]; rowHeight: number }> = ({ cols, rowHeight }) => (
  <>
    {cols.map((col) => (
      <div key={col.key} style={{
        position: "absolute", left: col.offsetLeft, top: 0, height: rowHeight,
        width: 1, background: "#F3F2F1", pointerEvents: "none",
      }} />
    ))}
  </>
);

// ── Skeleton de carga ─────────────────────────────────────
const SkeletonRows: React.FC = () => (
  <>
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} style={{
        height: ROW_HEIGHT, margin: "2px 0",
        background: `linear-gradient(90deg, #F3F2F1 25%, #EDEBE9 50%, #F3F2F1 75%)`,
        backgroundSize: "400% 100%", borderRadius: 4,
        animation: `shimmer 1.5s ease-in-out infinite`,
        animationDelay: `${i * 0.07}s`,
      }} />
    ))}
    <style>{`@keyframes shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}`}</style>
  </>
);

// ── GanttSplitView ────────────────────────────────────────
export const GanttSplitView: React.FC<Props> = ({
  rows, states, zoom, showToday, selectedId, onSelect, onToggleExpand, onGoToDetail,
  onToggleGroup, loading, rangeFrom, rangeTo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  // Calcular ancho del panel izquierdo dinámicamente
  const leftWidth  = leftCollapsed ? LEFT_COLLAPSED : TOTAL_LEFT;

  // Cuando rangeFrom/rangeTo están definidos los usamos como bounds exactos del timeline
  // (sin padding extra), de lo contrario recopilamos fechas de los rows con padding.
  const allDates = rows.flatMap((r) => [r.startDate, r.endDate]).filter(Boolean);
  const { start: timelineStart, totalPx, cols } = computeTimelineRange(
    allDates, zoom,
    rangeFrom || undefined,
    rangeTo   || undefined,
  );

  const timelineWidth = Math.max(totalPx, 600);
  const todayOffset  = getTodayOffset(timelineStart, zoom);
  const totalWidth   = leftWidth + timelineWidth;

  // ── Scroll para centrar la línea "Hoy" cuando showToday se activa ──
  React.useEffect(() => {
    if (!showToday || !containerRef.current || todayOffset < 0) return;
    const c = containerRef.current;
    const target = leftWidth + todayOffset - c.clientWidth / 2;
    c.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  // Solo disparar cuando cambia showToday o cuando los datos se cargan por primera vez
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToday, todayOffset]);

  // ── Función de fondo alternado ─────────────────────────
  const rowBg = (i: number, isSelected: boolean, type: GanttRowData["type"]) => {
    if (isSelected)          return "#EFF6FC";
    if (type === "group")    return "#F0EFF8";
    if (type === "workitem") return "#FAFAFA";
    return i % 2 === 0 ? "#fff" : "#F9F8F8";
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={containerRef}
        style={{
          maxHeight: "calc(100vh - 280px)", minHeight: 240,
          overflowY: "auto", overflowX: "auto",
          border: "1px solid #EDEBE9", borderRadius: 8,
          background: "#fff", position: "relative",
          fontSize: 12, fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        {/* ── Cabecera (sticky top) ── */}
        <div style={{
          position: "sticky", top: 0, zIndex: 30,
          display: "flex", minWidth: totalWidth,
          borderBottom: "2px solid #D6D4D3", background: "#F3F2F1",
        }}>
          <LeftHeader
            collapsed={leftCollapsed}
            onToggleCollapse={() => setLeftCollapsed((v) => !v)}
            leftWidth={leftWidth}
          />
          <TimelineHeader cols={cols} />
        </div>

        {/* ── Línea "Hoy" ── */}
        {showToday && todayOffset >= 0 && (
          <div style={{
            position: "absolute",
            left: leftWidth + todayOffset,
            top: HEADER_HEIGHT,
            bottom: 0,
            width: 2,
            background: "#D83B01",
            zIndex: 20,
            pointerEvents: "none",
          }}>
            <div style={{
              position: "sticky", top: HEADER_HEIGHT + 4,
              background: "#D83B01", color: "#fff",
              fontSize: 9, fontWeight: 700, padding: "1px 3px",
              borderRadius: 2, fontFamily: "'Segoe UI', sans-serif",
              whiteSpace: "nowrap", width: "max-content",
              transform: "translateX(-50%)", textAlign: "center",
            }}>Hoy</div>
          </div>
        )}

        {/* ── Filas de datos ── */}
        {loading ? (
          <div style={{ padding: "8px 12px" }}>
            <SkeletonRows />
          </div>
        ) : rows.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "60px 20px", color: "#8A8886",
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            <p style={{ margin: 0, fontWeight: 600, color: "#605E5C" }}>
              No hay ítems para los filtros aplicados.
            </p>
          </div>
        ) : (
          rows.map((row, i) => {
            // ── Fila de cabecera de grupo ──────────────────
            if (row.type === "group") {
              return (
                <div
                  key={row.id}
                  onClick={() => onToggleGroup(row.id)}
                  style={{
                    display: "flex", minWidth: totalWidth,
                    height: 28, borderBottom: "1px solid #D6D4D3",
                    background: "#F0EFF8", cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{
                    position: "sticky", left: 0, zIndex: 10,
                    width: leftWidth, flexShrink: 0,
                    display: "flex", alignItems: "center",
                    paddingLeft: 10, gap: 6,
                    background: "#E8E4F4", borderRight: "2px solid #C2A9E8",
                  }}>
                    <div style={{
                      width: 4, height: 14, borderRadius: 2,
                      background: "#7530AF", flexShrink: 0,
                    }} />
                    {/* Icono colapsar/expandir */}
                    <div style={{
                      width: 16, height: 16, display: "flex", alignItems: "center",
                      justifyContent: "center", flexShrink: 0,
                    }}>
                      {row.isCollapsed
                        ? <ChevronRight size={12} color="#7530AF" />
                        : <ChevronDown  size={12} color="#7530AF" />
                      }
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: "#5C2D91", fontFamily: "'Segoe UI', sans-serif",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{row.title}</span>
                    {row.groupCount != null && (
                      <span style={{
                        fontSize: 10, color: "#7530AF", fontFamily: "'Segoe UI', sans-serif",
                        background: "#E0D4F7", borderRadius: 8,
                        padding: "0 5px", marginRight: 6, fontWeight: 600,
                        flexShrink: 0,
                      }}>{row.groupCount}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, background: "#F0EFF8" }} />
                </div>
              );
            }

            // ── Fila normal (epic / workitem) ──────────────
            const isSelected = row.id === selectedId;
            const bg = rowBg(i, isSelected, row.type);
            return (
              <div
                key={row.id}
                onClick={() => onSelect(row)}
                style={{
                  display: "flex", minWidth: totalWidth,
                  height: ROW_HEIGHT,
                  borderBottom: "1px solid #F3F2F1",
                  background: bg, cursor: "pointer",
                  transition: "background 80ms",
                  outline: isSelected ? "2px solid #0078D4" : "none",
                  outlineOffset: -2,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#F5F5F5";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = bg;
                }}
              >
                {/* Panel izquierdo sticky */}
                <LeftRow
                  row={row} bg={bg}
                  states={states}
                  collapsed={leftCollapsed}
                  leftWidth={leftWidth}
                  onToggleExpand={onToggleExpand}
                  onGoToDetail={onGoToDetail}
                />

                {/* Panel derecho: barras */}
                <div style={{
                  position: "relative",
                  width: timelineWidth, height: ROW_HEIGHT, flexShrink: 0,
                }}>
                  <GridLines cols={cols} rowHeight={ROW_HEIGHT} />
                  {row.startDate && row.endDate && (
                    <GanttBar row={row} timelineStart={timelineStart} zoom={zoom} />
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Fila final (padding) */}
        {!loading && rows.length > 0 && (
          <div style={{ minWidth: totalWidth, height: 16, background: "#FAF9F8" }} />
        )}
      </div>

      {/* Leyenda de colores de estado */}
      <div style={{
        marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap",
        padding: "0 4px",
      }}>
        {states.map((st) => {
          const sc = getStateColor(st.id);
          return (
            <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: sc.barProgress }} />
              <span style={{ fontSize: 10, color: "#605E5C", fontFamily: "'Segoe UI', sans-serif" }}>
                {st.name}
              </span>
            </div>
          );
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 2, height: 10, background: "#D83B01" }} />
          <span style={{ fontSize: 10, color: "#605E5C", fontFamily: "'Segoe UI', sans-serif" }}>Hoy</span>
        </div>
      </div>
    </div>
  );
};
