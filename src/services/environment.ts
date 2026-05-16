// ─────────────────────────────────────────────────────────
//  src/services/environment.ts
//  Detección del entorno de ejecución: LOCAL | DEV | TEST | PROD
//
//  Lógica:
//    VITE_USE_MOCKS=true         → LOCAL  (siempre, independiente de URL)
//    window.Xrm  (Power Apps)   → detectar por org URL de Xrm
//    pac code run (local→DV)    → Xrm disponible, URL del entorno configurado
//    Fallback                   → VITE_DV_ORG_URL o DEV
// ─────────────────────────────────────────────────────────

export type AppEnv = "LOCAL" | "DEV" | "TEST" | "PROD";

/** Mapa org-subdomain → AppEnv  (URL de la organización Dataverse). */
const ENV_ORG_MAP: Record<string, AppEnv> = {
  org4e3f8413: "DEV",
  org50ae1344: "TEST",
  org14370965: "PROD",
};

/**
 * Mapa environmentId (Power Apps) → AppEnv.
 * Se usa cuando la app corre en apps.powerapps.com y Xrm aún no está disponible.
 * La URL tiene la forma: /play/e/{environmentId}/app/{appId}
 */
const ENV_ID_MAP: Record<string, AppEnv> = {
  "8d4eb458-70b4-e902-ad69-15739a4e304d": "DEV",
  "b1b69beb-b38e-e818-ae23-969e19a24649": "TEST",
  "0d305ae7-7841-e70a-8f6e-f5e2f59a9448": "PROD",
};

/** Colores de acento por entorno (fondo del badge). */
export const ENV_COLORS: Record<AppEnv, { bg: string; fg: string }> = {
  LOCAL: { bg: "rgba(107,114,128,0.20)", fg: "#9CA3AF" },
  DEV:   { bg: "rgba(37,99,235,0.22)",   fg: "#60A5FA" },
  TEST:  { bg: "rgba(217,119,6,0.22)",   fg: "#FBBF24" },
  PROD:  { bg: "rgba(22,163,74,0.22)",   fg: "#4ADE80" },
};

/** Devuelve la URL de la organización Dataverse (desde Xrm o .env). */
function resolveOrgUrl(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xrm = (window as any).Xrm;
    if (xrm?.Utility?.getGlobalContext) {
      return (xrm.Utility.getGlobalContext().getClientUrl() as string) ?? "";
    }
  } catch {
    // no en Power Apps
  }
  return import.meta.env.VITE_DV_ORG_URL ?? "";
}

function detectEnv(): AppEnv {
  // 1. Vite dev server (import.meta.env.DEV=true): siempre LOCAL
  if (import.meta.env.DEV) return "LOCAL";

  // 2. Si estamos en localhost → LOCAL (aunque mocks estén desactivados)
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return "LOCAL";
  }

  // 3. Detectar por environmentId en la URL de Power Apps
  //    Ej: https://apps.powerapps.com/play/e/{envId}/app/{appId}
  try {
    const href = window.location.href;
    for (const [envId, env] of Object.entries(ENV_ID_MAP)) {
      if (href.includes(envId)) return env;
    }
  } catch { /* sin window */ }

  // 4. Detectar por org-subdomain via Xrm o VITE_DV_ORG_URL
  const orgUrl = resolveOrgUrl();
  for (const [sub, env] of Object.entries(ENV_ORG_MAP)) {
    if (orgUrl.includes(sub)) return env;
  }

  // 5. Si estamos en apps.powerapps.com pero no reconocemos el envId → DEV
  try {
    if (window.location.hostname.includes("powerapps.com") ||
        window.location.hostname.includes("dynamics.com")) {
      return "DEV";
    }
  } catch { /* sin window */ }

  return "LOCAL"; // fallback final (entorno desconocido = tratar como local)
}

// ── Singleton (se calcula una sola vez por carga de módulo) ────────────────
let _cache: AppEnv | null = null;

/** Entorno actual de la aplicación. */
export function getEnv(): AppEnv {
  if (!_cache) _cache = detectEnv();
  return _cache;
}

/** URL base de la organización Dataverse (sin barra final). */
export function getOrgBaseUrl(): string {
  return resolveOrgUrl().replace(/\/$/, "");
}
