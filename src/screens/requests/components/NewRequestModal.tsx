// ─────────────────────────────────────────────────────────
//  src/screens/requests/components/NewRequestModal.tsx
//  Modal para crear nueva solicitud.
//
//  RBAC:
//  - Usuario   → solo equipos tipo "Area"   dentro de sus teamIds
//  - Proveedor → solo equipos tipo "Provider" dentro de sus teamIds
//  - IT/Admin  → cualquier equipo activo
//
//  Equipo: OBLIGATORIO (sin "Sin equipo específico")
//  Proyecto: OPCIONAL, filtrado por selectedYear + coherencia con equipo
// ─────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import type { Project, RequestType, Priority, Team } from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";
import {
  REQUEST_TYPE_OPTIONS,
  REQUEST_TYPE_LABELS,
  createRequest,
  type CreateRequestPayload,
} from "../../../services/requestService";

interface Props {
  currentUser:   AppUser;
  teams:         Team[];
  allProjects:   Project[];
  selectedYear:  number;
  onCreated:     () => void;
  onClose:       () => void;
}

const PRIORITIES: Priority[] = ["Alta", "Media", "Baja"];

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

const REQ_MARK: React.CSSProperties = { color: "#D13438", marginLeft: 2 };

export const NewRequestModal: React.FC<Props> = ({
  currentUser, teams, allProjects, selectedYear, onCreated, onClose,
}) => {
  const [title,     setTitle]     = useState("");
  const [desc,      setDesc]      = useState("");
  const [type,      setType]      = useState<RequestType>("Mejora");
  const [priority,  setPriority]  = useState<Priority>("Media");
  const [teamId,    setTeamId]    = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const role = currentUser.role;

  // ── Equipos disponibles según rol ─────────────────────
  const myTeams = useMemo(() => {
    if (role === "Admin" || role === "IT AirEuropa") {
      return teams.filter(t => t.isActive);
    }
    const myIds = currentUser.teamIds ?? [];
    if (role === "Proveedor") {
      return teams.filter(t => t.isActive && t.type === "Provider" && myIds.includes(t.id));
    }
    return teams.filter(t => t.isActive && t.type === "Area" && myIds.includes(t.id));
  }, [teams, role, currentUser.teamIds]);

  // ── Proyectos del año seleccionado ────────────────────
  const projectsInYear = useMemo(
    () => allProjects.filter(p => p.startDate.startsWith(String(selectedYear))),
    [allProjects, selectedYear],
  );

  // ── Proyectos filtrados por equipo elegido ─────────────
  const availableProjects = useMemo(() => {
    if (!teamId) return projectsInYear;
    const team = teams.find(t => t.id === teamId);
    if (!team) return projectsInYear;
    if (team.type === "Area") {
      const areaId = team.id.replace(/^team-/, "ba-");
      return projectsInYear.filter(p => p.businessAreaId === areaId);
    }
    if (team.type === "Provider") {
      return projectsInYear.filter(p => p.providerTeamId === team.id);
    }
    return projectsInYear;
  }, [teamId, teams, projectsInYear]);

  function handleTeamChange(newTeamId: string) {
    setTeamId(newTeamId);
    if (projectId && newTeamId) {
      const p = allProjects.find(x => x.id === projectId);
      const t = teams.find(x => x.id === newTeamId);
      if (p && t) {
        const areaId = t.id.replace(/^team-/, "ba-");
        const mismatch =
          (t.type === "Area"     && p.businessAreaId !== areaId) ||
          (t.type === "Provider" && p.providerTeamId !== newTeamId);
        if (mismatch) setProjectId("");
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) { setError("El título es obligatorio."); return; }
    if (!teamId)        { setError("Debes seleccionar un equipo."); return; }

    setSaving(true);
    try {
      const payload: CreateRequestPayload = {
        year:              selectedYear,
        title:             title.trim(),
        description:       desc.trim(),
        type,
        priority,
        requestedByTeamId: teamId,
        relatedProjectId:  projectId || null,
      };
      await createRequest(payload);
      onCreated();
    } catch {
      setError("Error al crear la solicitud. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const noProjects = projectsInYear.length === 0;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10,
        width: 540, maxWidth: "calc(100vw - 32px)", maxHeight: "92vh",
        overflow: "auto", boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        fontFamily: "'Segoe UI', sans-serif",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "18px 20px 16px", borderBottom: "1px solid #EDEBE9",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#201F1E" }}>
              Nueva solicitud
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: "#8A8886" }}>
              Año: <strong>{selectedYear}</strong> · El equipo IT la revisará y la convertirá en tarea si procede.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "#605E5C", padding: 4, borderRadius: 4,
            display: "flex", alignItems: "center", flexShrink: 0,
          }}>
            <X size={16} />
          </button>
        </div>

        {/* Aviso: sin proyectos en el año */}
        {noProjects && (
          <div style={{
            margin: "14px 20px 0",
            padding: "10px 14px",
            background: "#FFF8E1", border: "1px solid #FFC107", borderRadius: 6,
            display: "flex", gap: 8, alignItems: "flex-start",
            fontSize: 12, color: "#856404",
          }}>
            <AlertCircle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span>
              <strong>No hay proyectos en {selectedYear}.</strong>{" "}
              Puedes crear la solicitud sin proyecto. Si necesitas vincularla, cambia el año en la barra superior.
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {error && (
            <div style={{
              padding: "8px 12px", background: "#FDE7E9", border: "1px solid #F1BCBE",
              borderRadius: 5, color: "#A80000", fontSize: 12,
              display: "flex", gap: 6, alignItems: "center",
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          {/* Título */}
          <label style={LBL}>
            <span>Título <span style={REQ_MARK}>*</span></span>
            <input
              type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Describe brevemente tu solicitud"
              style={INPUT} maxLength={200}
            />
          </label>

          {/* Descripción */}
          <label style={LBL}>
            Descripción
            <textarea
              value={desc} onChange={e => setDesc(e.target.value)} rows={3}
              placeholder="Detalla el problema, necesidad, impacto y contexto relevante."
              style={{ ...INPUT, resize: "vertical" }}
            />
          </label>

          {/* Tipo + Prioridad */}
          <div style={{ display: "flex", gap: 12 }}>
            <label style={{ ...LBL, flex: 1 }}>
              <span>Tipo <span style={REQ_MARK}>*</span></span>
              <select value={type} onChange={e => setType(e.target.value as RequestType)}
                style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}>
                {REQUEST_TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{REQUEST_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <label style={{ ...LBL, flex: 1 }}>
              <span>Prioridad <span style={REQ_MARK}>*</span></span>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)}
                style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          </div>

          {/* Equipo — OBLIGATORIO */}
          <label style={LBL}>
            <span>
              Equipo <span style={REQ_MARK}>*</span>
              {myTeams.length === 0 && (
                <span style={{ color: "#D13438", marginLeft: 6 }}>
                  — Sin equipos asignados (contacta con IT)
                </span>
              )}
            </span>
            <select
              value={teamId}
              onChange={e => handleTeamChange(e.target.value)}
              required
              style={{
                ...INPUT,
                appearance: "auto" as React.CSSProperties["appearance"],
                borderColor: !teamId ? "#D13438" : "#C8C6C4",
              }}
            >
              <option value="">Selecciona un equipo…</option>
              {myTeams.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          {/* Proyecto relacionado */}
          <label style={LBL}>
            <span>
              Proyecto relacionado{" "}
              <span style={{ fontSize: 10, color: "#8A8886" }}>(opcional)</span>
            </span>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              disabled={noProjects}
              style={{ ...INPUT, appearance: "auto" as React.CSSProperties["appearance"] }}
            >
              <option value="">Sin proyecto específico</option>
              {availableProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {teamId && !noProjects && availableProjects.length === 0 && (
              <span style={{ fontSize: 11, color: "#986F0B", marginTop: 2 }}>
                No hay proyectos en {selectedYear} para este equipo.
              </span>
            )}
          </label>

          {/* Botones */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: "8px 18px", border: "1px solid #EDEBE9", borderRadius: 5,
              background: "#fff", color: "#201F1E", cursor: "pointer",
              fontSize: 13, fontFamily: "'Segoe UI', sans-serif",
            }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || myTeams.length === 0} style={{
              padding: "8px 20px", border: "none", borderRadius: 5,
              background: (saving || myTeams.length === 0) ? "#A19F9D" : "#0078D4",
              color: "#fff",
              cursor: (saving || myTeams.length === 0) ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif",
            }}>
              {saving ? "Enviando…" : "Enviar solicitud"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
