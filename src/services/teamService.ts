// ─────────────────────────────────────────────────────────
//  src/services/teamService.ts
//
//  Gestión de equipos (teams): áreas internas, equipos IT y proveedores.
//
//  Modo MOCK (VITE_USE_MOCKS=true):
//    MSW intercepta /api/teams → store en memoria sobre db.json
//
//  Modo DATAVERSE (VITE_USE_MOCKS=false):
//    🔌 Reemplazar apiClient por Xrm.WebApi:
//      Xrm.WebApi.retrieveMultipleRecords("pcc_team", "?$filter=...")
//      Xrm.WebApi.createRecord("pcc_team", data)
//      Xrm.WebApi.updateRecord("pcc_team", id, data)
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { Team, TeamType } from "../types/domain";

// ── Parámetros de consulta ────────────────────────────────
export interface ListTeamsParams {
  /** Filtrar por tipo de equipo */
  type?: TeamType;
  /** Búsqueda textual sobre el nombre */
  query?: string;
  /** Si se omite devuelve todos; true = activos, false = inactivos */
  isActive?: boolean;
}

// ── Payloads ──────────────────────────────────────────────
export interface CreateTeamPayload {
  name: string;
  type: TeamType;
  /** Por defecto true */
  isActive?: boolean;
}

export interface UpdateTeamPayload {
  name?: string;
  type?: TeamType;
  isActive?: boolean;
}

// ── Operaciones ───────────────────────────────────────────

/**
 * Lista equipos con filtros opcionales.
 * DATAVERSE: Xrm.WebApi.retrieveMultipleRecords("pcc_team", buildODataFilter(params))
 */
export const listTeams = (params: ListTeamsParams = {}): Promise<Team[]> => {
  const q = new URLSearchParams();
  if (params.type  !== undefined) q.set("type",     params.type);
  if (params.query !== undefined) q.set("query",    params.query);
  if (params.isActive !== undefined) q.set("isActive", String(params.isActive));
  const qs = q.toString() ? `?${q.toString()}` : "";
  return apiClient.get<Team[]>(`/teams${qs}`);
};

/**
 * Crea un equipo nuevo.
 * DATAVERSE: Xrm.WebApi.createRecord("pcc_team", { pcc_name: payload.name, ... })
 */
export const createTeam = (payload: CreateTeamPayload): Promise<Team> =>
  apiClient.post<Team>("/teams", payload);

/**
 * Actualiza un equipo existente (nombre, tipo, estado).
 * DATAVERSE: Xrm.WebApi.updateRecord("pcc_team", id, data)
 */
export const updateTeam = (id: string, payload: UpdateTeamPayload): Promise<Team> =>
  apiClient.patch<Team>(`/teams/${id}`, payload);

/**
 * Activa un equipo (isActive = true).
 * DATAVERSE: Xrm.WebApi.updateRecord("pcc_team", id, { statecode: 0 })
 */
export const activateTeam = (id: string): Promise<Team> =>
  apiClient.post<Team>(`/teams/${id}/activate`, {});

/**
 * Desactiva un equipo (isActive = false).
 * DATAVERSE: Xrm.WebApi.updateRecord("pcc_team", id, { statecode: 1 })
 */
export const deactivateTeam = (id: string): Promise<Team> =>
  apiClient.post<Team>(`/teams/${id}/deactivate`, {});
