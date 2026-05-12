// ─────────────────────────────────────────────────────────
//  src/services/userService.ts
//
//  Servicio unificado de usuarios de la aplicación.
//  Incluye filtro por teamId para las selecciones en cascada de asignación.
//
//  Modo MOCK (VITE_USE_MOCKS=true):
//    MSW intercepta /api/app-users → store en memoria sobre db.json
//
//  Modo DATAVERSE (VITE_USE_MOCKS=false):
//    🔌 Reemplazar apiClient por Xrm.WebApi:
//      Xrm.WebApi.retrieveMultipleRecords("pcc_appuser",
//        "$filter=pcc_role eq 'Proveedor' and pcc_isactive eq true
//         &$expand=pcc_appuser_pcc_team_pcc_appuserid($filter=pcc_teamid eq 'xxx')")
//
//  NOTA: Este servicio es diferente a userManagementService.ts, que está orientado
//  al panel de administración (admin/users). userService.ts está orientado a los
//  selectores de asignación y people-pickers en formularios de WorkItem/Project.
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { AppUser, AppRole } from "../types/domain";

// ── Parámetros de consulta ────────────────────────────────
export interface ListAppUsersParams {
  /** Búsqueda textual sobre displayName o email */
  query?: string;
  /** Filtrar por rol exacto */
  role?: AppRole;
  /**
   * Filtrar por team: devuelve solo usuarios cuyo teamIds incluye este teamId.
   * Clave para la selección en cascada: primero elige rol → luego team → luego usuario.
   */
  teamId?: string;
  /** Si se omite devuelve todos; true = activos, false = inactivos */
  isActive?: boolean;
}

// ── Payloads ──────────────────────────────────────────────
export interface CreateAppUserPayload {
  displayName: string;
  email: string;
  upn: string;
  role: AppRole;
  /** Equipos a los que pertenece (requerido al menos 1 para role="Proveedor") */
  teamIds: string[];
}

export interface UpdateAppUserPayload {
  role?: AppRole;
  teamIds?: string[];
  isActive?: boolean;
}

// ── Operaciones ───────────────────────────────────────────

/**
 * Lista usuarios de la aplicación con filtros opcionales.
 *
 * Uso típico en selección en cascada:
 *   1. listAppUsers({ role: "Proveedor", teamId: project.providerTeamId, isActive: true })
 *   2. listAppUsers({ role: "Usuario",   teamId: "team-dirops",          isActive: true })
 *
 * DATAVERSE:
 *   Xrm.WebApi.retrieveMultipleRecords("pcc_appuser",
 *     `?$filter=pcc_role eq '${params.role}' and pcc_isactive eq true
 *      &$expand=pcc_appuser_team_rel($filter=pcc_teamid eq '${params.teamId}')`)
 */
export const listAppUsers = (params: ListAppUsersParams = {}): Promise<AppUser[]> => {
  const q = new URLSearchParams();
  if (params.query    !== undefined) q.set("query",    params.query);
  if (params.role     !== undefined) q.set("role",     params.role);
  if (params.teamId   !== undefined) q.set("teamId",   params.teamId);
  if (params.isActive !== undefined) q.set("isActive", String(params.isActive));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return apiClient.get<AppUser[]>(`/app-users${qs}`);
};

/**
 * Obtiene un usuario por ID.
 * DATAVERSE: Xrm.WebApi.retrieveRecord("pcc_appuser", id, "?$select=...")
 */
export const getAppUserById = (id: string): Promise<AppUser> =>
  apiClient.get<AppUser>(`/app-users/${id}`);

/**
 * Crea un usuario de la aplicación.
 * DATAVERSE: Xrm.WebApi.createRecord("pcc_appuser", data)
 */
export const createAppUser = (payload: CreateAppUserPayload): Promise<AppUser> =>
  apiClient.post<AppUser>("/app-users", payload);

/**
 * Actualiza rol, teams o estado activo de un usuario.
 * DATAVERSE: Xrm.WebApi.updateRecord("pcc_appuser", id, data)
 */
export const updateAppUser = (id: string, payload: UpdateAppUserPayload): Promise<AppUser> =>
  apiClient.patch<AppUser>(`/app-users/${id}`, payload);

/**
 * Activa un usuario.
 * DATAVERSE: Xrm.WebApi.updateRecord("pcc_appuser", id, { statecode: 0 })
 */
export const activateAppUser = (id: string): Promise<AppUser> =>
  apiClient.post<AppUser>(`/app-users/${id}/activate`, {});

/**
 * Desactiva un usuario.
 * DATAVERSE: Xrm.WebApi.updateRecord("pcc_appuser", id, { statecode: 1 })
 */
export const deactivateAppUser = (id: string): Promise<AppUser> =>
  apiClient.post<AppUser>(`/app-users/${id}/deactivate`, {});
