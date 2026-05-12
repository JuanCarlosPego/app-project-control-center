// ─────────────────────────────────────────────────────────
//  src/services/userManagementService.ts
//
//  Fuente de datos:
//  - LOCAL (VITE_USE_MOCKS=true) → MSW intercepta → db.json
//  - Power Apps / Dataverse → reemplazar apiClient por Xrm.WebApi:
//      Xrm.WebApi.retrieveMultipleRecords("pcc_appuser", "?...")
//      Xrm.WebApi.createRecord("pcc_appuser", data)
//      Xrm.WebApi.updateRecord("pcc_appuser", id, data)
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { AppUser, TenantUser } from "../types/domain";

// ── AppUsers ──────────────────────────────────────────────
export interface GetUsersParams {
  query?: string;
  role?: string;
  status?: "active" | "inactive" | "";
  /** Filtrar por equipo: devuelve solo usuarios cuyo teamIds incluye este id */
  teamId?: string;
}

export const getAppUsers = (params: GetUsersParams = {}): Promise<AppUser[]> => {
  const q = new URLSearchParams();
  if (params.query)  q.set("query",  params.query);
  if (params.role)   q.set("role",   params.role);
  if (params.status) q.set("status", params.status);
  if (params.teamId) q.set("teamId", params.teamId);
  const qs = q.toString() ? `?${q.toString()}` : "";
  return apiClient.get<AppUser[]>(`/admin/users${qs}`);
};

export interface CreateUserPayload {
  displayName: string;
  email: string;
  upn: string;
  role: string;
  /** Equipos a los que pertenece. Obligatorio al menos 1 de tipo Provider si role="Proveedor". */
  teamIds: string[];
}

export const createAppUser = (payload: CreateUserPayload): Promise<AppUser> =>
  apiClient.post<AppUser>("/admin/users", payload);

export interface UpdateUserPayload {
  role?: string;
  isActive?: boolean;
  teamIds?: string[];
}

export const updateAppUser = (id: string, payload: UpdateUserPayload): Promise<AppUser> =>
  apiClient.patch<AppUser>(`/admin/users/${id}`, payload);

export const activateAppUser = (id: string): Promise<AppUser> =>
  apiClient.post<AppUser>(`/admin/users/${id}/activate`, {});

export const deactivateAppUser = (id: string): Promise<AppUser> =>
  apiClient.post<AppUser>(`/admin/users/${id}/deactivate`, {});

// ── Tenant people picker ──────────────────────────────────
// LOCAL: busca en tenantUsers mock (db.json vía MSW).
// Power Apps: sustituir por Office 365 Users connector (fetchPhotoViaOffice365 pattern).
//   Ver: app-calen-vs/src/services/office365PhotoConnector.js
//   y: app-calen-vs/src/services/bridgeUser.js  → tryOffice365Me / tryOffice365Search
export const searchTenantUsers = (q: string): Promise<TenantUser[]> => {
  if (!q || q.length < 2) return Promise.resolve([]);
  return apiClient.get<TenantUser[]>(`/admin/tenant-users?q=${encodeURIComponent(q)}`);
};
