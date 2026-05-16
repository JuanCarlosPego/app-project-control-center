// ─────────────────────────────────────────────────────────
//  src/auth/usePermission.ts
//  Gestión de permisos efectivos en cliente.
//
//  Arquitectura:
//    GET /api/users/:userId/effective-permissions
//    → resuelve: Admin bypass | rol base | perfiles | overrides
//    → retorna { permissions, fromProfiles, overrides }
//
//  La caché es por userId. Al cambiar de usuario (impersonación),
//  la caché del anterior se mantiene y la del nuevo se carga fresh.
//  invalidatePermissionCache() borra todas las entradas y notifica.
//
//  Uso:
//    const { allowed, loading } = usePermission("REQUEST_CREATE");
//    const { permissions }      = useRolePermissions();
//    const perms                = useEffectivePermissions(); // objeto completo
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { getEffectivePermissions } from "../services/profileService";
import { useEffectiveUser } from "./ImpersonationContext";
import type { AppRole, EffectivePermissions } from "../types/domain";

// ── Caché por userId ──────────────────────────────────────
const _cache   = new Map<string, EffectivePermissions>();
const _pending = new Map<string, Promise<EffectivePermissions>>();

let _version = 0;
const _listeners = new Set<() => void>();

async function loadEffectivePerms(userId: string): Promise<EffectivePermissions> {
  const cached = _cache.get(userId);
  if (cached) return cached;

  let pending = _pending.get(userId);
  if (!pending) {
    pending = getEffectivePermissions(userId).then((data) => {
      _cache.set(userId, data);
      _pending.delete(userId);
      return data;
    });
    _pending.set(userId, pending);
  }
  return pending;
}

/** Invalida toda la caché de permisos efectivos y notifica a los hooks. */
export function invalidatePermissionCache(): void {
  _cache.clear();
  _pending.clear();
  _version += 1;
  _listeners.forEach((fn) => fn());
}

// ── Función pura hasPermission ────────────────────────────
/**
 * Comprueba si el usuario tiene un permiso específico.
 * Prioridad: Admin bypass → efectivo pre-resuelto.
 * Solo para uso fuera de hooks (servicios, validaciones).
 */
export function hasPermission(
  effectivePermissions: Record<string, boolean>,
  key: string,
  userRole?: AppRole,
): boolean {
  if (userRole === "Admin") return true;
  return effectivePermissions[key] ?? false;
}

// ── Hook principal ────────────────────────────────────────
export interface UsePermissionResult {
  /** true si el usuario efectivo tiene el permiso (resuelto con perfil + overrides). */
  allowed: boolean;
  /** true mientras carga la primera vez. */
  loading: boolean;
}

export function usePermission(permissionKey: string): UsePermissionResult {
  const { user } = useEffectiveUser();
  const [state, setState] = useState<UsePermissionResult>({ allowed: false, loading: true });
  const [, setVer] = useState(_version);

  useEffect(() => {
    const notify = () => setVer((v) => v + 1);
    _listeners.add(notify);
    return () => { _listeners.delete(notify); };
  }, []);

  useEffect(() => {
    if (!user?.id) { setState({ allowed: false, loading: false }); return; }
    let cancelled = false;

    loadEffectivePerms(user.id)
      .then((ep) => {
        if (cancelled) return;
        setState({ allowed: ep.permissions[permissionKey] ?? false, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ allowed: false, loading: false });
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissionKey, user?.id, _version]);

  return state;
}

// ── Hook bulk: todos los permisos del usuario efectivo ────
export interface UseRolePermissionsResult {
  /** Mapa clave→boolean (resuelto: rol + perfiles + overrides). */
  permissions: Record<string, boolean>;
  loading: boolean;
}

export function useRolePermissions(): UseRolePermissionsResult {
  const { user } = useEffectiveUser();
  const [state, setState] = useState<UseRolePermissionsResult>({ permissions: {}, loading: true });
  const [, setVer] = useState(_version);

  useEffect(() => {
    const notify = () => setVer((v) => v + 1);
    _listeners.add(notify);
    return () => { _listeners.delete(notify); };
  }, []);

  useEffect(() => {
    if (!user?.id) { setState({ permissions: {}, loading: false }); return; }
    let cancelled = false;

    loadEffectivePerms(user.id)
      .then((ep) => {
        if (cancelled) return;
        setState({ permissions: ep.permissions, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ permissions: {}, loading: false });
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, _version]);

  return state;
}

// ── Hook completo: objeto EffectivePermissions ────────────
export interface UseEffectivePermissionsResult {
  effectivePerms: EffectivePermissions | null;
  loading: boolean;
}

export function useEffectivePermissions(): UseEffectivePermissionsResult {
  const { user } = useEffectiveUser();
  const [state, setState] = useState<UseEffectivePermissionsResult>({ effectivePerms: null, loading: true });
  const [, setVer] = useState(_version);

  useEffect(() => {
    const notify = () => setVer((v) => v + 1);
    _listeners.add(notify);
    return () => { _listeners.delete(notify); };
  }, []);

  useEffect(() => {
    if (!user?.id) { setState({ effectivePerms: null, loading: false }); return; }
    let cancelled = false;

    loadEffectivePerms(user.id)
      .then((ep) => {
        if (cancelled) return;
        setState({ effectivePerms: ep, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ effectivePerms: null, loading: false });
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, _version]);

  return state;
}


