// ─────────────────────────────────────────────────────────
//  src/screens/admin/areas/AreaDetailPage.tsx
//  Ruta: /admin/areas/:id — solo rol "Admin"
//
//  Funcionalidad:
//   • Cabecera con nombre del área, estado y descripción
//   • Tab "Usuarios": lista de miembros (Member / KeyUser) con búsqueda,
//     cambio de rol inline y eliminación. Botón "Añadir miembro".
//   • Tab "Product Owners": lista de POs con búsqueda y eliminación.
//     Botón "Añadir PO".
//   • Modales de selección de usuario del tenant (búsqueda sobre appUsers)
//   • Botón "← Volver a Áreas"
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building2, ArrowLeft, Users, Search, X, UserPlus, Trash2,
  Shield, UserCheck, ChevronDown, RotateCw,
} from "lucide-react";
import type {
  BusinessArea,
  UserAreaMembership,
  UserAreaOwnership,
  AreaMemberRoleType,
  AppUser,
} from "../../../types/domain";
import {
  getBusinessArea,
  listAreaMemberships,
  addAreaMember,
  removeAreaMember,
  listAreaOwnerships,
  addAreaOwner,
  removeAreaOwner,
} from "../../../services/businessAreaService";
import { listAppUsers } from "../../../services/userService";
import { AdminToastContainer, newAdminToast, type ToastMsg } from "../components/shared";

// ── Design tokens ──────────────────────────────────────────
const F    = "'Segoe UI', sans-serif";
const BLUE = "#0078D4";
const RED  = "#D13438";
const GREEN = "#107C10";

// ── MemberRoleChip ─────────────────────────────────────────
const ROLE_CFG: Record<AreaMemberRoleType, { label: string; bg: string; color: string; border: string }> = {
  Member:  { label: "Miembro",   bg: "#EFF6FC", color: BLUE,  border: "#C7E0F4" },
  KeyUser: { label: "Key User",  bg: "#FEF9F0", color: "#CA8B00", border: "#F2D98B" },
};

const MemberRoleChip: React.FC<{ role: AreaMemberRoleType }> = ({ role }) => {
  const cfg = ROLE_CFG[role];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      fontFamily: F, whiteSpace: "nowrap",
    }}>
      {role === "KeyUser" ? <UserCheck size={10} /> : <Users size={10} />}
      {cfg.label}
    </span>
  );
};

// ── UserSelectModal ────────────────────────────────────────
interface UserSelectModalProps {
  title: string;
  /** IDs de usuarios ya añadidos para excluirlos */
  excludeIds?: string[];
  onSelect: (user: AppUser) => void;
  onClose: () => void;
}
const UserSelectModal: React.FC<UserSelectModalProps> = ({
  title, excludeIds = [], onSelect, onClose,
}) => {
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAppUsers({})
      .then((u) => setAllUsers(u))
      .catch(() => setAllUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const excludeSet = new Set(excludeIds);
  const filtered = allUsers.filter((u) => {
    if (excludeSet.has(u.id)) return false;
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q.toLowerCase()) ||
      u.email.toLowerCase().includes(q.toLowerCase())
    );
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: "24px 24px 20px",
        width: 460, maxHeight: "70vh", display: "flex", flexDirection: "column",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)", fontFamily: F,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "#201F1E" }}>{title}</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#605E5C", padding: 4 }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={13} color="#A19F9D" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar usuario…"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "7px 10px 7px 32px", border: "1px solid #EDEBE9", borderRadius: 6,
              fontSize: 13, fontFamily: F, outline: "none",
            }}
          />
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading && <p style={{ color: "#A19F9D", fontSize: 13, padding: "16px 0" }}>Cargando usuarios…</p>}
          {!loading && filtered.length === 0 && (
            <p style={{ color: "#A19F9D", fontSize: 13, padding: "16px 0" }}>
              {q ? "No hay usuarios que coincidan." : "No hay usuarios disponibles."}
            </p>
          )}
          {!loading && filtered.map((u) => (
            <div
              key={u.id}
              onClick={() => onSelect(u)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 6, cursor: "pointer",
                transition: "background 100ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F2F1")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: BLUE, color: "#fff", fontSize: 12, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontFamily: F,
              }}>
                {u.displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#201F1E" }}>{u.displayName}</div>
                <div style={{ fontSize: 11, color: "#A19F9D" }}>{u.email}</div>
              </div>
              <span style={{
                marginLeft: "auto", fontSize: 11, color: "#8A8886",
                background: "#F3F2F1", padding: "2px 8px", borderRadius: 12,
              }}>{u.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── RoleSelectDropdown ─────────────────────────────────────
interface RoleSelectProps {
  value: AreaMemberRoleType;
  onChange: (r: AreaMemberRoleType) => void;
}
const RoleSelectDropdown: React.FC<RoleSelectProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const options: AreaMemberRoleType[] = ["Member", "KeyUser"];
  const cfg = ROLE_CFG[value];
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", border: `1px solid ${cfg.border}`, borderRadius: 20,
          background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700,
          cursor: "pointer", fontFamily: F,
        }}
      >
        {cfg.label} <ChevronDown size={10} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "110%", left: 0, zIndex: 50,
          background: "#fff", border: "1px solid #EDEBE9", borderRadius: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)", minWidth: 130, overflow: "hidden",
        }}>
          {options.map((opt) => (
            <div
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                padding: "8px 14px", fontSize: 12, cursor: "pointer",
                background: value === opt ? "#EFF6FC" : "transparent",
                color: value === opt ? BLUE : "#201F1E",
                fontFamily: F,
              }}
              onMouseEnter={(e) => { if (value !== opt) (e.currentTarget.style.background = "#FAF9F8"); }}
              onMouseLeave={(e) => { if (value !== opt) (e.currentTarget.style.background = "transparent"); }}
            >
              {ROLE_CFG[opt].label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Tipos internos ─────────────────────────────────────────
interface MemberWithUser extends UserAreaMembership {
  user?: AppUser;
}
interface OwnerWithUser extends UserAreaOwnership {
  user?: AppUser;
}

// ── Tab buttons ────────────────────────────────────────────
type TabId = "members" | "owners";
interface TabBtnProps { id: TabId; active: boolean; label: string; count: number; icon: React.ReactNode; onClick: () => void }
const TabBtn: React.FC<TabBtnProps> = ({ active, label, count, icon, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: "inline-flex", alignItems: "center", gap: 7,
      padding: "9px 18px", border: "none",
      borderBottom: active ? `2px solid ${BLUE}` : "2px solid transparent",
      background: "transparent", cursor: "pointer", fontFamily: F,
      fontSize: 13, fontWeight: active ? 700 : 400,
      color: active ? BLUE : "#605E5C",
      transition: "color 150ms",
    }}
  >
    {icon}
    {label}
    <span style={{
      padding: "1px 7px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: active ? "#EFF6FC" : "#F3F2F1",
      color:      active ? BLUE      : "#A19F9D",
    }}>{count}</span>
  </button>
);

// ── AreaDetailPage ─────────────────────────────────────────
export const AreaDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [area, setArea]           = useState<BusinessArea | null>(null);
  const [members, setMembers]     = useState<MemberWithUser[]>([]);
  const [owners, setOwners]       = useState<OwnerWithUser[]>([]);
  const [allUsers, setAllUsers]   = useState<AppUser[]>([]);
  const [loading, setLoading]     = useState(true);

  const [activeTab, setActiveTab] = useState<TabId>("members");
  const [searchQ, setSearchQ]     = useState("");

  const [toasts, setToasts]       = useState<ToastMsg[]>([]);
  const toast = useCallback((t: { kind: "success" | "error"; message: string }) =>
    setToasts((prev) => [...prev, newAdminToast(t.message, t.kind === "success")]), []);

  // Modales
  const [addMemberOpen, setAddMemberOpen]   = useState(false);
  const [addOwnerOpen, setAddOwnerOpen]     = useState(false);
  const [pendingMemberRole, setPendingMemberRole] = useState<AreaMemberRoleType>("Member");
  const [pendingUser, setPendingUser]             = useState<AppUser | null>(null);
  const [saving, setSaving]                       = useState(false);

  // ── Carga ─────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [areaData, memberships, ownerships, users] = await Promise.all([
        getBusinessArea(id),
        listAreaMemberships(id),
        listAreaOwnerships(id),
        listAppUsers({}),
      ]);
      const userMap = new Map<string, AppUser>(users.map((u) => [u.id, u]));
      setArea(areaData);
      setMembers(memberships.map((m) => ({ ...m, user: userMap.get(m.userId) })));
      setOwners(ownerships.map((o) => ({ ...o, user: userMap.get(o.userId) })));
      setAllUsers(users);
    } catch {
      toast({ kind: "error", message: "Error al cargar los datos del área" });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // ── Cambiar rol de miembro (inline) ───────────────────────
  const handleRoleChange = async (membership: MemberWithUser, newRole: AreaMemberRoleType) => {
    if (!id || membership.roleType === newRole) return;
    try {
      // Eliminar y re-crear con el nuevo rol (PATCH no está en spec, patron REST limpio)
      await removeAreaMember(id, membership.id);
      const created = await addAreaMember(id, { userId: membership.userId, roleType: newRole });
      setMembers((prev) => prev.map((m) =>
        m.id === membership.id
          ? { ...created, user: membership.user }
          : m,
      ));
      toast({ kind: "success", message: `Rol de ${membership.user?.displayName ?? membership.userId} actualizado a ${newRole}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al cambiar el rol";
      toast({ kind: "error", message: msg });
    }
  };

  // ── Eliminar miembro ──────────────────────────────────────
  const handleRemoveMember = async (membership: MemberWithUser) => {
    if (!id) return;
    try {
      await removeAreaMember(id, membership.id);
      setMembers((prev) => prev.filter((m) => m.id !== membership.id));
      toast({ kind: "success", message: `${membership.user?.displayName ?? membership.userId} eliminado del área` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al eliminar miembro";
      toast({ kind: "error", message: msg });
    }
  };

  // ── Añadir miembro (selección usuario → selección rol → confirmar) ───
  const handleUserSelectedForMember = (user: AppUser) => {
    setPendingUser(user);
    setAddMemberOpen(false);
    // Abrimos modal de confirmación rol — usamos estado inline
  };

  const handleConfirmAddMember = async () => {
    if (!id || !pendingUser) return;
    setSaving(true);
    try {
      const created = await addAreaMember(id, { userId: pendingUser.id, roleType: pendingMemberRole });
      setMembers((prev) => [...prev, { ...created, user: pendingUser }]);
      setPendingUser(null);
      setPendingMemberRole("Member");
      toast({ kind: "success", message: `${pendingUser.displayName} añadido como ${pendingMemberRole}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al añadir miembro";
      toast({ kind: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Eliminar PO ────────────────────────────────────────────
  const handleRemoveOwner = async (ownership: OwnerWithUser) => {
    if (!id) return;
    try {
      await removeAreaOwner(id, ownership.id);
      setOwners((prev) => prev.filter((o) => o.id !== ownership.id));
      toast({ kind: "success", message: `${ownership.user?.displayName ?? ownership.userId} eliminado como PO` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al eliminar PO";
      toast({ kind: "error", message: msg });
    }
  };

  // ── Añadir PO ──────────────────────────────────────────────
  const handleUserSelectedForOwner = async (user: AppUser) => {
    if (!id) return;
    setAddOwnerOpen(false);
    setSaving(true);
    try {
      const created = await addAreaOwner(id, { userId: user.id });
      setOwners((prev) => [...prev, { ...created, user }]);
      toast({ kind: "success", message: `${user.displayName} añadido como Product Owner` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al añadir PO";
      toast({ kind: "error", message: msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Filtros búsqueda ──────────────────────────────────────
  const filteredMembers = members.filter((m) =>
    !searchQ ||
    m.user?.displayName.toLowerCase().includes(searchQ.toLowerCase()) ||
    m.user?.email.toLowerCase().includes(searchQ.toLowerCase()),
  );
  const filteredOwners = owners.filter((o) =>
    !searchQ ||
    o.user?.displayName.toLowerCase().includes(searchQ.toLowerCase()) ||
    o.user?.email.toLowerCase().includes(searchQ.toLowerCase()),
  );

  const existingMemberIds = members.map((m) => m.userId);
  const existingOwnerIds  = owners.map((o) => o.userId);

  // ── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: "48px 32px", fontFamily: F, textAlign: "center", color: "#A19F9D" }}>
        Cargando área…
      </div>
    );
  }

  if (!area) {
    return (
      <div style={{ padding: "48px 32px", fontFamily: F }}>
        <p style={{ color: RED }}>Área no encontrada.</p>
        <button onClick={() => navigate("/admin/areas")} style={{ border: "none", background: "none", color: BLUE, cursor: "pointer", fontSize: 13 }}>
          ← Volver a Áreas
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px", fontFamily: F, minHeight: "100%" }}>

      {/* Breadcrumb / Volver */}
      <button
        onClick={() => navigate("/admin/areas")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          border: "none", background: "none", color: "#605E5C", cursor: "pointer",
          fontSize: 13, fontFamily: F, marginBottom: 20, padding: 0,
        }}
      >
        <ArrowLeft size={14} /> Volver a Áreas
      </button>

      {/* Cabecera del área */}
      <div style={{
        background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
        padding: "20px 24px", marginBottom: 20,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
      }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: "#EFF6FC",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Building2 size={22} color={BLUE} strokeWidth={1.8} />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px", color: "#201F1E" }}>
              {area.name}
            </h1>
            {area.description && (
              <p style={{ fontSize: 13, color: "#605E5C", margin: "0 0 8px", lineHeight: 1.5 }}>
                {area.description}
              </p>
            )}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: (area.isActive ?? true) ? "#DFF6DD" : "#FAF9F8",
              color:      (area.isActive ?? true) ? GREEN     : "#A19F9D",
              border:     `1px solid ${(area.isActive ?? true) ? "#92C353" : "#EDEBE9"}`,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: (area.isActive ?? true) ? GREEN : "#C8C6C4",
              }} />
              {(area.isActive ?? true) ? "Activa" : "Inactiva"}
            </span>
          </div>
        </div>
        <button
          onClick={() => void loadAll()}
          title="Recargar"
          style={{
            border: "1px solid #EDEBE9", background: "#FAF9F8", borderRadius: 6,
            padding: "7px 10px", cursor: "pointer", color: "#605E5C",
            display: "flex", alignItems: "center",
          }}
        >
          <RotateCw size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
        overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        {/* Tab bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #EDEBE9", padding: "0 16px" }}>
          <TabBtn
            id="members" active={activeTab === "members"} label="Usuarios del Área"
            count={members.length} icon={<Users size={14} />}
            onClick={() => { setActiveTab("members"); setSearchQ(""); }}
          />
          <TabBtn
            id="owners" active={activeTab === "owners"} label="Product Owners"
            count={owners.length} icon={<Shield size={14} />}
            onClick={() => { setActiveTab("owners"); setSearchQ(""); }}
          />
        </div>

        {/* Tab content */}
        <div style={{ padding: "16px 20px" }}>

          {/* Barra de acción */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ position: "relative", flex: "1 1 220px" }}>
              <Search size={13} color="#A19F9D" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={activeTab === "members" ? "Buscar miembro…" : "Buscar PO…"}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "7px 10px 7px 32px", border: "1px solid #EDEBE9", borderRadius: 6,
                  fontSize: 13, fontFamily: F, outline: "none",
                }}
              />
              {searchQ && (
                <button onClick={() => setSearchQ("")} style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  border: "none", background: "none", cursor: "pointer", color: "#A19F9D",
                }}><X size={12} /></button>
              )}
            </div>

            {activeTab === "members" && (
              <button
                onClick={() => setAddMemberOpen(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "8px 16px", border: "none", borderRadius: 6,
                  background: BLUE, color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: F,
                }}
              >
                <UserPlus size={14} /> Añadir miembro
              </button>
            )}

            {activeTab === "owners" && (
              <button
                onClick={() => setAddOwnerOpen(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  padding: "8px 16px", border: "none", borderRadius: 6,
                  background: BLUE, color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: F,
                }}
              >
                <UserPlus size={14} /> Añadir PO
              </button>
            )}
          </div>

          {/* ── MEMBERS TAB ───────────────────────────────── */}
          {activeTab === "members" && (
            <>
              {filteredMembers.length === 0 ? (
                <div style={{ padding: "32px 0", textAlign: "center" }}>
                  <Users size={32} color="#C8C6C4" style={{ marginBottom: 10 }} />
                  <p style={{ color: "#A19F9D", fontSize: 13, margin: 0 }}>
                    {searchQ
                      ? "No hay miembros que coincidan con la búsqueda."
                      : "Esta área no tiene miembros asignados."}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Cabecera */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 140px 44px",
                    padding: "6px 12px", borderBottom: "1px solid #F3F2F1",
                  }}>
                    {["Usuario", "Rol", ""].map((h) => (
                      <span key={h} style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.08em", color: "#8A8886", fontFamily: F,
                      }}>{h}</span>
                    ))}
                  </div>
                  {filteredMembers.map((m, i) => (
                    <div
                      key={m.id}
                      style={{
                        display: "grid", gridTemplateColumns: "1fr 140px 44px",
                        padding: "12px 12px", alignItems: "center",
                        borderBottom: i < filteredMembers.length - 1 ? "1px solid #F3F2F1" : "none",
                        transition: "background 100ms",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAF9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Usuario */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: BLUE, color: "#fff", fontSize: 12, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          {(m.user?.displayName ?? m.userId).split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#201F1E" }}>
                            {m.user?.displayName ?? m.userId}
                          </div>
                          <div style={{ fontSize: 11, color: "#A19F9D" }}>
                            {m.user?.email ?? ""} {m.user ? `· ${m.user.role}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Rol con dropdown inline */}
                      <RoleSelectDropdown
                        value={m.roleType}
                        onChange={(r) => void handleRoleChange(m, r)}
                      />

                      {/* Eliminar */}
                      <button
                        onClick={() => void handleRemoveMember(m)}
                        title="Eliminar miembro"
                        style={{
                          border: "none", background: "none", cursor: "pointer",
                          color: "#C8C6C4", padding: 6, borderRadius: 4,
                          display: "flex", alignItems: "center",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = RED)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#C8C6C4")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── OWNERS TAB ────────────────────────────────── */}
          {activeTab === "owners" && (
            <>
              {filteredOwners.length === 0 ? (
                <div style={{ padding: "32px 0", textAlign: "center" }}>
                  <Shield size={32} color="#C8C6C4" style={{ marginBottom: 10 }} />
                  <p style={{ color: "#A19F9D", fontSize: 13, margin: 0 }}>
                    {searchQ
                      ? "No hay POs que coincidan con la búsqueda."
                      : "Esta área no tiene Product Owners asignados."}
                  </p>
                </div>
              ) : (
                <div>
                  {/* Cabecera */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 120px 44px",
                    padding: "6px 12px", borderBottom: "1px solid #F3F2F1",
                  }}>
                    {["Usuario", "Rol", ""].map((h) => (
                      <span key={h} style={{
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: "0.08em", color: "#8A8886", fontFamily: F,
                      }}>{h}</span>
                    ))}
                  </div>
                  {filteredOwners.map((o, i) => (
                    <div
                      key={o.id}
                      style={{
                        display: "grid", gridTemplateColumns: "1fr 120px 44px",
                        padding: "12px 12px", alignItems: "center",
                        borderBottom: i < filteredOwners.length - 1 ? "1px solid #F3F2F1" : "none",
                        transition: "background 100ms",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAF9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Usuario */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "#5C2D91", color: "#fff", fontSize: 12, fontWeight: 700,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          {(o.user?.displayName ?? o.userId).split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#201F1E" }}>
                            {o.user?.displayName ?? o.userId}
                          </div>
                          <div style={{ fontSize: 11, color: "#A19F9D" }}>
                            {o.user?.email ?? ""} {o.user ? `· ${o.user.role}` : ""}
                          </div>
                        </div>
                      </div>

                      {/* Rol PO (estático) */}
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: "#F3EFFF", color: "#5C2D91", border: "1px solid #D9CFEF",
                        fontFamily: F, whiteSpace: "nowrap",
                      }}>
                        <Shield size={10} /> PO
                      </span>

                      {/* Eliminar */}
                      <button
                        onClick={() => void handleRemoveOwner(o)}
                        title="Eliminar PO"
                        style={{
                          border: "none", background: "none", cursor: "pointer",
                          color: "#C8C6C4", padding: 6, borderRadius: 4,
                          display: "flex", alignItems: "center",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = RED)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#C8C6C4")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Modal: seleccionar usuario para miembro ───────── */}
      {addMemberOpen && (
        <UserSelectModal
          title="Añadir miembro al área"
          excludeIds={existingMemberIds}
          onSelect={handleUserSelectedForMember}
          onClose={() => setAddMemberOpen(false)}
        />
      )}

      {/* ── Modal: confirmar rol del nuevo miembro ────────── */}
      {pendingUser && !addMemberOpen && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 1200, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff", borderRadius: 10, padding: "28px 28px 24px",
            width: 400, boxShadow: "0 8px 32px rgba(0,0,0,0.18)", fontFamily: F,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 6px", color: "#201F1E" }}>
              Asignar rol al miembro
            </h3>
            <p style={{ fontSize: 13, color: "#605E5C", margin: "0 0 18px" }}>
              Selecciona el rol de <strong>{pendingUser.displayName}</strong> en el área.
            </p>

            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              {(["Member", "KeyUser"] as AreaMemberRoleType[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setPendingMemberRole(r)}
                  style={{
                    flex: 1, padding: "10px 0", border: `2px solid`,
                    borderColor: pendingMemberRole === r ? BLUE : "#EDEBE9",
                    borderRadius: 8,
                    background: pendingMemberRole === r ? "#EFF6FC" : "#FAF9F8",
                    color:      pendingMemberRole === r ? BLUE     : "#605E5C",
                    fontWeight: pendingMemberRole === r ? 700 : 400,
                    fontSize: 13, cursor: "pointer", fontFamily: F,
                  }}
                >
                  {ROLE_CFG[r].label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => { setPendingUser(null); setPendingMemberRole("Member"); }}
                style={{
                  padding: "8px 18px", border: "1px solid #EDEBE9", borderRadius: 6,
                  background: "#FAF9F8", fontSize: 13, cursor: "pointer", fontFamily: F,
                }}
              >Cancelar</button>
              <button
                onClick={() => void handleConfirmAddMember()}
                disabled={saving}
                style={{
                  padding: "8px 18px", border: "none", borderRadius: 6,
                  background: saving ? "#C8C6C4" : BLUE,
                  color: "#fff", fontSize: 13, fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer", fontFamily: F,
                }}
              >
                {saving ? "Guardando…" : "Añadir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: seleccionar usuario para PO ───────────── */}
      {addOwnerOpen && (
        <UserSelectModal
          title="Añadir Product Owner al área"
          excludeIds={existingOwnerIds}
          onSelect={handleUserSelectedForOwner}
          onClose={() => setAddOwnerOpen(false)}
        />
      )}

      <AdminToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </div>
  );
};
