import React, { createContext, useContext, useEffect, useState } from "react";
import type { AppRole } from "./permissions";
import type { AppUser } from "./ImpersonationContext";
import { sdkGet } from "../services/dataverseSdk";

interface AuthUser { displayName: string; email: string; }
interface AuthContextValue { user: AuthUser; roles: AppRole[]; appUser: AppUser; }

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Mapa choice Dataverse → AppRole ──────────────────────────────
const DV_ROLE_MAP: Record<number, AppRole> = {
  100000000: "Admin",
  100000001: "IT AirEuropa",
  100000002: "Proveedor",
  100000003: "Usuario",
  100000004: "Invitado",
};

// ── Usuario de fallback (modo local / error en lectura) ───────────
const MOCK_APP_USER: AppUser = {
  id:          "au-001",
  displayName: "Admin IT",
  email:       "admin@aireuropa.com",
  upn:         "admin@aireuropa.com",
  role:        "Admin",
  isActive:    true,
  teamIds:     [],
};
const MOCK_USER: AuthUser   = { displayName: MOCK_APP_USER.displayName, email: MOCK_APP_USER.email };
const MOCK_ROLES: AppRole[] = [MOCK_APP_USER.role as AppRole];

// ── Proveedor ─────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [value, setValue] = useState<AuthContextValue | null>(null);

  useEffect(() => {
    async function init() {
      // Modo local (vite dev): usuario hardcodeado
      if (import.meta.env.DEV) {
        setValue({ user: MOCK_USER, roles: MOCK_ROLES, appUser: MOCK_APP_USER });
        return;
      }

      // Modo producción: leer identidad real desde Xrm
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const xrm = (window as any).Xrm;
        const ctx      = xrm?.Utility?.getGlobalContext?.();
        const settings = ctx?.userSettings;
        const upn: string         = (settings?.userName as string)  ?? "";
        const displayName: string = (settings?.fullName  as string)  ?? upn ?? "Usuario";

        let appUser: AppUser;

        if (upn) {
          // Buscar el registro cproroad_appuser por UPN (usa sdkGet → REST+MSAL como fallback)
          const r = await sdkGet(
            "cproroad_appuser",
            `?$select=cproroad_appuserid,cproroad_name,cproroad_email,cproroad_upn,cproroad_role,cproroad_isactive` +
            `&$filter=cproroad_upn eq '${upn.replace(/'/g, "''")}' and cproroad_isactive eq true&$top=1`,
          );

          if (r.entities.length > 0) {
            const rec  = r.entities[0];
            const role: AppRole = DV_ROLE_MAP[rec.cproroad_role as number] ?? "Invitado";
            appUser = {
              id:          rec.cproroad_appuserid as string,
              displayName: (rec.cproroad_name  as string) || displayName,
              email:       (rec.cproroad_email as string) || upn,
              upn,
              role,
              teamIds:  [],
              isActive: true,
            };
          } else {
            // UPN no registrado en cproroad_appuser → acceso mínimo
            appUser = {
              id: "", displayName, email: upn, upn,
              role: "Invitado", teamIds: [], isActive: true,
            };
          }
        } else {
          // Sin UPN disponible → fallback mock
          appUser = { ...MOCK_APP_USER, displayName, email: upn || MOCK_APP_USER.email, upn: upn || MOCK_APP_USER.upn };
        }

        setValue({
          user:    { displayName: appUser.displayName, email: appUser.email },
          roles:   [appUser.role as AppRole],
          appUser,
        });
      } catch {
        // Cualquier error → fallback al mock para no romper la app
        setValue({ user: MOCK_USER, roles: MOCK_ROLES, appUser: MOCK_APP_USER });
      }
    }

    void init();
  }, []);

  // Pantalla de carga mientras se resuelve la identidad
  if (!value) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", fontFamily: "'Segoe UI', sans-serif",
        color: "#605E5C", fontSize: 13,
      }}>
        Identificando usuario…
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside <AuthProvider>");
  return ctx;
};
