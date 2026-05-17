// ─────────────────────────────────────────────────────────────────────────────
//  src/services/office365Connector.ts
//
//  Llamadas al conector "Office 365 Users" de Power Platform sin MSAL.
//
//  Patrón tomado de app-calen-vs:
//    src/services/office365PhotoConnector.js  → fotos + búsqueda de usuarios
//    src/services/bridgeUser.js               → identidad del usuario actual
//
//  CÓMO FUNCIONA:
//    Canvas Code Apps corren en un iframe de Power Apps. window.Xrm NO existe.
//    La identidad del usuario y los tokens se obtienen via postMessage a través
//    del bridge (window.powerAppsBridge), usando executePluginAsync del SDK.
//
//    Solo funciona en TEST/PROD (dentro del iframe de Power Apps).
//    En LOCAL (vite dev) todas las funciones devuelven null / [].
//
//  FUNCIONES EXPORTADAS:
//    getBridgeCurrentUser()       → { upn, displayName, email } o null
//    fetchPhotoViaOffice365(upn)  → URL data: de la foto o null
//    searchTenantUsersViaOffice365(q) → TenantUser[]
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { TenantUser } from "../types/domain";

// El alias @pa-bridge apunta al PluginBridge.js del SDK.
// Comparte el mismo singleton bridgePromise ya inicializado por @microsoft/power-apps/data.
// Ver vite.config.ts → resolve.alias['@pa-bridge']
import { executePluginAsync } from "@pa-bridge";

/** true SOLO cuando VITE_USE_MOCKS=true (entorno LOCAL). En cualquier build → false. */
const IS_LOCAL: boolean = import.meta.env.VITE_USE_MOCKS === 'true';

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────────────────

/** Decodifica el payload de un JWT sin verificar la firma. */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64    = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const json   = decodeURIComponent(
      atob(padded).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function extractApiId(conn: any): string {
  return conn?.apiId ?? conn?.api?.id ?? "";
}

async function getTokenForConn(conn: any): Promise<string | null> {
  const apiId = extractApiId(conn);
  if (!apiId) return null;
  try {
    const result = await executePluginAsync(
      "AppIdentityServicePlugin",
      "getAppAccessTokenAsync",
      [apiId],
    );
    const token: any = result?.data ?? result;
    return token && typeof token === "string" ? token : null;
  } catch {
    return null;
  }
}

function buildO365Headers(ref: any, token: string | null): Record<string, string> {
  const apiId = extractApiId(ref);
  const h: Record<string, string> = {
    "Accept":                                   "application/json",
    "x-ms-protocol-semantics":                  "cdp",
    "ServiceNamespace":                         "office365users",
    "x-ms-pa-client-custom-headers-options":    '{"addCustomHeaders":true}',
    "x-ms-enable-selects":                      "true",
    "x-ms-pa-client-telemetry-options":         'paclient-telemetry {"operationName":"runtimeDataClient.executeRequest"}',
    "x-ms-pa-client-telemetry-additional-data": `{"apiId":"${apiId}"}`,
  };
  if (token) h["Authorization"] = `paauth ${token}`;
  return h;
}

async function httpGetRaw(
  url: string,
  headers: Record<string, string>,
  responseType: "text" | "arraybuffer",
): Promise<[number, any]> {
  const raw = await executePluginAsync(
    "AppHttpClientPlugin",
    "sendHttpAsync",
    [
      { url, method: "GET", requestSource: "PublishedApp",
        allowSessionStorage: true, returnDirectResponse: true, headers },
      "",
      responseType,
    ],
  );
  return [raw?.[0]?.status ?? 0, raw?.[1]];
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONEXIÓN O365 (singleton)
// ─────────────────────────────────────────────────────────────────────────────

let _allConnections: any = null;
let _connectionsPromise: Promise<any> | null = null;

async function loadAllConnections(): Promise<any> {
  if (_allConnections) return _allConnections;
  if (_connectionsPromise) return _connectionsPromise;
  _connectionsPromise = (async () => {
    const c = await executePluginAsync("AppPowerAppsClientPlugin", "loadAppConnectionsAsync_v2", []);
    _allConnections = c && typeof c === "object" ? c : {};
    return _allConnections;
  })();
  return _connectionsPromise;
}

async function getO365ConnectionRef(): Promise<any> {
  const conns = await loadAllConnections();
  const ref = conns?.["office365users"];
  if (!ref) {
    console.warn("[O365Connector] conexión 'office365users' no encontrada. ¿Está añadida en la Canvas App?");
  }
  return ref ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  IDENTIDAD DEL USUARIO ACTUAL (portado de app-calen-vs/bridgeUser.js)
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeUser {
  upn:         string;
  displayName: string;
  email:       string;
}

let _cachedBridgeUser: BridgeUser | null | undefined = undefined; // undefined = no intentado aún

/** Estrategia 1: Office 365 Users /me */
async function tryOffice365Me(ref: any): Promise<BridgeUser | null> {
  if (!ref?.runtimeUrl || !ref?.connectionName) return null;
  const token   = await getTokenForConn(ref);
  if (!token) return null;
  const headers = buildO365Headers(ref, token);
  const url     = `${ref.runtimeUrl}/${ref.connectionName}/codeless/v1.0/me`;
  const [status, body] = await httpGetRaw(url, headers, "text");
  if (status !== 200 || !body) return null;
  let data: any;
  try { data = typeof body === "string" ? JSON.parse(body) : body; } catch { return null; }
  const upn = data?.userPrincipalName ?? data?.mail ?? "";
  if (!upn) return null;
  return {
    upn,
    displayName: (data?.displayName as string) || upn.split("@")[0],
    email:       (data?.mail as string) || upn,
  };
}

/** Estrategia 2: decodificar JWT de cualquier conexión disponible */
async function tryJwtDecode(conns: any): Promise<BridgeUser | null> {
  for (const conn of Object.values(conns as Record<string, any>)) {
    const token = await getTokenForConn(conn);
    if (!token) continue;
    if ((token.match(/\./g) ?? []).length !== 2) continue; // no es JWT
    const claims = decodeJwtPayload(token);
    const upn    = claims?.upn ?? claims?.unique_name ?? claims?.preferred_username ?? "";
    if (!upn) continue;
    return {
      upn,
      displayName: (claims?.name as string) || upn.split("@")[0],
      email:       (claims?.email as string) || upn,
    };
  }
  return null;
}

/**
 * Devuelve el usuario logueado en Power Platform via bridge.
 * Devuelve null en entorno local o si el bridge no está disponible.
 */
export async function getBridgeCurrentUser(): Promise<BridgeUser | null> {
  if (IS_LOCAL) return null;
  if (_cachedBridgeUser !== undefined) return _cachedBridgeUser;

  try {
    const conns = await loadAllConnections();
    const keys  = Object.keys(conns);
    if (keys.length === 0) {
      console.warn("[O365Connector] bridge sin conexiones disponibles");
      _cachedBridgeUser = null;
      return null;
    }

    // Estrategia 1: O365 /me
    const o365ref = conns["office365users"];
    if (o365ref) {
      const user = await tryOffice365Me(o365ref).catch(() => null);
      if (user) {
        console.log("[O365Connector] ✅ usuario identificado via O365 /me:", user.upn);
        _cachedBridgeUser = user;
        return user;
      }
    }

    // Estrategia 2: JWT decode de todas las conexiones
    const user = await tryJwtDecode(conns);
    if (user) {
      console.log("[O365Connector] ✅ usuario identificado via JWT decode:", user.upn);
      _cachedBridgeUser = user;
      return user;
    }

    console.warn("[O365Connector] ❌ no se pudo identificar el usuario. Conexiones:", keys.join(", "));
    _cachedBridgeUser = null;
    return null;
  } catch (err) {
    console.warn("[O365Connector] error en getBridgeCurrentUser:", err);
    _cachedBridgeUser = null;
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  FOTO DE PERFIL (portado de app-calen-vs/office365PhotoConnector.js)
// ─────────────────────────────────────────────────────────────────────────────

const _photoCache  = new Map<string, string | null>();
const _inFlight    = new Map<string, Promise<string | null>>();

/**
 * Obtiene la foto de perfil de un usuario por su UPN via conector O365.
 * Devuelve una URL data:image/jpeg;base64,... o null si no hay foto.
 */
export function fetchPhotoViaOffice365(upn: string): Promise<string | null> {
  if (IS_LOCAL || !upn) return Promise.resolve(null);

  const key = upn.toLowerCase();
  if (_photoCache.has(key)) return Promise.resolve(_photoCache.get(key) ?? null);
  if (_inFlight.has(key))   return _inFlight.get(key)!;

  const promise = (async (): Promise<string | null> => {
    try {
      const ref = await getO365ConnectionRef();
      if (!ref) { _photoCache.set(key, null); return null; }

      const token   = await getTokenForConn(ref);
      const headers = buildO365Headers(ref, token);
      const url     = `${ref.runtimeUrl}/${ref.connectionName}/codeless/v1.0/users/${encodeURIComponent(upn)}/photo/$value`;

      const [status, body] = await httpGetRaw(url, headers, "arraybuffer");
      if (status !== 200 || !body) { _photoCache.set(key, null); return null; }

      let dataUrl: string;
      if (body instanceof ArrayBuffer) {
        const bytes  = new Uint8Array(body);
        let binary   = "";
        bytes.forEach((b) => { binary += String.fromCharCode(b); });
        dataUrl = `data:image/jpeg;base64,${btoa(binary)}`;
      } else if (typeof body === "string") {
        dataUrl = body.startsWith("data:") ? body : `data:image/jpeg;base64,${body}`;
      } else {
        _photoCache.set(key, null);
        return null;
      }

      _photoCache.set(key, dataUrl);
      return dataUrl;
    } catch {
      _photoCache.set(key, null);
      return null;
    } finally {
      _inFlight.delete(key);
    }
  })();

  _inFlight.set(key, promise);
  return promise;
}

// ─────────────────────────────────────────────────────────────────────────────
//  BÚSQUEDA DE USUARIOS DEL TENANT (portado de app-calen-vs/office365PhotoConnector.js)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca usuarios del tenant por nombre / UPN / email via conector Office 365 Users.
 * Usa 4 estrategias en cascada (mismo patrón que app-calen-vs).
 */
export async function searchTenantUsersViaOffice365(q: string): Promise<TenantUser[]> {
  if (IS_LOCAL || !q?.trim() || q.trim().length < 2) return [];

  const ref = await getO365ConnectionRef();
  if (!ref) return [];

  const token   = await getTokenForConn(ref);
  const headers = buildO365Headers(ref, token);

  const select   = "displayName,userPrincipalName,mail,jobTitle,department";
  const top      = 20;
  const qEnc     = encodeURIComponent(q.trim());
  const qRaw     = q.trim().replace(/'/g, "''");
  const base     = `${ref.runtimeUrl}/${ref.connectionName}`;
  const codeless = `${base}/codeless/v1.0`;

  // Mismas 4 estrategias de app-calen-vs/office365PhotoConnector.js
  const strategies: Array<{ label: string; url: string; extraHeaders: Record<string, string> }> = [
    {
      // Graph $search displayName — requiere ConsistencyLevel: eventual + $count=true
      label: "graph-search-displayName",
      url: `${codeless}/users?$search=%22displayName%3A${qEnc}%22&$select=${select}&$top=${top}&$count=true`,
      extraHeaders: { "ConsistencyLevel": "eventual" },
    },
    {
      // Graph $search userPrincipalName
      label: "graph-search-upn",
      url: `${codeless}/users?$search=%22userPrincipalName%3A${qEnc}%22&$select=${select}&$top=${top}&$count=true`,
      extraHeaders: { "ConsistencyLevel": "eventual" },
    },
    {
      // Endpoint nativo O365 Users connector (searchTerm, sin prefijo $)
      label: "native-searchTerm",
      url: `${base}/v2/users?searchTerm=${qEnc}&$top=${top}`,
      extraHeaders: {},
    },
    {
      // Graph $filter startsWith — solo mail y UPN, no displayName
      label: "graph-filter-upn-mail",
      url: `${codeless}/users?$filter=startsWith(userPrincipalName,'${qRaw}') or startsWith(mail,'${qRaw}')&$select=${select}&$top=${top}`,
      extraHeaders: {},
    },
  ];

  for (const { label, url, extraHeaders } of strategies) {
    try {
      const reqHeaders = { ...headers, ...extraHeaders };
      const [status, body] = await httpGetRaw(url, reqHeaders, "text");
      if (status !== 200 || !body) continue;

      const json  = typeof body === "string" ? JSON.parse(body) : body;
      const items: any[] = json?.value ?? (Array.isArray(json) ? json : []);
      if (items.length === 0) continue;

      // Normalizar: el conector nativo usa PascalCase, Graph usa camelCase
      const normalized: TenantUser[] = items.map((u: any) => ({
        upn:         (u.UserPrincipalName ?? u.userPrincipalName ?? u.Mail ?? u.mail ?? ""),
        displayName: (u.DisplayName       ?? u.displayName       ?? ""),
        email:       (u.Mail              ?? u.mail              ?? u.UserPrincipalName ?? u.userPrincipalName ?? ""),
      })).filter((u: TenantUser) => u.upn);

      if (normalized.length === 0) continue;

      console.log(`[O365Connector] búsqueda '${q}' via [${label}] → ${normalized.length} resultados`);
      return normalized;
    } catch (err) {
      console.warn(`[O365Connector] estrategia [${label}] error:`, (err as Error)?.message ?? err);
    }
  }
  return [];
}
