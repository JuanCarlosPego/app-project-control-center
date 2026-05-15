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

// Contador de versión: se incrementa con cada invalidación para
// forzar el re-render de los hooks que dependen de él.
let _version = 0;
const _listeners = new Set<() => void>();

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

/** Invalida la caché y notifica a los hooks suscritos para que recarguen. */
export function invalidatePermissionCache(): void {
  _cache   = null;
  _pending = null;
  _version += 1;
  _listeners.forEach((fn) => fn());
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
  const [, setVer] = useState(_version);

  // Suscribirse a invalidaciones de caché
  useEffect(() => {
    const notify = () => setVer((v) => v + 1);
    _listeners.add(notify);
    return () => { _listeners.delete(notify); };
  }, []);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionKey, user?.role, _version]);

  return state;
}

// ── Hook bulk: todos los permisos del usuario efectivo ────
export interface UseRolePermissionsResult {
  /** Mapa clave→boolean para el rol del usuario efectivo. */
  permissions: Record<string, boolean>;
  loading: boolean;
}

export function useRolePermissions(): UseRolePermissionsResult {
  const { user } = useEffectiveUser();
  const [state, setState] = useState<UseRolePermissionsResult>({ permissions: {}, loading: true });
  const [, setVer] = useState(_version);

  // Suscribirse a invalidaciones de caché
  useEffect(() => {
    const notify = () => setVer((v) => v + 1);
    _listeners.add(notify);
    return () => { _listeners.delete(notify); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadRolePermissions()
      .then((perm) => {
        if (cancelled) return;
        const role = user?.role ?? "";
        setState({ permissions: perm[role] ?? {}, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ permissions: {}, loading: false });
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, _version]);

  return state;
}


