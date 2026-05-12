// ─────────────────────────────────────────────────────────
//  src/auth/usePermission.ts
//  Hook para comprobar un permiso RBAC dinámico en cliente.
//
//  Carga /admin/role-permissions una sola vez por sesión
//  (caché a nivel de módulo). No hay peticiones repetidas
//  aunque el hook se monte en múltiples componentes.
//
//  Uso:
//    const { allowed, loading } = usePermission("VIEW_REPORTS");
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { getRolePermissions } from "../services/adminService";
import { useEffectiveUser } from "./ImpersonationContext";

// ── Caché de módulo ───────────────────────────────────────
let _cache: Record<string, Record<string, boolean>> | null = null;
let _pending: Promise<Record<string, Record<string, boolean>>> | null = null;

async function loadRolePermissions(): Promise<Record<string, Record<string, boolean>>> {
  if (_cache) return _cache;
  if (!_pending) {
    _pending = getRolePermissions().then((data) => {
      _cache = data.rolePermissions as Record<string, Record<string, boolean>>;
      return _cache;
    });
  }
  return _pending;
}

/** Invalida la caché (útil tras resetear permisos desde Admin). */
export function invalidatePermissionCache(): void {
  _cache   = null;
  _pending = null;
}

// ── Hook principal ────────────────────────────────────────
export interface UsePermissionResult {
  /** true si el usuario efectivo tiene el permiso. */
  allowed: boolean;
  /** true mientras carga la primera vez. */
  loading: boolean;
}

export function usePermission(permissionKey: string): UsePermissionResult {
  const { user } = useEffectiveUser();
  const [state, setState] = useState<UsePermissionResult>({ allowed: false, loading: true });

  useEffect(() => {
    let cancelled = false;

    loadRolePermissions()
      .then((perm) => {
        if (cancelled) return;
        const role = user?.role ?? "";
        const allowed = perm[role]?.[permissionKey] ?? false;
        setState({ allowed, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ allowed: false, loading: false });
      });

    return () => { cancelled = true; };
  // Solo re-ejecutar si cambia el usuario efectivo o la clave
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionKey, user?.role]);

  return state;
}
