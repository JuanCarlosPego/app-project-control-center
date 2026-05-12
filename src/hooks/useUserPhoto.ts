// ─────────────────────────────────────────────────────────
//  src/hooks/useUserPhoto.ts
//
//  Patrón tomado de app-calen-vs:
//    - src/hooks/useTecnicoPhoto.js
//    - src/services/office365PhotoConnector.js
//
//  En LOCAL (VITE_USE_MOCKS=true) → IS_LOCAL=true → devuelve null.
//    El componente UserAvatar mostrará el avatar de iniciales.
//
//  En Power Apps (TEST/PROD) → el runtime tiene acceso al Power Platform
//    bridge (@pa-bridge) y el conector "Office 365 Users".
//    TODO: conectar con fetchPhotoViaOffice365(upn) del bridge de Power Apps.
//    Ver: app-calen-vs/src/services/office365PhotoConnector.js para el
//    patrón exacto (loadAppConnectionsAsync_v2 + getAppAccessTokenAsync).
// ─────────────────────────────────────────────────────────

import { useState, useEffect } from "react";

/** true cuando estamos en local (npm run dev). Mismo patrón que app-calen-vs. */
const IS_LOCAL =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

export type PhotoStatus = "blocked" | "no-upn" | "loading" | "ok" | "failed";

export function useUserPhoto(upn: string | undefined): {
  photoUrl: string | null;
  status: PhotoStatus;
} {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PhotoStatus>(() => {
    if (IS_LOCAL) return "blocked";
    if (!upn) return "no-upn";
    return "loading";
  });

  useEffect(() => {
    if (IS_LOCAL) { setStatus("blocked"); return; }
    if (!upn) { setStatus("no-upn"); return; }

    setPhotoUrl(null);
    setStatus("loading");
    let cancelled = false;

    // 🔌 POWER APPS: descomentar y adaptar usando office365PhotoConnector.js
    // import { fetchPhotoViaOffice365 } from "../services/office365PhotoConnector";
    // fetchPhotoViaOffice365(upn).then((url) => {
    //   if (cancelled) return;
    //   if (url) { setPhotoUrl(url); setStatus("ok"); }
    //   else { setStatus("failed"); }
    // });

    // Placeholder: en producción sin bridge, mostramos iniciales
    setStatus("failed");

    return () => { cancelled = true; };
  }, [upn]);

  return { photoUrl, status };
}
