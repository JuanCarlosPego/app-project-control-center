import React, { createContext, useContext, useEffect, useState } from "react";
import { ShieldOff, Mail } from "lucide-react";
import type { AppRole } from "./permissions";
import type { AppUser } from "./ImpersonationContext";
import { sdkGet } from "../services/dataverseSdk";
import { getBridgeCurrentUser } from "../services/office365Connector";

interface AuthUser { displayName: string; email: string; }
interface AuthContextValue { user: AuthUser; roles: AppRole[]; appUser: AppUser; }

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Tipos para la pantalla de acceso denegado ────────────────────
type AdminContact = { name: string; upn: string };

// ── Pantalla de acceso denegado (igual que AccessDeniedScreen en app-calen-vs) ──
const AccessDeniedScreen: React.FC<{ upn: string; adminContacts: AdminContact[] }> = ({ upn, adminContacts }) => {
  const noId = upn === "(no identificado)";
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f1f5f9 0%, #dbeafe 50%, #e0e7ff 100%)",
      padding: 24, fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 440,
        background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
        borderRadius: 24, boxShadow: "0 25px 50px rgba(0,0,0,0.12)",
        border: "1px solid rgba(239,68,68,0.12)", overflow: "hidden",
      }}>
        {/* Cabecera roja */}
        <div style={{
          background: "linear-gradient(90deg, #ef4444, #f43f5e)",
          padding: "24px 32px", display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, flexShrink: 0,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldOff size={28} color="white" strokeWidth={1.5} />
          </div>
          <div>
            <h1 style={{ color: "#fff", fontWeight: 900, fontSize: 18, margin: 0, lineHeight: 1.2 }}>
              Sin acceso
            </h1>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, margin: "4px 0 0" }}>
              {noId ? "No se pudo identificar tu usuario" : "No tienes permiso para usar esta aplicación"}
            </p>
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* UPN / motivo */}
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 16, padding: "12px 16px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#f87171", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
              {noId ? "Motivo" : "Usuario identificado"}
            </p>
            {noId ? (
              <p style={{ fontSize: 13, color: "#b91c1c", margin: 0, lineHeight: 1.6 }}>
                La aplicación no pudo determinar tu identidad. Asegúrate de que las conexiones
                del Canvas App están configuradas correctamente.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#b91c1c", margin: 0, wordBreak: "break-all" }}>
                  {upn}
                </p>
                <p style={{ fontSize: 12, color: "#ef4444", margin: "4px 0 0" }}>
                  Este usuario no está registrado en la aplicación.
                </p>
              </>
            )}
          </div>

          {/* Contacto con admins */}
          {!noId && (
            adminContacts.length > 0 ? (
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 12px" }}>
                  Contacta con el administrador de la aplicación
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {adminContacts.map((a) => (
                    <div key={a.upn} style={{
                      display: "flex", alignItems: "center", gap: 12, padding: 12,
                      background: "#eef2ff", border: "1px solid #e0e7ff", borderRadius: 16,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 12, background: "#6366f1", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 12, fontWeight: 700,
                      }}>
                        {a.name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?"}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{
                          fontSize: 13, fontWeight: 600, color: "#1f2937", margin: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{a.name}</p>
                        {a.upn && (
                          <a href={`mailto:${a.upn}`} style={{
                            fontSize: 12, color: "#6366f1", textDecoration: "none",
                            display: "flex", alignItems: "center", gap: 4,
                          }}>
                            <Mail size={10} />
                            {a.upn}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 16, padding: "12px 16px" }}>
                <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
                  No se encontraron administradores registrados. Contacta con el responsable de IT.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

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
  // Guarda los datos del usuario cuando NO está registrado en cproroad_appuser
  const [unregistered, setUnregistered] = useState<{ upn: string; adminContacts: AdminContact[] } | null>(null);

  useEffect(() => {
    async function init() {
      // Modo local (vite dev): usuario hardcodeado
      if (import.meta.env.DEV) {
        setValue({ user: MOCK_USER, roles: MOCK_ROLES, appUser: MOCK_APP_USER });
        return;
      }

      // Modo producción: mismo patrón que app-calen-vs:
      //   1. SDK call primero (inicializa el bridge → getTecnicos equivalent)
      //   2. getBridgeCurrentUser (JWT decode o O365 /me) — ahora el bridge está listo
      //   3. Si falla el bridge → sdkGet systemuser con EqualUserId
      try {
        let upn         = "";
        let displayName = "Usuario";

        // ── PASO 1: Warm-up del bridge cargando todos los app-users activos ────
        // (igual que app-calen-vs llama getTecnicos() antes de getBridgeCurrentUser)
        // Además nos sirve para hacer el match sin segunda consulta si el bridge funciona.
        let warmUpUsers: Record<string, unknown>[] = [];
        try {
          const wu = await sdkGet(
            "cproroad_appuser",
            "?$select=cproroad_appuserid,cproroad_name,cproroad_email,cproroad_upn,cproroad_role,cproroad_isactive" +
            "&$filter=cproroad_isactive eq true",
          );
          warmUpUsers = wu.entities as Record<string, unknown>[];
        } catch (e) {
          console.warn("[AuthContext] warm-up appUser:", e);
        }

        // Admins para mostrar en la pantalla de acceso denegado
        const adminContacts: AdminContact[] = warmUpUsers
          .filter((u) => (u.cproroad_role as number) === 100000000)
          .map((u) => ({
            name: (u.cproroad_name as string) || "Admin",
            upn:  (u.cproroad_email as string) || (u.cproroad_upn as string) || "",
          }));

        // ── PASO 2: Bridge (JWT decode de conexiones o O365 /me) ────────────
        // El bridge está inicializado después del SDK call anterior.
        try {
          const bridgeUser = await getBridgeCurrentUser();
          if (bridgeUser?.upn) {
            upn         = bridgeUser.upn;
            displayName = bridgeUser.displayName || upn.split("@")[0];
          }
        } catch (e) {
          console.warn("[AuthContext] bridge:", e);
        }

        // ── PASO 3: Si el bridge dio UPN → match directo sobre warm-up ──────
        if (upn && warmUpUsers.length > 0) {
          const match = warmUpUsers.find(
            (u) => (u.cproroad_upn as string)?.toLowerCase() === upn.toLowerCase(),
          );
          if (match) {
            const role: AppRole = DV_ROLE_MAP[match.cproroad_role as number] ?? "Invitado";
            setValue({
              user:  { displayName: (match.cproroad_name as string) || displayName, email: (match.cproroad_email as string) || upn },
              roles: [role],
              appUser: {
                id:          match.cproroad_appuserid as string,
                displayName: (match.cproroad_name  as string) || displayName,
                email:       (match.cproroad_email as string) || upn,
                upn,
                role,
                teamIds:  [],
                isActive: true,
              },
            });
            return;
          } else {
            setUnregistered({ upn, adminContacts });
            return;
          }
        }

        // ── PASO 4: Bridge falló → probar systemuser con EqualUserId() ───────
        // (bridge ya está inicializado por el warm-up, esta query debería funcionar)
        if (!upn) {
          try {
            const sr = await sdkGet(
              "systemuser",
              "?$select=domainname,fullname&$filter=systemuserid eq (Microsoft.Dynamics.CRM.EqualUserId())&$top=1",
            );
            if (sr.entities.length > 0) {
              const su = sr.entities[0] as Record<string, unknown>;
              upn         = (su.domainname as string) ?? "";
              displayName = (su.fullname   as string) || upn.split("@")[0] || "Usuario";
            }
          } catch (e) {
            console.warn("[AuthContext] EqualUserId:", e);
          }
        }

        // ── Sin UPN tras todos los intentos → bloquear ───────────────────────
        if (!upn) {
          setUnregistered({ upn: "(no identificado)", adminContacts: [] });
          return;
        }

        // ── PASO 5: UPN obtenido del EqualUserId → buscar en cproroad_appuser ─
        const r = await sdkGet(
          "cproroad_appuser",
          `?$select=cproroad_appuserid,cproroad_name,cproroad_email,cproroad_upn,cproroad_role,cproroad_isactive` +
          `&$filter=cproroad_upn eq '${upn.replace(/'/g, "''")}' and cproroad_isactive eq true&$top=1`,
        );

        if (r.entities.length > 0) {
          const rec  = r.entities[0] as Record<string, unknown>;
          const role: AppRole = DV_ROLE_MAP[rec.cproroad_role as number] ?? "Invitado";
          setValue({
            user:  { displayName: (rec.cproroad_name as string) || displayName, email: (rec.cproroad_email as string) || upn },
            roles: [role],
            appUser: {
              id:          rec.cproroad_appuserid as string,
              displayName: (rec.cproroad_name  as string) || displayName,
              email:       (rec.cproroad_email as string) || upn,
              upn,
              role,
              teamIds:  [],
              isActive: true,
            },
          });
        } else {
          setUnregistered({ upn, adminContacts });
        }
      } catch {
        // Cualquier error → fallback al mock para no romper la app
        setValue({ user: MOCK_USER, roles: MOCK_ROLES, appUser: MOCK_APP_USER });
      }
    }

    void init();
  }, []);

  // Usuario reconocido por AAD pero sin registro en la app → bloqueo total
  if (unregistered) {
    return <AccessDeniedScreen upn={unregistered.upn} adminContacts={unregistered.adminContacts} />;
  }

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
