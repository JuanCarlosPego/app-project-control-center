// ─────────────────────────────────────────────────────────
//  src/services/assignmentService.ts
//
//  Servicio centralizado de validaciones y filtros de asignación.
//
//  RESPONSABILIDADES:
//  1. getAvailableTeamsForRole()  — equipos compatibles con un rol
//  2. getAvailableUsers()         — usuarios elegibles dado rol + equipo
//  3. validateAssignment()        — aplica todas las reglas de negocio
//  4. Helpers de filtro síncrono  — para validación en formularios
//
//  REGLAS DE NEGOCIO IMPLEMENTADAS:
//  A1. assignedToRole siempre obligatorio
//  A2. Si assignedToTeamId informado → assignedToUserId.teamIds debe incluirlo
//  A3. role="Proveedor" → assignedToTeamId obligatorio (type="Provider")
//       + assignedToUserId obligatorio
//  A4. role="Usuario" → assignedToTeamId recomendado (type="Area")
//  A5. role="Invitado" → NUNCA puede ser responsable (bloquear)
//  A6. Al cambiar role → limpiar assignedToUserId si ya no es válido
//
//  MODO DATAVERSE:
//  🔌 getAvailableTeamsForRole → Xrm.WebApi.retrieveMultipleRecords("pcc_team",
//       `?$filter=pcc_type eq '${teamType}' and statecode eq 0`)
//  🔌 getAvailableUsers → Xrm.WebApi.retrieveMultipleRecords("pcc_appuser",
//       `?$filter=pcc_role eq '${role}' and statecode eq 0
//        &$expand=pcc_appuser_pcc_team_pcc_appuserid($filter=pcc_teamid eq '${teamId}')`)
// ─────────────────────────────────────────────────────────

import { listTeams } from "./teamService";
import { listAppUsers } from "./userService";
import type { Team, AppUser, AppRole, TeamType } from "../types/domain";

// ── Mapeo rol → tipo de equipo esperado ──────────────────
const ROLE_TO_TEAM_TYPE: Partial<Record<AppRole, TeamType>> = {
  "Proveedor":    "Provider",
  "Usuario":      "Area",
  "IT AirEuropa": "Internal",
  "Admin":        "Internal",
};

// ── Helpers de filtro síncronos ───────────────────────────
// Usar cuando ya se tienen los datos cargados en memoria (formularios, validaciones inline).

/**
 * Filtra una lista de equipos por tipo compatible con el rol dado.
 * Uso síncrono: filterTeamsForRole(allTeams, "Proveedor") → equipos type="Provider"
 */
export function filterTeamsForRole(teams: Team[], role: AppRole): Team[] {
  const expectedType = ROLE_TO_TEAM_TYPE[role];
  if (!expectedType) return [];
  return teams.filter((t) => t.type === expectedType && t.isActive);
}

/**
 * Filtra usuarios compatibles con un rol y opcionalmente un equipo.
 * - Excluye siempre a usuarios con role="Invitado"
 * - Si teamId informado, filtra por pertenencia
 * - Si teamId vacío, filtra solo por rol
 */
export function filterUsersForAssignment(
  users: AppUser[],
  role: AppRole,
  teamId?: string | null,
): AppUser[] {
  return users.filter((u) => {
    if (u.role === "Invitado") return false;
    if (!u.isActive) return false;
    if (u.role !== role) return false;
    if (teamId) return u.teamIds.includes(teamId);
    return true;
  });
}

/**
 * Comprueba si un usuario es válido como responsable de una asignación.
 * - No puede ser Invitado
 * - Si se provee teamId, debe pertenecer a ese team
 * - Si se provee role, su role debe coincidir
 */
export function isUserEligible(
  user: AppUser,
  opts: { role?: AppRole; teamId?: string | null } = {},
): boolean {
  if (user.role === "Invitado") return false;
  if (!user.isActive) return false;
  if (opts.role && user.role !== opts.role) return false;
  if (opts.teamId && !user.teamIds.includes(opts.teamId)) return false;
  return true;
}

// ── Operaciones asíncronas ────────────────────────────────

/**
 * Devuelve los equipos elegibles para asignar según el rol seleccionado.
 *
 * - "Proveedor"    → teams de type="Provider"
 * - "Usuario"      → teams de type="Area"
 * - "IT AirEuropa" → teams de type="Internal"
 * - "Admin"        → teams de type="Internal"
 * - "Invitado"     → [] (nunca puede ser responsable)
 *
 * DATAVERSE: Xrm.WebApi.retrieveMultipleRecords("pcc_team",
 *   `?$filter=pcc_type eq '${expectedType}' and statecode eq 0`)
 */
export async function getAvailableTeamsForRole(role: AppRole): Promise<Team[]> {
  if (role === "Invitado") return [];
  const expectedType = ROLE_TO_TEAM_TYPE[role];
  if (!expectedType) return [];
  return listTeams({ type: expectedType, isActive: true });
}

/**
 * Devuelve los usuarios elegibles para una asignación dado el rol y el equipo.
 *
 * - Filtra por role == assignedToRole
 * - Si teamId informado, filtra por pertenencia al equipo (user.teamIds incluye teamId)
 * - Nunca incluye usuarios con role="Invitado" o inactivos
 *
 * DATAVERSE: Xrm.WebApi.retrieveMultipleRecords("pcc_appuser",
 *   `?$filter=pcc_role eq '${role}' and statecode eq 0
 *    &$expand=pcc_team($filter=pcc_teamid eq '${teamId}')`)
 */
export async function getAvailableUsers(
  role: AppRole,
  teamId?: string | null,
): Promise<AppUser[]> {
  if (role === "Invitado") return [];
  const params = {
    role,
    isActive: true,
    ...(teamId ? { teamId } : {}),
  };
  return listAppUsers(params);
}

// ── Validación completa de asignación ────────────────────

export interface AssignmentTarget {
  assignedToRole: AppRole;
  assignedToTeamId?: string | null;
  assignedToUserId?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida una asignación completa contra todas las reglas de negocio.
 *
 * Puede recibir las colecciones ya cargadas (teams, users) para evitar llamadas
 * adicionales a la API, o cargarlas internamente si se omiten.
 *
 * @param target         - Datos de asignación a validar
 * @param allTeams       - Lista de equipos (opcional, se carga si no se provee)
 * @param allUsers       - Lista de usuarios (opcional, se carga si no se provee)
 *
 * @returns ValidationResult { ok, errors[], warnings[] }
 *
 * DATAVERSE: misma lógica — los datos vendrán de retrieveMultipleRecords
 */
export async function validateAssignment(
  target: AssignmentTarget,
  allTeams?: Team[],
  allUsers?: AppUser[],
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { assignedToRole, assignedToTeamId, assignedToUserId } = target;

  // ── Regla A1: rol siempre obligatorio ─────────────────
  if (!assignedToRole) {
    errors.push("El rol asignado es obligatorio.");
    return { ok: false, errors, warnings };
  }

  // ── Regla A5: Invitado nunca puede ser responsable ────
  if (assignedToRole === "Invitado") {
    errors.push("Un usuario con rol 'Invitado' no puede ser responsable de una tarea.");
    return { ok: false, errors, warnings };
  }

  // Cargar datos si no se proveyeron
  const teams = allTeams ?? await listTeams({ isActive: true });
  const users = allUsers ?? await listAppUsers({ isActive: true });

  // ── Regla A3: Proveedor → teamId y userId obligatorios ─
  if (assignedToRole === "Proveedor") {
    if (!assignedToTeamId) {
      errors.push("Para rol 'Proveedor' el equipo (assignedToTeamId) es obligatorio.");
    } else {
      const team = teams.find((t) => t.id === assignedToTeamId);
      if (!team) {
        errors.push(`El equipo '${assignedToTeamId}' no existe.`);
      } else if (team.type !== "Provider") {
        errors.push(`El equipo '${team.name}' debe ser de tipo 'Provider' para rol Proveedor.`);
      } else if (!team.isActive) {
        errors.push(`El equipo '${team.name}' está inactivo.`);
      }
    }
    if (!assignedToUserId) {
      errors.push("Para rol 'Proveedor' el usuario asignado (assignedToUserId) es obligatorio.");
    }
  }

  // ── Regla A4: Usuario → teamId recomendado ────────────
  if (assignedToRole === "Usuario" && !assignedToTeamId) {
    warnings.push("Se recomienda especificar el equipo de área para rol 'Usuario'.");
  }

  // ── Regla A2: si teamId → usuario debe pertenecer a él ─
  if (assignedToTeamId && assignedToUserId) {
    const user = users.find((u) => u.id === assignedToUserId);
    if (!user) {
      errors.push(`El usuario '${assignedToUserId}' no existe o no está activo.`);
    } else {
      if (!user.teamIds.includes(assignedToTeamId)) {
        const team = teams.find((t) => t.id === assignedToTeamId);
        errors.push(
          `El usuario '${user.displayName}' no pertenece al equipo '${team?.name ?? assignedToTeamId}'.`,
        );
      }
      if (user.role !== assignedToRole) {
        errors.push(
          `El usuario '${user.displayName}' tiene rol '${user.role}', no '${assignedToRole}'.`,
        );
      }
      // ── Regla A5 en usuario concreto ──────────────────
      if (user.role === "Invitado") {
        errors.push(`El usuario '${user.displayName}' tiene rol 'Invitado' y no puede ser responsable.`);
      }
    }
  } else if (!assignedToTeamId && assignedToUserId) {
    // Sin teamId pero con userId: validar solo rol
    const user = users.find((u) => u.id === assignedToUserId);
    if (!user) {
      errors.push(`El usuario '${assignedToUserId}' no existe o no está activo.`);
    } else if (user.role !== assignedToRole) {
      errors.push(
        `El usuario '${user.displayName}' tiene rol '${user.role}', no '${assignedToRole}'.`,
      );
    } else if (user.role === "Invitado") {
      errors.push(`El usuario '${user.displayName}' tiene rol 'Invitado' y no puede ser responsable.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Versión síncrona de validateAssignment para uso en formularios con datos
 * ya cargados en memoria. No realiza llamadas de red.
 */
export function validateAssignmentSync(
  target: AssignmentTarget,
  allTeams: Team[],
  allUsers: AppUser[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { assignedToRole, assignedToTeamId, assignedToUserId } = target;

  if (!assignedToRole) {
    errors.push("El rol asignado es obligatorio.");
    return { ok: false, errors, warnings };
  }

  if (assignedToRole === "Invitado") {
    errors.push("Un usuario con rol 'Invitado' no puede ser responsable de una tarea.");
    return { ok: false, errors, warnings };
  }

  if (assignedToRole === "Proveedor") {
    if (!assignedToTeamId) {
      errors.push("Para rol 'Proveedor' el equipo es obligatorio.");
    } else {
      const team = allTeams.find((t) => t.id === assignedToTeamId);
      if (!team) errors.push(`El equipo '${assignedToTeamId}' no existe.`);
      else if (team.type !== "Provider") errors.push(`Equipo '${team.name}' debe ser de tipo 'Provider'.`);
      else if (!team.isActive) errors.push(`Equipo '${team.name}' está inactivo.`);
    }
    if (!assignedToUserId) {
      errors.push("Para rol 'Proveedor' el usuario asignado es obligatorio.");
    }
  }

  if (assignedToRole === "Usuario" && !assignedToTeamId) {
    warnings.push("Se recomienda especificar el equipo de área para rol 'Usuario'.");
  }

  if (assignedToUserId) {
    const user = allUsers.find((u) => u.id === assignedToUserId);
    if (!user) {
      errors.push(`El usuario '${assignedToUserId}' no existe o no está activo.`);
    } else {
      if (user.role !== assignedToRole) {
        errors.push(`El usuario '${user.displayName}' tiene rol '${user.role}', no '${assignedToRole}'.`);
      }
      if (user.role === "Invitado") {
        errors.push(`El usuario '${user.displayName}' tiene rol 'Invitado' y no puede ser responsable.`);
      }
      if (assignedToTeamId && !user.teamIds.includes(assignedToTeamId)) {
        const team = allTeams.find((t) => t.id === assignedToTeamId);
        errors.push(`'${user.displayName}' no pertenece al equipo '${team?.name ?? assignedToTeamId}'.`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
