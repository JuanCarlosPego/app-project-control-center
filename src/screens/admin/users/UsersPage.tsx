// ─────────────────────────────────────────────────────────
//  src/screens/admin/users/UsersPage.tsx
//  Ruta: /admin/users — solo rol "Admin"
// ─────────────────────────────────────────────────────────

import React, {
  useCallback, useEffect, useRef, useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Search, X, Pencil, UserCheck, UserX,
  RotateCw, ChevronDown, ShieldCheck, Building2, ArrowRight, Network, Layers,
} from "lucide-react";
import type { AppUser, TenantUser, AppRole, Team, TeamType, PermissionProfile } from "../../../types/domain";
import {
  getAppUsers, createAppUser, updateAppUser,
  activateAppUser, deactivateAppUser, searchTenantUsers,
} from "../../../services/userManagementService";
import { listTeams } from "../../../services/teamService";
import {
  getPermissionProfiles,
  assignProfileToUser, removeProfileFromUser,
} from "../../../services/profileService";
import { invalidatePermissionCache } from "../../../auth/usePermission";
import { UserAvatar } from "../../../components/ui/UserAvatar";
import {
  AdminToastContainer, newAdminToast, type ToastMsg,
} from "../components/shared";

// ── Constantes ────────────────────────────────────────────
const ALL_ROLES: AppRole[] = [
  "Admin", "IT AirEuropa", "Proveedor", "Usuario", "Invitado",
];

const TEAM_TYPES: TeamType[] = ["Area", "Provider", "Internal"];

const TEAM_TYPE_LABELS: Record<TeamType, string> = {
  Area:     "Área",
  Provider: "Proveedor",
  Internal: "Interno",
};

const TEAM_TYPE_COLORS: Record<TeamType, { bg: string; color: string; border: string }> = {
  Area:     { bg: "#EFF6FC", color: "#0078D4", border: "#C7E0F4" },
  Provider: { bg: "#FEF9F0", color: "#CA8B00", border: "#F2D98B" },
  Internal: { bg: "#F3FBF5", color: "#107C10", border: "#B7E0B8" },
};

const ROLE_CHIP: Record<AppRole, { bg: string; color: string; border: string }> = {
  "Admin":        { bg: "#EFF6FC", color: "#0078D4", border: "#C7E0F4" },
  "IT AirEuropa": { bg: "#F3FBF5", color: "#107C10", border: "#B7E0B8" },
  "Proveedor":    { bg: "#FEF9F0", color: "#CA8B00", border: "#F2D98B" },
  "Usuario":      { bg: "#F8F0FF", color: "#7530AF", border: "#D8B4FE" },
  "Invitado":     { bg: "#FAF9F8", color: "#A19F9D", border: "#EDEBE9" },
};

const F = "'Segoe UI', sans-serif";

// ── Chip: Rol ─────────────────────────────────────────────
const RoleChip: React.FC<{ role: AppRole }> = ({ role }) => {
  const c = ROLE_CHIP[role] ?? { bg: "#FAF9F8", color: "#605E5C", border: "#EDEBE9" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      fontFamily: F, whiteSpace: "nowrap",
    }}>
      {role}
    </span>
  );
};

// ── Chip: Estado ──────────────────────────────────────────
const StatusChip: React.FC<{ active: boolean }> = ({ active }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "2px 10px", borderRadius: 20,
    fontSize: 11, fontWeight: 700,
    background: active ? "#DFF6DD" : "#FAF9F8",
    color:      active ? "#107C10" : "#A19F9D",
    border:     `1px solid ${active ? "#92C353" : "#EDEBE9"}`,
    fontFamily: F, whiteSpace: "nowrap",
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: active ? "#107C10" : "#C8C6C4", flexShrink: 0,
    }} />
    {active ? "Activo" : "Inactivo"}
  </span>
);

// ── Select decorado ───────────────────────────────────────
const FilterSelect: React.FC<{
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: "7px 34px 7px 12px", border: "1px solid #EDEBE9",
        borderRadius: 6, fontSize: 12, fontWeight: value ? 700 : 400,
        color: value ? "#201F1E" : "#A19F9D", fontFamily: F,
        background: "#fff", appearance: "none", cursor: "pointer",
        outline: "none", minWidth: 120,
      }}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    <ChevronDown size={12} color="#A19F9D" style={{ position: "absolute", right: 10, pointerEvents: "none" }} />
  </div>
);

// ── Botón outline ─────────────────────────────────────────
const OutlineBtn: React.FC<{
  onClick: () => void; icon?: React.ReactNode; children: React.ReactNode;
  danger?: boolean; disabled?: boolean;
}> = ({ onClick, icon, children, danger = false, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 12px", borderRadius: 6,
      fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      border: `1px solid ${danger ? "#F4B8BB" : "#EDEBE9"}`,
      background: danger ? "#FDE7E9" : "#fff",
      color: disabled ? "#C8C6C4" : danger ? "#A4262C" : "#201F1E",
      fontFamily: F, whiteSpace: "nowrap", transition: "background 140ms",
    }}
    onMouseEnter={e => {
      if (!disabled) {
        (e.currentTarget as HTMLButtonElement).style.background = danger ? "#F9D0D2" : "#F3F2F1";
      }
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLButtonElement).style.background = danger ? "#FDE7E9" : "#fff";
    }}
  >
    {icon}
    {children}
  </button>
);

// ── TeamMultiSelect — dropdown con checkboxes agrupados por tipo ────────
const TeamMultiSelect: React.FC<{
  teams: Team[];
  selected: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  warning?: string;
}> = ({ teams, selected, onChange, error, warning }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const grouped = TEAM_TYPES.reduce<Record<TeamType, Team[]>>(
    (acc, t) => { acc[t] = teams.filter((tm) => tm.type === t); return acc; },
    { Area: [], Provider: [], Internal: [] },
  );

  const selectedTeams = teams.filter((t) => selected.includes(t.id));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: 6, cursor: "pointer",
          border: `1px solid ${error ? "#D13438" : open ? "#0078D4" : "#EDEBE9"}`,
          background: "#fff", minHeight: 38, transition: "border-color 150ms",
        }}
      >
        <span style={{ fontSize: 13, color: selected.length ? "#201F1E" : "#A19F9D", fontFamily: F }}>
          {selected.length === 0
            ? "— Selecciona equipos —"
            : `${selected.length} equipo${selected.length > 1 ? "s" : ""} seleccionado${selected.length > 1 ? "s" : ""}`
          }
        </span>
        <ChevronDown
          size={13} color="#A19F9D"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms", flexShrink: 0 }}
        />
      </div>

      {/* Chips de seleccionados */}
      {selectedTeams.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {selectedTeams.map((t) => {
            const cfg = TEAM_TYPE_COLORS[t.type];
            return (
              <span
                key={t.id}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "2px 6px 2px 8px", borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                  fontFamily: F,
                }}
              >
                {t.name}
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(t.id); }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: 0, display: "flex", color: cfg.color,
                  }}
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1px solid #EDEBE9", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 100,
          maxHeight: 260, overflowY: "auto",
        }}>
          {TEAM_TYPES.map((type) => {
            const typeTeams = grouped[type];
            if (typeTeams.length === 0) return null;
            const cfg = TEAM_TYPE_COLORS[type];
            return (
              <div key={type}>
                <div style={{
                  padding: "8px 12px 4px",
                  fontSize: 10, fontWeight: 700, color: cfg.color,
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  background: cfg.bg, fontFamily: F, borderBottom: `1px solid ${cfg.border}`,
                }}>
                  {TEAM_TYPE_LABELS[type]}
                </div>
                {typeTeams.map((team) => {
                  const checked = selected.includes(team.id);
                  return (
                    <label
                      key={team.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 14px", cursor: "pointer",
                        background: checked ? cfg.bg : "transparent",
                        borderBottom: "1px solid #F3F2F1",
                        transition: "background 100ms",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(team.id)}
                        style={{ accentColor: cfg.color, width: 14, height: 14, flexShrink: 0 }}
                      />
                      <span style={{
                        fontSize: 13, color: "#201F1E", fontFamily: F,
                        fontWeight: checked ? 600 : 400,
                      }}>
                        {team.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            );
          })}
          {teams.length === 0 && (
            <div style={{ padding: "16px 14px", fontSize: 12, color: "#A19F9D", fontFamily: F }}>
              No hay equipos activos disponibles.
            </div>
          )}
        </div>
      )}

      {error   && <div style={{ fontSize: 11, color: "#D13438", marginTop: 4, fontFamily: F }}>{error}</div>}
      {!error && warning && (
        <div style={{ fontSize: 11, color: "#CA8B00", marginTop: 4, fontFamily: F }}>⚠ {warning}</div>
      )}
    </div>
  );
};

// ── Confirm modal ─────────────────────────────────────────
const ConfirmModal: React.FC<{
  open: boolean; title: string; message: string;
  confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}> = ({ open, title, message, confirmLabel = "Confirmar", danger = false, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: "28px 32px",
        maxWidth: 400, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", fontFamily: F,
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#201F1E", margin: "0 0 10px" }}>{title}</h2>
        <p style={{ fontSize: 13, color: "#605E5C", margin: "0 0 24px", lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            padding: "8px 20px", borderRadius: 6, border: "1px solid #EDEBE9",
            background: "#fff", color: "#201F1E", fontSize: 13, cursor: "pointer", fontFamily: F, fontWeight: 600,
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            padding: "8px 20px", borderRadius: 6, border: "none",
            background: danger ? "#D13438" : "#0078D4",
            color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: F, fontWeight: 600,
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

// ── People Picker ─────────────────────────────────────────
const PeoplePicker: React.FC<{
  onSelect: (u: TenantUser) => void;
  excludeUpns: string[];
}> = ({ onSelect, excludeUpns }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounce.current);
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    debounce.current = setTimeout(() => {
      searchTenantUsers(q)
        .then((r) => setResults(r.filter((u) => !excludeUpns.includes(u.upn.toLowerCase()))))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
  }, [q, excludeUpns]);

  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#605E5C", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Buscar usuario del tenant
      </label>
      <div style={{ position: "relative" }}>
        <Search size={14} color="#A19F9D" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, email o UPN…"
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "9px 10px 9px 32px", border: "1px solid #EDEBE9",
            borderRadius: 6, fontSize: 13, fontFamily: F, color: "#201F1E", outline: "none",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#0078D4")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#EDEBE9")}
        />
        {q && (
          <button onClick={() => { setQ(""); setResults([]); }} style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex",
          }}>
            <X size={13} color="#A19F9D" />
          </button>
        )}
      </div>
      {loading && (
        <div style={{ fontSize: 11, color: "#A19F9D", marginTop: 8, fontFamily: F }}>Buscando…</div>
      )}
      {results.length > 0 && (
        <div style={{
          marginTop: 6, border: "1px solid #EDEBE9", borderRadius: 6, overflow: "hidden",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}>
          {results.map((u) => (
            <button
              key={u.upn}
              onClick={() => { onSelect(u); setQ(""); setResults([]); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "9px 12px", background: "#fff", border: "none",
                borderBottom: "1px solid #F3F2F1", cursor: "pointer", textAlign: "left",
                transition: "background 130ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F2F1")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              <UserAvatar displayName={u.displayName} upn={u.upn} size={30} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#201F1E", fontFamily: F }}>{u.displayName}</div>
                <div style={{ fontSize: 11, color: "#A19F9D", fontFamily: F }}>{u.upn}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {!loading && q.length >= 2 && results.length === 0 && (
        <div style={{ fontSize: 11, color: "#A19F9D", marginTop: 8, fontFamily: F }}>
          No se encontraron usuarios. ¿Ya está añadido?
        </div>
      )}
    </div>
  );
};

// ── ProfileMultiSelect: chips de perfiles adicionales ─────
const ProfileMultiSelect: React.FC<{
  profiles: PermissionProfile[];
  selected: string[];
  onChange: (ids: string[]) => void;
}> = ({ profiles, selected, onChange }) => {
  const active = profiles.filter((p) => p.isActive);
  if (active.length === 0) return (
    <div style={{ fontSize: 12, color: "#A19F9D", fontFamily: F }}>No hay perfiles disponibles.</div>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {active.map((p) => {
        const on = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            title={p.description}
            onClick={() => onChange(on ? selected.filter((x) => x !== p.id) : [...selected, p.id])}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 20,
              fontSize: 12, fontWeight: on ? 700 : 400,
              border: `1px solid ${on ? "#7530AF" : "#EDEBE9"}`,
              background: on ? "#F8F0FF" : "#fff",
              color: on ? "#7530AF" : "#605E5C",
              cursor: "pointer", fontFamily: F, transition: "all 120ms",
            }}
          >
            <Layers size={11} />
            {p.label} ({p.name})
            {on && <span style={{ fontSize: 10, color: "#7530AF", marginLeft: 2 }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
};

// ── Drawer: Añadir / Editar usuario ──────────────────────
type DrawerMode = "add" | "edit";

interface DrawerState {
  open: boolean;
  mode: DrawerMode;
  user: AppUser | null;
}

const UserDrawer: React.FC<{
  state: DrawerState;
  existingUpns: string[];
  teams: Team[];
  profiles: PermissionProfile[];
  onClose: () => void;
  onSaved: (u: AppUser) => void;
  addToast: (t: string, ok?: boolean) => void;
}> = ({ state, existingUpns, teams, profiles, onClose, onSaved, addToast }) => {
  const { open, mode, user } = state;

  // Form state
  const [selected,   setSelected]   = useState<TenantUser | null>(null);
  const [role,       setRole]       = useState<AppRole>("Usuario");
  const [teamIds,    setTeamIds]    = useState<string[]>([]);
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [isActive,   setIsActive]   = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [dupWarning, setDupWarning] = useState(false);
  const [errors,     setErrors]     = useState<{ teamIds?: string }>({});

  // Inicializar al abrir
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && user) {
      setSelected({ upn: user.upn, displayName: user.displayName, email: user.email });
      setRole(user.role);
      setTeamIds(user.teamIds ?? []);
      setProfileIds(user.profileIds ?? []);
      setIsActive(user.isActive);
      setDupWarning(false);
    } else {
      setSelected(null);
      setRole("Usuario");
      setTeamIds([]);
      setProfileIds([]);
      setIsActive(true);
      setDupWarning(false);
    }
    setErrors({});
    setSaving(false);
  }, [open, mode, user]);

  const handleSelectTenant = (u: TenantUser) => {
    const isDup = existingUpns.includes(u.upn.toLowerCase());
    setSelected(u);
    setDupWarning(isDup);
  };

  const handleSave = async () => {
    if (!selected) return;
    // Validar: Proveedor necesita al menos 1 equipo de tipo Provider
    const errs: { teamIds?: string } = {};
    if (role === "Proveedor") {
      const hasProvider = teams
        .filter((t) => t.type === "Provider")
        .some((t) => teamIds.includes(t.id));
      if (!hasProvider) {
        errs.teamIds = "Un Proveedor debe pertenecer al menos a un equipo de tipo 'Proveedor'.";
      }
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSaving(true);
    try {
      let saved: AppUser;
      if (mode === "add") {
        saved = await createAppUser({
          displayName: selected.displayName,
          email: selected.email,
          upn: selected.upn,
          role,
          teamIds,
        });
        // Asignar perfiles al nuevo usuario
        for (const pid of profileIds) {
          await assignProfileToUser(saved.id, pid);
        }
        if (profileIds.length > 0) invalidatePermissionCache();
        addToast(`Usuario '${saved.displayName}' añadido.`);
      } else {
        saved = await updateAppUser(user!.id, {
          role,
          isActive,
          teamIds,
        });
        // Sincronizar perfiles: diff entre los anteriores y los nuevos
        const prevIds = user!.profileIds ?? [];
        const toAdd    = profileIds.filter((id) => !prevIds.includes(id));
        const toRemove = prevIds.filter((id) => !profileIds.includes(id));
        for (const pid of toAdd)    await assignProfileToUser(saved.id, pid);
        for (const pid of toRemove) await removeProfileFromUser(saved.id, pid);
        if (toAdd.length > 0 || toRemove.length > 0) invalidatePermissionCache();
        addToast(`Usuario '${saved.displayName}' actualizado.`);
      }
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      addToast((e instanceof Error ? e.message : "Error al guardar."), false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#605E5C", display: "block",
    marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: F,
  };

  const roFieldStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    padding: "9px 12px", border: "1px solid #EDEBE9",
    borderRadius: 6, fontSize: 13, fontFamily: F,
    color: "#A19F9D", background: "#FAFAFA",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 4000 }}
      />
      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 440,
        background: "#fff", zIndex: 4001,
        display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.14)",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px 16px", borderBottom: "1px solid #EDEBE9",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, background: "#EFF6FC", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldCheck size={16} color="#0078D4" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#201F1E", margin: 0, fontFamily: F }}>
              {mode === "add" ? "Añadir usuario" : "Editar usuario"}
            </h2>
            <div style={{ fontSize: 11, color: "#A19F9D", fontFamily: F, marginTop: 1 }}>
              {mode === "add" ? "Busca y asigna un rol de aplicación" : "Modifica el rol o el estado"}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 6, borderRadius: 6, color: "#A19F9D", display: "flex",
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* People Picker (solo en modo add) */}
          {mode === "add" && (
            <PeoplePicker
              onSelect={handleSelectTenant}
              excludeUpns={existingUpns}
            />
          )}

          {/* Usuario seleccionado / a editar */}
          {selected && (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", background: "#EFF6FC",
              border: "1px solid #C7E0F4", borderRadius: 8,
            }}>
              <UserAvatar displayName={selected.displayName} upn={selected.upn} size={40} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#201F1E", fontFamily: F }}>
                  {selected.displayName}
                </div>
                <div style={{ fontSize: 11, color: "#605E5C", fontFamily: F }}>{selected.email}</div>
                <div style={{ fontSize: 10, color: "#A19F9D", fontFamily: F }}>{selected.upn}</div>
              </div>
            </div>
          )}

          {/* Aviso duplicado */}
          {dupWarning && (
            <div style={{
              padding: "10px 14px", background: "#FEF9F0",
              border: "1px solid #F2D98B", borderRadius: 6,
              fontSize: 12, color: "#CA8B00", fontFamily: F, lineHeight: 1.5,
            }}>
              ⚠ Este usuario ya existe en la aplicación. Si continúas, se sobreescribirá su rol.
            </div>
          )}

          {/* Campos de solo lectura (edit mode) */}
          {mode === "edit" && user && (
            <>
              <div>
                <label style={labelStyle}>Email</label>
                <div style={roFieldStyle}>{user.email}</div>
              </div>
              <div>
                <label style={labelStyle}>UPN</label>
                <div style={roFieldStyle}>{user.upn}</div>
              </div>
            </>
          )}

          {/* Selector de Rol */}
          <div>
            <label style={labelStyle}>Rol de aplicación</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ALL_ROLES.map((r) => {
                const c = ROLE_CHIP[r];
                const checked = role === r;
                return (
                  <label
                    key={r}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 14px", borderRadius: 7, cursor: "pointer",
                      border: `1px solid ${checked ? c.border : "#EDEBE9"}`,
                      background: checked ? c.bg : "#fff",
                      transition: "background 130ms",
                    }}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={checked}
                      onChange={() => { setRole(r); setTeamIds([]); setErrors({}); }}
                      style={{ accentColor: c.color, width: 15, height: 15 }}
                    />
                    <span style={{ fontSize: 13, fontWeight: checked ? 700 : 400, color: checked ? c.color : "#201F1E", fontFamily: F }}>
                      {r}
                    </span>
                    {r === "Admin" && (
                      <span style={{ fontSize: 10, color: "#0078D4", fontFamily: F, marginLeft: "auto" }}>
                        Acceso total
                      </span>
                    )}
                    {r === "Invitado" && (
                      <span style={{ fontSize: 10, color: "#A19F9D", fontFamily: F, marginLeft: "auto" }}>
                        Solo lectura
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Equipos — multi-select con reglas por rol */}
          {role !== "Invitado" && (
            <div>
              <label style={labelStyle}>
                Equipo(s){role === "Proveedor" && <span style={{ color: "#D13438" }}> *</span>}
              </label>
              <TeamMultiSelect
                teams={teams.filter((t) => t.isActive)}
                selected={teamIds}
                onChange={(ids) => { setTeamIds(ids); setErrors({}); }}
                error={errors.teamIds}
                warning={
                  role === "Proveedor"    ? undefined
                  : role === "Usuario"    && !teams.filter((t) => t.type === "Area").some((t) => teamIds.includes(t.id))
                      ? "Se recomienda asignar al menos un equipo de tipo Área."
                  : role === "IT AirEuropa" && !teams.filter((t) => t.type === "Internal").some((t) => teamIds.includes(t.id))
                      ? "Se recomienda asignar un equipo de tipo Interno (ej. IT AirEuropa)."
                  : undefined
                }
              />
              <div style={{ fontSize: 11, color: "#A19F9D", marginTop: 4, fontFamily: F }}>
                {role === "Proveedor"    && "Selecciona equipos de tipo Proveedor (obligatorio)."}
                {role === "IT AirEuropa" && "Selecciona equipos de tipo Interno."}
                {role === "Usuario"      && "Selecciona el área o áreas a las que pertenece."}
                {role === "Admin"        && "Los Administradores pueden pertenecer a cualquier equipo."}
              </div>
            </div>
          )}

          {/* ── Perfiles adicionales (Admin only) ─────────── */}
          <div style={{
            padding: "14px 16px",
            background: "#F8F0FF",
            border: "1px solid #D8B4FE",
            borderRadius: 8,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
              <Layers size={14} color="#7530AF" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#7530AF", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: F }}>
                Perfiles adicionales
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#605E5C", marginBottom: 10, fontFamily: F, lineHeight: 1.5 }}>
              Los perfiles otorgan permisos extra sin cambiar el rol.
              Ejemplo: el perfil <strong>PO</strong> permite crear solicitudes a un Usuario normal.
            </div>
            <ProfileMultiSelect
              profiles={profiles}
              selected={profileIds}
              onChange={setProfileIds}
            />
            {profileIds.length > 0 && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid #D8B4FE" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#7530AF", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: F }}>
                  Permisos extra que se concederán
                </div>
                {profileIds.flatMap((pid) => {
                  const p = profiles.find((x) => x.id === pid);
                  return p ? [`• ${p.label} (${p.name}): ${p.description}`] : [];
                }).map((line, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#605E5C", fontFamily: F, lineHeight: 1.5 }}>{line}</div>
                ))}
              </div>
            )}
          </div>

          {/* Estado (solo edit) */}
          {mode === "edit" && (
            <div>
              <label style={labelStyle}>Estado</label>
              <div
                onClick={() => setIsActive((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 7, cursor: "pointer",
                  border: "1px solid #EDEBE9", background: "#fff",
                }}
              >
                <span style={{ fontSize: 13, color: "#201F1E", fontFamily: F, fontWeight: 600 }}>
                  {isActive ? "Activo" : "Inactivo"}
                </span>
                <div style={{
                  width: 40, height: 22, borderRadius: 11, position: "relative",
                  background: isActive ? "#0078D4" : "#C8C6C4", transition: "background 180ms",
                }}>
                  <div style={{
                    position: "absolute", top: 3,
                    left: isActive ? 20 : 3, width: 16, height: 16,
                    background: "#fff", borderRadius: "50%",
                    transition: "left 180ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid #EDEBE9",
          display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            padding: "9px 20px", borderRadius: 6, border: "1px solid #EDEBE9",
            background: "#fff", color: "#201F1E", fontSize: 13, cursor: "pointer", fontFamily: F, fontWeight: 600,
          }}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !selected}
            style={{
              padding: "9px 22px", borderRadius: 6, border: "none",
              background: saving || !selected ? "#C8C6C4" : "#0078D4",
              color: "#fff", fontSize: 13, cursor: saving || !selected ? "not-allowed" : "pointer",
              fontFamily: F, fontWeight: 700, display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {saving && <RotateCw size={13} style={{ animation: "spin 1s linear infinite" }} />}
            {saving ? "Guardando…" : mode === "add" ? "Añadir usuario" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </>
  );
};

// ── UsersPage ─────────────────────────────────────────────
export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [users,        setUsers]        = useState<AppUser[]>([]);
  const [teams,        setTeams]        = useState<Team[]>([]);
  const [profiles,     setProfiles]     = useState<PermissionProfile[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [query,        setQuery]        = useState("");
  const [filterRole,   setFilterRole]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTeam,   setFilterTeam]   = useState("");
  const [toasts,       setToasts]       = useState<ToastMsg[]>([]);
  const [drawer,       setDrawer]       = useState<DrawerState>({ open: false, mode: "add", user: null });
  const [confirm,      setConfirm]      = useState<{
    open: boolean; userId: string; action: "activate" | "deactivate"; name: string;
  }>({ open: false, userId: "", action: "deactivate", name: "" });

  const addToast = useCallback((text: string, ok = true) => {
    const t = newAdminToast(text, ok);
    setToasts((p) => [...p, t]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== t.id)), 2800);
  }, []);

  // ── Carga ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, teamsData, profilesData] = await Promise.all([
        getAppUsers({
          query:  query       || undefined,
          role:   filterRole  || undefined,
          status: filterStatus as "active" | "inactive" | "" || undefined,
          teamId: filterTeam  || undefined,
        }),
        listTeams({ isActive: true }),
        getPermissionProfiles(),
      ]);
      setUsers(data);
      setTeams(teamsData);
      setProfiles(profilesData);
      setError(null);
    } catch {
      setError("No se pudo cargar la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  }, [query, filterRole, filterStatus, filterTeam]);

  useEffect(() => { void load(); }, [load]);

  // ── Total sin filtros (para el contador) ───────────────
  const [total, setTotal] = useState(0);
  useEffect(() => {
    getAppUsers().then((d) => setTotal(d.length)).catch(() => {});
  }, [users]); // re-calcular si cambia la lista

  // ── UPNs ya registrados (para people picker dedup) ────
  const existingUpns = users.map((u) => u.upn.toLowerCase());

  // ── Acción activar/desactivar ─────────────────────────
  const handleToggleActive = async () => {
    const { userId, action } = confirm;
    setConfirm((c) => ({ ...c, open: false }));
    try {
      const updated = action === "activate"
        ? await activateAppUser(userId)
        : await deactivateAppUser(userId);
      setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
      addToast(`Usuario ${action === "activate" ? "activado" : "desactivado"}.`);
    } catch {
      addToast("Error al actualizar el estado.", false);
    }
  };

  // ── Guardar desde drawer ──────────────────────────────
  const handleSaved = (saved: AppUser) => {
    setUsers((prev) => {
      const idx = prev.findIndex((u) => u.id === saved.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
      return [...prev, saved];
    });
    void load(); // recargar desde mock para consistencia
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#FAF9F8", overflow: "hidden", fontFamily: F,
    }}>
      {/* ── Tarjeta acceso rápido: Gestión de proveedores ── */}
      <div style={{ padding: "16px 24px 0", flexShrink: 0 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "14px 20px",
          background: "#fff",
          border: "1px solid #EDEBE9",
          borderRadius: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "#FEF9F0", border: "1px solid #F2D98B",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Building2 size={20} color="#CA8B00" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#201F1E", fontFamily: F }}>
              Gestión de proveedores
            </div>
            <div style={{ fontSize: 12, color: "#605E5C", fontFamily: F, marginTop: 2 }}>
              Gestiona las empresas proveedoras y sus usuarios asociados
            </div>
          </div>
          <button
            onClick={() => navigate("/admin/providers")}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 6,
              border: "1px solid #F2D98B",
              background: "#FEF9F0", color: "#CA8B00",
              fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: F,
              whiteSpace: "nowrap", transition: "background 140ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF0C7")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FEF9F0")}
          >
            Abrir <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* ── Header ── */}
      <div style={{
        padding: "16px 24px 14px", borderBottom: "1px solid #EDEBE9",
        background: "#fff", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, background: "#EFF6FC", borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Users size={18} color="#0078D4" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: "#201F1E", margin: 0 }}>
            Gestión de Usuarios
          </h1>
          <div style={{ fontSize: 12, color: "#605E5C", marginTop: 2 }}>
            Asigna roles de aplicación a los usuarios
          </div>
        </div>
        <button
          onClick={() => setDrawer({ open: true, mode: "add", user: null })}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 6, border: "none",
            background: "#0078D4", color: "#fff", fontSize: 13,
            fontWeight: 700, cursor: "pointer", fontFamily: F,
            boxShadow: "0 1px 4px rgba(0,120,212,0.25)",
          }}
        >
          <Plus size={15} />
          Añadir usuario
        </button>
      </div>

      {/* ── Filters bar ── */}
      <div style={{
        padding: "12px 24px", borderBottom: "1px solid #EDEBE9",
        background: "#fff", flexShrink: 0,
        display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        {/* Buscador */}
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search size={14} color="#A19F9D" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o email…"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 32px 8px 32px", border: "1px solid #EDEBE9",
              borderRadius: 6, fontSize: 12, fontFamily: F, color: "#201F1E",
              outline: "none", background: "#fff",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#0078D4")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "#EDEBE9")}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex",
            }}>
              <X size={13} color="#A19F9D" />
            </button>
          )}
        </div>

        {/* Rol filter */}
        <FilterSelect
          label="Todos los roles"
          value={filterRole}
          onChange={setFilterRole}
          options={ALL_ROLES.map((r) => ({ value: r, label: r }))}
        />

        {/* Estado filter */}
        <FilterSelect
          label="Estado"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: "active", label: "Activo" },
            { value: "inactive", label: "Inactivo" },
          ]}
        />

        {/* Equipo filter */}
        <FilterSelect
          label="Todos los equipos"
          value={filterTeam}
          onChange={setFilterTeam}
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
        />

        {/* Contador */}
        <div style={{
          marginLeft: "auto", fontSize: 12, color: "#A19F9D",
          whiteSpace: "nowrap", fontWeight: 600,
        }}>
          {loading ? "…" : `${users.length} de ${total} usuarios`}
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>
        {error ? (
          <div style={{ padding: 24, color: "#A4262C", fontSize: 13 }}>{error}</div>
        ) : loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 200 }}>
            <RotateCw size={22} color="#0078D4" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : users.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#A19F9D", fontSize: 13 }}>
            No se encontraron usuarios con los filtros aplicados.
          </div>
        ) : (
          <div style={{
            background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
            overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}>
            {/* Table head */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr 1fr 0.8fr 160px",
              padding: "10px 16px",
              borderBottom: "2px solid #EDEBE9",
              background: "#FAFAFA",
            }}>
              {["Nombre", "Email", "Rol", "Equipos", "Estado", "Perfiles", "Acciones"].map((h) => (
                <div key={h} style={{
                  fontSize: 11, fontWeight: 700, color: "#A19F9D",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            {users.map((u, i) => (
              <div
                key={u.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.5fr 1fr 1.5fr 1fr 0.8fr 160px",
                  padding: "12px 16px",
                  alignItems: "center",
                  borderBottom: i < users.length - 1 ? "1px solid #F3F2F1" : "none",
                  background: i % 2 === 0 ? "#fff" : "#FAFAFA",
                  transition: "background 120ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F6F5F4")}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFAFA")}
              >
                {/* Nombre */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <UserAvatar displayName={u.displayName} upn={u.upn} size={34} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#201F1E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {u.displayName}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div style={{ fontSize: 12, color: "#605E5C", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.email}
                </div>

                {/* Rol */}
                <div><RoleChip role={u.role} /></div>

                {/* Equipos */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
                  {(u.teamIds ?? []).length === 0 ? (
                    <span style={{ fontSize: 11, color: "#C8C6C4", fontFamily: F }}>—</span>
                  ) : (
                    <>
                      {(u.teamIds ?? []).slice(0, 2).map((tid) => {
                        const t = teams.find((x) => x.id === tid);
                        if (!t) return null;
                        const cfg = TEAM_TYPE_COLORS[t.type];
                        return (
                          <span key={tid} style={{
                            display: "inline-flex", alignItems: "center",
                            padding: "1px 7px", borderRadius: 20,
                            fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
                            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                            fontFamily: F,
                          }}>
                            {t.name}
                          </span>
                        );
                      })}
                      {(u.teamIds ?? []).length > 2 && (
                        <span style={{
                          padding: "1px 6px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                          background: "#F3F2F1", color: "#605E5C", fontFamily: F,
                        }}>
                          +{(u.teamIds ?? []).length - 2}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Estado */}
                <div><StatusChip active={u.isActive} /></div>

                {/* Perfiles */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, alignItems: "center" }}>
                  {(u.profileIds ?? []).length === 0 ? (
                    <span style={{ fontSize: 11, color: "#C8C6C4", fontFamily: F }}>—</span>
                  ) : (
                    (u.profileIds ?? []).map((pid) => {
                      const p = profiles.find((x) => x.id === pid);
                      if (!p) return null;
                      return (
                        <span key={pid} style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "2px 8px", borderRadius: 20,
                          fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                          background: "#F8F0FF", color: "#7530AF", border: "1px solid #D8B4FE",
                          fontFamily: F,
                        }}>
                          {p.name}
                        </span>
                      );
                    })
                  )}
                </div>

                {/* Acciones */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <OutlineBtn
                    onClick={() => setDrawer({ open: true, mode: "edit", user: u })}
                    icon={<Pencil size={12} />}
                  >
                    Editar
                  </OutlineBtn>
                  <OutlineBtn
                    onClick={() => setConfirm({ open: true, userId: u.id, action: u.isActive ? "deactivate" : "activate", name: u.displayName })}
                    icon={u.isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                    danger={u.isActive}
                  >
                    {u.isActive ? "Desactivar" : "Activar"}
                  </OutlineBtn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Drawer ── */}
      <UserDrawer
        state={drawer}
        existingUpns={existingUpns}
        teams={teams}
        profiles={profiles}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
        onSaved={handleSaved}
        addToast={addToast}
      />

      {/* ── Confirm modal ── */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.action === "deactivate" ? "¿Desactivar usuario?" : "¿Activar usuario?"}
        message={
          confirm.action === "deactivate"
            ? `El usuario '${confirm.name}' perderá el acceso a la aplicación. Puedes reactivarlo después.`
            : `El usuario '${confirm.name}' recuperará el acceso con su rol asignado.`
        }
        confirmLabel={confirm.action === "deactivate" ? "Desactivar" : "Activar"}
        danger={confirm.action === "deactivate"}
        onConfirm={handleToggleActive}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />

      <AdminToastContainer toasts={toasts} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};
