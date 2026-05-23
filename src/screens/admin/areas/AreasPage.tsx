// ─────────────────────────────────────────────────────────
//  src/screens/admin/areas/AreasPage.tsx
//  Ruta: /admin/areas — solo rol "Admin"
//
//  Funcionalidad:
//   • Listar áreas de negocio con filtros (nombre, estado)
//   • Crear nueva área (inline modal)
//   • Editar nombre y descripción (inline modal)
//   • Activar / desactivar área (ConfirmModal)
//   • Navegar al detalle del área (miembros y POs)
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, Search, X, Pencil, CheckCircle, XCircle,
  RotateCw, Eye, Users,
} from "lucide-react";
import type { BusinessArea, UserAreaMembership, UserAreaOwnership } from "../../../types/domain";
import {
  listBusinessAreas,
  createBusinessArea,
  updateBusinessArea,
  activateBusinessArea,
  deactivateBusinessArea,
  listAreaMemberships,
  listAreaOwnerships,
  type CreateBusinessAreaPayload,
  type UpdateBusinessAreaPayload,
} from "../../../services/businessAreaService";
import { AdminToastContainer, newAdminToast, type ToastMsg } from "../components/shared";

// ── Design tokens ─────────────────────────────────────────
const F = "'Segoe UI', sans-serif";
const BLUE = "#0078D4";
const RED  = "#D13438";
const GREEN = "#107C10";

// ── StatusChip ────────────────────────────────────────────
const StatusChip: React.FC<{ active: boolean }> = ({ active }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: active ? "#DFF6DD" : "#FAF9F8",
    color:      active ? GREEN     : "#A19F9D",
    border:     `1px solid ${active ? "#92C353" : "#EDEBE9"}`,
    fontFamily: F, whiteSpace: "nowrap",
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: active ? GREEN : "#C8C6C4", flexShrink: 0,
    }} />
    {active ? "Activa" : "Inactiva"}
  </span>
);

// ── ConfirmModal ──────────────────────────────────────────
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title, message, confirmLabel, danger, onConfirm, onCancel,
}) => (
  <div style={{
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <div style={{
      background: "#fff", borderRadius: 10, padding: "28px 28px 24px",
      width: 380, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", fontFamily: F,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px", color: "#201F1E" }}>
        {title}
      </h3>
      <p style={{ fontSize: 13, color: "#605E5C", margin: "0 0 24px", lineHeight: 1.5 }}>
        {message}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button onClick={onCancel} style={{
          padding: "7px 18px", border: "1px solid #EDEBE9", borderRadius: 6,
          background: "#FAF9F8", fontSize: 13, cursor: "pointer", fontFamily: F,
        }}>Cancelar</button>
        <button onClick={onConfirm} style={{
          padding: "7px 18px", border: "none", borderRadius: 6,
          background: danger ? RED : BLUE,
          color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: F,
        }}>{confirmLabel}</button>
      </div>
    </div>
  </div>
);

// ── AreaFormModal ─────────────────────────────────────────
interface AreaFormModalProps {
  initial?: { name: string; description: string };
  title: string;
  onSave: (data: { name: string; description: string }) => void;
  onClose: () => void;
  saving: boolean;
}
const AreaFormModal: React.FC<AreaFormModalProps> = ({
  initial, title, onSave, onClose, saving,
}) => {
  const [name, setName]         = useState(initial?.name ?? "");
  const [description, setDesc]  = useState(initial?.description ?? "");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: "28px 28px 24px",
        width: 440, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", fontFamily: F,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#201F1E" }}>{title}</h3>
          <button onClick={onClose} style={{
            border: "none", background: "none", cursor: "pointer", padding: 4, color: "#605E5C",
          }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#605E5C", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Nombre *
          </label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del área"
            required
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              padding: "8px 12px", border: "1px solid #EDEBE9", borderRadius: 6,
              fontSize: 13, fontFamily: F, marginBottom: 16, outline: "none",
            }}
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#605E5C", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Descripción opcional del área de negocio"
            rows={3}
            style={{
              display: "block", width: "100%", boxSizing: "border-box",
              padding: "8px 12px", border: "1px solid #EDEBE9", borderRadius: 6,
              fontSize: 13, fontFamily: F, resize: "vertical", marginBottom: 24, outline: "none",
            }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="button" onClick={onClose} style={{
              padding: "8px 18px", border: "1px solid #EDEBE9", borderRadius: 6,
              background: "#FAF9F8", fontSize: 13, cursor: "pointer", fontFamily: F,
            }}>Cancelar</button>
            <button type="submit" disabled={saving || !name.trim()} style={{
              padding: "8px 18px", border: "none", borderRadius: 6,
              background: saving || !name.trim() ? "#C8C6C4" : BLUE,
              color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer",
              fontFamily: F,
            }}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Tipos internos ────────────────────────────────────────
interface AreaWithStats extends BusinessArea {
  memberCount: number;
  poCount: number;
}

// ── AreasPage ─────────────────────────────────────────────
export const AreasPage: React.FC = () => {
  const navigate = useNavigate();

  const [areas, setAreas]         = useState<AreaWithStats[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchQ, setSearchQ]     = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [toasts, setToasts]       = useState<ToastMsg[]>([]);
  const toast = useCallback((t: { kind: "success" | "error"; message: string }) =>
    setToasts((prev) => [...prev, newAdminToast(t.message, t.kind === "success")]), []);

  const [createOpen, setCreateOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<AreaWithStats | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ area: AreaWithStats; action: "activate" | "deactivate" } | null>(null);
  const [saving, setSaving]           = useState(false);

  // ── Carga datos ──────────────────────────────────────────
  const loadAreas = useCallback(async () => {
    setLoading(true);
    try {
      const [rawAreas, allMembers, allOwners] = await Promise.all([
        listBusinessAreas(),
        // Para obtener contadores: cargamos todas las membresías/ownerships de cada área en paralelo
        // Usamos un truco: listamos todas desde el endpoint general sin filtro de área,
        // así que hacemos una petición por área en paralelo para contar.
        // En la práctica los endpoints ya existen por área, así que hacemos Promise.all.
        Promise.all([]) as Promise<UserAreaMembership[][]>,
        Promise.all([]) as Promise<UserAreaOwnership[][]>,
      ]);

      // Cargamos membresías y ownerships de todas las áreas en paralelo
      const [membershipsPerArea, ownershipsPerArea] = await Promise.all([
        Promise.all(rawAreas.map((a) => listAreaMemberships(a.id))),
        Promise.all(rawAreas.map((a) => listAreaOwnerships(a.id))),
      ]);

      const enriched: AreaWithStats[] = rawAreas.map((a, i) => ({
        ...a,
        isActive:    a.isActive ?? true,
        memberCount: membershipsPerArea[i]?.length ?? 0,
        poCount:     ownershipsPerArea[i]?.length ?? 0,
      }));

      setAreas(enriched);
    } catch {
      toast({ kind: "error", message: "Error al cargar las áreas de negocio" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void loadAreas(); }, [loadAreas]);

  // ── Filtros ──────────────────────────────────────────────
  const filtered = areas.filter((a) => {
    const matchSearch = !searchQ || a.name.toLowerCase().includes(searchQ.toLowerCase());
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active"   && (a.isActive ?? true)) ||
      (statusFilter === "inactive" && !(a.isActive ?? true));
    return matchSearch && matchStatus;
  });

  // ── Handlers CRUD ─────────────────────────────────────────
  const handleCreate = async (data: { name: string; description: string }) => {
    setSaving(true);
    try {
      const payload: CreateBusinessAreaPayload = { name: data.name, description: data.description };
      await createBusinessArea(payload);
      setCreateOpen(false);
      toast({ kind: "success", message: `Área "${data.name}" creada correctamente` });
      void loadAreas();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al crear el área";
      toast({ kind: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (data: { name: string; description: string }) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const payload: UpdateBusinessAreaPayload = { name: data.name, description: data.description };
      await updateBusinessArea(editTarget.id, payload);
      setEditTarget(null);
      toast({ kind: "success", message: `Área "${data.name}" actualizada` });
      void loadAreas();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al actualizar el área";
      toast({ kind: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmTarget) return;
    const { area, action } = confirmTarget;
    setSaving(true);
    try {
      if (action === "activate") {
        await activateBusinessArea(area.id);
        toast({ kind: "success", message: `Área "${area.name}" activada` });
      } else {
        await deactivateBusinessArea(area.id);
        toast({ kind: "success", message: `Área "${area.name}" desactivada` });
      }
      setConfirmTarget(null);
      void loadAreas();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al cambiar el estado";
      toast({ kind: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div style={{ padding: "28px 32px", fontFamily: F, minHeight: "100%" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <Building2 size={22} color={BLUE} strokeWidth={1.8} />
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "#201F1E" }}>
              Áreas de Negocio
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "#605E5C", margin: 0 }}>
            Gestiona las áreas de negocio de la organización, sus miembros y Product Owners.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 18px", border: "none", borderRadius: 6,
            background: BLUE, color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: F, flexShrink: 0,
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Nueva Área
        </button>
      </div>

      {/* Filtros */}
      <div style={{
        background: "#fff", border: "1px solid #EDEBE9", borderRadius: 8,
        padding: "14px 16px", marginBottom: 16,
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        {/* Búsqueda */}
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} color="#A19F9D" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Buscar área…"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "7px 10px 7px 32px", border: "1px solid #EDEBE9", borderRadius: 6,
              fontSize: 13, fontFamily: F, outline: "none",
            }}
          />
          {searchQ && (
            <button onClick={() => setSearchQ("")} style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              border: "none", background: "none", cursor: "pointer", padding: 0, color: "#A19F9D",
            }}><X size={13} /></button>
          )}
        </div>

        {/* Filtro estado */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "active", "inactive"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: "1px solid",
                borderColor: statusFilter === v ? BLUE : "#EDEBE9",
                background:  statusFilter === v ? "#EFF6FC" : "#FAF9F8",
                color:       statusFilter === v ? BLUE : "#605E5C",
                cursor: "pointer", fontFamily: F,
              }}
            >
              {v === "all" ? "Todas" : v === "active" ? "Activas" : "Inactivas"}
            </button>
          ))}
        </div>

        {/* Reload */}
        <button
          onClick={() => void loadAreas()}
          title="Recargar"
          style={{
            border: "1px solid #EDEBE9", background: "#FAF9F8", borderRadius: 6,
            padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center",
            color: "#605E5C",
          }}
        >
          <RotateCw size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Tabla */}
      <div style={{
        background: "#fff", border: "1px solid #EDEBE9", borderRadius: 8,
        overflow: "hidden",
      }}>
        {/* Cabecera tabla */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 80px 80px 80px 130px",
          padding: "10px 20px", borderBottom: "1px solid #F3F2F1",
          background: "#FAF9F8",
        }}>
          {["Área", "Miembros", "POs", "Estado", "Acciones"].map((h) => (
            <span key={h} style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "#8A8886", fontFamily: F,
              textAlign: h === "Área" ? "left" : "center",
            }}>{h}</span>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "#A19F9D", fontSize: 13, fontFamily: F }}>
            Cargando áreas…
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: "48px 20px", textAlign: "center", fontFamily: F }}>
            <Building2 size={36} color="#C8C6C4" style={{ marginBottom: 10 }} />
            <p style={{ color: "#A19F9D", fontSize: 13, margin: 0 }}>
              {searchQ || statusFilter !== "all"
                ? "No hay áreas que coincidan con los filtros."
                : "No hay áreas de negocio registradas."}
            </p>
          </div>
        )}

        {/* Filas */}
        {!loading && filtered.map((area, i) => (
          <div
            key={area.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 80px 80px 80px 130px",
              padding: "14px 20px",
              borderBottom: i < filtered.length - 1 ? "1px solid #F3F2F1" : "none",
              alignItems: "center",
              transition: "background 120ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAF9")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {/* Nombre + descripción */}
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#201F1E", fontFamily: F }}>
                {area.name}
              </span>
              {area.description && (
                <p style={{ fontSize: 12, color: "#A19F9D", margin: "2px 0 0", fontFamily: F, lineHeight: 1.4 }}>
                  {area.description}
                </p>
              )}
            </div>

            {/* Miembros */}
            <div style={{ textAlign: "center" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 13, fontWeight: 600, color: "#201F1E", fontFamily: F,
              }}>
                <Users size={13} color="#A19F9D" />
                {area.memberCount}
              </span>
            </div>

            {/* POs */}
            <div style={{ textAlign: "center" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 13, fontWeight: 600, color: "#201F1E", fontFamily: F,
              }}>
                <Users size={13} color="#A19F9D" />
                {area.poCount}
              </span>
            </div>

            {/* Estado */}
            <div style={{ textAlign: "center" }}>
              <StatusChip active={area.isActive ?? true} />
            </div>

            {/* Acciones */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {/* Ver detalle */}
              <button
                onClick={() => navigate(`/admin/areas/${area.id}`)}
                title="Ver detalle"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "5px 10px", border: "1px solid #EDEBE9", borderRadius: 5,
                  background: "#FAF9F8", color: "#605E5C", fontSize: 12,
                  cursor: "pointer", fontFamily: F,
                }}
              >
                <Eye size={13} /> Ver
              </button>

              {/* Editar */}
              <button
                onClick={() => setEditTarget(area)}
                title="Editar área"
                style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "5px 8px", border: "1px solid #EDEBE9", borderRadius: 5,
                  background: "#FAF9F8", color: "#605E5C", cursor: "pointer",
                }}
              >
                <Pencil size={13} />
              </button>

              {/* Activar / Desactivar */}
              {(area.isActive ?? true) ? (
                <button
                  onClick={() => setConfirmTarget({ area, action: "deactivate" })}
                  title="Desactivar"
                  style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "5px 8px", border: `1px solid #FAD9D8`, borderRadius: 5,
                    background: "#FEF0EF", color: RED, cursor: "pointer",
                  }}
                >
                  <XCircle size={13} />
                </button>
              ) : (
                <button
                  onClick={() => setConfirmTarget({ area, action: "activate" })}
                  title="Activar"
                  style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "5px 8px", border: "1px solid #92C353", borderRadius: 5,
                    background: "#F1FAF1", color: GREEN, cursor: "pointer",
                  }}
                >
                  <CheckCircle size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Contadores */}
      {!loading && (
        <p style={{ fontSize: 12, color: "#A19F9D", margin: "10px 0 0", fontFamily: F }}>
          {filtered.length} {filtered.length === 1 ? "área" : "áreas"} mostradas
          {areas.length !== filtered.length ? ` de ${areas.length} total` : ""}
        </p>
      )}

      {/* Modales */}
      {createOpen && (
        <AreaFormModal
          title="Nueva Área de Negocio"
          onSave={handleCreate}
          onClose={() => setCreateOpen(false)}
          saving={saving}
        />
      )}

      {editTarget && (
        <AreaFormModal
          title={`Editar Área: ${editTarget.name}`}
          initial={{ name: editTarget.name, description: editTarget.description ?? "" }}
          onSave={handleEdit}
          onClose={() => setEditTarget(null)}
          saving={saving}
        />
      )}

      {confirmTarget && (
        <ConfirmModal
          title={confirmTarget.action === "activate" ? "Activar área" : "Desactivar área"}
          message={
            confirmTarget.action === "activate"
              ? `¿Deseas activar el área "${confirmTarget.area.name}"? Quedará disponible en todos los formularios.`
              : `¿Deseas desactivar el área "${confirmTarget.area.name}"? Dejará de estar disponible como opción en los formularios, pero sus proyectos no se verán afectados.`
          }
          confirmLabel={confirmTarget.action === "activate" ? "Activar" : "Desactivar"}
          danger={confirmTarget.action === "deactivate"}
          onConfirm={handleToggleStatus}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      <AdminToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
};
