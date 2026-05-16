// ─────────────────────────────────────────────────────────
//  src/screens/admin/profiles/AdminProfilesPage.tsx
//  Ruta: /admin/profiles — Gestión del catálogo de Perfiles
//  de Permisos (PO, Key User…) y sus permisos asignados.
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import { Layers, Plus, Pencil, RotateCw } from "lucide-react";
import {
  getPermissionProfiles,
  createPermissionProfile,
  updatePermissionProfile,
  getProfilePermissions,
  addPermissionToProfile,
  removePermissionFromProfile,
} from "../../../services/profileService";
import { getRolePermissions, type RolePermissionsPayload } from "../../../services/adminService";
import { invalidatePermissionCache } from "../../../auth/usePermission";
import type { PermissionProfile, ProfilePermission, RbacPermission } from "../../../types/domain";
import {
  Toggle,
  AdminToastContainer,
  PageHeader,
  newAdminToast,
  type ToastMsg,
} from "../components/shared";

const F = "'Segoe UI', sans-serif";

const GROUP_COLORS: Record<"TAREAS" | "TRANSICIONES" | "VISTAS", string> = {
  TAREAS:       "#0078D4",
  TRANSICIONES: "#7530AF",
  VISTAS:       "#107C10",
};
const GROUP_BG: Record<"TAREAS" | "TRANSICIONES" | "VISTAS", string> = {
  TAREAS:       "#EFF6FC",
  TRANSICIONES: "#F8F0FF",
  VISTAS:       "#F3FBF5",
};

// ── Badge activo/inactivo ─────────────────────────────────
const ActiveBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
    background: active ? "#DFF6DD" : "#FAF9F8",
    color:      active ? "#107C10" : "#A19F9D",
    border:     `1px solid ${active ? "#B7E0B8" : "#EDEBE9"}`,
  }}>
    {active ? "Activo" : "Inactivo"}
  </span>
);

// ── Tarjeta de perfil (panel izquierdo) ───────────────────
const ProfileCard: React.FC<{
  profile: PermissionProfile;
  selected: boolean;
  permCount: number;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
}> = ({ profile, selected, permCount, onClick, onEdit }) => (
  <div
    onClick={onClick}
    style={{
      padding: "14px 16px", borderRadius: 10, marginBottom: 8,
      border: `2px solid ${selected ? "#7530AF" : "#EDEBE9"}`,
      background: selected ? "#F8F0FF" : "#fff",
      cursor: "pointer", position: "relative", fontFamily: F,
      transition: "border-color 150ms, background 150ms",
    }}
  >
    <div style={{ position: "absolute", top: 12, right: 12 }}>
      <ActiveBadge active={profile.isActive} />
    </div>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#201F1E", marginBottom: 2, paddingRight: 60 }}>
      {profile.name}
    </div>
    <div style={{ fontSize: 12, color: "#7530AF", fontWeight: 600, marginBottom: 4 }}>
      {profile.label}
    </div>
    {profile.description && (
      <div style={{ fontSize: 11, color: "#605E5C", lineHeight: 1.5, marginBottom: 8 }}>
        {profile.description}
      </div>
    )}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 11, color: "#A19F9D" }}>
        {permCount} {permCount === 1 ? "permiso" : "permisos"}
      </span>
      <button
        onClick={onEdit}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          fontSize: 11, fontWeight: 600, color: "#7530AF",
          background: "transparent", border: "none",
          cursor: "pointer", padding: "3px 6px", borderRadius: 4, fontFamily: F,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "#EDE0FF")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <Pencil size={11} /> Editar
      </button>
    </div>
  </div>
);

// ── Modal crear / editar perfil ───────────────────────────
const ProfileModal: React.FC<{
  mode: "add" | "edit";
  initial: Partial<PermissionProfile>;
  saving: boolean;
  onSave: (data: { name: string; label: string; description: string; isActive: boolean }) => void;
  onCancel: () => void;
}> = ({ mode, initial, saving, onSave, onCancel }) => {
  const [name,   setName]   = useState(initial.name        ?? "");
  const [label,  setLabel]  = useState(initial.label       ?? "");
  const [desc,   setDesc]   = useState(initial.description ?? "");
  const [active, setActive] = useState(initial.isActive    ?? true);

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 6, boxSizing: "border-box",
    border: "1px solid #EDEBE9", fontSize: 13, fontFamily: F,
    outline: "none", color: "#201F1E", background: "#fff",
  };
  const labelSt: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, color: "#605E5C", marginBottom: 5, display: "block",
  };

  const canSave = name.trim().length > 0 && label.trim().length > 0;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: "28px 32px",
        width: 460, maxWidth: "95vw", fontFamily: F,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#201F1E", margin: "0 0 20px" }}>
          {mode === "add" ? "Nuevo perfil de permisos" : "Editar perfil"}
        </h2>

        <label style={labelSt}>
          Nombre interno *
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="PO" maxLength={40}
            style={{ ...inputSt, marginTop: 4 }}
          />
        </label>
        <div style={{ height: 14 }} />
        <label style={labelSt}>
          Etiqueta visible *
          <input
            value={label} onChange={e => setLabel(e.target.value)}
            placeholder="Product Owner" maxLength={80}
            style={{ ...inputSt, marginTop: 4 }}
          />
        </label>
        <div style={{ height: 14 }} />
        <label style={labelSt}>
          Descripción
          <textarea
            value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Breve descripción del perfil…"
            rows={3} maxLength={300}
            style={{ ...inputSt, marginTop: 4, resize: "vertical" }}
          />
        </label>

        {mode === "edit" && (
          <>
            <div style={{ height: 14 }} />
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", background: "#FAF9F8",
              borderRadius: 8, border: "1px solid #EDEBE9",
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#201F1E" }}>Perfil activo</span>
              <Toggle checked={active} onChange={setActive} />
            </div>
          </>
        )}

        <div style={{ height: 24 }} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "9px 20px", borderRadius: 6, fontFamily: F,
              border: "1px solid #EDEBE9", background: "#fff",
              color: "#201F1E", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >Cancelar</button>
          <button
            onClick={() => canSave && onSave({ name: name.trim(), label: label.trim(), description: desc.trim(), isActive: active })}
            disabled={saving || !canSave}
            style={{
              padding: "9px 20px", borderRadius: 6, fontFamily: F, border: "none",
              background: !canSave ? "#C8C6C4" : "#7530AF", color: "#fff",
              fontSize: 13, fontWeight: 600,
              cursor: saving || !canSave ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── AdminProfilesPage ─────────────────────────────────────
export const AdminProfilesPage: React.FC = () => {
  const [profiles,     setProfiles]     = useState<PermissionProfile[]>([]);
  const [profilePerms, setProfilePerms] = useState<ProfilePermission[]>([]);
  const [rbacPerms,    setRbacPerms]    = useState<RbacPermission[]>([]);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [toasts,       setToasts]       = useState<ToastMsg[]>([]);
  const [toggling,     setToggling]     = useState<string | null>(null);
  const [modal, setModal] = useState<{
    open: boolean;
    mode: "add" | "edit";
    initial: Partial<PermissionProfile>;
  }>({ open: false, mode: "add", initial: {} });
  const [modalSaving, setModalSaving] = useState(false);

  const addToast = useCallback((text: string, ok = true) => {
    const t = newAdminToast(text, ok);
    setToasts(p => [...p, t]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 2800);
  }, []);

  // ── Carga inicial ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getPermissionProfiles(),
      getProfilePermissions(),
      getRolePermissions(),
    ]).then(([profs, pp, rpResult]: [PermissionProfile[], ProfilePermission[], RolePermissionsPayload]) => {
      if (cancelled) return;
      setProfiles(profs);
      setProfilePerms(pp);
      setRbacPerms(rpResult.permissions);
      if (profs.length > 0) setSelectedId(profs[0].id);
    }).catch(() => {
      if (!cancelled) addToast("Error al cargar los perfiles.", false);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [addToast]);

  const selected      = profiles.find(p => p.id === selectedId) ?? null;
  const selectedPerms = profilePerms.filter(pp => pp.profileId === selectedId);
  const selectedKeys  = new Set(selectedPerms.map(pp => pp.permissionKey));

  // ── Toggle permiso en el perfil seleccionado ──────────
  const handleTogglePerm = useCallback(async (permKey: string) => {
    if (!selectedId || toggling) return;
    setToggling(permKey);
    try {
      if (selectedKeys.has(permKey)) {
        const entry = selectedPerms.find(pp => pp.permissionKey === permKey);
        if (entry) {
          await removePermissionFromProfile(entry.id);
          setProfilePerms(prev => prev.filter(pp => pp.id !== entry.id));
          addToast(`'${permKey}' eliminado del perfil.`);
        }
      } else {
        const newPP = await addPermissionToProfile(selectedId, permKey);
        setProfilePerms(prev => [...prev, newPP]);
        addToast(`'${permKey}' añadido al perfil.`);
      }
      invalidatePermissionCache();
    } catch (e: unknown) {
      addToast((e instanceof Error ? e.message : "Error al actualizar permiso."), false);
    } finally {
      setToggling(null);
    }
  }, [selectedId, selectedKeys, selectedPerms, toggling, addToast]);

  // ── Guardar perfil (crear / actualizar) ───────────────
  const handleSaveProfile = useCallback(async (data: {
    name: string; label: string; description: string; isActive: boolean;
  }) => {
    setModalSaving(true);
    try {
      if (modal.mode === "add") {
        const created = await createPermissionProfile({
          name: data.name, label: data.label, description: data.description,
        });
        setProfiles(prev => [...prev, created]);
        setSelectedId(created.id);
        addToast(`Perfil '${created.name}' creado.`);
      } else {
        const updated = await updatePermissionProfile(modal.initial.id!, {
          name: data.name, label: data.label,
          description: data.description, isActive: data.isActive,
        });
        setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
        addToast(`Perfil '${updated.name}' actualizado.`);
      }
      setModal(m => ({ ...m, open: false }));
    } catch (e: unknown) {
      addToast((e instanceof Error ? e.message : "Error al guardar el perfil."), false);
    } finally {
      setModalSaving(false);
    }
  }, [modal, addToast]);

  // ── Guards ────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <RotateCw size={24} color="#7530AF" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const groups: Array<"TAREAS" | "TRANSICIONES" | "VISTAS"> = ["TAREAS", "TRANSICIONES", "VISTAS"];
  const byGroup = (g: string) => rbacPerms.filter(p => p.group === g);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#FAF9F8", overflow: "hidden", fontFamily: F,
    }}>
      {/* ── Header ── */}
      <PageHeader
        title="Perfiles de Permisos"
        subtitle="Conjuntos de permisos adicionales asignables a usuarios concretos"
        icon={<Layers size={18} />}
        actions={
          <button
            onClick={() => setModal({ open: true, mode: "add", initial: {} })}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 6, border: "none",
              background: "#7530AF", color: "#fff",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: F,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#5E1D91")}
            onMouseLeave={e => (e.currentTarget.style.background = "#7530AF")}
          >
            <Plus size={13} /> Nuevo perfil
          </button>
        }
      />

      {/* ── Body: split layout ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Left: lista de perfiles */}
        <div style={{
          width: 280, flexShrink: 0, overflowY: "auto",
          borderRight: "1px solid #EDEBE9",
          padding: "16px 12px", background: "#fff",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#A19F9D",
            textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12,
          }}>
            {profiles.length} {profiles.length === 1 ? "perfil" : "perfiles"}
          </div>

          {profiles.map(p => (
            <ProfileCard
              key={p.id}
              profile={p}
              selected={p.id === selectedId}
              permCount={profilePerms.filter(pp => pp.profileId === p.id).length}
              onClick={() => setSelectedId(p.id)}
              onEdit={(e) => { e.stopPropagation(); setModal({ open: true, mode: "edit", initial: p }); }}
            />
          ))}

          {profiles.length === 0 && (
            <div style={{
              fontSize: 12, color: "#A19F9D", textAlign: "center",
              paddingTop: 40, lineHeight: 1.9,
            }}>
              No hay perfiles.<br />
              Crea el primero con<br />
              "Nuevo perfil".
            </div>
          )}
        </div>

        {/* Right: matriz de permisos del perfil seleccionado */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
          {!selected ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "60%", color: "#A19F9D", fontSize: 13,
            }}>
              Selecciona un perfil para gestionar sus permisos.
            </div>
          ) : (
            <>
              {/* Cabecera del perfil seleccionado */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 16,
                padding: "16px 20px", background: "#fff",
                border: "1px solid #EDEBE9", borderRadius: 10,
                marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "#EDE0FF", display: "flex",
                  alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Layers size={20} color="#7530AF" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: "#201F1E" }}>{selected.name}</span>
                    <span style={{ fontSize: 12, color: "#7530AF", fontWeight: 600 }}>{selected.label}</span>
                    <ActiveBadge active={selected.isActive} />
                  </div>
                  {selected.description && (
                    <div style={{ fontSize: 12, color: "#605E5C", marginTop: 4 }}>
                      {selected.description}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#A19F9D", marginTop: 6, lineHeight: 1.6 }}>
                    <strong style={{ color: "#7530AF" }}>{selectedKeys.size}</strong>{" "}
                    {selectedKeys.size === 1 ? "permiso concedido" : "permisos concedidos"}.{" "}
                    Los permisos activos se suman al rol base del usuario (nunca lo revocan).
                    {!selected.isActive && (
                      <span style={{ color: "#D13438", marginLeft: 6 }}>
                        · El perfil está inactivo — no se aplica a ningún usuario.
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setModal({ open: true, mode: "edit", initial: selected })}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "6px 14px", borderRadius: 6,
                    border: "1px solid #D8B4FE", background: "#F8F0FF",
                    color: "#7530AF", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", fontFamily: F, flexShrink: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#EDE0FF")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#F8F0FF")}
                >
                  <Pencil size={12} /> Editar perfil
                </button>
              </div>

              {/* Grupos de permisos */}
              {groups.map(g => {
                const permsInGroup = byGroup(g);
                if (permsInGroup.length === 0) return null;
                const activeInGroup = permsInGroup.filter(p => selectedKeys.has(p.key)).length;
                return (
                  <div key={g} style={{
                    background: "#fff", border: "1px solid #EDEBE9",
                    borderRadius: 10, overflow: "hidden",
                    marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}>
                    {/* Cabecera del grupo */}
                    <div style={{
                      padding: "10px 18px", borderBottom: "1px solid #F3F2F1",
                      background: GROUP_BG[g],
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: GROUP_COLORS[g], flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: GROUP_COLORS[g],
                        textTransform: "uppercase", letterSpacing: "0.06em",
                      }}>
                        {g}
                      </span>
                      <span style={{ fontSize: 11, color: "#A19F9D", marginLeft: 4 }}>
                        ({activeInGroup}/{permsInGroup.length} activos)
                      </span>
                    </div>

                    {/* Filas de permisos */}
                    {permsInGroup.map((p, i) => {
                      const hasIt      = selectedKeys.has(p.key);
                      const isToggling = toggling === p.key;
                      return (
                        <div
                          key={p.key}
                          style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "12px 18px",
                            borderBottom: i < permsInGroup.length - 1 ? "1px solid #F3F2F1" : "none",
                            background: hasIt ? `${GROUP_BG[g]}88` : "#fff",
                            transition: "background 150ms",
                          }}
                        >
                          <Toggle
                            checked={hasIt}
                            onChange={() => handleTogglePerm(p.key)}
                            disabled={isToggling || !selected.isActive}
                            size="sm"
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13, fontWeight: 600,
                              color: hasIt ? "#201F1E" : "#605E5C",
                            }}>
                              {p.label}
                            </div>
                            <div style={{
                              fontSize: 10, color: "#A19F9D", marginTop: 1,
                              fontFamily: "'Cascadia Code', monospace",
                            }}>
                              {p.key}
                            </div>
                          </div>
                          {hasIt && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: "2px 8px",
                              borderRadius: 20, flexShrink: 0,
                              background: GROUP_BG[g],
                              color: GROUP_COLORS[g],
                              border: `1px solid ${GROUP_COLORS[g]}40`,
                            }}>
                              Concedido
                            </span>
                          )}
                          {isToggling && (
                            <RotateCw
                              size={13} color="#A19F9D" style={{
                                animation: "spin 1s linear infinite", flexShrink: 0,
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Modal crear/editar ── */}
      {modal.open && (
        <ProfileModal
          mode={modal.mode}
          initial={modal.initial}
          saving={modalSaving}
          onSave={handleSaveProfile}
          onCancel={() => setModal(m => ({ ...m, open: false }))}
        />
      )}

      <AdminToastContainer toasts={toasts} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
};
