// ─────────────────────────────────────────────────────────
//  src/screens/requests/components/ConvertToWorkItemModal.tsx
//  Modal IT/Admin: convierte una Solicitud aprobada en WorkItem.
// ─────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, X, ArrowRightCircle } from "lucide-react";
import type { Project, Request, WorkItemType, Priority, Team } from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";
import {
  convertRequest,
  REQUEST_TYPE_LABELS,
} from "../../../services/requestService";

interface Props {
  request:      Request;
  allProjects:  Project[];
  selectedYear: number;
  appUsers:     AppUser[];
  teams:        Team[];
  onConverted:  () => void;
  onClose:      () => void;
}

const WI_TYPES: WorkItemType[] = ["Feature", "Bug", "TechDebt", "Spike"];
const PRIORITIES: Priority[] = ["Alta", "Media", "Baja"];

// Mapa RequestType → WorkItemType sugerido
const TYPE_MAP: Record<string, WorkItemType> = {
  Bug:             "Bug",
  Feature:        "Feature",
  Mejora:          "Feature",
  Incidencia:      "Bug",
  Consulta:        "Spike",
  CambioNormativo: "TechDebt",
  Impedimento:     "Bug",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #C8C6C4",
  borderRadius: 5,
  fontSize: 13,
  fontFamily: "'Segoe UI', sans-serif",
  color: "#201F1E",
  background: "#fff",
  boxSizing: "border-box" as React.CSSProperties["boxSizing"],
};

const LBL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: "#605E5C",
  fontFamily: "'Segoe UI', sans-serif",
};

export const ConvertToWorkItemModal: React.FC<Props> = ({
  request, allProjects, selectedYear, appUsers, teams, onConverted, onClose,
}) => {
  // Proyectos del año seleccionado
  const projects = useMemo(
    () => allProjects.filter(p => p.startDate.startsWith(String(selectedYear))),
    [allProjects, selectedYear],
  );

  const [projectId,    setProjectId]    = useState(request.relatedProjectId ?? "");
  const [title,        setTitle]        = useState(request.title);
  const [wiType,       setWiType]       = useState<WorkItemType>(TYPE_MAP[request.type] ?? "Feature");
  const [priority,     setPriority]     = useState<Priority>(request.priority);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignTeamId, setAssignTeamId] = useState<string>("");
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [consulta,     setConsulta]     = useState(request.type === "Consulta");

  const itUsers = appUsers.filter(u => u.isActive && (u.role === "IT AirEuropa" || u.role === "Admin"));
  const itTeams = teams.filter(t => t.type === "Internal" && t.isActive);

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) { setError("Selecciona el proyecto destino."); return; }

    setSaving(true);
    setError(null);
    try {
      await convertRequest(request.id, {
        projectId,
        title,
        type:             wiType,
        priority,
        assignedToUserId: assignUserId || undefined,
        assignedToTeamId: assignTeamId || null,
      });
      onConverted();
    } catch {
      setError("Error al convertir la solicitud. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1001,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 10,
        width: 540,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "90vh",
        overflow: "auto",
        boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        fontFamily: "'Segoe UI', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "1px solid #EDEBE9",
          background: "#F3F9FF",
          borderRadius: "10px 10px 0 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ArrowRightCircle size={18} color="#0078D4" />
            <div>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#201F1E" }}>
                Convertir en tarea
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8A8886" }}>
                Tipo de solicitud: <strong>{REQUEST_TYPE_LABELS[request.type]}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "#605E5C", padding: 4, borderRadius: 4,
              display: "flex", alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Resumen de la solicitud */}
        <div style={{
          margin: "16px 20px 0",
          padding: "10px 14px",
          background: "#FAF9F8",
          border: "1px solid #EDEBE9",
          borderRadius: 6,
          fontSize: 12,
          color: "#605E5C",
        }}>
          <div style={{ fontWeight: 600, color: "#201F1E", marginBottom: 4 }}>
            {request.title}
          </div>
          <div style={{ lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {request.description || "Sin descripción."}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleConvert} style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Aviso Consulta */}
          {consulta && (
            <div style={{
              padding: "10px 14px",
              background: "#FFF4CE", border: "1px solid #F4D160", borderRadius: 6,
              fontSize: 12, color: "#856404",
              display: "flex", gap: 8, alignItems: "flex-start",
            }}>
              <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <strong>Las consultas no generan tareas directamente.</strong>{" "}
                Si necesitas crear una tarea, selecciona el tipo más adecuado a continuación.{" "}
                <button
                  type="button"
                  onClick={() => setConsulta(false)}
                  style={{ background: "none", border: "none", color: "#856404", textDecoration: "underline", cursor: "pointer", fontSize: 12, padding: 0 }}
                >
                  Continuar de todas formas
                </button>
              </div>
            </div>
          )}

          {!consulta && error && (
            <div style={{
              padding: "8px 12px", background: "#FDE7E9", border: "1px solid #F1BCBE",
              borderRadius: 5, color: "#A80000", fontSize: 12,
              display: "flex", gap: 6, alignItems: "center",
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          {/* Proyecto destino */}
          <label style={LBL}>
            Proyecto destino *
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}
              required
            >
              <option value="">Selecciona proyecto…</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>

          {/* Título de la tarea */}
          <label style={LBL}>
            Título de la tarea
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={INPUT}
            />
          </label>

          {/* Tipo WI + Prioridad */}
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ ...LBL, flex: 1 }}>
              Tipo de tarea
              <select
                value={wiType}
                onChange={e => setWiType(e.target.value as WorkItemType)}
                style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}
              >
                {WI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ ...LBL, flex: 1 }}>
              Prioridad
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>

          {/* Asignación */}
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ ...LBL, flex: 1 }}>
              Asignar a (usuario)
              <select
                value={assignUserId}
                onChange={e => setAssignUserId(e.target.value)}
                style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}
              >
                <option value="">Sin asignar</option>
                {itUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.displayName}</option>
                ))}
              </select>
            </label>
            <label style={{ ...LBL, flex: 1 }}>
              Equipo IT
              <select
                value={assignTeamId}
                onChange={e => setAssignTeamId(e.target.value)}
                style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}
              >
                <option value="">Sin equipo</option>
                {itTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Botones */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 18px", border: "1px solid #EDEBE9", borderRadius: 5,
                background: "#fff", color: "#201F1E", cursor: "pointer",
                fontSize: 13, fontFamily: "'Segoe UI', sans-serif",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || consulta}
              style={{
                padding: "8px 20px", border: "none", borderRadius: 5,
                background: (saving || consulta) ? "#A19F9D" : "#0078D4", color: "#fff",
                cursor: (saving || consulta) ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <ArrowRightCircle size={13} />
              {saving ? "Convirtiendo…" : "Crear tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
