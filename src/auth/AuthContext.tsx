import React, { createContext, useContext, useState } from "react";
import type { AppRole } from "./permissions";
import type { AppUser } from "./ImpersonationContext";

interface AuthUser { displayName: string; email: string; }
interface AuthContextValue { user: AuthUser; roles: AppRole[]; appUser: AppUser; }

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── MOCK ──────────────────────────────────────────────────────────────────
// 🔌 DATAVERSE: Sustituir por lectura real:
//   const ctx = Xrm.Utility.getGlobalContext();
//   user: { displayName: ctx.userSettings.userName, email: ctx.userSettings.userEmail }
//   roles: await Xrm.WebApi.retrieveMultipleRecords("pcc_roleassignment", `?$filter=...`)
// ──────────────────────────────────────────────────────────────────────────

// Usuario real autenticado (mapear al AppUser correspondiente en appUsers).
// En producción este objeto vendrá del contexto de Dataverse / Entra ID.
const MOCK_APP_USER: AppUser = {
  id:          "au-001",
  displayName: "Admin IT",
  email:       "admin@aireuropa.com",
  upn:         "admin@aireuropa.com",
  role:        "Admin",
  isActive:    true,
};

const MOCK_USER: AuthUser = { displayName: MOCK_APP_USER.displayName, email: MOCK_APP_USER.email };
const MOCK_ROLES: AppRole[] = [MOCK_APP_USER.role as AppRole];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [value] = useState<AuthContextValue>({
    user:    MOCK_USER,
    roles:   MOCK_ROLES,
    appUser: MOCK_APP_USER,
  });
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
};
