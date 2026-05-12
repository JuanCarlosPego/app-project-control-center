import React, { useState, useMemo } from "react";
import { CURRENT_USER, USERS, INITIATIVES, Area, KanbanStatus, InitiativeStatus } from "../data/mockData";

// ── Token-based styles ─────────────────────────────────────────────────────
const TASK_COLOR: Record<KanbanStatus, { bg: string; fg: string }> = {
  ToDo:      { bg: "#F3F2F1", fg: "#797775" },
  Doing:     { bg: "#EFF6FC", fg: "#0078D4" },
  ReadyTest: { bg: "#F4F0FF", fg: "#8764B8" },
  Blocked:   { bg: "#FDE7E9", fg: "#D13438" },
  Done:      { bg: "#DFF6DD", fg: "#107C10" },
};

const INIT_COLOR: Record<InitiativeStatus, { bg: string; fg: string }> = {
  "Pendiente":   { bg: "#F3F2F1", fg: "#797775" },
  "En Progreso": { bg: "#EFF6FC", fg: "#0078D4" },
  "Completado":  { bg: "#DFF6DD", fg: "#107C10" },
};

const S = {
  page:       { fontFamily: "'Segoe UI', sans-serif", padding: "24px 28px", background: "#FAF9F8", minHeight: "100vh" } as React.CSSProperties,
  header:     { marginBottom: 20 } as React.CSSProperties,
  title:      { fontSize: 22, fontWeight: 700, color: "#201F1E", margin: 0 } as React.CSSProperties,
  subtitle:   { fontSize: 13, color: "#605E5C", marginTop: 4 } as React.CSSProperties,
  filterBar:  { display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" } as React.CSSProperties,
  select:     { padding: "6px 10px", border: "1px solid #C8C6C4", borderRadius: 4, fontSize: 13, background: "#fff", color: "#201F1E", minWidth: 160, cursor: "pointer" } as React.CSSProperties,
  label:      { fontSize: 12, color: "#605E5C", display: "flex", flexDirection: "column", gap: 4 } as React.CSSProperties,
  card:       { background: "#fff", border: "1px solid #E1DFDD", borderRadius: 6, marginBottom: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.06)" } as React.CSSProperties,
  cardHead:   { display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", cursor: "pointer", userSelect: "none" } as React.CSSProperties,
  initTitle:  { fontSize: 14, fontWeight: 600, color: "#201F1E", flex: 1 } as React.CSSProperties,
  taskRow:    { display: "flex", alignItems: "center", gap: 10, padding: "9px 16px 9px 40px", borderTop: "1px solid #F3F2F1" } as React.CSSProperties,
  taskTitle:  { fontSize: 13, color: "#323130", flex: 1 } as React.CSSProperties,
  taskMeta:   { fontSize: 12, color: "#797775" } as React.CSSProperties,
  empty:      { textAlign: "center", padding: 48, color: "#797775", fontSize: 14 } as React.CSSProperties,
  divider:    { height: 1, background: "#E1DFDD", margin: "4px 0 16px" } as React.CSSProperties,
};

// ── Small helpers ──────────────────────────────────────────────────────────
const Badge: React.FC<{ label: string; color: string; bg: string }> = ({ label, color, bg }) => (
  <span style={{ background: bg, color, fontSize: 11, fontWeight: 600, borderRadius: 12, padding: "2px 9px", whiteSpace: "nowrap" }}>
    {label}
  </span>
);

const AreaPill: React.FC<{ area: string }> = ({ area }) => (
  <span style={{ background: "#EFF6FC", color: "#0078D4", fontSize: 11, fontWeight: 600, borderRadius: 4, padding: "2px 7px" }}>
    {area}
  </span>
);

const Chevron: React.FC<{ open: boolean }> = ({ open }) => (
  <svg width="10" height="10" viewBox="0 0 10 10" style={{ transition: "transform .18s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>
    <path d="M3 1l4 4-4 4" stroke="#605E5C" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Backlog Screen ─────────────────────────────────────────────────────────
export const BacklogScreen: React.FC = () => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["i1"]));
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const allowedAreas = CURRENT_USER.areas as Area[];

  const visible = useMemo(() =>
    INITIATIVES
      .filter(i => allowedAreas.includes(i.area))
      .filter(i => areaFilter === "all" || i.area === areaFilter)
      .filter(i => userFilter === "all" || i.tasks.some(t => t.assignedTo === userFilter)),
    [areaFilter, userFilter]
  );

  const toggle = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const userName = (uid: string) => USERS.find(u => u.id === uid)?.name ?? uid;

  const totalTasks = visible.reduce((sum, i) => sum + i.tasks.length, 0);

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <h1 style={S.title}>Backlog de Iniciativas</h1>
        <p style={S.subtitle}>
          {CURRENT_USER.name} · {CURRENT_USER.areas.join(", ")} &nbsp;·&nbsp;
          <strong>{visible.length}</strong> iniciativas · <strong>{totalTasks}</strong> tareas
        </p>
      </div>
      <div style={S.divider} />

      {/* Filters */}
      <div style={S.filterBar}>
        <label style={S.label}>
          <span>Área</span>
          <select style={S.select} value={areaFilter} onChange={e => setAreaFilter(e.target.value)}>
            <option value="all">Todas las áreas</option>
            {allowedAreas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label style={S.label}>
          <span>Usuario</span>
          <select style={S.select} value={userFilter} onChange={e => setUserFilter(e.target.value)}>
            <option value="all">Todos los usuarios</option>
            {USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div style={S.empty}>No hay iniciativas para los filtros seleccionados.</div>
      ) : (
        visible.map(ini => {
          const open  = expanded.has(ini.id);
          const tasks = userFilter === "all" ? ini.tasks : ini.tasks.filter(t => t.assignedTo === userFilter);
          const { bg, fg } = INIT_COLOR[ini.status];

          return (
            <div key={ini.id} style={S.card}>

              {/* Initiative row */}
              <div style={S.cardHead} onClick={() => toggle(ini.id)}>
                <Chevron open={open} />
                <span style={S.initTitle}>{ini.title}</span>
                <AreaPill area={ini.area} />
                <Badge label={ini.status} color={fg} bg={bg} />
                <span style={{ fontSize: 12, color: "#797775", marginLeft: 4 }}>
                  {ini.tasks.length} {ini.tasks.length === 1 ? "tarea" : "tareas"}
                </span>
              </div>

              {/* Task rows */}
              {open && tasks.map(task => {
                const tc = TASK_COLOR[task.status];
                return (
                  <div key={task.id} style={S.taskRow}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: tc.fg, flexShrink: 0, display: "inline-block" }} />
                    <span style={S.taskTitle}>{task.title}</span>
                    <span style={S.taskMeta}>{userName(task.assignedTo)}</span>
                    <Badge label={task.status} color={tc.fg} bg={tc.bg} />
                  </div>
                );
              })}

            </div>
          );
        })
      )}
    </div>
  );
};
