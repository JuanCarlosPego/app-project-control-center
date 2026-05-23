// ─────────────────────────────────────────────────────────
//  src/screens/admin/help/HelpAdminPage.tsx
//  Pantalla de administración de contenidos de ayuda contextual.
//  Admin only — guarded en route y en menuConfig.
//
//  Funcionalidades:
//    • Tabla de entradas con screenId, título, rol, estado
//    • Crear / Editar con modal + preview HTML en tiempo real
//    • Toggle activo/inactivo
//    • Eliminar con confirmación
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff } from "lucide-react";
import {
  listHelpContents,
  createHelpContent,
  updateHelpContent,
  deleteHelpContent,
} from "../../../services/helpService";
import type { HelpContent, HelpRole } from "../../../types/domain";
import { PageHeader } from "../../../components/ui";

// ── Screens conocidos para el selector ───────────────────
const KNOWN_SCREENS: Array<{ id: string; label: string }> = [
  { id: "dashboard",           label: "Inicio (Dashboard)" },
  { id: "projects",            label: "Proyectos" },
  { id: "roadmap",             label: "Roadmap" },
  { id: "gantt",               label: "Gantt" },
  { id: "backlog",             label: "Backlog" },
  { id: "kanban",              label: "Kanban" },
  { id: "requests",            label: "Solicitudes" },
  { id: "activity",            label: "Actividad" },
  { id: "evidences",           label: "Evidencias" },
  { id: "reports",             label: "Informes / KPIs" },
  { id: "risks",               label: "Riesgos y Bloqueos" },
  { id: "audit",               label: "Auditoría" },
  { id: "admin",               label: "Administración (inicio)" },
  { id: "admin-users",         label: "Admin — Usuarios" },
  { id: "admin-teams",         label: "Admin — Equipos" },
  { id: "admin-areas",         label: "Admin — Áreas" },
  { id: "admin-providers",     label: "Admin — Proveedores" },
  { id: "admin-settings",      label: "Admin — Configuración" },
  { id: "admin-permissions",   label: "Admin — Permisos RBAC" },
  { id: "admin-profiles",      label: "Admin — Perfiles de permisos" },
  { id: "admin-state-machine", label: "Admin — Máquina de estados" },
  { id: "admin-help",          label: "Admin — Ayuda" },
];

const ROLES: Array<{ value: HelpRole; label: string }> = [
  { value: "ALL",            label: "Todos los roles (ALL)" },
  { value: "Admin",          label: "Admin" },
  { value: "IT AirEuropa",   label: "IT AirEuropa" },
  { value: "Usuario",        label: "Usuario" },
  { value: "Proveedor",      label: "Proveedor" },
  { value: "Invitado",       label: "Invitado" },
];

// ── Estado inicial del formulario ─────────────────────────
const EMPTY_FORM: Omit<HelpContent, "id"> = {
  screenId:    "",
  title:       "",
  role:        "ALL",
  contentHtml: "",
  isActive:    true,
};

// ── Estilos compartidos ───────────────────────────────────
const SEL: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid #C8C6C4",
  borderRadius: 4,
  fontSize: 13,
  fontFamily: "'Segoe UI', sans-serif",
  background: "#fff",
  color: "#323130",
  width: "100%",
  boxSizing: "border-box",
};
const INPUT: React.CSSProperties = { ...SEL };
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#323130",
  marginBottom: 4,
};
const BTN = (primary?: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  borderRadius: 4,
  border: primary ? "none" : "1px solid #C8C6C4",
  background: primary ? "#0078D4" : "#fff",
  color: primary ? "#fff" : "#323130",
  fontSize: 13,
  fontFamily: "'Segoe UI', sans-serif",
  fontWeight: primary ? 600 : 400,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

// ── HelpAdminPage ─────────────────────────────────────────
export const HelpAdminPage: React.FC = () => {
  const [items,   setItems]   = useState<HelpContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<HelpContent | null>(null);
  const [form,        setForm]        = useState<Omit<HelpContent, "id">>(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<HelpContent | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  // Preview toggle dentro del modal
  const [showPreview, setShowPreview] = useState(true);

  // ── Carga ─────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listHelpContents();
      setItems(data);
    } catch {
      setError("No se pudieron cargar los contenidos de ayuda.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Abrir modal ───────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setSaveError(null);
    setShowPreview(true);
    setModalOpen(true);
  };
  const openEdit = (item: HelpContent) => {
    setEditTarget(item);
    setForm({
      screenId:    item.screenId,
      title:       item.title,
      role:        item.role,
      contentHtml: item.contentHtml,
      isActive:    item.isActive,
    });
    setSaveError(null);
    setShowPreview(true);
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setSaveError(null); };

  // ── Guardar ───────────────────────────────────────────
  const handleSave = async () => {
    if (!form.screenId.trim() || !form.title.trim()) {
      setSaveError("Pantalla y Título son obligatorios.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (editTarget) {
        const updated = await updateHelpContent(editTarget.id, form);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const created = await createHelpContent(form);
        setItems((prev) => [...prev, created]);
      }
      closeModal();
    } catch {
      setSaveError("Error al guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle activo ─────────────────────────────────────
  const handleToggle = async (item: HelpContent) => {
    try {
      const updated = await updateHelpContent(item.id, { isActive: !item.isActive });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch { /* silencioso */ }
  };

  // ── Eliminar ──────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteHelpContent(deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch { /* silencioso */ } finally {
      setDeleting(false);
    }
  };

  // ── Nombre legible de pantalla ────────────────────────
  const screenLabel = useMemo(() => {
    const map = Object.fromEntries(KNOWN_SCREENS.map((s) => [s.id, s.label]));
    return (id: string) => map[id] ?? id;
  }, []);

  // ── Render tabla ──────────────────────────────────────
  return (
    <div style={{ padding: "20px 24px", fontFamily: "'Segoe UI', sans-serif" }}>
      <PageHeader
        icon={<BookOpen size={20} />}
        title="Gestión de Ayuda Contextual"
        subtitle={loading ? "Cargando…" : `${items.length} entrada${items.length !== 1 ? "s" : ""} registrada${items.length !== 1 ? "s" : ""}`}
        actions={
          <button style={BTN(true)} onClick={openCreate} disabled={loading}>
            <Plus size={14} /> Nueva ayuda
          </button>
        }
      />

      {error && (
        <div style={{
          background: "#FDF3F0", border: "1px solid #FDCFBC", borderRadius: 6,
          padding: "12px 16px", color: "#D83B01", fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* ── Tabla ── */}
      {!loading && (
        <div style={{
          background: "#fff",
          border: "1px solid #EDEBE9",
          borderRadius: 8,
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#F3F2F1", borderBottom: "2px solid #E1DFDD" }}>
                {["Pantalla", "Título", "Rol", "Estado", "Actualizado", "Acciones"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontWeight: 600, color: "#323130", fontSize: 12,
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#8A8886" }}>
                    No hay entradas de ayuda. Crea la primera con el botón "Nueva ayuda".
                  </td>
                </tr>
              )}
              {items.map((item, idx) => (
                <tr key={item.id} style={{
                  borderBottom: "1px solid #F3F2F1",
                  background: idx % 2 === 0 ? "#fff" : "#FAFAFA",
                  opacity: item.isActive ? 1 : 0.6,
                }}>
                  <td style={{ padding: "10px 14px", fontFamily: "Consolas, monospace", fontSize: 12, color: "#0078D4", whiteSpace: "nowrap" }}>
                    {item.screenId}
                    <div style={{ fontSize: 11, color: "#8A8886", fontFamily: "'Segoe UI', sans-serif", marginTop: 2 }}>
                      {screenLabel(item.screenId)}
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", maxWidth: 260 }}>
                    <span style={{ color: "#1B2A3E", fontWeight: 500 }}>{item.title}</span>
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 600,
                      background: item.role === "ALL" ? "#EFF6FC" : "#FFF4CE",
                      color:      item.role === "ALL" ? "#0078D4" : "#7A5000",
                      border:     item.role === "ALL" ? "1px solid #BDD6EE" : "1px solid #F8D07A",
                    }}>
                      {item.role}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      color: item.isActive ? "#107C10" : "#8A8886",
                    }}>
                      {item.isActive
                        ? <><Eye size={12} /> Activo</>
                        : <><EyeOff size={12} /> Inactivo</>
                      }
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#605E5C", fontSize: 12, whiteSpace: "nowrap" }}>
                    {item.updatedOn
                      ? new Date(item.updatedOn).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
                      : "—"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        style={{ ...BTN(), padding: "4px 8px", fontSize: 12 }}
                        onClick={() => openEdit(item)}
                        title="Editar"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        style={{ ...BTN(), padding: "4px 8px", fontSize: 12, color: item.isActive ? "#605E5C" : "#107C10" }}
                        onClick={() => handleToggle(item)}
                        title={item.isActive ? "Desactivar" : "Activar"}
                      >
                        {item.isActive
                          ? <><ToggleLeft size={12} /> Desactivar</>
                          : <><ToggleRight size={12} /> Activar</>
                        }
                      </button>
                      <button
                        style={{ ...BTN(), padding: "4px 8px", fontSize: 12, color: "#D83B01", borderColor: "#FDCFBC" }}
                        onClick={() => setDeleteTarget(item)}
                        title="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL CREAR / EDITAR
      ══════════════════════════════════════════════════ */}
      {modalOpen && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 2000,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "40px 20px",
          overflowY: "auto",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
            width: "100%",
            maxWidth: 900,
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}>
            {/* Cabecera */}
            <div style={{
              padding: "16px 20px",
              borderBottom: "1px solid #EDEBE9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1B2A3E" }}>
                {editTarget ? "Editar contenido de ayuda" : "Nueva entrada de ayuda"}
              </span>
              <button
                onClick={closeModal}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#605E5C", padding: 4 }}
              >✕</button>
            </div>

            {/* Cuerpo */}
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

              {/* Pantalla */}
              <div>
                <label style={LABEL}>Pantalla (screenId) *</label>
                <select
                  value={form.screenId}
                  onChange={(e) => setForm((f) => ({ ...f, screenId: e.target.value }))}
                  style={SEL}
                >
                  <option value="">— Selecciona pantalla —</option>
                  {KNOWN_SCREENS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label} ({s.id})</option>
                  ))}
                </select>
              </div>

              {/* Título */}
              <div>
                <label style={LABEL}>Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ej: Roadmap — Guía rápida"
                  style={INPUT}
                />
              </div>

              {/* Rol */}
              <div>
                <label style={LABEL}>Visible para el rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as HelpRole }))}
                  style={SEL}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 22 }}>
                <input
                  type="checkbox"
                  id="help-active"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                <label htmlFor="help-active" style={{ ...LABEL, margin: 0, cursor: "pointer" }}>
                  Activo (visible en la aplicación)
                </label>
              </div>

              {/* HTML Editor — columna completa */}
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ ...LABEL, margin: 0 }}>Contenido HTML</label>
                  <button
                    onClick={() => setShowPreview((v) => !v)}
                    style={{ ...BTN(), padding: "3px 10px", fontSize: 11 }}
                  >
                    {showPreview ? <><EyeOff size={11} /> Ocultar preview</> : <><Eye size={11} /> Mostrar preview</>}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: showPreview ? "1fr 1fr" : "1fr", gap: 12 }}>
                  {/* Textarea */}
                  <div>
                    <div style={{ fontSize: 11, color: "#8A8886", marginBottom: 4 }}>
                      Editor — usa etiquetas: &lt;h3&gt; &lt;p&gt; &lt;ul&gt; &lt;li&gt; &lt;strong&gt; &lt;em&gt; &lt;code&gt;
                    </div>
                    <textarea
                      value={form.contentHtml}
                      onChange={(e) => setForm((f) => ({ ...f, contentHtml: e.target.value }))}
                      rows={16}
                      placeholder="<h3>Título de sección</h3><p>Descripción del contenido...</p>"
                      spellCheck={false}
                      style={{
                        ...INPUT,
                        resize:      "vertical",
                        height:      320,
                        fontFamily:  "Consolas, 'Courier New', monospace",
                        fontSize:    12,
                        lineHeight:  1.5,
                        color:       "#1B2A3E",
                        whiteSpace:  "pre",
                      }}
                    />
                  </div>

                  {/* Preview en tiempo real */}
                  {showPreview && (
                    <div>
                      <div style={{ fontSize: 11, color: "#8A8886", marginBottom: 4 }}>
                        Vista previa — resultado final en el panel de ayuda
                      </div>
                      <div style={{
                        border:     "1px solid #C7E0F4",
                        borderRadius: 6,
                        padding:    "16px",
                        height:     320,
                        overflowY:  "auto",
                        background: "#fff",
                        fontFamily: "'Segoe UI', sans-serif",
                      }}>
                        {/* Inyectar los mismos estilos que HelpPanel */}
                        <style>{`
                          .help-preview h3 { font-size:13px; font-weight:700; color:#1B2A3E; margin:16px 0 6px 0; padding-bottom:4px; border-bottom:1px solid #EFF6FC; }
                          .help-preview h3:first-child { margin-top:0; }
                          .help-preview p { font-size:13px; color:#323130; margin:0 0 10px 0; line-height:1.6; }
                          .help-preview ul { margin:4px 0 10px 0; padding-left:18px; }
                          .help-preview li { font-size:13px; color:#323130; margin-bottom:5px; line-height:1.5; }
                          .help-preview strong { color:#0078D4; font-weight:600; }
                          .help-preview em { color:#605E5C; }
                          .help-preview code { background:#F3F2F1; padding:1px 5px; border-radius:3px; font-size:12px; font-family:Consolas,monospace; }
                        `}</style>
                        {form.contentHtml.trim() ? (
                          <div
                            className="help-preview"
                            dangerouslySetInnerHTML={{ __html: form.contentHtml }}
                          />
                        ) : (
                          <span style={{ color: "#8A8886", fontSize: 13, fontStyle: "italic" }}>
                            Escribe HTML en el editor para ver la preview…
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Error */}
            {saveError && (
              <div style={{
                margin: "0 20px",
                padding: "10px 14px",
                background: "#FDF3F0",
                border: "1px solid #FDCFBC",
                borderRadius: 4,
                color: "#D83B01",
                fontSize: 13,
              }}>
                {saveError}
              </div>
            )}

            {/* Pie */}
            <div style={{
              padding: "16px 20px",
              borderTop: "1px solid #EDEBE9",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}>
              <button style={BTN()} onClick={closeModal} disabled={saving}>
                Cancelar
              </button>
              <button style={BTN(true)} onClick={handleSave} disabled={saving}>
                {saving ? "Guardando…" : (editTarget ? "Guardar cambios" : "Crear entrada")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL CONFIRMAR ELIMINACIÓN
      ══════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.4)",
          zIndex: 2100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}>
          <div style={{
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
            width: "100%",
            maxWidth: 440,
            padding: "24px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <Trash2 size={20} color="#D83B01" />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#1B2A3E" }}>Eliminar entrada de ayuda</span>
            </div>
            <p style={{ fontSize: 13, color: "#323130", margin: "0 0 20px" }}>
              ¿Seguro que quieres eliminar la entrada{" "}
              <strong>"{deleteTarget.title}"</strong>{" "}
              (pantalla: <code>{deleteTarget.screenId}</code>)?
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button style={BTN()} onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancelar
              </button>
              <button
                style={{ ...BTN(), background: "#D83B01", color: "#fff", border: "none" }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
