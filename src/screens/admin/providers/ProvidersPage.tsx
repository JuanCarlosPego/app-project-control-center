// ─────────────────────────────────────────────────────────
//  src/screens/admin/providers/ProvidersPage.tsx
//  Ruta: /admin/providers — solo rol "Admin"
//  CRUD básico de empresas proveedoras.
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, Pencil, X, RotateCw,
  CheckCircle, XCircle, ChevronLeft, Save,
} from "lucide-react";
import {
  getProviders, createProvider, updateProvider,
  type Provider, type ProviderPayload,
} from "../../../services/providerService";
import {
  AdminToastContainer, newAdminToast, type ToastMsg,
} from "../components/shared";

const F = "'Segoe UI', sans-serif";

// ── Status chip ───────────────────────────────────────────
const StatusChip: React.FC<{ active: boolean }> = ({ active }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: active ? "#DFF6DD" : "#FAF9F8",
    color: active ? "#107C10" : "#A19F9D",
    border: `1px solid ${active ? "#92C353" : "#EDEBE9"}`,
    fontFamily: F, whiteSpace: "nowrap",
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: active ? "#107C10" : "#C8C6C4", flexShrink: 0,
    }} />
    {active ? "Activo" : "Inactivo"}
  </span>
);

// ── Provider Drawer ───────────────────────────────────────
interface DrawerState {
  open: boolean;
  mode: "add" | "edit";
  provider: Provider | null;
}

const ProviderDrawer: React.FC<{
  state: DrawerState;
  onClose: () => void;
  onSaved: (p: Provider) => void;
  addToast: (t: string, ok?: boolean) => void;
}> = ({ state, onClose, onSaved, addToast }) => {
  const { open, mode, provider } = state;

  const [name,     setName]     = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors,   setErrors]   = useState<{ name?: string }>({});
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && provider) {
      setName(provider.name);
      setIsActive(provider.isActive);
    } else {
      setName("");
      setIsActive(true);
    }
    setErrors({});
    setSaving(false);
  }, [open, mode, provider]);

  const validate = () => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "El nombre es obligatorio";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: ProviderPayload = { name: name.trim(), isActive };
      let saved: Provider;
      if (mode === "add") {
        saved = await createProvider(payload);
        addToast(`Proveedor '${saved.name}' creado.`);
      } else {
        saved = await updateProvider(provider!.id, payload);
        addToast(`Proveedor '${saved.name}' actualizado.`);
      }
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Error al guardar.", false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const labelSt: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#605E5C",
    display: "block", marginBottom: 6,
    textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: F,
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 4000 }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 400,
        background: "#fff", zIndex: 4001,
        display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.14)",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px 16px", borderBottom: "1px solid #EDEBE9",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, background: "#FEF9F0", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Building2 size={16} color="#CA8B00" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#201F1E", margin: 0, fontFamily: F }}>
              {mode === "add" ? "Nuevo proveedor" : "Editar proveedor"}
            </h2>
            <div style={{ fontSize: 11, color: "#A19F9D", fontFamily: F, marginTop: 1 }}>
              {mode === "add" ? "Añade una nueva empresa proveedora" : "Modifica los datos del proveedor"}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 6, borderRadius: 6, color: "#A19F9D", display: "flex",
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Nombre */}
          <div>
            <label style={labelSt}>Nombre del proveedor *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. 40Works, SkyTech…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px", border: `1px solid ${errors.name ? "#D13438" : "#EDEBE9"}`,
                borderRadius: 6, fontSize: 13, fontFamily: F, color: "#201F1E", outline: "none",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = errors.name ? "#D13438" : "#0078D4")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = errors.name ? "#D13438" : "#EDEBE9")}
            />
            {errors.name && (
              <div style={{ fontSize: 11, color: "#D13438", marginTop: 4, fontFamily: F }}>{errors.name}</div>
            )}
          </div>

          {/* Estado */}
          <div>
            <label style={labelSt}>Estado</label>
            <div
              onClick={() => setIsActive((v) => !v)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 14px", borderRadius: 7, cursor: "pointer",
                border: "1px solid #EDEBE9", background: "#fff",
              }}
            >
              <span style={{ fontSize: 13, color: "#201F1E", fontFamily: F, fontWeight: 600 }}>
                {isActive ? "Activo" : "Inactivo"}
              </span>
              <div style={{
                width: 40, height: 22, borderRadius: 11, position: "relative",
                background: isActive ? "#0078D4" : "#C8C6C4", transition: "background 180ms",
              }}>
                <div style={{
                  position: "absolute", top: 3,
                  left: isActive ? 20 : 3, width: 16, height: 16,
                  background: "#fff", borderRadius: "50%",
                  transition: "left 180ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "#A19F9D", marginTop: 4, fontFamily: F }}>
              Los proveedores inactivos no aparecen en los selectores de asignación.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid #EDEBE9",
          display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: 6, border: "1px solid #EDEBE9",
            background: "#fff", color: "#201F1E", fontSize: 13, cursor: "pointer",
            fontFamily: F, fontWeight: 600,
          }}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 22px", borderRadius: 6, border: "none",
              background: saving ? "#C8C6C4" : "#CA8B00",
              color: "#fff", fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: F, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {saving
              ? <><RotateCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</>
              : <><Save size={13} /> {mode === "add" ? "Crear proveedor" : "Guardar cambios"}</>
            }
          </button>
        </div>
      </div>
    </>
  );
};

// ── Confirm modal ─────────────────────────────────────────
const ConfirmModal: React.FC<{
  open: boolean; title: string; message: string;
  confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}> = ({ open, title, message, confirmLabel = "Confirmar", danger, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: "28px 32px",
        maxWidth: 400, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", fontFamily: F,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#201F1E", margin: "0 0 10px" }}>{title}</h2>
        <p style={{ fontSize: 13, color: "#605E5C", margin: "0 0 24px", lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            padding: "8px 20px", borderRadius: 6, border: "1px solid #EDEBE9",
            background: "#fff", color: "#201F1E", fontSize: 13, cursor: "pointer",
            fontFamily: F, fontWeight: 600,
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            padding: "8px 20px", borderRadius: 6, border: "none",
            background: danger ? "#D13438" : "#0078D4",
            color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: F, fontWeight: 600,
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

// ── ProvidersPage ─────────────────────────────────────────
export const ProvidersPage: React.FC = () => {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [toasts,    setToasts]    = useState<ToastMsg[]>([]);
  const [drawer,    setDrawer]    = useState<DrawerState>({ open: false, mode: "add", provider: null });
  const [confirm,   setConfirm]   = useState<{
    open: boolean; providerId: string; action: "activate" | "deactivate"; name: string;
  }>({ open: false, providerId: "", action: "deactivate", name: "" });

  const addToast = useCallback((text: string, ok = true) => {
    const t = newAdminToast(text, ok);
    setToasts((p) => [...p, t]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== t.id)), 2800);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProviders();
      setProviders(data);
      setError(null);
    } catch {
      setError("No se pudo cargar la lista de proveedores.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSaved = (saved: Provider) => {
    setProviders((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved];
    });
  };

  const handleToggle = async () => {
    const { providerId, action } = confirm;
    setConfirm((c) => ({ ...c, open: false }));
    try {
      const payload: ProviderPayload = {
        name: providers.find((p) => p.id === providerId)?.name ?? "",
        isActive: action === "activate",
      };
      const updated = await updateProvider(providerId, payload);
      setProviders((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      addToast(`Proveedor ${action === "activate" ? "activado" : "desactivado"}.`);
    } catch {
      addToast("Error al actualizar el estado.", false);
    }
  };

  const activeCount   = providers.filter((p) => p.isActive).length;
  const inactiveCount = providers.length - activeCount;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#FAF9F8", overflow: "hidden", fontFamily: F,
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "16px 24px 14px", borderBottom: "1px solid #EDEBE9",
        background: "#fff", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => navigate("/admin/users")}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 12, color: "#605E5C", fontFamily: F, padding: "4px 8px",
            borderRadius: 4, transition: "background 130ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F2F1")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          <ChevronLeft size={14} /> Usuarios
        </button>
        <div style={{ width: 1, height: 20, background: "#EDEBE9" }} />
        <div style={{
          width: 36, height: 36, background: "#FEF9F0", borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          border: "1px solid #F2D98B",
        }}>
          <Building2 size={18} color="#CA8B00" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#201F1E", margin: 0 }}>
            Gestión de proveedores
          </h1>
          <div style={{ fontSize: 12, color: "#605E5C", marginTop: 2 }}>
            {providers.length} proveedor{providers.length !== 1 ? "es" : ""} —{" "}
            <span style={{ color: "#107C10" }}>{activeCount} activos</span>
            {inactiveCount > 0 && (
              <>, <span style={{ color: "#A19F9D" }}>{inactiveCount} inactivos</span></>
            )}
          </div>
        </div>
        <button
          onClick={() => setDrawer({ open: true, mode: "add", provider: null })}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 6, border: "none",
            background: "#CA8B00", color: "#fff", fontSize: 13,
            fontWeight: 700, cursor: "pointer", fontFamily: F,
            boxShadow: "0 1px 4px rgba(202,139,0,0.3)",
          }}
        >
          <Plus size={15} /> Nuevo proveedor
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
        {error ? (
          <div style={{
            padding: "16px 20px", background: "#FDE7E9",
            border: "1px solid #F4B8BB", borderRadius: 8,
            color: "#A4262C", fontSize: 13,
          }}>{error}</div>
        ) : loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
            <RotateCw size={22} color="#CA8B00" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : providers.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "60px 0", gap: 12,
          }}>
            <Building2 size={40} color="#C8C6C4" />
            <div style={{ fontSize: 14, color: "#A19F9D", fontFamily: F }}>
              No hay proveedores registrados
            </div>
            <button
              onClick={() => setDrawer({ open: true, mode: "add", provider: null })}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "9px 18px", borderRadius: 6, border: "none",
                background: "#CA8B00", color: "#fff", fontSize: 13,
                fontWeight: 700, cursor: "pointer", fontFamily: F, marginTop: 4,
              }}
            >
              <Plus size={14} /> Crear primer proveedor
            </button>
          </div>
        ) : (
          <div style={{
            background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
            overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}>
            {/* Table head */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr 140px",
              padding: "10px 20px",
              borderBottom: "2px solid #EDEBE9",
              background: "#FAFAFA",
            }}>
              {["Nombre", "ID", "Estado", "Creado", "Acciones"].map((h) => (
                <div key={h} style={{
                  fontSize: 11, fontWeight: 700, color: "#A19F9D",
                  textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: F,
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {providers.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 1fr 140px",
                  padding: "13px 20px",
                  alignItems: "center",
                  borderBottom: i < providers.length - 1 ? "1px solid #F3F2F1" : "none",
                  background: i % 2 === 0 ? "#fff" : "#FAFAFA",
                  transition: "background 120ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F6F5F4")}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
              >
                {/* Nombre */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: p.isActive ? "#FEF9F0" : "#FAF9F8",
                    border: `1px solid ${p.isActive ? "#F2D98B" : "#EDEBE9"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Building2 size={14} color={p.isActive ? "#CA8B00" : "#C8C6C4"} />
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: "#201F1E",
                    fontFamily: F, opacity: p.isActive ? 1 : 0.55,
                  }}>
                    {p.name}
                  </span>
                </div>

                {/* ID */}
                <div style={{ fontSize: 11, color: "#A19F9D", fontFamily: F, fontFamily: "'Cascadia Code', monospace" }}>
                  {p.id}
                </div>

                {/* Estado */}
                <div><StatusChip active={p.isActive} /></div>

                {/* Creado */}
                <div style={{ fontSize: 12, color: "#A19F9D", fontFamily: F }}>
                  {p.createdOn ? new Date(p.createdOn).toLocaleDateString("es-ES") : "—"}
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => setDrawer({ open: true, mode: "edit", provider: p })}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "5px 10px", borderRadius: 6, border: "1px solid #EDEBE9",
                      background: "#fff", color: "#201F1E", fontSize: 12,
                      fontWeight: 600, cursor: "pointer", fontFamily: F,
                    }}
                  >
                    <Pencil size={11} /> Editar
                  </button>
                  <button
                    onClick={() => setConfirm({
                      open: true, providerId: p.id,
                      action: p.isActive ? "deactivate" : "activate", name: p.name,
                    })}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "5px 10px", borderRadius: 6, fontSize: 12,
                      fontWeight: 600, cursor: "pointer", fontFamily: F,
                      border: p.isActive ? "1px solid #F4B8BB" : "1px solid #EDEBE9",
                      background: p.isActive ? "#FDE7E9" : "#fff",
                      color: p.isActive ? "#A4262C" : "#201F1E",
                    }}
                  >
                    {p.isActive
                      ? <><XCircle size={11} /> Desactivar</>
                      : <><CheckCircle size={11} /> Activar</>
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ProviderDrawer
        state={drawer}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        onSaved={handleSaved}
        addToast={addToast}
      />

      <ConfirmModal
        open={confirm.open}
        title={confirm.action === "deactivate" ? "¿Desactivar proveedor?" : "¿Activar proveedor?"}
        message={
          confirm.action === "deactivate"
            ? `El proveedor '${confirm.name}' se marcará como inactivo y no aparecerá en los selectores de asignación.`
            : `El proveedor '${confirm.name}' volverá a estar disponible para asignación.`
        }
        confirmLabel={confirm.action === "deactivate" ? "Desactivar" : "Activar"}
        danger={confirm.action === "deactivate"}
        onConfirm={handleToggle}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />

      <AdminToastContainer toasts={toasts} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
