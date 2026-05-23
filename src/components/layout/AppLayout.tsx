import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TestModeBanner } from "./TestModeBanner";
import { GlobalFilterBar } from "./GlobalFilterBar";
import { layout } from "../ui/tokens";
import { HelpProvider } from "../../context/HelpContext";
import { HelpPanel, HelpButton } from "../help/HelpPanel";

// ── LayoutMode Context ────────────────────────────────────
// Pantallas "contained" (Inicio, Usuarios, Config, RBAC): max-width 1100px centrado.
// Pantallas "full" (Kanban, Gantt, Backlog, Auditoría): 100% de ancho disponible.

export type LayoutMode = "full" | "contained";

interface LayoutModeContextValue {
  mode: LayoutMode;
  setMode: (m: LayoutMode) => void;
}

export const LayoutModeContext = React.createContext<LayoutModeContextValue>({
  mode: "full",
  setMode: () => undefined,
});

/** Hook para que las pantallas declaren su propio modo. */
export const useLayoutMode = () => React.useContext(LayoutModeContext);

// ── AppLayout ─────────────────────────────────────────────
export const AppLayout: React.FC = () => {
  const [mode, setMode] = React.useState<LayoutMode>("full");

  return (
    <LayoutModeContext.Provider value={{ mode, setMode }}>
      <HelpProvider>
        <div style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        }}>
          {/* Sidebar con scroll propio */}
          <Sidebar />

          {/* Área principal — única zona de scroll */}
          <main style={{
            flex: 1,
            background: "#FAF9F8",
            overflowY: "auto",
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}>
            <TestModeBanner />
            <GlobalFilterBar />

            {/* Contenedor de pantalla */}
            <div style={{
              flex: 1,
              width: "100%",
              boxSizing: "border-box",
              ...(mode === "contained"
                ? {
                    maxWidth: layout.containedMax,
                    marginLeft: "auto",
                    marginRight: "auto",
                  }
                : {}),
            }}>
              <Outlet />
            </div>
          </main>
        </div>

        {/* Panel de ayuda y botón flotante — fuera del scroll de main */}
        <HelpPanel />
        <HelpButton />
      </HelpProvider>
    </LayoutModeContext.Provider>
  );
};
