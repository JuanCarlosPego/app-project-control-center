// ─────────────────────────────────────────────────────────────────
//  src/auth/ImpersonationContext.tsx
//  Contexto de simulación de usuario ("modo prueba").
//
//  - realUser    → usuario autenticado real (no se modifica nunca)
//  - impersonatedUser → usuario simulado (o null)
//  - effectiveUser    → impersonatedUser ?? realUser
//  - isImpersonating  → boolean
//
//  Persistencia en localStorage: "impersonatedUserId"
// ─────────────────────────────────────────────────────────────────
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { AppRole } from "./permissions";
import { apiClient } from "../services/apiClient";
import { setBridgeEffectiveUser } from "../services/dataverseBridge";

// ── AppUser (de /api/appusers o db.json) ──────────────────────────
export interface AppUser {
  id:          string;
  displayName: string;
  email:       string;
  upn:         string;
  role:        AppRole | "Invitado";
  isActive:    boolean;
  teamIds?:    string[];
  profileIds?: string[];
  createdOn?:  string;
  updatedOn?:  string;
}

// ── Context value ─────────────────────────────────────────────────
interface ImpersonationValue {
  realUser:          AppUser;
  impersonatedUser:  AppUser | null;
  effectiveUser:     AppUser;
  isImpersonating:   boolean;
  appUsers:          AppUser[];
  loadingUsers:      boolean;
  /** Mapa id→nombre de equipo para mostrar en el banner */
  teamNameMap:       Record<string, string>;
  /** Mapa profileId→label de perfil de permisos */
  permProfilesMap:   Record<string, string>;
  setImpersonatedUser: (userId: string) => void;
  clearImpersonation:  () => void;
}

const ImpersonationContext = createContext<ImpersonationValue | null>(null);

const LS_KEY = "impersonatedUserId";

// ── Provider ──────────────────────────────────────────────────────
interface Props {
  realUser: AppUser;
  children: React.ReactNode;
}

export const ImpersonationProvider: React.FC<Props> = ({ realUser, children }) => {
  const [appUsers, setAppUsers]               = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers]       = useState(true);
  const [impersonatedUser, setImpersonated]   = useState<AppUser | null>(null);
  const [teamNameMap, setTeamNameMap]         = useState<Record<string, string>>({});
  const [permProfilesMap, setPermProfilesMap] = useState<Record<string, string>>({});

  // ── Cargar appUsers + equipos + perfiles ────────────────────────
  useEffect(() => {
    setLoadingUsers(true);
    Promise.all([
      apiClient.get<AppUser[]>("/app-users"),
      apiClient.get<Array<{ id: string; name: string }>>("/teams").catch(() => [] as Array<{ id: string; name: string }>),
      apiClient.get<Array<{ id: string; label: string }>>("/permission-profiles").catch(() => [] as Array<{ id: string; label: string }>),
    ]).then(([users, teams, profiles]) => {
        setAppUsers(users);

        // Construir mapa id→nombre de equipo
        const map: Record<string, string> = {};
        teams.forEach((t) => { map[t.id] = t.name; });
        setTeamNameMap(map);

        // Construir mapa profileId→label
        const ppMap: Record<string, string> = {};
        profiles.forEach((p) => { ppMap[p.id] = p.label || p.id; });
        setPermProfilesMap(ppMap);

        // Restaurar sesión desde localStorage
        const savedId = localStorage.getItem(LS_KEY);
        if (savedId) {
          const saved = users.find(u => u.id === savedId);
          if (saved?.isActive) setImpersonated(saved);
          else localStorage.removeItem(LS_KEY);
        }
      })
      .catch(() => {/* en producción sin mocks puede fallar — no bloquear */})
      .finally(() => setLoadingUsers(false));
  }, []);

  // ── Acciones ─────────────────────────────────────────────────────
  const setImpersonatedUser = useCallback((userId: string) => {
    const user = appUsers.find(u => u.id === userId);
    if (!user || !user.isActive) return;
    setImpersonated(user);
    localStorage.setItem(LS_KEY, userId);
  }, [appUsers]);

  const clearImpersonation = useCallback(() => {
    setImpersonated(null);
    localStorage.removeItem(LS_KEY);
  }, []);

  const effectiveUser = impersonatedUser ?? realUser;

  // Sincronizar el usuario efectivo al bridge para que GET /me lo devuelva.
  // Se ejecuta en cada cambio: al montar (usuario real), al impersonar y al limpiar.
  // Además actualiza el mock store (solo activo en LOCAL) para que POST/PATCH
  // de solicitudes y proyectos usen el usuario correcto y no el admin de db.json.
  useEffect(() => {
    setBridgeEffectiveUser(effectiveUser);
    // Actualiza store.currentUser en los MSW handlers (no-op silencioso en modo Dataverse)
    apiClient.patch("/me", effectiveUser).catch(() => {/* no-op en modo Dataverse */});
  }, [effectiveUser]);

  const value = useMemo<ImpersonationValue>(() => ({
    realUser,
    impersonatedUser,
    effectiveUser,
    isImpersonating: impersonatedUser !== null,
    appUsers,
    loadingUsers,
    teamNameMap,
    permProfilesMap,
    setImpersonatedUser,
    clearImpersonation,
  }), [realUser, impersonatedUser, effectiveUser, appUsers, loadingUsers, teamNameMap, permProfilesMap, setImpersonatedUser, clearImpersonation]);

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
};

// ── Hooks ─────────────────────────────────────────────────────────
export const useImpersonation = (): ImpersonationValue => {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error("useImpersonation must be inside <ImpersonationProvider>");
  return ctx;
};

/**
 * Hook principal para RBAC, guards y UI.
 * Siempre devuelve el usuario efectivo (simulado o real).
 */
export const useEffectiveUser = (): { user: AppUser; roles: Array<AppRole | "Invitado"> } => {
  const { effectiveUser } = useImpersonation();
  return { user: effectiveUser, roles: [effectiveUser.role] };
};
