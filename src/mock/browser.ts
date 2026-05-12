// ─────────────────────────────────────────────────────────
//  src/mock/browser.ts
//  Configura el Service Worker de MSW para el navegador.
// ─────────────────────────────────────────────────────────

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);

// HMR: cuando Vite recarga handlers.ts en caliente, el worker ya está
// iniciado con los handlers viejos. Esto actualiza los handlers en memoria
// sin necesitar un hard-refresh del navegador.
if (import.meta.hot) {
  import.meta.hot.accept("./handlers", (newMod) => {
    if (newMod) {
      worker.resetHandlers();
      worker.use(...(newMod.handlers as typeof handlers));
      console.info("[MSW] Handlers recargados vía HMR");
    }
  });
}

// HMR: cuando Vite recarga handlers.ts en caliente, el worker ya está
// iniciado con los handlers viejos. Esto actualiza los handlers en memoria
// sin necesitar un hard-refresh del navegador.
if (import.meta.hot) {
  import.meta.hot.accept("./handlers", (newMod) => {
    if (newMod) {
      worker.resetHandlers();
      worker.use(...(newMod.handlers as typeof handlers));
      console.info("[MSW] Handlers recargados vía HMR");
    }
  });
}
