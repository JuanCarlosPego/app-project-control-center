// ─────────────────────────────────────────────────────────────────
//  src/components/layout/UserSwitcherModal.tsx
//  Modal "Cambiar usuario" para simulación Admin.
//
//  Tabs: Recientes | Equipos | Todos
//  Filtros: búsqueda live, chips de rol, toggle activos
//  Favoritos: ⭐ persistidos en localStorage
//  Sin scroll de sidebar — toda la selección ocurre aquí
// ─────────────────────────────────────────────────────────────────
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  X,
  Search,
  Star,
  Users,
  Clock,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import type { AppUser } from "../../auth/ImpersonationContext";
import { listTeams } from "../../services/teamService";
import { listAppUsers } from "../../services/userService";
import type { Team } from "../../types/domain";
import type { AppRole } from "../../auth/permissions";
import { UserAvatar } from "../ui/UserAvatar";

// ── localStorage keys ─────────────────────────────────────────────
const LS_RECENT  = "sim:recentUserIds";
const LS_FAV     = "sim:favoriteUserIds";
const LS_TEAM    = "sim:lastTeamId";
const MAX_RECENT = 8;

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

// ── Design tokens ─────────────────────────────────────────────────
const M = {
  bg:        "#FFFFFF",
  bgPanel:   "#F8F9FA",
  border:    "#E5E7EB",
  borderFoc: "#0078D4",
  text:      "#111827",
  textMid:   "#6B7280",
  textMuted: "#9CA3AF",
  accent:    "#0078D4",
  accentBg:  "#EFF6FF",
  hover:     "#F3F4F6",
  selected:  "#DBEAFE",
  selBorder: "#93C5FD",
  danger:    "#DC2626",
};

const ROLE_CHIP: Record<string, { bg: string; text: string; label: string }> = {
  "Admin":        { bg: "#EDE9FE", text: "#5B21B6", label: "Admin" },
  "IT AirEuropa": { bg: "#DBEAFE", text: "#1D4ED8", label: "IT AE" },
  "Proveedor":    { bg: "#D1FAE5", text: "#065F46", label: "Proveedor" },
  "Usuario":      { bg: "#FEF3C7", text: "#92400E", label: "Usuario" },
  "Invitado":     { bg: "#F3F4F6", text: "#374151", label: "Invitado" },
};

const ROLE_AVATAR: Record<string, string> = {
  "Admin":        "#7C3AED",
  "IT AirEuropa": "#0078D4",
  "Proveedor":    "#059669",
  "Usuario":      "#D97706",
  "Invitado":     "#6B7280",
};

const TEAM_TYPE_LABEL: Record<string, string> = {
  "Internal": "IT interno",
  "Area":     "Área",
  "Provider": "Proveedor",
};

type TabId = "recent" | "teams" | "all";
const ALL_ROLES: Array<AppRole | "Todos"> = [
  "Todos", "Admin", "IT AirEuropa", "Proveedor", "Usuario", "Invitado",
];

// ── Helpers ───────────────────────────────────────────────────────

// ── Sub-components ────────────────────────────────────────────────

interface UserCardProps {
  user: AppUser;
  isSelected: boolean;
  isFav: boolean;
  teamNameMap: Record<string, string>;
  onSelect: () => void;
  onToggleFav: () => void;
}

const UserCard: React.FC<UserCardProps> = ({
  user, isSelected, isFav, teamNameMap, onSelect, onToggleFav,
}) => {
  const chip = ROLE_CHIP[user.role] ?? ROLE_CHIP["Invitado"];
  const teamNames = (user.teamIds ?? [])
    .map(id => teamNameMap[id])
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="option"
      aria-selected={isSelected}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        borderRadius: 6,
        cursor: user.isActive ? "pointer" : "not-allowed",
        background: isSelected ? M.selected : "transparent",
        border: `1.5px solid ${isSelected ? M.selBorder : "transparent"}`,
        opacity: user.isActive ? 1 : 0.45,
        transition: "background 120ms, border-color 120ms",
      }}
      onClick={user.isActive ? onSelect : undefined}
      onMouseEnter={e => {
        if (!isSelected && user.isActive)
          (e.currentTarget as HTMLDivElement).style.background = M.hover;
      }}
      onMouseLeave={e => {
        if (!isSelected)
          (e.currentTarget as HTMLDivElement).style.background =
            isSelected ? M.selected : "transparent";
      }}
    >
      {/* Avatar */}
      <UserAvatar
        displayName={user.displayName}
        upn={user.upn}
        size={34}
      />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: M.text,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {user.displayName}
        </div>
        <div style={{
          fontSize: 11, color: M.textMid,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {user.email}
          {teamNames ? ` · ${teamNames}` : ""}
        </div>
      </div>

      {/* Chip rol */}
      <span style={{
        flexShrink: 0,
        padding: "2px 7px", borderRadius: 10,
        background: chip.bg, color: chip.text,
        fontSize: 10, fontWeight: 600,
      }}>
        {chip.label}
      </span>

      {/* Favorito */}
      <button
        aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
        onClick={e => { e.stopPropagation(); onToggleFav(); }}
        style={{
          flexShrink: 0,
          background: "none", border: "none", cursor: "pointer",
          color: isFav ? "#F59E0B" : M.textMuted,
          padding: 2, lineHeight: 0,
        }}
      >
        <Star size={14} fill={isFav ? "#F59E0B" : "none"} />
      </button>
    </div>
  );
};

// ── TabRecientes ──────────────────────────────────────────────────
interface TabRecentesProps {
  recentIds: string[];
  allUsers: AppUser[];
  effectiveUserId: string;
  favIds: string[];
  teamNameMap: Record<string, string>;
  onSelect: (u: AppUser) => void;
  onToggleFav: (id: string) => void;
}

const TabRecientes: React.FC<TabRecentesProps> = ({
  recentIds, allUsers, effectiveUserId, favIds, teamNameMap, onSelect, onToggleFav,
}) => {
  const favs = allUsers.filter(u => favIds.includes(u.id));
  const recent = recentIds
    .map(id => allUsers.find(u => u.id === id))
    .filter((u): u is AppUser => !!u && !favIds.includes(u.id));

  if (favs.length === 0 && recent.length === 0) {
    return (
      <div style={{
        padding: "32px 16px", textAlign: "center",
        color: M.textMuted, fontSize: 13,
      }}>
        <Star size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
        <div>Aún no hay favoritos ni recientes.</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>
          Selecciona usuarios desde la pestaña <strong>Todos</strong> o usa ⭐ para marcar favoritos.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {favs.length > 0 && (
        <>
          <div style={{
            padding: "6px 12px 4px", fontSize: 10, fontWeight: 700,
            color: M.textMuted, textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            ⭐ Favoritos
          </div>
          {favs.map(u => (
            <UserCard
              key={u.id} user={u}
              isSelected={u.id === effectiveUserId}
              isFav={favIds.includes(u.id)}
              teamNameMap={teamNameMap}
              onSelect={() => onSelect(u)}
              onToggleFav={() => onToggleFav(u.id)}
            />
          ))}
        </>
      )}
      {recent.length > 0 && (
        <>
          <div style={{
            padding: "8px 12px 4px", fontSize: 10, fontWeight: 700,
            color: M.textMuted, textTransform: "uppercase", letterSpacing: "0.08em",
          }}>
            Recientes
          </div>
          {recent.map(u => (
            <UserCard
              key={u.id} user={u}
              isSelected={u.id === effectiveUserId}
              isFav={favIds.includes(u.id)}
              teamNameMap={teamNameMap}
              onSelect={() => onSelect(u)}
              onToggleFav={() => onToggleFav(u.id)}
            />
          ))}
        </>
      )}
    </div>
  );
};

// ── TabEquipos ────────────────────────────────────────────────────
interface TabEquiposProps {
  teams: Team[];
  allUsers: AppUser[];
  effectiveUserId: string;
  favIds: string[];
  teamNameMap: Record<string, string>;
  onSelect: (u: AppUser) => void;
  onToggleFav: (id: string) => void;
}

const TabEquipos: React.FC<TabEquiposProps> = ({
  teams, allUsers, effectiveUserId, favIds, teamNameMap, onSelect, onToggleFav,
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    () => lsGet<string>(LS_TEAM, teams[0]?.id ?? ""),
  );

  // Asegurarse de que el team seleccionado sea válido
  const validTeamId = teams.find(t => t.id === selectedTeamId)
    ? selectedTeamId
    : (teams[0]?.id ?? "");

  const usersInTeam = allUsers.filter(u =>
    (u.teamIds ?? []).includes(validTeamId),
  );

  const handleTeamSelect = (id: string) => {
    setSelectedTeamId(id);
    lsSet(LS_TEAM, id);
  };

  if (teams.length === 0) {
    return (
      <div style={{
        padding: "32px 16px", textAlign: "center",
        color: M.textMuted, fontSize: 13,
      }}>
        No hay equipos disponibles.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      {/* Panel izquierdo: lista de teams */}
      <div style={{
        width: 170, flexShrink: 0,
        borderRight: `1px solid ${M.border}`,
        overflowY: "auto",
        background: M.bgPanel,
      }}>
        {teams.map(team => {
          const memberCount = allUsers.filter(u =>
            (u.teamIds ?? []).includes(team.id),
          ).length;
          const isTeamSel = team.id === validTeamId;
          return (
            <button
              key={team.id}
              onClick={() => handleTeamSelect(team.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                width: "100%",
                border: "none",
                borderLeft: isTeamSel
                  ? `3px solid ${M.accent}`
                  : "3px solid transparent",
                background: isTeamSel ? M.accentBg : "transparent",
                padding: "9px 12px",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 100ms",
              }}
              onMouseEnter={e => {
                if (!isTeamSel)
                  (e.currentTarget as HTMLButtonElement).style.background = M.hover;
              }}
              onMouseLeave={e => {
                if (!isTeamSel)
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: isTeamSel ? 700 : 500,
                color: isTeamSel ? M.accent : M.text,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                maxWidth: 140,
              }}>
                {team.name}
              </div>
              <div style={{
                fontSize: 10, color: M.textMuted, marginTop: 1,
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <span>{TEAM_TYPE_LABEL[team.type] ?? team.type}</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span>{memberCount} miembro{memberCount !== 1 ? "s" : ""}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Panel derecho: usuarios del team seleccionado */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "4px 8px",
      }}>
        {usersInTeam.length === 0 ? (
          <div style={{
            padding: "24px 12px", textAlign: "center",
            color: M.textMuted, fontSize: 12,
          }}>
            Sin miembros en este equipo.
          </div>
        ) : (
          usersInTeam.map(u => (
            <UserCard
              key={u.id} user={u}
              isSelected={u.id === effectiveUserId}
              isFav={favIds.includes(u.id)}
              teamNameMap={teamNameMap}
              onSelect={() => onSelect(u)}
              onToggleFav={() => onToggleFav(u.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ── TabTodos ──────────────────────────────────────────────────────
interface TabTodosProps {
  query: string;
  roleFilter: AppRole | "Todos";
  onlyActive: boolean;
  allUsers: AppUser[];
  effectiveUserId: string;
  favIds: string[];
  teamNameMap: Record<string, string>;
  onSelect: (u: AppUser) => void;
  onToggleFav: (id: string) => void;
}

const TabTodos: React.FC<TabTodosProps> = ({
  query, roleFilter, onlyActive, allUsers,
  effectiveUserId, favIds, teamNameMap, onSelect, onToggleFav,
}) => {
  const q = query.toLowerCase().trim();

  const filtered = useMemo(() => allUsers.filter(u => {
    if (onlyActive && !u.isActive) return false;
    if (roleFilter !== "Todos" && u.role !== roleFilter) return false;
    if (q && !(
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.upn ?? "").toLowerCase().includes(q)
    )) return false;
    return true;
  }), [allUsers, q, roleFilter, onlyActive]);

  if (filtered.length === 0) {
    return (
      <div style={{
        padding: "32px 16px", textAlign: "center",
        color: M.textMuted, fontSize: 13,
      }}>
        No hay usuarios que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {filtered.map(u => (
        <UserCard
          key={u.id} user={u}
          isSelected={u.id === effectiveUserId}
          isFav={favIds.includes(u.id)}
          teamNameMap={teamNameMap}
          onSelect={() => onSelect(u)}
          onToggleFav={() => onToggleFav(u.id)}
        />
      ))}
    </div>
  );
};

// ── UserSwitcherModal ─────────────────────────────────────────────
export interface UserSwitcherModalProps {
  open: boolean;
  effectiveUser: AppUser;
  realUser: AppUser;
  onSelect: (userId: string) => void;
  onClose: () => void;
}

export const UserSwitcherModal: React.FC<UserSwitcherModalProps> = ({
  open, effectiveUser, realUser, onSelect, onClose,
}) => {
  const [tab, setTab]             = useState<TabId>("recent");
  const [query, setQuery]         = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "Todos">("Todos");
  const [onlyActive, setOnlyActive] = useState(true);

  const [allUsers, setAllUsers]   = useState<AppUser[]>([]);
  const [teams, setTeams]         = useState<Team[]>([]);
  const [loading, setLoading]     = useState(false);

  const [recentIds, setRecentIds] = useState<string[]>(() => lsGet<string[]>(LS_RECENT, []));
  const [favIds, setFavIds]       = useState<string[]>(() => lsGet<string[]>(LS_FAV, []));

  const searchRef = useRef<HTMLInputElement>(null);

  // teamNameMap: id → name
  const teamNameMap = useMemo<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    teams.forEach(t => { m[t.id] = t.name; });
    return m;
  }, [teams]);

  // Cargar datos al abrir
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setQuery("");
    Promise.all([
      listAppUsers({}),
      listTeams({ isActive: true }),
    ]).then(([users, ts]) => {
      setAllUsers(users as AppUser[]);
      setTeams(ts);
    }).catch(() => { /* no bloquea */ })
      .finally(() => setLoading(false));

    setTimeout(() => searchRef.current?.focus(), 60);
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const handleSelect = useCallback((user: AppUser) => {
    onSelect(user.id);

    // Actualizar recientes
    setRecentIds(prev => {
      const next = [user.id, ...prev.filter(id => id !== user.id)].slice(0, MAX_RECENT);
      lsSet(LS_RECENT, next);
      return next;
    });

    onClose();
  }, [onSelect, onClose]);

  const toggleFav = useCallback((id: string) => {
    setFavIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      lsSet(LS_FAV, next);
      return next;
    });
  }, []);

  if (!open) return null;

  const tabStyle = (id: TabId): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 5,
    padding: "7px 14px",
    border: "none", background: "none",
    borderBottom: `2px solid ${tab === id ? M.accent : "transparent"}`,
    color: tab === id ? M.accent : M.textMid,
    fontWeight: tab === id ? 700 : 400,
    fontSize: 12, cursor: "pointer",
    fontFamily: "'Segoe UI', sans-serif",
    transition: "color 120ms, border-color 120ms",
    whiteSpace: "nowrap",
  });

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.30)",
          zIndex: 600,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar usuario de simulación"
        style={{
          position: "fixed",
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(700px, 96vw)",
          height: "min(580px, 90vh)",
          background: M.bg,
          borderRadius: 10,
          boxShadow: "0 20px 60px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.12)",
          zIndex: 601,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "'Segoe UI', sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px 10px",
          borderBottom: `1px solid ${M.border}`,
          flexShrink: 0,
        }}>
          <UserCheck size={18} color={M.accent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.text }}>
              Cambiar usuario simulado
            </div>
            <div style={{ fontSize: 11, color: M.textMid }}>
              Sesión real: <strong>{realUser.displayName}</strong>
            </div>
          </div>
          <button
            aria-label="Cerrar"
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: M.textMid, padding: 4, borderRadius: 4,
              display: "flex", alignItems: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Search + Filtros ── */}
        <div style={{
          padding: "10px 14px 0",
          borderBottom: `1px solid ${M.border}`,
          flexShrink: 0,
        }}>
          {/* Buscador */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            border: `1.5px solid ${M.border}`, borderRadius: 6,
            padding: "6px 10px", background: M.bgPanel, marginBottom: 8,
          }}>
            <Search size={14} color={M.textMuted} />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por nombre, email o UPN…"
              aria-label="Buscar usuario"
              style={{
                flex: 1, border: "none", background: "none",
                fontSize: 13, color: M.text, outline: "none",
                fontFamily: "'Segoe UI', sans-serif",
              }}
            />
            {query && (
              <button
                aria-label="Limpiar búsqueda"
                onClick={() => setQuery("")}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: M.textMuted, padding: 0, lineHeight: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Fila: chips de rol + toggle activos */}
          <div style={{
            display: "flex", alignItems: "center",
            gap: 6, flexWrap: "wrap", paddingBottom: 8,
          }}>
            {ALL_ROLES.map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  padding: "2px 10px", borderRadius: 20,
                  border: `1.5px solid ${roleFilter === r ? M.accent : M.border}`,
                  background: roleFilter === r ? M.accentBg : "transparent",
                  color: roleFilter === r ? M.accent : M.textMid,
                  fontSize: 11, fontWeight: roleFilter === r ? 700 : 400,
                  cursor: "pointer",
                  fontFamily: "'Segoe UI', sans-serif",
                  transition: "all 100ms",
                }}
              >
                {r === "IT AirEuropa" ? "IT AE" : r}
              </button>
            ))}

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, color: M.textMid, cursor: "pointer",
                userSelect: "none",
              }}>
                <input
                  type="checkbox"
                  checked={onlyActive}
                  onChange={e => setOnlyActive(e.target.checked)}
                  style={{ accentColor: M.accent, cursor: "pointer" }}
                />
                Solo activos
              </label>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 0,
            marginBottom: -1,
          }}>
            <button style={tabStyle("recent")} onClick={() => setTab("recent")}>
              <Clock size={13} /> Recientes
            </button>
            <button style={tabStyle("teams")} onClick={() => setTab("teams")}>
              <Users size={13} /> Equipos
            </button>
            <button style={tabStyle("all")} onClick={() => setTab("all")}>
              <UserCheck size={13} /> Todos
            </button>
          </div>
        </div>

        {/* ── Body: contenido del tab ── */}
        <div style={{
          flex: 1,
          overflowY: tab === "teams" ? "hidden" : "auto",
          padding: tab === "teams" ? 0 : "6px 6px",
          minHeight: 0,
        }}>
          {loading ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: "100%", color: M.textMuted, fontSize: 13, gap: 8,
            }}>
              Cargando usuarios…
            </div>
          ) : tab === "recent" ? (
            <TabRecientes
              recentIds={recentIds}
              allUsers={allUsers}
              effectiveUserId={effectiveUser.id}
              favIds={favIds}
              teamNameMap={teamNameMap}
              onSelect={handleSelect}
              onToggleFav={toggleFav}
            />
          ) : tab === "teams" ? (
            <TabEquipos
              teams={teams}
              allUsers={allUsers.filter(u => !onlyActive || u.isActive)}
              effectiveUserId={effectiveUser.id}
              favIds={favIds}
              teamNameMap={teamNameMap}
              onSelect={handleSelect}
              onToggleFav={toggleFav}
            />
          ) : (
            <TabTodos
              query={query}
              roleFilter={roleFilter}
              onlyActive={onlyActive}
              allUsers={allUsers}
              effectiveUserId={effectiveUser.id}
              favIds={favIds}
              teamNameMap={teamNameMap}
              onSelect={handleSelect}
              onToggleFav={toggleFav}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 18px",
          borderTop: `1px solid ${M.border}`,
          background: M.bgPanel,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: M.textMuted }}>
            {allUsers.length} usuario{allUsers.length !== 1 ? "s" : ""} cargados
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "6px 16px", borderRadius: 5,
              border: `1px solid ${M.border}`, background: M.bg,
              color: M.textMid, fontSize: 12, cursor: "pointer",
              fontFamily: "'Segoe UI', sans-serif",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  );
};
