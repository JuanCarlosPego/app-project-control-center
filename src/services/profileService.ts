// ─────────────────────────────────────────────────────────
//  src/services/profileService.ts
//  Gestión de Perfiles de Permisos, asignaciones de usuario
//  y overrides por usuario (solo Admin).
//
//  Dataverse equivalentes:
//    PermissionProfile        → tabla crc_permissionprofile
//    ProfilePermission (N:N)  → tabla crc_profilepermission
//    UserProfile (N:N audit)  → tabla crc_userprofile
//    UserPermissionOverride   → tabla crc_userpermissionoverride
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type {
  PermissionProfile,
  ProfilePermission,
  UserProfile,
  UserPermissionOverride,
  EffectivePermissions,
} from "../types/domain";

// ── Perfiles de permisos ──────────────────────────────────

export const getPermissionProfiles = (): Promise<PermissionProfile[]> =>
  apiClient.get("/permission-profiles");

export const createPermissionProfile = (payload: {
  name: string;
  label: string;
  description?: string;
}): Promise<PermissionProfile> =>
  apiClient.post("/permission-profiles", payload);

export const updatePermissionProfile = (
  id: string,
  patch: Partial<Pick<PermissionProfile, "name" | "label" | "description" | "isActive">>,
): Promise<PermissionProfile> =>
  apiClient.patch(`/permission-profiles/${id}`, patch);

// ── Permisos de cada perfil ───────────────────────────────

export const getProfilePermissions = (): Promise<ProfilePermission[]> =>
  apiClient.get("/profile-permissions");

export const addPermissionToProfile = (
  profileId: string,
  permissionKey: string,
): Promise<ProfilePermission> =>
  apiClient.post("/profile-permissions", { profileId, permissionKey });

export const removePermissionFromProfile = (id: string): Promise<void> =>
  apiClient.delete(`/profile-permissions/${id}`);

// ── Perfiles asignados a un usuario ──────────────────────

export const getUserProfiles = (userId: string): Promise<UserProfile[]> =>
  apiClient.get(`/users/${userId}/profiles`);

export const assignProfileToUser = (
  userId: string,
  profileId: string,
): Promise<UserProfile> =>
  apiClient.post(`/users/${userId}/profiles`, { profileId });

export const removeProfileFromUser = (
  userId: string,
  profileId: string,
): Promise<void> =>
  apiClient.delete(`/users/${userId}/profiles/${profileId}`);

// ── Overrides por usuario (Admin only) ───────────────────

export const getUserOverrides = (userId: string): Promise<UserPermissionOverride[]> =>
  apiClient.get(`/users/${userId}/overrides`);

export const setUserOverride = (
  userId: string,
  permissionKey: string,
  value: boolean,
  reason: string,
): Promise<UserPermissionOverride> =>
  apiClient.post(`/users/${userId}/overrides`, { permissionKey, value, reason });

export const removeUserOverride = (userId: string, overrideId: string): Promise<void> =>
  apiClient.delete(`/users/${userId}/overrides/${overrideId}`);

// ── Permisos efectivos pre-resueltos ─────────────────────

export const getEffectivePermissions = (userId: string): Promise<EffectivePermissions> =>
  apiClient.get(`/users/${userId}/effective-permissions`);
