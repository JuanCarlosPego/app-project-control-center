// ─────────────────────────────────────────────────────────
//  src/services/apiClient.ts
//  Cliente HTTP unificado.
//
//  IS_LOCAL = (VITE_USE_MOCKS === 'true')   ← fuente única de verdad
//    true  → entorno LOCAL (npm run dev)  → fetch /api/* interceptado por MSW
//    false → cualquier build (DEV/TEST/PROD) → dvRequest() → Xrm.WebApi (Dataverse)
//
//  .env             → VITE_USE_MOCKS=true   (LOCAL)
//  .env.production  → VITE_USE_MOCKS=false  (DEV / TEST / PROD)
// ─────────────────────────────────────────────────────────

import { dvRequest, IS_LOCAL } from "./dataverseBridge";

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── Cliente MSW (mocks) ────────────────────────────────────────────────────
async function mockRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json() as { error?: string };
      message = body.error ?? message;
    } catch {
      // body no es JSON
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Cliente Dataverse (Xrm.WebApi) ─────────────────────────────────────────
async function dvClientRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  try {
    return await dvRequest<T>(method, path, body);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, msg);
  }
}

// ── Router: elige backend según contexto ───────────────────────────────────
// IS_LOCAL es VITE_USE_MOCKS bakeado por Vite en compile-time:
//   .env (dev)        → VITE_USE_MOCKS=true  → MSW / mocks locales
//   .env.production   → VITE_USE_MOCKS=false → Xrm.WebApi (Dataverse)
function route<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  if (!IS_LOCAL) {
    return dvClientRequest<T>(method, path, body);
  }
  const options: RequestInit = { method };
  if (body !== undefined) {
    (options as RequestInit).body    = JSON.stringify(body);
    (options.headers as Record<string, string>) ??= {};
  }
  return mockRequest<T>(path, options);
}

export const apiClient = {
  get:    <T>(path: string)                  => route<T>("GET",    path),
  patch:  <T>(path: string, body: unknown)   => route<T>("PATCH",  path, body),
  post:   <T>(path: string, body: unknown)   => route<T>("POST",   path, body),
  delete: <T>(path: string)                  => route<T>("DELETE", path),
};
