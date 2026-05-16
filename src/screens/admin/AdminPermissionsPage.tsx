// ─────────────────────────────────────────────────────────
//  src/screens/admin/AdminPermissionsPage.tsx
//  Pantalla /admin/permissions — Matriz RBAC de permisos
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck, RefreshCw, RotateCw,
} from "lucide-react";
import {
  getRolePermissions, patchRolePermission, resetRolePermissions,
  type RolePermissionsPayload,
} from "../../services/adminService";
import { invalidatePermissionCache } from "../../auth/usePermission";
import type { RbacPermission, RolePermissionsMap } from "../../types/domain";
import {
  Toggle, InfoBanner, AdminToastContainer, PageHeader,
  newAdminToast, type ToastMsg,
} from "./components/shared";

// ── Roles en orden de columna ─────────────────────────────
const ROLES = [
  "Admin",
  "IT AirEuropa",
  "Proveedor",
  "Usuario",
  "Invitado",
];

const ROLE_LABELS: Record<string, string> = {
  "Admin":        "Administrador",
  "IT AirEuropa": "IT Air Europa",
  "Proveedor":    "Proveedor",
  "Usuario":      "Usuario",
  "Invitado":     "Invitado",
};

// ── Claves inmutables para Invitado (solo lectura de escritura) ──
const WRITE_KEYS = new Set([
  "TASK_CREATE", "TASK_EDIT", "TASK_CLOSE", "TASK_REOPEN",
  "TASK_VIEW_ALL",
  "TRANS_NEW_PROG", "TRANS_PROG_RFT", "TRANS_RFT_TEST",
  "TRANS_TEST_CLS", "TRANS_BLOCK", "TRANS_UNBLOCK",
]);

const isDisabled = (role: string, key: string): boolean => {
  if (role === "Admin") return true;
  if (role === "Invitado" && WRITE_KEYS.has(key)) return true;
  return false;
};

// ── Colores de cabecera por rol ───────────────────────────
const ROLE_ACCENT: Record<string, { bg: string; color: string }> = {
  "Admin":        { bg: "#EFF6FC", color: "#0078D4" },
  "IT AirEuropa": { bg: "#F3FBF5", color: "#107C10" },
  "Proveedor":    { bg: "#FAF9F8", color: "#605E5C" },
  "Usuario":      { bg: "#FAF9F8", color: "#605E5C" },
  "Invitado":     { bg: "#FEF9F0", color: "#CA8B00" },
};

const GROUP_COLORS: Record<"TAREAS" | "TRANSICIONES" | "VISTAS", string> = {
  TAREAS:      "#0078D4",
  TRANSICIONES:"#7530AF",
  VISTAS:      "#107C10",
};

// ── Confirmación modal mínima ─────────────────────────────
const ConfirmDialog: React.FC<{
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 4000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: "28px 32px",
        maxWidth: 420, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        fontFamily: "'Segoe UI', sans-serif",
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#201F1E", margin: "0 0 10px" }}>
          ¿Restaurar permisos por defecto?
        </h2>
        <p style={{ fontSize: 13, color: "#605E5C", margin: "0 0 24px", lineHeight: 1.6 }}>
          Esta acción sobreescribirá la matriz RBAC completa con los valores predeterminados del sistema.
          Los cambios se registrarán en el log de auditoría.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "1px solid #EDEBE9",
              background: "#fff", color: "#201F1E", fontSize: 13, cursor: "pointer",
              fontFamily: "'Segoe UI', sans-serif", fontWeight: 600,
            }}
          >Cancelar</button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 20px", borderRadius: 6, border: "none",
              background: "#D13438", color: "#fff", fontSize: 13, cursor: "pointer",
              fontFamily: "'Segoe UI', sans-serif", fontWeight: 600,
            }}
          >Restaurar</button>
        </div>
      </div>
    </div>
  );
};

// ── AdminPermissionsPage ──────────────────────────────────
export const AdminPermissionsPage: React.FC = () => {
  const [permissions,      setPermissions]      = useState<RbacPermission[]>([]);
  const [rolePermissions,  setRolePermissions]  = useState<RolePermissionsMap>({});
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [toasts,           setToasts]           = useState<ToastMsg[]>([]);
  const [confirmOpen,      setConfirmOpen]      = useState(false);
  const [resetting,        setResetting]        = useState(false);

  // ── Toasts ──────────────────────────────────────────────
  const addToast = useCallback((text: string, ok = true) => {
    const t = newAdminToast(text, ok);
    setToasts((prev) => [...prev, t]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 2800);
  }, []);

  // ── Carga inicial ───────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    getRolePermissions()
      .then((payload: RolePermissionsPayload) => {
        setPermissions(payload.permissions);
        setRolePermissions(payload.rolePermissions);
      })
      .catch(() => setError("No se pudieron cargar los permisos."))
      .finally(() => setLoading(false));
  }, []);

  // ── Toggle individual ───────────────────────────────────
  const handleToggle = useCallback(async (
    role: string, key: string, currentVal: boolean,
  ) => {
    const next = !currentVal;
    // optimistic
    setRolePermissions((prev) => ({
      ...prev,
      [role]: { ...prev[role], [key]: next },
    }));
    try {
      const updated = await patchRolePermission(role, key, next);
      setRolePermissions(updated as RolePermissionsMap);
      invalidatePermissionCache();
      addToast(`'${role}' · ${key} → ${next ? "ON" : "OFF"}`);
    } catch (e: unknown) {
      // rollback
      setRolePermissions((prev) => ({
        ...prev,
        [role]: { ...prev[role], [key]: currentVal },
      }));
      const msg = (e instanceof Error) ? e.message : "Error al guardar.";
      addToast(msg, false);
    }
  }, [addToast]);

  // ── Restaurar defaults ──────────────────────────────────
  const handleReset = useCallback(async () => {
    setConfirmOpen(false);
    setResetting(true);
    try {
      const updated = await resetRolePermissions();
      setRolePermissions(updated as RolePermissionsMap);
      invalidatePermissionCache();
      addToast("Permisos restaurados a los valores por defecto.");
    } catch {
      addToast("Error al restaurar permisos.", false);
    } finally {
      setResetting(false);
    }
  }, [addToast]);

  // ── Agrupar permisos ────────────────────────────────────
  const groups: Array<"TAREAS" | "TRANSICIONES" | "VISTAS"> = ["TAREAS", "TRANSICIONES", "VISTAS"];
  const byGroup = (g: "TAREAS" | "TRANSICIONES" | "VISTAS") =>
    permissions.filter((p) => p.group === g);

  // ── Render guards ───────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
      <RotateCw size={24} color="#0078D4" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: 32, color: "#A4262C", fontFamily: "'Segoe UI', sans-serif", fontSize: 13 }}>
      {error}
    </div>
  );

  // ── Column widths ───────────────────────────────────────
  const PERM_COL = 210;
  const ROLE_COL = 110;

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#FAF9F8", overflow: "hidden",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <PageHeader
        title="Permisos RBAC"
        subtitle="Matriz de permisos por rol"
        icon={<ShieldCheck size={18} />}
        actions={
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={resetting}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, color: resetting ? "#A19F9D" : "#D13438",
              fontWeight: 600, background: resetting ? "#F3F2F1" : "#FDE7E9",
              border: `1px solid ${resetting ? "#EDEBE9" : "#F4B8BB"}`,
              borderRadius: 6, padding: "6px 14px", cursor: resetting ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={12} style={resetting ? { animation: "spin 1s linear infinite" } : {}} />
            Restaurar por defecto
          </button>
        }
      />

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>

        {/* Info banner */}
        <InfoBanner items={[
          "Los permisos se aplican por rol, nunca por usuario individual.",
          "El rol ADMIN siempre tiene acceso completo — su columna es de solo lectura.",
          "El rol INVITADO es de solo lectura: los permisos de edición están bloqueados por diseño.",
          "Todos los cambios quedan registrados en el log de Auditoría.",
        ]} />

        {/* Banner: Perfiles de permisos */}
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "12px 16px", marginBottom: 16,
          background: "#F8F0FF", border: "1px solid #D8B4FE", borderRadius: 8,
          fontFamily: "'Segoe UI', sans-serif",
        }}>
          <div style={{
            width: 32, height: 32, background: "#EDE0FF", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <span style={{ fontSize: 16 }}>🪪</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#7530AF", marginBottom: 3 }}>
              ¿Necesitas permisos extra para un usuario concreto?
            </div>
            <div style={{ fontSize: 12, color: "#605E5C", lineHeight: 1.6 }}>
              Esta pantalla gestiona la <strong>matriz de permisos por rol</strong>. Si necesitas otorgar
              permisos adicionales a un usuario específico (ej. que un Usuario pueda crear solicitudes),
              usa los <strong>Perfiles de permisos</strong>: asígnalos desde{" "}
              <strong>Administración → Gestión de Usuarios → Editar usuario → Perfiles adicionales</strong>.
            </div>
          </div>
        </div>

        {/* Matrix table */}
        <div style={{
          background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
          overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          {/* Sticky column headers */}
          <div style={{
            display: "flex", position: "sticky", top: 0, zIndex: 10,
            borderBottom: "2px solid #EDEBE9", background: "#FAFAFA",
          }}>
            {/* Permiso col */}
            <div style={{
              width: PERM_COL, flexShrink: 0, padding: "11px 16px",
              fontSize: 11, fontWeight: 700, color: "#A19F9D",
              textTransform: "uppercase", letterSpacing: "0.06em",
              borderRight: "1px solid #EDEBE9",
            }}>
              Permiso
            </div>
            {/* Role cols */}
            {ROLES.map((role) => {
              const a = ROLE_ACCENT[role] ?? { bg: "#FAF9F8", color: "#201F1E" };
              return (
                <div key={role} style={{
                  width: ROLE_COL, flexShrink: 0, flexGrow: 1,
                  padding: "11px 0", textAlign: "center",
                  fontSize: 11, fontWeight: 700,
                  background: a.bg, color: a.color,
                  letterSpacing: "0.04em",
                  borderRight: "1px solid #EDEBE9",
                }}>
                  {ROLE_LABELS[role] ?? role}
                  {role === "Admin" && (
                    <div style={{ fontSize: 9, color: "#0078D4", fontWeight: 600, marginTop: 1 }}>
                      SIEMPRE ON
                    </div>
                  )}
                  {role === "Invitado" && (
                    <div style={{ fontSize: 9, color: "#CA8B00", fontWeight: 600, marginTop: 1 }}>
                      SOLO VISTAS
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Groups */}
          {groups.map((group) => {
            const perms = byGroup(group);
            const accent = GROUP_COLORS[group];
            return (
              <React.Fragment key={group}>
                {/* Group separator */}
                <div style={{
                  display: "flex", background: "#F3F2F1",
                  borderBottom: "1px solid #EDEBE9",
                  borderTop: "2px solid " + accent,
                }}>
                  <div style={{
                    padding: "6px 16px",
                    fontSize: 10, fontWeight: 700, color: accent,
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    fontFamily: "'Segoe UI', sans-serif",
                  }}>
                    {group}
                  </div>
                </div>

                {/* Permission rows */}
                {perms.map((perm, idx) => (
                  <div key={perm.key} style={{
                    display: "flex",
                    background: idx % 2 === 0 ? "#fff" : "#FAFAFA",
                    borderBottom: "1px solid #F3F2F1",
                    minHeight: 48,
                  }}>
                    {/* Label */}
                    <div style={{
                      width: PERM_COL, flexShrink: 0,
                      padding: "0 16px",
                      display: "flex", flexDirection: "column", justifyContent: "center",
                      borderRight: "1px solid #EDEBE9",
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#201F1E" }}>
                        {perm.label}
                      </div>
                      <div style={{ fontSize: 10, color: "#A19F9D", marginTop: 1 }}>
                        {perm.key}
                      </div>
                    </div>

                    {/* Toggle cells */}
                    {ROLES.map((role) => {
                      const val = rolePermissions[role]?.[perm.key] ?? false;
                      const disabled = isDisabled(role, perm.key);
                      return (
                        <div key={role} style={{
                          width: ROLE_COL, flexShrink: 0, flexGrow: 1,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          borderRight: "1px solid #F3F2F1",
                          background: disabled && !val ? "transparent" : "transparent",
                        }}>
                          <Toggle
                            checked={val}
                            onChange={() => handleToggle(role, perm.key, val)}
                            disabled={disabled}
                            size="sm"
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>

        {/* Leyenda */}
        <div style={{
          display: "flex", gap: 20, marginTop: 14, padding: "10px 0",
          borderTop: "1px solid #EDEBE9",
        }}>
          {[
            { label: "Activo", color: "#0078D4" },
            { label: "Inactivo", color: "#BEBBB8" },
            { label: "Bloqueado (inmutable)", color: "#C8C6C4" },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 24, height: 12, background: color, borderRadius: 6 }} />
              <span style={{ fontSize: 11, color: "#605E5C" }}>{label}</span>
            </div>
          ))}
        </div>

      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onConfirm={handleReset}
        onCancel={() => setConfirmOpen(false)}
      />

      <AdminToastContainer toasts={toasts} />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
