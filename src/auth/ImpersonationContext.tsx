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

// ── AppUser (de /api/appusers o db.json) ──────────────────────────
export interface AppUser {
  id:          string;
  displayName: string;
  email:       string;
  upn:         string;
  role:        AppRole | "Invitado";
  isActive:    boolean;
  teamIds?:    string[];
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

  // ── Cargar appUsers + equipos ────────────────────────────────────
  useEffect(() => {
    setLoadingUsers(true);
    Promise.all([
      fetch("/api/appusers").then(r => r.json()) as Promise<AppUser[]>,
      fetch("/api/teams").then(r => r.json()).catch(() => []) as Promise<Array<{ id: string; name: string }>>,
    ]).then(([users, teams]) => {
        setAppUsers(users);

        // Construir mapa id→nombre
        const map: Record<string, string> = {};
        teams.forEach((t) => { map[t.id] = t.name; });
        setTeamNameMap(map);

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

  const value = useMemo<ImpersonationValue>(() => ({
    realUser,
    impersonatedUser,
    effectiveUser,
    isImpersonating: impersonatedUser !== null,
    appUsers,
    loadingUsers,
    teamNameMap,
    setImpersonatedUser,
    clearImpersonation,
  }), [realUser, impersonatedUser, effectiveUser, appUsers, loadingUsers, teamNameMap, setImpersonatedUser, clearImpersonation]);

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
