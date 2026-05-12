// ─────────────────────────────────────────────────────────
//  src/services/adminService.ts
//  CRUD para Settings, WIP limits, RBAC permissions y AuditLog
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type {
  SystemSettings,
  WipLimits,
  RbacPermission,
  RolePermissionsMap,
  AdminAuditEntry,
  PriorityWeights,
} from "../types/domain";

// ── Payload types ─────────────────────────────────────────
export interface AdminSettingsPayload {
  settings: SystemSettings;
  wipLimits: WipLimits;
}

export interface RolePermissionsPayload {
  permissions: RbacPermission[];
  rolePermissions: RolePermissionsMap;
}

// ── Settings ──────────────────────────────────────────────
export const getAdminSettings = (): Promise<AdminSettingsPayload> =>
  apiClient.get("/admin/settings");

export const patchAdminSetting = (
  key: keyof SystemSettings,
  value: boolean | number,
): Promise<SystemSettings> =>
  apiClient.patch("/admin/settings", { [key]: value });

export const patchPriorityWeights = (
  weights: PriorityWeights,
): Promise<SystemSettings> =>
  apiClient.patch("/admin/settings", { priorityWeights: weights });

// ── WIP limits ────────────────────────────────────────────
export const patchWipLimit = (
  stateId: string,
  limit: number,
): Promise<WipLimits> =>
  apiClient.patch("/admin/wip-limits", { [stateId]: limit });

// ── Role permissions ──────────────────────────────────────
export const getRolePermissions = (): Promise<RolePermissionsPayload> =>
  apiClient.get("/admin/role-permissions");

export const patchRolePermission = (
  role: string,
  key: string,
  value: boolean,
): Promise<RolePermissionsMap> =>
  apiClient.patch("/admin/role-permissions", { role, key, value });

export const resetRolePermissions = (): Promise<RolePermissionsMap> =>
  apiClient.post("/admin/role-permissions/reset", {});

// ── Audit log ─────────────────────────────────────────────
export const getAdminAuditLog = (): Promise<AdminAuditEntry[]> =>
  apiClient.get("/admin/audit-log");
