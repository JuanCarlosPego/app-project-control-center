// ─────────────────────────────────────────────────────────
//  src/services/providerService.ts
//  CRUD de empresas proveedoras.
//  LOCAL (VITE_USE_MOCKS=true) → MSW → db.json[providers]
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";

export interface Provider {
  id: string;
  name: string;
  isActive: boolean;
  createdOn?: string;
  updatedOn?: string;
}

export interface ProviderPayload {
  name: string;
  isActive: boolean;
}

export const getProviders = (): Promise<Provider[]> =>
  apiClient.get<Provider[]>("/admin/providers");

export const createProvider = (payload: ProviderPayload): Promise<Provider> =>
  apiClient.post<Provider>("/admin/providers", payload);

export const updateProvider = (id: string, payload: ProviderPayload): Promise<Provider> =>
  apiClient.patch<Provider>(`/admin/providers/${id}`, payload);
