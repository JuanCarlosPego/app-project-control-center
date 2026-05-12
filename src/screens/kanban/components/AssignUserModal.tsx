// ─────────────────────────────────────────────────────────
//  src/screens/kanban/components/AssignUserModal.tsx
//  Modal de reasignación de usuario.
//  Se muestra cuando una transición implica cambio de rol.
//
//  REGLAS:
//  - assignedToUserId debe tener user.role == newRole
//  - Si newRole == "Proveedor": user.providerId == project.providerId
//  - Confirmación obligatoria — no puede cerrar sin seleccionar
// ─────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from "react";
import { UserCheck, AlertTriangle, X, ChevronDown } from "lucide-react";
import type { AppRole, AppUser, Project } from "../../../types/domain";
import { color, font, radius, shadow, spacing, zIndex } from "../../../components/ui/tokens";

// ── Helpers de iniciales ──────────────────────────────────
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// ── Avatar pequeño ────────────────────────────────────────
const Avatar: React.FC<{ name: string; size?: number }> = ({ name, size = 28 }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%",
    background: color.primaryBg, color: color.primary,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.4, fontWeight: font.weight.semibold,
    flexShrink: 0,
    border: `1px solid ${color.border}`,
  }}>
    {initials(name)}
  </div>
);

// ── Chip de rol ───────────────────────────────────────────
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  "Admin":        { bg: "#EFF6FC", text: "#0078D4" },
  "IT AirEuropa": { bg: "#E1EFDD", text: "#107C10" },
  "Proveedor":    { bg: "#FDF4FF", text: "#9333EA" },
  "Usuario":      { bg: "#FFF4CE", text: "#835B00" },
};

// ── Props ─────────────────────────────────────────────────
export interface AssignUserModalProps {
  /** Roles a los que se puede asignar (uno o varios) */
  newRole: AppRole[];
  /** Proyecto al que pertenece el WorkItem (para filtrar por providerId) */
  project: Project | undefined;
  /** Lista de usuarios del sistema (AppUser[]) */
  users: AppUser[];
  /** Nombre del estado destino (para el título) */
  toStateName: string;
  /** Nombre del estado origen */
  fromStateName: string;
  /** Callback con el userId seleccionado */
  onConfirm: (assignedToUserId: string) => void;
  /** Cancelar — revierte el drag */
  onCancel: () => void;
}

// ── Tarjeta de usuario seleccionable ─────────────────────
const UserCard: React.FC<{
  u: AppUser;
  isSelected: boolean;
  onSelect: (id: string) => void;
}> = ({ u, isSelected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(u.id)}
    style={{
      display: "flex", alignItems: "center", gap: spacing[3],
      padding: `${spacing[3]}px ${spacing[4]}px`,
      background: isSelected ? color.primaryBg : color.surface,
      border: `1.5px solid ${isSelected ? color.primary : color.border}`,
      borderRadius: radius.sm,
      cursor: "pointer",
      textAlign: "left",
      transition: "all 140ms",
      boxShadow: isSelected ? `0 0 0 2px ${color.primary}33` : "none",
      width: "100%",
    }}
  >
    <Avatar name={u.displayName} />
    <div style={{ flex: 1 }}>
      <div style={{
        fontSize: font.size.sm, fontWeight: font.weight.medium,
        color: isSelected ? color.primary : color.text,
      }}>
        {u.displayName}
      </div>
      <div style={{ fontSize: font.size.xs, color: color.textMuted }}>
        {u.email}
      </div>
    </div>
    {isSelected && (
      <div style={{
        width: 16, height: 16, borderRadius: "50%",
        background: color.primary,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )}
  </button>
);

export const AssignUserModal: React.FC<AssignUserModalProps> = ({
  newRole, project, users, toStateName, fromStateName, onConfirm, onCancel,
}) => {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");

  // Filtrar usuarios elegibles (cualquier rol del array)
  const eligible = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = newRole.some((r) => u.role === r);
      if (!matchesRole) return false;
      // Si incluye Proveedor y el usuario es Proveedor: filtrar por team del proyecto
      if (newRole.includes("Proveedor") && u.role === "Proveedor" && project?.providerTeamId) {
        if (!(u.teamIds ?? []).includes(project.providerTeamId)) return false;
      }
      return true;
    });
  }, [users, newRole, project]);

  // Si solo hay 1 elegible, preseleccionarlo
  useEffect(() => {
    if (eligible.length === 1) setSelectedUserId(eligible[0].id);
  }, [eligible]);

  // Cerrar con Escape — pero solo si hay al menos 1 elegible (si no, forzar selección)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  const handleConfirm = () => {
    if (!selectedUserId) {
      setError("Debes seleccionar un usuario para continuar.");
      return;
    }
    onConfirm(selectedUserId);
  };

  const roleLabel = newRole.join(" / ");
  const roleStyle = ROLE_COLORS[newRole[0]] ?? { bg: "#F3F2F1", text: "#323130" };
  const selectedUser = users.find((u) => u.id === selectedUserId);

  // Agrupar elegibles por rol (para mostrar secciones cuando hay varios roles)
  const eligibleByRole = useMemo(() => {
    if (newRole.length <= 1) return null; // lista plana
    const groups: Array<{ role: AppRole; users: typeof eligible }> = [];
    for (const role of newRole) {
      const group = eligible.filter((u) => u.role === role);
      if (group.length > 0) groups.push({ role, users: group });
    }
    return groups.length > 1 ? groups : null; // si quedan <2 grupos con usuarios, lista plana
  }, [eligible, newRole]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.40)",
          zIndex: 950,
        }}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Asignar usuario"
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: 440, maxWidth: "95vw",
          background: color.surface,
          borderRadius: radius.lg,
          boxShadow: shadow.xl,
          zIndex: 951,
          fontFamily: "'Segoe UI', sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: `${spacing[5]}px ${spacing[6]}px ${spacing[4]}px`,
          borderBottom: `1px solid ${color.border}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", gap: spacing[3], alignItems: "center" }}>
            <UserCheck size={18} color={color.primary} />
            <div>
              <div style={{ fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.text }}>
                Asignar usuario
              </div>
              <div style={{ fontSize: font.size.xs, color: color.textMuted, marginTop: 2 }}>
                {fromStateName} → <strong style={{ color: color.text }}>{toStateName}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              border: `1px solid ${color.border}`, borderRadius: radius.sm,
              background: "transparent", cursor: "pointer",
              color: color.textMuted, width: 26, height: 26,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: `${spacing[5]}px ${spacing[6]}px` }}>
          {/* Rol(es) nuevo(s) */}
          <div style={{
            display: "flex", alignItems: "center", gap: spacing[2],
            flexWrap: "wrap",
            marginBottom: spacing[5],
            padding: `${spacing[3]}px ${spacing[4]}px`,
            background: "#F8F8F8", borderRadius: radius.sm,
            border: `1px solid #EDEBE9`,
          }}>
            <span style={{
              fontSize: font.size.xs, fontWeight: font.weight.semibold,
              color: color.textSecondary, whiteSpace: "nowrap",
            }}>
              Nuevo rol asignado:
            </span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {newRole.map((r) => {
                const rs = ROLE_COLORS[r] ?? { bg: "#F3F2F1", text: "#323130" };
                return (
                  <span key={r} style={{
                    fontSize: 10, padding: "2px 8px", borderRadius: 4,
                    background: rs.bg, color: rs.text,
                    fontWeight: font.weight.semibold, border: `1px solid ${rs.text}33`,
                  }}>{r}</span>
                );
              })}
            </div>
            {project && newRole.includes("Proveedor") && (
              <span style={{ fontSize: font.size.xs, color: color.textMuted, marginLeft: "auto" }}>
                Proveedor del proyecto
              </span>
            )}
          </div>

          {/* Sin usuarios elegibles */}
          {eligible.length === 0 && (
            <div style={{
              padding: `${spacing[4]}px`,
              background: color.dangerBg,
              border: `1px solid ${color.dangerBorder}`,
              borderRadius: radius.sm,
              display: "flex", gap: spacing[2], alignItems: "flex-start",
              fontSize: font.size.sm, color: color.danger,
            }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              No hay usuarios disponibles con el rol "{roleLabel}"
              {newRole.includes("Proveedor") && project?.providerId
                ? ` para el proveedor del proyecto.`
                : `.`}
            </div>
          )}

          {/* Select usuario */}
          {eligible.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
              <label style={{
                fontSize: font.size.xs, fontWeight: font.weight.semibold,
                color: color.textSecondary,
              }}>
                Selecciona un usuario <span style={{ color: color.danger }}>*</span>
              </label>

              {/* Lista agrupada por rol (multi-rol) o plana (un solo rol) */}
              <div style={{
                display: "flex", flexDirection: "column", gap: spacing[2],
                maxHeight: 280, overflowY: "auto",
              }}>
                {eligibleByRole
                  ? eligibleByRole.map(({ role, users: groupUsers }) => {
                      const rs = ROLE_COLORS[role] ?? { bg: "#F3F2F1", text: "#323130" };
                      return (
                        <div key={role}>
                          {/* Separador de grupo */}
                          <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            marginBottom: 6, marginTop: 4,
                          }}>
                            <span style={{
                              fontSize: 10, padding: "1px 8px", borderRadius: 4,
                              background: rs.bg, color: rs.text,
                              fontWeight: 700, border: `1px solid ${rs.text}33`,
                              flexShrink: 0,
                            }}>{role}</span>
                            <div style={{ flex: 1, height: 1, background: "#EDEBE9" }} />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
                            {groupUsers.map((u) => <UserCard key={u.id} u={u} isSelected={selectedUserId === u.id} onSelect={(id) => { setSelectedUserId(id); setError(""); }} />)}
                          </div>
                        </div>
                      );
                    })
                  : eligible.map((u) => <UserCard key={u.id} u={u} isSelected={selectedUserId === u.id} onSelect={(id) => { setSelectedUserId(id); setError(""); }} />)
                }
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: "flex", alignItems: "center", gap: spacing[2],
                  fontSize: font.size.xs, color: color.danger,
                }}>
                  <AlertTriangle size={11} /> {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: `${spacing[4]}px ${spacing[6]}px`,
          borderTop: `1px solid ${color.border}`,
          display: "flex", justifyContent: "flex-end", gap: spacing[3],
        }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: `6px ${spacing[4]}px`,
              border: `1px solid ${color.border}`,
              borderRadius: radius.sm,
              background: color.surface,
              color: color.textSecondary,
              fontSize: font.size.sm, fontWeight: font.weight.medium,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={eligible.length === 0}
            style={{
              padding: `6px ${spacing[5]}px`,
              border: "none",
              borderRadius: radius.sm,
              background: eligible.length === 0 ? color.border : color.primary,
              color: eligible.length === 0 ? color.textMuted : "#fff",
              fontSize: font.size.sm, fontWeight: font.weight.semibold,
              cursor: eligible.length === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: spacing[2],
            }}
          >
            <UserCheck size={13} />
            {selectedUser ? `Asignar a ${selectedUser.displayName.split(" ")[0]}` : "Confirmar asignación"}
          </button>
        </div>
      </div>
    </>
  );
};
