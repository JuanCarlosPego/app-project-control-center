import React, { useState, useMemo } from "react";
import { CURRENT_USER, USERS, INITIATIVES, KanbanStatus, Area } from "../data/mockData";

// ── Column config ──────────────────────────────────────────────────────────
const COLUMNS: { id: KanbanStatus; label: string; accent: string }[] = [
  { id: "ToDo",      label: "To Do",       accent: "#797775" },
  { id: "Doing",     label: "En Progreso", accent: "#0078D4" },
  { id: "ReadyTest", label: "Ready Test",  accent: "#8764B8" },
  { id: "Blocked",   label: "Bloqueado",   accent: "#D13438" },
  { id: "Done",      label: "Completado",  accent: "#107C10" },
];

const STATUS_BG: Record<KanbanStatus, string> = {
  ToDo: "#F3F2F1", Doing: "#EFF6FC", ReadyTest: "#F4F0FF", Blocked: "#FDE7E9", Done: "#DFF6DD",
};

// ── Flat task with initiative info ─────────────────────────────────────────
interface FlatTask { taskId: string; title: string; initiative: string; area: Area; assignedTo: string; status: KanbanStatus; }

// ── KanbanScreen ───────────────────────────────────────────────────────────
export const KanbanScreen: React.FC = () => {
  const allowedAreas = CURRENT_USER.areas as Area[];

  // Build flat task list
  const initialTasks: FlatTask[] = useMemo(() =>
    INITIATIVES
      .filter(i => allowedAreas.includes(i.area))
      .flatMap(i => i.tasks.map(t => ({
        taskId: t.id, title: t.title, initiative: i.title, area: i.area,
        assignedTo: t.assignedTo, status: t.status,
      }))),
    []
  );

  const [tasks, setTasks] = useState<FlatTask[]>(initialTasks);
  const [areaFilter, setAreaFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const visible = useMemo(() =>
    tasks
      .filter(t => areaFilter === "all" || t.area === areaFilter)
      .filter(t => userFilter === "all" || t.assignedTo === userFilter),
    [tasks, areaFilter, userFilter]
  );

  const moveTask = (taskId: string, newStatus: KanbanStatus) =>
    setTasks(prev => prev.map(t => t.taskId === taskId ? { ...t, status: newStatus } : t));

  const userName = (uid: string) => USERS.find(u => u.id === uid)?.name ?? uid;

  const colTasks = (colId: KanbanStatus) => visible.filter(t => t.status === colId);

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: "20px 24px", background: "#FAF9F8", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#201F1E", margin: 0 }}>Kanban Board</h1>
        <p style={{ fontSize: 13, color: "#605E5C", marginTop: 4 }}>
          {CURRENT_USER.name} · {CURRENT_USER.areas.join(", ")} &nbsp;·&nbsp; {visible.length} tareas visibles
        </p>
      </div>
      <div style={{ height: 1, background: "#E1DFDD", marginBottom: 16 }} />

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <FilterSelect
          label="Área"
          value={areaFilter}
          onChange={setAreaFilter}
          options={[{ value: "all", label: "Todas" }, ...allowedAreas.map(a => ({ value: a, label: a }))]}
        />
        <FilterSelect
          label="Usuario"
          value={userFilter}
          onChange={setUserFilter}
          options={[{ value: "all", label: "Todos" }, ...USERS.map(u => ({ value: u.id, label: u.name }))]}
        />
      </div>

      {/* Board */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", alignItems: "flex-start", paddingBottom: 16 }}>
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            col={col}
            tasks={colTasks(col.id)}
            userName={userName}
            onMove={moveTask}
          />
        ))}
      </div>
    </div>
  );
};

// ── FilterSelect ───────────────────────────────────────────────────────────
const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <label style={{ fontSize: 12, color: "#605E5C", display: "flex", flexDirection: "column", gap: 4 }}>
    {label}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ padding: "6px 10px", border: "1px solid #C8C6C4", borderRadius: 4, fontSize: 13, background: "#fff", color: "#201F1E", minWidth: 150, cursor: "pointer" }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
);

// ── KanbanColumn ───────────────────────────────────────────────────────────
const KanbanColumn: React.FC<{
  col: { id: KanbanStatus; label: string; accent: string };
  tasks: FlatTask[];
  userName: (uid: string) => string;
  onMove: (taskId: string, status: KanbanStatus) => void;
}> = ({ col, tasks, userName, onMove }) => (
  <div style={{ minWidth: 210, maxWidth: 230, flex: "0 0 210px" }}>
    {/* Column header */}
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ width: 3, height: 18, borderRadius: 2, background: col.accent }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "#201F1E" }}>{col.label}</span>
      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, background: "#F3F2F1", color: "#605E5C", borderRadius: 10, padding: "1px 8px" }}>
        {tasks.length}
      </span>
    </div>

    {/* Cards */}
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {tasks.length === 0 ? (
        <div style={{ border: "1px dashed #C8C6C4", borderRadius: 6, padding: "20px 12px", textAlign: "center", fontSize: 12, color: "#A19F9D" }}>
          Sin tareas
        </div>
      ) : (
        tasks.map(t => (
          <TaskCard key={t.taskId} task={t} accent={col.accent} userName={userName} onMove={onMove} />
        ))
      )}
    </div>
  </div>
);

// ── TaskCard ───────────────────────────────────────────────────────────────
const TaskCard: React.FC<{
  task: FlatTask;
  accent: string;
  userName: (uid: string) => string;
  onMove: (taskId: string, status: KanbanStatus) => void;
}> = ({ task, accent, userName, onMove }) => (
  <div style={{ background: "#fff", border: "1px solid #E1DFDD", borderRadius: 6, padding: "10px 12px", boxShadow: "0 1px 3px rgba(0,0,0,.05)", borderLeft: `3px solid ${accent}` }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#201F1E", marginBottom: 6, lineHeight: 1.4 }}>
      {task.title}
    </div>
    <div style={{ fontSize: 11, color: "#8A8886", marginBottom: 8 }}>
      {task.initiative}
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
      <span style={{ fontSize: 11, background: "#F3F2F1", color: "#605E5C", borderRadius: 10, padding: "2px 7px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>
        {userName(task.assignedTo)}
      </span>
      <select
        value={task.status}
        onChange={e => onMove(task.taskId, e.target.value as KanbanStatus)}
        style={{ fontSize: 11, border: "1px solid #C8C6C4", borderRadius: 4, padding: "2px 4px", background: STATUS_BG[task.status], color: "#201F1E", cursor: "pointer", maxWidth: 100 }}
      >
        {COLUMNS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </div>
  </div>
);
