// ─────────────────────────────────────────────────────────
//  src/hooks/useUserPhoto.ts
//
//  Patrón tomado de app-calen-vs:
//    - src/hooks/useTecnicoPhoto.js
//    - src/services/office365PhotoConnector.js
//
//  En LOCAL (vite dev) → IS_LOCAL=true → devuelve null.
//    El componente UserAvatar mostrará el avatar de iniciales.
//
//  En Power Apps (TEST/PROD) → usa el conector "Office 365 Users"
//    via office365Connector.ts (fetchPhotoViaOffice365).
// ─────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { fetchPhotoViaOffice365 } from "../services/office365Connector";

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

    fetchPhotoViaOffice365(upn).then((url) => {
      if (cancelled) return;
      if (url) { setPhotoUrl(url); setStatus("ok"); }
      else     { setStatus("failed"); }
    });

    return () => { cancelled = true; };
  }, [upn]);

  return { photoUrl, status };
}
