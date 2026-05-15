// ─────────────────────────────────────────────────────────
//  src/services/projectService.ts
//
//  Modo MOCK (VITE_USE_MOCKS=true):
//    → fetch interceptado por MSW → handlers.ts → db.json
//
//  Modo DATAVERSE (VITE_USE_MOCKS=false):
//    → 🔌 Reemplazar con Xrm.WebApi.retrieveMultipleRecords
//       o fetch con token de Dataverse según el patrón PAC Code App
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { BusinessArea, Project, Provider, WorkItem } from "../types/domain";

export interface ProjectFilters {
  areaId?: string;
  year?: string;
  query?: string;
  status?: string;
  category?: string;
  providerId?: string;
  deliveryOwnerType?: string;
}

function buildQs(filters: ProjectFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ── Catálogos ────────────────────────────────────────────
export const getBusinessAreas = (): Promise<BusinessArea[]> =>
  apiClient.get("/business-areas");

export const getProviders = (): Promise<Provider[]> =>
  apiClient.get("/providers");

// ── Proyectos ────────────────────────────────────────────
export const getProjects = (filters: ProjectFilters = {}): Promise<Project[]> =>
  apiClient.get(`/projects${buildQs(filters)}`);

export const getProjectById = (id: string): Promise<Project> =>
  apiClient.get(`/projects/${id}`);

export const createProject = (data: Partial<Project>): Promise<Project> =>
  apiClient.post(`/projects`, data);

export const patchProject = (id: string, data: Partial<Project>): Promise<Project> =>
  apiClient.patch(`/projects/${id}`, data);

// ── WorkItems ────────────────────────────────────────────
export const getProjectWorkItems = (projectId: string): Promise<WorkItem[]> =>
  apiClient.get(`/projects/${projectId}/workitems`);
