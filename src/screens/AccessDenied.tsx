import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldX } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export const AccessDenied: React.FC = () => {
  const navigate = useNavigate();
  const { roles } = useAuth();

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  minHeight: "100%", padding: 48, background: "#FAF9F8",
                  fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 400, textAlign: "center" }}>

        {/* Icon */}
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#FDE7E9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 24px" }}>
          <ShieldX size={34} color="#D13438" strokeWidth={1.5} />
        </div>

        {/* Copy */}
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#201F1E", margin: "0 0 10px" }}>
          Acceso denegado
        </h1>
        <p style={{ fontSize: 14, color: "#605E5C", lineHeight: 1.6, margin: "0 0 6px" }}>
          No tienes permiso para acceder a esta sección.
        </p>
        <p style={{ fontSize: 12, color: "#A19F9D", margin: "0 0 28px" }}>
          Rol actual:&nbsp;<strong style={{ color: "#605E5C" }}>{roles.join(", ")}</strong>
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            onClick={() => navigate(-1)}
            style={{ padding: "8px 20px", border: "1px solid #C8C6C4", borderRadius: 4,
                     background: "#fff", color: "#201F1E", fontSize: 13, cursor: "pointer",
                     fontFamily: "'Segoe UI', sans-serif" }}
          >
            Volver
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            style={{ padding: "8px 20px", border: "none", borderRadius: 4,
                     background: "#0078D4", color: "#fff", fontSize: 13, cursor: "pointer",
                     fontFamily: "'Segoe UI', sans-serif" }}
          >
            Ir al inicio
          </button>
        </div>

        {/* Help line */}
        <p style={{ fontSize: 11, color: "#A19F9D", marginTop: 24 }}>
          Si crees que es un error, contacta con el administrador de la app.
        </p>
      </div>
    </div>
  );
};
