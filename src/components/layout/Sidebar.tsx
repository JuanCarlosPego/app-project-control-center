import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ChevronsLeft, ChevronsRight } from "lucide-react";
import { NAV_GROUPS, NAV_ADMIN_ITEM, type NavItem } from "../../navigation/menuConfig";
import { useAuth } from "../../auth/AuthContext";
import { useEffectiveUser } from "../../auth/ImpersonationContext";
import { hasRole } from "../../auth/permissions";
import { TestUserSwitcher } from "./TestUserSwitcher";

// ── Visibilidad del switcher ───────────────────────────────────────
// En local (VITE_USE_MOCKS=true): siempre visible.
// En producción: solo si el usuario real tiene role === "Admin".
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg:        "#1B2A3E",
  bgGroup:   "rgba(255,255,255,0.03)",
  hover:     "rgba(255,255,255,0.07)",
  active:    "rgba(255,255,255,0.13)",
  accent:    "#2899F5",
  text:      "rgba(255,255,255,0.90)",
  muted:     "rgba(255,255,255,0.42)",
  border:    "rgba(255,255,255,0.08)",
  W_OPEN:    232,
  W_CLOSED:  52,
};

const SIDEBAR_KEY = "pcc:sidebar:collapsed";

// ── Sidebar ────────────────────────────────────────────────────────────────
export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; }
  });
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(["admin"]));
  const { user: realUser, appUser: realAppUser } = useAuth();
  const { user: effectiveUserObj, roles } = useEffectiveUser();
  const location = useLocation();
  const navigate = useNavigate();

  // Solo Admin puede simular (independientemente del entorno)
  const showSwitcher = realAppUser.role === "Admin";

  const w = collapsed ? T.W_CLOSED : T.W_OPEN;
  const isActive = (route: string) =>
    location.pathname === route || location.pathname.startsWith(route + "/");

  const toggleGroup = (id: string) =>
    setOpenGroups(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const initials = (effectiveUserObj.displayName ?? realUser.displayName).split(" ")
    .map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <aside
      aria-label="Menú de navegación"
      style={{ width: w, height: "100%", background: T.bg, display: "flex",
               flexDirection: "column", transition: "width 220ms ease",
               overflow: "hidden", flexShrink: 0 }}
    >
      {/* ── Branding + botón colapsar ── */}
      <div style={{
        padding: collapsed ? "13px 0" : "13px 12px 13px 14px",
        borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center",
        gap: 10, flexShrink: 0,
        justifyContent: collapsed ? "center" : "space-between",
      }}>
        {/* Logo + texto (solo expandido) */}
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, overflow: "hidden", minWidth: 0 }}>
            <AppLogo />
            <div style={{ overflow: "hidden", minWidth: 0 }}>
              <div style={{
                display: "inline-block",
                fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
                color: T.accent, background: "rgba(40,153,245,0.15)",
                border: `1px solid rgba(40,153,245,0.35)`,
                borderRadius: 3, padding: "1px 5px",
                marginBottom: 3, lineHeight: 1.4,
              }}>
                SGT
              </div>
              <div style={{
                color: "#fff", fontSize: 11.5, fontWeight: 700,
                lineHeight: 1.3, whiteSpace: "normal",
                wordBreak: "break-word",
              }}>
                Gestión y Control de Proyectos y Roadmap
              </div>
              <div style={{ color: T.muted, fontSize: 10, lineHeight: 1.6, marginTop: 1 }}>Air Europa · IT</div>
            </div>
          </div>
        )}

        {/* Botón colapsar / expandir */}
        <CollapseBtn collapsed={collapsed} onClick={() => setCollapsed(c => {
          const next = !c;
          try { localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0"); } catch { /* noop */ }
          return next;
        })} />
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 0" }}>
        {NAV_GROUPS.map(group => {
          // Filter items the user can see
          const visibleItems = group.items.filter(item =>
            hasRole(roles, item.requiredRoles)
          );
          if (visibleItems.length === 0) return null;

          // Admin group has special accordion behavior
          const isAdminGroup = group.id === "admin-group";
          const adminItem = isAdminGroup ? NAV_ADMIN_ITEM : null;
          const isAdminOpen = openGroups.has("admin");

          return (
            <div key={group.id} style={{ marginBottom: 4 }}>
              {/* Section label (only when expanded) */}
              {!collapsed && (
                <div style={{ padding: "10px 16px 3px", color: T.muted, fontSize: 10,
                              fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
                              borderTop: group.id !== "planning" ? `1px solid ${T.border}` : "none",
                              marginTop: group.id !== "planning" ? 6 : 0 }}>
                  {group.groupLabel}
                </div>
              )}
              {collapsed && group.id !== "planning" && (
                <div style={{ margin: "6px 8px", height: 1, background: T.border }} />
              )}

              {/* Items */}
              {isAdminGroup && adminItem ? (
                // Admin: accordion header + children
                <>
                  {collapsed ? (
                    <NavBtn item={adminItem} collapsed active={isActive("/admin")}
                            onClick={() => { setCollapsed(false); setOpenGroups(s => new Set(s).add("admin")); }} />
                  ) : (
                    <>
                      <AccordionBtn
                        item={adminItem}
                        open={isAdminOpen}
                        active={isActive("/admin")}
                        onToggle={() => toggleGroup("admin")}
                      />
                      {isAdminOpen && adminItem.children?.map(child => (
                        <NavBtn key={child.id} item={child} collapsed={false} indent
                                active={isActive(child.route)} onClick={() => navigate(child.route)} />
                      ))}
                    </>
                  )}
                </>
              ) : (
                visibleItems.map(item => (
                  <NavBtn key={item.id} item={item} collapsed={collapsed}
                          active={isActive(item.route)} onClick={() => navigate(item.route)} />
                ))
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Switcher de usuario de prueba (condicional) ── */}
      {showSwitcher && <TestUserSwitcher collapsed={collapsed} />}

      {/* ── Footer: avatar ── */}
      <div style={{ borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10,
                      padding: collapsed ? "12px 0" : "12px 14px",
                      justifyContent: collapsed ? "center" : "flex-start" }}>
          <Avatar initials={initials} />
          {!collapsed && (
            <div style={{ overflow: "hidden", flex: 1 }}>
              <div style={{ color: T.text, fontSize: 12, fontWeight: 600,
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {effectiveUserObj.displayName}
              </div>
              <div style={{ color: T.muted, fontSize: 10 }}>{roles[0]}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

// ── Sub-components ─────────────────────────────────────────────────────────
const AppLogo: React.FC = () => (
  <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: 6, background: T.accent,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <span style={{ color: "#fff", fontSize: 13, fontWeight: 800, letterSpacing: -1 }}>PC</span>
  </div>
);

const CollapseBtn: React.FC<{ collapsed: boolean; onClick: () => void }> = ({ collapsed, onClick }) => (
  <button
    onClick={onClick}
    aria-label={collapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
    title={collapsed ? "Expandir" : "Colapsar"}
    style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: 30, height: 30, borderRadius: 6, flexShrink: 0,
      background: "transparent", border: "none",
      color: T.muted, cursor: "pointer",
      transition: "background 150ms, color 150ms",
    }}
    onMouseEnter={e => {
      (e.currentTarget as HTMLButtonElement).style.background = T.hover;
      (e.currentTarget as HTMLButtonElement).style.color = "#fff";
    }}
    onMouseLeave={e => {
      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      (e.currentTarget as HTMLButtonElement).style.color = T.muted;
    }}
  >
    {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
  </button>
);

const Avatar: React.FC<{ initials: string }> = ({ initials }) => (
  <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: "50%", background: "#0078D4",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 11, fontWeight: 700 }}>
    {initials}
  </div>
);

const NavBtn: React.FC<{
  item: NavItem; collapsed: boolean; active: boolean; onClick: () => void; indent?: boolean;
}> = ({ item, collapsed, active, onClick, indent }) => (
  <button
    onClick={onClick}
    title={collapsed ? item.label : undefined}
    aria-label={item.label}
    aria-current={active ? "page" : undefined}
    style={{
      display: "flex", alignItems: "center", gap: 9, width: "100%",
      border: "none", cursor: "pointer",
      padding: collapsed ? "10px 0" : indent ? "7px 16px 7px 42px" : "8px 14px",
      justifyContent: collapsed ? "center" : "flex-start",
      background: active ? T.active : "transparent",
      color: active ? "#fff" : T.text,
      borderLeft: active ? `3px solid ${T.accent}` : "3px solid transparent",
      transition: "background 150ms",
      textAlign: "left", fontSize: 13, fontFamily: "'Segoe UI', sans-serif",
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = T.hover; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
  >
    <span style={{ flexShrink: 0, opacity: active ? 1 : 0.72, display: "flex" }}>{item.icon}</span>
    {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
  </button>
);

const AccordionBtn: React.FC<{
  item: NavItem; open: boolean; active: boolean; onToggle: () => void;
}> = ({ item, open, active, onToggle }) => (
  <button
    onClick={onToggle}
    aria-expanded={open}
    aria-label={`${item.label} — ${open ? "colapsar" : "expandir"}`}
    style={{
      display: "flex", alignItems: "center", gap: 9, width: "100%",
      border: "none", cursor: "pointer", padding: "8px 10px 8px 14px",
      background: active ? T.active : "transparent", color: T.text,
      borderLeft: active ? `3px solid ${T.accent}` : "3px solid transparent",
      transition: "background 150ms", fontSize: 13, fontFamily: "'Segoe UI', sans-serif",
    }}
    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = T.hover; }}
    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
  >
    <span style={{ flexShrink: 0, opacity: 0.72, display: "flex" }}>{item.icon}</span>
    <span style={{ flex: 1, whiteSpace: "nowrap", textAlign: "left" }}>{item.label}</span>
    {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
  </button>
);
