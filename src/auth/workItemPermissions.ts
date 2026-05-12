// ─────────────────────────────────────────────────────────
//  src/auth/workItemPermissions.ts
//  Lógica centralizada de permisos sobre WorkItems.
//
//  Regla de ownership (OBLIGATORIA):
//    canAct = (rbacCheck) AND (ownershipCheck OR roleBypass)
//
//  ownershipCheck:
//    workItem.assignedToUserId === currentUser.id
//    OR (workItem.assignedToTeamId ∈ currentUser.teamIds
//        AND workItem.assignedToRole === currentUser.role)
//
//  roleBypass (salta RBAC + ownership):
//    - role === "Admin"
//    - role === "IT AirEuropa"
//    - adminBypass flag activo (legacy: Admin con bypass en settings)
// ─────────────────────────────────────────────────────────

import type { AppRole } from "./permissions";
import type { AppUser } from "./ImpersonationContext";
import type { WorkItem, Transition } from "../types/domain";

// ── Resultado del check ──────────────────────────────────
export interface OwnershipResult {
  /** El usuario puede actuar sobre este WorkItem */
  can: boolean;
  /** Razón legible (para tooltip / banner) si can=false */
  reason: string;
}

/** Tooltip genérico (retro-compat con LockBadge default) */
export const LOCK_TOOLTIP = "No tienes permisos para realizar esta acción";
/** Bloqueado porque ninguna transición permite el rol actual */
export const LOCK_REASON_RBAC = "RBAC: sin transiciones permitidas para tu rol desde este estado";
/** Bloqueado porque el ítem no está asignado al usuario ni a su equipo */
export const LOCK_REASON_OWNERSHIP = "Ownership: tarea no asignada a ti ni a tu equipo/rol";

/**
 * Roles que tienen bypass total sobre RBAC y ownership.
 * Exportado para uso en getAllowedTargets / handleMoveAttempt de KanbanPage.
 */
export const BYPASS_ROLES: AppRole[] = ["Admin", "IT AirEuropa"];

/**
 * Determina si `appUser` puede actuar (mover, editar, cambiar estado)
 * sobre `workItem`, combinando RBAC + ownership.
 *
 * Bypass (salta todo):
 *   - roles incluye "Admin" o "IT AirEuropa"
 *   - adminBypass = true (flag heredado de settings)
 *
 * @param appUser      Usuario efectivo (puede ser impersonated o null)
 * @param workItem     WorkItem sobre el que se quiere actuar
 * @param roles        Roles del usuario efectivo (de useAuth / useEffectiveUser)
 * @param transitions  Todas las transiciones cargadas (para check RBAC)
 * @param adminBypass  true → Admin con adminBypass activo: salta todo (legacy)
 */
export function canActOnWorkItem(
  appUser: AppUser | null | undefined,
  workItem: WorkItem,
  roles: AppRole[],
  transitions: Transition[],
  adminBypass = false,
): OwnershipResult {
  if (!appUser) {
    return { can: false, reason: "Usuario no autenticado" };
  }

  // Bypass: flag heredado O rol Admin/IT AirEuropa → salta RBAC + ownership
  if (adminBypass || BYPASS_ROLES.some((r) => roles.includes(r))) {
    return { can: true, reason: "" };
  }

  // 1. RBAC: ¿hay al menos una transición disponible desde el estado actual?
  const hasRbac = transitions.some(
    (t) =>
      t.fromStateId === workItem.stateId &&
      t.allowedRoles.some((r) => roles.includes(r as AppRole)),
  );
  if (!hasRbac) {
    return { can: false, reason: LOCK_REASON_RBAC };
  }

  // 2. Ownership check
  const uid          = appUser.id;
  const userTeamIds  = appUser.teamIds ?? [];

  const ownedByUser  = workItem.assignedToUserId === uid;
  const ownedByTeam  =
    workItem.assignedToTeamId != null &&
    userTeamIds.includes(workItem.assignedToTeamId) &&
    workItem.assignedToRole === appUser.role;

  if (!ownedByUser && !ownedByTeam) {
    return { can: false, reason: LOCK_REASON_OWNERSHIP };
  }

  return { can: true, reason: "" };
}

/**
 * Versión simplificada sin transiciones: sólo ownership.
 * Útil cuando no tienes acceso a la lista de transiciones (ej. botones de edición).
 * No comprueba RBAC.
 *
 * @param roles  Opcional — si incluye "Admin" o "IT AirEuropa", bypassa ownership.
 */
export function ownsWorkItem(
  appUser: AppUser | null | undefined,
  workItem: WorkItem,
  adminBypass = false,
  roles: AppRole[] = [],
): boolean {
  if (!appUser) return false;
  if (adminBypass || BYPASS_ROLES.some((r) => roles.includes(r))) return true;

  const uid         = appUser.id;
  const userTeamIds = appUser.teamIds ?? [];

  const ownedByUser = workItem.assignedToUserId === uid;
  const ownedByTeam =
    workItem.assignedToTeamId != null &&
    userTeamIds.includes(workItem.assignedToTeamId) &&
    workItem.assignedToRole === appUser.role;

  return ownedByUser || ownedByTeam;
}
