// ─────────────────────────────────────────────────────────
//  src/mock/interceptor.ts
//  Interceptor de fetch SIN service worker.
//  Funciona en cualquier entorno (Power Apps iframe incluido).
//  Usa @mswjs/interceptors (dependencia transitiva de MSW)
//  + getResponse de MSW para ejecutar los handlers existentes.
// ─────────────────────────────────────────────────────────

import { FetchInterceptor } from "@mswjs/interceptors/fetch";
import { getResponse } from "msw";
import { handlers } from "./handlers";

let installed = false;

export async function startMockInterceptor(): Promise<void> {
  if (installed) return;
  installed = true;

  const interceptor = new FetchInterceptor();

  interceptor.on("request", async ({ request, controller }) => {
    // Solo interceptar llamadas a nuestra API local
    const url = new URL(request.url, location.href);
    if (!url.pathname.startsWith("/api/")) return;

    try {
      const response = await getResponse(handlers, request);
      if (response) {
        controller.respondWith(response);
      }
    } catch (err) {
      console.error("[MockInterceptor] Error ejecutando handler:", err);
    }
  });

  interceptor.apply();
  console.info("[MockInterceptor] Activo — interceptando /api/* sin Service Worker");
}
