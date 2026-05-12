// ─────────────────────────────────────────────────────────
//  src/screens/admin/AdminSettingsPage.tsx
//  Pantalla /admin/settings — Configuración del sistema
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Settings, Kanban, GitBranch, CheckSquare, BarChart2,
  ExternalLink, RotateCw, Zap, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  getAdminSettings, patchAdminSetting, patchWipLimit, patchPriorityWeights,
  type AdminSettingsPayload,
} from "../../services/adminService";
import { getStates } from "../../services/workItemService";
import type { SystemSettings, WipLimits, State, PriorityWeights } from "../../types/domain";
import { DEFAULT_WEIGHTS } from "../../lib/priorityEngine";
import {
  SettingsCard, ToggleRow, NumberFieldRow, SectionHeader,
  AdminToastContainer, PageHeader, newAdminToast, type ToastMsg,
} from "./components/shared";

// ── Estado WIP por columna ────────────────────────────────
const STATE_ACCENT: Record<string, string> = {
  "st-new":  "#797775",
  "st-ref":  "#2899F5",
  "st-prog": "#107C10",
  "st-blk":  "#D13438",
  "st-rft":  "#CA8B00",
  "st-test": "#7530AF",
  "st-acc":  "#00B294",
  "st-cls":  "#605E5C",
};

// ── WIP grid ──────────────────────────────────────────────
const WipGrid: React.FC<{
  states: State[];
  wipLimits: WipLimits;
  onChangeWip: (stateId: string, val: number) => void;
}> = ({ states, wipLimits, onChangeWip }) => (
  <div style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "12px 16px",
    marginTop: 4,
  }}>
    {states.map((st) => {
      const limit = wipLimits[st.id] ?? 0;
      const accent = STATE_ACCENT[st.id] ?? "#797775";
      return (
        <div key={st.id} style={{
          border: "1px solid #EDEBE9", borderRadius: 8,
          padding: "10px 12px", background: "#FAFAFA",
          borderTop: `3px solid ${accent}`,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#605E5C",
            fontFamily: "'Segoe UI', sans-serif",
            textTransform: "uppercase", letterSpacing: "0.05em",
            marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {st.name}
          </div>
          <WipInput limit={limit} onCommit={(v) => onChangeWip(st.id, v)} />
          <div style={{ fontSize: 10, color: "#A19F9D", marginTop: 4, fontFamily: "'Segoe UI', sans-serif" }}>
            {limit === 0 ? "Sin límite" : `Máx. ${limit} tarea${limit !== 1 ? "s" : ""}`}
          </div>
        </div>
      );
    })}
  </div>
);

const WipInput: React.FC<{ limit: number; onCommit: (v: number) => void }> = ({
  limit, onCommit,
}) => {
  const [raw, setRaw] = useState(String(limit));

  useEffect(() => { setRaw(String(limit)); }, [limit]);

  const commit = () => {
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= 0) onCommit(n);
    else setRaw(String(limit));
  };

  return (
    <input
      type="number"
      min={0}
      value={raw}
      onChange={(e) => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } }}
      placeholder="0"
      style={{
        width: "100%", boxSizing: "border-box",
        padding: "6px 8px", border: "1px solid #EDEBE9",
        borderRadius: 5, fontSize: 14, fontWeight: 700,
        color: "#201F1E", fontFamily: "'Segoe UI', sans-serif",
        textAlign: "center", outline: "none", background: "#fff",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "#0078D4")}
      onBlurCapture={(e) => (e.currentTarget.style.borderColor = "#EDEBE9")}
    />
  );
};

// ── Etiquetas legibles para cada peso ─────────────────────
const WEIGHT_LABELS: Record<keyof PriorityWeights, string> = {
  overdue:           "Tarea vencida",
  dueSoon3d:         "Vence en ≤ 3 días",
  dueSoon7d:         "Vence en ≤ 7 días",
  blocked:           "Bloqueada",
  evidenceRequired:  "Pendiente validación",
  syncError:         "Error de sync Jira",
  syncPending:       "Sync pendiente",
  highPriority:      "Prioridad Alta",
  mediumPriority:    "Prioridad Media",
  assignedToMe:      "Asignada a mí",
  waitingOnOthers:   "Esperando a terceros",
  noRecentActivity7d:"Sin actividad 7 días",
};

// ── AdminSettingsPage ─────────────────────────────────────
export const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [wipLimits, setWipLimits] = useState<WipLimits>({});
  const [states,    setStates]    = useState<State[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [toasts,    setToasts]    = useState<ToastMsg[]>([]);
  const [weights,   setWeights]   = useState<PriorityWeights>(DEFAULT_WEIGHTS);
  const [showWeightInfo, setShowWeightInfo] = useState(false);

  // Debounce refs para WIP (evitar spam de PATCH mientras el user escribe)
  const wipDebounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Toasts ──────────────────────────────────────────────
  const addToast = useCallback((text: string, ok = true) => {
    const t = newAdminToast(text, ok);
    setToasts((prev) => [...prev, t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 2800);
  }, []);

  // ── Carga inicial ───────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([getAdminSettings(), getStates()])
      .then(([payload, sts]: [AdminSettingsPayload, State[]]) => {
        setSettings(payload.settings);
        setWipLimits(payload.wipLimits);
        setStates(sts);
        if (payload.settings.priorityWeights) {
          setWeights(payload.settings.priorityWeights);
        }
      })
      .catch(() => setError("No se pudo cargar la configuración."))
      .finally(() => setLoading(false));
  }, []);

  // ── Toggle de setting ───────────────────────────────────
  const handleToggle = useCallback(async (
    key: keyof SystemSettings,
    value: boolean,
  ) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev); // optimistic
    try {
      const updated = await patchAdminSetting(key, value);
      setSettings(updated);
      addToast("Configuración guardada.");
    } catch {
      setSettings((prev) => prev ? { ...prev, [key]: !value } : prev); // rollback
      addToast("Error al guardar.", false);
    }
  }, [addToast]);

  // ── Número de setting ───────────────────────────────────
  const handleNumberSetting = useCallback(async (
    key: keyof SystemSettings,
    value: number,
  ) => {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
    try {
      const updated = await patchAdminSetting(key, value);
      setSettings(updated);
      addToast("Configuración guardada.");
    } catch {
      addToast("Error al guardar.", false);
    }
  }, [addToast]);

  // ── WIP limit (debounced) ───────────────────────────────
  const handleWipChange = useCallback((stateId: string, val: number) => {
    setWipLimits((prev) => ({ ...prev, [stateId]: val })); // optimistic
    clearTimeout(wipDebounce.current[stateId]);
    wipDebounce.current[stateId] = setTimeout(async () => {
      try {
        const updated = await patchWipLimit(stateId, val);
        setWipLimits(updated as WipLimits);
        addToast("Límite WIP guardado.");
      } catch {
        addToast("Error al guardar límite WIP.", false);
      }
    }, 600);
  }, [addToast]);

  // ── Render guards ───────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <RotateCw size={24} color="#0078D4" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !settings) return (
    <div style={{ padding: 32, color: "#A4262C", fontFamily: "'Segoe UI', sans-serif", fontSize: 13 }}>
      {error ?? "Error desconocido."}
    </div>
  );

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#FAF9F8", overflow: "hidden",
    }}>
      {/* Header */}
      <PageHeader
        title="Configuración del sistema"
        subtitle="Parámetros globales del tablero de proyectos"
        icon={<Settings size={18} />}
        actions={
          <Link
            to="/audit"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 12, color: "#0078D4", textDecoration: "none",
              padding: "6px 12px", borderRadius: 6,
              border: "1px solid #C7E0F4", background: "#EFF6FC",
              fontFamily: "'Segoe UI', sans-serif", fontWeight: 600,
            }}
          >
            <ExternalLink size={12} /> Log de auditoría
          </Link>
        }
      />

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

        {/* ── 1. WIP Limits ─────────────────────────────── */}
        <SettingsCard
          title="Kanban — Límites WIP"
          description="Número máximo de tareas simultáneas por columna. El semáforo de la columna se activa al superar el 75% del límite."
          icon={<Kanban size={16} />}
        >
          <div style={{
            fontSize: 12, color: "#605E5C", fontFamily: "'Segoe UI', sans-serif",
            marginBottom: 12,
          }}>
            Introduce <strong>0</strong> para desactivar el límite en esa columna.
          </div>
          <WipGrid
            states={states}
            wipLimits={wipLimits}
            onChangeWip={handleWipChange}
          />
        </SettingsCard>

        {/* ── 2. Reglas de transición ───────────────────── */}
        <SettingsCard
          title="Reglas de transición"
          description="Controla qué transiciones de estado están permitidas y para quién."
          icon={<GitBranch size={16} />}
        >
          <ToggleRow
            label="Validaciones estrictas"
            description="Solo permite transiciones definidas en la máquina de estados"
            checked={settings.strictValidation}
            onChange={(v) => handleToggle("strictValidation", v)}
          />
          <ToggleRow
            label="Admin puede saltar estados"
            description="Permite al Administrador mover tareas a cualquier estado sin restricciones"
            checked={settings.adminBypass}
            onChange={(v) => handleToggle("adminBypass", v)}
            badge="Admin"
          />
        </SettingsCard>

        {/* ── 3. Cierre de tareas ───────────────────────── */}
        <SettingsCard
          title="Cierre de tareas"
          description="Requisitos obligatorios al cerrar una tarea en estado EN_VALIDACIÓN."
          icon={<CheckSquare size={16} />}
        >
          <ToggleRow
            label="Comentario de cierre obligatorio"
            description="El responsable debe escribir un comentario al cerrar la tarea"
            checked={settings.closeCommentRequired}
            onChange={(v) => handleToggle("closeCommentRequired", v)}
          />
          <ToggleRow
            label="Checklist de validación obligatorio"
            description="El responsable debe marcar 'He validado criterios de aceptación' al cerrar"
            checked={settings.closeChecklistRequired}
            onChange={(v) => handleToggle("closeChecklistRequired", v)}
          />
        </SettingsCard>

        {/* ── 4. Métricas ───────────────────────────────── */}
        <SettingsCard
          title="Métricas"
          description="Parámetros para el cálculo de KPIs en el Dashboard."
          icon={<BarChart2 size={16} />}
        >
          <SectionHeader>Parámetros de cálculo</SectionHeader>
          <NumberFieldRow
            label="Días considerados 'semana'"
            description="Para el cálculo de 'Cerradas esta semana'"
            value={settings.weekDays}
            min={1}
            max={30}
            hint="Rango válido: 1–30 días"
            unit="días"
            onChange={(v) => handleNumberSetting("weekDays", v)}
          />
        </SettingsCard>

        {/* ── 5. Motor de prioridades ───────────────────── */}
        <SettingsCard
          title="Home Inteligente — Motor de Prioridades"
          description="Pesos del algoritmo determinista que ordena las tareas en la vista 'Home Inteligente'. Mayor peso = mayor relevancia."
          icon={<Zap size={16} />}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px 20px", marginBottom: 16 }}>
            {(Object.keys(DEFAULT_WEIGHTS) as Array<keyof PriorityWeights>).map((key) => (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{
                  fontSize: 11, fontWeight: 700, color: "#605E5C",
                  fontFamily: "'Segoe UI', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {WEIGHT_LABELS[key]}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={weights[key]}
                    onChange={(e) => setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                    style={{ flex: 1 }}
                  />
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: "#201F1E",
                    fontFamily: "'Segoe UI', sans-serif", minWidth: 28, textAlign: "right",
                  }}>
                    {weights[key]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                try {
                  const updated = await patchPriorityWeights(weights);
                  if (updated.priorityWeights) setWeights(updated.priorityWeights);
                  addToast("Pesos guardados.");
                } catch {
                  addToast("Error al guardar pesos.", false);
                }
              }}
              style={{
                padding: "7px 16px", borderRadius: 6, border: "none",
                background: "#7530AF", color: "#fff", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
              }}
            >
              Guardar pesos
            </button>
            <button
              onClick={() => setWeights(DEFAULT_WEIGHTS)}
              style={{
                padding: "7px 14px", borderRadius: 6,
                border: "1px solid #EDEBE9", background: "#FAFAFA",
                color: "#605E5C", cursor: "pointer", fontSize: 12, fontWeight: 600,
                fontFamily: "'Segoe UI', sans-serif",
              }}
            >
              Restaurar defecto
            </button>
            <button
              onClick={() => setShowWeightInfo((v) => !v)}
              style={{
                padding: "7px 14px", borderRadius: 6,
                border: "1px solid #EDEBE9", background: "#FAFAFA",
                color: "#0078D4", cursor: "pointer", fontSize: 12, fontWeight: 600,
                fontFamily: "'Segoe UI', sans-serif",
                display: "flex", alignItems: "center", gap: 4,
              }}
            >
              {showWeightInfo ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showWeightInfo ? "Ocultar ejemplos" : "Ver cómo afectan"}
            </button>
          </div>

          {showWeightInfo && (
            <div style={{
              marginTop: 14, padding: "12px 14px",
              background: "#F0F6FF", borderRadius: 8, border: "1px solid #DEECF9",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0078D4", marginBottom: 8 }}>
                💡 Cómo afectan los pesos al orden
              </div>
              <div style={{ fontSize: 12, color: "#323130", lineHeight: 1.6 }}>
                <p style={{ margin: "0 0 6px" }}>
                  <strong>Ejemplo A:</strong> Una tarea bloqueada (peso {weights.blocked}) asignada a ti (peso {weights.assignedToMe}) y vencida (peso {weights.overdue}) obtendría un score de <strong>{weights.blocked + weights.assignedToMe + weights.overdue}</strong>.
                </p>
                <p style={{ margin: "0 0 6px" }}>
                  <strong>Ejemplo B:</strong> Una tarea con prioridad Alta (peso {weights.highPriority}) que vence en 3 días (peso {weights.dueSoon3d}) obtendría <strong>{weights.highPriority + weights.dueSoon3d}</strong>.
                </p>
                <p style={{ margin: 0, color: "#605E5C" }}>
                  Las tareas con mayor score aparecen primero en el Home Inteligente. Aumenta el peso de los factores que más te importen.
                </p>
              </div>
            </div>
          )}
        </SettingsCard>

      </div>

      <AdminToastContainer toasts={toasts} />
    </div>
  );
};
