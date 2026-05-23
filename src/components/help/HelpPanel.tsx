// ─────────────────────────────────────────────────────────
//  src/components/help/HelpPanel.tsx
//  Panel lateral deslizante de ayuda contextual.
//
//  - Deriva el screenId a partir de la ruta actual (useLocation).
//  - Llama a GET /api/help/:screenId según el rol efectivo.
//  - Se abre/cierra a través de HelpContext.
//  - Renderiza contentHtml con dangerouslySetInnerHTML
//    (contenido solo editable por Admin — no user input).
// ─────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X, HelpCircle, RefreshCw } from "lucide-react";
import { useHelp } from "../../context/HelpContext";
import { useEffectiveUser } from "../../auth/ImpersonationContext";
import { getHelpForScreen } from "../../services/helpService";
import type { HelpContent } from "../../types/domain";

// ── Mapa ruta → screenId ──────────────────────────────────
const ROUTE_TO_SCREEN: Array<[string, string]> = [
  ["/admin/help",          "admin-help"],
  ["/admin/users",         "admin-users"],
  ["/admin/teams",         "admin-teams"],
  ["/admin/areas",         "admin-areas"],
  ["/admin/providers",     "admin-providers"],
  ["/admin/settings",      "admin-settings"],
  ["/admin/permissions",   "admin-permissions"],
  ["/admin/profiles",      "admin-profiles"],
  ["/admin/state-machine", "admin-state-machine"],
  ["/admin",               "admin"],
  ["/dashboard",           "dashboard"],
  ["/projects",            "projects"],
  ["/roadmap",             "roadmap"],
  ["/gantt",               "gantt"],
  ["/backlog",             "backlog"],
  ["/kanban",              "kanban"],
  ["/requests",            "requests"],
  ["/activity",            "activity"],
  ["/evidences",           "evidences"],
  ["/reports",             "reports"],
  ["/risks",               "risks"],
  ["/audit",               "audit"],
];

function getScreenId(pathname: string): string | null {
  // Match por el prefijo más específico (más largo primero en el array)
  for (const [prefix, id] of ROUTE_TO_SCREEN) {
    if (pathname.startsWith(prefix)) return id;
  }
  return null;
}

// ── Estilos del panel ─────────────────────────────────────
const PANEL_W = 360;
const HEADER_H = 48;

const htmlStyles = `
  .help-content h3 {
    font-size: 13px;
    font-weight: 700;
    color: #1B2A3E;
    margin: 16px 0 6px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid #EFF6FC;
  }
  .help-content h3:first-child { margin-top: 0; }
  .help-content p {
    font-size: 13px;
    color: #323130;
    margin: 0 0 10px 0;
    line-height: 1.6;
  }
  .help-content ul {
    margin: 4px 0 10px 0;
    padding-left: 18px;
  }
  .help-content li {
    font-size: 13px;
    color: #323130;
    margin-bottom: 5px;
    line-height: 1.5;
  }
  .help-content strong { color: #0078D4; font-weight: 600; }
  .help-content em { color: #605E5C; }
  .help-content code {
    background: #F3F2F1;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 12px;
    font-family: Consolas, monospace;
  }
`;

// ── HelpPanel ─────────────────────────────────────────────
export const HelpPanel: React.FC = () => {
  const { isOpen, close, setHasContent } = useHelp();
  const { pathname } = useLocation();
  const { user, roles } = useEffectiveUser();

  const [content,  setContent]  = useState<HelpContent | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [screenId, setScreenId] = useState<string | null>(null);

  // Derivar screenId al cambiar de ruta
  useEffect(() => {
    setScreenId(getScreenId(pathname));
    setContent(null);
  }, [pathname]);

  // Verificación en background: ¿existe ayuda activa para esta pantalla?
  // Determina si el botón ? se muestra o se oculta.
  useEffect(() => {
    if (!screenId) {
      setHasContent(false);
      return;
    }
    setHasContent(null); // reseteamos a "comprobando"
    let cancelled = false;
    getHelpForScreen(screenId, user.role).then((data) => {
      if (!cancelled) setHasContent(data !== null);
    });
    return () => { cancelled = true; };
  }, [screenId, user.role, setHasContent]);

  // Cargar contenido completo al abrir el panel
  useEffect(() => {
    if (!isOpen || !screenId) return;
    let cancelled = false;
    setLoading(true);
    getHelpForScreen(screenId, user.role)
      .then((data) => { if (!cancelled) setContent(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, screenId, user.role]);

  // ── Render ────────────────────────────────────────────
  // Panel siempre en DOM, visible u oculto mediante transform
  return (
    <>
      <style>{htmlStyles}</style>

      {/* Overlay semitransparente — solo visible cuando el panel está abierto */}
      {isOpen && (
        <div
          onClick={close}
          style={{
            position:   "fixed",
            inset:      0,
            background: "rgba(0,0,0,0.18)",
            zIndex:     1099,
          }}
        />
      )}

      {/* Panel lateral */}
      <aside
        role="complementary"
        aria-label="Ayuda contextual"
        aria-hidden={!isOpen}
        style={{
          position:       "fixed",
          top:            0,
          right:          0,
          bottom:         0,
          width:          PANEL_W,
          background:     "#FFFFFF",
          borderLeft:     "1px solid #C7E0F4",
          boxShadow:      "-4px 0 20px rgba(0,90,158,0.12)",
          zIndex:         1100,
          display:        "flex",
          flexDirection:  "column",
          transform:      isOpen ? "translateX(0)" : `translateX(${PANEL_W + 10}px)`,
          transition:     "transform 260ms cubic-bezier(0.16,1,0.3,1)",
          willChange:     "transform",
          overflowY:      "hidden",
          fontFamily:     "'Segoe UI', system-ui, sans-serif",
        }}
      >
        {/* ── Cabecera ── */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          gap:            8,
          height:         HEADER_H,
          padding:        "0 16px",
          background:     "linear-gradient(135deg, #0078D4 0%, #005A9E 100%)",
          flexShrink:     0,
        }}>
          <HelpCircle size={18} color="#fff" />
          <span style={{
            flex:       1,
            color:      "#fff",
            fontSize:   14,
            fontWeight: 600,
            overflow:   "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {loading ? "Cargando ayuda…" : (content?.title ?? "Ayuda")}
          </span>
          <button
            onClick={close}
            aria-label="Cerrar panel de ayuda"
            style={{
              display:     "flex",
              alignItems:  "center",
              justifyContent: "center",
              width:       28,
              height:      28,
              border:      "none",
              borderRadius: 4,
              background:  "rgba(255,255,255,0.15)",
              color:       "#fff",
              cursor:      "pointer",
              padding:     0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Contenido ── */}
        <div style={{
          flex:      1,
          overflowY: "auto",
          padding:   "20px 20px 32px",
        }}>
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#605E5C", fontSize: 13 }}>
              <RefreshCw size={14} style={{ animation: "help-spin 1s linear infinite" }} />
              Cargando…
              <style>{`@keyframes help-spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {!loading && !content && screenId && (
            <div style={{
              textAlign:  "center",
              padding:    "40px 16px",
              color:      "#8A8886",
              fontSize:   13,
            }}>
              <HelpCircle size={32} color="#C7E0F4" style={{ marginBottom: 12 }} />
              <p style={{ margin: 0 }}>No hay ayuda disponible para esta pantalla.</p>
              {roles.includes("Admin") && (
                <p style={{ margin: "8px 0 0", fontSize: 12 }}>
                  Puedes añadirla desde{" "}
                  <a href="#/admin/help" style={{ color: "#0078D4" }}>
                    Administración → Ayuda
                  </a>
                  .
                </p>
              )}
            </div>
          )}

          {!loading && !screenId && (
            <div style={{ color: "#8A8886", fontSize: 13, textAlign: "center", padding: "40px 16px" }}>
              Navega a una pantalla para ver su ayuda contextual.
            </div>
          )}

          {!loading && content && (
            <div
              className="help-content"
              // Solo Admins editan este contenido — no es input de usuario final
              dangerouslySetInnerHTML={{ __html: content.contentHtml }}
            />
          )}
        </div>

        {/* ── Pie ── */}
        <div style={{
          flexShrink:   0,
          borderTop:    "1px solid #EFF6FC",
          padding:      "10px 16px",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "space-between",
          background:   "#F8FBFE",
        }}>
          <span style={{ fontSize: 11, color: "#8A8886" }}>
            {screenId ? `Pantalla: ${screenId}` : "—"}
          </span>
          {content?.updatedOn && (
            <span style={{ fontSize: 11, color: "#8A8886" }}>
              Act. {new Date(content.updatedOn).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
      </aside>
    </>
  );
};

// ── HelpButton ────────────────────────────────────────────
// Botón flotante "?" — visible solo cuando hay ayuda activa en la pantalla actual.
export const HelpButton: React.FC = () => {
  const { toggle, isOpen, hasContent } = useHelp();

  // Ocultar completamente si se confirmó que no hay contenido activo
  if (hasContent === false) return null;

  return (
    <button
      onClick={toggle}
      aria-label={isOpen ? "Cerrar ayuda" : "Abrir ayuda contextual"}
      title={isOpen ? "Cerrar ayuda" : "Ayuda de esta pantalla"}
      style={{
        position:       "fixed",
        bottom:         24,
        right:          isOpen ? PANEL_W + 16 : 24,
        width:          40,
        height:         40,
        borderRadius:   "50%",
        border:         "none",
        background:     isOpen ? "#005A9E" : "#0078D4",
        color:          "#fff",
        cursor:         hasContent === null ? "default" : "pointer",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        boxShadow:      "0 3px 12px rgba(0,90,158,0.35)",
        zIndex:         1101,
        transition:     "right 260ms cubic-bezier(0.16,1,0.3,1), background 150ms, opacity 200ms",
        flexShrink:     0,
        // Mientras se comprueba (null) se muestra semitransparente sin interacción
        opacity:        hasContent === null ? 0.45 : 1,
        pointerEvents:  hasContent === null ? "none" : "auto",
      }}
      onMouseEnter={(e) => {
        if (hasContent) (e.currentTarget as HTMLButtonElement).style.background = "#004B82";
      }}
      onMouseLeave={(e) => {
        if (hasContent) (e.currentTarget as HTMLButtonElement).style.background = isOpen ? "#005A9E" : "#0078D4";
      }}
    >
      {isOpen ? <X size={18} /> : <HelpCircle size={20} />}
    </button>
  );
};
