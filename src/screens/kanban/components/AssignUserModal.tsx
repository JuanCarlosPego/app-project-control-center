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
import type { AppRole, User, Project } from "../../../types/domain";
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
  /** Rol nuevo que debe tener el usuario asignado */
  newRole: AppRole;
  /** Proyecto al que pertenece el WorkItem (para filtrar por providerId) */
  project: Project | undefined;
  /** Lista de usuarios del sistema (User[]) */
  users: User[];
  /** Nombre del estado destino (para el título) */
  toStateName: string;
  /** Nombre del estado origen */
  fromStateName: string;
  /** Callback con el userId seleccionado */
  onConfirm: (assignedToUserId: string) => void;
  /** Cancelar — revierte el drag */
  onCancel: () => void;
}

export const AssignUserModal: React.FC<AssignUserModalProps> = ({
  newRole, project, users, toStateName, fromStateName, onConfirm, onCancel,
}) => {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState("");

  // Filtrar usuarios elegibles
  const eligible = useMemo(() => {
    return users.filter((u) => {
      // Guardia defensiva: en runtime el mock devuelve User con roles[].
      // Si por alguna razón llega un AppUser (role singular), lo normalizamos.
      const uRoles: string[] = u.roles ?? [(u as unknown as { role?: string }).role ?? ""];
      if (!uRoles.includes(newRole)) return false;
      // Si es Proveedor: debe pertenecer al equipo proveedor del proyecto
      if (newRole === "Proveedor" && project?.providerTeamId) {
        const userTeamIds: string[] = (u as unknown as { teamIds?: string[] }).teamIds ?? [];
        if (!userTeamIds.includes(project.providerTeamId)) return false;
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

  const roleStyle = ROLE_COLORS[newRole] ?? { bg: "#F3F2F1", text: "#323130" };
  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.40)",
          zIndex: 39,
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
          zIndex: 40,
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
          {/* Rol nuevo */}
          <div style={{
            display: "flex", alignItems: "center", gap: spacing[2],
            marginBottom: spacing[5],
            padding: `${spacing[3]}px ${spacing[4]}px`,
            background: roleStyle.bg, borderRadius: radius.sm,
            border: `1px solid ${roleStyle.text}22`,
          }}>
            <span style={{
              fontSize: font.size.xs, fontWeight: font.weight.semibold,
              color: roleStyle.text,
            }}>
              Nuevo rol asignado:
            </span>
            <span style={{
              fontSize: font.size.sm, fontWeight: font.weight.bold,
              color: roleStyle.text,
            }}>
              {newRole}
            </span>
            {project && newRole === "Proveedor" && (
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
              No hay usuarios disponibles con el rol "{newRole}"
              {newRole === "Proveedor" && project?.providerId
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

              {/* Lista de opciones como cards clicables */}
              <div style={{
                display: "flex", flexDirection: "column", gap: spacing[2],
                maxHeight: 220, overflowY: "auto",
              }}>
                {eligible.map((u) => {
                  const isSelected = selectedUserId === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => { setSelectedUserId(u.id); setError(""); }}
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
                })}
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
