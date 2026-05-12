// ─────────────────────────────────────────────────────────
//  src/services/stateMachineService.ts
//  CRUD de la Máquina de Estados (transitions[])
//  Mock: MSW intercepta /api/transitions
//  Dataverse futuro: 🔌 Reemplazar con Xrm.WebApi
// ─────────────────────────────────────────────────────────

import { apiClient } from "./apiClient";
import type { Transition, EvidenceType, AppRole } from "../types/domain";

export interface TransitionPayload {
  fromStateId: string;
  toStateId: string;
  allowedRoles: AppRole[];
  assignToRole?: AppRole[];
  autoAssignTeam?: boolean;
  requireUserAssignment?: boolean;
  requireEvidence?: boolean;
  evidenceTypes?: EvidenceType[];
  requireComment?: boolean;
  confirmMove?: boolean;
}

export const getTransitions = (): Promise<Transition[]> =>
  apiClient.get("/transitions");

export const createTransition = (payload: TransitionPayload): Promise<Transition> =>
  apiClient.post("/transitions", payload);

export const updateTransition = (id: string, payload: Partial<TransitionPayload>): Promise<Transition> =>
  apiClient.patch(`/transitions/${id}`, payload);

export const deleteTransition = (id: string): Promise<void> =>
  apiClient.delete(`/transitions/${id}`);

export const resetTransitionsToDefaults = (): Promise<Transition[]> =>
  apiClient.post("/transitions/reset-defaults", {});
