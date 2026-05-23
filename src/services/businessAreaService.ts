// ─────────────────────────────────────────────────────────
//  src/services/businessAreaService.ts
//
//  Gestión completa de Áreas de Negocio:
//   • CRUD de áreas (con activate/deactivate)
//   • Gestión de miembros del área (Member / KeyUser)
//   • Gestión de Product Owners del área (PO)
//   • Helpers de consulta cruzada (getAreasByUser, getPOAreas, getUsersByArea)
//
//  Modo MOCK (VITE_USE_MOCKS=true):
//    MSW intercepta /api/admin/areas → store en memoria sobre db.json
//
//  Modo DATAVERSE (VITE_USE_MOCKS=false):
//    Los handlers correspondientes en dataverseBridge.ts gestionan
//    las entidades cproroad_businessarea, cproroad_userareamembership
//    y cproroad_userareaownership.
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type {
  BusinessArea,
  UserAreaMembership,
  UserAreaOwnership,
  AreaMemberRoleType,
} from "../types/domain";

// ── Payloads ──────────────────────────────────────────────

export interface CreateBusinessAreaPayload {
  name: string;
  description?: string;
}

export interface UpdateBusinessAreaPayload {
  name?: string;
  description?: string;
}

export interface AddAreaMemberPayload {
  userId: string;
  roleType: AreaMemberRoleType;
}

export interface AddAreaOwnerPayload {
  userId: string;
}

// ── CRUD de Áreas ─────────────────────────────────────────

/** Lista todas las áreas de negocio (activas e inactivas). */
export const listBusinessAreas = (): Promise<BusinessArea[]> =>
  apiClient.get("/admin/areas");

/** Obtiene una única área por id. */
export const getBusinessArea = (id: string): Promise<BusinessArea> =>
  apiClient.get(`/admin/areas/${id}`);

/** Crea una nueva área de negocio (isActive = true por defecto). */
export const createBusinessArea = (payload: CreateBusinessAreaPayload): Promise<BusinessArea> =>
  apiClient.post("/admin/areas", payload);

/** Actualiza nombre y/o descripción de un área. */
export const updateBusinessArea = (id: string, payload: UpdateBusinessAreaPayload): Promise<BusinessArea> =>
  apiClient.patch(`/admin/areas/${id}`, payload);

/** Activa un área de negocio. */
export const activateBusinessArea = (id: string): Promise<BusinessArea> =>
  apiClient.post(`/admin/areas/${id}/activate`, {});

/** Desactiva un área de negocio. */
export const deactivateBusinessArea = (id: string): Promise<BusinessArea> =>
  apiClient.post(`/admin/areas/${id}/deactivate`, {});

// ── Membresías (Member / KeyUser) ─────────────────────────

/** Lista las membresías de un área. */
export const listAreaMemberships = (areaId: string): Promise<UserAreaMembership[]> =>
  apiClient.get(`/admin/areas/${areaId}/members`);

/** Añade un usuario al área con el roleType indicado. */
export const addAreaMember = (areaId: string, payload: AddAreaMemberPayload): Promise<UserAreaMembership> =>
  apiClient.post(`/admin/areas/${areaId}/members`, payload);

/** Elimina una membresía por su id. */
export const removeAreaMember = (areaId: string, membershipId: string): Promise<{ ok: boolean }> =>
  apiClient.delete(`/admin/areas/${areaId}/members/${membershipId}`);

// ── Ownerships (PO) ────────────────────────────────────────

/** Lista los Product Owners de un área. */
export const listAreaOwnerships = (areaId: string): Promise<UserAreaOwnership[]> =>
  apiClient.get(`/admin/areas/${areaId}/owners`);

/** Añade un usuario como PO del área. */
export const addAreaOwner = (areaId: string, payload: AddAreaOwnerPayload): Promise<UserAreaOwnership> =>
  apiClient.post(`/admin/areas/${areaId}/owners`, payload);

/** Elimina un ownership por su id. */
export const removeAreaOwner = (areaId: string, ownershipId: string): Promise<{ ok: boolean }> =>
  apiClient.delete(`/admin/areas/${areaId}/owners/${ownershipId}`);

// ── Helpers de consulta cruzada ────────────────────────────

/**
 * Obtiene todas las áreas donde el usuario es miembro (Member o KeyUser).
 * Llamada: GET /admin/areas?userId=<userId>
 */
export const getAreasByUser = (userId: string): Promise<BusinessArea[]> =>
  apiClient.get(`/admin/areas?userId=${encodeURIComponent(userId)}`);

/**
 * Obtiene todas las áreas donde el usuario es Product Owner.
 * Llamada: GET /admin/areas?poUserId=<userId>
 */
export const getPOAreas = (userId: string): Promise<BusinessArea[]> =>
  apiClient.get(`/admin/areas?poUserId=${encodeURIComponent(userId)}`);

/**
 * Obtiene los usuarios miembros de un área junto con su roleType.
 * Alias de listAreaMemberships pero orientado a queries desde el área.
 */
export const getUsersByArea = (businessAreaId: string): Promise<UserAreaMembership[]> =>
  listAreaMemberships(businessAreaId);
