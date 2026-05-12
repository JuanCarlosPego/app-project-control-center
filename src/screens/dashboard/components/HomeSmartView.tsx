// ─────────────────────────────────────────────────────────
//  src/screens/dashboard/components/HomeSmartView.tsx
//  Vista "Home Inteligente Nivel 2"
//
//  Secciones:
//  1. Top 3 Recomendaciones del motor de prioridades
//  2. Lista Top 10 prioridades (score bar)
//  3. Insights del sistema (máx 5 cards)
// ─────────────────────────────────────────────────────────

import React, { useMemo } from "react";
import type { WorkItem, Project, State, PriorityWeights } from "../../../types/domain";
import {
  scoreWorkItems,
  getTopRecommendations,
  generateInsights,
  DEFAULT_WEIGHTS,
  mergeWeights,
  type ScoredItem,
  type Insight,
} from "../../../lib/priorityEngine";

// ─────────────────────────────────────────────────────────

// ── Estados de Backlog vs Kanban ──────────────────────────
const BACKLOG_STATES = new Set(["st-new", "st-ref"]);

/**
 * Construye la URL de deep-link más relevante para un ScoredItem.
 * – Si el ítem está en estado backlog → va a /backlog con ?phase + ?wi
 * – Si está en Kanban → va a /kanban con los filtros que correspondan a sus reasons
 * – Siempre incluye ?wi= para abrir el drawer directamente
 */
function buildSmartHref(item: ScoredItem, effectiveUserId: string): string {
  const wi = item.workItem;
  const isBacklog = BACKLOG_STATES.has(wi.stateId);

  if (isBacklog) {
    return `/backlog?phase=backlog&wi=${wi.id}`;
  }

  // Detectar el filtro más relevante según reasons + estado
  const isBlocked      = wi.stateId === "st-blk";
  const isOverdue      = new Date(wi.endDate).getTime() < Date.now();
  const isAssignedToMe = wi.assignedToUserId === effectiveUserId;

  const params = new URLSearchParams({ wi: wi.id });
  if (isBlocked) {
    params.set("blocked", "true");
  } else if (isOverdue) {
    params.set("overdue", "true");
  } else if (isAssignedToMe) {
    params.set("assignedToMe", "true");
  } else if (wi.stateId) {
    params.set("state", wi.stateId);
  }

  return `/kanban?${params.toString()}`;
}

interface Props {
  workItems: WorkItem[];
  projects: Project[];
  states: State[];
  effectiveUserId: string;
  weights?: PriorityWeights;
  onNavigate: (href: string) => void;
}

// ── Mapa de colores por stateId ───────────────────────────
const STATE_COLOR: Record<string, string> = {
  "st-new":  "#605E5C",
  "st-ref":  "#0078D4",
  "st-prog": "#C17D00",
  "st-blk":  "#D13438",
  "st-rft":  "#8764B8",
  "st-test": "#038387",
  "st-acc":  "#2B88D8",
  "st-cls":  "#107C10",
};

// ── Score bar ─────────────────────────────────────────────
function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min(100, max > 0 ? Math.round((score / max) * 100) : 0);
  const color = pct >= 70 ? "#D13438" : pct >= 40 ? "#C17D00" : "#0078D4";
  return (
    <div
      style={{
        height: 6,
        borderRadius: 3,
        background: "#EDEBE9",
        overflow: "hidden",
        minWidth: 80,
        flex: 1,
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 3,
          transition: "width 0.4s",
        }}
      />
    </div>
  );
}

// ── Chip de razón ─────────────────────────────────────────
function ReasonChip({ label }: { label: string }) {
  const isUrgent =
    label.startsWith("Vencida") ||
    label.startsWith("Bloqueada") ||
    label.includes("Sync error");
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 20,
        background: isUrgent ? "#FDE7E9" : "#EFF6FC",
        color: isUrgent ? "#D13438" : "#0078D4",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────
function safeDate(dateStr: string | undefined): string {
  if (!dateStr) return "Sin fecha";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "Sin fecha" : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function getScoreLabel(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "CRÍTICO", color: "#D13438" };
  if (score >= 40) return { label: "URGENTE", color: "#C17D00" };
  return { label: "NORMAL", color: "#0078D4" };
}

function getCtaLabel(item: ScoredItem): string {
  const stateId = item.workItem.stateId;
  if (stateId === "st-blk") return "Resolver ahora";
  if (stateId === "st-acc") return "Validar";
  return "Ver en Kanban";
}

// ── Card de Top recomendación ─────────────────────────────
function TopCard({
  item,
  rank,
  stateMap,
  effectiveUserId,
  onNavigate,
}: {
  item: ScoredItem;
  rank: number;
  stateMap: Record<string, string>;
  effectiveUserId: string;
  onNavigate: (href: string) => void;
}) {
  const wi = item.workItem;
  const stateName = stateMap[wi.stateId] ?? wi.stateId;
  const stateColor = STATE_COLOR[wi.stateId] ?? "#605E5C";

  const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const href = buildSmartHref(item, effectiveUserId);
  const { label: scoreLabel, color: scoreLabelColor } = getScoreLabel(item.score);
  const ctaLabel = getCtaLabel(item);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 220,
        background: "#FFFFFF",
        border: `1.5px solid ${stateColor}33`,
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>{rankEmoji}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 12,
            background: `${stateColor}18`,
            color: stateColor,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {stateName}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: scoreLabelColor, textTransform: "uppercase" }}>
            {scoreLabel}
          </span>
          <span style={{ fontSize: 10, color: "#A19F9D" }}>{item.score}</span>
        </span>
      </div>

      {/* Título */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#201F1E",
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {wi.title}
      </div>

      {/* Proyecto */}
      {item.project && (
        <div style={{ fontSize: 11, color: "#605E5C" }}>{item.project.name}</div>
      )}

      {/* Razones */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {item.reasons.slice(0, 3).map((r) => (
          <ReasonChip key={r} label={r} />
        ))}
      </div>

      {/* Fecha límite */}
      <div style={{ fontSize: 11, color: "#605E5C" }}>
        Fecha límite: <strong>{safeDate(wi.endDate)}</strong>
      </div>

      {/* CTA */}
      <button
        onClick={() => onNavigate(href)}
        style={{
          marginTop: "auto",
          background: stateColor,
          color: "#FFFFFF",
          border: "none",
          borderRadius: 6,
          padding: "6px 12px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        {ctaLabel} →
      </button>
    </div>
  );
}

// ── Fila de prioridad (Top 10) ────────────────────────────
function PriorityRow({
  item,
  rank,
  maxScore,
  stateMap,
  effectiveUserId,
  onNavigate,
}: {
  item: ScoredItem;
  rank: number;
  maxScore: number;
  stateMap: Record<string, string>;
  effectiveUserId: string;
  onNavigate: (href: string) => void;
}) {
  const wi = item.workItem;
  const stateColor = STATE_COLOR[wi.stateId] ?? "#605E5C";

  return (
    <div
      onClick={() => onNavigate(buildSmartHref(item, effectiveUserId))}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 8,
        cursor: "pointer",
        background: "#FAFAFA",
        border: "1px solid #EDEBE9",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "#F0F6FF";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "#FAFAFA";
      }}
    >
      {/* Rank */}
      <span style={{ fontSize: 11, color: "#605E5C", minWidth: 18, textAlign: "right" }}>
        #{rank}
      </span>

      {/* Estado dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: stateColor,
          flexShrink: 0,
        }}
      />

      {/* Título */}
      <span
        style={{
          fontSize: 12,
          color: "#201F1E",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {wi.title}
      </span>

      {/* Razones (max 2) */}
      <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
        {item.reasons.slice(0, 2).map((r) => (
          <ReasonChip key={r} label={r} />
        ))}
      </div>

      {/* Score bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 100 }}>
        <ScoreBar score={item.score} max={maxScore} />
        <span style={{ fontSize: 10, color: "#605E5C", minWidth: 24, textAlign: "right" }}>
          {item.score}
        </span>
      </div>
    </div>
  );
}

// ── Card de Insight ───────────────────────────────────────
function InsightCard({
  insight,
  onNavigate,
}: {
  insight: Insight;
  onNavigate: (href: string) => void;
}) {
  const urgencyStyle: Record<string, { bg: string; border: string; dot: string }> = {
    high:   { bg: "#FFF4F4", border: "#FDE7E9", dot: "#D13438" },
    medium: { bg: "#FFFBF0", border: "#FFF4CE", dot: "#C17D00" },
    low:    { bg: "#F0F6FF", border: "#DEECF9", dot: "#0078D4" },
  };
  const s = urgencyStyle[insight.urgency];

  return (
    <div
      style={{
        flex: 1,
        minWidth: 200,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderLeft: `3px solid ${s.dot}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>{insight.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#201F1E" }}>{insight.title}</span>
      </div>
      <div style={{ fontSize: 11, color: "#605E5C", lineHeight: 1.4 }}>{insight.body}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <button
          onClick={() => onNavigate(insight.href)}
          style={{ fontSize: 11, fontWeight: 600, color: s.dot, background: "none", border: `1px solid ${s.dot}`, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "'Segoe UI', sans-serif" }}
        >Ver</button>
        <button
          onClick={() => onNavigate(insight.href)}
          style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: s.dot, border: "none", borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: "'Segoe UI', sans-serif" }}
        >Actuar</button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────
export function HomeSmartView({
  workItems,
  projects,
  states,
  effectiveUserId,
  weights,
  onNavigate,
}: Props) {
  const resolvedWeights = useMemo(() => mergeWeights(weights), [weights]);
  const stateMap = useMemo(
    () => Object.fromEntries(states.map((s) => [s.id, s.name])),
    [states],
  );

  const scored = useMemo(
    () => scoreWorkItems(workItems, projects, effectiveUserId, resolvedWeights),
    [workItems, projects, effectiveUserId, resolvedWeights],
  );

  const top3 = useMemo(() => getTopRecommendations(scored, 3), [scored]);
  const top10 = useMemo(() => scored.slice(0, 5), [scored]);
  const insights = useMemo(
    () => generateInsights(workItems, effectiveUserId),
    [workItems, effectiveUserId],
  );

  const maxScore = scored[0]?.score ?? 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Sección 1: Top 3 ───────────────────────────── */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 16 }}>🎯</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#201F1E" }}>
            Hoy te recomendamos
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              background: "#EFF6FC",
              color: "#0078D4",
              padding: "2px 8px",
              borderRadius: 20,
            }}
          >
            Motor IA determinista
          </span>
        </div>

        {top3.length === 0 ? (
          <div
            style={{
              background: "#F3F2F1",
              borderRadius: 8,
              padding: "16px",
              color: "#605E5C",
              fontSize: 13,
            }}
          >
            ✅ Sin tareas prioritarias en este momento.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {top3.map((item, i) => (
              <TopCard
                key={item.workItem.id}
                item={item}
                rank={i + 1}
                stateMap={stateMap}
                effectiveUserId={effectiveUserId}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Sección 2: Top 10 prioridades ─────────────── */}
      {top10.length > 0 && (
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>📋</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#201F1E" }}>
                Prioridades de hoy (Top 5)
              </span>
            </div>
            <button
              onClick={() => onNavigate("/kanban?assignedToMe=true")}
              style={{
                background: "transparent",
                border: "none",
                color: "#0078D4",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Ver todas →
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {top10.map((item, i) => (
              <PriorityRow
                key={item.workItem.id}
                item={item}
                rank={i + 1}
                maxScore={maxScore}
                stateMap={stateMap}
                effectiveUserId={effectiveUserId}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Sección 3: Insights ────────────────────────── */}
      {insights.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 14 }}>💡</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#201F1E" }}>
              Insights del sistema
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {insights.map((ins) => (
              <InsightCard key={ins.id} insight={ins} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
