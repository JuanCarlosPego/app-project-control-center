// ─────────────────────────────────────────────────────────
//  src/screens/admin/teams/AdminTeamsPage.tsx
//  Ruta: /admin/teams — solo rol "Admin"
//  Gestión de equipos (Area | Provider | Internal).
//
//  Funcionalidad:
//   • Listar equipos con filtros (nombre, tipo, estado)
//   • Crear / Editar equipo (TeamFormDrawer)
//   • Activar / Desactivar equipo (ConfirmModal)
//   • Ver miembros del equipo (TeamDetailDrawer) + CTA → /admin/users?teamId=<id>
//   • Auditoría automática en cada operación (via teamService handlers MSW)
// ─────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Search, X, Pencil, CheckCircle, XCircle,
  RotateCw, Eye, Building2, Network, Cpu, ArrowRight,
  Save, ChevronDown, UserCheck, UserX,
} from "lucide-react";
import type { Team, TeamType, AppUser } from "../../../types/domain";
import {
  listTeams, createTeam, updateTeam,
  activateTeam, deactivateTeam,
  type CreateTeamPayload, type UpdateTeamPayload,
} from "../../../services/teamService";
import { listAppUsers } from "../../../services/userService";
import {
  AdminToastContainer, newAdminToast, type ToastMsg,
} from "../components/shared";

// ── Design tokens ─────────────────────────────────────────
const F = "'Segoe UI', sans-serif";

// ── Team type config ──────────────────────────────────────
const TEAM_TYPE_CFG: Record<TeamType, {
  label: string; bg: string; color: string; border: string; Icon: React.ElementType;
}> = {
  Area:     { label: "Área",     bg: "#EFF6FC", color: "#0078D4", border: "#C7E0F4", Icon: Network  },
  Provider: { label: "Proveedor",bg: "#FEF9F0", color: "#CA8B00", border: "#F2D98B", Icon: Building2 },
  Internal: { label: "Interno",  bg: "#F3FBF5", color: "#107C10", border: "#B7E0B8", Icon: Cpu      },
};

const TEAM_TYPES: TeamType[] = ["Area", "Provider", "Internal"];

// ── TypeChip ─────────────────────────────────────────────
const TypeChip: React.FC<{ type: TeamType }> = ({ type }) => {
  const cfg = TEAM_TYPE_CFG[type];
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      fontFamily: F, whiteSpace: "nowrap",
    }}>
      <Icon size={11} strokeWidth={2} />
      {cfg.label}
    </span>
  );
};

// ── StatusChip ────────────────────────────────────────────
const StatusChip: React.FC<{ active: boolean }> = ({ active }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
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

// ── FilterSelect ──────────────────────────────────────────
const FilterSelect: React.FC<{
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}> = ({ value, onChange, children }) => (
  <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        appearance: "none", padding: "8px 32px 8px 12px",
        borderRadius: 6, border: "1px solid #EDEBE9",
        background: "#fff", fontSize: 13, fontFamily: F,
        color: "#201F1E", cursor: "pointer", outline: "none",
        minWidth: 150,
      }}
    >
      {children}
    </select>
    <ChevronDown
      size={14} color="#605E5C"
      style={{ position: "absolute", right: 10, pointerEvents: "none" }}
    />
  </div>
);

// ── Label style ────────────────────────────────────────────
const labelSt: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#605E5C",
  display: "block", marginBottom: 6,
  textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: F,
};

// ── Toggle ────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      width: 40, height: 22, borderRadius: 11, position: "relative",
      background: checked ? "#0078D4" : "#C8C6C4",
      cursor: "pointer", transition: "background 180ms", flexShrink: 0,
    }}
  >
    <div style={{
      position: "absolute", top: 3,
      left: checked ? 20 : 3, width: 16, height: 16,
      background: "#fff", borderRadius: "50%",
      transition: "left 180ms", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    }} />
  </div>
);

// ═══════════════════════════════════════════════════════════
//  TeamFormDrawer — Crear / Editar equipo
// ═══════════════════════════════════════════════════════════
interface TeamFormDrawerProps {
  open: boolean;
  mode: "add" | "edit";
  team: Team | null;
  onClose: () => void;
  onSaved: (t: Team) => void;
  addToast: (msg: string, ok?: boolean) => void;
}

const TeamFormDrawer: React.FC<TeamFormDrawerProps> = ({
  open, mode, team, onClose, onSaved, addToast,
}) => {
  const [name,     setName]     = useState("");
  const [type,     setType]     = useState<TeamType>("Area");
  const [isActive, setIsActive] = useState(true);
  const [errors,   setErrors]   = useState<{ name?: string; type?: string }>({});
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && team) {
      setName(team.name);
      setType(team.type);
      setIsActive(team.isActive);
    } else {
      setName("");
      setType("Area");
      setIsActive(true);
    }
    setErrors({});
    setSaving(false);
  }, [open, mode, team]);

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = "El nombre del equipo es obligatorio";
    if (!TEAM_TYPES.includes(type)) errs.type = "Selecciona un tipo válido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let saved: Team;
      if (mode === "add") {
        const payload: CreateTeamPayload = { name: name.trim(), type, isActive };
        saved = await createTeam(payload);
        addToast(`Equipo '${saved.name}' creado correctamente.`);
      } else {
        const payload: UpdateTeamPayload = { name: name.trim(), type, isActive };
        saved = await updateTeam(team!.id, payload);
        addToast(`Equipo '${saved.name}' actualizado.`);
      }
      onSaved(saved);
      onClose();
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Error al guardar el equipo.", false);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const cfg = TEAM_TYPE_CFG[type];
  const Icon = cfg.Icon;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 4000 }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
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
            width: 32, height: 32, background: cfg.bg, borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={16} color={cfg.color} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#201F1E", margin: 0, fontFamily: F }}>
              {mode === "add" ? "Nuevo equipo" : "Editar equipo"}
            </h2>
            <div style={{ fontSize: 11, color: "#A19F9D", fontFamily: F, marginTop: 1 }}>
              {mode === "add" ? "Añade un equipo al directorio" : `Editando: ${team?.name}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 6, borderRadius: 6, color: "#A19F9D", display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{
          flex: 1, overflowY: "auto", padding: 24,
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          {/* Nombre */}
          <div>
            <label style={labelSt}>Nombre del equipo *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. DIROPS, 40West, IT AirEuropa…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "10px 12px",
                border: `1px solid ${errors.name ? "#D13438" : "#EDEBE9"}`,
                borderRadius: 6, fontSize: 13, fontFamily: F,
                color: "#201F1E", outline: "none",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = errors.name ? "#D13438" : "#0078D4"; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = errors.name ? "#D13438" : "#EDEBE9"; }}
            />
            {errors.name && (
              <div style={{ fontSize: 11, color: "#D13438", marginTop: 4, fontFamily: F }}>
                {errors.name}
              </div>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label style={labelSt}>Tipo de equipo *</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TEAM_TYPES.map((t) => {
                const c = TEAM_TYPE_CFG[t];
                const TIcon = c.Icon;
                const selected = type === t;
                return (
                  <div
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                      border: `2px solid ${selected ? c.color : "#EDEBE9"}`,
                      background: selected ? c.bg : "#FAFAFA",
                      transition: "border-color 150ms, background 150ms",
                    }}
                  >
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: selected ? c.color : "#EDEBE9",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background 150ms",
                    }}>
                      <TIcon size={14} color={selected ? "#fff" : "#A19F9D"} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: selected ? c.color : "#201F1E", fontFamily: F }}>
                        {c.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#A19F9D", fontFamily: F }}>
                        {t === "Area"     && "Áreas de negocio internas de Air Europa"}
                        {t === "Provider" && "Empresas proveedoras externas"}
                        {t === "Internal" && "Equipos internos de IT / Gestión"}
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto" }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%",
                        border: `2px solid ${selected ? c.color : "#C8C6C4"}`,
                        background: selected ? c.color : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Estado */}
          <div>
            <label style={labelSt}>Estado</label>
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
              <Toggle checked={isActive} onChange={setIsActive} />
            </div>
            <div style={{ fontSize: 11, color: "#A19F9D", marginTop: 4, fontFamily: F }}>
              Los equipos inactivos no aparecen en los selectores de asignación.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid #EDEBE9",
          display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 20px", borderRadius: 6, border: "1px solid #EDEBE9",
              background: "#fff", color: "#201F1E", fontSize: 13,
              cursor: "pointer", fontFamily: F, fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "9px 22px", borderRadius: 6, border: "none",
              background: saving ? "#C8C6C4" : "#0078D4",
              color: "#fff", fontSize: 13,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: F, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {saving
              ? <><RotateCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Guardando…</>
              : <><Save size={13} /> {mode === "add" ? "Crear equipo" : "Guardar cambios"}</>
            }
          </button>
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
//  TeamDetailDrawer — Ver miembros + CTA Gestionar
// ═══════════════════════════════════════════════════════════
interface TeamDetailDrawerProps {
  team: Team | null;
  members: AppUser[];
  loadingMembers: boolean;
  onClose: () => void;
  onNavigateUsers: (teamId: string) => void;
  onEdit: (team: Team) => void;
}

const ROLE_CHIP: Record<string, { bg: string; color: string; border: string }> = {
  "Admin":        { bg: "#EFF6FC", color: "#0078D4", border: "#C7E0F4" },
  "IT AirEuropa": { bg: "#F3FBF5", color: "#107C10", border: "#B7E0B8" },
  "Proveedor":    { bg: "#FEF9F0", color: "#CA8B00", border: "#F2D98B" },
  "Usuario":      { bg: "#F8F0FF", color: "#7530AF", border: "#D8B4FE" },
  "Invitado":     { bg: "#FAF9F8", color: "#A19F9D", border: "#EDEBE9" },
};

const TeamDetailDrawer: React.FC<TeamDetailDrawerProps> = ({
  team, members, loadingMembers, onClose, onNavigateUsers, onEdit,
}) => {
  if (!team) return null;

  const cfg = TEAM_TYPE_CFG[team.type];
  const Icon = cfg.Icon;
  const activeMembers = members.filter((m) => m.isActive);
  const inactiveMembers = members.filter((m) => !m.isActive);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 4000 }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
        background: "#fff", zIndex: 4001,
        display: "flex", flexDirection: "column",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.14)",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px 16px", borderBottom: "1px solid #EDEBE9",
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
          background: cfg.bg,
        }}>
          <div style={{
            width: 40, height: 40, background: "#fff", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.10)", flexShrink: 0,
          }}>
            <Icon size={20} color={cfg.color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontSize: 16, fontWeight: 700, color: "#201F1E", margin: "0 0 2px",
              fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {team.name}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TypeChip type={team.type} />
              <StatusChip active={team.isActive} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => onEdit(team)}
              title="Editar equipo"
              style={{
                background: "#fff", border: "1px solid #EDEBE9", cursor: "pointer",
                padding: "6px 10px", borderRadius: 6, color: "#605E5C",
                display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: F,
              }}
            >
              <Pencil size={13} /> Editar
            </button>
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: 6, borderRadius: 6, color: "#A19F9D", display: "flex",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Resumen */}
        <div style={{
          padding: "14px 24px", borderBottom: "1px solid #EDEBE9",
          display: "flex", gap: 24, flexShrink: 0,
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#201F1E", fontFamily: F }}>
              {members.length}
            </div>
            <div style={{ fontSize: 11, color: "#605E5C", fontFamily: F }}>Miembros totales</div>
          </div>
          <div style={{ width: 1, background: "#EDEBE9" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#107C10", fontFamily: F }}>
              {activeMembers.length}
            </div>
            <div style={{ fontSize: 11, color: "#605E5C", fontFamily: F }}>Activos</div>
          </div>
          <div style={{ width: 1, background: "#EDEBE9" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#A19F9D", fontFamily: F }}>
              {inactiveMembers.length}
            </div>
            <div style={{ fontSize: 11, color: "#605E5C", fontFamily: F }}>Inactivos</div>
          </div>
        </div>

        {/* Lista miembros */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loadingMembers ? (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: 32, color: "#605E5C", fontFamily: F, fontSize: 13,
            }}>
              <RotateCw size={16} style={{ animation: "spin 1s linear infinite" }} />
              Cargando miembros…
            </div>
          ) : members.length === 0 ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "32px 16px", gap: 8, color: "#A19F9D",
            }}>
              <Users size={32} strokeWidth={1.5} color="#EDEBE9" />
              <div style={{ fontSize: 13, fontFamily: F }}>Este equipo no tiene miembros aún</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {members.map((m) => {
                const rc = ROLE_CHIP[m.role] ?? ROLE_CHIP["Invitado"];
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 8,
                      border: "1px solid #F3F2F1",
                      background: m.isActive ? "#FAFAFA" : "#FAF9F8",
                      opacity: m.isActive ? 1 : 0.65,
                    }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: rc.bg, border: `1px solid ${rc.border}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: rc.color, fontFamily: F,
                    }}>
                      {m.displayName.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: "#201F1E",
                        fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {m.displayName}
                      </div>
                      <div style={{
                        fontSize: 11, color: "#A19F9D", fontFamily: F,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {m.email}
                      </div>
                    </div>
                    {/* Role chip */}
                    <span style={{
                      display: "inline-flex", alignItems: "center",
                      padding: "2px 8px", borderRadius: 20,
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                      background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                      fontFamily: F,
                    }}>
                      {m.role}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div style={{
          padding: "14px 24px", borderTop: "1px solid #EDEBE9",
          display: "flex", flexDirection: "column", gap: 8, flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, color: "#A19F9D", fontFamily: F }}>
            Para añadir o quitar miembros, ve a la pantalla de Usuarios y filtra por este equipo.
          </div>
          <button
            onClick={() => onNavigateUsers(team.id)}
            style={{
              width: "100%", padding: "10px 16px",
              borderRadius: 6, border: "1px solid #0078D4",
              background: "#EFF6FC", color: "#0078D4",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: F, display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8,
            }}
          >
            <Users size={14} />
            Gestionar miembros
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
//  ConfirmModal
// ═══════════════════════════════════════════════════════════
const ConfirmModal: React.FC<{
  open: boolean; title: string; message: string;
  confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}> = ({ open, title, message, confirmLabel = "Confirmar", danger, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: "28px 32px",
        maxWidth: 400, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        fontFamily: F,
      }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#201F1E" }}>
          {title}
        </h3>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#605E5C", lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "9px 20px", borderRadius: 6, border: "1px solid #EDEBE9",
              background: "#fff", color: "#201F1E", fontSize: 13, cursor: "pointer", fontWeight: 600,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "9px 22px", borderRadius: 6, border: "none",
              background: danger ? "#D13438" : "#0078D4",
              color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 700,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  AdminTeamsPage — Pantalla principal
// ═══════════════════════════════════════════════════════════
export const AdminTeamsPage: React.FC = () => {
  const navigate = useNavigate();

  // ── Estado ────────────────────────────────────────────
  const [teams,      setTeams]      = useState<Team[]>([]);
  const [allUsers,   setAllUsers]   = useState<AppUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [toasts,     setToasts]     = useState<ToastMsg[]>([]);

  // Filtros
  const [search,       setSearch]       = useState("");
  const [filterType,   setFilterType]   = useState<TeamType | "">("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">("");

  // Drawer formulario
  const [formDrawer, setFormDrawer] = useState<{
    open: boolean; mode: "add" | "edit"; team: Team | null;
  }>({ open: false, mode: "add", team: null });

  // Drawer detalle / miembros
  const [detailDrawer, setDetailDrawer] = useState<{
    open: boolean; team: Team | null;
  }>({ open: false, team: null });
  const [members,         setMembers]         = useState<AppUser[]>([]);
  const [loadingMembers,  setLoadingMembers]  = useState(false);

  // Confirm modal
  const [confirm, setConfirm] = useState<{
    open: boolean; title: string; message: string;
    confirmLabel: string; danger: boolean; onConfirm: () => void;
  }>({ open: false, title: "", message: "", confirmLabel: "", danger: false, onConfirm: () => {} });

  // ── Toast ────────────────────────────────────────────
  const addToast = useCallback((msg: string, ok = true) => {
    setToasts((prev) => [...prev, newAdminToast(msg, ok ? "success" : "error")]);
  }, []);

  // ── Carga de datos ────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsData, usersData] = await Promise.all([
        listTeams(),
        listAppUsers({ isActive: undefined }),
      ]);
      setTeams(teamsData);
      setAllUsers(usersData);
    } catch (e: unknown) {
      addToast(e instanceof Error ? e.message : "Error al cargar los datos.", false);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  // ── Miembros de un equipo ────────────────────────────
  const loadMembers = useCallback(async (teamId: string) => {
    setLoadingMembers(true);
    try {
      const data = await listAppUsers({ teamId, isActive: undefined });
      setMembers(data);
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // ── Filtrado local ────────────────────────────────────
  const filtered = teams.filter((t) => {
    if (filterType   && t.type     !== filterType)                       return false;
    if (filterStatus === "active"   && !t.isActive)                      return false;
    if (filterStatus === "inactive" &&  t.isActive)                      return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ── Conteo de miembros por equipo ─────────────────────
  const memberCount = (teamId: string) =>
    allUsers.filter((u) => u.teamIds.includes(teamId)).length;

  // ── Acciones ──────────────────────────────────────────
  const openCreate = () => setFormDrawer({ open: true, mode: "add", team: null });

  const openEdit = (team: Team) => {
    // Cerrar detail drawer si está abierto
    setDetailDrawer({ open: false, team: null });
    setFormDrawer({ open: true, mode: "edit", team });
  };

  const openDetail = async (team: Team) => {
    setDetailDrawer({ open: true, team });
    await loadMembers(team.id);
  };

  const handleSaved = (saved: Team) => {
    setTeams((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    // Refrescar users para actualizar conteos
    listAppUsers({ isActive: undefined }).then(setAllUsers).catch(() => {});
  };

  const askToggleActive = (team: Team) => {
    const isActivating = !team.isActive;
    setConfirm({
      open: true,
      title: isActivating ? "Activar equipo" : "Desactivar equipo",
      message: isActivating
        ? `¿Activar el equipo '${team.name}'? Volverá a aparecer en los selectores de asignación.`
        : `¿Desactivar el equipo '${team.name}'? Dejará de aparecer en los selectores de asignación.`,
      confirmLabel: isActivating ? "Activar" : "Desactivar",
      danger: !isActivating,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        try {
          const updated = isActivating
            ? await activateTeam(team.id)
            : await deactivateTeam(team.id);
          setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          // Actualizar detail drawer si estaba abierto en este equipo
          if (detailDrawer.open && detailDrawer.team?.id === updated.id) {
            setDetailDrawer({ open: true, team: updated });
          }
          addToast(
            isActivating
              ? `Equipo '${updated.name}' activado.`
              : `Equipo '${updated.name}' desactivado.`,
          );
        } catch (e: unknown) {
          addToast(e instanceof Error ? e.message : "Error al cambiar el estado.", false);
        }
      },
    });
  };

  // ── Tabla: columnas ────────────────────────────────────
  const thSt: React.CSSProperties = {
    padding: "10px 14px", textAlign: "left",
    fontSize: 11, fontWeight: 700, color: "#605E5C",
    background: "#F8F7F6", borderBottom: "1px solid #EDEBE9",
    textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: F,
    whiteSpace: "nowrap",
  };
  const tdSt: React.CSSProperties = {
    padding: "12px 14px", borderBottom: "1px solid #F3F2F1",
    fontSize: 13, color: "#201F1E", fontFamily: F, verticalAlign: "middle",
  };

  return (
    <div style={{ padding: "28px 32px", fontFamily: F, maxWidth: 1100, margin: "0 auto" }}>
      {/* Toasts */}
      <AdminToastContainer toasts={toasts} onRemove={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {/* ── Page Header ────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 11,
            background: "linear-gradient(135deg, #EFF6FC, #C7E0F4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,120,212,0.15)",
          }}>
            <Network size={22} color="#0078D4" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#201F1E", margin: "0 0 3px", fontFamily: F }}>
              Gestión de Equipos
            </h1>
            <p style={{ fontSize: 13, color: "#605E5C", margin: 0, fontFamily: F }}>
              Administra las áreas, equipos proveedores e internos de la plataforma.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            onClick={load}
            disabled={loading}
            title="Refrescar lista"
            style={{
              padding: "9px 16px", borderRadius: 6, border: "1px solid #EDEBE9",
              background: "#fff", color: "#605E5C", fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: F, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <RotateCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            Refrescar
          </button>
          <button
            onClick={openCreate}
            style={{
              padding: "9px 18px", borderRadius: 6, border: "none",
              background: "#0078D4", color: "#fff", fontSize: 13,
              cursor: "pointer", fontFamily: F, fontWeight: 700,
              display: "flex", alignItems: "center", gap: 7,
              boxShadow: "0 2px 6px rgba(0,120,212,0.25)",
            }}
          >
            <Plus size={15} /> Nuevo equipo
          </button>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        flexWrap: "wrap", marginBottom: 20,
      }}>
        {/* Búsqueda */}
        <div style={{ position: "relative", flex: "0 0 260px" }}>
          <Search size={14} color="#A19F9D" style={{
            position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none",
          }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "8px 32px 8px 34px",
              borderRadius: 6, border: "1px solid #EDEBE9",
              fontSize: 13, fontFamily: F, color: "#201F1E", outline: "none",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#0078D4"; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = "#EDEBE9"; }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                padding: 2, display: "flex", color: "#A19F9D",
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Tipo */}
        <FilterSelect value={filterType} onChange={(v) => setFilterType(v as TeamType | "")}>
          <option value="">Todos los tipos</option>
          {TEAM_TYPES.map((t) => (
            <option key={t} value={t}>{TEAM_TYPE_CFG[t].label}</option>
          ))}
        </FilterSelect>

        {/* Estado */}
        <FilterSelect value={filterStatus} onChange={(v) => setFilterStatus(v as "" | "active" | "inactive")}>
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </FilterSelect>

        {/* Contador */}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#605E5C", fontFamily: F, fontWeight: 600 }}>
          {filtered.length} de {teams.length} equipo{teams.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Tabla ───────────────────────────────────────── */}
      <div style={{
        background: "#fff", border: "1px solid #EDEBE9", borderRadius: 10,
        overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}>
        {loading ? (
          <div style={{
            padding: "48px 32px", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 10, color: "#605E5C", fontFamily: F, fontSize: 13,
          }}>
            <RotateCw size={18} style={{ animation: "spin 1s linear infinite" }} />
            Cargando equipos…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: "48px 32px", display: "flex", flexDirection: "column",
            alignItems: "center", gap: 10, color: "#A19F9D",
          }}>
            <Network size={36} strokeWidth={1.4} color="#EDEBE9" />
            <div style={{ fontSize: 14, fontFamily: F, fontWeight: 600 }}>
              {teams.length === 0 ? "No hay equipos registrados" : "Ningún equipo coincide con los filtros"}
            </div>
            {teams.length === 0 && (
              <button
                onClick={openCreate}
                style={{
                  marginTop: 4, padding: "8px 18px", borderRadius: 6, border: "none",
                  background: "#0078D4", color: "#fff", fontSize: 13,
                  cursor: "pointer", fontFamily: F, fontWeight: 700,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Plus size={14} /> Crear primer equipo
              </button>
            )}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thSt}>Nombre</th>
                <th style={thSt}>Tipo</th>
                <th style={{ ...thSt, textAlign: "center" }}>Miembros</th>
                <th style={thSt}>Estado</th>
                <th style={{ ...thSt, textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((team) => {
                const cfg = TEAM_TYPE_CFG[team.type];
                const TIcon = cfg.Icon;
                const count = memberCount(team.id);

                return (
                  <tr
                    key={team.id}
                    style={{ transition: "background 120ms" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#FAFAFA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                  >
                    {/* Nombre */}
                    <td style={tdSt}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: cfg.bg, border: `1px solid ${cfg.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <TIcon size={15} color={cfg.color} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "#201F1E", fontFamily: F }}>
                            {team.name}
                          </div>
                          <div style={{ fontSize: 11, color: "#A19F9D", fontFamily: F }}>
                            {team.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Tipo */}
                    <td style={tdSt}>
                      <TypeChip type={team.type} />
                    </td>

                    {/* Miembros */}
                    <td style={{ ...tdSt, textAlign: "center" }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "4px 12px", borderRadius: 20,
                        background: count > 0 ? "#EFF6FC" : "#FAF9F8",
                        color: count > 0 ? "#0078D4" : "#A19F9D",
                        fontSize: 12, fontWeight: 700, fontFamily: F,
                        border: `1px solid ${count > 0 ? "#C7E0F4" : "#EDEBE9"}`,
                      }}>
                        <Users size={11} strokeWidth={2} />
                        {count}
                      </span>
                    </td>

                    {/* Estado */}
                    <td style={tdSt}>
                      <StatusChip active={team.isActive} />
                    </td>

                    {/* Acciones */}
                    <td style={{ ...tdSt, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        {/* Ver miembros */}
                        <button
                          onClick={() => openDetail(team)}
                          title="Ver miembros"
                          style={{
                            padding: "6px 10px", borderRadius: 6,
                            border: "1px solid #EDEBE9", background: "#fff",
                            cursor: "pointer", color: "#605E5C",
                            display: "flex", alignItems: "center", gap: 4,
                            fontSize: 12, fontFamily: F,
                          }}
                        >
                          <Eye size={13} /> Miembros
                        </button>

                        {/* Editar */}
                        <button
                          onClick={() => openEdit(team)}
                          title="Editar equipo"
                          style={{
                            padding: "6px 10px", borderRadius: 6,
                            border: "1px solid #EDEBE9", background: "#fff",
                            cursor: "pointer", color: "#605E5C",
                            display: "flex", alignItems: "center", gap: 4,
                            fontSize: 12, fontFamily: F,
                          }}
                        >
                          <Pencil size={13} /> Editar
                        </button>

                        {/* Activar / Desactivar */}
                        <button
                          onClick={() => askToggleActive(team)}
                          title={team.isActive ? "Desactivar equipo" : "Activar equipo"}
                          style={{
                            padding: "6px 10px", borderRadius: 6,
                            border: `1px solid ${team.isActive ? "#FDD8D8" : "#B7E0B8"}`,
                            background: team.isActive ? "#FFF4F4" : "#F3FBF5",
                            cursor: "pointer",
                            color: team.isActive ? "#D13438" : "#107C10",
                            display: "flex", alignItems: "center", gap: 4,
                            fontSize: 12, fontFamily: F,
                          }}
                        >
                          {team.isActive
                            ? <><UserX size={13} /> Desactivar</>
                            : <><UserCheck size={13} /> Activar</>
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Drawers y modal ──────────────────────────────── */}
      <TeamFormDrawer
        open={formDrawer.open}
        mode={formDrawer.mode}
        team={formDrawer.team}
        onClose={() => setFormDrawer((d) => ({ ...d, open: false }))}
        onSaved={handleSaved}
        addToast={addToast}
      />

      <TeamDetailDrawer
        team={detailDrawer.team}
        members={members}
        loadingMembers={loadingMembers}
        onClose={() => setDetailDrawer({ open: false, team: null })}
        onNavigateUsers={(teamId) => navigate(`/admin/users?teamId=${teamId}`)}
        onEdit={openEdit}
      />

      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        danger={confirm.danger}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />

      {/* Keyframe spin para los loaders */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
