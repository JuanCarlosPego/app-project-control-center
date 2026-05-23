// ─────────────────────────────────────────────────────────
//  src/services/helpService.ts
//  Servicio de ayuda contextual.
//
//  Endpoints públicos (cualquier rol autenticado):
//    GET /api/help/:screenId           → contenido para una pantalla + rol
//
//  Endpoints de administración (Admin only):
//    GET    /api/admin/help            → listado completo
//    POST   /api/admin/help            → crear entrada
//    PATCH  /api/admin/help/:id        → actualizar
//    DELETE /api/admin/help/:id        → eliminar
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { HelpContent } from "../types/domain";

// ── Públicos ──────────────────────────────────────────────

/**
 * Devuelve el contenido de ayuda activo para una pantalla y rol.
 * Si no hay contenido activo devuelve null (sin lanzar error).
 */
export async function getHelpForScreen(
  screenId: string,
  role?: string,
): Promise<HelpContent | null> {
  try {
    const qs = role ? `?role=${encodeURIComponent(role)}` : "";
    return await apiClient.get<HelpContent>(`/help/${screenId}${qs}`);
  } catch {
    return null;
  }
}

// ── Administración ────────────────────────────────────────

export async function listHelpContents(): Promise<HelpContent[]> {
  return apiClient.get<HelpContent[]>("/admin/help");
}

export async function createHelpContent(
  data: Omit<HelpContent, "id">,
): Promise<HelpContent> {
  return apiClient.post<HelpContent>("/admin/help", data);
}

export async function updateHelpContent(
  id: string,
  data: Partial<Omit<HelpContent, "id">>,
): Promise<HelpContent> {
  return apiClient.patch<HelpContent>(`/admin/help/${id}`, data);
}

export async function deleteHelpContent(id: string): Promise<void> {
  await apiClient.delete<void>(`/admin/help/${id}`);
}
