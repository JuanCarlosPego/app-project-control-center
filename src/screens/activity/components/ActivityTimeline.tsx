// ─────────────────────────────────────────────────────────
//  src/screens/activity/components/ActivityTimeline.tsx
//  Lista cronológica agrupada por día.
// ─────────────────────────────────────────────────────────

import React from "react";
import { color, font, radius, spacing } from "../../../components/ui/tokens";
import { ActivityEventCard, type ActivityEventCardProps } from "./ActivityEventCard";
import type { ActivityLogEntry } from "../../../types/domain";

// ── Helpers de agrupación ─────────────────────────────────
function dayKey(iso: string): string {
  return iso.slice(0, 10); // "YYYY-MM-DD"
}

// Etiqueta legible del grupo de fecha
function dayLabel(dateKey: string): string {
  const TODAY     = "2026-05-10"; // fecha ficticia del sistema
  const YESTERDAY = "2026-05-09";

  if (dateKey === TODAY)     return "Hoy";
  if (dateKey === YESTERDAY) return "Ayer";

  const [y, m, d] = dateKey.split("-");
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// ── Tipos ─────────────────────────────────────────────────
type BaseProps = Omit<ActivityEventCardProps, "log">;

interface ActivityTimelineProps extends BaseProps {
  logs:       ActivityLogEntry[];
  groupByDay?: boolean;
}

// ── ActivityTimeline ──────────────────────────────────────
export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  logs,
  groupByDay = true,
  workItems,
  projects,
  appUsers,
  onOpenWorkItem,
  onOpenProject,
}) => {
  if (!groupByDay) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
        {logs.map((log) => (
          <ActivityEventCard
            key={log.id}
            log={log}
            workItems={workItems}
            projects={projects}
            appUsers={appUsers}
            onOpenWorkItem={onOpenWorkItem}
            onOpenProject={onOpenProject}
          />
        ))}
      </div>
    );
  }

  // Agrupar por día
  const groups = new Map<string, ActivityLogEntry[]>();
  for (const log of logs) {
    const k = dayKey(log.at);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(log);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[7] }}>
      {Array.from(groups.entries()).map(([dateKey, dayLogs]) => (
        <DayGroup
          key={dateKey}
          dateKey={dateKey}
          logs={dayLogs}
          workItems={workItems}
          projects={projects}
          appUsers={appUsers}
          onOpenWorkItem={onOpenWorkItem}
          onOpenProject={onOpenProject}
        />
      ))}
    </div>
  );
};

// ── DayGroup ──────────────────────────────────────────────
interface DayGroupProps extends BaseProps {
  dateKey: string;
  logs:    ActivityLogEntry[];
}

const DayGroup: React.FC<DayGroupProps> = ({
  dateKey, logs, workItems, projects, appUsers, onOpenWorkItem, onOpenProject,
}) => {
  const label = dayLabel(dateKey);
  const isToday = dateKey === "2026-05-10";

  return (
    <div>
      {/* Cabecera del grupo */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[4],
        marginBottom: spacing[4],
        position: "sticky",
        top: 0,
        zIndex: 5,
        background: "#FAF9F8",
        padding: `${spacing[2]}px 0`,
      }}>
        {/* Línea */}
        <div style={{ flex: 1, height: 1, background: color.border }} />

        {/* Badge de fecha */}
        <span style={{
          padding: `${spacing[2]}px ${spacing[5]}px`,
          borderRadius: radius.full,
          border: `1px solid ${isToday ? color.primary : color.border}`,
          background: isToday ? color.primaryBg : color.surface,
          color: isToday ? color.primary : color.textSecondary,
          fontSize: font.size.sm,
          fontWeight: isToday ? font.weight.semibold : font.weight.medium,
          fontFamily: font.family,
          whiteSpace: "nowrap",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          textTransform: "capitalize" as const,
        }}>
          {label}
        </span>

        {/* Contador */}
        <span style={{
          fontSize: font.size.xs, color: color.textMuted,
          fontFamily: font.family, whiteSpace: "nowrap",
        }}>
          {logs.length} {logs.length === 1 ? "evento" : "eventos"}
        </span>

        {/* Línea */}
        <div style={{ flex: 1, height: 1, background: color.border }} />
      </div>

      {/* Eventos */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[3],
        // Línea vertical de timeline
        paddingLeft: spacing[5],
        borderLeft: `2px solid ${color.borderSubtle}`,
        marginLeft: 16,
      }}>
        {logs.map((log) => (
          <ActivityEventCard
            key={log.id}
            log={log}
            workItems={workItems}
            projects={projects}
            appUsers={appUsers}
            onOpenWorkItem={onOpenWorkItem}
            onOpenProject={onOpenProject}
          />
        ))}
      </div>
    </div>
  );
};
