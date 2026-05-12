// ── AppRole ────────────────────────────────────────────────────────────────
export type AppRole = "Admin" | "IT AirEuropa" | "Proveedor" | "Usuario" | "Invitado";

/**
 * Returns true if the user holds at least one of the required roles.
 * Empty requiredRoles = visible to everyone.
 * "Invitado" is always read-only — never passes role-restricted checks.
 */
export const hasRole = (userRoles: AppRole[], requiredRoles: AppRole[]): boolean =>
  requiredRoles.length === 0 || requiredRoles.some(r => userRoles.includes(r));
