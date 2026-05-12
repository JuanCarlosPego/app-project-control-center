// ─────────────────────────────────────────────────────────
//  src/router/PermissionRoute.tsx
//  Guard de ruta basado en permiso RBAC dinámico.
//
//  Diferencia con ProtectedRoute: en lugar de comprobar el
//  rol directamente comprueba una clave de permiso cargada
//  desde /admin/role-permissions (configurable en runtime).
//
//  Mientras carga: pantalla en blanco (evita flash de /access-denied).
//  Si loading=false y allowed=false: redirige a /access-denied.
// ─────────────────────────────────────────────────────────
import React from "react";
import { Navigate } from "react-router-dom";
import { usePermission } from "../auth/usePermission";

interface Props {
  permissionKey: string;
  children:      React.ReactNode;
}

export const PermissionRoute: React.FC<Props> = ({ permissionKey, children }) => {
  const { allowed, loading } = usePermission(permissionKey);

  // Mientras carga la primera vez, no redirige para evitar flash.
  if (loading) return null;

  return allowed ? <>{children}</> : <Navigate to="/access-denied" replace />;
};
