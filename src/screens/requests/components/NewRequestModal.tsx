// ─────────────────────────────────────────────────────────
//  src/screens/requests/components/NewRequestModal.tsx
//  Modal mejorado para crear nueva solicitud.
//
//  SECCIONES:
//    1. Tipo de solicitud (chips)
//    2. Contexto (título, área de negocio, equipo, proyecto autocomplete)
//    3. Descripción guiada (plantilla estructurada)
//    4. Prioridad y Urgencia
//    5. Adjuntos (múltiples, con previsualización)
//
//  RBAC:
//    - Usuario   → solo equipos tipo "Area"   dentro de sus teamIds
//    - Proveedor → solo equipos tipo "Provider" dentro de sus teamIds
//    - IT/Admin  → cualquier equipo activo
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Paperclip, Search, X, FileText, Image as ImageIcon, File } from "lucide-react";
import type {
  Project, RequestType, Priority, RequestUrgency, Team, BusinessArea,
} from "../../../types/domain";
import type { AppUser } from "../../../auth/ImpersonationContext";
import {
  REQUEST_TYPE_OPTIONS,
  REQUEST_TYPE_LABELS,
  createRequest,
  uploadRequestAttachment,
  type CreateRequestPayload,
} from "../../../services/requestService";
import { getPOAreas } from "../../../services/businessAreaService";

// ── Plantilla de descripción guiada ───────────────────────
const GUIDED_TEMPLATE = `🔹 Problema / necesidad:
[Describe qué está fallando o qué necesitas]

🔹 Objetivo esperado:
[¿Qué debería pasar cuando esto esté resuelto?]

🔹 Impacto:
[¿A quién afecta? ¿Cuántos usuarios? ¿Es bloqueo total o parcial?]

🔹 Contexto / referencias:
[Capturas, URLs, tickets relacionados, etc.]

🔹 Criterios de aceptación (opcional):
[¿Cómo sabremos que está listo?]`;

// ── Configuración de urgencia ─────────────────────────────
const URGENCY_OPTIONS: Array<{
  value: RequestUrgency;
  label: string;
  subtitle: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    value: "inmediato",
    label: "Inmediato",
    subtitle: "Bloqueo crítico de operación",
    icon: "🚨",
    color: "#D13438",
    bg: "#FDE7E9",
    border: "#F1BCBE",
  },
  {
    value: "semana",
    label: "Esta semana",
    subtitle: "Impacto significativo en mi trabajo",
    icon: "⚡",
    color: "#986F0B",
    bg: "#FFF8E1",
    border: "#FFE082",
  },
  {
    value: "mes",
    label: "Este mes",
    subtitle: "Planificable antes de fin de mes",
    icon: "📅",
    color: "#0078D4",
    bg: "#EFF6FC",
    border: "#C7E0F4",
  },
  {
    value: "backlog",
    label: "Backlog",
    subtitle: "Mejora sin presión de tiempo",
    icon: "🗂️",
    color: "#605E5C",
    bg: "#F3F2F1",
    border: "#EDEBE9",
  },
];

// ── Tipos permitidos de adjunto ───────────────────────────
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // .xlsx
];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILES = 1;

interface AttachmentPreview {
  id: string;
  file: File;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

// ── Estilos compartidos ───────────────────────────────────
const FONT: React.CSSProperties = { fontFamily: "'Segoe UI', sans-serif" };

const INPUT: React.CSSProperties = {
  ...FONT,
  width: "100%",
  padding: "7px 10px",
  border: "1px solid #C8C6C4",
  borderRadius: 5,
  fontSize: 13,
  color: "#201F1E",
  background: "#fff",
  boxSizing: "border-box",
};

const LBL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: "#605E5C",
  ...FONT,
};

const SECTION_HDR: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  color: "#8A8886",
  textTransform: "uppercase",
  marginBottom: 8,
  paddingBottom: 4,
  borderBottom: "1px solid #F3F2F1",
  ...FONT,
};

const REQ_MARK: React.CSSProperties = { color: "#D13438", marginLeft: 2 };

// ── Props ─────────────────────────────────────────────────
interface Props {
  currentUser:   AppUser;
  teams:         Team[];
  allProjects:   Project[];
  businessAreas: BusinessArea[];
  selectedYear:  number;
  onCreated:     () => void;
  onClose:       () => void;
}

const PRIORITIES: Priority[] = ["Alta", "Media", "Baja"];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string): React.ReactNode {
  if (mime.startsWith("image/")) return <ImageIcon size={14} />;
  if (mime === "application/pdf")  return <FileText size={14} />;
  return <File size={14} />;
}

// ── Componente principal ──────────────────────────────────
export const NewRequestModal: React.FC<Props> = ({
  currentUser, teams, allProjects, businessAreas, selectedYear, onCreated, onClose,
}) => {
  // ── Estado del formulario ─────────────────────────────
  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState(GUIDED_TEMPLATE);
  const [type,         setType]         = useState<RequestType>("Mejora");
  const [priority,     setPriority]     = useState<Priority>("Media");
  const [urgency,      setUrgency]      = useState<RequestUrgency | "">("");
  const [businessAreaId, setBusinessAreaId] = useState<string>("");
  const [teamId,       setTeamId]       = useState<string>("");
  // Proyecto con autocomplete
  const [projectSearch, setProjectSearch] = useState("");
  const [projectId,    setProjectId]    = useState<string>("");
  const [projectOpen,  setProjectOpen]  = useState(false);
  // Adjuntos
  const [attachments,  setAttachments]  = useState<AttachmentPreview[]>([]);
  const [fileError,    setFileError]    = useState<string | null>(null);
  const [isDragging,   setIsDragging]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Áreas de negocio donde el usuario efectivo es PO
  const [poAreas,      setPoAreas]      = useState<BusinessArea[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);

  useEffect(() => {
    setLoadingAreas(true);
    getPOAreas(currentUser.id)
      .then(setPoAreas)
      .catch(() => setPoAreas([]))
      .finally(() => setLoadingAreas(false));
  }, [currentUser.id]);

  // Envío
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const role = currentUser.role;

  // ── Equipos disponibles según rol ────────────────────
  const myTeams = useMemo(() => {
    if (role === "Admin" || role === "IT AirEuropa") {
      return teams.filter(t => t.isActive);
    }
    const myIds = currentUser.teamIds ?? [];
    if (role === "Proveedor") {
      return teams.filter(t => t.isActive && t.type === "Provider" && myIds.includes(t.id));
    }
    // Mostrar todos los equipos activos asignados al usuario (independientemente del tipo)
    // — el campo cproroad_type puede no estar configurado en Dataverse (tipo null → "Internal")
    return teams.filter(t => t.isActive && myIds.includes(t.id));
  }, [teams, role, currentUser.teamIds]);

  // ── Proyectos del año ─────────────────────────────────
  const projectsInYear = useMemo(
    () => allProjects.filter(p => p.startDate?.startsWith(String(selectedYear))),
    [allProjects, selectedYear],
  );

  // ── Proyectos filtrados por equipo + búsqueda ─────────
  const filteredProjects = useMemo(() => {
    let base = projectsInYear;
    if (teamId) {
      const team = teams.find(t => t.id === teamId);
      if (team?.type === "Area") {
        const areaId = team.id.replace(/^team-/, "ba-");
        base = base.filter(p => p.businessAreaId === areaId);
      } else if (team?.type === "Provider") {
        base = base.filter(p => p.providerTeamId === team.id);
      }
    }
    if (projectSearch.trim()) {
      const q = projectSearch.toLowerCase();
      base = base.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q),
      );
    }
    return base.slice(0, 20);
  }, [projectsInYear, teamId, teams, projectSearch]);

  // ── Nombre del proyecto seleccionado ─────────────────
  const selectedProjectName = useMemo(
    () => allProjects.find(p => p.id === projectId)?.name ?? "",
    [allProjects, projectId],
  );

  function handleTeamChange(newTeamId: string) {
    setTeamId(newTeamId);
    // Limpiar proyecto si ya no es compatible con el nuevo equipo
    if (projectId && newTeamId) {
      const p = allProjects.find(x => x.id === projectId);
      const t = teams.find(x => x.id === newTeamId);
      if (p && t) {
        const areaId = t.id.replace(/^team-/, "ba-");
        const mismatch =
          (t.type === "Area"     && p.businessAreaId !== areaId) ||
          (t.type === "Provider" && p.providerTeamId !== newTeamId);
        if (mismatch) {
          setProjectId("");
          setProjectSearch("");
        }
      }
    }
  }

  function selectProject(id: string, name: string) {
    setProjectId(id);
    setProjectSearch(name);
    setProjectOpen(false);
  }

  function clearProject() {
    setProjectId("");
    setProjectSearch("");
    setProjectOpen(false);
  }

  // ── Adjuntos ──────────────────────────────────────────
  const processFiles = useCallback((files: File[]) => {
    setFileError(null);
    if (attachments.length >= MAX_FILES) {
      setFileError("Solo se permite 1 adjunto. Elimina el actual para añadir otro.");
      return;
    }
    const file = files[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError(`Tipo no permitido: ${file.name}. Usa PDF, PNG, JPG, DOCX o XLSX.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`${file.name} supera el límite de ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setAttachments([{
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        name:      file.name,
        mimeType:  file.type,
        sizeBytes: file.size,
        dataUrl:   ev.target?.result as string,
      }]);
    };
    reader.readAsDataURL(file);
  }, [attachments.length]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files ?? []));
    // reset input so same file can be re-added after removal
    if (fileRef.current) fileRef.current.value = "";
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  }, [processFiles]);

  function removeAttachment(id: string) {
    setAttachments(prev => prev.filter(a => a.id !== id));
    setFileError(null);
  }

  // ── Envío ─────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!title.trim())        { setError("El título es obligatorio (máx. 150 caracteres)."); return; }
    if (title.trim().length > 150) { setError("El título no puede superar 150 caracteres."); return; }
    if (!businessAreaId)      { setError("Debes seleccionar un área de negocio."); return; }
    if (!urgency)             { setError("Indica la urgencia de la solicitud."); return; }

    setSaving(true);
    try {
      const payload: CreateRequestPayload = {
        year:              selectedYear,
        title:             title.trim(),
        description:       description.trim() === GUIDED_TEMPLATE.trim() ? "" : description.trim(),
        type,
        priority,
        urgency:           urgency || null,
        businessAreaId:    businessAreaId || null,
        requestedByTeamId: null,
        relatedProjectId:  projectId || null,
      };
      const created = await createRequest(payload);

      // Subir adjuntos (errores no bloquean)
      if (attachments.length > 0) {
        await Promise.allSettled(
          attachments.map(att =>
            uploadRequestAttachment(created.id, {
              name:      att.name,
              mimeType:  att.mimeType,
              sizeBytes: att.sizeBytes,
              file:      att.file,
              dataUrl:   att.dataUrl,
            }),
          ),
        );
      }

      onCreated();
    } catch {
      setError("Error al enviar la solicitud. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = !saving;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 10,
        width: 640, maxWidth: "calc(100vw - 32px)", maxHeight: "94vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
        ...FONT,
      }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "18px 22px 16px", borderBottom: "1px solid #EDEBE9", flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#201F1E" }}>
              📋 Nueva solicitud
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8A8886" }}>
              Año: <strong>{selectedYear}</strong> · IT revisará y convertirá en tarea si procede.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "#605E5C", padding: 4, borderRadius: 4, flexShrink: 0,
            display: "flex", alignItems: "center",
          }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Cuerpo scrollable ───────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          style={{ padding: "20px 22px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}
        >

          {/* Error global */}
          {error && (
            <div style={{
              padding: "9px 13px", background: "#FDE7E9", border: "1px solid #F1BCBE",
              borderRadius: 5, color: "#A80000", fontSize: 12,
              display: "flex", gap: 7, alignItems: "center",
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          {/* ──────────────────────────────────────────────── */}
          {/* SECCIÓN 1 — TIPO                               */}
          {/* ──────────────────────────────────────────────── */}
          <div>
            <p style={SECTION_HDR}>1 · ¿Qué tipo de solicitud?</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {REQUEST_TYPE_OPTIONS.map(t => {
                const active = type === t;
                return (
                  <button
                    key={t} type="button"
                    onClick={() => setType(t)}
                    style={{
                      padding: "5px 13px",
                      border: `1.5px solid ${active ? "#0078D4" : "#EDEBE9"}`,
                      borderRadius: 20,
                      background: active ? "#EFF6FC" : "#F3F2F1",
                      color: active ? "#0078D4" : "#605E5C",
                      fontWeight: active ? 700 : 400,
                      fontSize: 12,
                      cursor: "pointer",
                      ...FONT,
                      transition: "all 0.12s",
                    }}
                  >
                    {REQUEST_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ──────────────────────────────────────────────── */}
          {/* SECCIÓN 2 — CONTEXTO                           */}
          {/* ──────────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={SECTION_HDR}>2 · Contexto de la solicitud</p>

            {/* Título */}
            <label style={LBL}>
              <span>
                Título <span style={REQ_MARK}>*</span>
                <span style={{ color: title.length > 130 ? "#D13438" : "#A19F9D", marginLeft: 8, fontSize: 10 }}>
                  {title.length}/150
                </span>
              </span>
              <input
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ej: Error en cálculo de tarifas para vuelos internacionales"
                style={{ ...INPUT, borderColor: title.length > 150 ? "#D13438" : "#C8C6C4" }}
                maxLength={160}
              />
            </label>

            {/* Área de negocio */}
            {/* Equipo: oculto — se asigna en triaje por IT */}
            <label style={LBL}>
              <span>
                Área de negocio <span style={REQ_MARK}>*</span>
                {!loadingAreas && poAreas.length === 0 && (
                  <span style={{ color: "#D13438", marginLeft: 4 }}>— sin áreas asignadas</span>
                )}
              </span>
              <select
                value={businessAreaId}
                onChange={e => setBusinessAreaId(e.target.value)}
                required
                disabled={loadingAreas}
                style={{
                  ...INPUT,
                  appearance: "auto",
                  opacity: loadingAreas ? 0.6 : 1,
                  cursor:  loadingAreas ? "not-allowed" : undefined,
                }}
              >
                <option value="">
                  {loadingAreas ? "Cargando áreas…" : "Selecciona área…"}
                </option>
                {poAreas.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>

            {/* Proyecto relacionado — autocomplete */}
            <div style={LBL}>
              <span>
                Proyecto relacionado{" "}
                <span style={{ fontSize: 10, color: "#8A8886" }}>(opcional)</span>
              </span>
              <div style={{ position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{
                    position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)",
                    color: "#8A8886", pointerEvents: "none",
                  }} />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={e => {
                      setProjectSearch(e.target.value);
                      if (e.target.value !== selectedProjectName) setProjectId("");
                      setProjectOpen(true);
                    }}
                    onFocus={() => setProjectOpen(true)}
                    placeholder="Buscar proyecto por nombre o código…"
                    style={{ ...INPUT, paddingLeft: 28, paddingRight: projectId ? 28 : 10 }}
                  />
                  {projectId && (
                    <button type="button" onClick={clearProject} style={{
                      position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "#8A8886", display: "flex", alignItems: "center", padding: 0,
                    }}>
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {projectOpen && projectSearch.trim() && (
                  <div style={{
                    position: "absolute", zIndex: 10, top: "100%", left: 0, right: 0,
                    background: "#fff", border: "1px solid #EDEBE9",
                    borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                    maxHeight: 200, overflowY: "auto", marginTop: 2,
                  }}
                    onMouseDown={e => e.preventDefault()}
                  >
                    {filteredProjects.length === 0 ? (
                      <div style={{ padding: "10px 14px", fontSize: 12, color: "#8A8886" }}>
                        Sin resultados para "{projectSearch}"
                      </div>
                    ) : (
                      filteredProjects.map(p => (
                        <button
                          key={p.id} type="button"
                          onClick={() => selectProject(p.id, p.name)}
                          style={{
                            display: "block", width: "100%", textAlign: "left",
                            padding: "8px 14px", border: "none", background: "none",
                            cursor: "pointer", fontSize: 12, color: "#201F1E", ...FONT,
                          }}
                          onMouseOver={e => (e.currentTarget.style.background = "#F3F2F1")}
                          onMouseOut={e => (e.currentTarget.style.background = "none")}
                        >
                          <strong>{p.code}</strong> — {p.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {projectId && (
                <span style={{ fontSize: 11, color: "#107C10", marginTop: 2 }}>
                  ✓ Proyecto seleccionado: <strong>{selectedProjectName}</strong>
                </span>
              )}
            </div>
          </div>

          {/* ──────────────────────────────────────────────── */}
          {/* SECCIÓN 3 — DESCRIPCIÓN GUIADA                 */}
          {/* ──────────────────────────────────────────────── */}
          <div>
            <p style={SECTION_HDR}>3 · Descripción detallada</p>
            <label style={LBL}>
              <span>
                Usa la plantilla como guía — edita o reemplaza el texto entre [corchetes].
              </span>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={10}
                style={{ ...INPUT, resize: "vertical", lineHeight: 1.6, fontSize: 12 }}
                onFocus={e => {
                  // Si el usuario no ha tocado la plantilla, seleccionamos todo para facilitar el reemplazo
                  if (e.target.value === GUIDED_TEMPLATE) {
                    e.target.style.color = "#201F1E";
                  }
                }}
              />
            </label>
          </div>

          {/* ──────────────────────────────────────────────── */}
          {/* SECCIÓN 4 — PRIORIDAD Y URGENCIA               */}
          {/* ──────────────────────────────────────────────── */}
          <div>
            <p style={SECTION_HDR}>4 · Prioridad y urgencia</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Prioridad */}
              <label style={LBL}>
                <span>Prioridad <span style={REQ_MARK}>*</span></span>
                <div style={{ display: "flex", gap: 8 }}>
                  {PRIORITIES.map(p => {
                    const colors: Record<Priority, { bg: string; border: string; color: string }> = {
                      Alta:  { bg: "#FDE7E9", border: "#D13438", color: "#D13438" },
                      Media: { bg: "#FFF8E1", border: "#986F0B", color: "#986F0B" },
                      Baja:  { bg: "#F3F2F1", border: "#8A8886", color: "#605E5C" },
                    };
                    const active = priority === p;
                    const c = colors[p];
                    return (
                      <button key={p} type="button" onClick={() => setPriority(p)} style={{
                        flex: 1, padding: "6px 0", border: `1.5px solid ${active ? c.border : "#EDEBE9"}`,
                        borderRadius: 6, background: active ? c.bg : "#F9F8F7",
                        color: active ? c.color : "#605E5C",
                        fontWeight: active ? 700 : 400, fontSize: 12, cursor: "pointer", ...FONT,
                      }}>
                        {p}
                      </button>
                    );
                  })}
                </div>
              </label>

              {/* Urgencia */}
              <div>
                <span style={{ fontSize: 12, color: "#605E5C" }}>
                  Urgencia <span style={REQ_MARK}>*</span>
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
                  {URGENCY_OPTIONS.map(opt => {
                    const active = urgency === opt.value;
                    return (
                      <button
                        key={opt.value} type="button"
                        onClick={() => setUrgency(opt.value)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 8,
                          padding: "9px 12px",
                          border: `1.5px solid ${active ? opt.border : "#EDEBE9"}`,
                          borderRadius: 7,
                          background: active ? opt.bg : "#FAFAFA",
                          cursor: "pointer", textAlign: "left",
                          boxShadow: active ? `0 0 0 2px ${opt.border}` : "none",
                          transition: "all 0.1s",
                          ...FONT,
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{opt.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: active ? 700 : 600, color: active ? opt.color : "#201F1E" }}>
                            {opt.label}
                          </div>
                          <div style={{ fontSize: 10, color: "#8A8886", marginTop: 2 }}>
                            {opt.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────── */}
          {/* SECCIÓN 5 — ADJUNTOS                           */}
          {/* ──────────────────────────────────────────────── */}
          <div>
            <p style={SECTION_HDR}>5 · Adjunto <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional · máx. 1 archivo · {MAX_FILE_SIZE_MB} MB · PDF, PNG, JPG, DOCX, XLSX)</span></p>

            {/* Error de archivo */}
            {fileError && (
              <div style={{
                padding: "7px 11px", background: "#FFF8E1", border: "1px solid #FFE082",
                borderRadius: 5, color: "#856404", fontSize: 11, marginBottom: 8,
                display: "flex", gap: 6, alignItems: "center",
              }}>
                <AlertCircle size={12} style={{ flexShrink: 0 }} /> {fileError}
              </div>
            )}

            {/* Zona de drop / botón */}
            <input
              ref={fileRef} type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            {attachments.length < MAX_FILES && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  width: "100%", padding: "14px",
                  border: `1.5px dashed ${isDragging ? "#0078D4" : "#C8C6C4"}`,
                  borderRadius: 7,
                  background: isDragging ? "#EFF6FC" : "#FAFAFA",
                  cursor: "pointer",
                  fontSize: 12,
                  color: isDragging ? "#0078D4" : "#605E5C",
                  transition: "all 0.15s",
                  boxSizing: "border-box",
                  ...FONT,
                }}
              >
                <Paperclip size={14} />
                {isDragging
                  ? "Suelta el archivo aquí"
                  : "Adjuntar archivo (PDF, PNG, JPG, DOCX, XLSX) o arrastra aquí"}
              </div>
            )}

            {/* Lista de archivos */}
            {attachments.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {attachments.map(att => (
                  <div key={att.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "7px 10px",
                    border: "1px solid #EDEBE9", borderRadius: 6,
                    background: "#F9F8F7",
                  }}>
                    {/* Miniatura o icono */}
                    {att.mimeType.startsWith("image/") ? (
                      <img
                        src={att.dataUrl} alt={att.name}
                        style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: 4, background: "#EFF6FC",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#0078D4", flexShrink: 0,
                      }}>
                        {fileIcon(att.mimeType)}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#201F1E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {att.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#8A8886" }}>{fmtSize(att.sizeBytes)}</div>
                    </div>
                    <button type="button" onClick={() => removeAttachment(att.id)} style={{
                      background: "transparent", border: "none", cursor: "pointer",
                      color: "#8A8886", padding: 4, borderRadius: 4, display: "flex", alignItems: "center",
                    }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────── */}
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: 10,
            paddingTop: 8, borderTop: "1px solid #EDEBE9",
          }}>
            <button type="button" onClick={onClose} style={{
              padding: "8px 20px", border: "1px solid #EDEBE9", borderRadius: 5,
              background: "#fff", color: "#201F1E", cursor: "pointer",
              fontSize: 13, ...FONT,
            }}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: "8px 22px", border: "none", borderRadius: 5,
                background: !canSubmit ? "#A19F9D" : "#0078D4",
                color: "#fff",
                cursor: !canSubmit ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 600, ...FONT,
              }}
            >
              {saving ? "Enviando…" : "Enviar solicitud →"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

