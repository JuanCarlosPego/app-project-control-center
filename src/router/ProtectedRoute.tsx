import React from "react";
import { Navigate } from "react-router-dom";
import { useEffectiveUser } from "../auth/ImpersonationContext";
import { hasRole, type AppRole } from "../auth/permissions";

interface Props { requiredRoles: AppRole[]; children: React.ReactNode; }

/**
 * Wraps a route: si el usuario efectivo (real o simulado) no tiene los roles
 * requeridos, redirige a /access-denied.
 * Usa effectiveUser para respetar la simulación activa.
 */
export const ProtectedRoute: React.FC<Props> = ({ requiredRoles, children }) => {
  const { roles } = useEffectiveUser();
  return hasRole(roles, requiredRoles)
    ? <>{children}</>
    : <Navigate to="/access-denied" replace />;
};
